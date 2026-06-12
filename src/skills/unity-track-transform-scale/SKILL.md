---
name: unity-track-transform-scale
description: Master of BovineLabs TransformScaleTrack + ScaleClip/ScaleStartClip (package com.bovinelabs.timeline.transform) — timeline grow/shrink/squash of SubScene-baked objects, the double-Authoring namespace, the uniform-scale X-collapse trap, and PostTransformMatrix precedence. Portable to any project containing the package; worked example from vex-ee. Use when a designer asks to "grow / shrink / squash this over the timeline".
---

# TransformScaleTrack specialist

## 1. SCOPE

You are the specialist for **`TransformScaleTrack`** and its two clip types **`ScaleClip`**
and **`ScaleStartClip`** from the package `com.bovinelabs.timeline.transform`. Scope:
exactly this track family — authoring the track/clips in a `.playable` TimelineAsset,
wiring a SubScene PlayableDirector, and the runtime scale-write semantics
(PostTransformMatrix vs uniform `LocalTransform.Scale`). Stage construction belongs to
`unity-stage-foundations`; position/rotation to their own track specialists.
Behave per unity-agent-protocol; operate the editor per unity-cli.

## 2. PORTABLE SEMANTICS

True in ANY project containing `com.bovinelabs.timeline.transform`. Provenance tags say
where a fact was PROVEN, not where it applies. (All verified vex-ee 2026-06 via reflection
dumps, package + entities source reads, YAML reads, fresh-load read-backs via `unity-cli exec`.)

**The namespace really is `BovineLabs.Timeline.Transform.Authoring.Authoring.Scale` —
"Authoring" twice** (folder `Authoring/Scale/` nested under the package's `Authoring`
namespace root). Quote it exactly in every exec snippet; type-name guessing fails. Source
`Authoring/Scale/ScaleTrack.cs`; class `TransformScaleTrack`, `[DisplayName("BovineLabs/Timeline/Transform/Scale")]`.

Types (assembly `BovineLabs.Timeline.Transform.Authoring`):

- `BovineLabs.Timeline.Transform.Authoring.Authoring.Scale.TransformScaleTrack : DOTSTrack`
  — `[TrackBindingType(typeof(UnityEngine.Transform))]`, `[TrackClipType(ScaleStartClip)]`,
  `[TrackClipType(ScaleClip)]`, `[TrackColor(0.3f, 0.8f, 0.4f)]`.
- `...Authoring.Scale.ScaleClip : DOTSClip` — `ClipCaps.Blending`;
  `...Authoring.Scale.ScaleStartClip : DOTSClip` — `ClipCaps.Blending`, NO serialized fields.

### TransformScaleTrack fields
| Field | Type | Notes |
|---|---|---|
| `ResetScaleOnDeactivate` | bool | Declared on the track. Bake: `ScaleTrackBuilder.ApplyTo` does `if (ResetScaleOnDeactivate) builder.AddComponent<ScaleState>();` on the TRACK entity → capture on activate, restore on deactivate |
| `resetOnDeactivate` | bool | INHERITED from `DOTSTrack`, serializes separately — distinct field (family pattern, confirmed three for three) |

`ScaleClip` has ONE field: `Scale : Vector3` defaulting to **Vector3.one** (field
initializer) — no Type/Offset/Target modes, no enums (contrast PositionClip's 5 fields).

Bake: `ScaleBuilder` adds `ScaleAnimated { Value = Scale }` to the clip entity, plus
`AddTransformUsageFlags(binding, TransformUsageFlags.Dynamic)`. `ScaleStartClip` bakes
`ScaleStartBuilder` → `ScaleMoveToStart` tag + empty `ScaleAnimated`; `MoveToStartingScaleClipJob`
fills it with the binding's current scale on the activation frame (edge-detected by
`[WithAll(TimelineActive)] [WithNone(TimelineActivePrevious)]`).

### Runtime semantics
`TrackBlendImpl<float3, ScaleAnimated>` gathers all simultaneously active clips per binding
into one weighted float3. `WriteScaleJob` (`Runtime/Scale/ScaleTrackSystem.cs`) writes it
with strict precedence:

```csharp
if (PostTransforms.TryGetRefRW(entity, out var pt))
{
    var m = pt.ValueRO.Value;
    var current = new float3(math.length(m.c0.xyz), math.length(m.c1.xyz), math.length(m.c2.xyz));
    if (current.Equals(float3.zero)) current = new float3(1f);

    pt.ValueRW.Value = float4x4.Scale(JobHelpers.Blend<float3, Float3Mixer>(ref target, current));
}
else if (LocalTransforms.TryGetRefRW(entity, out var lt))
{
    lt.ValueRW.Scale = JobHelpers.Blend<float3, Float3Mixer>(ref target, new float3(lt.ValueRO.Scale)).x;
}
```

- Binding HAS `PostTransformMatrix` → `float4x4.Scale(blend)`, true per-axis scale.
- Binding has NO `PostTransformMatrix` → `LocalTransform.Scale = blend.x` — a single
  uniform float; **Y and Z of your Vector3 are silently discarded**. THE designer trap.
- Whether the matrix exists is decided at BAKE time: Unity's `TransformBaking.cs`
  (com.unity.entities) only emits `PostTransformMatrix` when
  `!IsUniformScale(transformAuthoring.LocalScale)` — then it forces
  `LocalTransform.Scale = 1` and stores `float4x4.Scale(scale)` in the matrix.
- `ScaleState` (added only when `ResetScaleOnDeactivate=true`) is dual-natured: on track
  activation it captures EITHER the full `PostTransformMatrix.Value` float4x4
  (`IsNonUniform = true`) OR the uniform `LocalTransform.Scale` float; deactivation
  restores exactly the kind it captured — never a lossy uniform approximation.

### Traps & DO/DON'T (each proven live, vex-ee 2026-06)

- **DON'T expect per-axis scale on a uniform-scale binding** — a uniform authoring
  localScale bakes NO `PostTransformMatrix`, so the write job reduces the blended float3
  to `.x`: a (1.5,0.5,1.5) squash plays as uniform 1.5 on a plain capsule — no squash, no
  warning, the clip inspector still shows the full Vector3. DO give the binding a
  non-uniform authoring localScale to force the matrix branch (even (1, 1.0001, 1) works,
  though an honest value documents intent). A clip field can be faithfully serialized AND
  baked yet 2/3-discarded depending on the BINDING's baked shape.
- **DON'T assume a fresh ScaleClip is inert OR destructive** — default is Vector3.one
  (verified YAML `Scale: {x: 1, y: 1, z: 1}`): a visual no-op only when the binding's
  current scale IS 1; on an already-scaled entity it animates it back to 1. (Contrast
  PositionClip's (0,0,0) default, which teleports to origin.) Defaults define the no-op direction.
- **DON'T promise "zero scale is safe" or "impossible"** — `(0,0,0)` serializes verbatim,
  nothing clamps targets: at full weight it genuinely writes `float4x4.Scale(0,0,0)` or
  `LocalTransform.Scale = 0`. The runtime clamp protects only CURRENT scale, only in the
  PostTransformMatrix branch, only when ALL THREE column lengths are exactly zero (a single
  zero axis is not clamped), and only as the blend's fill value for uncovered weight. The
  uniform branch has NO clamp at all — a zeroed uniform entity has no recovery.
- **DON'T conflate the two reset bools** — saved YAML shows both `resetOnDeactivate: 1`
  (DOTSTrack base) and `ResetScaleOnDeactivate: 1` (track-declared) side by side; only
  the latter feeds `ScaleTrackBuilder`/`ScaleState`. Set the one you mean.
- **DON'T guess type names** (the double-`Authoring` namespace is real and compiles —
  reflection-verify first per §3.1) and **DON'T read Editor World entity counts as bake
  proof** (0 baked entities for a closed SubScene is normal: streaming `SceneReference`
  only, import is async — proves nothing).
- **DO trust director binding tables across playableAsset swaps** — the table is keyed
  per-track asset and persists in the scene file regardless of which timeline is assigned
  (verified: a prior track's binding survived the swap; both coexisted). UNDO corollary:
  deleting your .playable does NOT remove your binding entry (§6).

## 3. DISCOVERY RECIPES

Act only through `unity-cli exec` / `unity-cli console`; never the filesystem; never play
mode. Follow the unity-cli Safe Loop on every mutation. Names below are parameters —
discover them in THIS project; never assume the worked example (§5).

**3.1 Confirm the package exists (else "no egg" per protocol §6):**
```csharp
var t = System.Type.GetType("BovineLabs.Timeline.Transform.Authoring.Authoring.Scale.TransformScaleTrack, BovineLabs.Timeline.Transform.Authoring");
return t == null ? "NO_EGG|package com.bovinelabs.timeline.transform absent in this project"
    : "OK|" + t.AssemblyQualifiedName + "|dataPath=" + UnityEngine.Application.dataPath;
```

**3.2 Find the active scene + SubScene(s):** run the unity-cli skill's First Command (scene
path, roots, SubScene components → `.unity` paths); record `parentScenePath` + `subScenePath`(s).

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

**3.4 Find/confirm the bind target AND its scale shape** — the track binds a
`UnityEngine.Transform` on a SubScene-baked object. Find candidates by component
(`FindObjectsByType<UnityEngine.Transform>` filtered to the SubScene, or by the designer's
description); confirm with the designer when several are plausible. Then PRINT the
binding's authoring `localScale`: if UNIFORM, per-axis clip values will X-collapse (§2
trap) — for squash/stretch plan recipe 4.2 (the scene object itself must change).

**3.5 Capture the chosen director's existing state — this is pre-state (`PRE|`)**:
```csharp
// PRE|playableAsset=<asset PATH or null>   via AssetDatabase.GetAssetPath(director.playableAsset)
// PRE|binding|<i>|<track name>|<track type>|<bound object hierarchy path + component type, or null>
//   one line per GetOutputTracks() of the CURRENT asset, via director.GetGenericBinding(track).
// PRE|localScale=<binding's current localScale>  capture ALWAYS if recipe 4.2 might run —
//   UNDO-3 restores this exact captured value, never "(1,1,1)".
// Capture the asset PATH and each track's NAME/index even when the table looks empty —
// they make the undo replayable (UNDO-1 reloads the old asset by path, re-binds by name/index).
```
Record these in the undo journal (§6) before any mutation.

**Name resolution rule**: `GameObject.Find` misses inactive objects and is ambiguous on
duplicate names. Discovery (§3.3/3.4) must confirm the chosen name is active and unique in
the SubScene; otherwise walk the SubScene's root objects to the recorded hierarchy path (or
`FindObjectsByType` filtered by `scene`) instead of `Find`.

## 4. CANONICAL RECIPES

One logical change per exec block; each block prints its `PRE|` capture before mutating
(protocol §2), saves inside the block, and is verified from a fresh load (§7).

**4.1 Create timeline + track + clips, then wire the director:**

```csharp
// ---- parameters (discovered in §3 / chosen with designer) ----
var parentScenePath = "<DISCOVERED>"; var subScenePath = "<DISCOVERED>";        // §3.2
var directorGoPath = "<DISCOVERED>"; var bindTargetPath = "<DISCOVERED>"; // §3.3 / §3.4 hierarchy paths
var assetFolder = "<CHOSEN>"; var assetPath = assetFolder + "/<Name>.playable"; var trackName = "<CHOSEN>";

var parentScene = UnityEditor.SceneManagement.EditorSceneManager.GetActiveScene();
var subScene = UnityEditor.SceneManagement.EditorSceneManager.OpenScene(
    subScenePath, UnityEditor.SceneManagement.OpenSceneMode.Additive);
UnityEditor.SceneManagement.EditorSceneManager.SetActiveScene(subScene);
try {
    // CAPTURE (print + journal): PRE|folderExisted=<bool> PRE|assetExisted=<bool>
    var folderExisted = UnityEditor.AssetDatabase.IsValidFolder(assetFolder);
    if (!folderExisted) { /* CreateFolder for each missing segment of assetFolder */ }
    // 1. Timeline asset + track (NOTE the double-Authoring namespace, quote exactly)
    var timeline = UnityEngine.ScriptableObject.CreateInstance<UnityEngine.Timeline.TimelineAsset>();
    UnityEditor.AssetDatabase.CreateAsset(timeline, assetPath);
    var track = timeline.CreateTrack<BovineLabs.Timeline.Transform.Authoring.Authoring.Scale.TransformScaleTrack>(null, trackName);
    track.ResetScaleOnDeactivate = true; // restore the binding's pre-track scale on deactivate
    // 2. Grow: uniform scale-up (values/timings are example choices, not package constants)
    var clipA = track.CreateClip<BovineLabs.Timeline.Transform.Authoring.Authoring.Scale.ScaleClip>();
    clipA.start = 0; clipA.duration = 2; clipA.displayName = "<clipName>";
    ((BovineLabs.Timeline.Transform.Authoring.Authoring.Scale.ScaleClip)clipA.asset).Scale = new UnityEngine.Vector3(2f, 2f, 2f); // <CHOSEN>
    // 3. Squash, blended in over the overlap with A. WARNING (§2 trap): per-axis values
    //    only work if the binding bakes a PostTransformMatrix; uniform binding uses X only.
    var clipB = track.CreateClip<BovineLabs.Timeline.Transform.Authoring.Authoring.Scale.ScaleClip>();
    clipB.start = 1.5; clipB.duration = 2; clipB.displayName = "<clipName>";
    ((BovineLabs.Timeline.Transform.Authoring.Authoring.Scale.ScaleClip)clipB.asset).Scale = new UnityEngine.Vector3(1.5f, 0.5f, 1.5f); // <CHOSEN>
    clipB.blendInDuration = 0.5; // explicit blendIn on the LATER clip => mirrored blendOut on A
    // 4. Ease back to the size the binding had when THIS clip activates
    var clipC = track.CreateClip<BovineLabs.Timeline.Transform.Authoring.Authoring.Scale.ScaleStartClip>();
    clipC.start = 3.5; clipC.duration = 1.5; clipC.displayName = "<clipName>";

    foreach (var o in new UnityEngine.Object[] { timeline, track, (UnityEngine.Object)clipA.asset, (UnityEngine.Object)clipB.asset, (UnityEngine.Object)clipC.asset })
        UnityEditor.EditorUtility.SetDirty(o);
    UnityEditor.AssetDatabase.SaveAssets();
    // 5. Wire the director (binding table lives in the SCENE file -> persists fine; other
    //    timelines' bindings survive swaps). CAPTURE BEFORE mutating: the §3.5 PRE| lines.
    var director = UnityEngine.GameObject.Find(directorGoPath).GetComponent<UnityEngine.Playables.PlayableDirector>(); // per Name resolution rule
    director.playableAsset = timeline;
    director.SetGenericBinding(track, UnityEngine.GameObject.Find(bindTargetPath).GetComponent<UnityEngine.Transform>());
    UnityEditor.EditorUtility.SetDirty(director);
    UnityEditor.SceneManagement.EditorSceneManager.SaveScene(subScene);
    return "OK|" + assetPath;
} finally {
    UnityEditor.SceneManagement.EditorSceneManager.SetActiveScene(parentScene);
    UnityEditor.SceneManagement.EditorSceneManager.CloseScene(subScene, false);
    UnityEditor.SceneManagement.EditorSceneManager.OpenScene(parentScenePath, UnityEditor.SceneManagement.OpenSceneMode.Single);
}
```

**4.2 OPTIONAL — force the per-axis (PostTransformMatrix) branch** when the designer wants
real squash/stretch on a uniform-scale binding (§2 bake rule; proven live with (1,1.2,1),
then reverted). Mutates the SCENE object; separate block, SubScene bracket as in 4.1:

```csharp
// PRE|localScale=<CAPTURED current value>   (print + journal - UNDO-3 restores it)
var actor = UnityEngine.GameObject.Find("<bindTargetPath>");
actor.transform.localScale = new UnityEngine.Vector3(1f, 1.2f, 1f); // <CHOSEN, non-uniform>
UnityEditor.SceneManagement.EditorSceneManager.SaveScene(actor.scene);
// verify per §7 from a fresh load: saved scene YAML must show the non-uniform m_LocalScale
```

## 5. WORKED EXAMPLE (vex-ee training stage) — example environment; rediscover, never assume

- Project: `/home/i/GitHub/vex-ee` (`dataPath=/home/i/GitHub/vex-ee/Assets`); parent
  scene `Assets/Scenes/Main Scene.unity`; SubScene `Assets/Scenes/Main Sub Scene.unity`.
- Stage (built by unity-stage-foundations): `TrainingStage` root with `Stage_Director`
  (PlayableDirector + TimelineReferenceAuthoring, the only director), `Stage_Target` (cube
  at (5,0,0)), `Stage_LinkRoot/Stage_Actor` (capsule at (0,1,0), localScale (1,1,1) — the
  binding; uniform, so the X-collapse case applies).
- Asset built: `Assets/Training/02-transform-scale-track/ScaleMastery.playable` — track
  `ScaleTrack` (`ResetScaleOnDeactivate: 1`, inherited `resetOnDeactivate: 1`), clips
  A_Double 0–2s Scale (2,2,2) / B_Squash 1.5–3.5s Scale (1.5,0.5,1.5) `blendIn=0.5`
  (mirrored computed `blendOut=0.5` on A) / C_BackToStart 3.5–5s ScaleStartClip. Exactly
  3 clips — temp clips (TMP_Fresh, the (0,0,0) demo) removed, verified from fresh load.
- Director wiring: `BEFORE|playableAsset=PositionMastery` captured pre-swap;
  `binding[ScaleTrack]=Stage_Actor (Transform)` added; lesson 01's `binding[PositionTrack]`
  SURVIVED the swap. Session end: playableAsset RESTORED to `PositionMastery.playable`;
  both bindings remain in the table.
- The 4.2 demo ran here: Stage_Actor localScale (1,1,1) → (1,1.2,1) (saved YAML
  `m_LocalScale: {x: 1, y: 1.2, z: 1}`) → REVERTED to (1,1,1), verified via saved-YAML
  grep (zero non-uniform lines) + fresh load. Stage left in the uniform case.
- Known pre-existing vex-ee console background entries: UnityCliConnector HTTP server
  start, PerformanceTesting IPrebuildSetup/IPostBuildCleanup, TestResults.xml save.

## 6. UNDO APPENDIX

Artifact inventory for one run of §4 (vex-ee instance shown in §5):
1. Created asset `<assetPath>` (.playable: TimelineAsset + 1 track + 3 clip sub-assets —
   `DeleteAsset` removes all sub-assets with the file).
2. Possibly-created folder(s) `<assetFolder>` (vex-ee: the IsValidFolder branch created
   `02-transform-scale-track`; `EXPECTED:` it did not pre-exist — `PRE|folderExisted` was
   never printed in training; capture it yourself per §4.1).
3. Mutated `director.playableAsset` (vex-ee capture: `BEFORE|playableAsset=PositionMastery`).
4. Added generic-binding entry for the new track (SubScene file; keyed by track asset;
   survives asset swaps AND asset deletion — must be cleared explicitly).
5. Only if recipe 4.2 ran: mutated the binding's authoring `localScale` (restore the
   CAPTURED `PRE|localScale` — never assume (1,1,1); the pre-state might be non-uniform).

ORDER: restore the director FIRST (clear MY binding, restore captured playableAsset, save
scene) so nothing in the scene references the asset, THEN delete the asset, THEN restore
remaining captured scene values (the 4.2 localScale) — deleting the asset while the
director still points at it would leave a dangling `{fileID: 0}`-style reference.

Journal entry templates (protocol §5 — fill from YOUR captures, reverse order):

```csharp
// UNDO-1: restore director's captured playableAsset + binding table (SubScene bracket)
var parentScenePath = "<CAPTURED>"; var subScenePath = "<CAPTURED>"; var directorGoPath = "<CAPTURED>"; var assetPath = "<CAPTURED>";
var parentScene = UnityEditor.SceneManagement.EditorSceneManager.GetActiveScene();
var subScene = UnityEditor.SceneManagement.EditorSceneManager.OpenScene(
    subScenePath, UnityEditor.SceneManagement.OpenSceneMode.Additive);
UnityEditor.SceneManagement.EditorSceneManager.SetActiveScene(subScene);
try {
    var director = UnityEngine.GameObject.Find(directorGoPath).GetComponent<UnityEngine.Playables.PlayableDirector>();
    var myAsset = UnityEditor.AssetDatabase.LoadAssetAtPath<UnityEngine.Timeline.TimelineAsset>(assetPath);
    foreach (var tr in myAsset.GetOutputTracks()) director.ClearGenericBinding(tr); // MY entries
    // restore each CAPTURED pre-existing binding (PRE|binding| lines; none if table was empty): reload the PREVIOUS playable by captured path, match tracks by name/index.
    director.playableAsset = null /* or AssetDatabase.LoadAssetAtPath<UnityEngine.Playables.PlayableAsset>("<CAPTURED pre path>") */; // CAPTURED value, never "default"
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
// UNDO-3: only if recipe 4.2 ran — restore the binding's CAPTURED localScale (SubScene
// bracket as in UNDO-1). VERIFIED inversion: the vex-ee demo was reverted exactly this
// way and confirmed via saved-YAML grep + fresh load.
var actor = UnityEngine.GameObject.Find("<CAPTURED bindTargetPath>");
actor.transform.localScale = new UnityEngine.Vector3(/* CAPTURED PRE|localScale */ 1f, 1f, 1f);
UnityEditor.SceneManagement.EditorSceneManager.MarkSceneDirty(actor.scene);
UnityEditor.SceneManagement.EditorSceneManager.SaveScene(actor.scene);
return "UNDONE|localScale restored";
```

UNDO-4 (verification, fresh load — protocol §7): reload the SubScene additively; print
`director.playableAsset`, the binding table and the binding's `localScale` (all must
equal the CAPTURED `PRE|` values); grep the saved scene YAML for stray non-captured
`m_LocalScale` lines; confirm `AssetDatabase.LoadAssetAtPath<UnityEngine.Object>(assetPath)
== null`; restore the parent scene; `unity-cli console --filter error` clean against baseline.

vex-ee note: training left artifacts 1, 2, 4 in place (asset, folder, ScaleTrack binding),
playableAsset already restored, 4.2 demo already reverted — undo = UNDO-1 (binding clear) + UNDO-2.

## 7. VERIFICATION PROTOCOL

1. **Fresh-load asset dump**: in a new exec block, `AssetDatabase.LoadAssetAtPath` the
   `.playable` at `<assetPath>`; dump every track/clip (name, start/duration, blendIn/blendOut,
   caps, asset type, `Scale` values, both reset fields) and the CLIP COUNT — temp clips
   must be gone. In-memory state is not evidence.
2. **Raw YAML check**: read the `.playable` text for the `Scale: {x: …, y: …, z: …}`
   values and the two reset keys; read the SubScene YAML and confirm the binding's
   `m_LocalScale` is exactly what discovery captured (or what 4.2 set) — no stray scale
   mutations on other objects.
3. **Binding table from a RELOADED SubScene**: expect
   `BINDING|<trackName>|bound=<bindTargetName> (Transform)`; pre-existing bindings from
   other timelines must still be present (they survive swaps).
4. **Director restore discipline**: if you swapped `playableAsset` only for a test session,
   restore the captured asset and verify from a fresh SubScene load.
5. **Parent-scene restore**: end with `sceneCount=1`, `scene[0]=<parentScenePath>|loaded=True|active=True|dirty=False`.
6. **Console**: `unity-cli console --filter error` must show nothing new beyond the project's known pre-existing background entries (vex-ee baseline in §5).
