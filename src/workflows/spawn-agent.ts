import type { FlueContext } from '@flue/runtime';
import * as v from 'valibot';
import { execFileSync } from 'node:child_process';
import spawnExpert from '../agents/spawn-expert';
import spawn from '../skills/spawn/SKILL.md' with { type: 'skill' };

// Smart agent: turn a natural-language request (+ optional scene context) into
// C#, then actually run it in the live Editor via unity-cli and report back.
export async function run({ init, payload }: FlueContext) {
	const request = String((payload as any).request ?? '');
	const context = String((payload as any).context ?? '');

	const harness = await init(spawnExpert);
	const session = await harness.session();

	const { data } = await session.skill(spawn, {
		args: { request, context },
		result: v.object({ code: v.string(), explanation: v.string() }),
	});

	let result: string;
	let ok = true;
	try {
		result = execFileSync('unity-cli', ['exec', data.code], {
			encoding: 'utf8',
			timeout: 60000,
		}).trim();
	} catch (e: any) {
		ok = false;
		result = 'EXEC FAILED: ' + (e?.stderr?.toString?.() || e?.message || String(e));
	}

	return { request, explanation: data.explanation, code: data.code, ok, result };
}
