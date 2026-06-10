import { createAgent } from '@flue/runtime';
import echo from '../skills/echo/SKILL.md' with { type: 'skill' };

export default createAgent(() => ({
	model: 'minimax/MiniMax-M2.7',
	skills: [echo],
	instructions:
		'Execute exactly the requested skill on the given input and return only the structured result that skill defines.',
}));
