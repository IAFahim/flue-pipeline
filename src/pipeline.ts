import type { SkillReference } from '@flue/runtime';
import echo from './skills/echo/SKILL.md' with { type: 'skill' };

export const pipeline: readonly SkillReference[] = [echo];
