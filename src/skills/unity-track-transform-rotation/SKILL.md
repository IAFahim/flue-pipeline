---
name: unity-track-transform-rotation
description: Master of BovineLabs TransformRotationTrack + RotationLookAtTargetClip/RotationLookAtStartClip (package com.bovinelabs.timeline.transform) — the two-sided ExposedReference wiring (asset GUID + director scene table), every-frame look-at vs first-frame orientation capture, NaN look-direction traps, and reset semantics. Portable to any project containing the package; worked example from vex-ee. Use when a designer asks to "make it face / track / turn back".
---

# TransformRotationTrack specialist

## 1. SCOPE

You are the specialist for **`TransformRotationTrack`** and its two clip types
**`RotationLookAtTargetClip`** and **`RotationLookAtStartClip`** from the package
`com.bovinelabs.timeline.transform`. Scope: exactly this track family — authoring the
track/clips in a `.playable` TimelineAsset, the **two-sided ExposedReference wiring**
(canonical for ALL ExposedReference tracks), wiring a SubScene PlayableDirector, and
the runtime quaternion-blending/look-at semantics. Stage construction belongs to
`unity-stage-foundations`; position/scale to their own track specialists.
Behave per unity-agent-protocol; operate the editor per unity-cli.

## 2. PORTABLE SEMANTICS

True in ANY project containing `com.bovinelabs.timeline.transform`. Provenance tags say
where a fact was PROVEN, not where it applies. (All verified vex-ee 2026-06 via reflection
dumps, package-source reads, YAML reads of .playable and .unity files, fresh-load
read-backs through `unity-cli exec`.)

Types (assembly `BovineLabs.Timeline.Transform.Authoring`):

- `BovineLabs.Timeline.Transform.Authoring.TransformRotationTrack : DOTSTrack`
  — `[TrackBindingType(typeof(UnityEngine.Transform))]`, `[TrackClipType(RotationLookAtTargetClip)]`,
  `[TrackClipType(RotationLookAtStartClip)]`, `[TrackColor(0.85, 0.30, 0.70)]`,
  `[DisplayName("BovineLabs/Timeline/Transform/Rotation")]`.
- `...Authoring.RotationLookAtTargetClip : DOTSClip` — `ClipCaps.Blending`.
- `...Authoring.RotationLookAtStartClip : DOTSClip` — `ClipCaps.Blending`, NO serialized
  fields; bakes `RotationLookAtStartBuilder` → `RotationLookAtStart` tag.

**NAME-COLLISION TRAP**: `BovineLabs.Vibe.Authoring.LocalTransform` declares clips with
the SAME short names (different base, completely different fields). Always use fully
qualified `BovineLabs.Timeline.Transform.Authoring.*` names in exec blocks and sweeps.

### TransformRotationTrack fields
| Field | Type | Notes |
|---|---|---|
| `ResetRotationOnDeactivate` | bool | Declared on the track; bakes `RotationState{quaternion Value}` on the track entity → capture binding rotation on track activate, restore on deactivate |
| `resetOnDeactivate` | bool | INHERITED from `DOTSTrack` base, serializes separately — do not confuse the two (family pattern, confirmed three for three) |

`RotationLookAtTargetClip` has ONE field: `Target : ExposedReference<Transform>`
(default: `exposedName` empty, `defaultValue {fileID: 0}`) — NOT a plain object field;
see the two-sided wiring below.

Bake path (quoted from the package's `Authoring/Rotation/RotationLookAtTargetClip.cs`):

```csharp
UnityEngine.Transform target = null;
if (context.Director != null)
    target = context.Director.GetReferenceValue(Target.exposedName, out _) as UnityEngine.Transform;
var builder = new RotationLookAtTargetBuilder { Target = context.Baker.GetEntity(target, TransformUsageFlags.Dynamic) };
```

### Runtime semantics
Each clip bakes to its own entity carrying `RotationAnimated` (the quaternion the clip
wants the binding at). LookAtTarget entities also carry `RotationLookAtTarget{Entity Target}`;
`LookAtTargetClipJob` runs EVERY active frame, recomputing
`quaternion.LookRotation(targetPos - bindingPos, math.up())` — the binding's +Z tracks a
moving target, silently skipping any frame where either entity lacks `LocalTransform`, and
producing NaN if the look direction is zero or vertical (no guard in source). LookAtStart
entities are edge-gated (`[WithAll(TimelineActive)] [WithNone(TimelineActivePrevious)]`):
on exactly the FIRST active frame the job freezes the binding's current rotation into
`RotationAnimated`; blending toward it turns the object back to its clip-start orientation
without moving it. `TrackBlendImpl<quaternion, RotationAnimated>` weights all
simultaneously active clips per binding through `QuaternionMixer` (`math.nlerp` weighted
mixing — cheap, non-constant angular velocity, fine for short blends; `math.mul` additive
composition); `WriteRotationJob` writes the result into `LocalTransform.Rotation`,
flipping the `ActiveRotation` enableable marker. `ResetRotationOnDeactivate=true` bakes
`RotationState`: `ActivateResetJob` captures `LocalTransform.Rotation` on the track's
first active frame, `DeactivateResetJob` restores it on deactivation; without it the
binding keeps the last blended orientation.

### The ExposedReference mechanism — TWO-SIDED (canonical for ALL ExposedReference tracks)
ExposedReference is the asset→scene escape hatch: the .playable stores ONLY a GUID string
(`exposedName`); the object reference lives in the scene PlayableDirector's
`m_ExposedReferences` table, serialized WITH the SubScene as a scene-local fileID. Asset
holds the name; scene holds the object — which is why the link SURVIVES save/reload while
plain object fields (e.g. `PositionClip.Target`) die to `{fileID: 0}`. TWO saves required,
one per side: `AssetDatabase.SaveAssets()` (GUID side), `SaveScene(subScene)` (table
side) — skipping the scene save silently loses the object side while the .playable looks
correctly wired. On-disk shape (real values in §5):

```
# .playable (clip side):              # .unity (director side):
  Target:                               m_ExposedReferences:
    exposedName: <guid>                   m_References:
    defaultValue: {fileID: 0}             - <guid>: {fileID: <scene-local Transform id>}
```

### Traps & DO/DON'T (each proven live, vex-ee 2026-06)

- **DON'T treat an unset ExposedReference as an error you'll be told about** — an
  untouched clip has `exposedName=""`; `GetReferenceValue` null → `Baker.GetEntity(null)`
  → `Entity.Null` → `LookAtTargetClipJob` silently skips EVERY frame, no error ever
  (`EDGE_A|GetReferenceValue(unset)=NULL|idValid=False`).
- **DON'T place the look-at target at the binding's position or directly on its
  vertical axis** — `LookRotation(zero, up)` and `LookRotation(up, up)` both returned
  `float4(NaNf, NaNf, NaNf, NaNf)` live; `WriteRotationJob` writes that NaN into
  `LocalTransform.Rotation`, poisoning the transform. Keep a lateral offset.
- **DON'T expect LookAtStart to restore the timeline-original pose** — it freezes the
  binding's orientation on the clip's OWN activation frame; if another clip already
  rotated the object, that rotated orientation gets frozen. True "return to original
  pose" is the track-level `ResetRotationOnDeactivate` job's role. (It captures
  ROTATION, not position — the object turns back in place, never travels.)
- **DON'T conflate the two reset bools** — `resetOnDeactivate` (inherited from
  `DOTSTrack`) and `ResetRotationOnDeactivate` (track-declared, drives `RotationState`)
  serialize as separate YAML keys, side by side on disk; set the one you mean.
- **DO trust director tables across playableAsset swaps** — binding table (keyed by
  track asset) and exposed-reference table (keyed by GUID name) both survived swapping
  `director.playableAsset` (three coexisting track bindings + the exposed ref). UNDO
  corollary: deleting your .playable does NOT remove your table entries — see §6.
- **DO set `blendInDuration` on the later overlapping clip** for the look-at → turn-back handoff (nlerp toward the frozen orientation); both clips `caps=Blending`.

## 3. DISCOVERY RECIPES

Act only through `unity-cli exec` / `unity-cli console`; never the filesystem; never play
mode. Follow the unity-cli Safe Loop on every mutation. Names below are parameters —
discover them in THIS project; never assume the worked example (§5).

**3.1 Confirm the package exists (else "no egg" per protocol §6):**
```csharp
var t = System.Type.GetType("BovineLabs.Timeline.Transform.Authoring.TransformRotationTrack, BovineLabs.Timeline.Transform.Authoring");
return t == null ? "NO_EGG|package com.bovinelabs.timeline.transform absent in this project"
    : "OK|" + t.AssemblyQualifiedName + "|dataPath=" + UnityEngine.Application.dataPath;
```

**3.2 Find the active scene + SubScene(s):** run the unity-cli skill's First Command
(scene path, roots, SubScene components → their `.unity` paths). Record
`parentScenePath` and candidate `subScenePath`(s).

**3.3 Find PlayableDirector(s) inside the SubScene** (read-only additive open,
restore parent after):
```csharp
var dirs = UnityEngine.Object.FindObjectsByType<UnityEngine.Playables.PlayableDirector>(
    UnityEngine.FindObjectsInactive.Include, UnityEngine.FindObjectsSortMode.None);
// print per director: hierarchy path, scene.path, playableAsset (asset path or null),
// other components on the GameObject (e.g. TimelineReferenceAuthoring)
```
Selection rule when several exist (STATE the rule used in your memory card): prefer the
single director in the chosen SubScene; then one carrying the project's timeline-reference
authoring component with `playableAsset` null (unclaimed); if still ambiguous, ask the
designer. Zero directors → missing prerequisite, protocol §6.

**3.4 Find/confirm TWO scene objects** — (a) the bind target (the Transform the track
rotates) and (b) the look-at target (the Transform the ExposedReference points at). Both
must be SubScene-baked. Find candidates by component (`FindObjectsByType<UnityEngine.Transform>`
filtered to the SubScene, or by the designer's description); confirm with the designer
when several are plausible. PLACEMENT CHECK before wiring: print both positions; the
look-at target must be neither at the binding's position nor on its vertical axis (NaN trap, §2).

**3.5 Capture the chosen director's existing state — this is pre-state (`PRE|`)**:
```csharp
// PRE|playableAsset=<asset PATH or null>   via AssetDatabase.GetAssetPath(director.playableAsset)
// PRE|binding|<i>|<track name>|<track type>|<bound object hierarchy path + component type, or null>
//   one line per GetOutputTracks() of the CURRENT asset, via director.GetGenericBinding(track).
// PRE|exposedRef|<guid>|<fileID> — the FULL m_ExposedReferences.m_References list, read from
//   the SubScene's saved .unity text inside exec (File.ReadAllText — the verified method).
//   Capture BEFORE minting your GUID: it lets UNDO-1 prove it removed only YOUR entry.
// Capture the asset PATH and each track's NAME/index even when the table looks empty —
// they make the undo replayable (UNDO-1 reloads the old asset by path, re-binds by name/index).
```
Record these in the undo journal (§6) before any mutation.

**Name resolution rule**: `GameObject.Find` misses inactive objects and is ambiguous on
duplicate names. Discovery (§3.3/3.4) must confirm the chosen name is active and unique in
the SubScene; otherwise walk the SubScene's root objects to the recorded hierarchy path
(or `FindObjectsByType` filtered by `scene`) instead of `Find`.

## 4. CANONICAL RECIPES

One logical change per exec block; each block prints its `PRE|` capture before mutating
(protocol §2), saves inside the block, and is verified from a fresh load (§7).

**4.1 Create timeline + track + clips, then perform the two-sided wiring**
(ExposedReference wiring REQUIRES the SubScene open: the director owns the table):

```csharp
// ---- parameters (discovered in §3 / chosen with designer) ----
var parentScenePath = "<DISCOVERED>"; var subScenePath = "<DISCOVERED>";        // §3.2
var directorGoPath = "<DISCOVERED>";                 // §3.3, hierarchy path in SubScene
var bindTargetPath = "<DISCOVERED>"; var lookTargetPath = "<DISCOVERED>";     // §3.4a/b
var assetFolder = "<CHOSEN>"; var assetPath = assetFolder + "/<Name>.playable"; var trackName = "<CHOSEN>";

var parentScene = UnityEditor.SceneManagement.EditorSceneManager.GetActiveScene();
var subScene = UnityEditor.SceneManagement.EditorSceneManager.OpenScene(
    subScenePath, UnityEditor.SceneManagement.OpenSceneMode.Additive);
UnityEditor.SceneManagement.EditorSceneManager.SetActiveScene(subScene);
try {
    // CAPTURE (print + journal): PRE|folderExisted=<bool> PRE|assetExisted=<bool>
    var folderExisted = UnityEditor.AssetDatabase.IsValidFolder(assetFolder);
    if (!folderExisted) { /* CreateFolder for each missing segment of assetFolder */ }
    // 1. Timeline asset + track (FULL namespace - a Vibe clip shares the short name!)
    var timeline = UnityEngine.ScriptableObject.CreateInstance<UnityEngine.Timeline.TimelineAsset>();
    UnityEditor.AssetDatabase.CreateAsset(timeline, assetPath);
    var track = timeline.CreateTrack<BovineLabs.Timeline.Transform.Authoring.TransformRotationTrack>(null, trackName);
    track.ResetRotationOnDeactivate = true;   // snap back to pre-track rotation on deactivate
    // 2. Look-at clip (re-aims EVERY active frame - follows a moving target)
    var clipA = track.CreateClip<BovineLabs.Timeline.Transform.Authoring.RotationLookAtTargetClip>();
    clipA.start = 0; clipA.duration = 2.5; clipA.displayName = "<clipName>";
    var a = (BovineLabs.Timeline.Transform.Authoring.RotationLookAtTargetClip)clipA.asset;
    // 3. Turn-back clip, overlapping for a blend (starts/durations are example choices)
    var clipB = track.CreateClip<BovineLabs.Timeline.Transform.Authoring.RotationLookAtStartClip>();
    clipB.start = 2; clipB.duration = 2; clipB.displayName = "<clipName>";
    clipB.blendInDuration = 0.5;
    // 4a. EXPOSED-REFERENCE SEQUENCE side one (canonical): mint GUID on the CLIP ASSET,
    //     save the .playable. JOURNAL the minted GUID - UNDO-1 clears the table entry by it.
    var exposedName = new UnityEngine.PropertyName(System.Guid.NewGuid().ToString());
    a.Target = new UnityEngine.ExposedReference<UnityEngine.Transform> { exposedName = exposedName };
    foreach (var o in new UnityEngine.Object[] { timeline, track, a, (UnityEngine.Object)clipB.asset })
        UnityEditor.EditorUtility.SetDirty(o);
    UnityEditor.AssetDatabase.SaveAssets();
    // 4b. side two: bind + register the object on the DIRECTOR's table, save the SCENE.
    //     CAPTURE (print + journal) BEFORE mutating: the full §3.5 PRE| lines.
    var director = UnityEngine.GameObject.Find(directorGoPath).GetComponent<UnityEngine.Playables.PlayableDirector>(); // per Name resolution rule
    director.playableAsset = timeline;
    director.SetGenericBinding(track, UnityEngine.GameObject.Find(bindTargetPath).GetComponent<UnityEngine.Transform>());
    director.SetReferenceValue(exposedName, UnityEngine.GameObject.Find(lookTargetPath).GetComponent<UnityEngine.Transform>());
    UnityEditor.EditorUtility.SetDirty(director);
    UnityEditor.SceneManagement.EditorSceneManager.SaveScene(subScene);
    return "OK|" + assetPath + "|exposedName=" + exposedName;
} finally {
    UnityEditor.SceneManagement.EditorSceneManager.SetActiveScene(parentScene);
    UnityEditor.SceneManagement.EditorSceneManager.CloseScene(subScene, false);
    UnityEditor.SceneManagement.EditorSceneManager.OpenScene(parentScenePath, UnityEditor.SceneManagement.OpenSceneMode.Single);
}
```

Verify per §7 in SEPARATE blocks before claiming success.

## 5. WORKED EXAMPLE (vex-ee training stage) — example environment; rediscover, never assume

- Project: `/home/i/GitHub/vex-ee` (`dataPath=/home/i/GitHub/vex-ee/Assets`); parent
  scene `Assets/Scenes/Main Scene.unity`; SubScene `Assets/Scenes/Main Sub Scene.unity`.
- Stage (built by unity-stage-foundations): `TrainingStage` root with `Stage_Director`
  (PlayableDirector + TimelineReferenceAuthoring, the only director), `Stage_Target`
  (cube at (5,0,0) — the look-at target), `Stage_LinkRoot/Stage_Actor` (capsule at
  (0,1,0) — the binding). Look direction at wiring:
  `LookRotation((5,-1,0), up) = float4(0.116, 0.697, -0.116, 0.697)` — non-degenerate.
- Asset built: `Assets/Training/03-transform-rotation-track/RotationMastery.playable` —
  track `RotationTrack` (`ResetRotationOnDeactivate: 1`, inherited `resetOnDeactivate: 1`),
  clips A_LookAtTarget 0–2.5s / B_BackToStart 2–4s `blendIn=0.5`; clip A
  `exposedName: cca01140-fc94-4eda-9c0d-77166bb79c6a`.
- Director side on disk: `m_ExposedReferences.m_References` holds
  `- cca01140-…: {fileID: 311820019}` (Stage_Target's Transform); binding keys for all
  three mastery tracks (Position/Scale/Rotation) → fileID 1914093324 (Stage_Actor).
  Fresh-reload: `FRESH|GetReferenceValue=Stage_Target (UnityEngine.Transform)|idValid=True`.
- Session end: `playableAsset` RESTORED to lesson 01's `PositionMastery.playable`; the
  RotationTrack binding and exposed-ref entry remain in the scene tables (§2).
- Known pre-existing vex-ee console background entries: UnityCliConnector HTTP server
  start, PerformanceTesting IPrebuildSetup/IPostBuildCleanup, TestResults.xml save.

## 6. UNDO APPENDIX

Artifact inventory for one run of §4 (vex-ee instance shown in §5):
1. Created asset `<assetPath>` (.playable: TimelineAsset + 1 track + 2 clip sub-assets;
   `DeleteAsset` removes them with the file, INCLUDING the asset-side `exposedName` GUID).
2. Possibly-created folder(s) `<assetFolder>` (only if `PRE|folderExisted=false`).
3. Mutated `director.playableAsset` (vex-ee capture: was lesson 01's
   `PositionMastery.playable`, printed as `DIRECTOR|playableAsset=PositionMastery`).
4. Added generic-binding entry for the new track (SubScene file; keyed by track asset;
   survives asset swaps — must be cleared explicitly).
5. Added exposed-reference table entry `<guid> → <look-target Transform>` in the
   director's `m_ExposedReferences` (SubScene file). The two-sided wiring inverts
   two-sidedly: deleting the .playable removes ONLY the GUID side; the table entry, keyed
   by the GUID string, survives asset swaps AND asset deletion as an invisible orphan in
   the scene file — undo must clear it explicitly.

ORDER: restore the director FIRST (clear MY exposed-ref entry, clear MY binding, restore
captured playableAsset, save scene) so nothing in the scene references the asset OR
carries my GUID, THEN delete the asset, THEN restore other captured scene values.
Deleting the asset first would leave a dangling `{fileID: 0}`-style reference; skipping
the table clear would leave an orphaned GUID entry no inspector shows.

Journal entry templates (protocol §5 — fill from YOUR captures, reverse order):

```csharp
// UNDO-1: restore director (exposed-ref entry + binding + playableAsset), SubScene bracket
var parentScenePath = "<CAPTURED>"; var subScenePath = "<CAPTURED>";
var directorGoPath = "<CAPTURED>"; var assetPath = "<CAPTURED>"; var myExposedName = "<CAPTURED minted GUID>";
var parentScene = UnityEditor.SceneManagement.EditorSceneManager.GetActiveScene();
var subScene = UnityEditor.SceneManagement.EditorSceneManager.OpenScene(
    subScenePath, UnityEditor.SceneManagement.OpenSceneMode.Additive);
UnityEditor.SceneManagement.EditorSceneManager.SetActiveScene(subScene);
try {
    var director = UnityEngine.GameObject.Find(directorGoPath).GetComponent<UnityEngine.Playables.PlayableDirector>();
    // (a) clear MY exposed-reference table entry. EXPECTED: ClearReferenceValue removes
    // the m_References entry - documented IExposedPropertyTable API, never exercised in
    // training. Verify via the UNDO-4 scene-YAML grep; if the entry survives, delete it
    // via SerializedObject (m_ExposedReferences.m_References) and report which path worked.
    director.ClearReferenceValue(new UnityEngine.PropertyName(myExposedName));
    // (b) clear MY binding entries
    var myAsset = UnityEditor.AssetDatabase.LoadAssetAtPath<UnityEngine.Timeline.TimelineAsset>(assetPath);
    foreach (var tr in myAsset.GetOutputTracks())
        director.ClearGenericBinding(tr);
    // (c) restore each CAPTURED pre-existing binding/exposed-ref (PRE| lines; none if tables
    // were empty): reload the PREVIOUS playable by captured path, match tracks by name/index.
    director.playableAsset =                         // restore CAPTURED value, never "default"
        null /* or AssetDatabase.LoadAssetAtPath<UnityEngine.Playables.PlayableAsset>("<CAPTURED pre path>") */;
    UnityEditor.EditorUtility.SetDirty(director);
    UnityEditor.SceneManagement.EditorSceneManager.SaveScene(subScene);
    return "UNDONE|director restored|clearedExposedRef=" + myExposedName;
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

UNDO-3: restore any other captured scene values — normally none for this family beyond UNDO-1; include only entries your own journal recorded.

UNDO-4 (verification, fresh load — protocol §7): reload the SubScene additively; print
`director.playableAsset` and the binding table (must equal the CAPTURED `PRE|` values);
read the saved `.unity` text and confirm the minted GUID appears NOWHERE in it (orphan
check) and `m_ExposedReferences` equals the captured `PRE|exposedRef|` lines; confirm
`AssetDatabase.LoadAssetAtPath<UnityEngine.Object>(assetPath) == null`; restore the parent
scene; `unity-cli console --filter error` clean against the project baseline.

vex-ee note: training left artifacts 1, 4, 5 in place (asset, RotationTrack binding,
exposed-ref entry), playableAsset already restored — undoing it means UNDO-1(a,b) + UNDO-2.

## 7. VERIFICATION PROTOCOL

1. **Fresh-load asset dump**: in a new exec block, `AssetDatabase.LoadAssetAtPath` the
   `.playable` at `<assetPath>`; dump every track/clip (name, start/duration, blendIn, caps,
   asset type, `ResetRotationOnDeactivate`). In-memory state is not evidence.
2. **Raw YAML check, BOTH sides**: the `.playable` must show the minted
   `exposedName: <guid>` under `Target:` (empty `exposedName:` = unwired silent-no-op
   clip); the SubScene `.unity` must show `- <guid>: {fileID: <n>}` under
   `m_ExposedReferences.m_References`, the fileID resolving to the intended Transform in
   the same scene file. Also confirm the two reset keys.
3. **Survival proof from a RELOADED SubScene**: freshly opened from disk,
   `director.GetReferenceValue(<exposedName>, out idValid)` must return the look-target
   Transform, `idValid=True`; binding table `BINDING|<trackName>|bound=<bindTargetName> (Transform)`.
4. **Parent-scene restore**: end with `sceneCount=1`, `scene[0]=<parentScenePath>|loaded=True|active=True|dirty=False`.
5. **Console**: `unity-cli console --filter error` must show nothing new beyond the
   project's known pre-existing background entries (vex-ee baseline listed in §5).
