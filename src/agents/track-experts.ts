import { createAgent, type Skill } from '@flue/runtime';
import unityCli from '../skills/unity-cli/SKILL.md' with { type: 'skill' };
import trackTask from '../skills/track-task/SKILL.md' with { type: 'skill' };
import stageFoundations from '../skills/unity-stage-foundations/SKILL.md' with { type: 'skill' };
import distanceToStat from '../skills/unity-track-distance-to-stat/SKILL.md' with { type: 'skill' };
import entityLinkCopyTransform from '../skills/unity-track-entitylink-copytransform/SKILL.md' with { type: 'skill' };
import entityLinkMutate from '../skills/unity-track-entitylink-mutate/SKILL.md' with { type: 'skill' };
import entityLinkParent from '../skills/unity-track-entitylink-parent/SKILL.md' with { type: 'skill' };
import entityLinkTargetPatch from '../skills/unity-track-entitylink-targetpatch/SKILL.md' with { type: 'skill' };
import essenceEvent from '../skills/unity-track-essence-event/SKILL.md' with { type: 'skill' };
import essenceIntrinsic from '../skills/unity-track-essence-intrinsic/SKILL.md' with { type: 'skill' };
import essenceStat from '../skills/unity-track-essence-stat/SKILL.md' with { type: 'skill' };
import physicsAngularPid from '../skills/unity-track-physics-angular-pid/SKILL.md' with { type: 'skill' };
import physicsDrag from '../skills/unity-track-physics-drag/SKILL.md' with { type: 'skill' };
import physicsFilterOverride from '../skills/unity-track-physics-filter-override/SKILL.md' with { type: 'skill' };
import physicsForce from '../skills/unity-track-physics-force/SKILL.md' with { type: 'skill' };
import physicsGravityOverride from '../skills/unity-track-physics-gravity-override/SKILL.md' with { type: 'skill' };
import physicsKinematicOverride from '../skills/unity-track-physics-kinematic-override/SKILL.md' with { type: 'skill' };
import physicsLinearPid from '../skills/unity-track-physics-linear-pid/SKILL.md' with { type: 'skill' };
import subDirector from '../skills/unity-track-subdirector/SKILL.md' with { type: 'skill' };
import timelineTimeScale from '../skills/unity-track-timeline-timescale/SKILL.md' with { type: 'skill' };
import transformPosition from '../skills/unity-track-transform-position/SKILL.md' with { type: 'skill' };
import transformRotation from '../skills/unity-track-transform-rotation/SKILL.md' with { type: 'skill' };
import transformScale from '../skills/unity-track-transform-scale/SKILL.md' with { type: 'skill' };
import worldTimeScale from '../skills/unity-track-world-timescale/SKILL.md' with { type: 'skill' };

// One single-purpose expert per trained track mastery skill. Each carries the
// hardened unity-cli operating skill, the track-task result contract, and
// exactly one track mastery skill (its verified recipes + edge-case rules).
function trackExpert(topic: string, masterySkill: Skill) {
	return createAgent(() => ({
		model: 'minimax/MiniMax-M2.7',
		skills: [unityCli, trackTask, masterySkill],
		instructions:
			`You are the ${topic} specialist. Apply the track-task skill to the given ` +
			"request using your track mastery skill's verified recipes. Return only the " +
			'structured { code, explanation } result.',
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

export default trackExperts;
