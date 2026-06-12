---
name: unity-track-entitylink-parent
description: Master of EntityLinkParentTrack + clip in vex-ee — stick-and-release reparenting via links, the restore-restores-the-pointer-never-the-pose truth, and the enter/exit state machine. Use when a designer asks "stick this to that linked thing for a while, then let go".
---

# EntityLinkParentTrack specialist

You are the specialist for **`EntityLinkParentTrack`** and
**`EntityLinkParentClip`** from the EntityLinks package at
`Packages/BovineLabs.Timeline.EntityLinks/`, namespace
`BovineLabs.Timeline.EntityLinks.Authoring`. Scope: exactly this track family —
reparenting a Targets-resolved entity under a link-resolved entity at clip
start, and (optionally) restoring the parent pointer at clip end. This is the
**ONLY EntityLinks track with revert semantics**; its enter/exit state machine
is your domain.

**Family fundamentals live in `unity-track-entitylink-copytransform`** — the
verified `Target` enum (None=0, Target=1, Owner=2, Source=3, Self=4, Custom=6;
no 5), the three-step `EntityLinkResolver` chain (Target-enum hop → root hop
via `EntityLinkSource.Root` → linear `EntityLinkEntry` buffer search with
silent key-0/missing guards), and the loud-bake/silent-runtime rule. Load that
skill alongside this one; do not re-derive those facts. Mutate semantics
(same-frame in-place buffer edits) live in `unity-track-entitylink-mutate`.

All facts below were verified live in the **vex-ee** project, **2026-06**
(reflection dumps, package-source quotes via `File.ReadAllText` inside
`unity-cli exec`, raw YAML reads, fresh-load read-backs, a real forced bake
for the error demo). No play mode: runtime claims are source-derived.

## THE HEADLINE — restore restores the POINTER, never the POSE

`restoreOnEnd=true` puts back the **Parent component**, not the placement.
Nothing ever snapshots the original LocalTransform — `EntityLinkParentState`
stores only `{Target, PreviousParent, HadParent, ParentApplied}`, no pose.
Adjudicated from `TransformUtility.SetupParent` read line by line: its
`childLocalTransform` parameter is consumed ONLY as a one-shot **LocalToWorld
seed** (`LocalToWorld = parentLtw × childLocal.ToMatrix()`); **SetupParent
never writes the child's `LocalTransform` component.**

- **Branch 1 — mover HAD a previous parent (alive, with LocalToWorld):**
  ExitJob re-runs `SetupParent(PreviousParent, target, parentLtw,
  LocalTransform.Identity, childs)`. The Identity argument only seeds a
  LocalToWorld that `TransformSystemGroup` recomputes before anything renders
  (the parent-origin snap never renders). The mover keeps its CURRENT
  LocalTransform — normally the clip's authored local pose — and swaps frames:
  **at clip end the object teleports to the PREVIOUS parent's frame at the
  clip's local offset** (world-pose jump = delta between the link parent's and
  previous parent's world transforms).
- **Branch 2 — mover had NO previous parent (or it died / lost LocalToWorld):**
  ExitJob just `RemoveComponent<Parent>` + `RemoveComponent<PreviousParent>`;
  LocalTransform untouched. A parentless entity's LocalTransform IS its world
  transform — **the clip's local pose is promoted to absolute world
  coordinates** (clip A's (0,2,0)/yaw45 drops the cube at world (0,2,0) yaw 45,
  wherever the capsule was).

**Designer rule of thumb:** if you need the object back where it started, pair
the Parent clip with a transform-track clip that re-establishes the pose, or
parent it back under something whose frame × clip offset equals the desired
spot.

## Prerequisites & environment

- Act only through `unity-cli exec` / `unity-cli console`; never touch vex-ee
  via the filesystem; never enter play mode. Follow the **unity-cli skill's
  Safe Loop** (inspect → mutate once → save → verify → restore → console
  check) on every mutation.
- Verify the live project first:
  `unity-cli exec "return UnityEditor.SceneManagement.EditorSceneManager.GetActiveScene().path + \"|\" + Application.dataPath;"`
  → expect `Assets/Scenes/Main Scene.unity|/home/i/GitHub/vex-ee/Assets`.
- The `TrainingStage` (unity-stage-foundations) must exist in SubScene
  `Assets/Scenes/Main Sub Scene.unity`: **Stage_Actor** carries
  `TargetsAuthoring` (Target=Stage_Target) AND `EntityLinkSource`
  (Root=Stage_LinkRoot, Schemas=[Schema_Actor]); **Stage_LinkRoot** bakes the
  `EntityLinkEntry` buffer `{Key=10, Target=Stage_Actor}`.
- **NEVER create new schema assets** — reuse the known 10 (inventory in
  `unity-track-entitylink-mutate`; Schema_Actor id=10
  guid=3b375c42affc2917f956d01310d31894).
- Your assets live only under `Assets/Training/09-entitylink-parent-track/`.
  Canonical asset: `ParentMastery.playable` — track `ParentTrack`, clips
  A_StickToActor (0–3s, restoreOnEnd=true), B_StickForever (4–6s,
  restoreOnEnd=false), both localPos=(0,2,0) localRot=(0,45,0).

## VERIFIED facts (vex-ee, 2026-06)

| Type | FullName | Assembly | Base |
|---|---|---|---|
| Track | `BovineLabs.Timeline.EntityLinks.Authoring.EntityLinkParentTrack` | BovineLabs.Timeline.EntityLinks.Authoring | `DOTSTrack`, sealed |
| Clip | `BovineLabs.Timeline.EntityLinks.Authoring.EntityLinkParentClip` | BovineLabs.Timeline.EntityLinks.Authoring | `DOTSClip`, sealed |
| System | `BovineLabs.Timeline.EntityLinks.EntityLinkParentSystem` | BovineLabs.Timeline.EntityLinks | ISystem struct |
| Data | `BovineLabs.Timeline.EntityLinks.Data.EntityLinkParentData` / `EntityLinkParentState` | BovineLabs.Timeline.EntityLinks.Data | IComponentData |
| Utility | `BovineLabs.Core.Utility.TransformUtility.SetupParent` | **BovineLabs.Core** (PackageCache `com.bovinelabs.core@064940b6a197`, NOT the EntityLinks package) | static |

Track attributes (reflection-dumped): `[TrackClipType(typeof(EntityLinkParentClip))]`,
`[TrackColor(0.8,0.2,0.8)]`, `[TrackBindingType(typeof(TargetsAuthoring))]`
(`BovineLabs.Reaction.Authoring.Core.TargetsAuthoring`),
`[DisplayName("BovineLabs/Entity Links/Parent")]`. No Bake override on the track.

### Clip fields (fresh-instance defaults, reflection)

| Field | Type | Default | Meaning |
|---|---|---|---|
| `entityToParent` | `Target` | `Target(1)` | WHO gets reparented — resolved through the binding's `Targets` |
| `readRootFrom` | `Target` | **`Owner(2)`** | Where the link-map hunt starts — **TRAP on this stage** (Owner unset → silent never-resolve); use `Self(4)` |
| `parentLink` | `EntityLinkSchema` | null | The ushort key; null → LOUD bake LogError, component skipped |
| `localPosition` | `Vector3` | (0,0,0) | Local pose under the NEW parent |
| `localRotation` | `Vector3` | (0,0,0) | Euler degrees; bake converts `quaternion.Euler(math.radians(localRotation))` — YAML keeps the Euler verbatim |
| `restoreOnEnd` | bool | **true** | Exit behavior — the EntityLinks family's ONLY revert switch |

`duration => 1` (seed only, freely resizable), `clipCaps => ClipCaps.None`
(hard edges, no blend/ease). **Default-trap note for the family:**
CopyTransform AND Parent default `readRootFrom = Owner(2)`, Mutate defaults
`Source(3)` — all unset on Stage_Actor's Targets; always set `Self(4)` when
the bound entity itself carries the `EntityLinkSource`.

Bake: `parentLink=null` →
`Debug.LogError($"{nameof(EntityLinkParentClip)} '{name}' missing parent link.")`
and return (component never added). Otherwise `EntityLinkParentBuilder.ApplyTo`
adds `EntityLinkParentData { EntityToParent, ReadRootFrom, ParentLinkKey,
LocalPosition, LocalRotation(quaternion), RestoreOnEnd }` **plus** the mutable
`EntityLinkParentState { Entity Target; Entity PreviousParent; bool HadParent;
bool ParentApplied; }` on the clip entity.

## Runtime semantics (`EntityLinkParentSystem`, source-quoted)

System: `[UpdateInGroup(typeof(TimelineComponentAnimationGroup))]` →
`TimelineSystemGroup` → `BeforeTransformSystemGroup` (variable rate, after the
frame's fixed step already ran). `EntityLinkMutateSystem` is
`[UpdateBefore(EntityLinkParentSystem)]`. Both jobs write through the
**EndFixedStepSimulation ECB** — and unlike CopyTransform, the ECB IS
correctly assigned to both jobs (the unassigned-ECB package bug is
CopyTransform-only).

**EnterJob** (activation edge, `[WithAll(ClipActive)]
[WithDisabled(ClipActivePrevious)]`, fires once like Mutate): silent-skip
ladder (null binding → no Targets → entityToParent Null → readRootFrom Null →
key absent), then snapshots `state.Target`, `state.HadParent =
ParentLookup.TryGetComponent(...)`, `state.PreviousParent`; if the resolved
parent is non-Null AND has LocalToWorld, calls
`TransformUtility.SetupParent(resolvedParent, entityToParent, parentLtw,
childTransform, childs)` and sets `ParentApplied=true`; then
**unconditionally** Set-or-ADDs the mover's `LocalTransform` to
`LocalTransform.FromPositionRotation(LocalPosition, LocalRotation)` —
**Scale = 1** (a mover with non-1 uniform scale loses it at clip entry).

`SetupParent` (verbatim behavior): adds/sets `Parent` AND `PreviousParent`
**both to the new parent** (hand-rolled bookkeeping that hides the change from
Unity ParentSystem's `Parent != PreviousParent` reconciliation), seeds
`LocalToWorld = parentLtw × childLocal.ToMatrix()`, appends the child to the
parent's `Child` buffer (creating it if absent). Never writes the child's
`LocalTransform`.

**ExitJob** (deactivation edge, `[WithAll(ClipActivePrevious)]
[WithDisabled(ClipActive)]`):

```csharp
if (!config.RestoreOnEnd || state.Target == Entity.Null || !state.ParentApplied)
    return;
```

then branch 1 / branch 2 of THE HEADLINE (previous parent alive-with-LtW →
SetupParent back; else remove Parent + PreviousParent, LocalTransform
untouched).

## Canonical recipes (verbatim from the report)

**Stick-and-release** ("carry the flag for 3 seconds"): track
`BovineLabs/Entity Links/Parent` → bind the TargetsAuthoring whose slots
describe the cast → clip with `entityToParent` = the slot holding the carried
object, `readRootFrom=Self` (when the bound entity carries the
EntityLinkSource), `parentLink` = the schema of the carrier,
`localPosition/localRotation` = the carry pose, `restoreOnEnd=true`. Entry and
exit are hard edges (ClipCaps.None), each one fixed-step-latent. Remember:
release restores the PARENT, not the POSE.

**Stick-forever** ("attach the trailer"): same clip with `restoreOnEnd=false`.
The ExitJob guard `if (!config.RestoreOnEnd || ...) return;` makes clip end,
timeline end, scrub-out and timeline stop all no-ops — `Parent`,
`PreviousParent` and the `Child`-buffer entry persist permanently, exactly
like Mutate's buffer edits (the EntityLinks family's ONLY revert mechanism is
this one flag, and switching it off opts into Mutate-style permanence). Undo
requires a second Parent clip (whose own enter captures the CURRENT parent —
the link parent — as PreviousParent) or external code.

**Stage resolution walkthrough (clip A):** binding = Stage_Actor's Targets →
`entityToParent=Target` → Stage_Target (the cube moves); `readRootFrom=Self` →
Stage_Actor → `EntityLinkSource.Root = Stage_LinkRoot` → buffer
`{Key=10, Target=Stage_Actor}` → resolved parent = Stage_Actor (the capsule).
For 3 seconds the cube rides at local (0,2,0) yaw 45 above the capsule, then
detaches (branch 2: Stage_Target is authored under plain-Transform
TrainingStage, so its baked entity most likely has no Parent — baked
hierarchy not play-verified).

## Edge cases & traps (each proven live or source-quoted, 2026-06)

- **DON'T expect the pose back — restore restores the pointer** — adjudicated
  both branches in THE HEADLINE: previous-parent frame × clip offset
  (branch 1), or clip local pose promoted to world (branch 2); nothing
  snapshots the original LocalTransform.
- **DO rely on the ParentApplied=false exit no-op** — guard quoted above: a
  clip whose link never resolved (or whose parent lacked LocalToWorld) ends
  without ANY exit action — no spurious unparenting of whatever parent the
  object legitimately has.
- **DO expect parentLink=null to be LOUD** — demonstrated with a real forced
  bake: `EntityLinkParentClip 'C_TempNullLink' missing parent link.`
  (worker log first, console later as `[Worker2] ...`); component never added.
- **DON'T assume same-frame visibility — EndFixedStepSimulation ECB is one
  fixed-step phase latent** — commands recorded in frame N play back at the
  end of the NEXT fixed-step tick (later at high frame rates); contrast
  Mutate's zero-latency in-place writes, which run UpdateBefore this system —
  a same-frame Mutate retargets the link BEFORE EnterJob resolves it, but a
  same-frame CopyTransform clip CANNOT see Parent's reparent until ECB
  playback (its first active frame computes against the OLD parent state).
- **DO trust restoreOnEnd=true on stop/scrub — mid-clip timeline stop still
  fires ExitJob** — full chain quoted: `TimerUpdateSystem.TimerStoppedJob`
  disables ClipActive on linked clip entities →
  `ClipLocalTimeSystem.ResetOnTimelineDeactivatedJob` resets ClipActive →
  `ClipActivePrevious` (mirrored OrderLast, a frame behind) still true →
  ExitJob's edge query matches.
- **DON'T forget restoreOnEnd=false persists forever** — the guard makes every
  exit path a no-op; parenting outlives the clip AND the timeline,
  Mutate-style.
- **DON'T trust a clean console after a half-resolved clip — the
  resolved-but-unparentable teleport** — EnterJob's `LocalTransform` write
  sits OUTSIDE the reparent guard: link key resolves but Target is
  `Entity.Null` (e.g. parked by a Mutate SwapKey=0) or the parent has no
  LocalToWorld → no reparent, `ParentApplied=false`, but the pose is STILL
  overwritten — the object jumps in its CURRENT frame and (per the exit
  no-op) never comes back, silently.
- **DO watch Child-buffer hygiene (source-derived risk, NOT play-verified)** —
  nothing ever removes the child from its old parent's `Child` buffer, and
  `PreviousParent = Parent` hides changes from Unity ParentSystem's
  reconciliation (branch-2 exit removes both together, so the
  PreviousParent-without-Parent cleanup can't match either): a literal reading
  says a full cycle on a previously parented mover leaves a stale entry in the
  link parent's buffer and a duplicate in the original's — flagged as a
  package-hygiene anomaly to confirm in play mode, same caliber as
  CopyTransform's unassigned ECB.
- **DO know the LocalTransform ADD path** — movers baked WITHOUT
  LocalTransform (`TransformUsageFlags.None` bakes: pure-data/marker objects)
  get the component ADDED by EnterJob; after a branch-2 restore it remains as
  a world pose. Dormant on this stage (Stage_Target is renderable).
- **DO produce ALL `.sceneWithBuildSettings` artifacts in the bake-capture
  recipe (refinement to lesson 08's recipe)** — `Assets/SceneDependencyCache`
  held TWO entries; producing only the first returned a CACHED artifact, no
  bake ran, and the worker logs stayed silent — produce every entry (or match
  the GUID seen in Editor.log) before concluding the recipe failed.

## Verification protocol

1. **Fresh-load asset dump**: `AssetDatabase.LoadAssetAtPath` the .playable in
   a NEW exec block; dump track + clips. Expected canonical state:
   `A_StickToActor 0–3 restoreOnEnd=True`, `B_StickForever 4–6
   restoreOnEnd=False` — both entityToParent=Target(1), readRootFrom=Self(4),
   parentLink=Schema_Actor(id=10), localPos=(0,2,0), localRot=(0,45,0).
   In-memory state after a save is not evidence.
2. **Raw YAML check**: `entityToParent: 1`, `readRootFrom: 4`,
   `parentLink: {fileID: 11400000, guid: 3b375c42affc2917f956d01310d31894,
   type: 2}`, Euler verbatim (`localRotation: {x: 0, y: 45, z: 0}`),
   `restoreOnEnd: 1` / `0` per clip.
3. **Schema check**: read Schema_Actor's YAML fresh; `id:` must be 10
   (non-zero).
4. **Binding check from a RELOADED SubScene**:
   `ParentTrack(EntityLinkParentTrack) -> Stage_Actor (TargetsAuthoring)` —
   the component, not the Transform. Post-lesson-09 the table is 7 entries,
   all → Stage_Actor; keyed by track asset, grows additively, survives
   playableAsset swaps.
5. **Parent-scene restore**: end with sceneCount=1,
   `Assets/Scenes/Main Scene.unity|loaded=True|active=True|dirty=False`,
   director restored to
   `Assets/Training/01-transform-position-track/PositionMastery.playable`.
6. **Console**: `unity-cli console --filter error` must show nothing new
   except any DELIBERATE "missing parent link" demo (remove the temp clip and
   confirm a clean rebake afterwards); known pre-existing vex-ee entries are
   UnityCliConnector HTTP server start, PerformanceTesting
   IPrebuildSetup/IPostBuildCleanup, TestResults.xml save, and lesson 08's old
   `[Worker2] EntityLinkMutateClip 'E_TempNullLink' missing link schema.`.
