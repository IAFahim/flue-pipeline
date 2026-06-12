import type { FlueContext } from '@flue/runtime';
import * as v from 'valibot';
import { execFileSync } from 'node:child_process';
import trackExperts from '../agents/track-experts';
import trackTask from '../skills/track-task/SKILL.md' with { type: 'skill' };

// Track specialist agent: route a designer's request to the trained mastery
// expert for one DOTS Timeline track family, get back { code, explanation },
// run the C# in the live Editor via unity-cli, and report the result.
export async function run({ init, payload }: FlueContext) {
	const track = String((payload as any).track ?? '');
	const request = String((payload as any).request ?? '');
	const context = String((payload as any).context ?? '');

	const expert = trackExperts[track];
	if (!expert) {
		return { ok: false, error: 'unknown track', available: Object.keys(trackExperts) };
	}

	const harness = await init(expert);
	const session = await harness.session();

	const { data } = await session.skill(trackTask, {
		args: { request, context },
		result: v.object({ code: v.string(), explanation: v.string() }),
	});

	// Unlike spawn-agent, we run the code RAW — no subSceneBracket wrap. The
	// mastery recipes bracket scenes themselves (open SubScene, save, restore
	// parent with OpenSceneMode.Single), so wrapping again would double-manage
	// scene state and break the recipes' save/restore semantics.
	let result: string;
	let ok = true;
	try {
		result = execFileSync('unity-cli', ['exec', data.code], {
			encoding: 'utf8',
			timeout: 120000,
		}).trim();
	} catch (e: any) {
		ok = false;
		result = 'EXEC FAILED: ' + (e?.stderr?.toString?.() || e?.message || String(e));
	}

	return { track, request, explanation: data.explanation, code: data.code, ok, result };
}
