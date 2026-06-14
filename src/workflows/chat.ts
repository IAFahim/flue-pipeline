import type { FlueContext } from '@flue/runtime';
import * as v from 'valibot';
import { execFileSync } from 'node:child_process';
import { buildChatAgent } from '../track-experts';
import { resolvePlan, withKeyFallback, recordUsage, DEFAULT_MODEL } from '../keys';
import chat from '../skills/chat/SKILL.md' with { type: 'skill' };
import { vexTools } from '../tools/vex';

// In-Editor chat workflow: the conversational counterpart to track-task. The chat agent answers directly and,
// when a Unity change/inspection is needed, AUTHORS C# in `code` (it has no terminal). This workflow runs that
// code via unity-cli (same mechanism the track experts use) and appends the real result to the reply — so the
// agent never shells out from its sandbox. `payload.context` carries earlier turns for continuity.
//
// Model selection: `payload.model` is threaded through `resolveModelPlan` →  an ORDERED list of models to try.
//   - 'glm' / 'glm:glm-5.2'  → the GLM Coding Plan (peak-guarded, private→shared key fallback) then minimax as a net.
//   - a concrete 'prov/mdl'  → exactly that.
//   - empty                  → minimax (DEFAULT_MODEL).
// Each model is given ONE per-call override (SkillOptions.model) so a single harness handles the whole fallback
// chain — no agent rebuild. The model that actually answers is echoed back in the envelope.
function stripUsings(code: string): string {
	return code.replace(/^[ \t]*using[ \t]+[A-Za-z0-9_.]+[ \t]*;[ \t]*\r?\n?/gm, '').trim();
}

const EXEC_USINGS = 'UnityEngine,UnityEditor,System,System.Linq,System.Collections.Generic';

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
	const requestedModel = String((payload as any).model ?? '').trim();

	// Skills the user ALLOWED in the Editor's Manage Skills window (Vex bridge → payload.skills). buildChatAgent
	// resolves the ones flue ships and ignores the rest, so opting a skill in there makes the chat agent carry it.
	const allowedSkills = Array.isArray((payload as any).skills)
		? (payload as any).skills.map((s: unknown) => String(s)).filter(Boolean)
		: [];

	const rawSession = String((payload as any).session ?? '').trim();
	const sessionName = rawSession && !rawSession.startsWith('task:')
		? rawSession
		: `chat-${id.replace(/[^A-Za-z0-9_-]+/g, '-')}`;

	const schema = v.object({ answer: v.string(), code: v.string() });

	// One harness for the whole turn; the model is overridden per call so the fallback chain needs no rebuild.
	const harness = await init(buildChatAgent(DEFAULT_MODEL, allowedSkills));
	const session = await harness.session(sessionName);
	const plan = resolvePlan(requestedModel);

	// Common failure envelope so the Editor always gets structured JSON (never an unhandled rejection).
	const fail = (gaps: string, explanation = '') => ({
		ok: false, track: 'chat', request, explanation, code: '', result: '', repairRounds: 0,
		undo: [], gaps, session: sessionName, model: plan[0]?.model ?? DEFAULT_MODEL,
	});

	// --- pass 1: the agent answers (+ optional code), routed across keys with fallback + usage accounting -----
	let data0: { answer: string; code: string };
	let usedModel = '';
	let usedKey = '';
	try {
		const { value, step } = await withKeyFallback(
			plan,
			async (m) => await session.skill(chat, { args: { request, context }, result: schema, model: m, tools: vexTools }),
			(failed, next, err) => process.stderr.write(`[flue] key ${failed.key} (${failed.model}) failed: ${(err as any)?.message || String(err)}${next ? `; trying ${next.key}` : ''}\n`),
		);
		data0 = value.data;
		usedModel = step.model;
		usedKey = step.key;
	} catch (e: any) {
		// Every key in the plan failed (rate limits, auth, or malformed structured output across the board).
		return fail('The model call failed: ' + (e?.message || String(e)));
	}

	let answer = data0.answer ?? '';
	let code = stripUsings(data0.code ?? '');
	let result = '';
	let repairRounds = 0;

	if (code) {
		result = runCode(code);
		// Compile-repair loop (up to 2 retries): a compile error means nothing ran (zero mutations), so it is safe
		// to feed the error back to the SAME session (same model that authored it) for a corrected block and re-run.
		// Note: a unity-cli failure that throws is surfaced by runCode as "EXEC FAILED" (not "compile error"), so it
		// correctly does NOT enter this loop — a thrown failure may have partially mutated state and is unsafe to rerun.
		for (let attempt = 0; attempt < 2 && isCompileError(result); attempt++) {
			repairRounds++;
			const repair = await session.skill(chat, {
				args: {
					request,
					context: `${context}\n\n[Your C# failed to compile:\n${result}\nReturn corrected C# in 'code'. No 'using' directives; end with a single 'return <value>;'.]`,
				},
				result: schema,
				model: usedModel || DEFAULT_MODEL,
				tools: vexTools,
			});
			recordUsage(usedKey || 'minimax', (repair as any).usage);
			const fixed = stripUsings(repair.data.code ?? '');
			if (!fixed) break;
			code = fixed;
			result = runCode(fixed);
			if (repair.data.answer) answer = repair.data.answer;
		}
	}

	// Honest ok/gaps. Three failure shapes the Editor must not be told are success:
	//   - exec threw (unity-cli error / runtime exception) → state may have partially applied.
	//   - compile error survived the repair budget → nothing ran, code is broken.
	// Otherwise the turn succeeded (including the no-code conversational case).
	let ok = true;
	let gaps = '';
	if (isExecFailed(result)) {
		ok = false;
		gaps = 'C# execution failed — any changes may have only partially applied. Raw error is in `result`.';
	} else if (code && isCompileError(result)) {
		ok = false;
		gaps = `C# still failed to compile after ${repairRounds} repair attempt(s); nothing was executed.`;
	}

	return {
		ok,
		track: 'chat',
		request,
		explanation: answer,
		code,
		result,
		repairRounds,
		undo: [],
		gaps,
		session: sessionName,
		model: usedModel || requestedModel || DEFAULT_MODEL,
	};
}
