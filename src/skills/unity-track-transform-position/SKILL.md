---
name: unity-track-transform-position
description: Master of BovineLabs TransformPositionTrack + PositionClip/PositionStartClip (package com.bovinelabs.timeline.transform) — creating timelines that move SubScene-baked objects (World/Offset/Target modes, blending, reset semantics) and the cross-scene-reference traps. Portable to any project containing the package; worked example from vex-ee. Use when a designer asks to "move this thing along the timeline".
---

# TransformPositionTrack specialist

## 1. SCOPE

You are the specialist for **`TransformPositionTrack`** and its two clip types
**`PositionClip`** and **`PositionStartClip`** from the package
`com.bovinelabs.timeline.transform`. Scope: exactly this track family —
authoring the track/clips in a `.playable` TimelineAsset, wiring a SubScene
PlayableDirector, and the runtime position-blending semantics. Stage construction
belongs to `unity-stage-foundations`; scale belongs to `unity-track-transform-scale`.
Behave per unity-agent-protocol; operate the editor per unity-cli.

## 2. PORTABLE SEMANTICS

True in ANY project containing `com.bovinelabs.timeline.transform`. Provenance tags
say where a fact was PROVEN, not where it applies. (All verified vex-ee 2026-06 via
reflection dumps, YAML reads, fresh-load read-backs through `unity-cli exec`.)

Types (assembly `BovineLabs.Timeline.Transform.Authoring` for authoring; runtime in
`BovineLabs.Timeline.Transform`):

- `BovineLabs.Timeline.Transform.Authoring.TransformPositionTrack : DOTSTrack`
  — `[TrackBindingType(typeof(UnityEngine.Transform))]`,
  `[TrackClipType(PositionStartClip)]`, `[TrackClipType(PositionClip)]`.
- `BovineLabs.Timeline.Transform.Authoring.PositionClip : DOTSClip` — `ClipCaps.Blending`.
- `BovineLabs.Timeline.Transform.Authoring.PositionStartClip : DOTSClip` — `ClipCaps.Blending`, NO serialized fields.

Enums (both **byte**-backed):

```
BovineLabs.Timeline.Transform.Authoring.PositionType(Byte): World=0 Offset=1 Target=2
BovineLabs.Timeline.Transform.OffsetType(Byte):             World=0 Local=1
```

(Note `OffsetType` lives in the RUNTIME namespace `BovineLabs.Timeline.Transform`,
not `.Authoring`.)

### TransformPositionTrack fields
| Field | Type | Notes |
|---|---|---|
| `ResetPositionOnDeactivate` | bool | Declared on the track; adds `PositionState` at bake → capture binding position on track activate, restore on deactivate |
| `resetOnDeactivate` | bool | INHERITED from `DOTSTrack` base, serializes separately (defaulted True in the vex-ee asset) — do not confuse the two |

### PositionClip fields
| Field | Type | Used by | Default |
|---|---|---|---|
| `Type` | `PositionType` | all | World |
| `Position` | Vector3 | World | (0,0,0) |
| `Target` | plain `GameObject` (NOT ExposedReference) | Target | null |
| `OffsetType` | `OffsetType` | Offset, Target | **Local** (field initializer) |
| `Offset` | Vector3 | Offset, Target | (0,0,0) |

### Runtime semantics
Each PositionClip bakes to its own entity carrying `PositionAnimated` (the float3 the
clip wants the binding at) plus a mode component. World clips hold the constant. Offset
clips also bake `PositionOffset`; a job gated by `[WithAll(TimelineActive)]
[WithNone(TimelineActivePrevious)]` computes `binding.Position + offset` exactly ONCE
on the activation frame (Local offsets rotated via `TransformPoint`) — the destination
is frozen even if the binding later moves. Target clips bake `PositionTarget`; their
job runs EVERY active frame, re-reading the target entity's `LocalTransform`, so they
follow a moving target — and silently do nothing if the target is `Entity.Null`
(`if (!LocalTransforms.TryGetComponent(positionTarget.Target, out ...)) return;`).
PositionStartClip bakes `PositionMoveToStart`: on activation it snapshots the binding's
current position into `PositionAnimated`, so blending toward it eases the object back to
where it stood at clip start. `TrackBlendImpl<float3, PositionAnimated>` weights all
simultaneously active clips per binding by their blend curves; `WritePositionJob` writes
the result to `LocalTransform.Position`. `ResetPositionOnDeactivate=true` adds
`PositionState` to the track entity: `ActivateResetJob` captures the binding position on
track activation, `DeactivateResetJob` restores it on deactivation; without it the
binding stays at the last blended value.

### Traps & DO/DON'T (each proven live, vex-ee 2026-06)

- **DON'T persist scene-object `Target` references in a .playable** — a project asset
  physically cannot serialize a reference to a scene object: after `SaveAssets()` the
  file held `Target: {fileID: 0}` and fresh read-back showed null, with NO console
  warning; in-memory objects (and the Timeline UI until domain reload) keep the stale
  reference and lie. DO use the EntityLinks family (schema id → runtime resolution) for
  persistent cross-object references.
- **DON'T treat `Target=null` with `PositionType.Target` as an error you'll be told
  about** — it bakes `Entity.Null` (`GetEntity(null, ...)`) and the runtime lookup
  fails silently; the clip contributes nothing.
- **DON'T bind the track to a parent-scene object** — binding a parent-scene object
  from a SubScene director is silently nulled on save
  (`m_SceneBindings ... value: {fileID: 0}`), and even if it persisted, the parent
  scene is never baked, so no entity exists for `PositionTrackSystem` to write. DOTS
  tracks can only animate SubScene-baked objects.
- **DON'T conflate the two reset bools** — `resetOnDeactivate` (inherited from
  `DOTSTrack`) and `ResetPositionOnDeactivate` (track-declared, drives `PositionState`)
  serialize as separate YAML keys; set the one you mean.
- **DON'T cast byte-backed enums via `(int)Enum.Parse`** — throws
  InvalidCastException in exec blocks; use `System.Convert.ToInt64`.
- **DON'T use obsolete APIs in exec** — the verified editor build rejects
  `SerializedProperty.objectReferenceInstanceIDValue` (use
  `objectReferenceEntityIdValue`) and `Object.GetInstanceID()` (use `GetEntityId`).
- **DO remember a fresh PositionClip's `Position` default is (0,0,0)** — in World mode
  that actively teleports the binding to the origin (contrast ScaleClip's benign
  Vector3.one default).
- **DO set `blendInDuration` on the later overlapping clip** — an explicit
  `blendIn=0.5` on the later clip produced the mirrored computed `blendOut=0.5` on the
  earlier one; all clips report `caps=Blending`.
- **CAVEAT (inconclusive, reported honestly)**: querying the Editor World for baked
  `PositionAnimated` entities after closing the SubScene returned 0 (only the streaming
  `SceneReference` entity was present; entity-scene import is async). Absence of baked
  entities in the Editor World is NOT proof the bake is broken.

## 3. DISCOVERY RECIPES

Act only through `unity-cli exec` / `unity-cli console`; never the filesystem; never
play mode. Follow the unity-cli Safe Loop on every mutation. Names below are
parameters — discover them in THIS project; never assume the worked example (§5).

**3.1 Confirm the package exists (else report a missing prerequisite — protocol §6):**
```csharp
var t = System.Type.GetType("BovineLabs.Timeline.Transform.Authoring.TransformPositionTrack, BovineLabs.Timeline.Transform.Authoring");
return t == null
    ? "MISSING_PREREQUISITE|TransformPositionTrack not found - package com.bovinelabs.timeline.transform is absent in this project"
    : "OK|" + t.AssemblyQualifiedName + "|dataPath=" + UnityEngine.Application.dataPath;
```

**3.2 Find the active scene + SubScene(s):** run the unity-cli skill's First Command
(scene path, roots, SubScene components → their `.unity` paths). Record the parent
scene path (`parentScenePath`) and candidate SubScene path(s) (`subScenePath`).

**3.3 Find PlayableDirector(s) inside the SubScene** (read-only additive open,
restore parent after):
```csharp
var dirs = UnityEngine.Object.FindObjectsByType<UnityEngine.Playables.PlayableDirector>(
    UnityEngine.FindObjectsInactive.Include, UnityEngine.FindObjectsSortMode.None);
// print per director: hierarchy path, scene.path, playableAsset (asset path or null),
// other components on the GameObject (e.g. TimelineReferenceAuthoring)
```
Selection rule when several exist (STATE the rule used in your memory card): prefer
the single director in the chosen SubScene; if several, prefer one whose GameObject
carries the project's timeline-reference authoring component and whose `playableAsset`
is null (unclaimed); if still ambiguous, ask the designer. Zero directors → missing
prerequisite, protocol §6.

**3.4 Find/confirm the bind target** — the track binds a `UnityEngine.Transform` on a
SubScene-baked object. Find candidates by component
(`FindObjectsByType<UnityEngine.Transform>` filtered to the SubScene, or by the
designer's description), confirm the choice with the designer when more than one
plausible candidate exists. NEVER pick a parent-scene object (trap above).

**3.5 Capture the chosen director's existing state — this is pre-state (`PRE|`)**:
```csharp
// PRE|playableAsset=<asset PATH or null>   via AssetDatabase.GetAssetPath(director.playableAsset)
// PRE|binding|<i>|<track name>|<track type>|<bound object hierarchy path + component type, or null>
//   one line per GetOutputTracks() of the CURRENT asset, via director.GetGenericBinding(track).
// Capture the asset PATH and each track's NAME/index even when the table looks empty —
// they are what makes the undo journal replayable (UNDO-1 reloads the old asset by path
// and re-binds by matching track name/index).
```
Record these in the undo journal (§6) before any mutation.

**Name resolution rule**: `GameObject.Find` misses inactive objects and is ambiguous on
duplicate names. Discovery (§3.3/3.4) must confirm the chosen name is active and unique
in the SubScene; otherwise resolve by walking the SubScene's root objects to the
recorded hierarchy path (or `FindObjectsByType` filtered by `scene`) instead of `Find`.

## 4. CANONICAL RECIPES

One logical change per exec block; each block prints its `PRE|` capture before
mutating (protocol §2), saves inside the block, and is verified from a fresh load (§7).

**4.1 Create timeline + track + clips, then wire the director** (the SubScene bracket
is needed ONLY to resolve scene objects for the binding; do NOT rely on assigning
scene objects to clip fields — trap above):

```csharp
// ---- parameters (discovered in §3 / chosen with designer) ----
var parentScenePath = "<DISCOVERED>";                       // §3.2
var subScenePath    = "<DISCOVERED>";                       // §3.2
var directorGoName  = "<DISCOVERED>";                       // §3.3
var bindTargetPath  = "<DISCOVERED>";                       // §3.4, hierarchy path inside SubScene
var assetFolder     = "<CHOSEN>";                           // e.g. "Assets/<Area>/<Job>"
var assetPath       = assetFolder + "/<Name>.playable";
var trackName       = "<CHOSEN>";

var parentScene = UnityEditor.SceneManagement.EditorSceneManager.GetActiveScene();
var subScene = UnityEditor.SceneManagement.EditorSceneManager.OpenScene(
    subScenePath, UnityEditor.SceneManagement.OpenSceneMode.Additive);
UnityEditor.SceneManagement.EditorSceneManager.SetActiveScene(subScene);
try {
    // CAPTURE (print + journal): PRE|folderExisted=<bool> PRE|assetExisted=<bool>
    var folderExisted = UnityEditor.AssetDatabase.IsValidFolder(assetFolder);
    var assetExisted = UnityEditor.AssetDatabase.LoadAssetAtPath<UnityEngine.Object>(assetPath) != null;
    if (!folderExisted) { /* CreateFolder for each missing segment of assetFolder */ }

    var timeline = UnityEngine.ScriptableObject.CreateInstance<UnityEngine.Timeline.TimelineAsset>();
    UnityEditor.AssetDatabase.CreateAsset(timeline, assetPath);
    var track = timeline.CreateTrack<BovineLabs.Timeline.Transform.Authoring.TransformPositionTrack>(null, trackName);
    track.ResetPositionOnDeactivate = true; // restore binding position when track deactivates

    // Pattern WORLD: go to an absolute point
    var clipA = track.CreateClip<BovineLabs.Timeline.Transform.Authoring.PositionClip>();
    clipA.start = 0; clipA.duration = 2; clipA.displayName = "<clipName>";
    var a = (BovineLabs.Timeline.Transform.Authoring.PositionClip)clipA.asset;
    a.Type = BovineLabs.Timeline.Transform.Authoring.PositionType.World;
    a.Position = new UnityEngine.Vector3(0f, 1f, 5f);                 // <CHOSEN>

    // Pattern OFFSET (computed ONCE at clip activation, Local = rotated by binding)
    var clipB = track.CreateClip<BovineLabs.Timeline.Transform.Authoring.PositionClip>();
    clipB.start = 1.5; clipB.duration = 2; clipB.displayName = "<clipName>";
    var b = (BovineLabs.Timeline.Transform.Authoring.PositionClip)clipB.asset;
    b.Type = BovineLabs.Timeline.Transform.Authoring.PositionType.Offset;
    b.OffsetType = BovineLabs.Timeline.Transform.OffsetType.Local;
    b.Offset = new UnityEngine.Vector3(2f, 0f, 0f);                   // <CHOSEN>
    clipB.blendInDuration = 0.5; // overlap with previous clip => weighted blend

    // Pattern TARGET (re-evaluated EVERY frame). WARNING: a scene-object Target
    // serializes as {fileID: 0} in the asset - prefer EntityLinks tracks
    // for persistent cross-object references.
    var clipC = track.CreateClip<BovineLabs.Timeline.Transform.Authoring.PositionClip>();
    clipC.start = 3.5; clipC.duration = 1.5; clipC.displayName = "<clipName>";
    var c = (BovineLabs.Timeline.Transform.Authoring.PositionClip)clipC.asset;
    c.Type = BovineLabs.Timeline.Transform.Authoring.PositionType.Target;
    c.Target = UnityEngine.GameObject.Find("<DISCOVERED target>"); // see warning above
    c.OffsetType = BovineLabs.Timeline.Transform.OffsetType.World;
    c.Offset = new UnityEngine.Vector3(0f, 2f, 0f);                   // <CHOSEN>

    // Pattern START: blend back toward where the binding stood at clip start
    var clipD = track.CreateClip<BovineLabs.Timeline.Transform.Authoring.PositionStartClip>();
    clipD.start = 5; clipD.duration = 1; clipD.displayName = "<clipName>";

    foreach (var o in new UnityEngine.Object[] { timeline, track, a, b, c, (UnityEngine.Object)clipD.asset })
        UnityEditor.EditorUtility.SetDirty(o);
    UnityEditor.AssetDatabase.SaveAssets();

    // Wire the director (binding table lives in the SCENE file -> persists fine)
    var director = UnityEngine.GameObject.Find(directorGoName).GetComponent<UnityEngine.Playables.PlayableDirector>();
    // CAPTURE (print + journal) BEFORE mutating:
    //   PRE|playableAsset=<asset path or null>
    //   PRE|binding|<each output track of the CURRENT asset>|<GetGenericBinding value>
    var bindTarget = UnityEngine.GameObject.Find(bindTargetPath).GetComponent<UnityEngine.Transform>();
    director.playableAsset = timeline;
    director.SetGenericBinding(track, bindTarget);
    UnityEditor.EditorUtility.SetDirty(director);
    UnityEditor.SceneManagement.EditorSceneManager.SaveScene(subScene);
    return "OK|" + assetPath;
} finally {
    UnityEditor.SceneManagement.EditorSceneManager.SetActiveScene(parentScene);
    UnityEditor.SceneManagement.EditorSceneManager.CloseScene(subScene, false);
    UnityEditor.SceneManagement.EditorSceneManager.OpenScene(parentScenePath, UnityEditor.SceneManagement.OpenSceneMode.Single);
}
```

Clip starts/durations/values above are example choices, not constants of the package.
Verify per §7 in SEPARATE blocks before claiming success.

## 5. WORKED EXAMPLE (vex-ee training stage) — example environment; rediscover, never assume

- Project: `/home/i/GitHub/vex-ee` (`dataPath=/home/i/GitHub/vex-ee/Assets`).
  Parent scene `Assets/Scenes/Main Scene.unity`; SubScene `Assets/Scenes/Main Sub Scene.unity`.
- Stage (built by unity-stage-foundations): `TrainingStage` root containing
  `Stage_Director` (PlayableDirector + TimelineReferenceAuthoring, the only director),
  `Stage_Target` (cube at (5,0,0); LifeCycleAuthoring, TargetsAuthoring),
  `Stage_LinkRoot/Stage_Actor` (capsule at (0,1,0) — the binding; LifeCycle/Targets/
  Stat/Transform/EntityLinkSource authoring).
- Asset built in training: `Assets/Training/01-transform-position-track/PositionMastery.playable`
  — one track `PositionTrack` (`ResetPositionOnDeactivate: 1`, inherited
  `resetOnDeactivate: 1`), clips: A_World 0–2s pos (0,1,5) / B_OffsetLocal 1.5–3.5s
  offset (2,0,0) blendIn 0.5 (mirrored blendOut 0.5 on A) / C_Target 3.5–5s
  OffsetType=World offset (0,2,0), `Target: {fileID: 0}` on disk (dropped scene ref) /
  D_Start 5–6s.
- Director wiring: `Stage_Director.playableAsset=PositionMastery`; exactly ONE binding,
  `binding[PositionTrack]=Stage_Actor (UnityEngine.Transform)`.
- Known pre-existing vex-ee console background entries: UnityCliConnector HTTP server
  start, PerformanceTesting IPrebuildSetup/IPostBuildCleanup, TestResults.xml save.

## 6. UNDO APPENDIX

Artifact inventory for one run of §4 (vex-ee instance shown in §5):
1. Created asset `<assetPath>` (.playable: TimelineAsset + 1 track + 4 clip sub-assets
   — `DeleteAsset` removes all sub-assets with the file).
2. Possibly-created folder(s) `<assetFolder>` (only if `PRE|folderExisted=false`).
3. Mutated `director.playableAsset` (vex-ee: `EXPECTED:` previously null — the
   training report did not print the pre-wiring value; capture it yourself per §3.5).
4. Added/changed generic binding entry for the new track (binding table lives in the
   SubScene file). `EXPECTED:` vex-ee table previously empty — not printed pre-wiring.
5. No other scene values were changed (the track itself never moves editor objects).

ORDER: restore the director FIRST so nothing in the scene references the asset, THEN
delete the asset, THEN restore any other captured scene values — deleting the asset
while the director still points at it would leave a dangling `{fileID: 0}`-style
reference in the scene file instead of the captured pre-state.

Journal entry templates (protocol §5 — fill from YOUR captures, reverse order):

```csharp
// UNDO-1: restore director's captured playableAsset + binding table (SubScene bracket)
var parentScenePath = "<CAPTURED>"; var subScenePath = "<CAPTURED>";
var directorGoName = "<CAPTURED>"; var assetPath = "<CAPTURED>";
var parentScene = UnityEditor.SceneManagement.EditorSceneManager.GetActiveScene();
var subScene = UnityEditor.SceneManagement.EditorSceneManager.OpenScene(
    subScenePath, UnityEditor.SceneManagement.OpenSceneMode.Additive);
UnityEditor.SceneManagement.EditorSceneManager.SetActiveScene(subScene);
try {
    var director = UnityEngine.GameObject.Find(directorGoName).GetComponent<UnityEngine.Playables.PlayableDirector>();
    var myAsset = UnityEditor.AssetDatabase.LoadAssetAtPath<UnityEngine.Timeline.TimelineAsset>(assetPath);
    foreach (var tr in myAsset.GetOutputTracks())
        director.ClearGenericBinding(tr);            // entries I added for MY tracks
    // restore each CAPTURED binding (PRE|binding| lines; none if the table was empty).
    // Tracks are sub-assets of the PREVIOUS playable asset - reload it by captured path
    // and match by name/index, then re-find the bound object by its captured hierarchy path:
    // var prev = UnityEditor.AssetDatabase.LoadAssetAtPath<UnityEngine.Timeline.TimelineAsset>("<CAPTURED pre path>");
    // foreach (var tr in prev.GetOutputTracks())
    //     if (tr.name == "<captured track name>") director.SetGenericBinding(tr, <re-found bound object>);
    director.playableAsset =                         // restore CAPTURED value, never "default"
        null /* or AssetDatabase.LoadAssetAtPath<UnityEngine.Playables.PlayableAsset>("<CAPTURED pre path>") */;
    UnityEditor.EditorUtility.SetDirty(director);
    UnityEditor.SceneManagement.EditorSceneManager.SaveScene(subScene);
    return "UNDONE|director restored";
} finally {
    UnityEditor.SceneManagement.EditorSceneManager.SetActiveScene(parentScene);
    UnityEditor.SceneManagement.EditorSceneManager.CloseScene(subScene, false);
    UnityEditor.SceneManagement.EditorSceneManager.OpenScene(parentScenePath, UnityEditor.SceneManagement.OpenSceneMode.Single);
}
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
// UNDO-3: restore any other captured scene values — for THIS track family there are
// normally none beyond UNDO-1; include only entries your own journal recorded.
```

UNDO-4 (verification, fresh load — protocol §7): reload the SubScene additively and
print `director.playableAsset` (must equal the CAPTURED pre value) and the binding
table (must equal the captured `PRE|binding|` lines); confirm
`AssetDatabase.LoadAssetAtPath<UnityEngine.Object>(assetPath) == null`; restore the
parent scene; `unity-cli console --filter error` clean against the project baseline.

## 7. VERIFICATION PROTOCOL

1. **Fresh-load asset dump**: in a new exec block, `AssetDatabase.LoadAssetAtPath` the
   `.playable` at `<assetPath>` and dump every track/clip (name, start/duration,
   blendIn/blendOut, caps, asset type, all serialized fields). In-memory state after a
   save is not evidence.
2. **Raw YAML check**: read the `.playable` file text for `Target: {fileID: 0}`
   (dropped references), the two reset keys (`resetOnDeactivate` /
   `ResetPositionOnDeactivate`), and clip field values.
3. **Binding table from a RELOADED SubScene**: expect
   `BINDING|<trackName>|bound=<bindTargetName> (UnityEngine.Transform)`. Never leave
   experimental bindings in place.
4. **Parent-scene restore**: end with `sceneCount=1`,
   `scene[0]=<parentScenePath>|loaded=True|active=True|dirty=False`.
5. **Console**: `unity-cli console --filter error` must show nothing new beyond the
   project's known pre-existing background entries (vex-ee baseline listed in §5).
