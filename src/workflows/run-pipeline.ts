import type { FlueContext, FlueSession, SkillReference } from '@flue/runtime';
import * as v from 'valibot';
import pipelineRunner from '../agents/pipeline-runner';
import { pipeline } from '../pipeline';

const payloadSchema = v.object({ input: v.string() });

const stepOutputSchema = v.object({ output: v.string() });

type StepTrace = { readonly step: string; readonly output: string };

type PipelineState = {
	readonly current: string;
	readonly trace: readonly StepTrace[];
};

const applyStep =
	(session: FlueSession) =>
	async (state: PipelineState, skill: SkillReference): Promise<PipelineState> => {
		const { data } = await session.skill(skill, {
			args: { input: state.current },
			result: stepOutputSchema,
		});
		return {
			current: data.output,
			trace: [...state.trace, { step: skill.name, output: data.output }],
		};
	};

export async function run({ init, payload }: FlueContext) {
	const { input } = v.parse(payloadSchema, payload);
	const harness = await init(pipelineRunner);
	const session = await harness.session();

	const step = applyStep(session);
	const final = await pipeline.reduce(
		async (state, skill) => step(await state, skill),
		Promise.resolve<PipelineState>({ current: input, trace: [] }),
	);

	return { input, steps: final.trace, result: final.current };
}
