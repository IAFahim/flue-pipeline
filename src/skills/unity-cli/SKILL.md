---
name: unity-cli
description: |
  Unity DOTS/ECS development with BovineLabs Core + full ecosystem. Enforces strict Data-Oriented Design,
  6-assembly architecture. Deep SubScene navigation, runtime entity verification, and game creation recipes.
  Optimized for safe Unity CLI operation: inspect first, mutate second, verify before claiming success.
---
# SYSTEM CAPABILITY: `unity-cli`

## UNIVERSAL OPERATING PROCEDURE

This section is intentionally explicit and procedural. Use it for every Unity scene task,
especially when the request is vague, the editor state is unknown, or previous attempts
looped without progress.

### The Only Safe Loop
For every Unity task, do exactly one pass through this loop. Do not skip steps.

1. **Inspect**: find the active scene, root objects, target objects, and whether a SubScene exists.
2. **Decide**: choose parent scene or subscene. If unsure, use parent scene for normal GameObjects and subscene only for ECS authoring objects.
3. **Mutate once**: run one `unity-cli exec` block that creates/edits the requested objects.
4. **Save**: save the changed scene or asset inside the same exec block.
5. **Verify**: query the exact objects/components/materials that should now exist.
6. **Restore editor**: reopen the original parent scene with `OpenSceneMode.Single`.
7. **Check errors**: run `unity-cli console --filter error`.
8. **Report only verified facts**: never say done unless verification, restore, and console check passed.

If a step fails, stop creating new things. Run a focused inspection command and fix the
first concrete error.

### Connectivity Smoke Test
Before doing real work, prove the editor connection works:

```bash
unity-cli exec "return UnityEditor.SceneManagement.EditorSceneManager.GetActiveScene().path;"
```

Expected result: a scene path like `Assets/Scenes/Scene.unity`.

If the command hangs or prints nothing after about 10 seconds:
- Do not assume Unity is broken.
- The shell sandbox may be blocking the local editor connection.
- Ask for permission/escalation to run `unity-cli exec` outside the sandbox, then retry the same command.
- Do not start editing files or writing workaround scripts until this simple command works.

### First Command For Any Scene Task
Always run this before creating, moving, deleting, or modifying scene objects:

```bash
cat << 'CSHARP' | unity-cli exec
var scene = UnityEditor.SceneManagement.EditorSceneManager.GetActiveScene();
var sb = new System.Text.StringBuilder();
sb.AppendLine("ACTIVE_SCENE|" + scene.name + "|" + scene.path + "|roots=" + scene.rootCount);
var roots = scene.GetRootGameObjects();
for (int i = 0; i < roots.Length; i++) {
    var go = roots[i];
    sb.AppendLine("ROOT|" + i + "|" + go.name + "|children=" + go.transform.childCount);
    var sub = go.GetComponent<Unity.Scenes.SubScene>();
    if (sub != null) {
        var p = sub.SceneAsset != null ? UnityEditor.AssetDatabase.GetAssetPath(sub.SceneAsset) : "null";
        sb.AppendLine("SUBSCENE|" + go.name + "|" + p);
    }
}
return sb.ToString();
CSHARP
```

Read the output literally:
- `ACTIVE_SCENE` tells you where normal `new GameObject()` calls will go.
- `ROOT` tells you what already exists. Reuse matching objects instead of duplicating.
- `SUBSCENE` means ECS authoring may belong in that referenced `.unity` file.

### Where To Put Things
- If the parent scene has a `Unity.Scenes.SubScene`, put world content inside the referenced subscene by default: props, markers, environment art, gameplay objects, ECS authoring objects, and smoke-test objects.
- Keep parent-scene objects only for bootstrap/scene-level objects: `Main Camera`, global lights/volumes, UI, inputs, audio, managers, and the SubScene GameObject itself.
- If there is no SubScene, create normal GameObjects in the active parent scene.
- User asks for ECS entities, bakers, authoring for runtime systems, or DOTS conversion: **subscene asset** if one exists.
- Never create objects in both parent scene and subscene unless the user explicitly asks for both.
- Before editing a subscene, capture `parentScene.path`, open the subscene additively, set it active, save it, close it, then reopen the parent scene with `OpenSceneMode.Single`.

### Final Editor State Is Part Of The Task
Never leave the editor showing only a subscene or an additive scene setup after an automated
edit. At the end of every SubScene inspection, edit, verification, or recovery command, run:

```csharp
UnityEditor.SceneManagement.EditorSceneManager.OpenScene(parentScenePath, UnityEditor.SceneManagement.OpenSceneMode.Single);
```

Rules:
- Capture `var parentScenePath = parentScene.path;` before opening any subscene.
- After saving and closing the subscene, reopen `parentScenePath` with `OpenSceneMode.Single`.
- Do this even for read-only verification snippets that temporarily open a subscene.
- If the final visible editor scene is not the parent scene, the task is not done.

## DEEP SUBSCENE NAVIGATION

### Full Hierarchy Dump (Recursive)
Dumps the complete scene hierarchy including all nested children, components, and SubScene references.
Use this when you need to understand the entire scene structure before making changes.

```bash
cat << 'CSHARP' | unity-cli exec
var scene = UnityEditor.SceneManagement.EditorSceneManager.GetActiveScene();
var sb = new System.Text.StringBuilder();

void DumpTransform(UnityEngine.Transform t, string indent) {
    var go = t.gameObject;
    var comps = go.GetComponents<UnityEngine.Component>();
    var ct = new System.Text.StringBuilder();
    for (int j = 0; j < comps.Length; j++) {
        if (comps[j] != null) {
            if (ct.Length > 0) ct.Append(", ");
            ct.Append(comps[j].GetType().Name);
        }
    }
    sb.AppendLine(indent + go.name + " [" + ct + "] pos=" + t.position.ToString("F2"));
    for (int i = 0; i < t.childCount; i++)
        DumpTransform(t.GetChild(i), indent + "  ");
}

var roots = scene.GetRootGameObjects();
sb.AppendLine("SCENE|" + scene.name + "|" + scene.path + "|roots=" + roots.Length);
for (int i = 0; i < roots.Length; i++) {
    var go = roots[i];
    var sub = go.GetComponent<Unity.Scenes.SubScene>();
    if (sub != null) {
        var p = sub.SceneAsset != null ? UnityEditor.AssetDatabase.GetAssetPath(sub.SceneAsset) : "null";
        sb.AppendLine("SUBSCENE|" + go.name + "|" + p);
    }
    DumpTransform(go.transform, "  ");
}
return sb.ToString();
CSHARP
```

### Full SubScene Content Dump (All Components + Serialized Fields)
Opens the subscene additively and dumps every object with its authoring component fields.

```bash
cat << 'CSHARP' | unity-cli exec
var parentScene = UnityEditor.SceneManagement.EditorSceneManager.GetActiveScene();
var parentScenePath = parentScene.path;
var subScenePath = "REPLACE_WITH_SUBSCENE_PATH";
var subScene = UnityEditor.SceneManagement.EditorSceneManager.OpenScene(subScenePath, UnityEditor.SceneManagement.OpenSceneMode.Additive);
var sb = new System.Text.StringBuilder();
sb.AppendLine("SUBSCENE|" + subScene.name + "|roots=" + subScene.rootCount);
var roots = subScene.GetRootGameObjects();
for (int i = 0; i < roots.Length; i++) {
    var go = roots[i];
    var comps = go.GetComponents<UnityEngine.Component>();
    sb.AppendLine("  [" + i + "] " + go.name + " pos=" + go.transform.position.ToString("F2"));
    for (int j = 0; j < comps.Length; j++) {
        var c = comps[j];
        if (c != null && c.GetType().Name != "Transform") {
            var so = new UnityEditor.SerializedObject(c);
            so.Update();
            var sp = so.GetIterator();
            var fields = new System.Text.StringBuilder();
            while (sp.NextVisible(true)) {
                if (sp.name == "m_Script") continue;
                if (fields.Length > 0) fields.Append(", ");
                var val = sp.propertyType == UnityEditor.SerializedPropertyType.ObjectReference
                    ? (sp.objectReferenceValue != null ? sp.objectReferenceValue.name : "null")
                    : sp.stringValue.Length > 0 ? sp.stringValue : sp.propertyType.ToString();
                fields.Append(sp.name + "=" + val);
            }
            sb.AppendLine("    ." + c.GetType().Name + ": " + fields);
        }
    }
}
UnityEditor.SceneManagement.EditorSceneManager.CloseScene(subScene, false);
UnityEditor.SceneManagement.EditorSceneManager.OpenScene(parentScenePath, UnityEditor.SceneManagement.OpenSceneMode.Single);
return sb.ToString();
CSHARP
```

### Find All SubScenes in Project
```bash
cat << 'CSHARP' | unity-cli exec
var guids = UnityEditor.AssetDatabase.FindAssets("t:SceneAsset");
var sb = new System.Text.StringBuilder();
for (int i = 0; i < guids.Length; i++) {
    var path = UnityEditor.AssetDatabase.GUIDToAssetPath(guids[i]);
    sb.AppendLine("SCENE|" + path);
}
return sb.ToString();
CSHARP
```

### Enumerate All Authoring Components on a Specific Object
```bash
cat << 'CSHARP' | unity-cli exec --usings BovineLabs.Reaction.Authoring.Core,BovineLabs.Essence.Authoring,BovineLabs.Core.Authoring.LifeCycle
var go = UnityEngine.GameObject.Find("TARGET_NAME");
if (go == null) return "NOT FOUND";
var comps = go.GetComponents<UnityEngine.Component>();
var sb = new System.Text.StringBuilder();
for (int i = 0; i < comps.Length; i++) {
    var c = comps[i];
    if (c == null) continue;
    sb.AppendLine(c.GetType().FullName);
    var so = new UnityEditor.SerializedObject(c);
    so.Update();
    var sp = so.GetIterator();
    while (sp.NextVisible(true)) {
        if (sp.name == "m_Script") continue;
        string val;
        switch (sp.propertyType) {
            case UnityEditor.SerializedPropertyType.Boolean: val = sp.boolValue.ToString(); break;
            case UnityEditor.SerializedPropertyType.Float: val = sp.floatValue.ToString("F3"); break;
            case UnityEditor.SerializedPropertyType.Integer: val = sp.intValue.ToString(); break;
            case UnityEditor.SerializedPropertyType.Enum: val = sp.enumNames[sp.enumValueIndex]; break;
            case UnityEditor.SerializedPropertyType.ObjectReference: val = sp.objectReferenceValue != null ? sp.objectReferenceValue.name : "null"; break;
            case UnityEditor.SerializedPropertyType.Vector3: val = sp.vector3Value.ToString("F2"); break;
            default: val = "[" + sp.propertyType + "]"; break;
        }
        sb.AppendLine("  " + sp.name + " = " + val);
    }
}
return sb.ToString();
CSHARP
```

## BOVINELABS TOOLING CATALOG

The BovineLabs ecosystem provides a complete game framework built on DOTS/ECS. Below is every
authoring component, timeline clip, and data type available, organized by package.

### Package Layout Convention (6-Assembly Architecture)
Every BovineLabs package follows this structure:
```
PackageName/
├── PackageName/                    # Runtime (ISystems, IJobEntity, runtime IComponentData)
├── PackageName.Data/               # Data (IComponentData, IBufferElementData, SharedData, blobs)
├── PackageName.Authoring/          # Authoring (MonoBehaviours + Bakers, UNITY_EDITOR only)
├── PackageName.Editor/             # Editor (CustomInspectors, PropertyDrawers)
├── PackageName.Debug/              # Debug (Debug systems, telemetry, UNITY_EDITOR || BL_DEBUG)
└── PackageName.Tests/              # Tests
```

**Assembly dependency chain**: `Runtime → Data`, `Authoring → Data + Runtime`, `Editor → Authoring`, `Debug → Data`.
The `Scripts` project in `Assets/Scripts/` mirrors this with: `Scripts`, `Scripts.Data`, `Scripts.Authoring`, `Scripts.Editor`, `Scripts.Debug`, `Scripts.Tests`.

### Core: LifeCycle System (`BovineLabs.Core`)
- **LifeCycleAuthoring** — Adds `InitializeEntity` (prefabs) or `InitializeSubSceneEntity` (scene objects) + `DestroyEntity` (disabled). Required by ReactionAuthoring.
- **ObjectDefinition** — ScriptableObject that maps an auto-incremented ID to a prefab. Used by spawn actions.
- **ObjectCategories** — Bitmask categorization for ObjectDefinitions.

### Core: Reaction System (`BovineLabs.Reaction`)
The reaction system is the backbone of gameplay logic. It provides an activation-based event system.

- **ReactionAuthoring** — Core authoring. Requires `LifeCycleAuthoring` + `TargetsAuthoring`. Fields: `Active` (ActiveAuthoring), `Conditions` (ConditionAuthoring).
- **TargetsAuthoring** — Defines Owner, Source, Target, Custom entity references. Required by ReactionAuthoring. Fields: `Owner` (GameObject), `Source` (GameObject), `Target` (GameObject), `Custom` (GameObject), `Initialize.Target` (Target enum).
- **Target enum**: `Self`, `Owner`, `Source`, `Target`, `Custom`.

#### Reaction Addon Actions (`com.bovinelabs.reaction.addon`)
All action authoring components require `[RequireComponent(typeof(ReactionAuthoring))]`.

| Authoring Component | When It Fires | What It Does | Key Fields |
|---|---|---|---|
| `ActionCreateOnActivateAuthoring` | Reaction activates | Spawns objects | `Spawns[]` (ObjectDefinition + Target) |
| `ActionCreateOnDeactivateAuthoring` | Reaction deactivates | Spawns objects | `Spawns[]` (ObjectDefinition + Target) |
| `ActionDestroyOnActivateAuthoring` | Reaction activates | Destroys target entity | `Target` (Target enum) |
| `ActionDestroyOnDeactivateAuthoring` | Reaction deactivates | Destroys target entity | `Target` (Target enum) |
| `ActionDestroyOnChanceFailAuthoring` | Chance roll fails | Destroys target entity | `Target` (Target enum) |

### Core: Essence System (`BovineLabs.Essence`)
Provides stats and intrinsics for RPG/fighter/character systems.

- **StatAuthoring** — Adds stats + intrinsics to entity. Fields: `AddStats`, `StatDefaults[]` (StatModifierAuthoring), `StatDefaultGroups[]`, `StatsCanBeModified`, `AddIntrinsics`, `IntrinsicDefaults[]`, `IntrinsicDefaultGroups[]`, `Initialize.CopyFrom`.
- **TransformAuthoring** — Sets `TransformUsageFlags` for the baked entity. Controls whether `LocalTransform` is preserved at runtime.

### Timeline: Core (`BovineLabs.Timeline.Core`)
- **TimelineReferenceAuthoring** — Links a PlayableDirector to an ECS entity via `TimelineReference` component. Required for all Timeline ECS tracks.

### Timeline: Physics (`BovineLabs.Timeline.Physics`)
Timeline clips that drive physics simulation:

| Clip | Track | Purpose |
|---|---|---|
| `PhysicsForceClip` | `PhysicsForceTrack` | Apply forces to physics bodies |
| `PhysicsVelocityClip` | `PhysicsVelocityTrack` | Override velocity directly |
| `PhysicsDragClip` | `PhysicsDragTrack` | Apply drag over time |
| `PhysicsTriggerForceClip` | `StatefulTriggerTrack` | Apply force on trigger events |
| `PhysicsTriggerInstantiateClip` | `StatefulTriggerTrack` | Spawn objects on trigger |
| `PhysicsTriggerConditionClip` | `StatefulTriggerTrack` | Conditional logic on triggers |
| `PhysicsLinearPIDClip` | `PhysicsLinearPIDTrack` | PID controller for position |
| `PhysicsAngularPIDClip` | `PhysicsAngularPIDTrack` | PID controller for rotation |
| `PhysicsGravityOverrideClip` | `PhysicsGravityOverrideTrack` | Override gravity per-entity |
| `PhysicsKinematicOverrideClip` | `PhysicsKinematicOverrideTrack` | Force kinematic mode |
| `PhysicsFilterOverrideClip` | `PhysicsFilterOverrideTrack` | Change collision filter at runtime |
| `PhysicsVelocityClampClip` | `PhysicsVelocityClampTrack` | Clamp max velocity |
| `PhysicsRicochetClip` | `PhysicsRicochetTrack` | Ricochet off surfaces |
| `Physicsteleportclip` | `Physicsteleporttrack` | Teleport physics body |

### Timeline: Animation (`BovineLabs.Timeline.Animation`)
- **RukhankaAnimationClip** / **RukhankaAnimationTrack** — Play animation clips via Rukhanka
- **BlendTree2DClip** / **BlendTree2DTrack** — 2D blend tree (movement blending)
- **AfterImageClip** / **AfterImageTrack** — Spawn after-image effects
- **FollowPositionOnlyAuthoring** — Follow another entity's position only (no rotation)
- **TimelineAnimationStateAuthoring** — State machine for animation transitions

### Timeline: PlayerInputs (`BovineLabs.Timeline.PlayerInputs`)
- **InputConsumerAuthoring** — Marks entity as input consumer
- **AxisTransformClip** / **AxisTransformTrack** — Map input axis to transform
- **CommandSequenceClip** / **CommandSequenceTrack** — Fighting game combo sequences
- **InputEventsClip** / **InputEventsTrack** — Fire events on input conditions
- **InputBufferWindowClip** / **InputBufferTrack** — Input buffering window
- **InputBufferClearClip** / **InputBufferTrack** — Clear input buffer

### Timeline: EntityLinks (`BovineLabs.Timeline.EntityLinks`)
Entity reference system for Timeline clips:
- **EntityLinkSourceAuthoring** — Root entity with link buffer
- **EntityLinkRootAuthoring** — Entity that owns the link map
- **EntityLinkSchema** — ScriptableObject defining link ID → entity mapping
- **EntityLinkMutateClip** / **EntityLinkMutateTrack** — Modify entity links at runtime
- **EntityLinkParentClip** / **EntityLinkParentTrack** — Parent entities together
- **EntityLinkTargetPatchClip** / **EntityLinkTargetPatchTrack** — Patch target references

### Timeline: Transform (`com.bovinelabs.timeline.transform`)
- **PositionClip** / **PositionTrack** — Animate position (with PositionStartClip)
- **RotationTrack** + `RotationLookAtStartClip` / `RotationLookAtTargetClip` — Animate rotation
- **ScaleClip** / **ScaleTrack** — Animate scale (with ScaleStartClip)

### Timeline: Time (`BovineLabs.Timeline.Time`)
- **TimelineTimeScaleClip** / **TimelineTimeScaleTrack** — Per-timeline time scaling
- **WorldTimeScaleClip** / **WorldTimeScaleTrack** — Global time scaling (slow-mo, bullet time)

### Timeline: Parenting (`com.bovinelabs.timeline.parenting`)
- **TemporaryDetachClip** / **TemporaryDetachTrack** — Temporarily detach child from parent during clip

### Timeline: Essence (`BovineLabs.Timeline.Essence`)
- **TimelineEssenceStatClip** / **TimelineEssenceStatTrack** — Modify stats from timeline
- **TimelineEssenceIntrinsicClip** / **TimelineEssenceIntrinsicTrack** — Modify intrinsics from timeline
- **TimelineEssenceEventClip** — Fire essence events from timeline
- **ActionTickDistributionAuthoring** — Distribute ticks across time curves

### HitStop (`BovineLabs.HitStop`)
- **HitStopAuthoring** — Triggers hit-stop (frame freeze) effect on hit. Used in fighting games.

### Physics Extras
- **PhysicsForceAccumulatorAuthoring** — Accumulate multiple forces on one body per frame
- **PhysicsDebugDisplayAuthoring** — Visual debug for physics colliders, contacts, events
- **SmearVelocityAuthoring** — Motion smear effect (stretch mesh along velocity)

## PROJECT ASSEMBLY MAP

The active BovineLabs project at `/home/i/GitHub/BovineLabs` uses these assemblies:

### Project Scripts (`Assets/Scripts/`)
| Assembly | Purpose | Key References |
|---|---|---|
| `Scripts` | Runtime systems & logic | BovineLabs.Core, Unity.Entities |
| `Scripts.Data` | IComponentData, buffers | BovineLabs.Core |
| `Scripts.Authoring` | MonoBehaviours + Bakers (UNITY_EDITOR) | Scripts.Data, BovineLabs.Core.Authoring |
| `Scripts.Editor` | Custom editors | Scripts.Authoring |
| `Scripts.Debug` | Debug systems | Scripts.Data |
| `Scripts.Tests` | Tests | Scripts, Scripts.Data |

### Packages (in `Packages/`)
| Package | Sub-packages |
|---|---|
| `BovineLabs.Timeline.Core` | Core, Core.Authoring, Core.Data, Core.Debug, Core.Tests |
| `BovineLabs.Timeline.Physics` | Physics, Physics.Authoring, Physics.Data, Physics.Debug, Physics.Editor, Physics.Rendering, Physics.Rendering.Authoring, Physics.Tests |
| `BovineLabs.Timeline.Animation` | Animation, Animation.Authoring, Animation.Data, Animation.Editor, Animation.Tests |
| `BovineLabs.Timeline.PlayerInputs` | PlayerInputs, PlayerInputs.Authoring, PlayerInputs.Data, PlayerInputs.Debug, PlayerInputs.Editor, PlayerInputs.Tests |
| `BovineLabs.Timeline.EntityLinks` | EntityLinks, EntityLinks.Authoring, EntityLinks.Data, EntityLinks.Debug, EntityLinks.Editor, EntityLinks.Tests |
| `BovineLabs.Timeline.Essence` | Essence, Essence.Authoring, Essence.Data, Essence.Debug, Essence.Editor, Essence.Tests |
| `BovineLabs.Timeline.Time` | Time, Time.Authoring, Time.Data, Time.Tests |
| `BovineLabs.Timeline.Distance` | Distance, Distance.Authoring, Distance.Data, Distance.Debug, Distance.Editor, Distance.Tests |
| `BovineLabs.HitStop` | HitStop, HitStop.Authoring, HitStop.Data, HitStop.Tests |
| `com.bovinelabs.reaction.addon` | Reaction.Addon, Reaction.Addon.Authoring, Reaction.Addon.Data, Reaction.Addon.Debug, Reaction.Addon.Editor, Reaction.Addon.Tests |
| `com.bovinelabs.timeline.parenting` | Parenting, Parenting.Authoring, Parenting.Debug |
| `com.bovinelabs.timeline.transform` | Transform, Transform.Authoring |

### Monorepo Packages (tertle-monorepo at `/home/i/GitHub/tertle-monorepo/`)
The full BovineLabs ecosystem includes additional packages not in every project:
- `com.bovinelabs.core` — Core framework (LifeCycle, ObjectManagement, Extensions, Iterators)
- `com.bovinelabs.reaction` — Reaction system (Active states, Conditions, Targets)
- `com.bovinelabs.essence` — Stats, Intrinsics, Buffers
- `com.bovinelabs.bridge` — Unity bridge (Audio, Camera, Spline, VFX bakers)
- `com.bovinelabs.canopy` — State machine system
- `com.bovinelabs.nerve` — Networking (Netcode for Entities)
- `com.bovinelabs.grove` — Scene management
- `com.bovinelabs.vibe` — Audio
- `com.bovinelabs.quill` — Debug drawing
- `com.bovinelabs.recast` — NavMesh/AI
- `com.bovinelabs.traverse` — Traversal/movement
- `com.bovinelabs.saving.free` — Save system
- `com.bovinelabs.anchor` — Anchor/tethering
- `com.bovinelabs.timeline` — Timeline base package

## GAME CREATION RECIPES

These recipes create complete game elements using BovineLabs authoring components. All objects
go into the SubScene by default (open additively, set active, save, close, restore parent).

### Recipe: Player Entity (Physics Character)
Creates a player with physics body, collider, target system, and reaction system.

```bash
cat << 'CSHARP' | unity-cli exec
var parentScene = UnityEditor.SceneManagement.EditorSceneManager.GetActiveScene();
var parentScenePath = parentScene.path;

// Find subscene path
var subScenePath = "";
var parentRoots = parentScene.GetRootGameObjects();
for (int i = 0; i < parentRoots.Length; i++) {
    var sub = parentRoots[i].GetComponent<Unity.Scenes.SubScene>();
    if (sub != null && sub.SceneAsset != null) {
        subScenePath = UnityEditor.AssetDatabase.GetAssetPath(sub.SceneAsset);
        break;
    }
}
if (string.IsNullOrEmpty(subScenePath)) return "ERROR|No SubScene found";

var subScene = UnityEditor.SceneManagement.EditorSceneManager.OpenScene(subScenePath, UnityEditor.SceneManagement.OpenSceneMode.Additive);
UnityEditor.SceneManagement.EditorSceneManager.SetActiveScene(subScene);

// Create player GameObject with primitives
var old = UnityEngine.GameObject.Find("Player");
if (old != null && old.scene.path == subScene.path) UnityEngine.Object.DestroyImmediate(old);

var player = UnityEngine.GameObject.CreatePrimitive(UnityEngine.PrimitiveType.Capsule);
player.name = "Player";
player.transform.position = new UnityEngine.Vector3(0f, 2f, 0f);
player.transform.localScale = UnityEngine.Vector3.one;

// Add Physics components (Unity Physics authoring)
var body = player.AddComponent<Unity.Physics.Authoring.PhysicsBodyAuthoring>();
body.SetMotionType(Unity.Physics.Authoring.PhysicsBodyAuthoring.MotionType.Dynamic);
body.Mass = 1f;
body.LinearDamping = 0.1f;
body.AngularDamping = 0.05f;
body.GravityFactor = 1f;

// Add TargetsAuthoring (required by Reaction system)
var targets = player.AddComponent<BovineLabs.Reaction.Authoring.Core.TargetsAuthoring>();

// Add LifeCycleAuthoring (required by ReactionAuthoring)
player.AddComponent<BovineLabs.Core.Authoring.LifeCycle.LifeCycleAuthoring>();

// Add ReactionAuthoring (activation/condition system)
player.AddComponent<BovineLabs.Reaction.Authoring.Core.ReactionAuthoring>();

// Add StatAuthoring for health/stats
player.AddComponent<BovineLabs.Essence.Authoring.StatAuthoring>();

// Add TransformAuthoring to ensure LocalTransform is preserved at runtime
var ta = player.AddComponent<BovineLabs.Essence.Authoring.TransformAuthoring>();
ta.TransformUsageFlags = Unity.Entities.TransformUsageFlags.Dynamic;

// Add EntityLinkSourceAuthoring for timeline entity linking
player.AddComponent<BovineLabs.Timeline.EntityLinks.Authoring.EntityLinkSourceAuthoring>();

UnityEditor.SceneManagement.EditorSceneManager.SaveScene(subScene);
UnityEditor.SceneManagement.EditorSceneManager.SetActiveScene(parentScene);
UnityEditor.SceneManagement.EditorSceneManager.CloseScene(subScene, false);
UnityEditor.SceneManagement.EditorSceneManager.SaveScene(parentScene);
UnityEditor.SceneManagement.EditorSceneManager.OpenScene(parentScenePath, UnityEditor.SceneManagement.OpenSceneMode.Single);
return "CREATED|Player in " + subScenePath;
CSHARP
```

### Recipe: Physics Prop (Destructible Crate)
Creates a physics-enabled prop with reaction system that destroys itself on deactivate.

```bash
cat << 'CSHARP' | unity-cli exec
var parentScene = UnityEditor.SceneManagement.EditorSceneManager.GetActiveScene();
var parentScenePath = parentScene.path;
var subScenePath = "";
var parentRoots = parentScene.GetRootGameObjects();
for (int i = 0; i < parentRoots.Length; i++) {
    var sub = parentRoots[i].GetComponent<Unity.Scenes.SubScene>();
    if (sub != null && sub.SceneAsset != null) { subScenePath = UnityEditor.AssetDatabase.GetAssetPath(sub.SceneAsset); break; }
}
if (string.IsNullOrEmpty(subScenePath)) return "ERROR|No SubScene";

var subScene = UnityEditor.SceneManagement.EditorSceneManager.OpenScene(subScenePath, UnityEditor.SceneManagement.OpenSceneMode.Additive);
UnityEditor.SceneManagement.EditorSceneManager.SetActiveScene(subScene);

var old = UnityEngine.GameObject.Find("Crate");
if (old != null && old.scene.path == subScene.path) UnityEngine.Object.DestroyImmediate(old);

var crate = UnityEngine.GameObject.CreatePrimitive(UnityEngine.PrimitiveType.Cube);
crate.name = "Crate";
crate.transform.position = new UnityEngine.Vector3(3f, 0.5f, 0f);
crate.transform.localScale = UnityEngine.Vector3.one;

var body = crate.AddComponent<Unity.Physics.Authoring.PhysicsBodyAuthoring>();
body.SetMotionType(Unity.Physics.Authoring.PhysicsBodyAuthoring.MotionType.Dynamic);
body.Mass = 5f;
body.LinearDamping = 0.5f;

crate.AddComponent<BovineLabs.Core.Authoring.LifeCycle.LifeCycleAuthoring>();
var targets = crate.AddComponent<BovineLabs.Reaction.Authoring.Core.TargetsAuthoring>();
var reaction = crate.AddComponent<BovineLabs.Reaction.Authoring.Core.ReactionAuthoring>();
var destroyAction = crate.AddComponent<BovineLabs.Reaction.Addon.Authoring.ActionDestroyOnDeactivateAuthoring>();
// destroyAction.Target defaults to Target.Self — destroys this crate when reaction deactivates

UnityEditor.SceneManagement.EditorSceneManager.SaveScene(subScene);
UnityEditor.SceneManagement.EditorSceneManager.SetActiveScene(parentScene);
UnityEditor.SceneManagement.EditorSceneManager.CloseScene(subScene, false);
UnityEditor.SceneManagement.EditorSceneManager.SaveScene(parentScene);
UnityEditor.SceneManagement.EditorSceneManager.OpenScene(parentScenePath, UnityEditor.SceneManagement.OpenSceneMode.Single);
return "CREATED|Crate in " + subScenePath;
CSHARP
```

## ECS TIMELINE & ARCHITECTURE EDGE CASES

When automating ECS generation, modifying DOTS Timeline tracks, or resolving compilation/runtime issues, adhere to these generalized rules:

### 1. Robust Scene Generation (Avoid CLI limits)
When tasked with creating complex ECS setups (many GameObjects, nested SubScenes, multiple DOTS authoring components), **do not** write massive `unity-cli exec` blocks. The CLI dynamic compiler struggles to resolve assemblies if the project has existing compile errors, creating circular blockers.
**Best Practice**: Create a standard Editor script (e.g., `Assets/Editor/RebuildShowcasesEditor.cs`) with a `[MenuItem("Tools/Rebuild")]`, and execute it. This leverages Unity's robust internal compiler and handles edge cases gracefully.

### 2. Timeline to ECS Bridging (The ECS-Pure Rule)
Timeline tracks in DOTS do not work like classic Unity components. If you are animating or driving an entity via Timeline (Physics, Animation, Transform):
- **Never** mix classic Unity components (like `BoxCollider`, `Rigidbody`, `Animator`) with DOTS Timeline tracks on the same object. Use pure DOTS authoring equivalents (`PhysicsBodyAuthoring`, `PhysicsShapeAuthoring`).
- **Always** include `TimelineReferenceAuthoring`. This is the crucial component that bridges the GameObject-based `PlayableDirector` to the ECS Entity world. Without it, the timeline clip will silently fail to affect the entity.

### 3. Component Dependencies in ECS Authoring
ECS authoring is highly interdependent. Adding a single component is rarely enough. In the BovineLabs ecosystem:
- Any interaction or reaction requires **`TargetsAuthoring`** (defines who acts on whom) and **`LifeCycleAuthoring`** (initializes the entity).
- Missing dependencies won't crash the editor, but the systems will silently ignore the entity at runtime. Always check the Authoring Component documentation and add the full stack.

### 4. WorldSystemFilter Mismatches
If the Unity console throws errors about systems failing to inject into groups (e.g., *"...could not be added to group X, because the group was not created in the world Editor World"*):
- This means an `[ISystem]` has `WorldSystemFilterFlags.Editor` (trying to run in the editor), but its designated `[UpdateInGroup]` is restricted to runtime worlds (like `ServerLocal`).
- **Fix**: Either remove `WorldSystemFilterFlags.Editor` from the system, or change its update group to one that exists in the Editor world.

### 5. Third-Party / Package Upgrades and Namespaces
When updating DOTS projects, be aware that structs and enums frequently shift between Unity's built-in packages and custom extension packages (e.g., `Unity.Physics.Stateful` migrating to `BovineLabs.Core.PhysicsStates`). If a type is "missing", don't assume the package is broken—use global searches (`grep_search`) across `Library/PackageCache` to find where the type was moved, then update the `using` statements and `.asmdef` references.