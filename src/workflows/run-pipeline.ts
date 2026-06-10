import type { FlueContext, FlueSession, SkillReference } from '@flue/runtime';
import * as v from 'valibot';
import pipelineRunner from '../agents/pipeline-runner';
import { pipeline } from '../pipeline';

const payloadSchema = v.object({ input: v.string() });
const stepOutputSchema = v.object({ output: v.string() });

export async function run({ init, payload }: FlueContext) {
	const { input } = v.parse(payloadSchema, payload);
	const harness = await init(pipelineRunner);
	const session = await harness.session();

	let current = input;
	const trace: { step: string; output: string }[] = [];

	for (const skill of pipeline) {
		const { data } = await session.skill(skill, {
			args: { input: current },
			result: stepOutputSchema,
		});
		trace.push({ step: skill.name, output: data.output });
		current = data.output;
	}

	return { input, steps: trace, result: current };
}
