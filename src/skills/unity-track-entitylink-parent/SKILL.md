---
name: unity-track-entitylink-parent
description: Master of EntityLinkParentTrack + EntityLinkParentClip (EntityLinks package, BovineLabs.Timeline.EntityLinks) — stick-and-release reparenting via links, the restore-restores-the-pointer-never-the-pose truth, and the enter/exit state machine. Portable to any project containing the package; worked example from vex-ee.
---

# EntityLinkParentTrack specialist

## 1. SCOPE

You are the specialist for **`EntityLinkParentTrack`** and **`EntityLinkParentClip`** from the
EntityLinks package (`BovineLabs.Timeline.EntityLinks`, namespace
`BovineLabs.Timeline.EntityLinks.Authoring`). Scope: exactly this track family — reparenting a
Targets-resolved entity under a link-resolved entity at clip start, and (optionally) restoring
the parent pointer at clip end. This is the **ONLY EntityLinks track with revert semantics**;
its enter/exit state machine is your domain.

**Family fundamentals live in `unity-track-entitylink-copytransform`** (the verified `Target`
enum: None=0, Target=1, Owner=2, Source=3, Self=4, Custom=6, no 5; the three-step
`EntityLinkResolver` chain; the loud-bake/silent-runtime rule) — load that skill alongside this
one; do not re-derive. Mutate semantics + the bake-error capture recipe live in
`unity-track-entitylink-mutate`. Stage construction belongs to `unity-stage-foundations`.

**Operate per `unity-timeline-track-authoring`; behave per `unity-agent-protocol`; use the
editor per `unity-cli`.** That shared skill owns the discovery preamble (its §1), the SubScene
create-and-wire bracket (its §2), the undo-appendix structure (its §3), and the fresh-load
verification protocol (its §4). This skill keeps ONLY the track-unique facts below.

## 2. PORTABLE SEMANTICS

True in ANY project containing the EntityLinks package. Provenance tags say where a fact was
PROVEN, not where it applies. (All verified vex-ee 2026-06 via reflection dumps, package-source
quotes through `File.ReadAllText` inside `unity-cli exec`, raw YAML reads, fresh-load
read-backs, a real forced bake for the error demo. No play mode: runtime claims are
source-derived.)

### THE HEADLINE — restore restores the POINTER, never the POSE

`restoreOnEnd=true` puts back the **Parent component**, not the placement. Nothing ever
snapshots the original LocalTransform — `EntityLinkParentState` stores only `{Target,
PreviousParent, HadParent, ParentApplied}`, no pose. Adjudicated from
`TransformUtility.SetupParent` read line by line: its `childLocalTransform` parameter is
consumed ONLY as a one-shot **LocalToWorld seed** (`LocalToWorld = parentLtw ×
childLocal.ToMatrix()`); **SetupParent never writes the child's `LocalTransform` component.**

- **Branch 1 — mover HAD a previous parent (alive, with LocalToWorld):** ExitJob re-runs
  `SetupParent(PreviousParent, target, parentLtw, LocalTransform.Identity, childs)`. The
  Identity argument only seeds a LocalToWorld that `TransformSystemGroup` recomputes before
  anything renders (the parent-origin snap never renders). The mover keeps its CURRENT
  LocalTransform — normally the clip's authored local pose — and swaps frames: **at clip end
  the object teleports to the PREVIOUS parent's frame at the clip's local offset** (world-pose
  jump = delta between the link parent's and previous parent's world transforms).
- **Branch 2 — mover had NO previous parent (or it died / lost LocalToWorld):** ExitJob just
  `RemoveComponent<Parent>` + `RemoveComponent<PreviousParent>`; LocalTransform untouched. A
  parentless entity's LocalTransform IS its world transform — **the clip's local pose is
  promoted to absolute world coordinates** (a (0,2,0)/yaw45 clip drops the mover at world
  (0,2,0) yaw 45, wherever the link parent was).

**Designer rule of thumb:** if you need the object back where it started, pair the Parent clip
with a transform-track clip that re-establishes the pose, or parent it back under something
whose frame × clip offset equals the desired spot.

### Verified type facts

| Type | FullName | Assembly | Base |
|---|---|---|---|
| Track | `BovineLabs.Timeline.EntityLinks.Authoring.EntityLinkParentTrack` | BovineLabs.Timeline.EntityLinks.Authoring | `DOTSTrack`, sealed |
| Clip | `BovineLabs.Timeline.EntityLinks.Authoring.EntityLinkParentClip` | BovineLabs.Timeline.EntityLinks.Authoring | `DOTSClip`, sealed |
| System | `BovineLabs.Timeline.EntityLinks.EntityLinkParentSystem` | BovineLabs.Timeline.EntityLinks | ISystem struct |
| Data | `BovineLabs.Timeline.EntityLinks.Data.EntityLinkParentData` / `EntityLinkParentState` | BovineLabs.Timeline.EntityLinks.Data | IComponentData |
| Utility | `BovineLabs.Core.Utility.TransformUtility.SetupParent` | **BovineLabs.Core** (PackageCache, NOT the EntityLinks package) | static |

Track attributes (reflection-dumped): `[TrackClipType(typeof(EntityLinkParentClip))]`,
`[TrackColor(0.8,0.2,0.8)]`, **`[TrackBindingType(typeof(TargetsAuthoring))]`** — the bind
target is the `BovineLabs.Reaction.Authoring.Core.TargetsAuthoring` COMPONENT, never the
Transform — `[DisplayName("BovineLabs/Entity Links/Parent")]`. No Bake override.

### Clip fields (fresh-instance defaults, reflection)

| Field | Type | Default | Meaning |
|---|---|---|---|
| `entityToParent` | `Target` | `Target(1)` | WHO gets reparented — resolved through the binding's `Targets` |
| `readRootFrom` | `Target` | **`Owner(2)`** | Where the link-map hunt starts — TRAP on any binding with an unset Owner slot (silent never-resolve); derive from the cast layout, typically `Self(4)` |
| `parentLink` | `EntityLinkSchema` | null | The ushort key; null → LOUD bake LogError, component skipped |
| `localPosition` | `Vector3` | (0,0,0) | Local pose under the NEW parent |
| `localRotation` | `Vector3` | (0,0,0) | Euler degrees; bake converts `quaternion.Euler(math.radians(localRotation))` — YAML keeps the Euler verbatim |
| `restoreOnEnd` | bool | **true** | Exit behavior — the EntityLinks family's ONLY revert switch |

`duration => 1` (seed only, freely resizable), `clipCaps => ClipCaps.None` (hard edges, no
blend/ease). **Default-trap note for the family:** CopyTransform AND Parent default
`readRootFrom = Owner(2)`, Mutate defaults `Source(3)` — all silent never-resolves on a binding
whose slots are unset.

Bake: `parentLink=null` → `Debug.LogError($"{nameof(EntityLinkParentClip)} '{name}' missing
parent link.")` and return (component never added). Otherwise `EntityLinkParentBuilder.ApplyTo`
adds `EntityLinkParentData { EntityToParent, ReadRootFrom, ParentLinkKey, LocalPosition,
LocalRotation(quaternion), RestoreOnEnd }` **plus** the mutable `EntityLinkParentState { Entity
Target; Entity PreviousParent; bool HadParent; bool ParentApplied; }` on the clip entity.

### Runtime semantics (`EntityLinkParentSystem`, source-quoted)

System: `[UpdateInGroup(typeof(TimelineComponentAnimationGroup))]` → `TimelineSystemGroup` →
`BeforeTransformSystemGroup` (variable rate, after the frame's fixed step already ran).
`EntityLinkMutateSystem` is `[UpdateBefore(EntityLinkParentSystem)]`. Both jobs write through
the **EndFixedStepSimulation ECB** — and unlike CopyTransform, the ECB IS correctly assigned to
both jobs (the unassigned-ECB package bug is CopyTransform-only).

**EnterJob** (activation edge, `[WithAll(ClipActive)] [WithDisabled(ClipActivePrevious)]`,
fires once like Mutate): silent-skip ladder (null binding → no Targets → entityToParent Null →
readRootFrom Null → key absent), then snapshots `state.Target`, `state.HadParent`,
`state.PreviousParent`; if the resolved parent is non-Null AND has LocalToWorld, calls
`TransformUtility.SetupParent(resolvedParent, entityToParent, parentLtw, childTransform,
childs)` and sets `ParentApplied=true`; then **unconditionally** Set-or-ADDs the mover's
`LocalTransform` to `LocalTransform.FromPositionRotation(LocalPosition, LocalRotation)` —
**Scale = 1** (a mover with non-1 uniform scale loses it at clip entry).

`SetupParent` (verbatim behavior): adds/sets `Parent` AND `PreviousParent` **both to the new
parent** (hand-rolled bookkeeping that hides the change from Unity ParentSystem's `Parent !=
PreviousParent` reconciliation), seeds `LocalToWorld = parentLtw × childLocal.ToMatrix()`,
appends the child to the parent's `Child` buffer (creating it if absent). Never writes the
child's `LocalTransform`.

**ExitJob** (deactivation edge, `[WithAll(ClipActivePrevious)] [WithDisabled(ClipActive)]`):
`if (!config.RestoreOnEnd || state.Target == Entity.Null || !state.ParentApplied) return;` —
then branch 1 / branch 2 of THE HEADLINE (previous parent alive-with-LtW → SetupParent back;
else remove Parent + PreviousParent, LocalTransform untouched).

### Traps & DO/DON'T (each proven live or source-quoted, vex-ee 2026-06)

- **DON'T expect the pose back — restore restores the pointer** — both branches adjudicated in
  THE HEADLINE; nothing snapshots the original LocalTransform.
- **DO rely on the ParentApplied=false exit no-op** — guard quoted above: a clip whose link
  never resolved (or whose parent lacked LocalToWorld) ends without ANY exit action — no
  spurious unparenting of whatever parent the object legitimately has.
- **DO expect parentLink=null to be LOUD** — demonstrated with a real forced bake:
  `EntityLinkParentClip '<name>' missing parent link.` (worker log first, console later as
  `[WorkerN] ...`); component never added.
- **DON'T assume same-frame visibility — EndFixedStepSimulation ECB is one fixed-step phase
  latent** — commands recorded in frame N play back at the end of the NEXT fixed-step tick
  (later at high frame rates); contrast Mutate's zero-latency in-place writes, which run
  UpdateBefore this system — a same-frame Mutate retargets the link BEFORE EnterJob resolves
  it, but a same-frame CopyTransform clip CANNOT see Parent's reparent until ECB playback (its
  first active frame computes against the OLD parent state).
- **DO trust restoreOnEnd=true on stop/scrub — mid-clip timeline stop still fires ExitJob** —
  full chain quoted: `TimerUpdateSystem.TimerStoppedJob` disables ClipActive on linked clip
  entities → `ClipLocalTimeSystem.ResetOnTimelineDeactivatedJob` resets ClipActive →
  `ClipActivePrevious` (mirrored OrderLast, a frame behind) still true → ExitJob's edge query
  matches.
- **DON'T forget restoreOnEnd=false persists forever** — the guard makes every exit path a
  no-op; parenting outlives the clip AND the timeline, Mutate-style (this one flag is the
  family's entire revert mechanism). Undo requires a second Parent clip (whose own enter
  captures the CURRENT parent — the link parent — as PreviousParent) or external code.
- **DON'T trust a clean console after a half-resolved clip — the resolved-but-unparentable
  teleport** — EnterJob's `LocalTransform` write sits OUTSIDE the reparent guard: link key
  resolves but the entry's Target is `Entity.Null` (e.g. parked by a Mutate SwapKey=0) or the
  parent has no LocalToWorld → no reparent, `ParentApplied=false`, but the pose is STILL
  overwritten — the object jumps in its CURRENT frame and (per the exit no-op) never comes
  back, silently.
- **DO watch Child-buffer hygiene (source-derived risk, NOT play-verified)** — nothing ever
  removes the child from its old parent's `Child` buffer, and `PreviousParent = Parent` hides
  changes from Unity ParentSystem's reconciliation (branch-2 exit removes both together, so the
  PreviousParent-without-Parent cleanup can't match either): a literal reading says a full
  cycle on a previously parented mover leaves a stale entry in the link parent's buffer and a
  duplicate in the original's — package-hygiene anomaly, same caliber as CopyTransform's
  unassigned ECB.
- **DO know the LocalTransform ADD path** — movers baked WITHOUT LocalTransform
  (`TransformUsageFlags.None` bakes: pure-data/marker objects) get the component ADDED by
  EnterJob; after a branch-2 restore it remains as a world pose.
- **DO produce ALL `.sceneWithBuildSettings` artifacts in the bake-capture recipe** (recipe in
  `unity-track-entitylink-mutate` §3.6) — the dependency cache can hold several entries;
  producing only the first returns a CACHED artifact, no bake runs, worker logs stay silent.

## 3. DISCOVERY — per `unity-timeline-track-authoring` §1

Run D1–D5 there with these track parameters: type/assembly
`BovineLabs.Timeline.EntityLinks.Authoring.EntityLinkParentTrack, BovineLabs.Timeline.EntityLinks.Authoring`;
bind target `TargetsAuthoring` (D4 — print each holder's path AND slot values; note which slot
holds the mover (`entityToParent`) and whether the mover's GameObject has a transform parent —
that decides which HEADLINE branch a restore takes). Track-specific extras for D4:
- **Link wiring:** find `EntityLinkSourceAuthoring` / `EntityLinkRootAuthoring` holders; print
  Roots, Schemas, root key sets. Derive `readRootFrom` from the layout (`Self` when the bound
  object itself carries the source — the default `Owner` is the trap).
- **Schemas by TYPE with live id dump:** `AssetDatabase.FindAssets("t:EntityLinkSchema")` →
  path/guid/imported id (id==0 ⇒ unusable). **NEVER create schema assets** — out of domain; a
  missing schema is a missing prerequisite (protocol §6).

## 4. CANONICAL RECIPES — the track-specific middle for the §2 bracket

Build per `unity-timeline-track-authoring` §2 (the SubScene bracket, `CreateTrack`,
`SaveAssets`, `SetGenericBinding(track, <TargetsAuthoring component>)`, `SaveScene`, restore
parent in `finally`). Substitute this middle:

```csharp
var track = timeline.CreateTrack<BovineLabs.Timeline.EntityLinks.Authoring.EntityLinkParentTrack>(null, trackName);
var schema = UnityEditor.AssetDatabase.LoadAssetAtPath<BovineLabs.Timeline.EntityLinks.Authoring.EntityLinkSchema>("<DISCOVERED schemaPath>");

// Pattern STICK-AND-RELEASE ("carry the flag for 3 seconds"):
var clipA = track.CreateClip<BovineLabs.Timeline.EntityLinks.Authoring.EntityLinkParentClip>();
clipA.start = 0; clipA.duration = 3; clipA.displayName = "<clipName>";
var a = (BovineLabs.Timeline.EntityLinks.Authoring.EntityLinkParentClip)clipA.asset;
a.entityToParent = BovineLabs.Reaction.Data.Core.Target.Target;  // <CHOSEN> slot holding the carried object
a.readRootFrom = BovineLabs.Reaction.Data.Core.Target.Self;      // <DERIVED §3> — default Owner is a trap
a.parentLink = schema;                                            // the carrier's schema
a.localPosition = new UnityEngine.Vector3(0f, 2f, 0f);            // <CHOSEN> carry pose (Scale forced to 1!)
a.localRotation = new UnityEngine.Vector3(0f, 45f, 0f);           // <CHOSEN> Euler; YAML keeps it verbatim
a.restoreOnEnd = true;   // release restores the PARENT, not the POSE (§2 HEADLINE)

// Pattern STICK-FOREVER ("attach the trailer"): same clip with restoreOnEnd = false.
// Clip end, timeline end, scrub-out and stop are all no-ops; Parent/PreviousParent and
// the Child-buffer entry persist permanently, Mutate-style.
```

Entry and exit are hard edges (ClipCaps.None), each one fixed-step-latent. If direct field
assignment fails to compile in the exec sandbox, set every field via `SerializedObject` using
the YAML field names (`entityToParent`, `readRootFrom`, `parentLink`, `localPosition`,
`localRotation`, `restoreOnEnd`).

**Undo note for `unity-timeline-track-authoring` §3:** this track has a RUNTIME effect that
persists within a play session (reparenting through the EndFixedStepSimulation ECB), but it
never writes back to authoring data. The package's only in-session revert is `restoreOnEnd` —
and per THE HEADLINE that restores the parent POINTER, never the POSE; `restoreOnEnd=false` has
no package-side revert at all. The agent journal reverses AUTHORING artifacts only, which fully
reverses everything that persists in the authoring workflow. Schemas are never created or
modified — nothing to undo there.

## 5. VERIFICATION DELTA — per `unity-timeline-track-authoring` §4

Run that protocol with these track-specific fields in steps 1–2: dump/check
`entityToParent`, `readRootFrom`, `parentLink` (asset + imported id), `localPosition`,
`localRotation`, `restoreOnEnd`. Raw-YAML expectations: `parentLink:` is
`{fileID: 11400000, guid: …, type: 2}` (never `{fileID: 0}` unless deliberately demoing); enum
bytes match intent (e.g. `entityToParent: 1`, `readRootFrom: 4`); Euler verbatim
(`localRotation: {x: 0, y: 45, z: 0}`); `restoreOnEnd: 1`/`0` per clip. Extra step: the
referenced schema's fresh YAML `id:` must be non-zero. The binding (step 4) is
`BINDING|<trackName>|bound=<bindTarget> (TargetsAuthoring)` — the COMPONENT, not the Transform.
Console (step 6): clean except any DELIBERATE "missing parent link" demo — then remove the temp
clip and prove the clean rebake (changed artifact hash, all `.sceneWithBuildSettings` artifacts
produced).

## 6. WORKED-EXAMPLE DELTA vs the shared stage (`unity-timeline-track-authoring` §5)

Asset `Assets/Training/09-entitylink-parent-track/ParentMastery.playable` — track `ParentTrack`;
clips `A_StickToActor 0–3 restoreOnEnd=True`, `B_StickForever 4–6 restoreOnEnd=False` — both
`entityToParent=Target(1)`, `readRootFrom=Self(4)`, `parentLink=Schema_Actor`, localPos=(0,2,0),
localRot=(0,45,0). YAML: `entityToParent: 1`, `readRootFrom: 4`, Euler verbatim,
`restoreOnEnd: 1` / `0`. Schema used: `Assets/Training/00-foundations/Schema_Actor.asset`,
id=10, guid `3b375c42affc2917f956d01310d31894` (binds via `Stage_Actor`'s EntityLinkSource
Root=`Stage_LinkRoot`, which bakes `{Key=10, Target=Stage_Actor}`); `TransformUtility` lives in
PackageCache `com.bovinelabs.core@064940b6a197`. Resolution walkthrough (clip A): binding =
Stage_Actor's Targets → `entityToParent=Target` → Stage_Target (the cube moves);
`readRootFrom=Self` → Stage_Actor → key 10 → resolved parent = Stage_Actor (the capsule) —
branch 2 expected at release (Stage_Target authored under plain-Transform TrainingStage, baked
hierarchy not play-verified). Director restored after the lesson to
`Assets/Training/01-transform-position-track/PositionMastery.playable`; binding table left at 7
permanent additive entries.
