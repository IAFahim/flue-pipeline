---
name: unity-stage-foundations
description: Master of the shared DOTS Timeline ECS environment in vex-ee — TimelineReferenceAuthoring, LifeCycle/Targets/Stat authoring, the EntityLink trio, and (re)building the TrainingStage in the SubScene. Use when a track agent needs the stage verified/rebuilt or when diagnosing "DOTS timeline clip silently does nothing".
---

# Stage Foundations specialist

You are the specialist for the **shared environment every DOTS Timeline track needs**.
You master no track — you master the ground they all stand on: the `TrainingStage`
hierarchy in the SubScene, and the five interlocking authoring systems:
`TimelineReferenceAuthoring`, `LifeCycleAuthoring`, `TargetsAuthoring`, `StatAuthoring`,
and the EntityLink trio (`EntityLinkRootAuthoring` / `EntityLinkSourceAuthoring` /
`EntityLinkSchema`).

All facts below were verified live in the **vex-ee** project, **2026-06** (reflection
dumps + read-backs via `unity-cli exec`). Do not re-derive them; do re-verify anything
you mutate.

## Prerequisites & environment

- Act only through `unity-cli exec` / `unity-cli console`. Never write C# files or edit
  vex-ee assets via the filesystem. Follow the **unity-cli skill's Safe Loop**
  (inspect → mutate once → save → verify → restore → console check) on every mutation.
- Verify the live project before acting:
  - `unity-cli exec "return UnityEditor.SceneManagement.EditorSceneManager.GetActiveScene().path + \"|\" + Application.dataPath;"`
  - Expected: `Assets/Scenes/Main Scene.unity|/home/i/GitHub/vex-ee/Assets`
- Parent scene: `Assets/Scenes/Main Scene.unity` (root `Sub Scene` holds the SubScene component).
- SubScene asset: `Assets/Scenes/Main Sub Scene.unity` — ALL ECS authoring lives here
  (bake target), including the PlayableDirector + TimelineReferenceAuthoring.
- Training assets live only under `Assets/Training/00-foundations/`.
- Canonical TrainingStage layout (verified by fresh-load read-back):

```
TrainingStage
  Stage_Director  [PlayableDirector, TimelineReferenceAuthoring]                    @ (0,0,0)
  Stage_Target    [MeshFilter, MeshRenderer, LifeCycleAuthoring, TargetsAuthoring]  @ (5,0,0)
  Stage_LinkRoot  [EntityLinkRootAuthoring]                                         @ (0,0,0)
    Stage_Actor   [MeshFilter, MeshRenderer, LifeCycleAuthoring, TargetsAuthoring,
                   StatAuthoring, TransformAuthoring, EntityLinkSourceAuthoring]    @ world (0,1,0)
  Stage_SubDirector [PlayableDirector ONLY — deliberately NO TimelineReferenceAuthoring]
  Stage_PhysicsBall [MeshFilter, MeshRenderer, PhysicsShapeAuthoring, PhysicsBodyAuthoring,
                   LifeCycleAuthoring, TargetsAuthoring]                             @ (0,1,5)
  Stage_TriggerZone [MeshFilter, MeshRenderer, PhysicsShapeAuthoring,
                   StatefulTriggerEventAuthoring]                                    @ (3,1,5) scale (2,2,2)
```

Wiring: `Stage_Actor.Targets.Target = Stage_Target`; `Stage_Actor.Source.Root = Stage_LinkRoot`;
`Stage_Actor.Source.Schemas[0] = Schema_Actor`; `Stage_LinkRoot.Links = [Stage_Actor]` (auto).
Asset: `Assets/Training/00-foundations/Schema_Actor.asset` (EntityLinkSchema, auto-id resolved to 10).
`Stage_Director.playableAsset` is intentionally null at the foundations level — track
lessons bind their own TimelineAssets. As of lesson 15, the director's binding table
holds **THIRTEEN** track bindings (Position/Scale/Rotation/TimeScale from lessons 01–04,
plus the EntityLink quartet, Event, Intrinsic, the StatTrack —
TimelineEssenceStatTrack → Stage_Actor's TargetsAuthoring — added in lesson 13,
the DistanceToStatTrack → Stage_Actor's TargetsAuthoring added in lesson 14, and the
PhysicsFilterOverrideTrack → the Stage_PhysicsBall GameObject itself added in lesson 15;
TimeScale binds the StatAuthoring component) — tables are keyed by track asset and
survive playableAsset swaps.
Permanent stage state (lesson 04, corrected after lesson 13): `Stage_Actor`'s
StatAuthoring carries
`StatDefaults[0] = {Stat: SlowMo (Assets/Settings/Schemas/Stats/SlowMo.asset, key=94),
ModifyType: Added, Value: 25}` — **25 in ×100 fixed-point means a 0.25 factor;
corrected from the original 0.25, which truncated to int 0 at bake** (Essence `Added`
modifiers are int; `ValueFloat = Added/100` — see `unity-track-essence-stat`). Added
via the SerializedObject append recipe in the `unity-track-timeline-timescale` skill
(the universal pattern for stat-driven tracks).
Permanent stage state (lesson 06): `Stage_SubDirector` — empty GameObject under
`TrainingStage`, exactly Transform + PlayableDirector
(`playableAsset = Assets/Training/02-transform-scale-track/ScaleMastery.playable`,
`playOnAwake = false`), with ITS OWN binding ScaleTrack → `Stage_Actor.transform`,
and deliberately **NO TimelineReferenceAuthoring**: sub-directors driven by a
SubDirectorClip must stay inert or their independently-baked copy plays in parallel
with the host-driven nested copy — see the `unity-track-subdirector` skill for the
mechanism.
Permanent stage state (lesson 15): two physics objects under `TrainingStage` for the
Physics family (topics 15–26).
- `Stage_PhysicsBall` — dynamic sphere at (0,1,5): `PhysicsBodyAuthoring` with
  MotionType=Dynamic and Mass=1 **set via property assignment, NOT SetMotionType**;
  `PhysicsShapeAuthoring` sphere r=0.5 with **ForceUnique=true** (corrected
  post-lesson-15: it was authored False, lesson 15 proved baked collider blobs are
  SHARED by default and collider-mutating tracks warn-and-skip non-unique blobs — see
  `unity-track-physics-filter-override`); `LifeCycleAuthoring`; `TargetsAuthoring`
  with Target=Stage_Target; classic SphereCollider removed (ECS-pure).
- `Stage_TriggerZone` — static box shape at (3,1,5), scale 2: `PhysicsShapeAuthoring`
  box with OverrideCollisionResponse=true + CollisionResponse=RaiseTriggerEvents;
  `BovineLabs.Core.Authoring.PhysicsStates.StatefulTriggerEventAuthoring`; deliberately
  **NO body authoring** — a bodyless shape bakes static; classic BoxCollider removed
  (ECS-pure).
The stage-build recipe below predates lessons 06 and 15 and rebuilds only the
original four objects.

## VERIFIED facts (vex-ee, 2026-06)

Type resolution (reflection over all loaded assemblies):

| Type | FullName | Assembly | Base |
|---|---|---|---|
| TimelineReferenceAuthoring | `BovineLabs.Timeline.Core.Authoring.TimelineReferenceAuthoring` | BovineLabs.Timeline.Core.Authoring | MonoBehaviour |
| TargetsAuthoring | `BovineLabs.Reaction.Authoring.Core.TargetsAuthoring` | BovineLabs.Reaction.Authoring | MonoBehaviour |
| StatAuthoring | `BovineLabs.Essence.Authoring.StatAuthoring` | BovineLabs.Essence.Authoring | MonoBehaviour |
| LifeCycleAuthoring | `BovineLabs.Core.Authoring.LifeCycle.LifeCycleAuthoring` | BovineLabs.Core.Extensions.Authoring | MonoBehaviour |
| EntityLinkRootAuthoring | `BovineLabs.Timeline.EntityLinks.Authoring.EntityLinkRootAuthoring` | BovineLabs.Timeline.EntityLinks.Authoring | MonoBehaviour |
| EntityLinkSourceAuthoring | `BovineLabs.Timeline.EntityLinks.Authoring.EntityLinkSourceAuthoring` | BovineLabs.Timeline.EntityLinks.Authoring | MonoBehaviour |
| EntityLinkSchema | `BovineLabs.Timeline.EntityLinks.Authoring.EntityLinkSchema` | BovineLabs.Timeline.EntityLinks.Authoring | ScriptableObject |
| TransformAuthoring (the addable one) | `BovineLabs.Core.Authoring.TransformAuthoring` | BovineLabs.Core.Authoring | MonoBehaviour |

Field tables (SerializedObject iteration, live editor):

- **TimelineReferenceAuthoring** — ZERO serialized fields; pure marker. No RequireComponent.
  Its baker (`TimelineReferenceBaker` → `TimelineReferenceBuilder.ApplyTo`) adds exactly
  one ECS component: `BovineLabs.Timeline.Core.TimelineReference`.
- **LifeCycleAuthoring** — ZERO serialized fields; pure marker. Gives the baked entity
  `InitializeSubSceneEntity`/`InitializeEntity` + `DestroyEntity`.
- **TargetsAuthoring** — `Owner`, `Source`, `Target`, `Custom` (all `GameObject`
  ObjectReference) + `Initialize.Target` (Target enum: Self, Owner, Source, Target, Custom).
- **StatAuthoring** — `AddStats` (bool, default True), `StatDefaults` (array, 0 on a
  fresh component; on Stage_Actor it is 1 as of lesson 04 — see permanent stage state above),
  `StatDefaultGroups` (array, 0), `StatsCanBeModified` (bool, True), `AddIntrinsics`
  (bool, True), `IntrinsicDefaults` (array, 0), `IntrinsicDefaultGroups` (array, 0),
  `Initialize.CopyFrom` (enum).
- **EntityLinkRootAuthoring** — `Links` (`EntityLinkSourceAuthoring[]`), AUTO-MANAGED
  (see traps). Its Baker rejects (Debug.LogError) any link whose resolved root differs
  from the baking root.
- **EntityLinkSourceAuthoring** — `Root` (ObjectReference to the
  `EntityLinkRootAuthoring` COMPONENT, not a GameObject), `Schemas`
  (`EntityLinkSchema[]`). `[RequireComponent(typeof(BovineLabs.Core.Authoring.TransformAuthoring))]`.
  Has `OnValidate` that auto-fills `Root` from `GetComponentInParent<EntityLinkRootAuthoring>(true)`
  when null; also exposes `TryGetRoot`, `HasSchema`, `AddSchemas`.
- **EntityLinkSchema** — single field `id` (`System.UInt16`), auto-assigned on import.

Runtime semantics summary: `PlayableDirectorBaker` bakes EVERY director whose
`playableAsset` is a TimelineAsset, unconditionally — `TimelineReferenceAuthoring` is
NOT a bake gate. It is the ACTIVATION marker: every baked director entity starts with
`TimelineActive` present-but-disabled, and the marker's consumer enables
`TimelineActive` on entities carrying `TimelineReference`. Without the authoring the
baked entities sit inert — clips evaluate to nothing with no error (the #1 silent
failure). So: directors that should play on their own need it; deliberately-inert
sub-directors must NOT carry it (see `unity-track-subdirector`).
Clips reference SubScene entities indirectly through `EntityLinkSchema` ids resolved by
EntityLinkRoot/Source at runtime, because direct asset→scene-object references cannot
serialize.

## Canonical recipes (copied from the verified report)

Run the schema block first (idempotent), then the stage block (idempotent — deletes any
existing `TrainingStage` and rebuilds).

### Schema asset

```bash
cat << 'CSHARP' | unity-cli exec
if (!UnityEditor.AssetDatabase.IsValidFolder("Assets/Training"))
    UnityEditor.AssetDatabase.CreateFolder("Assets", "Training");
if (!UnityEditor.AssetDatabase.IsValidFolder("Assets/Training/00-foundations"))
    UnityEditor.AssetDatabase.CreateFolder("Assets/Training", "00-foundations");
var assetPath = "Assets/Training/00-foundations/Schema_Actor.asset";
if (UnityEditor.AssetDatabase.LoadAssetAtPath<BovineLabs.Timeline.EntityLinks.Authoring.EntityLinkSchema>(assetPath) == null) {
    var schema = UnityEngine.ScriptableObject.CreateInstance<BovineLabs.Timeline.EntityLinks.Authoring.EntityLinkSchema>();
    schema.name = "Schema_Actor";
    UnityEditor.AssetDatabase.CreateAsset(schema, assetPath);
    UnityEditor.AssetDatabase.SaveAssets();
}
var so = new UnityEditor.SerializedObject(UnityEditor.AssetDatabase.LoadAssetAtPath<BovineLabs.Timeline.EntityLinks.Authoring.EntityLinkSchema>(assetPath));
so.Update();
return "SCHEMA|" + assetPath + "|id=" + so.FindProperty("id").intValue;
CSHARP
```

(`id` is 0 immediately after creation; the auto-ID processor assigns it on import — re-read later, ours became 10.)

### Stage build (SubScene bracket)

```bash
cat << 'CSHARP' | unity-cli exec
var parentScene = UnityEditor.SceneManagement.EditorSceneManager.GetActiveScene();
var parentScenePath = parentScene.path;
var subScenePath = "";
foreach (var r in parentScene.GetRootGameObjects()) {
    var sub = r.GetComponent<Unity.Scenes.SubScene>();
    if (sub != null && sub.SceneAsset != null) { subScenePath = UnityEditor.AssetDatabase.GetAssetPath(sub.SceneAsset); break; }
}
if (string.IsNullOrEmpty(subScenePath)) return "ERROR|No SubScene found";
var subScene = UnityEditor.SceneManagement.EditorSceneManager.OpenScene(subScenePath, UnityEditor.SceneManagement.OpenSceneMode.Additive);
UnityEditor.SceneManagement.EditorSceneManager.SetActiveScene(subScene);
var sb = new System.Text.StringBuilder();
try {
    foreach (var r in subScene.GetRootGameObjects())
        if (r.name == "TrainingStage") UnityEngine.Object.DestroyImmediate(r);

    var stage = new UnityEngine.GameObject("TrainingStage");

    var director = new UnityEngine.GameObject("Stage_Director");
    director.transform.SetParent(stage.transform, false);
    director.AddComponent<UnityEngine.Playables.PlayableDirector>();
    director.AddComponent<BovineLabs.Timeline.Core.Authoring.TimelineReferenceAuthoring>();

    // LinkRoot FIRST; actor must be its child (EntityLinkRootAuthoring.OnValidate
    // rebuilds Links = GetComponentsInChildren<EntityLinkSourceAuthoring>(true))
    var linkRoot = new UnityEngine.GameObject("Stage_LinkRoot");
    linkRoot.transform.SetParent(stage.transform, false);
    var rootComp = linkRoot.AddComponent<BovineLabs.Timeline.EntityLinks.Authoring.EntityLinkRootAuthoring>();

    var actor = UnityEngine.GameObject.CreatePrimitive(UnityEngine.PrimitiveType.Capsule);
    actor.name = "Stage_Actor";
    actor.transform.SetParent(linkRoot.transform, false);
    actor.transform.localPosition = new UnityEngine.Vector3(0f, 1f, 0f);
    UnityEngine.Object.DestroyImmediate(actor.GetComponent<UnityEngine.CapsuleCollider>()); // ECS-pure
    actor.AddComponent<BovineLabs.Core.Authoring.LifeCycle.LifeCycleAuthoring>();
    var actorTargets = actor.AddComponent<BovineLabs.Reaction.Authoring.Core.TargetsAuthoring>();
    actor.AddComponent<BovineLabs.Essence.Authoring.StatAuthoring>();
    var actorSource = actor.AddComponent<BovineLabs.Timeline.EntityLinks.Authoring.EntityLinkSourceAuthoring>();
    // ^ auto-adds BovineLabs.Core.Authoring.TransformAuthoring via RequireComponent

    var target = UnityEngine.GameObject.CreatePrimitive(UnityEngine.PrimitiveType.Cube);
    target.name = "Stage_Target";
    target.transform.SetParent(stage.transform, false);
    target.transform.localPosition = new UnityEngine.Vector3(5f, 0f, 0f);
    UnityEngine.Object.DestroyImmediate(target.GetComponent<UnityEngine.BoxCollider>()); // ECS-pure
    target.AddComponent<BovineLabs.Core.Authoring.LifeCycle.LifeCycleAuthoring>();
    target.AddComponent<BovineLabs.Reaction.Authoring.Core.TargetsAuthoring>();

    var schema = UnityEditor.AssetDatabase.LoadAssetAtPath<BovineLabs.Timeline.EntityLinks.Authoring.EntityLinkSchema>("Assets/Training/00-foundations/Schema_Actor.asset");
    if (schema == null) return "ERROR|Schema asset not found - run schema block first";
    actorTargets.Target = target;
    actorSource.Root = rootComp;
    actorSource.Schemas = new BovineLabs.Timeline.EntityLinks.Authoring.EntityLinkSchema[] { schema };
    // Populate Links via the component's own OnValidate (reflection avoids the
    // SendMessage 'ShouldRunBehaviour' editor assertion):
    rootComp.GetType().GetMethod("OnValidate",
        System.Reflection.BindingFlags.Instance | System.Reflection.BindingFlags.NonPublic)
        .Invoke(rootComp, null);
    UnityEditor.EditorUtility.SetDirty(actorTargets);
    UnityEditor.EditorUtility.SetDirty(actorSource);
    UnityEditor.EditorUtility.SetDirty(rootComp);

    UnityEditor.SceneManagement.EditorSceneManager.SaveScene(subScene);
    sb.AppendLine("BUILT|TrainingStage in " + subScenePath + "|Links=" + rootComp.Links.Length);
} finally {
    UnityEditor.SceneManagement.EditorSceneManager.SetActiveScene(parentScene);
    UnityEditor.SceneManagement.EditorSceneManager.CloseScene(subScene, false);
    UnityEditor.SceneManagement.EditorSceneManager.OpenScene(parentScenePath, UnityEditor.SceneManagement.OpenSceneMode.Single);
}
return sb.ToString();
CSHARP
```

## Edge cases & traps (each proven live, 2026-06)

- **DON'T hand-assign `EntityLinkRootAuthoring.Links`** — `OnValidate()` does
  `Links = GetComponentsInChildren<EntityLinkSourceAuthoring>(true);` on every
  load/validate; manual sibling wiring was verified LOST after save+reload (`Links=0`).
  DO parent link sources under the root GameObject; the Baker also enforces
  `source.TryGetRoot(out root) && root == authoring` before emitting `EntityLinkEntry`.
- **DON'T forget TimelineReferenceAuthoring on a director that should play** — the
  director still bakes (baking is unconditional), and classic Timeline still plays,
  but without the `TimelineReference` marker nothing ever enables the baked entity's
  `TimelineActive`, so every DOTS track silently no-ops (mechanism confirmed in
  package source). Conversely, DON'T add it to a sub-director driven by a
  SubDirectorClip — its independent copy would play in parallel with the nested one
  (`unity-track-subdirector`).
- **DO let RequireComponent work for you** — adding ONLY `ReactionAuthoring` auto-added
  `LifeCycleAuthoring` + `TargetsAuthoring` (both `[RequireComponent]`, proven live);
  `EntityLinkSourceAuthoring` auto-adds `BovineLabs.Core.Authoring.TransformAuthoring`.
- **DON'T look for an Essence or Unity.Entities TransformAuthoring to add** — only two
  types named TransformAuthoring exist; `Unity.Entities.TransformAuthoring` is a struct
  (baked data, not addable). The Core MonoBehaviour is the one. The "Essence vs
  Unity.Entities" framing in older docs is outdated.
- **DON'T cache `EntityLinkSchema.id` in the block that creates the asset** — it is 0
  after `CreateAsset`+`SaveAssets`; an import-time processor assigns it later (ours
  became 10 on re-read).
- **DON'T call `SendMessage("OnValidate")`** — it works but logs
  `Assertion failed on expression: 'ShouldRunBehaviour()'`. DO reflection-invoke the
  private `OnValidate` (as in the recipe).
- **DON'T mix classic components** (Rigidbody/Animator/colliders) with DOTS authoring on
  track-bound objects — the recipe strips the primitive colliders for this reason.

## Verification protocol

1. After the build, re-open the SubScene fresh (additive) and dump the hierarchy +
   key serialized fields per stage object; expect the canonical layout above, including
   `WIRE|LinkRoot.Links=1|[0]=Stage_Actor`.
2. Re-read `Schema_Actor.asset` in a LATER exec block to confirm the nonzero auto-id.
3. Restore the parent scene: `OpenScene(parentScenePath, OpenSceneMode.Single)`; confirm
   `sceneCount=1`, `scene[0]=Assets/Scenes/Main Scene.unity|loaded=True|active=True`.
4. `unity-cli console --filter error` must show nothing new. Known pre-existing
   background entries in vex-ee (note verbatim, don't claim them): UnityCliConnector
   HTTP server start, PerformanceTesting IPrebuildSetup/IPostBuildCleanup,
   TestResults.xml save.
5. Type resolution failure protocol: reflection-search all loaded assemblies for the
   simple name before concluding a type is missing; report the real namespace found.
