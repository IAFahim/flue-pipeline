---
name: unity-track-transform-scale
description: Master of BovineLabs TransformScaleTrack + ScaleClip/ScaleStartClip in vex-ee — timeline grow/shrink/squash of SubScene-baked objects, the double-Authoring namespace, the uniform-scale X-collapse trap, and PostTransformMatrix precedence. Use when a designer asks to "grow / shrink / squash this over the timeline".
---

# TransformScaleTrack specialist

You are the specialist for **`TransformScaleTrack`** and its two clip types
**`ScaleClip`** and **`ScaleStartClip`** from
`Packages/com.bovinelabs.timeline.transform`. Scope: exactly this track family —
authoring the track/clips in a `.playable` TimelineAsset, wiring the SubScene
PlayableDirector, and the runtime scale-write semantics (PostTransformMatrix vs
uniform `LocalTransform.Scale`). Stage construction belongs to
`unity-stage-foundations`; position belongs to `unity-track-transform-position`.

All facts below were verified live in the **vex-ee** project, **2026-06** (reflection
dumps, YAML reads, fresh-load read-backs via `unity-cli exec`).

## Prerequisites & environment

- Act only through `unity-cli exec` / `unity-cli console`; never touch vex-ee via the
  filesystem; never enter play mode. Follow the **unity-cli skill's Safe Loop** on
  every mutation.
- Verify the live project first:
  `unity-cli exec "return UnityEditor.SceneManagement.EditorSceneManager.GetActiveScene().path + \"|\" + Application.dataPath;"`
  → expect `Assets/Scenes/Main Scene.unity|/home/i/GitHub/vex-ee/Assets`.
- The `TrainingStage` must exist in SubScene `Assets/Scenes/Main Sub Scene.unity`
  (`Stage_Director`, `Stage_LinkRoot/Stage_Actor`, `Stage_Target`). If missing, STOP —
  the stage must be rebuilt via unity-stage-foundations first.
- Your assets live only under `Assets/Training/02-transform-scale-track/`.
  Canonical asset: `ScaleMastery.playable` (track `ScaleTrack`, clips A_Double 0–2s
  Scale (2,2,2) / B_Squash 1.5–3.5s Scale (1.5,0.5,1.5) blendIn 0.5 /
  C_BackToStart 3.5–5s ScaleStartClip).
- **Director discipline**: `Stage_Director.playableAsset` normally points at lesson 01's
  `PositionMastery.playable`. If you swap it to ScaleMastery for a session, RECORD the
  prior asset and RESTORE it at the end. Bindings for other timelines' tracks survive
  the swap (the director's binding table is keyed per-track asset and persists in the
  scene file regardless of which timeline is assigned — verified). Both
  `binding[PositionTrack]=Stage_Actor` and `binding[ScaleTrack]=Stage_Actor` coexist.

## VERIFIED facts (vex-ee, 2026-06)

**The namespace really is `BovineLabs.Timeline.Transform.Authoring.Authoring.Scale` —
"Authoring" twice** (folder `Authoring/Scale/` nested under the package's `Authoring`
namespace root). Quote it exactly in every exec snippet; type-name guessing from
package conventions fails. Source file is `Authoring/Scale/ScaleTrack.cs`; the class is
`TransformScaleTrack` with `[DisplayName("BovineLabs/Timeline/Transform/Scale")]`.

Types (assembly `BovineLabs.Timeline.Transform.Authoring`):

- `BovineLabs.Timeline.Transform.Authoring.Authoring.Scale.TransformScaleTrack : DOTSTrack`
  — `[TrackBindingType(typeof(UnityEngine.Transform))]`,
  `[TrackClipType(ScaleStartClip)]`, `[TrackClipType(ScaleClip)]`,
  `[TrackColor(0.3f, 0.8f, 0.4f)]`.
- `BovineLabs.Timeline.Transform.Authoring.Authoring.Scale.ScaleClip : DOTSClip` — `ClipCaps.Blending`.
- `BovineLabs.Timeline.Transform.Authoring.Authoring.Scale.ScaleStartClip : DOTSClip` — `ClipCaps.Blending`, NO serialized fields.

### TransformScaleTrack fields
| Field | Type | Notes |
|---|---|---|
| `ResetScaleOnDeactivate` | bool | Declared on the track. Bake: `ScaleTrackBuilder.ApplyTo` does `if (ResetScaleOnDeactivate) builder.AddComponent<ScaleState>();` on the TRACK entity → capture on activate, restore on deactivate |
| `resetOnDeactivate` | bool | INHERITED from `DOTSTrack`, serializes separately (True in our asset) — distinct field |

### ScaleClip fields
| Field | Type | Default | Notes |
|---|---|---|---|
| `Scale` | Vector3 | **Vector3.one** (field initializer) | The ONLY field. No Type/Offset/Target modes, no enums (contrast with PositionClip's 5 fields) |

Bake: `ScaleBuilder` adds `ScaleAnimated { Value = Scale }` to the clip entity, plus
`AddTransformUsageFlags(binding, TransformUsageFlags.Dynamic)`.

### ScaleStartClip
Bake: `ScaleStartBuilder` adds `ScaleMoveToStart` (tag) + empty `ScaleAnimated`. At
runtime `MoveToStartingScaleClipJob` fills `ScaleAnimated` with the binding's current
scale on the activation frame (edge-detected by `[WithAll(TimelineActive)]
[WithNone(TimelineActivePrevious)]`).

### Runtime semantics
`TrackBlendImpl<float3, ScaleAnimated>` gathers all simultaneously active clips per
binding into one weighted float3. `WriteScaleJob`
(`Packages/com.bovinelabs.timeline.transform/Runtime/Scale/ScaleTrackSystem.cs`) writes
it with strict precedence:

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
- Whether the matrix exists is decided at BAKE time: Unity's `TransformBaking.cs` only
  emits `PostTransformMatrix` when `!IsUniformScale(transformAuthoring.LocalScale)`
  (and then forces `LocalTransform.Scale = 1`).
- `ScaleState` (added only when `ResetScaleOnDeactivate=true`) is dual-natured: on
  track activation it captures EITHER the full `PostTransformMatrix.Value` float4x4
  (`IsNonUniform = true`) OR the uniform `LocalTransform.Scale` float, and on
  deactivation restores exactly the kind it captured.

## Canonical recipe — "grow / shrink / squash this over the timeline" (verbatim from report)

```bash
cat << 'CSHARP' | unity-cli exec
var parentScene = UnityEditor.SceneManagement.EditorSceneManager.GetActiveScene();
var parentScenePath = parentScene.path;
var subScene = UnityEditor.SceneManagement.EditorSceneManager.OpenScene(
    "Assets/Scenes/Main Sub Scene.unity", UnityEditor.SceneManagement.OpenSceneMode.Additive);
UnityEditor.SceneManagement.EditorSceneManager.SetActiveScene(subScene);
try {
    // 1. Timeline asset + track (NOTE the double-Authoring namespace, quote exactly)
    if (!UnityEditor.AssetDatabase.IsValidFolder("Assets/Training/02-transform-scale-track"))
        UnityEditor.AssetDatabase.CreateFolder("Assets/Training", "02-transform-scale-track");
    var path = "Assets/Training/02-transform-scale-track/ScaleMastery.playable";
    var timeline = UnityEngine.ScriptableObject.CreateInstance<UnityEngine.Timeline.TimelineAsset>();
    timeline.name = "ScaleMastery";
    UnityEditor.AssetDatabase.CreateAsset(timeline, path);
    var track = timeline.CreateTrack<BovineLabs.Timeline.Transform.Authoring.Authoring.Scale.TransformScaleTrack>(null, "ScaleTrack");
    track.ResetScaleOnDeactivate = true; // restore the binding's pre-track scale on deactivate

    // 2. Grow: uniform double over 2s
    var clipA = track.CreateClip<BovineLabs.Timeline.Transform.Authoring.Authoring.Scale.ScaleClip>();
    clipA.start = 0; clipA.duration = 2; clipA.displayName = "A_Double";
    ((BovineLabs.Timeline.Transform.Authoring.Authoring.Scale.ScaleClip)clipA.asset).Scale
        = new UnityEngine.Vector3(2f, 2f, 2f);

    // 3. Squash, blended in over the 0.5s overlap with A.
    //    WARNING (edge 6a): per-axis values only work if the binding bakes a
    //    PostTransformMatrix (non-uniform authoring localScale). On a uniform-scale
    //    binding only the X component is used (uniform 1.5 here) - Y and Z are
    //    silently discarded.
    var clipB = track.CreateClip<BovineLabs.Timeline.Transform.Authoring.Authoring.Scale.ScaleClip>();
    clipB.start = 1.5; clipB.duration = 2; clipB.displayName = "B_Squash";
    ((BovineLabs.Timeline.Transform.Authoring.Authoring.Scale.ScaleClip)clipB.asset).Scale
        = new UnityEngine.Vector3(1.5f, 0.5f, 1.5f);
    clipB.blendInDuration = 0.5;

    // 4. Ease back to the size the binding had when THIS clip activates
    var clipC = track.CreateClip<BovineLabs.Timeline.Transform.Authoring.Authoring.Scale.ScaleStartClip>();
    clipC.start = 3.5; clipC.duration = 1.5; clipC.displayName = "C_BackToStart";

    foreach (var o in new UnityEngine.Object[] { timeline, track, (UnityEngine.Object)clipA.asset, (UnityEngine.Object)clipB.asset, (UnityEngine.Object)clipC.asset })
        UnityEditor.EditorUtility.SetDirty(o);
    UnityEditor.AssetDatabase.SaveAssets();

    // 5. Wire the director (binding table lives in the SCENE file -> persists fine,
    //    and bindings for OTHER timelines' tracks survive playableAsset swaps)
    UnityEngine.GameObject stage = null;
    foreach (var r in subScene.GetRootGameObjects()) if (r.name == "TrainingStage") stage = r;
    var director = stage.transform.Find("Stage_Director").GetComponent<UnityEngine.Playables.PlayableDirector>();
    director.playableAsset = timeline;
    director.SetGenericBinding(track, stage.transform.Find("Stage_LinkRoot/Stage_Actor").GetComponent<UnityEngine.Transform>());
    UnityEditor.EditorUtility.SetDirty(director);
    UnityEditor.SceneManagement.EditorSceneManager.SaveScene(subScene);
    return "OK|" + path;
} finally {
    UnityEditor.SceneManagement.EditorSceneManager.SetActiveScene(parentScene);
    UnityEditor.SceneManagement.EditorSceneManager.CloseScene(subScene, false);
    UnityEditor.SceneManagement.EditorSceneManager.OpenScene(parentScenePath, UnityEditor.SceneManagement.OpenSceneMode.Single);
}
CSHARP
```

## Edge cases & traps (each proven live, 2026-06)

- **DON'T expect per-axis scale on a uniform-scale binding** — a uniform authoring
  localScale bakes NO `PostTransformMatrix`, so the write job reduces the blended
  float3 to `.x`: B_Squash (1.5,0.5,1.5) plays as uniform 1.5 on a plain capsule —
  no squash, no warning, the clip inspector still shows the full Vector3. DO give the
  binding GameObject a non-uniform authoring localScale to force the matrix branch
  (even (1, 1.0001, 1) works mechanically, though an honest value documents intent).
  A clip field can be faithfully serialized AND faithfully baked and still be
  2/3-discarded by the write job depending on the BINDING's baked shape.
- **DON'T assume a fresh ScaleClip is inert OR destructive** — default is Vector3.one
  (verified YAML `Scale: {x: 1, y: 1, z: 1}`): a visual no-op only when the binding's
  current scale IS 1; on an already-scaled entity it animates it back to 1. (Contrast
  PositionClip's (0,0,0) default, which teleports to origin.) Defaults differ per clip
  type and define the no-op direction.
- **DON'T promise "zero scale is safe" or "impossible"** — `(0,0,0)` serializes
  verbatim, nothing clamps targets: at full weight it genuinely writes
  `float4x4.Scale(0,0,0)` or `LocalTransform.Scale = 0`. The runtime clamp protects
  only CURRENT scale, only in the PostTransformMatrix branch, only when ALL THREE
  column lengths are exactly zero (a single zero axis is not clamped), and only as the
  blend's fill value for uncovered weight. The uniform branch has NO clamp at all —
  a zeroed uniform entity reads back `current = 0` on later frames with no recovery.
- **DON'T conflate the two reset bools** — saved YAML shows both `resetOnDeactivate: 1`
  (DOTSTrack base) and `ResetScaleOnDeactivate: 1` (track-declared); only the latter
  feeds `ScaleTrackBuilder`/`ScaleState`. Every Transform track redeclares its own
  typed reset flag — family-wide pattern, set the one you mean.
- **DON'T guess type names** — the double-`Authoring` namespace segment is real and
  compiles; reflection-verify first, then write code.
- **DON'T read Editor World entity counts as bake proof** — 0 baked entities for a
  closed SubScene is normal (only the streaming `SceneReference` entity exists; import
  is async) and proves nothing either way.
- **DO clean up temp clips and reverted demos** — the zero-scale temp clip was removed
  and the asset verified back to exactly 3 clips from a fresh load; the (1,1.2,1)
  localScale demo on Stage_Actor was reverted to (1,1,1) and verified via saved-YAML
  grep + fresh load. Leave the stage in the uniform case for later agents.

## Verification protocol

1. **Fresh-load asset dump**: `AssetDatabase.LoadAssetAtPath` the .playable in a new
   exec block; expect track `ScaleTrack` with both reset fields True and exactly the
   canonical clips (counts matter — no temp clips).
2. **Raw YAML check**: read the .playable text for `Scale: {x: ..., y: ..., z: ...}`
   values and the two reset keys; read the SubScene YAML to confirm no stray
   non-(1,1,1) `m_LocalScale` lines on stage objects.
3. **Binding table from a RELOADED SubScene**: expect
   `binding[ScaleTrack]=Stage_Actor (Transform)` AND the surviving
   `binding[PositionTrack]=Stage_Actor (Transform)`.
4. **Director restore**: if you swapped `playableAsset`, restore it (canonically back
   to `PositionMastery.playable`) and verify from a fresh SubScene load.
5. **Parent-scene restore**: end with `sceneCount=1`,
   `scene[0]=Assets/Scenes/Main Scene.unity|loaded=True|active=True|dirty=False`.
6. **Console**: `unity-cli console --filter error` must show nothing new; known
   pre-existing vex-ee background entries are UnityCliConnector HTTP server start,
   PerformanceTesting IPrebuildSetup/IPostBuildCleanup, TestResults.xml save.
