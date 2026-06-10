import { createAgent } from '@flue/runtime';
import { pipeline } from '../pipeline';

export default createAgent(() => ({
	model: 'minimax/MiniMax-M2.7',
	skills: [...pipeline],
	instructions:
		'Execute exactly the requested skill on the given input and return only the structured result that skill defines.',
}));
