import { createAgent, type Skill } from '@flue/runtime';
import unityCli from './skills/unity-cli/SKILL.md' with { type: 'skill' };
import agentProtocol from './skills/unity-agent-protocol/SKILL.md' with { type: 'skill' };
import trackTask from './skills/track-task/SKILL.md' with { type: 'skill' };
import trackUndo from './skills/track-undo/SKILL.md' with { type: 'skill' };
import stageFoundations from './skills/unity-stage-foundations/SKILL.md' with { type: 'skill' };
import distanceToStat from './skills/unity-track-distance-to-stat/SKILL.md' with { type: 'skill' };
import entityLinkCopyTransform from './skills/unity-track-entitylink-copytransform/SKILL.md' with { type: 'skill' };
import entityLinkMutate from './skills/unity-track-entitylink-mutate/SKILL.md' with { type: 'skill' };
import entityLinkParent from './skills/unity-track-entitylink-parent/SKILL.md' with { type: 'skill' };
import entityLinkTargetPatch from './skills/unity-track-entitylink-targetpatch/SKILL.md' with { type: 'skill' };
import essenceEvent from './skills/unity-track-essence-event/SKILL.md' with { type: 'skill' };
import essenceIntrinsic from './skills/unity-track-essence-intrinsic/SKILL.md' with { type: 'skill' };
import essenceStat from './skills/unity-track-essence-stat/SKILL.md' with { type: 'skill' };
import physicsAngularPid from './skills/unity-track-physics-angular-pid/SKILL.md' with { type: 'skill' };
import physicsDrag from './skills/unity-track-physics-drag/SKILL.md' with { type: 'skill' };
import physicsFilterOverride from './skills/unity-track-physics-filter-override/SKILL.md' with { type: 'skill' };
import physicsForce from './skills/unity-track-physics-force/SKILL.md' with { type: 'skill' };
import physicsGravityOverride from './skills/unity-track-physics-gravity-override/SKILL.md' with { type: 'skill' };
import physicsKinematicOverride from './skills/unity-track-physics-kinematic-override/SKILL.md' with { type: 'skill' };
import physicsLinearPid from './skills/unity-track-physics-linear-pid/SKILL.md' with { type: 'skill' };
import subDirector from './skills/unity-track-subdirector/SKILL.md' with { type: 'skill' };
import timelineTimeScale from './skills/unity-track-timeline-timescale/SKILL.md' with { type: 'skill' };
import transformPosition from './skills/unity-track-transform-position/SKILL.md' with { type: 'skill' };
import transformRotation from './skills/unity-track-transform-rotation/SKILL.md' with { type: 'skill' };
import transformScale from './skills/unity-track-transform-scale/SKILL.md' with { type: 'skill' };
import worldTimeScale from './skills/unity-track-world-timescale/SKILL.md' with { type: 'skill' };

// One single-purpose expert per trained track mastery skill. Each carries the
// hardened unity-cli operating skill, the unity-agent-protocol behavioral
// contract, the track-task result contract, the track-undo pass-2 contract,
// and exactly one track mastery skill (its verified recipes + edge-case rules).
//
// track-undo MUST be declared here even though the workflow passes the skill
// reference to session.skill() directly: the runtime's `activate_skill` tool
// only accepts names from the agent's registered skill catalog (a literal
// union built at session start). The skill prompt opens with `Run the skill
// named "track-undo"` and the system prompt tells the model to activate
// matching skills first, so an undeclared track-undo makes that activation
// call fail ("[flue] Skill ... not registered") before the model recovers.
function trackExpert(topic: string, masterySkill: Skill) {
	return createAgent(() => ({
		model: 'minimax/MiniMax-M2.7',
		skills: [unityCli, agentProtocol, trackTask, trackUndo, masterySkill],
		instructions:
			`You are the ${topic} specialist. You behave per the unity-agent-protocol ` +
			'skill: discovery over assumption — the named objects, asset paths, and ids ' +
			'in your mastery skill are worked examples from the training environment and ' +
			'must be rediscovered in THIS project; capture pre-state (PRE| lines) before ' +
			'every mutation; never claim what you cannot evidence. You have NO unity-cli ' +
			'and NO Unity project in your own sandbox: never shell out to unity-cli and ' +
			'never give up because it is missing — you AUTHOR C# that the runtime ' +
			'executes in the live Editor, so all discovery happens inside that code. ' +
			'Apply the track-task skill to the given request using your track mastery ' +
			"skill's verified recipes, and return exactly the structured result the " +
			'track-task skill defines.',
	}));
}

// Registry: track name (== mastery skill name) → expert agent. The value type
// is the concrete instantiation of ReturnType<typeof createAgent> produced by
// trackExpert above.
const trackExperts: Record<string, ReturnType<typeof trackExpert>> = {
	'unity-stage-foundations': trackExpert('TrainingStage foundations', stageFoundations),
	'unity-track-distance-to-stat': trackExpert('DistanceToStatTrack', distanceToStat),
	'unity-track-entitylink-copytransform': trackExpert('EntityLinkCopyTransformTrack', entityLinkCopyTransform),
	'unity-track-entitylink-mutate': trackExpert('EntityLinkMutateTrack', entityLinkMutate),
	'unity-track-entitylink-parent': trackExpert('EntityLinkParentTrack', entityLinkParent),
	'unity-track-entitylink-targetpatch': trackExpert('EntityLinkTargetPatchTrack', entityLinkTargetPatch),
	'unity-track-essence-event': trackExpert('TimelineEssenceEventTrack', essenceEvent),
	'unity-track-essence-intrinsic': trackExpert('TimelineEssenceIntrinsicTrack', essenceIntrinsic),
	'unity-track-essence-stat': trackExpert('TimelineEssenceStatTrack', essenceStat),
	'unity-track-physics-angular-pid': trackExpert('PhysicsAngularPIDTrack', physicsAngularPid),
	'unity-track-physics-drag': trackExpert('PhysicsDragTrack', physicsDrag),
	'unity-track-physics-filter-override': trackExpert('PhysicsFilterOverrideTrack', physicsFilterOverride),
	'unity-track-physics-force': trackExpert('PhysicsForceTrack', physicsForce),
	'unity-track-physics-gravity-override': trackExpert('PhysicsGravityOverrideTrack', physicsGravityOverride),
	'unity-track-physics-kinematic-override': trackExpert('PhysicsKinematicOverrideTrack', physicsKinematicOverride),
	'unity-track-physics-linear-pid': trackExpert('PhysicsLinearPIDTrack', physicsLinearPid),
	'unity-track-subdirector': trackExpert('SubDirectorTrack', subDirector),
	'unity-track-timeline-timescale': trackExpert('TimelineTimeScaleTrack', timelineTimeScale),
	'unity-track-transform-position': trackExpert('TransformPositionTrack', transformPosition),
	'unity-track-transform-rotation': trackExpert('TransformRotationTrack', transformRotation),
	'unity-track-transform-scale': trackExpert('TransformScaleTrack', transformScale),
	'unity-track-world-timescale': trackExpert('WorldTimeScaleTrack', worldTimeScale),
};

// --- The Ultimate Boss -------------------------------------------------------
// The anti-specialist: ONE agent carrying EVERY mastery skill at once (all the
// DOTS Timeline track families + the stage foundations) on top of the shared
// operating/behavioral/result skills. A deliberate showcase of "what if one
// agent held everything" versus the disciplined one-skill specialists. It runs
// through the same track-task flow, so it still returns an evidenced memory
// card with a deterministic undo journal. Reached via track key "__boss__".
const allMastery: Skill[] = [
	stageFoundations, distanceToStat, entityLinkCopyTransform, entityLinkMutate,
	entityLinkParent, entityLinkTargetPatch, essenceEvent, essenceIntrinsic,
	essenceStat, physicsAngularPid, physicsDrag, physicsFilterOverride,
	physicsForce, physicsGravityOverride, physicsKinematicOverride,
	physicsLinearPid, subDirector, timelineTimeScale, transformPosition,
	transformRotation, transformScale, worldTimeScale,
];

const bossExpert = createAgent(() => ({
	model: 'minimax/MiniMax-M2.7',
	skills: [unityCli, agentProtocol, trackTask, trackUndo, ...allMastery],
	instructions:
		'You are the ULTIMATE BOSS — the anti-specialist. You carry EVERY ' +
		'mastery skill at once: all the DOTS Timeline track families plus the ' +
		'stage foundations. For the given request, decide which mastery skill(s) ' +
		'apply, activate them, and apply the track-task skill using their ' +
		'verified recipes — you MAY combine several skills in one job. You behave ' +
		'per unity-agent-protocol: discovery over assumption (the named objects, ' +
		'asset paths, and ids in each mastery skill are worked examples to ' +
		'rediscover in THIS project), capture PRE| pre-state before every ' +
		'mutation, never claim what you cannot evidence. You have NO unity-cli ' +
		'and NO Unity project in your own sandbox: never shell out to unity-cli ' +
		'and never give up because it is missing — you AUTHOR C# that the runtime ' +
		'executes in the live Editor. Return exactly the structured result the ' +
		'track-task skill defines.',
}));

trackExperts['__boss__'] = bossExpert;

export default trackExperts;
