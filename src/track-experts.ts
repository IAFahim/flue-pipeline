import { createAgent, type Skill } from '@flue/runtime';
import { DEFAULT_MODEL } from './keys';
import unityCli from './skills/unity-cli/SKILL.md' with { type: 'skill' };
import agentProtocol from './skills/unity-agent-protocol/SKILL.md' with { type: 'skill' };
import playerInput from './skills/unity-player-input/SKILL.md' with { type: 'skill' };
import trackTask from './skills/track-task/SKILL.md' with { type: 'skill' };
import trackUndo from './skills/track-undo/SKILL.md' with { type: 'skill' };
import chat from './skills/chat/SKILL.md' with { type: 'skill' };
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
import timelineTrackAuthoring from './skills/unity-timeline-track-authoring/SKILL.md' with { type: 'skill' };
import trackAnimation from './skills/unity-track-animation/SKILL.md' with { type: 'skill' };
import trackPlayerInputs from './skills/unity-track-player-inputs/SKILL.md' with { type: 'skill' };
import trackUi from './skills/unity-track-ui/SKILL.md' with { type: 'skill' };
import trackGridInfluence from './skills/unity-track-grid-influence/SKILL.md' with { type: 'skill' };
import trackParenting from './skills/unity-track-parenting/SKILL.md' with { type: 'skill' };
import trackStatefulTrigger from './skills/unity-track-stateful-trigger/SKILL.md' with { type: 'skill' };
// Knowledge skills (no track of their own) — importable so the chat agent can carry any the user ALLOWS in the
// Editor's Manage Skills window. Skill bodies load only on activation, so listing them costs ~nothing until used.
import combos from './skills/unity-combos/SKILL.md' with { type: 'skill' };
import designerVocabulary from './skills/unity-designer-vocabulary/SKILL.md' with { type: 'skill' };
import essenceActions from './skills/unity-essence-actions/SKILL.md' with { type: 'skill' };
import gameplayConfig from './skills/unity-gameplay-config/SKILL.md' with { type: 'skill' };
import mechanicCookbook from './skills/unity-mechanic-cookbook/SKILL.md' with { type: 'skill' };
import mechanicDiagrams from './skills/unity-mechanic-diagrams/SKILL.md' with { type: 'skill' };
import objectDefinitions from './skills/unity-object-definitions/SKILL.md' with { type: 'skill' };
import reactions from './skills/unity-reactions/SKILL.md' with { type: 'skill' };
import statsIntrinsics from './skills/unity-stats-intrinsics/SKILL.md' with { type: 'skill' };
import targets from './skills/unity-targets/SKILL.md' with { type: 'skill' };
import traPayloads from './skills/unity-tra-payloads/SKILL.md' with { type: 'skill' };

// The default model every expert runs on. Any request may override it (the
// track-task workflow threads `payload.model` through to expertFor), so the
// Editor / unity-cli side can drive ANY provider/model the runtime supports
// (e.g. minimax/…, anthropic/…, openai/…) just by setting the provider key in
// .env and passing the `provider/model` string — the model layer lives here.
// DEFAULT_MODEL now lives in keys.ts (the single source of truth for models/keys); re-exported for back-compat.
export { DEFAULT_MODEL };

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
function trackExpert(topic: string, masterySkill: Skill, model: string = DEFAULT_MODEL) {
	// Every specialist also carries unity-stage-foundations: almost no track can
	// do anything useful without the timeline stage (director, actor, target,
	// physics ball, …) existing first, so the specialist must be able to AUDIT
	// and BUILD the missing stage itself rather than stopping on the missing
	// prerequisite. The stage expert's own mastery skill IS that skill, so
	// dedupe to avoid listing it twice.
	// Every track expert ALSO carries unity-timeline-track-authoring: the de-bloated
	// mastery skills cite it for all the shared ceremony (SubScene bracket, discovery,
	// undo, verification), and the runtime can only ACTIVATE a skill that is in the
	// agent's registered catalog — so it must be declared here, not just referenced.
	const skills =
		masterySkill === stageFoundations
			? [unityCli, agentProtocol, playerInput, trackTask, trackUndo, stageFoundations, timelineTrackAuthoring]
			: [unityCli, agentProtocol, playerInput, trackTask, trackUndo, stageFoundations, timelineTrackAuthoring, masterySkill];
	return createAgent(() => ({
		model,
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
			'not set up yet. You ALSO carry the unity-player-input skill: when a result is ' +
			'input-triggered, you can AUTHOR C# that joins a player and drives a button/stick ' +
			'to prove the chain fires, then verify the EFFECT (not merely that input fired). ' +
			'Then apply the track-task skill to the request using your ' +
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
	'unity-track-animation': trackExpert('Animation tracks (Rukhanka / BlendTree2D / AfterImage)', trackAnimation),
	'unity-track-player-inputs': trackExpert('PlayerInputs tracks (CommandSequence / InputEvents)', trackPlayerInputs),
	'unity-track-ui': trackExpert('UI tracks (UxmlView / TextReveal / DataDisplay)', trackUi),
	'unity-track-grid-influence': trackExpert('Grid Influence tracks', trackGridInfluence),
	'unity-track-parenting': trackExpert('Parenting (TemporaryDetach) track', trackParenting),
	'unity-track-stateful-trigger': trackExpert('StatefulTriggerTrack + PhysicsTriggerInstantiateClip (trigger-spawn)', trackStatefulTrigger),
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
	'unity-track-animation': trackAnimation,
	'unity-track-player-inputs': trackPlayerInputs,
	'unity-track-ui': trackUi,
	'unity-track-grid-influence': trackGridInfluence,
	'unity-track-parenting': trackParenting,
	'unity-track-stateful-trigger': trackStatefulTrigger,
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
	'Editor. You also carry the unity-player-input skill: to prove an input-triggered ' +
	'mechanic works, author C# that joins a player and drives the relevant button/stick, ' +
	'then verify the effect. Return exactly the structured result the track-task skill defines.';

// Build a boss carrying the shared skills plus the named mastery subset
// (deduped, unknown names ignored). An empty/absent list falls back to ALL
// mastery skills — the original full boss.
export function buildBoss(masteryNames: string[] = [], model: string = DEFAULT_MODEL) {
	const chosen = [...new Set(masteryNames)]
		.map((n) => masteryByName[n])
		.filter((s): s is Skill => Boolean(s));
	const mastery = chosen.length ? chosen : allMastery;
	return createAgent(() => ({
		model,
		skills: [unityCli, agentProtocol, playerInput, trackTask, trackUndo, timelineTrackAuthoring, ...mastery],
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
function buildD1(model: string = DEFAULT_MODEL) {
	return createAgent(() => ({
	model,
	skills: [unityCli, agentProtocol, playerInput, trackTask, trackUndo, stageFoundations, augmentArchitecture],
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
		'do not improvise. You also carry the unity-player-input skill: after composing an ' +
		'input-triggered augment, author C# that joins a player and drives the triggering ' +
		'button/stick to prove the whole chain fires end-to-end, then verify the effect. ' +
		'Return exactly the structured result the track-task skill ' +
		'defines, with an undo journal that reverses every change.',
	}));
}

trackExperts['__d1__'] = buildD1();

// Resolve the expert for a request, honoring an optional per-request model
// override (any provider/model the runtime supports). With no override the
// caller should use the prebuilt registry; this rebuilds the expert on the
// chosen model. Returns undefined for an unknown specific track.
// A general conversational agent for the in-Editor chat surface (the Unity Assistant window on the vex flue
// backend). Unlike the track specialists, it ANSWERS questions directly and only authors C# (via unity-cli) when
// asked — it never "gives up" on a plain question. Carries the operating + behavioural skills plus the chat skill.
// Every skill resolvable by its Manage-Skills name (== SKILL.md `name` == folder). The Editor passes the user's
// ALLOWED skill names; buildChatAgent resolves them through this map (unknown names — Unity-native skills, etc. —
// are silently ignored). Spreads in all the per-track masteries on top of the operating + knowledge skills.
export const skillByName: Record<string, Skill> = {
	'unity-cli': unityCli,
	'unity-agent-protocol': agentProtocol,
	'unity-player-input': playerInput,
	'unity-timeline-track-authoring': timelineTrackAuthoring,
	'unity-stage-foundations': stageFoundations,
	'unity-augment-architecture': augmentArchitecture,
	'unity-combos': combos,
	'unity-designer-vocabulary': designerVocabulary,
	'unity-essence-actions': essenceActions,
	'unity-gameplay-config': gameplayConfig,
	'unity-mechanic-cookbook': mechanicCookbook,
	'unity-mechanic-diagrams': mechanicDiagrams,
	'unity-object-definitions': objectDefinitions,
	'unity-reactions': reactions,
	'unity-stats-intrinsics': statsIntrinsics,
	'unity-targets': targets,
	'unity-tra-payloads': traPayloads,
	...masteryByName,
};

// `extraSkillNames` are the skills the user ALLOWED in the Editor's Manage Skills window (threaded through as
// payload.skills). They are added — deduped — on top of the always-on base, so opting a skill in there makes the
// chat agent actually carry it. Unknown names are ignored.
export function buildChatAgent(model: string = DEFAULT_MODEL, extraSkillNames: string[] = []) {
	const extras = [...new Set(extraSkillNames)]
		.map((n) => skillByName[n])
		.filter((s): s is Skill => Boolean(s));
	return createAgent(() => ({
		model,
		// Beyond the operating + chat skills, the chat agent carries two KNOWLEDGE skills so it is actually competent
		// about THIS project, not just a generic Unity bot: unity-stage-foundations (the DOTS Timeline stage — how the
		// director/actor/target/physics-body live inside a SubScene, and how to query them, which is exactly why naive
		// answers like "how many directors → 0" happen without it) and unity-augment-architecture (the whole-mechanic
		// composition model: Input→Event→Reaction→Action→ObjectDefinition→TRA→EntityLink→Essence). Skill bodies load
		// only on activation, so they cost ~nothing until a question needs them. Any user-allowed skills (extras) are
		// appended; the Set below dedupes against the base by object identity (same imported Skill reference).
		skills: [...new Set([unityCli, agentProtocol, stageFoundations, augmentArchitecture, chat, ...extras])],
		instructions:
			'You are Vex, a helpful Unity assistant chatting with a developer inside the Unity Editor. ' +
			'Answer their questions and requests conversationally and concisely. You can author and run C# via ' +
			'unity-cli when they ask you to inspect or change the project, following the unity-agent-protocol ' +
			'(discover before assuming; never claim what you did not verify). You also carry two knowledge skills for ' +
			'THIS project — activate them when relevant: unity-stage-foundations (the DOTS Timeline stage lives inside ' +
			'a SubScene, so to count/inspect directors, actors, targets or physics bodies you must query the SubScene ' +
			'entities, not just the open scene) and unity-augment-architecture (how Input→Event→Reaction→Action→' +
			'ObjectDefinition→TRA→EntityLink→Essence compose). For DEEP single-track authoring (building/verifying a ' +
			'specific timeline track with full undo), tell the developer it is best run via `assistant_run` with the ' +
			'matching track specialist, then help as far as you safely can. You may ALSO carry additional skills the ' +
			'developer enabled in the Editor (your full registered catalog is the source of truth — activate any whose ' +
			'description fits the request). Apply the chat skill and return exactly the ' +
			'structured result it defines. Never give up on a plain question.',
	}));
}

export function expertFor(track: string, model?: string, masteryNames: string[] = []) {
	const m = (model && model.trim()) || DEFAULT_MODEL;
	if (track === '__boss__') return buildBoss(masteryNames, m);
	if (track === '__d1__') return buildD1(m);
	const skill = masteryByName[track];
	if (!skill) return undefined;
	return trackExpert(track, skill, m);
}

export default trackExperts;
