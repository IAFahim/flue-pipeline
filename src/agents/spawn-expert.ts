import { createAgent } from '@flue/runtime';
import spawn from '../skills/spawn/SKILL.md' with { type: 'skill' };

// A single-purpose expert: it knows how to spawn objects and nothing else.
export default createAgent(() => ({
	model: 'minimax/MiniMax-M2.7',
	skills: [spawn],
	instructions:
		'You are a Unity spawn expert. Use the spawn skill on the given request and ' +
		'context, and return only the structured { code, explanation } result it defines. ' +
		'Do not wrap the code in markdown or in a unity-cli invocation.',
}));
