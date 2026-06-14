import type { FlueContext } from '@flue/runtime';
import * as v from 'valibot';
import { execFileSync } from 'node:child_process';
import { buildJudge, expertFor, DEFAULT_MODEL } from '../track-experts';
import { resolvePlan, withKeyFallback, costSpent } from '../keys';
import trackTask from '../skills/track-task/SKILL.md' with { type: 'skill' };
import trackUndo from '../skills/track-undo/SKILL.md' with { type: 'skill' };
import judge from '../skills/judge/SKILL.md' with { type: 'skill' };
import { vexTools } from '../tools/vex';

// forge — the coder→judge→refine-until-perfect workflow (Phase 2).
//
// The single-pass track-task workflow has ONE agent author + self-verify a Unity
// change. forge raises quality without bloating skills by adding an ADVERSARIAL
// loop on top of that exact pass:
//
//   coder (GLM, full context, long-lived session)
//     → inner compile-repair loop (REUSED VERBATIM from track-task.ts: a compile
//        error means nothing ran, so feed previousCode+compileErrors back to the
//        SAME session, max 2 repairs; runtime/timeout failures are NOT retried)
//     → derive undo+gaps (track-undo) from the printed PRE| evidence
//     → judge (a FRESH, isolated MiniMax agent each round): given ONLY the raw
//        artifacts — request, submitted code, exec evidence, undo journal, exec_ok
//        — never the coder's reasoning. The judge first authors its OWN read-back
//        verification `code`; the workflow execs it and re-calls the judge with
//        `independent_evidence`; the verdict is grounded in evidence the JUDGE
//        produced, and the workflow ENFORCES pass ⇒ execOk && no blocking issues.
//     → on FAIL, feed the blocking issues back to the SAME coder session and
//        re-judge. Stop on perfection · maxRounds (default 4) · budgetUsd.
//
// On no-perfection it returns an HONEST best-effort card: the coder's last
// code/result/undo PLUS a `judge` block (verdict/score/blocking_issues) so a
// human sees WHY, and `gaps` states it did not reach perfection + the outstanding
// issues. Return envelope is a SUPERSET of the track-task memory card, so existing
// card parsers keep working.
//
// GLM peak collapse: when the peak guard drops GLM, both coder and judge resolve
// to MiniMax. We keep running (fresh session + blind packet still give
// independence) but flag `modelsDiverge=false` in gaps/judge.notes so the human
// knows the verdict had less model diversity.

const EXEC_USINGS = 'UnityEngine,UnityEditor,System,System.Linq,System.Collections.Generic';

// Mirror chat.ts runCode: never throw — surface unity-cli failures as a string
// the loop classifies (EXEC FAILED) so the judge always sees evidence.
function runCode(code: string): string {
	try {
		return execFileSync('unity-cli', ['exec', code, '--usings', EXEC_USINGS], { encoding: 'utf8', timeout: 120000 }).trim();
	} catch (e: any) {
		return 'EXEC FAILED: ' + (e?.stderr?.toString?.() || e?.message || String(e));
	}
}

const isExecFailed = (r: string) => r.startsWith('EXEC FAILED');
const isCompileError = (r: string) => /compile error/i.test(r);

export async function run({ init, payload, id }: FlueContext) {
	const request = String((payload as any).request ?? '');
	const context = String((payload as any).context ?? '');
	const track = String((payload as any).track ?? '__d1__');
	const skillNames: string[] = Array.isArray((payload as any).skills)
		? (payload as any).skills.map(String).filter(Boolean)
		: [];
	const maxRounds = Math.max(1, Number((payload as any).maxRounds) || 4);
	const budgetUsd = Math.max(0, Number((payload as any).budgetUsd) || 0); // 0 = no $ cap
	const payloadModel = String((payload as any).model ?? '').trim();

	// Session name: caller-provided when continuing, else derived from the run id
	// (deterministic, no Date.now/Math.random — same rule as track-task/chat).
	const rawSession = String((payload as any).session ?? '').trim();
	const sessionName = rawSession && !rawSession.startsWith('task:')
		? rawSession
		: `forge-${id.replace(/[^A-Za-z0-9_-]+/g, '-')}`;

	// Coder = GLM (peak-guarded → MiniMax net); Judge = MiniMax always. Resolve
	// both plans up front so we know the concrete models and whether they diverge.
	const coderPlan = resolvePlan(payloadModel || 'glm');
	const coderModel = coderPlan[0]?.model ?? DEFAULT_MODEL;
	const judgePlan = resolvePlan('default');
	const judgeModel = judgePlan[0]?.model ?? DEFAULT_MODEL;
	const modelsDiverge = coderModel.split('/')[0] !== judgeModel.split('/')[0];

	// Common honest failure envelope (always structured JSON for the Editor).
	const fail = (gaps: string, explanation = '') => ({
		ok: false, track, request, explanation, code: '', result: '', repairRounds: 0,
		undo: [] as string[], gaps, session: sessionName, model: coderModel,
		judge: { verdict: 'fail', score: 0, blocking_issues: [] as string[], notes: gaps, model: judgeModel, modelsDiverge },
		rounds: [] as Array<{ round: number; score: number; verdict: string; repairRounds: number }>,
	});

	// Build the coder expert on the concrete coderModel (D1 / boss / a specific
	// track), then a long-lived session that ACCUMULATES what was tried + rejected
	// across refine rounds.
	// expertFor handles __d1__ / __boss__ (composing the skill subset) and the
	// specific tracks, rebuilding on coderModel; returns undefined only for an
	// unknown specific track.
	const coderAgent = expertFor(track, coderModel, skillNames);
	if (!coderAgent) {
		return fail('unknown track: ' + track);
	}
	// Two SEPARATE harnesses in one workflow context — each harness name may be
	// init'd only once per context, so the coder and judge get DISTINCT names
	// (the default 'default' name would collide on the second init()).
	const coder = await (await init(coderAgent, { name: 'coder' })).session(sessionName);

	// Judge harness is a SEPARATE, isolated init — a fresh session per round keeps
	// each verdict context-independent.
	const judgeHarness = await init(buildJudge(judgeModel), { name: 'judge' });

	const builderSchema = v.object({ code: v.string(), explanation: v.string() });
	const undoSchema = v.object({ undo: v.array(v.string()), gaps: v.string() });
	const judgeSchema = v.object({
		verdict: v.picklist(['pass', 'fail']),
		score: v.number(),
		blocking_issues: v.array(v.string()),
		notes: v.string(),
		code: v.string(),
	});

	const startCost = costSpent();
	const rounds: Array<{ round: number; score: number; verdict: string; repairRounds: number }> = [];

	// Carried across rounds.
	let code = '';
	let explanation = '';
	let result = '';
	let undo: string[] = [];
	let gaps = '';
	let repairRoundsTotal = 0;
	let judgeVerdict = 'fail';
	let judgeScore = 0;
	let blockingIssues: string[] = [];
	let judgeNotes = '';
	let judgeFeedback = '';
	let ok = false;
	let budgetHit = false;

	for (let round = 1; round <= maxRounds; round++) {
		// (a) Coder authors the C# (round 1: fresh; later rounds: refine on the
		// judge's blocking issues, with the previous code in hand).
		let data: { code: string; explanation: string };
		try {
			const { value } = await withKeyFallback(
				coderPlan,
				async (m) => await coder.skill(trackTask, {
					args: round === 1 ? { request, context } : { request, context, previousCode: code, judgeFeedback },
					result: builderSchema,
					model: m,
					tools: vexTools,
				}),
				(failed, next, err) => process.stderr.write(`[flue] coder key ${failed.key} (${failed.model}) failed: ${(err as any)?.message || String(err)}${next ? `; trying ${next.key}` : ''}\n`),
			);
			data = value.data;
		} catch (e: any) {
			gaps = `coder model call failed in round ${round}: ${e?.message || String(e)}`;
			break;
		}
		code = data.code;
		explanation = data.explanation;

		// (b) Inner compile-repair loop — REUSED from track-task.ts. A compile error
		// means nothing executed (zero mutations) so re-asking the SAME session with
		// previousCode+compileErrors is safe; runtime/exec failures are NOT retried.
		const MAX_EXEC_ATTEMPTS = 3; // 1 initial + up to 2 repair rounds
		let repairRounds = 0;
		for (let attempt = 1; attempt <= MAX_EXEC_ATTEMPTS; attempt++) {
			// Listener timeouts are transient (domain reloads / settling) and nothing
			// ran — retry the SAME code up to 3× with ~20s gaps before failing.
			for (let listenerTry = 1; listenerTry <= 3; listenerTry++) {
				result = runCode(code);
				if (!isExecFailed(result) || !/unity listener|health endpoint/i.test(result) || listenerTry === 3) break;
				await new Promise((r) => setTimeout(r, 20000));
			}
			if (!isCompileError(result) || attempt === MAX_EXEC_ATTEMPTS) break;
			try {
				const { value: repair } = await withKeyFallback(
					coderPlan,
					async (m) => await coder.skill(trackTask, {
						args: { request, context, previousCode: code, compileErrors: result },
						result: builderSchema,
						model: m,
						tools: vexTools,
					}),
				);
				code = repair.data.code;
				explanation = repair.data.explanation;
				repairRounds++;
			} catch (e: any) {
				result += '\n(repair pass failed: ' + (e?.message || String(e)) + ')';
				break;
			}
		}
		repairRoundsTotal += repairRounds;
		const execOk = !isExecFailed(result) && !isCompileError(result);

		// (c) Derive the undo journal + gaps from the printed PRE| evidence
		// (best-effort; never aborts the round).
		try {
			const pass2 = await coder.skill(trackUndo, {
				args: { execOk: String(execOk), execOutput: result },
				result: undoSchema,
			});
			undo = pass2.data.undo;
			gaps = pass2.data.gaps;
		} catch (e: any) {
			undo = [];
			gaps = 'undo derivation failed: ' + (e?.message || String(e));
		}

		// (d) Judge — a FRESH isolated session per round. Blind packet: NO coder
		// reasoning. First call → judge emits its OWN verification `code`; we exec it
		// and re-call with independent_evidence so the verdict rests on the judge's
		// own evidence.
		try {
			const judgeSession = await judgeHarness.session(`judge-${id}-r${round}`);
			const judgeArgs: Record<string, string> = {
				request,
				submitted_code: code,
				exec_evidence: result,
				undo_journal: JSON.stringify(undo),
				exec_ok: String(execOk),
			};
			let jv = (await withKeyFallback(
				judgePlan,
				async (m) => await judgeSession.skill(judge, { args: judgeArgs, result: judgeSchema, model: m, tools: vexTools }),
				(failed, next, err) => process.stderr.write(`[flue] judge key ${failed.key} (${failed.model}) failed: ${(err as any)?.message || String(err)}${next ? `; trying ${next.key}` : ''}\n`),
			)).value.data;

			// If the judge authored independent verification, run it and re-judge on it.
			if (jv.code && jv.code.trim()) {
				const independent = runCode(jv.code);
				jv = (await withKeyFallback(
					judgePlan,
					async (m) => await judgeSession.skill(judge, {
						args: { ...judgeArgs, independent_evidence: independent },
						result: judgeSchema,
						model: m,
						tools: vexTools,
					}),
				)).value.data;
			}

			judgeVerdict = jv.verdict;
			judgeScore = jv.score;
			blockingIssues = jv.blocking_issues ?? [];
			judgeNotes = jv.notes ?? '';
		} catch (e: any) {
			// Judge unavailable — cannot certify perfection; treat as a fail this round.
			judgeVerdict = 'fail';
			judgeScore = 0;
			blockingIssues = ['judge model call failed: ' + (e?.message || String(e))];
			judgeNotes = blockingIssues[0];
		}

		rounds.push({ round, score: judgeScore, verdict: judgeVerdict, repairRounds });

		// (e) Stop conditions. Perfection: exec succeeded AND the judge passed AND no
		// blocking issues (the workflow enforces this superset, not the model's word).
		if (execOk && judgeVerdict === 'pass' && blockingIssues.length === 0) {
			ok = true;
			break;
		}
		if (round === maxRounds) break;
		if (budgetUsd > 0 && costSpent() - startCost >= budgetUsd) {
			budgetHit = true;
			break;
		}
		// Feed the judge's blocking issues back to the SAME coder session.
		judgeFeedback = [
			...(blockingIssues.length ? blockingIssues.map((b, i) => `${i + 1}. ${b}`) : ['(no specific blocking issues given — re-verify everything the request implies)']),
			judgeNotes ? `\nJudge notes: ${judgeNotes}` : '',
		].join('\n').trim();
	}

	// Honest best-effort card on no-perfection: state it, list outstanding issues.
	if (!ok) {
		const outstanding = blockingIssues.length ? blockingIssues.join('; ') : (judgeNotes || 'no specific issues reported');
		const reason = budgetHit
			? `budget of $${budgetUsd} reached after ${rounds.length} round(s)`
			: `did not reach perfection in ${rounds.length} round(s)`;
		const honest = `${reason}; outstanding: ${outstanding}`;
		gaps = gaps ? `${honest}. ${gaps}` : honest;
	}

	// GLM peak collapse note — coder + judge ran the same provider, so the verdict
	// had less model diversity.
	if (!modelsDiverge) {
		const note = `coder and judge ran the same model (${coderModel.split('/')[0]}) — likely the GLM peak window collapsed both to the same provider, so the verdict has less model diversity.`;
		gaps = gaps ? `${gaps} ${note}` : note;
		judgeNotes = judgeNotes ? `${judgeNotes} ${note}` : note;
	}

	return {
		ok,
		track,
		request,
		explanation,
		code,
		result,
		repairRounds: repairRoundsTotal,
		undo,
		gaps,
		session: sessionName,
		model: coderModel,
		judge: {
			verdict: judgeVerdict,
			score: judgeScore,
			blocking_issues: blockingIssues,
			notes: judgeNotes,
			model: judgeModel,
			modelsDiverge,
		},
		rounds,
	};
}
