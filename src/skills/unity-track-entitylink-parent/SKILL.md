---
name: unity-track-entitylink-parent
description: Master of EntityLinkParentTrack + EntityLinkParentClip (EntityLinks package, BovineLabs.Timeline.EntityLinks) — stick-and-release reparenting via links, the restore-restores-the-pointer-never-the-pose truth, and the enter/exit state machine. Portable to any project containing the package; worked example from vex-ee. Use when a designer asks "stick this to that linked thing for a while, then let go".
---

# EntityLinkParentTrack specialist

## 1. SCOPE

You are the specialist for **`EntityLinkParentTrack`** and **`EntityLinkParentClip`** from the
EntityLinks package (`BovineLabs.Timeline.EntityLinks`, namespace
`BovineLabs.Timeline.EntityLinks.Authoring`). Scope: exactly this track family — reparenting a
Targets-resolved entity under a link-resolved entity at clip start, and (optionally) restoring
the parent pointer at clip end. This is the **ONLY EntityLinks track with revert semantics**;
its enter/exit state machine is your domain. **Family fundamentals live in
`unity-track-entitylink-copytransform`** (the verified `Target` enum: None=0, Target=1, Owner=2,
Source=3, Self=4, Custom=6, no 5; the three-step `EntityLinkResolver` chain; the
loud-bake/silent-runtime rule) — load that skill alongside this one; do not re-derive. Mutate
semantics live in `unity-track-entitylink-mutate` (also the bake-error capture recipe). Stage
construction belongs to `unity-stage-foundations`. Behave per unity-agent-protocol; operate the
editor per unity-cli.

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
`[TrackColor(0.8,0.2,0.8)]`, `[TrackBindingType(typeof(TargetsAuthoring))]`
(`BovineLabs.Reaction.Authoring.Core.TargetsAuthoring`), `[DisplayName("BovineLabs/Entity
Links/Parent")]`. No Bake override.

### Clip fields (fresh-instance defaults, reflection)

| Field | Type | Default | Meaning |
|---|---|---|---|
| `entityToParent` | `Target` | `Target(1)` | WHO gets reparented — resolved through the binding's `Targets` |
| `readRootFrom` | `Target` | **`Owner(2)`** | Where the link-map hunt starts — TRAP on any binding with an unset Owner slot (silent never-resolve); derive from §3.4, typically `Self(4)` |
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

## 3. DISCOVERY RECIPES

Act only through `unity-cli exec` / `unity-cli console`; never the filesystem; never play mode;
unity-cli Safe Loop on every mutation. Names below are parameters — discover them in THIS
project; never assume the worked example (§5).

**3.1 Confirm the package exists (else report a missing prerequisite — protocol §6):**
```csharp
var t = System.Type.GetType("BovineLabs.Timeline.EntityLinks.Authoring.EntityLinkParentTrack, BovineLabs.Timeline.EntityLinks.Authoring");
return t == null
    ? "MISSING_PREREQUISITE|EntityLinkParentTrack not found - the EntityLinks package is absent in this project"
    : "OK|" + t.AssemblyQualifiedName + "|dataPath=" + UnityEngine.Application.dataPath;
```

**3.2 Find the active scene + SubScene(s):** unity-cli First Command; record `parentScenePath`
and candidate `subScenePath`(s).

**3.3 Find PlayableDirector(s) inside the SubScene** (read-only additive open, restore parent
after) via `FindObjectsByType<PlayableDirector>(Include, None)`; print hierarchy path,
`scene.path`, `playableAsset`, sibling components. STATE your selection rule; zero directors →
protocol §6.

**3.4 Discover the cast, link wiring and schemas** (read-only, same bracket):
- Binding candidates: `FindObjectsByType<TargetsAuthoring>` — print each holder's path AND slot
  values; the track binds the **TargetsAuthoring COMPONENT**, never the Transform. Note which
  slot holds the mover (`entityToParent`) and whether the mover's GameObject has a transform
  parent (decides which HEADLINE branch a restore will take).
- Link wiring: find `EntityLinkSourceAuthoring` / `EntityLinkRootAuthoring` holders; print
  Roots, Schemas, root key sets. Derive `readRootFrom` from the layout (`Self` when the bound
  object itself carries the source).
- Schemas by TYPE with live id dump: `AssetDatabase.FindAssets("t:EntityLinkSchema")` →
  path/guid/imported id (id==0 ⇒ unusable). **NEVER create schema assets** — out of domain
  (a missing prerequisite); report a missing schema as a missing prerequisite.

**3.5 Capture the chosen director's existing state — this is pre-state (`PRE|`)**:
```csharp
// PRE|playableAsset=<asset PATH or null>
// PRE|binding|<i>|<track name>|<track type>|<bound object hierarchy path + component type, or null>
//   one line per GetOutputTracks() of the CURRENT asset. Capture the asset PATH and each track's
//   NAME/index even when the table looks empty — they make the undo journal replayable (UNDO-1
//   reloads the old asset by path, re-binds by name/index). Binding tables are keyed by track
//   asset and SURVIVE playableAsset swaps — capture the WHOLE table.
```
Record these in the undo journal (§6) before any mutation.

**Name resolution rule**: `GameObject.Find` misses inactive objects and is ambiguous on
duplicate names. Confirm the chosen name is active and unique in the SubScene; otherwise walk
the SubScene roots to the recorded hierarchy path (or `FindObjectsByType` filtered by `scene`)
instead of `Find`.

## 4. CANONICAL RECIPES

One logical change per exec block; print `PRE|` captures before mutating, save inside the
block, verify from a fresh load (§7). Same SubScene-bracket skeleton as the CopyTransform skill
§4.1 (PRE| folder/asset/director captures, `SaveAssets`, `SetGenericBinding(track,
<TargetsAuthoring component>)`, `SaveScene`, restore parent in `finally`). Clip patterns:

```csharp
var track = timeline.CreateTrack<BovineLabs.Timeline.EntityLinks.Authoring.EntityLinkParentTrack>(null, trackName);
var schema = UnityEditor.AssetDatabase.LoadAssetAtPath<BovineLabs.Timeline.EntityLinks.Authoring.EntityLinkSchema>("<DISCOVERED schemaPath>");

// Pattern STICK-AND-RELEASE ("carry the flag for 3 seconds"):
var clipA = track.CreateClip<BovineLabs.Timeline.EntityLinks.Authoring.EntityLinkParentClip>();
clipA.start = 0; clipA.duration = 3; clipA.displayName = "<clipName>";
var a = (BovineLabs.Timeline.EntityLinks.Authoring.EntityLinkParentClip)clipA.asset;
a.entityToParent = BovineLabs.Reaction.Data.Core.Target.Target;  // <CHOSEN> slot holding the carried object
a.readRootFrom = BovineLabs.Reaction.Data.Core.Target.Self;      // <DERIVED §3.4> — default Owner is a trap
a.parentLink = schema;                                            // the carrier's schema
a.localPosition = new UnityEngine.Vector3(0f, 2f, 0f);            // <CHOSEN> carry pose (Scale forced to 1!)
a.localRotation = new UnityEngine.Vector3(0f, 45f, 0f);           // <CHOSEN> Euler; YAML keeps it verbatim
a.restoreOnEnd = true;   // release restores the PARENT, not the POSE (§2 HEADLINE)

// Pattern STICK-FOREVER ("attach the trailer"): same clip with restoreOnEnd = false.
// Clip end, timeline end, scrub-out and stop are all no-ops; Parent/PreviousParent and
// the Child-buffer entry persist permanently, Mutate-style.
```

Entry and exit are hard edges (ClipCaps.None), each one fixed-step-latent. `EXPECTED:` the
training report preserved field VALUES and YAML, not the authoring exec code — if direct field
assignment fails to compile, set via `SerializedObject` using the YAML field names in §7.

## 5. WORKED EXAMPLE (vex-ee training stage) — example environment; rediscover, never assume

- Project `/home/i/GitHub/vex-ee`; parent scene `Assets/Scenes/Main Scene.unity`; SubScene
  `Assets/Scenes/Main Sub Scene.unity`; package under `Packages/`; `TransformUtility` in
  PackageCache `com.bovinelabs.core@064940b6a197`. Stage: `Stage_Director` (the only director);
  `Stage_Actor` (TargetsAuthoring Target=Stage_Target, Owner/Source/Custom unset;
  EntityLinkSource Root=Stage_LinkRoot, Schemas=[Schema_Actor]); `Stage_LinkRoot` bakes
  `{Key=10, Target=Stage_Actor}`. Schema_Actor:
  `Assets/Training/00-foundations/Schema_Actor.asset`, id=10,
  guid `3b375c42affc2917f956d01310d31894`.
- Asset built: `Assets/Training/09-entitylink-parent-track/ParentMastery.playable` — track
  `ParentTrack`; clips `A_StickToActor 0–3 restoreOnEnd=True`, `B_StickForever 4–6
  restoreOnEnd=False` — both entityToParent=Target(1), readRootFrom=Self(4),
  parentLink=Schema_Actor(id=10), localPos=(0,2,0), localRot=(0,45,0). YAML:
  `entityToParent: 1`, `readRootFrom: 4`, Euler verbatim, `restoreOnEnd: 1` / `0`.
- Resolution walkthrough (clip A): binding=Stage_Actor's Targets → `entityToParent=Target` →
  Stage_Target (the cube moves); `readRootFrom=Self` → Stage_Actor → Root=Stage_LinkRoot →
  buffer key 10 → resolved parent = Stage_Actor (the capsule). For 3 seconds the cube rides at
  local (0,2,0) yaw 45 above the capsule, then detaches — branch 2 expected (Stage_Target is
  authored under plain-Transform TrainingStage, so its baked entity most likely has no Parent;
  baked hierarchy not play-verified).
- Demo run in training: temp clip `C_TempNullLink` → forced bake → `[Worker2]
  EntityLinkParentClip 'C_TempNullLink' missing parent link.` (`EntityLinkParentClip.cs:34`);
  clip removed, clean rebake proven by a new artifact hash (`745e615e…`). Recipe refinement
  found here: `Assets/SceneDependencyCache` held TWO `.sceneWithBuildSettings` entries —
  producing only the first returned a cached artifact and no bake ran.
- Wiring after the lesson: director RESTORED to
  `Assets/Training/01-transform-position-track/PositionMastery.playable`; binding table 7
  entries, all → Stage_Actor (Position/Scale/Rotation Transform, TimeScale StatAuthoring,
  CopyTransform/Mutate/ParentTrack TargetsAuthoring — left as permanent additive stage state).
- Known pre-existing vex-ee console entries: UnityCliConnector HTTP server start,
  PerformanceTesting IPrebuildSetup/IPostBuildCleanup, TestResults.xml save, lesson 08's old
  `E_TempNullLink` demo line.

## 6. UNDO APPENDIX

Artifact inventory for one run of §4 (vex-ee instance shown in §5):
1. Created asset `<assetPath>` (.playable: TimelineAsset + track + clip sub-assets —
   `DeleteAsset` removes all sub-assets with the file).
2. Possibly-created folder(s) `<assetFolder>` (only if `PRE|folderExisted=false`).
3. Mutated `director.playableAsset` (vex-ee pre value: PositionMastery, restored in-run;
   capture YOURS per §3.5).
4. Added generic-binding entry for the new track (SubScene file; SURVIVES playableAsset swaps —
   vex-ee left it as permanent stage state; full undo must `ClearGenericBinding` it).
   `EXPECTED:` the report proves the POST table (7 entries) and the prior asset's restore but
   never printed the pre-wiring table as `PRE|` lines — derivably the 6 pre-Parent entries;
   capture your own table verbatim per §3.5.
5. If the bake-error demo was reproduced: the temp clip (training removed it,
   `yamlHasTemp=False`), the deliberate console LogError line, and new bake artifact hashes in
   `Library/` — console history and derived caches are not undoable state; record in the card.
6. RUNTIME effects: **none exist in the editor.** Reparenting happens only in play mode through
   the EndFixedStepSimulation ECB; it never writes back to authoring data, and no play mode was
   entered in training. Within a play session, the PACKAGE's own revert (`restoreOnEnd`)
   restores the parent POINTER, never the POSE (§2 HEADLINE) — so even a designer-authored
   runtime "undo" cannot mean "back where it started"; with `restoreOnEnd=false` the runtime
   parenting persists for the session with no package-side revert at all. The agent's journal
   below undoes AUTHORING artifacts only — which fully reverses everything that persists.
7. Schemas: never created, never modified — nothing to undo.

ORDER: restore the director FIRST, THEN delete the asset, THEN other captured scene values —
deleting the asset while the director still points at it would leave a dangling `{fileID: 0}`-
style reference in the scene file instead of the captured pre-state.

Journal entry templates (protocol §5 — fill from YOUR captures, reverse order):

```csharp
// UNDO-1: restore director's captured playableAsset + binding table (SubScene bracket).
// Identical skeleton to the CopyTransform skill's UNDO-1: open SubScene additively,
// ClearGenericBinding every output track of MY asset, re-bind each CAPTURED PRE|binding| line
// (reload the PREVIOUS asset by captured path, match track by name/index, re-find the bound
// object by captured hierarchy path, bind the captured COMPONENT type), director.playableAsset
// = <CAPTURED pre value, never "default">, SetDirty, SaveScene, restore parent Single in
// finally. return "UNDONE|director restored";
```

```csharp
// UNDO-2: delete the created .playable (+ folder, only if PRE|folderExisted=false and now empty)
var assetPath = "<CAPTURED>"; var assetFolder = "<CAPTURED>"; var folderExisted = false; // <CAPTURED>
var ok = UnityEditor.AssetDatabase.DeleteAsset(assetPath);
if (!folderExisted && UnityEditor.AssetDatabase.FindAssets("", new[]{ assetFolder }).Length == 0)
    UnityEditor.AssetDatabase.DeleteAsset(assetFolder);
return "UNDONE|deleted=" + ok + "|" + assetPath;
```

```csharp
// UNDO-3: restore any other captured scene values — normally none beyond UNDO-1 for this track
// family (it never moves editor objects; schemas and the authored hierarchy are never touched).
```

UNDO-4 (verification, fresh load — protocol §7): reload the SubScene additively;
`director.playableAsset` must equal the CAPTURED pre value and the binding table the captured
`PRE|binding|` lines; confirm `AssetDatabase.LoadAssetAtPath<UnityEngine.Object>(assetPath) ==
null`; restore the parent scene; `unity-cli console --filter error` clean against the project
baseline (§5).

## 7. VERIFICATION PROTOCOL

1. **Fresh-load asset dump**: `AssetDatabase.LoadAssetAtPath` the `.playable` in a NEW exec
   block; dump track + clips (name, start/end, entityToParent, readRootFrom, parentLink asset +
   imported id, localPosition, localRotation, restoreOnEnd). In-memory state after a save is
   not evidence. (vex-ee expectation: §5.)
2. **Raw YAML check**: `parentLink:` is `{fileID: 11400000, guid: …, type: 2}` (never
   `{fileID: 0}` unless deliberately demoing); enum bytes match intent (e.g. `entityToParent: 1`,
   `readRootFrom: 4`); Euler verbatim (`localRotation: {x: 0, y: 45, z: 0}`);
   `restoreOnEnd: 1`/`0` per clip.
3. **Schema check**: the referenced schema's fresh YAML `id:` must be non-zero.
4. **Binding check from a RELOADED SubScene**: `BINDING|<trackName>|bound=<bindTarget>
   (TargetsAuthoring)` — the COMPONENT, not the Transform — and all captured prior bindings
   intact.
5. **Parent-scene restore**: end with `sceneCount=1`,
   `scene[0]=<parentScenePath>|loaded=True|active=True|dirty=False`.
6. **Console**: `unity-cli console --filter error` shows nothing new beyond the project baseline
   except any DELIBERATE "missing parent link" demo — remove the temp clip and prove the clean
   rebake (changed artifact hash, no new error lines; produce ALL `.sceneWithBuildSettings`
   artifacts).
