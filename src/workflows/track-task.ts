import type { FlueContext } from '@flue/runtime';
import * as v from 'valibot';
import { execFileSync } from 'node:child_process';
// NOTE: the expert registry lives OUTSIDE src/agents/ on purpose — flue treats
// every src/agents/*.ts as an addressable agent and requires it to
// default-export createAgent(...); the registry is a Record consumed via init().
import trackExperts, { buildBoss, expertFor, DEFAULT_MODEL } from '../track-experts';
import trackTask from '../skills/track-task/SKILL.md' with { type: 'skill' };
import trackUndo from '../skills/track-undo/SKILL.md' with { type: 'skill' };

// Track specialist workflow v2: route a designer's request to the trained
// mastery expert for one DOTS Timeline track family and return a MEMORY CARD
// envelope (the contract the Python codex codes against):
//
//   { ok, track, request, explanation, code, result, undo, gaps,
//     repairRounds, session }
//
// Conversation continuity: the caller may pass `payload.session` (a stable
// name the Python side generates once per designer conversation) and, on
// follow-ups, `payload.context` carrying the PRIOR memory card JSON. The
// session name selects the named conversation scope WITHIN this process and
// is echoed back in the envelope so the caller can thread follow-ups.
// VERIFIED LIMIT (tested 2026-06-12, two `flue run` invocations, same name):
// named sessions do NOT restore conversation across separate `flue run`
// processes — each invocation's harness instanceId is a fresh workflow runId
// (dist/server.mjs: `instanceId: runId`), and the session storage key embeds
// that instanceId, so the same name maps to a different stored session every
// run (and without src/db.ts the store is in-memory anyway). Cross-request
// continuity therefore ships as card-as-context: the track-task skill treats
// a prior-card `context` as the agent's own previous work.
//
// Two-pass design (the runtime supports sequential session.skill() calls on
// one session — sessions are named conversation scopes; only CONCURRENT
// in-flight operations throw):
//   pass 1 (track-task skill)  -> { code, explanation }
//   exec via unity-cli          -> result (contains the PRE| capture lines)
//     ↳ compile-repair loop: a COMPILE error means nothing executed (zero
//       mutations), so retrying is safe — feed the errors + previous code
//       back to the SAME session (re-invoking track-task with previousCode/
//       compileErrors args) for a corrected block, max 2 repair rounds
//       (3 exec attempts total). Runtime/exec failures are NOT retried:
//       mutations may have partially applied, so they fall through to pass 2
//       for defensive undo derivation as before.
//   pass 2 (track-undo skill)   -> { undo, gaps } derived from the ACTUAL
//                                  printed PRE| values (evidence-derived undo
//                                  per unity-agent-protocol §5).
export async function run({ init, payload, id }: FlueContext) {
	const track = String((payload as any).track ?? '');
	const request = String((payload as any).request ?? '');
	const context = String((payload as any).context ?? '');
	// Conversation name: caller-provided when continuing, otherwise derived
	// from the runtime's own run id (deterministic, no Date.now/Math.random).
	// Names starting with "task:" are reserved by the runtime — prefix guards.
	const rawSession = String((payload as any).session ?? '').trim();
	const sessionName = rawSession && !rawSession.startsWith('task:')
		? rawSession
		: `conv-${id.replace(/[^A-Za-z0-9_-]+/g, '-')}`;

	// The boss may be composed from a chosen SUBSET of mastery skills: the
	// notebook passes `payload.skills` (mastery skill names) so a designer can
	// trim the 165k-token full boss down to just what a request needs. Any
	// other track ignores it and uses its fixed expert.
	const skillNames: string[] = Array.isArray((payload as any).skills)
		? (payload as any).skills.map(String).filter(Boolean)
		: [];
	// Optional per-request model override (any provider/model the runtime
	// supports). With an override we rebuild the expert on that model; without
	// one we use the prebuilt registry (default model). The Editor/unity-cli
	// side passes this, so callers pick the model without touching flue.
	const model = String((payload as any).model ?? '').trim();
	const expert = model
		? expertFor(track, model, skillNames)
		: track === '__boss__' && skillNames.length
			? buildBoss(skillNames)
			: trackExperts[track];
	if (!expert) {
		return { ok: false, error: 'unknown track', available: Object.keys(trackExperts) };
	}

	const harness = await init(expert);
	const session = await harness.session(sessionName);

	const resultSchema = v.object({ code: v.string(), explanation: v.string() });

	// Pass 1: produce the C# (with PRE| captures baked in) + explanation.
	let { data } = await session.skill(trackTask, {
		args: { request, context },
		result: resultSchema,
	});

	// Unlike spawn-agent, we run the code RAW — no subSceneBracket wrap. The
	// mastery recipes bracket scenes themselves (open SubScene, save, restore
	// parent with OpenSceneMode.Single), so wrapping again would double-manage
	// scene state and break the recipes' save/restore semantics.
	//
	// Compile-repair loop: a compile error is reported by the editor BEFORE
	// anything runs — zero mutations — so feeding the errors back to the same
	// session for a corrected block and re-exec'ing is safe. Anything else
	// (runtime exception, timeout) may have partially mutated the editor and
	// must NOT be auto-retried; it falls through to pass 2 unchanged.
	const MAX_EXEC_ATTEMPTS = 3; // 1 initial + up to 2 repair rounds
	let result = '';
	let ok = false;
	let repairRounds = 0;
	for (let attempt = 1; attempt <= MAX_EXEC_ATTEMPTS; attempt++) {
		// Listener timeouts are TRANSIENT (domain reloads / editor settling) and
		// nothing executed — retry the SAME code up to 3× with ~20s gaps before
		// treating it as a failure.
		for (let listenerTry = 1; listenerTry <= 3; listenerTry++) {
			try {
				result = execFileSync('unity-cli', ['exec', data.code], {
					encoding: 'utf8',
					timeout: 120000,
				}).trim();
				ok = true;
			} catch (e: any) {
				ok = false;
				result = 'EXEC FAILED: ' + (e?.stderr?.toString?.() || e?.message || String(e));
			}
			if (ok || !/unity listener|health endpoint/i.test(result) || listenerTry === 3) break;
			await new Promise((r) => setTimeout(r, 20000));
		}
		if (ok || !/compile error/i.test(result) || attempt === MAX_EXEC_ATTEMPTS) break;

		// Compile error — ask the SAME session for a corrected block (same
		// {code, explanation} contract; track-task's repair-round section
		// defines the previousCode/compileErrors args).
		try {
			const repair = await session.skill(trackTask, {
				args: { request, context, previousCode: data.code, compileErrors: result },
				result: resultSchema,
			});
			data = repair.data;
			repairRounds++;
		} catch (e: any) {
			// Repair pass itself failed (model error/give_up) — keep the honest
			// compile-failure result and stop retrying.
			result += '\n(repair pass failed: ' + (e?.message || String(e)) + ')';
			break;
		}
	}

	// Pass 2: feed the ACTUAL exec output back to the same session and derive
	// the undo journal + gaps from the printed PRE| evidence. Runs even when
	// the exec failed — mutations may have partially applied, and the journal
	// should then carry defensive cleanup guidance.
	let undo: string[] = [];
	let gaps = '';
	try {
		const pass2 = await session.skill(trackUndo, {
			args: { execOk: String(ok), execOutput: result },
			result: v.object({ undo: v.array(v.string()), gaps: v.string() }),
		});
		undo = pass2.data.undo;
		gaps = pass2.data.gaps;
	} catch (e: any) {
		gaps = 'undo derivation (pass 2) failed: ' + (e?.message || String(e));
	}

	// Contract: on exec failure, gaps must say so even if the model did not.
	if (!ok && !/exec.*fail|fail.*exec/i.test(gaps)) {
		gaps = ('exec failed — work may have partially applied. ' + gaps).trim();
	}

	return {
		ok,
		track,
		request,
		explanation: data.explanation,
		code: data.code,
		result,
		repairRounds,
		undo,
		gaps,
		session: sessionName,
		skills: skillNames,
		model: model || DEFAULT_MODEL,
	};
}
