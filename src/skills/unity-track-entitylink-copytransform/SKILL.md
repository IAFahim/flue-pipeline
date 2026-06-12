---
name: unity-track-entitylink-copytransform
description: Master of EntityLinkCopyTransformTrack + clip in vex-ee — schema-link resolution, the Target enum, follow/attach via per-frame transform copy, and the unassigned-ECB package bug. Use when a designer asks "make this follow/attach to that linked thing during a clip".
---

# EntityLinkCopyTransformTrack specialist

You are the specialist for **`EntityLinkCopyTransformTrack`** and
**`EntityLinkCopyTransformClip`** from the EntityLinks package at
`Packages/BovineLabs.Timeline.EntityLinks/` (under `Packages/`, NOT
PackageCache — unlike timeline core), namespace
`BovineLabs.Timeline.EntityLinks.Authoring`. Scope: exactly this track family —
making one entity follow/attach to a schema-link-resolved source entity via a
per-frame world-pose copy while a clip is active.

**This skill also carries the EntityLinks FAMILY reference material**: the
verified `Target` enum, the three-step resolver walkthrough, and the
loud-bake/silent-runtime rule. The topics 08-10 skills (Mutate, Parent,
TargetPatch) cross-reference these sections rather than restating them.

All facts below were verified live in the **vex-ee** project, **2026-06**
(reflection dumps, package-source quotes via `File.ReadAllText` inside
`unity-cli exec`, raw YAML reads, fresh-load read-backs). No play mode: all
runtime claims are source-derived; the overlap verdict is explicitly
INCONCLUSIVE and stated honestly below.

## Prerequisites & environment

- Act only through `unity-cli exec` / `unity-cli console`; never touch vex-ee
  via the filesystem; never enter play mode. Follow the **unity-cli skill's
  Safe Loop** (inspect → mutate once → save → verify → restore → console check)
  on every mutation.
- Verify the live project first:
  `unity-cli exec "return UnityEditor.SceneManagement.EditorSceneManager.GetActiveScene().path + \"|\" + Application.dataPath;"`
  → expect `Assets/Scenes/Main Scene.unity|/home/i/GitHub/vex-ee/Assets`.
- The `TrainingStage` (unity-stage-foundations) must exist in SubScene
  `Assets/Scenes/Main Sub Scene.unity` with the link wiring this track depends on:
  **Stage_Actor** carries `TargetsAuthoring` (Target=Stage_Target) AND
  `EntityLinkSource` (Root=Stage_LinkRoot, Schemas=[Schema_Actor]);
  **Stage_LinkRoot** bakes the `EntityLinkEntry` buffer;
  **Schema_Actor** at `Assets/Training/00-foundations/Schema_Actor.asset` has
  imported `id: 10` (assigned at import — never read it in the creating block).
- **NEVER create new schema assets** — reuse Schema_Actor (failure-protocol rule).
- Your assets live only under `Assets/Training/07-entitylink-copytransform-track/`.
  Canonical asset: `CopyTransformMastery.playable` — track `CopyTransformTrack`,
  clip A_HoverFollow (0–4s, posOffset (0,3,0), copyRot=false, readRootFrom=Self)
  and clip B_FullSnap (4–6s, copy both, rotOffset (0,90,0), readRootFrom=Self).

## VERIFIED facts (vex-ee, 2026-06)

| Type | Base | Facts |
|---|---|---|
| `EntityLinkCopyTransformTrack` | `DOTSTrack` | sealed, `[TrackBindingType(typeof(TargetsAuthoring))]` (`BovineLabs.Reaction.Authoring.Core.TargetsAuthoring`), `[TrackColor(0.85,0.2,0.4)]`, `[TrackClipType(EntityLinkCopyTransformClip)]`, `[DisplayName("BovineLabs/Entity Links/Copy Transform")]`, no Bake override. |
| `EntityLinkCopyTransformClip` | `DOTSClip` | `ClipCaps.None` (no blend/ease), `duration => 1` (seed only — freely resizable after `CreateClip`). |

### Clip fields (reflection + fresh-instance defaults)
| Field | Type | Default | Meaning |
|---|---|---|---|
| `entityToMove` | `Target` | `Target` (=1) | WHO MOVES — resolved through the binding entity's `Targets` |
| `readRootFrom` | `Target` | `Owner` (=2) | Where to start the link-map hunt (TRAP — see edge cases) |
| `link` | `EntityLinkSchema` | null | The ushort key; null → LOUD bake error (see edge cases) |
| `copyPosition` | bool | True | Copy mask |
| `copyRotation` | bool | True | Copy mask |
| `positionOffset` | Vector3 | (0,0,0) | Applied in SOURCE space |
| `rotationOffset` | Vector3 | (0,0,0) | Euler degrees, baked to quaternion |

Bake produces `EntityLinkCopyTransform { Target EntityToMove; Target
ReadRootFrom; ushort LinkKey; bool CopyPosition; bool CopyRotation; float3
PositionOffset; quaternion RotationOffset; }` on the clip entity (via
`EntityLinkCopyTransformBuilder.ApplyTo`). The Euler→quaternion conversion is
bake-time: `RotationOffset = quaternion.Euler(math.radians(rotationOffset))`.
The .playable YAML stores the authored Euler verbatim (`rotationOffset: {x: 0,
y: 90, z: 0}`); the quaternion only exists post-bake.

## FAMILY REFERENCE 1 — the verified `Target` enum

`BovineLabs.Reaction.Data.Core.Target`, assembly `BovineLabs.Reaction.Data`,
**byte-backed**:

```
None=0, Target=1, Owner=2, Source=3, Self=4, Custom=6
```

**Value 5 does not exist** (gap before Custom=6), and the member order differs
from older docs. `(int)` casts on boxed values throw (byte-backed) — use
`System.Convert.ToInt64`. Resolution semantics, quoted from `Targets.Get`:

```csharp
return target switch
{
    Core.Target.None => Entity.Null,
    Core.Target.Target => this.Target,
    Core.Target.Owner => this.Owner,
    Core.Target.Source => this.Source,
    Core.Target.Self => self,
    Core.Target.Custom => this.Custom,
    _ => Entity.Null,
};
```

`Targets` is `IComponentData { Entity Owner, Source, Target, Custom }`, baked
from `TargetsAuthoring`. `Self` = the entity carrying the `Targets` component
(for timeline clips: the **track-binding entity**). `None` and unset slots
resolve to `Entity.Null`.

## FAMILY REFERENCE 2 — the resolver walkthrough

Every EntityLinks clip resolves a SOURCE entity through the same three-step
chain in `EntityLinkResolver` (`BovineLabs.Timeline.EntityLinks/EntityLinkResolver.cs`):

**Step 0 — Target enum hop.** `targets.Get(readRootFrom, self)` where
`targets` is the track-binding entity's `Targets` and `self` is the binding
entity. `None`/unset slot → `Entity.Null` → resolution fails immediately.

**Step 1 — root hop** (`TryResolveRoot`):

```csharp
root = sources.TryGetComponent(entity, out var source) && source.Root != Entity.Null
    ? source.Root
    : entity;
```

If the candidate carries `EntityLinkSource` (struct `{ Entity Root; }`) with a
non-null Root, hop there; otherwise **the candidate itself is the root** — no error.

**Step 2 — buffer search** (`TryResolveFromRoot`): linear search of the root's
`EntityLinkEntry` buffer (`{ ushort Key; Entity Target; }`, baked by
`EntityLinkRootAuthoring`'s baker) for `Key == LinkKey`. Guards: null root,
**key 0**, missing buffer, key absent — all return false **silently**.

On the TrainingStage with clip A: binding = Stage_Actor → `readRootFrom=Self`
→ Stage_Actor itself → `EntityLinkSource.Root = Stage_LinkRoot` → root hop →
its buffer holds `{Key=10, Target=Stage_Actor}` → SOURCE = Stage_Actor. Then
`entityToMove=Target` → Stage_Target. Net: **the cube copies the capsule's
world position + (0,3,0) in the capsule's local frame, every active frame**.

## FAMILY REFERENCE 3 — the loud-bake/silent-runtime rule

Bake is the ONE loud layer: a null schema makes `EntityLinkAuthoringUtility.TryGetKey`
(`key = schema == null ? (ushort)0 : schema.Id; return key != 0;`) return
false and `Bake` does `Debug.LogError($"... '{name}' missing link schema.");
return;` — the component is never added. EVERY runtime failure (null binding,
missing Targets, Entity.Null slot, missing LocalTransform, key 0, key absent,
missing buffer, source without LocalToWorld) is a silent per-frame skip —
CopyTransform hardwires `Fallback = Target.None`. The family clips (08-10)
share this same null-link bake `LogError` pattern, `ClipCaps.None`, and
`duration => 1`.

## Runtime copy mechanics (`EntityLinkCopyTransformSystem.CopyTransformJob`)

`[WithAll(typeof(ClipActive))]`, runs every active frame in
`TimelineComponentAnimationGroup`: resolve mover via
`targets.Get(EntityToMove, binding)`; resolve SOURCE via the family resolver;
take the source's `LocalToWorld` pose; apply offsets **in source space**:

```csharp
if (config.CopyPosition && math.lengthsq(config.PositionOffset) > 0)
    desiredWorldPos += math.rotate(desiredWorldRot, config.PositionOffset);
if (config.CopyRotation && !config.RotationOffset.Equals(quaternion.identity))
    desiredWorldRot = math.mul(desiredWorldRot, config.RotationOffset);
```

then, if the mover has a `Parent` with `LocalToWorld`, convert world →
parent-local before writing `LocalTransform`
(`targetTransform.Position = math.transform(math.inverse(parentLtw.Value), desiredWorldPos)`;
rotation via `math.mul(math.inverse(parentWorldTransform.Rotation), desiredWorldRot)`),
else write world values directly. Copy mask is per-channel; the untouched
channel keeps the mover's current value. The write goes through the
BeginSimulation ECB — one frame latent, whole-component replace, no blending.

### THE UNASSIGNED-ECB PACKAGE BUG (triage rule)

In the shipped `EntityLinkCopyTransformSystem.OnUpdate`, the command buffer is
created but **never assigned to the job** — the `// ECB = ecb` line is missing
from the job initializer, so the job's `EntityCommandBuffer.ParallelWriter ECB`
field is default and `ECB.SetComponent` operates on an uninitialized writer,
expected to throw at the first fully-resolved active frame. NOT play-mode
verified (play mode forbidden); it is a literal reading of the shipped source.
**Triage rule: anyone debugging "CopyTransform clip does nothing / throws"
checks this line in `OnUpdate` FIRST**, before suspecting their own wiring.

## Canonical recipe — "make the cube follow/attach to the linked capsule" (verbatim from the report)

1. Stage prerequisites (lesson 00): mover and source entities baked in the
   SubScene; source carries `EntityLinkSourceAuthoring` (Root auto-filled from
   parent `EntityLinkRootAuthoring`, Schemas containing your `EntityLinkSchema`
   asset); the binding object carries `TargetsAuthoring` with `Target` = the
   mover; director has `TimelineReferenceAuthoring`.
2. In the timeline: add track **BovineLabs/Entity Links/Copy Transform**; bind
   it to the `TargetsAuthoring` component of the object whose Targets describe
   the cast (here Stage_Actor): `director.SetGenericBinding(track,
   stageActor.GetComponent<TargetsAuthoring>())`.
3. Add an `EntityLinkCopyTransformClip`: `entityToMove = Target` (the cube),
   `readRootFrom = Self` (the bound actor carries the EntityLinkSource),
   `link` = your schema asset, set the copy mask and offsets. PositionOffset is
   in the SOURCE's local frame; rotationOffset is Euler degrees twisted onto
   the source rotation. The hover-follow pattern: copyPosition=true,
   copyRotation=false, positionOffset=(0,3,0) → hovers 3 units above the
   source in ITS local up, following it while the clip runs.
4. While the clip is active the mover snaps to the source pose every frame
   (one frame latent via BeginSimulation ECB); outside the clip nothing
   touches it. There is no blending — entry/exit are hard snaps.
5. If nothing happens: check (in order) bake-time "missing link schema" error,
   schema id ≠ 0, binding is the TargetsAuthoring with the right slots filled,
   the source is under the link root, and the unassigned-ECB anomaly.

Asset-side proof shape (clip A YAML — schema ref is an asset→asset guid; enums
serialize as byte values, `readRootFrom: 4` = Self):

```yaml
m_Name: A_HoverFollow
entityToMove: 1
readRootFrom: 4
link: {fileID: 11400000, guid: 3b375c42affc2917f956d01310d31894, type: 2}
copyPosition: 1
copyRotation: 0
positionOffset: {x: 0, y: 3, z: 0}
```

## Edge cases & traps (each proven live or source-quoted, 2026-06)

- **DON'T expect a silent skip from a null schema — it is a LOUD bake LogError** —
  temp clip with `link: {fileID: 0}` made `Bake` log
  `"EntityLinkCopyTransformClip '<name>' missing link schema."` and return; the
  component is never added.
- **DO know the ONE silent bake path: an id-0 pre-import schema** — a schema
  asset read in its creating block before import still has id 0; it bakes fine
  (key 0 in the component) but `TryResolveFromRoot`'s `key != 0` guard makes it
  never resolve, silently.
- **DO rely on the root-hop fallback** — an entity without `EntityLinkSource`
  is its own root (`root = ... : entity;`); if it also has no `EntityLinkEntry`
  buffer, `TryGetBuffer` fails → `Entity.Null` → silent per-frame skip, no log.
- **DON'T trust the default `readRootFrom = Owner`** — on a binding whose
  `Targets.Owner` is unset (Stage_Actor!), Owner resolves to `Entity.Null` and
  the clip silently never resolves. **Use `Self` when the bound entity itself
  carries the EntityLinkSource** — the report set clip B to Self for exactly
  this reason.
- **DO read offsets in SOURCE space** — `desiredWorldPos +=
  math.rotate(desiredWorldRot, config.PositionOffset)`: (0,3,0) is "3 units
  along the SOURCE's local up"; a source pitched 90° puts the follower at +3
  world X, not above. The offset rides the source's orientation every frame.
- **DO trust the parent-aware write** — the desired WORLD pose is converted
  into the mover's parent space before writing `LocalTransform`, so the visual
  result is parent-independent; caveat: a `Parent` without `LocalToWorld`
  falls through to the world-space write, double-transforming.
- **DON'T expect blending — `ClipCaps.None` means hard snaps** at clip
  entry/exit; the Timeline editor offers no blend/ease handles.
- **DON'T claim an overlap winner — honestly INCONCLUSIVE** — overlapping
  active clips (two tracks, same mover) each `ECB.SetComponent` the whole
  `LocalTransform`; playback order is by `sortKey = [EntityIndexInQuery]`
  (chunk order of clip entities) — last-writer-wins by entity-in-query order,
  NOT by clip start time, and moot until the ECB bug is fixed. The play-mode
  test that would settle it: two CopyTransform tracks on one director, same
  mover, clip 1 positionOffset (0,3,0) vs clip 2 (0,-3,0), overlap 1s, observe
  which offset the cube holds, swap track creation order, re-run.
- **DON'T create new schema assets** — reuse Schema_Actor (id=10); schema ids
  are assigned at import and a freshly created asset reads id 0 in its
  creating exec block.

### Family preview (topics 08-10, reflection-dumped)

- `EntityLinkMutateClip` — rewrites the root's `EntityLinkEntry` buffer:
  `mode` (`EntityLinkMutateMode`: Assign=0, Swap=1, Remove=2), `link`,
  `readRootFrom` (default **Source**), `newTarget` (default Target), `swapLink`.
- `EntityLinkParentClip` — reparents `entityToParent` (default Target) under
  the link-resolved entity with `localPosition`/`localRotation` (Euler, same
  `quaternion.Euler(math.radians(...))` bake) and `restoreOnEnd` (default true).
- `EntityLinkTargetPatchClip` — writes the link-resolved entity INTO the
  binding's `Targets` slot `WriteTo` (default Target), with `Fallback` (default
  Target); bake hard-errors on `WriteTo` of `None` or `Self`.

## Verification protocol

1. **Fresh-load asset dump**: `AssetDatabase.LoadAssetAtPath` the .playable in
   a NEW exec block; dump track + clips (name, start/end, entityToMove,
   readRootFrom, link asset + its imported id, copy mask, offsets). In-memory
   state after a save is not evidence.
2. **Raw YAML check**: `link:` is `{fileID: 11400000, guid: …, type: 2}` (never
   `{fileID: 0}`); enum bytes match intent (`entityToMove: 1`,
   `readRootFrom: 4`); authored Euler stored verbatim.
3. **Schema check**: read Schema_Actor.asset YAML fresh; `id:` must be non-zero
   (10 on the stage).
4. **Binding check from a RELOADED SubScene**: `binding[CopyTransformTrack] =
   Stage_Actor (TargetsAuthoring)` — the component, not the Transform — and the
   other stage bindings intact (table was 5 entries post-lesson-07; keyed by
   track asset, survives playableAsset swaps).
5. **Parent-scene restore**: end with sceneCount=1,
   `Assets/Scenes/Main Scene.unity|loaded=True|active=True|dirty=False`,
   director restored to its prior playableAsset.
6. **Console**: `unity-cli console --filter error` must show nothing new except
   any DELIBERATE "missing link schema" demo (remove the temp clip after);
   known pre-existing vex-ee entries are UnityCliConnector HTTP server start,
   PerformanceTesting IPrebuildSetup/IPostBuildCleanup, TestResults.xml save.
