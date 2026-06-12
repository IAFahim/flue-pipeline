---
name: unity-track-transform-position
description: Master of BovineLabs TransformPositionTrack + PositionClip/PositionStartClip in vex-ee — creating timelines that move SubScene-baked objects (World/Offset/Target modes, blending, reset semantics) and the cross-scene-reference traps. Use when a designer asks to "move this thing along the timeline".
---

# TransformPositionTrack specialist

You are the specialist for **`TransformPositionTrack`** and its two clip types
**`PositionClip`** and **`PositionStartClip`** from
`Packages/com.bovinelabs.timeline.transform`. Scope: exactly this track family —
authoring the track/clips in a `.playable` TimelineAsset, wiring a SubScene
PlayableDirector, and the runtime position-blending semantics. Stage construction
belongs to the `unity-stage-foundations` skill; scale belongs to
`unity-track-transform-scale`.

All facts below were verified live in the **vex-ee** project, **2026-06** (reflection
dumps, YAML reads, fresh-load read-backs via `unity-cli exec`).

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
  `Stage_Target` (cube at (5,0,0)). If missing, STOP and have the stage rebuilt first.
- Your assets live only under `Assets/Training/01-transform-position-track/`.
  Canonical asset: `PositionMastery.playable` (track `PositionTrack`, clips
  A_World 0–2s / B_OffsetLocal 1.5–3.5s / C_Target 3.5–5s / D_Start 5–6s).

## VERIFIED facts (vex-ee, 2026-06)

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
| `resetOnDeactivate` | bool | INHERITED from `DOTSTrack` base, serializes separately (defaulted True in our asset) — do not confuse the two |

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

## Canonical recipe — "move this thing along the timeline" (verbatim from report)

```bash
cat << 'CSHARP' | unity-cli exec
// Bracket: open SubScene (needed ONLY to resolve scene objects for binding;
// do NOT rely on assigning scene objects to clip fields - see edge 6b).
var parentScene = UnityEditor.SceneManagement.EditorSceneManager.GetActiveScene();
var parentScenePath = parentScene.path;
var subScene = UnityEditor.SceneManagement.EditorSceneManager.OpenScene(
    "Assets/Scenes/Main Sub Scene.unity", UnityEditor.SceneManagement.OpenSceneMode.Additive);
UnityEditor.SceneManagement.EditorSceneManager.SetActiveScene(subScene);
try {
    // 1. Timeline asset + track
    if (!UnityEditor.AssetDatabase.IsValidFolder("Assets/Training/01-transform-position-track"))
        UnityEditor.AssetDatabase.CreateFolder("Assets/Training", "01-transform-position-track");
    var path = "Assets/Training/01-transform-position-track/PositionMastery.playable";
    var timeline = UnityEngine.ScriptableObject.CreateInstance<UnityEngine.Timeline.TimelineAsset>();
    timeline.name = "PositionMastery";
    UnityEditor.AssetDatabase.CreateAsset(timeline, path);
    var track = timeline.CreateTrack<BovineLabs.Timeline.Transform.Authoring.TransformPositionTrack>(null, "PositionTrack");
    track.ResetPositionOnDeactivate = true; // restore binding position when track deactivates

    // 2. Pattern WORLD: go to an absolute point
    var clipA = track.CreateClip<BovineLabs.Timeline.Transform.Authoring.PositionClip>();
    clipA.start = 0; clipA.duration = 2; clipA.displayName = "A_World";
    var a = (BovineLabs.Timeline.Transform.Authoring.PositionClip)clipA.asset;
    a.Type = BovineLabs.Timeline.Transform.Authoring.PositionType.World;
    a.Position = new UnityEngine.Vector3(0f, 1f, 5f);

    // 3. Pattern OFFSET (computed ONCE at clip activation, Local = rotated by binding)
    var clipB = track.CreateClip<BovineLabs.Timeline.Transform.Authoring.PositionClip>();
    clipB.start = 1.5; clipB.duration = 2; clipB.displayName = "B_OffsetLocal";
    var b = (BovineLabs.Timeline.Transform.Authoring.PositionClip)clipB.asset;
    b.Type = BovineLabs.Timeline.Transform.Authoring.PositionType.Offset;
    b.OffsetType = BovineLabs.Timeline.Transform.OffsetType.Local;
    b.Offset = new UnityEngine.Vector3(2f, 0f, 0f);
    clipB.blendInDuration = 0.5; // overlap with A => weighted blend

    // 4. Pattern TARGET (re-evaluated EVERY frame). WARNING: a scene-object Target
    //    serializes as {fileID: 0} in the asset (edge 6b) - prefer EntityLinks tracks
    //    for persistent cross-object references.
    var clipC = track.CreateClip<BovineLabs.Timeline.Transform.Authoring.PositionClip>();
    clipC.start = 3.5; clipC.duration = 1.5; clipC.displayName = "C_Target";
    var c = (BovineLabs.Timeline.Transform.Authoring.PositionClip)clipC.asset;
    c.Type = BovineLabs.Timeline.Transform.Authoring.PositionType.Target;
    c.Target = UnityEngine.GameObject.Find("Stage_Target"); // see warning above
    c.OffsetType = BovineLabs.Timeline.Transform.OffsetType.World;
    c.Offset = new UnityEngine.Vector3(0f, 2f, 0f);

    // 5. Pattern START: blend back toward where the binding stood at clip start
    var clipD = track.CreateClip<BovineLabs.Timeline.Transform.Authoring.PositionStartClip>();
    clipD.start = 5; clipD.duration = 1; clipD.displayName = "D_Start";

    foreach (var o in new UnityEngine.Object[] { timeline, track, a, b, c, (UnityEngine.Object)clipD.asset })
        UnityEditor.EditorUtility.SetDirty(o);
    UnityEditor.AssetDatabase.SaveAssets();

    // 6. Wire the director (binding table lives in the SCENE file -> persists fine)
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

- **DON'T persist scene-object `Target` references in a .playable** — a project asset
  physically cannot serialize a reference to a scene object: after `SaveAssets()` the
  file held `Target: {fileID: 0}` and fresh read-back showed null, with NO console
  warning; in-memory objects (and the Timeline UI until domain reload) keep the stale
  reference and lie. DO use the EntityLinks family (schema id → runtime resolution) for
  persistent cross-object references.
- **DON'T treat `Target=null` with `PositionType.Target` as an error you'll be told
  about** — it bakes `Entity.Null` (`GetEntity(null, ...)`) and the runtime lookup
  fails silently; the clip contributes nothing.
- **DON'T bind the track to a parent-scene object** — binding `Main Camera` (parent
  scene) from the SubScene director was silently nulled on save
  (`m_SceneBindings ... value: {fileID: 0}`), and even if it persisted, the parent
  scene is never baked, so no entity exists for `PositionTrackSystem` to write. DOTS
  tracks can only animate SubScene-baked objects.
- **DON'T conflate the two reset bools** — `resetOnDeactivate` (inherited from
  `DOTSTrack`) and `ResetPositionOnDeactivate` (track-declared, drives `PositionState`)
  serialize as separate YAML keys; set the one you mean.
- **DON'T cast byte-backed enums via `(int)Enum.Parse`** — throws
  InvalidCastException in exec blocks; use `System.Convert.ToInt64`.
- **DON'T use obsolete APIs in exec** — this editor build rejects
  `SerializedProperty.objectReferenceInstanceIDValue` (use
  `objectReferenceEntityIdValue`) and `Object.GetInstanceID()` (use `GetEntityId`).
- **DO remember a fresh PositionClip's `Position` default is (0,0,0)** — in World mode
  that actively teleports the binding to the origin (contrast ScaleClip's benign
  Vector3.one default).
- **DO set `blendInDuration` on the later overlapping clip** — B's explicit
  `blendIn=0.5` produced the mirrored computed `blendOut=0.5` on A; all clips report
  `caps=Blending`.
- **CAVEAT (inconclusive, reported honestly)**: querying the Editor World for baked
  `PositionAnimated` entities after closing the SubScene returned 0 (only the streaming
  `SceneReference` entity was present; entity-scene import is async). Absence of baked
  entities in the Editor World is NOT proof the bake is broken — and this session could
  not confirm baked clip entities from the editor world at all.

## Verification protocol

1. **Fresh-load asset dump**: in a new exec block, `AssetDatabase.LoadAssetAtPath` the
   .playable and dump every track/clip (name, start/duration, blendIn/blendOut, caps,
   asset type, all serialized fields). In-memory state after a save is not evidence.
2. **Raw YAML check**: read the .playable file text for `Target: {fileID: 0}` (dropped
   references), the two reset keys (`resetOnDeactivate` / `ResetPositionOnDeactivate`),
   and clip field values.
3. **Binding table from a RELOADED SubScene**: expect
   `BINDING|PositionTrack|bound=Stage_Actor (UnityEngine.Transform)`. Never leave
   experimental bindings in place.
4. **Parent-scene restore**: end with `sceneCount=1`,
   `scene[0]=Assets/Scenes/Main Scene.unity|loaded=True|active=True|dirty=False`.
5. **Console**: `unity-cli console --filter error` must show nothing new; known
   pre-existing vex-ee background entries are UnityCliConnector HTTP server start,
   PerformanceTesting IPrebuildSetup/IPostBuildCleanup, TestResults.xml save.
