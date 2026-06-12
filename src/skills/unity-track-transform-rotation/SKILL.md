---
name: unity-track-transform-rotation
description: Master of BovineLabs TransformRotationTrack + RotationLookAtTargetClip/RotationLookAtStartClip in vex-ee — the two-sided ExposedReference wiring (asset GUID + director scene table), every-frame look-at vs first-frame orientation capture, NaN look-direction traps, and reset semantics. Use when a designer asks to "make it face / track / turn back".
---

# TransformRotationTrack specialist

You are the specialist for **`TransformRotationTrack`** and its two clip types
**`RotationLookAtTargetClip`** and **`RotationLookAtStartClip`** from
`Packages/com.bovinelabs.timeline.transform`. Scope: exactly this track family —
authoring the track/clips in a `.playable` TimelineAsset, the **two-sided
ExposedReference wiring** (the canonical pattern for ALL ExposedReference tracks),
and the runtime quaternion-blending/look-at semantics. Stage construction belongs
to `unity-stage-foundations`; position to `unity-track-transform-position`; scale
to `unity-track-transform-scale`.

All facts below were verified live in the **vex-ee** project, **2026-06** (reflection
dumps, package-source reads, YAML reads of both .playable and .unity files,
fresh-load read-backs via `unity-cli exec`).

## Prerequisites & environment

- Act only through `unity-cli exec` / `unity-cli console`; never touch vex-ee via the
  filesystem; never enter play mode. Follow the **unity-cli skill's Safe Loop** on every
  mutation.
- Verify the live project first:
  `unity-cli exec "return UnityEditor.SceneManagement.EditorSceneManager.GetActiveScene().path + \"|\" + Application.dataPath;"`
  → expect `Assets/Scenes/Main Scene.unity|/home/i/GitHub/vex-ee/Assets`.
- The `TrainingStage` (built by unity-stage-foundations) must exist in SubScene
  `Assets/Scenes/Main Sub Scene.unity`: `Stage_Director` (PlayableDirector +
  TimelineReferenceAuthoring), `Stage_LinkRoot/Stage_Actor` (capsule, the binding),
  `Stage_Target` (cube at (5,0,0), the look-at target). If missing, STOP and have the
  stage rebuilt first.
- Your assets live only under `Assets/Training/03-transform-rotation-track/`.
  Canonical asset: `RotationMastery.playable` (track `RotationTrack`,
  `ResetRotationOnDeactivate: 1`, clips A_LookAtTarget 0–2.5s / B_BackToStart 2–4s
  `blendIn=0.5`; clip A `exposedName: cca01140-fc94-4eda-9c0d-77166bb79c6a`, wired to
  Stage_Target's Transform in the director's table).

## VERIFIED facts (vex-ee, 2026-06)

Types (assembly `BovineLabs.Timeline.Transform.Authoring`):

- `BovineLabs.Timeline.Transform.Authoring.TransformRotationTrack : DOTSTrack`
  — `[TrackBindingType(typeof(UnityEngine.Transform))]`,
  `[TrackClipType(RotationLookAtTargetClip)]`, `[TrackClipType(RotationLookAtStartClip)]`,
  `[TrackColor(0.85, 0.30, 0.70)]`, `[DisplayName("BovineLabs/Timeline/Transform/Rotation")]`.
- `BovineLabs.Timeline.Transform.Authoring.RotationLookAtTargetClip : DOTSClip` — `ClipCaps.Blending`.
- `BovineLabs.Timeline.Transform.Authoring.RotationLookAtStartClip : DOTSClip` — `ClipCaps.Blending`, NO serialized fields.

**NAME-COLLISION TRAP**: `BovineLabs.Vibe.Authoring.LocalTransform` declares clips with
the SAME short names (`RotationLookAtTargetClip`/`RotationLookAtStartClip`, base
`RotationClipBase`, completely different fields: `target : BovineLabs.Reaction.Data.Core.Target`,
`fixedRotation`, `offset`, `anchorPoint`). Always use fully qualified
`BovineLabs.Timeline.Transform.Authoring.*` names in exec blocks and reflection sweeps.

### TransformRotationTrack fields
| Field | Type | Notes |
|---|---|---|
| `ResetRotationOnDeactivate` | bool | Declared on the track; bakes `RotationState{quaternion Value}` on the track entity → capture binding rotation on track activate, restore on deactivate |
| `resetOnDeactivate` | bool | INHERITED from `DOTSTrack` base, serializes separately — do not confuse the two (family pattern, confirmed three for three) |

### RotationLookAtTargetClip fields
| Field | Type | Default | Notes |
|---|---|---|---|
| `Target` | `ExposedReference<Transform>` | `exposedName` empty, `defaultValue {fileID: 0}` | NOT a plain object field — see the wiring sequence below |

Bake path (quoted from
`Packages/com.bovinelabs.timeline.transform/Authoring/Rotation/RotationLookAtTargetClip.cs`):

```csharp
UnityEngine.Transform target = null;
if (context.Director != null)
    target = context.Director.GetReferenceValue(Target.exposedName, out _) as UnityEngine.Transform;
var builder = new RotationLookAtTargetBuilder
{
    Target = context.Baker.GetEntity(target, TransformUsageFlags.Dynamic)
};
```

### RotationLookAtStartClip fields
No serialized fields. Bakes `RotationLookAtStartBuilder` → `RotationLookAtStart` tag.

### Runtime semantics
Each clip bakes to its own entity carrying `RotationAnimated` (the quaternion the clip
wants the binding at). LookAtTarget entities also carry `RotationLookAtTarget{Entity Target}`;
`LookAtTargetClipJob` runs EVERY active frame, recomputing
`quaternion.LookRotation(targetPos - bindingPos, math.up())` — the binding's +Z
continuously tracks a moving target, silently skipping any frame where either entity
lacks `LocalTransform` (`if (!LocalTransforms.TryGetComponent(rotationLookAtTarget.Target, out var lt)) return;`),
and producing NaN if the look direction is zero or vertical (no guard in source).
LookAtStart entities are edge-gated (`[WithAll(TimelineActive)] [WithNone(TimelineActivePrevious)]`):
the job fires on exactly the FIRST active frame, freezing the binding's current rotation
into `RotationAnimated`; blending toward it turns the object back to its clip-start
orientation without moving it. `TrackBlendImpl<quaternion, RotationAnimated>` weights all
simultaneously active clips per binding through `QuaternionMixer` — `math.nlerp` for
weighted mixing (cheap, non-constant angular velocity, fine for short blends) and
`math.mul` for additive composition — and `WriteRotationJob` writes the result into
`LocalTransform.Rotation`, flipping the `ActiveRotation` enableable marker.
`ResetRotationOnDeactivate=true` bakes `RotationState`: `ActivateResetJob` captures
`LocalTransform.Rotation` on the track's first active frame, `DeactivateResetJob`
restores it on deactivation; without it the binding keeps the last blended orientation.

## THE ExposedReference wiring sequence (CANONICAL for ALL ExposedReference tracks)

ExposedReference is the asset→scene escape hatch and it is TWO-SIDED: the .playable
stores ONLY a GUID string (`exposedName`); the object reference lives in the scene
PlayableDirector's `m_ExposedReferences` table, which serializes WITH the SubScene as a
scene-local fileID. Asset holds the name; scene holds the object. That division of
ownership is the entire mechanism — and why the link SURVIVES save/reload while plain
object fields (lesson 01's `PositionClip.Target`) die to `{fileID: 0}`.

Order matters; execute in ONE SubScene-bracketed mutation block:

1. Open the SubScene additively, set active (the director lives there).
2. `director.playableAsset = rotationTimeline;` and
   `director.SetGenericBinding(rotTrack, stageActor.transform);`
3. **Mint the GUID name on the CLIP ASSET** (the .playable side):
   ```csharp
   var guid = System.Guid.NewGuid().ToString();
   var exposedName = new UnityEngine.PropertyName(guid);
   clipAsset.Target = new UnityEngine.ExposedReference<UnityEngine.Transform> { exposedName = exposedName };
   UnityEditor.EditorUtility.SetDirty(clipAsset);
   UnityEditor.AssetDatabase.SaveAssets();          // saves the .playable
   ```
4. **Register the scene-side table entry on the DIRECTOR** (the .unity side):
   ```csharp
   director.SetReferenceValue(exposedName, stageTarget.GetComponent<UnityEngine.Transform>());
   UnityEditor.EditorUtility.SetDirty(director);
   UnityEditor.SceneManagement.EditorSceneManager.SaveScene(subScene);   // saves the table
   ```
5. Close SubScene, reopen parent Single. Verify from FRESH loads (protocol below).

TWO saves are required, one per side. `SetReferenceValue` BEFORE saving the .playable is
fine, but the scene save is what persists the table — forgetting it silently loses the
object side while the GUID side looks fine. On-disk proof of both sides:

```
# .playable (clip side):
  Target:
    exposedName: cca01140-fc94-4eda-9c0d-77166bb79c6a
    defaultValue: {fileID: 0}
# .unity (director side):
  m_ExposedReferences:
    m_References:
    - cca01140-fc94-4eda-9c0d-77166bb79c6a: {fileID: 311820019}   # Stage_Target's Transform
```

Survival proof (fresh SubScene reload after full close):
`FRESH|GetReferenceValue=Stage_Target (UnityEngine.Transform)|idValid=True`.

## Canonical recipe — "make it face the target, then turn back" (verbatim from report)

```bash
cat << 'CSHARP' | unity-cli exec
// ExposedReference wiring REQUIRES the SubScene open: the director owns the table.
var parentScene = UnityEditor.SceneManagement.EditorSceneManager.GetActiveScene();
var parentScenePath = parentScene.path;
var subScene = UnityEditor.SceneManagement.EditorSceneManager.OpenScene(
    "Assets/Scenes/Main Sub Scene.unity", UnityEditor.SceneManagement.OpenSceneMode.Additive);
UnityEditor.SceneManagement.EditorSceneManager.SetActiveScene(subScene);
try {
    // 1. Timeline asset + track (FULL namespace - a Vibe clip shares the short name!)
    var path = "Assets/Training/03-transform-rotation-track/RotationMastery.playable";
    var timeline = UnityEngine.ScriptableObject.CreateInstance<UnityEngine.Timeline.TimelineAsset>();
    timeline.name = "RotationMastery";
    UnityEditor.AssetDatabase.CreateAsset(timeline, path);
    var track = timeline.CreateTrack<BovineLabs.Timeline.Transform.Authoring.TransformRotationTrack>(null, "RotationTrack");
    track.ResetRotationOnDeactivate = true;   // snap back to pre-track rotation on deactivate

    // 2. Look-at clip (re-aims EVERY active frame - follows a moving target)
    var clipA = track.CreateClip<BovineLabs.Timeline.Transform.Authoring.RotationLookAtTargetClip>();
    clipA.start = 0; clipA.duration = 2.5; clipA.displayName = "A_LookAtTarget";
    var a = (BovineLabs.Timeline.Transform.Authoring.RotationLookAtTargetClip)clipA.asset;

    // 3. Turn-back clip, overlapping for a 0.5s nlerp blend
    var clipB = track.CreateClip<BovineLabs.Timeline.Transform.Authoring.RotationLookAtStartClip>();
    clipB.start = 2; clipB.duration = 2; clipB.displayName = "B_BackToStart";
    clipB.blendInDuration = 0.5;

    // 4. THE EXPOSED-REFERENCE SEQUENCE (canonical):
    //    4a. mint GUID on the CLIP ASSET, save the .playable
    var exposedName = new UnityEngine.PropertyName(System.Guid.NewGuid().ToString());
    a.Target = new UnityEngine.ExposedReference<UnityEngine.Transform> { exposedName = exposedName };
    foreach (var o in new UnityEngine.Object[] { timeline, track, a, (UnityEngine.Object)clipB.asset })
        UnityEditor.EditorUtility.SetDirty(o);
    UnityEditor.AssetDatabase.SaveAssets();

    //    4b. bind + register the object on the DIRECTOR's table, save the SCENE
    UnityEngine.GameObject stage = null;
    foreach (var r in subScene.GetRootGameObjects()) if (r.name == "TrainingStage") stage = r;
    var director = stage.transform.Find("Stage_Director").GetComponent<UnityEngine.Playables.PlayableDirector>();
    director.playableAsset = timeline;
    director.SetGenericBinding(track, stage.transform.Find("Stage_LinkRoot/Stage_Actor").GetComponent<UnityEngine.Transform>());
    director.SetReferenceValue(exposedName, stage.transform.Find("Stage_Target").GetComponent<UnityEngine.Transform>());
    UnityEditor.EditorUtility.SetDirty(director);
    UnityEditor.SceneManagement.EditorSceneManager.SaveScene(subScene);
    return "OK|" + path + "|exposedName=" + exposedName;
} finally {
    UnityEditor.SceneManagement.EditorSceneManager.SetActiveScene(parentScene);
    UnityEditor.SceneManagement.EditorSceneManager.CloseScene(subScene, false);
    UnityEditor.SceneManagement.EditorSceneManager.OpenScene(parentScenePath, UnityEditor.SceneManagement.OpenSceneMode.Single);
}
CSHARP
```

## Edge cases & traps (each proven live, 2026-06)

- **DON'T treat an unset ExposedReference as an error you'll be told about** — an
  untouched clip has `exposedName=""`; `GetReferenceValue` returns null → `Baker.GetEntity(null)`
  → `Entity.Null` → `LookAtTargetClipJob` does a silent `TryGetComponent` skip EVERY
  frame, no error ever (`EDGE_A|GetReferenceValue(unset)=NULL|idValid=False`).
- **DON'T place the look-at target at the binding's position or directly on its vertical
  axis** — `quaternion.LookRotation` has NO degenerate-direction guard:
  `LookRotation(zero, up)` and `LookRotation(up, up)` both returned
  `float4(NaNf, NaNf, NaNf, NaNf)` live, and `WriteRotationJob` writes that NaN into
  `LocalTransform.Rotation`, poisoning the transform until something rewrites it. Keep a
  lateral offset between actor and target.
- **DON'T expect LookAtStart to restore the timeline-original pose** — it captures the
  binding's orientation on the clip's OWN activation frame; if another clip already
  rotated the object (our clip A was still live at B's start), that already-rotated
  orientation is what gets frozen. True "return to original pose" is the track-level
  `ResetRotationOnDeactivate` job's role, not this clip's. (And it captures ROTATION,
  not position — the object turns back in place, it does not travel.)
- **DON'T conflate the two reset bools** — `resetOnDeactivate` (inherited from
  `DOTSTrack`) and `ResetRotationOnDeactivate` (track-declared, drives `RotationState`)
  serialize as separate YAML keys (`resetOnDeactivate: 1` / `ResetRotationOnDeactivate: 1`
  side by side on disk); set the one you mean.
- **DON'T use short type names** — `BovineLabs.Vibe.Authoring.LocalTransform` has
  same-named `RotationLookAtTargetClip`/`RotationLookAtStartClip` with different fields;
  fully-qualify `BovineLabs.Timeline.Transform.Authoring.*` everywhere.
- **DON'T forget the SECOND save** — `SaveAssets()` persists only the GUID side;
  `SaveScene(subScene)` persists the `m_ExposedReferences` table. Skipping the scene
  save silently loses the object side while the .playable looks correctly wired.
- **DO trust director tables across playableAsset swaps** — binding table (keyed by
  track asset) and exposed-reference table (keyed by GUID name) both survived swapping
  the director back to PositionMastery: all three mastery bindings
  (Position/Scale/Rotation → Stage_Actor) plus the exposed ref stayed intact.
- **DO set `blendInDuration` on the later overlapping clip** for the look-at → turn-back
  handoff (B's `blendIn=0.5` nlerps from A's look-at toward B's frozen orientation);
  both clips report `caps=Blending`.

## Verification protocol

1. **Fresh-load asset dump**: in a new exec block, `AssetDatabase.LoadAssetAtPath` the
   .playable and dump every track/clip (name, start/duration, blendIn, caps, asset type,
   `ResetRotationOnDeactivate`). In-memory state after a save is not evidence.
2. **Raw YAML check, BOTH sides**: the .playable must show the minted
   `exposedName: <guid>` under `Target:` (an empty `exposedName:` line means an unwired
   silent-no-op clip); the .unity must show `- <guid>: {fileID: <n>}` under
   `m_ExposedReferences.m_References`, with the fileID resolving to the intended
   Transform in the same scene file. Also confirm the two reset keys.
3. **Survival proof from a RELOADED SubScene**: with the SubScene freshly opened from
   disk, `director.GetReferenceValue(exposedName, out idValid)` must return the target
   Transform with `idValid=True`, and the binding table must show
   `RotationTrack|bound=Stage_Actor (Transform)`.
4. **Parent-scene restore**: end with `sceneCount=1`,
   `scene[0]=Assets/Scenes/Main Scene.unity|loaded=True|active=True|dirty=False`.
5. **Console**: `unity-cli console --filter error` must show nothing new; known
   pre-existing vex-ee background entries are UnityCliConnector HTTP server start,
   PerformanceTesting IPrebuildSetup/IPostBuildCleanup, TestResults.xml save.
