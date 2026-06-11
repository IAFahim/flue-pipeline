import type { FlueContext } from '@flue/runtime';
import * as v from 'valibot';
import pipelineRunner from '../agents/pipeline-runner';
import unityCli from '../skills/unity-cli/SKILL.md' with { type: 'skill' };

export async function run({ init, payload }: FlueContext) {
	const input = String((payload as any).input);
	const harness = await init(pipelineRunner);
	const session = await harness.session();

	const { data } = await session.skill(unityCli, {
		args: { input },
		result: v.object({ output: v.string() }),
	});

	return { input, result: data.output };
}
