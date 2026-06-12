---
name: unity-track-entitylink-copytransform
description: Master of EntityLinkCopyTransformTrack + EntityLinkCopyTransformClip (EntityLinks package, BovineLabs.Timeline.EntityLinks) — schema-link resolution, the verified Target enum, follow/attach via per-frame transform copy, and the unassigned-ECB package bug. Portable to any project containing the package; worked example from vex-ee. Use when a designer asks "make this follow/attach to that linked thing during a clip".
---

# EntityLinkCopyTransformTrack specialist

## 1. SCOPE

You are the specialist for **`EntityLinkCopyTransformTrack`** and **`EntityLinkCopyTransformClip`**
from the EntityLinks package (`BovineLabs.Timeline.EntityLinks`, namespace
`BovineLabs.Timeline.EntityLinks.Authoring`). Scope: exactly this track family — making one
entity follow/attach to a schema-link-resolved source entity via a per-frame world-pose copy
while a clip is active. **This skill also carries the EntityLinks FAMILY reference material**
(the verified `Target` enum, the three-step resolver, the loud-bake/silent-runtime rule) — the
Mutate, Parent and TargetPatch skills cross-reference these sections rather than restating
them. Stage construction belongs to `unity-stage-foundations`; the other three EntityLinks
tracks to their own skills. Behave per unity-agent-protocol; operate the editor per unity-cli.

## 2. PORTABLE SEMANTICS

True in ANY project containing the EntityLinks package. Provenance tags say where a fact was
PROVEN, not where it applies. (All verified vex-ee 2026-06 via reflection dumps, package-source
quotes through `File.ReadAllText` inside `unity-cli exec`, raw YAML reads, fresh-load
read-backs. No play mode: runtime claims are source-derived; the overlap verdict is honestly
INCONCLUSIVE.) In the proving project the package source lives under `Packages/` (NOT
PackageCache, unlike timeline core) — locate it by query, not by habit.

| Type | Base | Facts |
|---|---|---|
| `EntityLinkCopyTransformTrack` | `DOTSTrack` | sealed, `[TrackBindingType(typeof(TargetsAuthoring))]` (`BovineLabs.Reaction.Authoring.Core.TargetsAuthoring`), `[TrackColor(0.85,0.2,0.4)]`, `[TrackClipType(EntityLinkCopyTransformClip)]`, `[DisplayName("BovineLabs/Entity Links/Copy Transform")]`, no Bake override. |
| `EntityLinkCopyTransformClip` | `DOTSClip` | `ClipCaps.None` (no blend/ease), `duration => 1` (seed only — freely resizable after `CreateClip`). |

### Clip fields (reflection + fresh-instance defaults)
| Field | Type | Default | Meaning |
|---|---|---|---|
| `entityToMove` | `Target` | `Target` (=1) | WHO MOVES — resolved through the binding entity's `Targets` |
| `readRootFrom` | `Target` | `Owner` (=2) | Where to start the link-map hunt (TRAP — see traps) |
| `link` | `EntityLinkSchema` | null | The ushort key; null → LOUD bake error |
| `copyPosition` / `copyRotation` | bool | True / True | Copy mask, per-channel |
| `positionOffset` | Vector3 | (0,0,0) | Applied in SOURCE space |
| `rotationOffset` | Vector3 | (0,0,0) | Euler degrees, baked to quaternion |

Bake produces `EntityLinkCopyTransform { Target EntityToMove; Target ReadRootFrom; ushort
LinkKey; bool CopyPosition; bool CopyRotation; float3 PositionOffset; quaternion RotationOffset; }`
on the clip entity (`EntityLinkCopyTransformBuilder.ApplyTo`). Euler→quaternion is bake-time:
`RotationOffset = quaternion.Euler(math.radians(rotationOffset))`; the .playable YAML stores the
authored Euler verbatim — the quaternion only exists post-bake.

### FAMILY REFERENCE 1 — the verified `Target` enum

`BovineLabs.Reaction.Data.Core.Target`, assembly `BovineLabs.Reaction.Data`, **byte-backed**:
`None=0, Target=1, Owner=2, Source=3, Self=4, Custom=6`. **Value 5 does not exist** (gap before
Custom=6); member order differs from older docs. `(int)` casts on boxed values throw — use
`System.Convert.ToInt64`. `Targets.Get` semantics (source-quoted): `None → Entity.Null;
Target/Owner/Source/Custom → that slot; Self → self`. `Targets` is `IComponentData { Entity
Owner, Source, Target, Custom }`, baked from `TargetsAuthoring`; `Self` = the entity carrying
the `Targets` (for timeline clips: the **track-binding entity**); `None` and unset slots
resolve to `Entity.Null`.

### FAMILY REFERENCE 2 — the resolver walkthrough

Every EntityLinks clip resolves a SOURCE entity through the same three-step chain in
`EntityLinkResolver` (`BovineLabs.Timeline.EntityLinks/EntityLinkResolver.cs`):
**Step 0 — Target enum hop.** `targets.Get(readRootFrom, self)` on the track-binding entity's
`Targets`; `None`/unset slot → `Entity.Null` → resolution fails immediately.
**Step 1 — root hop** (`TryResolveRoot`, source-quoted): `root = sources.TryGetComponent(entity,
out var source) && source.Root != Entity.Null ? source.Root : entity;` — if the candidate
carries `EntityLinkSource` (struct `{ Entity Root; }`) with non-null Root, hop there; otherwise
**the candidate itself is the root** — no error.
**Step 2 — buffer search** (`TryResolveFromRoot`): linear search of the root's `EntityLinkEntry`
buffer (`{ ushort Key; Entity Target; }`, baked by `EntityLinkRootAuthoring`'s baker) for
`Key == LinkKey`. Guards: null root, **key 0**, missing buffer, key absent — all return false
**silently**. (Concrete walkthrough on the worked-example stage in §5.)

### FAMILY REFERENCE 3 — the loud-bake/silent-runtime rule

Bake is the ONE loud layer: a null schema makes `EntityLinkAuthoringUtility.TryGetKey`
(`key = schema == null ? (ushort)0 : schema.Id; return key != 0;`) return false and `Bake` does
`Debug.LogError($"... '{name}' missing link schema."); return;` — the component is never added.
EVERY runtime failure (null binding, missing Targets, Entity.Null slot, missing LocalTransform,
key 0, key absent, missing buffer, source without LocalToWorld) is a silent per-frame skip —
CopyTransform hardwires `Fallback = Target.None`. The family clips share this null-link bake
`LogError` pattern, `ClipCaps.None`, and `duration => 1`. Family one-liners (reflection-dumped;
full facts in the sibling skills): MutateClip rewrites the root's `EntityLinkEntry` buffer
(`mode` Assign=0/Swap=1/Remove=2, `readRootFrom` default **Source**, `newTarget` default Target,
`swapLink`); ParentClip reparents `entityToParent` (default Target) under the link-resolved
entity with `localPosition`/`localRotation` + `restoreOnEnd` (default true); TargetPatchClip
writes the link-resolved entity INTO the binding's `Targets` slot `WriteTo` (default Target)
with `Fallback`, bake-erroring on `WriteTo` None/Self.

### Runtime copy mechanics (`EntityLinkCopyTransformSystem.CopyTransformJob`)

`[WithAll(typeof(ClipActive))]`, every active frame in `TimelineComponentAnimationGroup`:
resolve mover via `targets.Get(EntityToMove, binding)`; resolve SOURCE via the family resolver;
take the source's `LocalToWorld` pose; apply offsets **in source space** (source-quoted:
`desiredWorldPos += math.rotate(desiredWorldRot, config.PositionOffset)` when CopyPosition and
offset non-zero; `desiredWorldRot = math.mul(desiredWorldRot, config.RotationOffset)` when
CopyRotation and non-identity — position offset rotated by the source's CURRENT pre-offset
rotation; rotation offset right-multiplied, a local-space twist); then, if the mover has a
`Parent` with `LocalToWorld`, convert world → parent-local before writing `LocalTransform`,
else write world directly. Copy mask is per-channel; the untouched channel keeps the mover's
current value. The write goes through the BeginSimulation ECB — one frame latent, whole-component
replace, no blending. Per-frame only: nothing persists after the clip deactivates, and nothing
ever touches editor/authoring state.

### PACKAGE BUG — THE UNASSIGNED ECB (triage rule; portable truth about this package version)

In the shipped `EntityLinkCopyTransformSystem.OnUpdate`, the command buffer is created but
**never assigned to the job** — the `ECB = ecb` line is missing from the job initializer, so
`ECB.SetComponent` operates on an uninitialized writer, expected to throw at the first
fully-resolved active frame. NOT play-mode verified (play mode forbidden); literal reading of
the shipped source. **Triage rule: anyone debugging "CopyTransform clip does nothing / throws"
checks this line in `OnUpdate` FIRST**, before suspecting their own wiring.

### Traps & DO/DON'T (each proven live or source-quoted, vex-ee 2026-06)

- **DON'T expect a silent skip from a null schema — LOUD bake LogError**
  (`"EntityLinkCopyTransformClip '<name>' missing link schema."`); component never added.
- **DO know the ONE silent bake path: an id-0 pre-import schema** — read pre-import it has id 0;
  it bakes fine (key 0) but the `key != 0` guard makes it never resolve, silently. Ids are
  assigned at import — always read ids from a FRESH load.
- **DO rely on the root-hop fallback** — an entity without `EntityLinkSource` is its own root;
  no `EntityLinkEntry` buffer there → `Entity.Null` → silent per-frame skip, no log.
- **DON'T trust the default `readRootFrom = Owner`** — on a binding whose `Targets.Owner` is
  unset, Owner → `Entity.Null` → the clip silently never resolves (proven on the vex-ee stage,
  §5). **Use `Self` when the bound entity itself carries the EntityLinkSource**; derive from the
  discovered slot layout (§3.4), never from the default.
- **DO read offsets in SOURCE space** — (0,3,0) is "3 units along the SOURCE's local up"; a
  source pitched 90° puts the follower at +3 world X, not above; the offset rides the source's
  orientation every frame.
- **DO trust the parent-aware write** — the desired WORLD pose is converted into the mover's
  parent space before the write, so the visual result is parent-independent; caveat: a `Parent`
  without `LocalToWorld` falls through to the world write, double-transforming.
- **DON'T expect blending — `ClipCaps.None` means hard snaps** at clip entry/exit.
- **DON'T claim an overlap winner — honestly INCONCLUSIVE** — overlapping active clips (two
  tracks, same mover) each `ECB.SetComponent` the whole `LocalTransform`; playback order is
  `sortKey = [EntityIndexInQuery]` (chunk order) — last-writer-wins by entity-in-query order,
  NOT clip start time, and moot until the ECB bug is fixed.
- **DON'T create schema assets — a missing prerequisite (protocol §6)** — discover existing ones by type
  (§3.4); report a missing/id-0 schema as a missing prerequisite.

## 3. DISCOVERY RECIPES

Act only through `unity-cli exec` / `unity-cli console`; never the filesystem; never play mode;
unity-cli Safe Loop on every mutation. Names below are parameters — discover them in THIS
project; never assume the worked example (§5).

**3.1 Confirm the package exists (else report a missing prerequisite — protocol §6):**
```csharp
var t = System.Type.GetType("BovineLabs.Timeline.EntityLinks.Authoring.EntityLinkCopyTransformTrack, BovineLabs.Timeline.EntityLinks.Authoring");
var b = System.Type.GetType("BovineLabs.Reaction.Authoring.Core.TargetsAuthoring, BovineLabs.Reaction.Authoring");
return t == null || b == null
    ? "MISSING_PREREQUISITE|EntityLinks track or TargetsAuthoring binding type absent in this project"
    : "OK|" + t.AssemblyQualifiedName + "|dataPath=" + UnityEngine.Application.dataPath;
```

**3.2 Find the active scene + SubScene(s):** run the unity-cli skill's First Command (scene
path, roots, SubScenes → their `.unity` paths); record `parentScenePath` + `subScenePath`(s).

**3.3 Find PlayableDirector(s) inside the SubScene** (read-only additive open, restore parent
after) via `FindObjectsByType<UnityEngine.Playables.PlayableDirector>(FindObjectsInactive.Include,
FindObjectsSortMode.None)`; print per director the hierarchy path, `scene.path`, `playableAsset`
(path or null), sibling components. STATE your selection rule in the memory card (e.g. "the only
director in the active SubScene"); zero directors → protocol §6.

**3.4 Discover the cast and the link wiring** (read-only, same SubScene bracket):
- Binding candidates: `FindObjectsByType<BovineLabs.Reaction.Authoring.Core.TargetsAuthoring>`
  — print each holder's hierarchy path AND its slot values (Owner/Source/Target/Custom). The
  track binds the **TargetsAuthoring COMPONENT**, never the Transform.
- Link wiring: find `EntityLinkSourceAuthoring` and `EntityLinkRootAuthoring` holders; print
  each source's Root + Schemas and each root's children/key set.
- Schema assets by TYPE with a live id dump — ids drift; never trust remembered values:
  `AssetDatabase.FindAssets("t:EntityLinkSchema")` → per asset print
  `SCHEMA|<path>|guid=<g>|id=<n>`, reading the id by reflecting the `Id` property (or `id`
  field) and converting via `System.Convert.ToInt64` (byte/ushort-backed). id==0 ⇒ unusable
  (silent never-resolve). **NEVER create schema assets** — out of domain (a missing prerequisite); a usable
  schema must already exist with a non-zero imported id AND its key present in the intended
  root's source set.
- Derive `readRootFrom` from the discovered layout: `Self` if the bound object itself carries
  the EntityLinkSource; otherwise the Targets slot whose entity carries it — confirm the slot
  is actually SET.

**3.5 Capture the chosen director's existing state — this is pre-state (`PRE|`)**:
```csharp
// PRE|playableAsset=<asset PATH or null>   via AssetDatabase.GetAssetPath(director.playableAsset)
// PRE|binding|<i>|<track name>|<track type>|<bound object hierarchy path + component type, or null>
//   one line per GetOutputTracks() of the CURRENT asset, via director.GetGenericBinding(track).
// Capture the asset PATH and each track's NAME/index even when the table looks empty — they make
// the undo journal replayable (UNDO-1 reloads the old asset by path, re-binds by name/index).
// Binding tables are keyed by track asset and SURVIVE playableAsset swaps — capture the WHOLE table.
```
Record these in the undo journal (§6) before any mutation.

**Name resolution rule**: `GameObject.Find` misses inactive objects and is ambiguous on
duplicate names. Discovery must confirm the chosen name is active and unique in the SubScene;
otherwise resolve by walking the SubScene's roots to the recorded hierarchy path (or
`FindObjectsByType` filtered by `scene`) instead of `Find`.

## 4. CANONICAL RECIPES

One logical change per exec block; each block prints its `PRE|` capture before mutating
(protocol §2), saves inside the block, and is verified from a fresh load (§7).

**4.1 Create timeline + track + clips, then wire the director:**

```csharp
// ---- parameters (discovered in §3 / chosen with designer) ----
var parentScenePath = "<DISCOVERED>"; var subScenePath = "<DISCOVERED>";    // §3.2
var directorGoName  = "<DISCOVERED>";                                        // §3.3
var bindTargetPath  = "<DISCOVERED>"; // §3.4 — object whose TargetsAuthoring describes the cast
var schemaPath      = "<DISCOVERED>"; // §3.4 — existing schema, id != 0, key in the root's buffer
var assetFolder = "<CHOSEN>"; var assetPath = assetFolder + "/<Name>.playable"; var trackName = "<CHOSEN>";
var parentScene = UnityEditor.SceneManagement.EditorSceneManager.GetActiveScene();
var subScene = UnityEditor.SceneManagement.EditorSceneManager.OpenScene(
    subScenePath, UnityEditor.SceneManagement.OpenSceneMode.Additive);
UnityEditor.SceneManagement.EditorSceneManager.SetActiveScene(subScene);
try {
    // CAPTURE (print + journal): PRE|folderExisted=<bool> PRE|assetExisted=<bool>
    var folderExisted = UnityEditor.AssetDatabase.IsValidFolder(assetFolder);
    if (!folderExisted) { /* CreateFolder for each missing segment */ }

    var timeline = UnityEngine.ScriptableObject.CreateInstance<UnityEngine.Timeline.TimelineAsset>();
    UnityEditor.AssetDatabase.CreateAsset(timeline, assetPath);
    var track = timeline.CreateTrack<BovineLabs.Timeline.EntityLinks.Authoring.EntityLinkCopyTransformTrack>(null, trackName);
    var schema = UnityEditor.AssetDatabase.LoadAssetAtPath<BovineLabs.Timeline.EntityLinks.Authoring.EntityLinkSchema>(schemaPath);

    // Pattern HOVER-FOLLOW: position only, offset in SOURCE-local frame
    var clipA = track.CreateClip<BovineLabs.Timeline.EntityLinks.Authoring.EntityLinkCopyTransformClip>();
    clipA.start = 0; clipA.duration = 4; clipA.displayName = "<clipName>";
    var a = (BovineLabs.Timeline.EntityLinks.Authoring.EntityLinkCopyTransformClip)clipA.asset;
    a.entityToMove = BovineLabs.Reaction.Data.Core.Target.Target;  // WHO moves: the binding's Target slot
    a.readRootFrom = BovineLabs.Reaction.Data.Core.Target.Self;    // <DERIVED §3.4> — default Owner is a trap
    a.link = schema; a.copyPosition = true; a.copyRotation = false;
    a.positionOffset = new UnityEngine.Vector3(0f, 3f, 0f);         // <CHOSEN> in SOURCE space
    // Pattern FULL-SNAP: same fields with copyPosition = copyRotation = true and
    // rotationOffset = <CHOSEN Euler degrees> (YAML keeps the Euler verbatim).

    foreach (var o in new UnityEngine.Object[] { timeline, track, a }) UnityEditor.EditorUtility.SetDirty(o);
    UnityEditor.AssetDatabase.SaveAssets();

    // Wire the director (binding table lives in the SCENE file -> persists fine)
    var director = UnityEngine.GameObject.Find(directorGoName).GetComponent<UnityEngine.Playables.PlayableDirector>();
    // CAPTURE (print + journal) BEFORE mutating: PRE|playableAsset=... PRE|binding|... (§3.5)
    var bindTarget = UnityEngine.GameObject.Find(bindTargetPath)
        .GetComponent<BovineLabs.Reaction.Authoring.Core.TargetsAuthoring>(); // the COMPONENT, not the Transform
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

Clip starts/durations/offsets are example choices, not package constants. `EXPECTED:` the
training report preserved field VALUES and YAML, not the authoring exec code — if direct field
assignment fails to compile, set via `SerializedObject` using the YAML field names in §7.
Verify per §7 in SEPARATE blocks before claiming success.

## 5. WORKED EXAMPLE (vex-ee training stage) — example environment; rediscover, never assume

- Project `/home/i/GitHub/vex-ee` (`dataPath=/home/i/GitHub/vex-ee/Assets`); parent scene
  `Assets/Scenes/Main Scene.unity`; SubScene `Assets/Scenes/Main Sub Scene.unity`; package at
  `/home/i/GitHub/vex-ee/Packages/BovineLabs.Timeline.EntityLinks/`.
- Stage (unity-stage-foundations): `Stage_Director` (PlayableDirector +
  TimelineReferenceAuthoring, the only director); `Stage_Actor` (capsule — TargetsAuthoring
  Target=Stage_Target, Owner/Source/Custom unset; EntityLinkSource Root=Stage_LinkRoot,
  Schemas=[Schema_Actor]); `Stage_LinkRoot` bakes `{Key=10, Target=Stage_Actor}`; `Stage_Target`
  (cube) is a root object (direct world-write path). Schema
  `Assets/Training/00-foundations/Schema_Actor.asset`: imported `id: 10`,
  guid `3b375c42affc2917f956d01310d31894`.
- Asset built: `Assets/Training/07-entitylink-copytransform-track/CopyTransformMastery.playable`
  — track `CopyTransformTrack`; clip A_HoverFollow 0–4s (entityToMove=Target, readRootFrom=Self,
  link=Schema_Actor, copyPos=True copyRot=False, posOff=(0,3,0)); clip B_FullSnap 4–6s (copy
  both, rotOff=(0,90,0) Euler verbatim in YAML). Clip A YAML: `entityToMove: 1`,
  `readRootFrom: 4`, `link: {fileID: 11400000, guid: 3b375c42affc2917f956d01310d31894, type: 2}`.
- Resolver walkthrough (clip A): binding=Stage_Actor → `Self` → Stage_Actor → Root=Stage_LinkRoot
  → buffer key 10 → SOURCE=Stage_Actor; `entityToMove=Target` → Stage_Target — the cube copies
  the capsule's world position + (0,3,0) in the capsule's local frame, every active frame.
  Training deviation: clip B's unspecified `readRootFrom` set to `Self` — the default `Owner` is
  unset on Stage_Actor, a guaranteed silent skip.
- Wiring after the lesson: director RESTORED to
  `Assets/Training/01-transform-position-track/PositionMastery.playable`; binding table 5
  entries, all → Stage_Actor (Position/Scale/Rotation Transform, TimeScale StatAuthoring,
  CopyTransformTrack TargetsAuthoring — left as permanent additive stage state). Known
  pre-existing vex-ee console entries: UnityCliConnector HTTP server start, PerformanceTesting
  IPrebuildSetup/IPostBuildCleanup, TestResults.xml save.

## 6. UNDO APPENDIX

Artifact inventory for one run of §4 (vex-ee instance shown in §5):
1. Created asset `<assetPath>` (.playable: TimelineAsset + track + clip sub-assets —
   `DeleteAsset` removes all sub-assets with the file).
2. Possibly-created folder(s) `<assetFolder>` (only if `PRE|folderExisted=false`).
3. Mutated `director.playableAsset` (vex-ee pre value: PositionMastery, restored in-run;
   capture YOURS per §3.5).
4. Added generic-binding entry for the new track (SubScene file; keyed by track asset, SURVIVES
   restoring `playableAsset` — vex-ee left it as permanent stage state; full undo must
   `ClearGenericBinding` it). `EXPECTED:` the report proves the POST table (5 entries) and the
   prior asset's restore but never printed the pre-wiring table as `PRE|` lines — derivably the
   4 non-CopyTransform entries; capture your own table verbatim per §3.5.
5. If the loud-bake demo was reproduced: the temp null-link clip (training removed it,
   `YAML_HAS_TMP|False`) and its deliberate console LogError — console history is not undoable;
   record it in the card instead.
6. RUNTIME effects: **none exist in the editor.** The per-frame LocalTransform copy happens only
   in play mode (and is expected to throw under the unassigned-ECB bug, §2); nothing persists
   after the clip or into authoring data — nothing runtime-side to undo.

ORDER: restore the director FIRST, THEN delete the asset, THEN other captured scene values —
deleting the asset while the director still points at it would leave a dangling `{fileID: 0}`-
style reference in the scene file instead of the captured pre-state.

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
    // Restore each CAPTURED binding (PRE|binding| lines): reload the PREVIOUS asset by captured
    // path, match tracks by name/index, re-find bound objects by captured hierarchy path, and
    // re-bind the captured COMPONENT type (bind what was captured, not what seems right).
    director.playableAsset =                         // restore CAPTURED value, never "default"
        UnityEditor.AssetDatabase.LoadAssetAtPath<UnityEngine.Playables.PlayableAsset>("<CAPTURED pre path>") /* or null */;
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
// UNDO-3: restore any other captured scene values — normally none beyond UNDO-1 for this track
// family (it never moves editor objects; schemas untouched). Only entries YOUR journal recorded.
```

UNDO-4 (verification, fresh load — protocol §7): reload the SubScene additively; print
`director.playableAsset` (= CAPTURED pre value) and the binding table (= captured `PRE|binding|`
lines); confirm `AssetDatabase.LoadAssetAtPath<UnityEngine.Object>(assetPath) == null`; restore
the parent scene; `unity-cli console --filter error` clean against the project baseline (§5).

## 7. VERIFICATION PROTOCOL

1. **Fresh-load asset dump**: in a new exec block, `AssetDatabase.LoadAssetAtPath` the
   `.playable`; dump track + clips (name, start/end, entityToMove, readRootFrom, link asset +
   imported id, copy mask, offsets). In-memory state after a save is not evidence.
2. **Raw YAML check**: `link:` is `{fileID: 11400000, guid: <schema guid>, type: 2}` (never
   `{fileID: 0}`); enum bytes match intent (e.g. `entityToMove: 1`, `readRootFrom: 4`); authored
   Euler verbatim (`rotationOffset:` keeps degrees).
3. **Schema check**: the schema asset's fresh YAML `id:` must be non-zero (vex-ee: 10).
4. **Binding table from a RELOADED SubScene**: expect
   `BINDING|<trackName>|bound=<bindTarget> (TargetsAuthoring)` — the COMPONENT, not the
   Transform — and all captured prior bindings intact. Never leave experimental bindings.
5. **Parent-scene restore**: end with `sceneCount=1`,
   `scene[0]=<parentScenePath>|loaded=True|active=True|dirty=False`.
6. **Console**: `unity-cli console --filter error` shows nothing new beyond the project baseline
   (vex-ee baseline in §5), except any DELIBERATE "missing link schema" demo — temp clip
   removed, clean rebake proven.
