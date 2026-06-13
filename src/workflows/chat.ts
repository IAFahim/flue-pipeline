import type { FlueContext } from '@flue/runtime';
import * as v from 'valibot';
import { execFileSync } from 'node:child_process';
import { buildChatAgent, DEFAULT_MODEL } from '../track-experts';
import chat from '../skills/chat/SKILL.md' with { type: 'skill' };

// In-Editor chat workflow: the conversational counterpart to track-task. The chat agent answers directly and,
// when a Unity change/inspection is needed, AUTHORS C# in `code` (it has no terminal). This workflow runs that
// code via unity-cli (same mechanism the track experts use) and appends the real result to the reply — so the
// agent never shells out from its sandbox. `payload.model` selects any model; `payload.context` carries earlier
// turns for continuity.
// unity-cli wraps the snippet in a method body, so `using` directives in the code are invalid — the agent must
// use the default usings (added below) or fully-qualified type names. Strip any it emits out of habit.
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

export async function run({ init, payload, id }: FlueContext) {
	const request = String((payload as any).request ?? '');
	const context = String((payload as any).context ?? '');
	const model = String((payload as any).model ?? '').trim();

	const rawSession = String((payload as any).session ?? '').trim();
	const sessionName = rawSession && !rawSession.startsWith('task:')
		? rawSession
		: `chat-${id.replace(/[^A-Za-z0-9_-]+/g, '-')}`;

	const agent = buildChatAgent(model || DEFAULT_MODEL);
	const harness = await init(agent);
	const session = await harness.session(sessionName);

	const schema = v.object({ answer: v.string(), code: v.string() });
	const data0 = (await session.skill(chat, { args: { request, context }, result: schema })).data;

	let answer = data0.answer ?? '';
	let result = '';
	let code = stripUsings(data0.code ?? '');
	if (code) {
		result = runCode(code);
		// Compile-repair loop (up to 2 retries): a compile error means nothing ran (zero mutations), so it is safe
		// to feed the error back to the same session for a corrected block and re-run.
		for (let attempt = 0; attempt < 2 && /compile error/i.test(result); attempt++) {
			const repair = await session.skill(chat, {
				args: {
					request,
					context: `${context}\n\n[Your C# failed to compile:\n${result}\nReturn corrected C# in 'code'. No 'using' directives; end with a single 'return <value>;'.]`,
				},
				result: schema,
			});
			const fixed = stripUsings(repair.data.code ?? '');
			if (!fixed) break;
			code = fixed;
			result = runCode(fixed);
			if (repair.data.answer) answer = repair.data.answer;
		}
		// `answer` stays the agent's prose; the raw Editor output travels in `result` and the C# renderer shows it
		// as its own block (don't append it here too, or it renders twice).
	}

	return {
		ok: !result.startsWith('EXEC FAILED'),
		track: 'chat',
		request,
		explanation: answer,
		code,
		result,
		repairRounds: 0,
		undo: [],
		gaps: '',
		session: sessionName,
		model: model || DEFAULT_MODEL,
	};
}
