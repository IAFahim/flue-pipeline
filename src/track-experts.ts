import { createAgent, type Skill } from '@flue/runtime';
import unityCli from './skills/unity-cli/SKILL.md' with { type: 'skill' };
import agentProtocol from './skills/unity-agent-protocol/SKILL.md' with { type: 'skill' };
import trackTask from './skills/track-task/SKILL.md' with { type: 'skill' };
import trackUndo from './skills/track-undo/SKILL.md' with { type: 'skill' };
import stageFoundations from './skills/unity-stage-foundations/SKILL.md' with { type: 'skill' };
import augmentArchitecture from './skills/unity-augment-architecture/SKILL.md' with { type: 'skill' };
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
// the unity-stage-foundations skill (so it can build the stage its track
// depends on), and its one track mastery skill (verified recipes + edge cases).
//
// track-undo MUST be declared here even though the workflow passes the skill
// reference to session.skill() directly: the runtime's `activate_skill` tool
// only accepts names from the agent's registered skill catalog (a literal
// union built at session start). The skill prompt opens with `Run the skill
// named "track-undo"` and the system prompt tells the model to activate
// matching skills first, so an undeclared track-undo makes that activation
// call fail ("[flue] Skill ... not registered") before the model recovers.
function trackExpert(topic: string, masterySkill: Skill) {
	// Every specialist also carries unity-stage-foundations: almost no track can
	// do anything useful without the timeline stage (director, actor, target,
	// physics ball, …) existing first, so the specialist must be able to AUDIT
	// and BUILD the missing stage itself rather than stopping on the missing
	// prerequisite. The stage expert's own mastery skill IS that skill, so
	// dedupe to avoid listing it twice.
	const skills =
		masterySkill === stageFoundations
			? [unityCli, agentProtocol, trackTask, trackUndo, stageFoundations]
			: [unityCli, agentProtocol, trackTask, trackUndo, stageFoundations, masterySkill];
	return createAgent(() => ({
		model: 'minimax/MiniMax-M2.7',
		skills,
		instructions:
			`You are the ${topic} specialist. You behave per the unity-agent-protocol ` +
			'skill: discovery over assumption — the named objects, asset paths, and ids ' +
			'in your mastery skill are worked examples from the training environment and ' +
			'must be rediscovered in THIS project; capture pre-state (PRE| lines) before ' +
			'every mutation; never claim what you cannot evidence. You have NO unity-cli ' +
			'and NO Unity project in your own sandbox: never shell out to unity-cli and ' +
			'never give up because it is missing — you AUTHOR C# that the runtime ' +
			'executes in the live Editor, so all discovery happens inside that code. ' +
			'You ALSO carry the unity-stage-foundations skill: before your track work, ' +
			'audit the timeline stage and, when the director/actor/target/physics body ' +
			'your request needs is missing, BUILD it with that skill first (recording its ' +
			'undo just like any other mutation) — do not stop merely because the stage is ' +
			'not set up yet. Then apply the track-task skill to the request using your ' +
			"track mastery skill's verified recipes, and return exactly the structured " +
			'result the track-task skill defines.',
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
// name (== mastery skill name) -> skill, so a custom boss can be composed from
// a chosen SUBSET of skills picked in the notebook. The notebook shows the
// token cost of each and lets the designer trim the boss before sending.
export const masteryByName: Record<string, Skill> = {
	'unity-stage-foundations': stageFoundations,
	'unity-track-distance-to-stat': distanceToStat,
	'unity-track-entitylink-copytransform': entityLinkCopyTransform,
	'unity-track-entitylink-mutate': entityLinkMutate,
	'unity-track-entitylink-parent': entityLinkParent,
	'unity-track-entitylink-targetpatch': entityLinkTargetPatch,
	'unity-track-essence-event': essenceEvent,
	'unity-track-essence-intrinsic': essenceIntrinsic,
	'unity-track-essence-stat': essenceStat,
	'unity-track-physics-angular-pid': physicsAngularPid,
	'unity-track-physics-drag': physicsDrag,
	'unity-track-physics-filter-override': physicsFilterOverride,
	'unity-track-physics-force': physicsForce,
	'unity-track-physics-gravity-override': physicsGravityOverride,
	'unity-track-physics-kinematic-override': physicsKinematicOverride,
	'unity-track-physics-linear-pid': physicsLinearPid,
	'unity-track-subdirector': subDirector,
	'unity-track-timeline-timescale': timelineTimeScale,
	'unity-track-transform-position': transformPosition,
	'unity-track-transform-rotation': transformRotation,
	'unity-track-transform-scale': transformScale,
	'unity-track-world-timescale': worldTimeScale,
};

const allMastery: Skill[] = Object.values(masteryByName);

const BOSS_INSTRUCTIONS =
	'You are the ULTIMATE BOSS — the anti-specialist. You carry a set of ' +
	'mastery skills (DOTS Timeline track families and/or the stage ' +
	'foundations). For the given request, decide which of the skills you carry ' +
	'apply, activate them, and apply the track-task skill using their verified ' +
	'recipes — you MAY combine several skills in one job. If the request needs a ' +
	'skill you do NOT carry, say so honestly and stop rather than improvising it. ' +
	'You behave per unity-agent-protocol: discovery over assumption (the named ' +
	'objects, asset paths, and ids in each mastery skill are worked examples to ' +
	'rediscover in THIS project), capture PRE| pre-state before every mutation, ' +
	'never claim what you cannot evidence. You have NO unity-cli and NO Unity ' +
	'project in your own sandbox: never shell out to unity-cli and never give up ' +
	'because it is missing — you AUTHOR C# that the runtime executes in the live ' +
	'Editor. Return exactly the structured result the track-task skill defines.';

// Build a boss carrying the shared skills plus the named mastery subset
// (deduped, unknown names ignored). An empty/absent list falls back to ALL
// mastery skills — the original full boss.
export function buildBoss(masteryNames: string[] = []) {
	const chosen = [...new Set(masteryNames)]
		.map((n) => masteryByName[n])
		.filter((s): s is Skill => Boolean(s));
	const mastery = chosen.length ? chosen : allMastery;
	return createAgent(() => ({
		model: 'minimax/MiniMax-M2.7',
		skills: [unityCli, agentProtocol, trackTask, trackUndo, ...mastery],
		instructions: BOSS_INSTRUCTIONS,
	}));
}

// The full boss (every mastery skill) is the default registry entry, reached
// via track key "__boss__"; the workflow swaps in a composed subset when the
// payload carries a `skills` list.
trackExperts['__boss__'] = buildBoss();

// --- D1 — The Designer -------------------------------------------------------
// The whole-mechanic generalist. Unlike the boss (which holds the 22 per-track
// timeline masteries), D1 carries the COMPOSITION skill 'unity-augment-architecture'
// — how Input → Event → Reaction → Action → ObjectDefinition → TRA → EntityLink →
// Essence tie together — on top of the stage foundations and the shared
// operating/behaviour/result skills. It authors the full reaction/spawn/payload
// chain a designer describes (e.g. a wiki augment), with evidence + undo. Reached
// via track key "__d1__". As the Tier-1 authoring skills (unity-reaction-core,
// unity-object-definition, unity-essence-actions, unity-tra-payload,
// unity-lifecycle-init) are trained, add them to this skills list.
const d1Expert = createAgent(() => ({
	model: 'minimax/MiniMax-M2.7',
	skills: [unityCli, agentProtocol, trackTask, trackUndo, stageFoundations, augmentArchitecture],
	instructions:
		'You are D1 — the Designer: a whole-mechanic generalist, not a single-track ' +
		'specialist. A designer describes a complete gameplay augment in plain terms; ' +
		'you compose it. You behave per unity-agent-protocol: discovery over assumption ' +
		'(the object/asset/event names in the architecture skill are worked examples to ' +
		'rediscover in THIS project), capture PRE| pre-state before every mutation, ' +
		'never claim what you cannot evidence. You have NO unity-cli and NO Unity project ' +
		'in your own sandbox: never shell out to unity-cli and never give up because it ' +
		'is missing — you AUTHOR C# that the runtime executes in the live Editor. Use the ' +
		"unity-augment-architecture skill's five-layer model (Input→Event, Reaction, " +
		'Action, ObjectDefinition→prefab, EntityLink/Essence) to decompose the request, ' +
		'pick the canonical chain(s), and build the reactions, object definitions, ' +
		'prefabs, TRA payloads, links and lifecycle/cleanup — reusing what exists before ' +
		'creating. Use unity-stage-foundations when a prerequisite stage object is ' +
		'missing. If the mechanic needs a Timeline clip you cannot author safely, or a ' +
		'prerequisite (Essence/input event/stage) is missing, say so honestly and stop — ' +
		'do not improvise. Return exactly the structured result the track-task skill ' +
		'defines, with an undo journal that reverses every change.',
}));

trackExperts['__d1__'] = d1Expert;

export default trackExperts;
