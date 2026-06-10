import type { SkillReference } from '@flue/runtime';
import outline from './skills/outline/SKILL.md' with { type: 'skill' };
import draft from './skills/draft/SKILL.md' with { type: 'skill' };
import polish from './skills/polish/SKILL.md' with { type: 'skill' };

export const pipeline: readonly SkillReference[] = [outline, draft, polish];
