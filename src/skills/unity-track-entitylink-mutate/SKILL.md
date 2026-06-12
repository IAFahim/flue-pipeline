---
name: unity-track-entitylink-mutate
description: Master of EntityLinkMutateTrack + EntityLinkMutateClip (EntityLinks package, BovineLabs.Timeline.EntityLinks) — edge-triggered Assign/Swap/Remove of link-map entries, permanent runtime mutations + the compensating-clip pattern, the bake-error capture recipe. Portable to any project containing the package; worked example from vex-ee. Use when a designer asks "retarget/swap/clear a link from this moment".
---

# EntityLinkMutateTrack specialist

## 1. SCOPE

You are the specialist for **`EntityLinkMutateTrack`** and **`EntityLinkMutateClip`** from the
EntityLinks package (`BovineLabs.Timeline.EntityLinks`, namespace
`BovineLabs.Timeline.EntityLinks.Authoring`). Scope: exactly this track family — rewriting a
link root's `EntityLinkEntry` buffer (Assign / Swap / Remove) once, on the frame a clip
activates. **Family fundamentals live in `unity-track-entitylink-copytransform`** — the verified
`Target` enum (None=0, Target=1, Owner=2, Source=3, Self=4, Custom=6; no 5), the three-step
`EntityLinkResolver` chain (Target-enum hop → root hop via `EntityLinkSource.Root` → linear
`EntityLinkEntry` buffer search with silent key-0/missing guards), and the
loud-bake/silent-runtime rule — load that skill alongside this one; do not re-derive those
facts. Stage construction belongs to `unity-stage-foundations`. Behave per
unity-agent-protocol; operate the editor per unity-cli.

## 2. PORTABLE SEMANTICS

True in ANY project containing the EntityLinks package. Provenance tags say where a fact was
PROVEN, not where it applies. (All verified vex-ee 2026-06 via reflection dumps, package-source
quotes through `File.ReadAllText` inside `unity-cli exec`, raw YAML reads, fresh-load
read-backs, and a real forced bake for the error demos. No play mode: runtime claims are
source-derived.)

### THE HEADLINE — runtime mutations PERSIST (evidence of absence)

A Mutate clip's buffer edit **outlives the clip. Nothing in the package ever puts the link
back.** Evidence-of-absence sweep (full package grep over every non-test `.cs` for
`ClipDeactivate`, `ExitJob`, `WithDisabled(typeof(ClipActive))`, `ClipActivePrevious`,
`resetOnDeactivate`, `Restore`, `Revert`, `Snapshot`): the package contains exactly five systems
(CopyTransform, Mutate, Parent, TargetPatch, Debug); the ONLY exit/restore logic anywhere is
`EntityLinkParentSystem.ExitJob` (gated on `RestoreOnEnd`) — Parent's reparent restore, not
Mutate; `EntityLinkMutateSystem` schedules exactly ONE job (`MutateJob`), the *activation* edge
— no deactivation job, no snapshot, no ECB, no `TrackResetOnDeactivate` interaction. The write
is an in-place `UnsafeBufferLookup<EntityLinkEntry>` edit — once written, the old `Target`
entity is gone.

**Designer consequence:** "point the sword link at the other sword for 2 seconds" is NOT what a
single Assign clip does — it points it there *forever* (until another mutation). Temporary
effects must be authored as compensating clips (§4). **Persistence scope (honesty):** these
mutations live in the runtime ECS world only — they persist within a play session past clip
end, timeline end and director stop, but NEVER write back into authoring data; the editor's
scenes/assets are untouched by the runtime system.

### Verified type facts

| Type | Base | Facts |
|---|---|---|
| `EntityLinkMutateTrack` | `DOTSTrack` | sealed, `[TrackBindingType(typeof(TargetsAuthoring))]` (`BovineLabs.Reaction.Authoring.Core.TargetsAuthoring`), `[TrackClipType(EntityLinkMutateClip)]`, no Bake override. |
| `EntityLinkMutateClip` | `DOTSClip` | `ClipCaps.None` (no blend/ease), `duration => 1` (seed only). |
| `EntityLinkMutateMode` | enum : byte | `Assign=0, Swap=1, Remove=2`. |

### Clip fields (fresh-instance defaults, reflection)

| Field | Type | Default | Meaning |
|---|---|---|---|
| `mode` | `EntityLinkMutateMode` (byte) | `Assign(0)` | Assign / Swap / Remove |
| `link` | `EntityLinkSchema` | null | Primary key; null → LOUD bake LogError, component skipped |
| `readRootFrom` | `Target` | **`Source(3)`** | Where the link-map hunt starts — TRAP, see traps |
| `newTarget` | `Target` | `Target(1)` | Assign/Swap only: which Targets slot supplies the new entity |
| `swapLink` | `EntityLinkSchema` | null | Swap only; null is SILENT → SwapKey=0 = "swap with Entity.Null" |

Bake produces `EntityLinkMutate { Mode, ReadRootFrom, LinkKey, NewTarget, SwapKey }` via
`EntityLinkMutateBuilder.ApplyTo`. The component's own doc comment confirms: `/// <summary>
Second key for swap operations (Swap only). 0 = swap with Entity.Null.</summary>`.

**Default-trap difference inside the family**: CopyTransform defaults `readRootFrom = Owner(2)`,
Mutate defaults `readRootFrom = Source(3)` — on any binding whose Owner/Source slots are unset,
BOTH defaults silently never resolve (proven on the vex-ee stage, §5). Always set `Self(4)` when
the bound entity itself carries the `EntityLinkSource`; derive from the discovered slot layout
(§3.4), never from the default.

### Runtime semantics (`EntityLinkMutateSystem.MutateJob`, source-quoted)

System: `[UpdateInGroup(typeof(TimelineComponentAnimationGroup))]
[UpdateBefore(typeof(EntityLinkTargetPatchSystem))] [UpdateBefore(typeof(EntityLinkParentSystem))]`.
Job: **edge-triggered, fires ONCE per clip activation** — `[WithAll(typeof(ClipActive))]
[WithDisabled(typeof(ClipActivePrevious))]`. Resolution preamble is the family chain (silent on
every failure); then the root's buffer is edited **in place, under `EntityLock.Acquire(root)`**
(serializing same-root mutations across the parallel job; order among same-frame clips is
chunk-order, not clip order):

- **Assign** — overwrite the first entry matching `LinkKey` with
  `{LinkKey, targets.Get(NewTarget, binding)}`, else APPEND (append breaks the baked sort —
  harmless, the resolver is a linear first-match search).
- **Swap** — single scan finds both keys (`else if`: LinkKey==SwapKey degenerates to a
  single-key self-overwrite); an absent key reads as `Entity.Null` AND gets an entry created —
  net effect always leaves both keys present, targets exchanged.
- **Remove** — backward loop (`for (i = Length-1; i >= 0; i--)`), removes ALL entries matching
  the key; absent = no-op.

In-place write, no ECB → downstream resolutions the SAME frame see the mutated buffer. Mutate is
the family's only zero-latency mutator (CopyTransform's own write is one frame latent via ECB).

### Traps & DO/DON'T (each proven live or source-quoted, vex-ee 2026-06)

- **DON'T expect the link back when the clip ends — mutations persist forever (within the play
  session)** — evidence-of-absence verdict above.
- **DON'T trust the default `readRootFrom = Source`** — an unset `Targets.Source` →
  `Entity.Null` → silent never-resolve; the worked-example clips all use `Self(4)`.
- **DO know the silent/loud asymmetry**: `swapLink=null` is SILENT — `Bake` calls
  `TryGetKey(swapLink, out swapKey)` and **ignores the return value**, so SwapKey bakes as 0
  (the demo clip produced no log line at all); `link=null` is LOUD — captured live:
  `EntityLinkMutateClip '<name>' missing link schema.`, component never added.
- **DO understand SwapKey=0 as "park on key 0 / clear to Null"** — key 0 is never in a baked
  buffer, so targetB=Entity.Null: the primary link is nulled AND `{Key=0, Target=oldEntity}` is
  appended — retrievable only by a SwapKey=0 swap-back (the runtime mutate switch has no key!=0
  guard, unlike the resolver).
- **DO rely on Remove clearing ALL duplicates** — backward loop deletes every entry with the
  key; duplicates can arise because bake-time validation sees only authoring (the root Baker
  dedupes + sorts, LogError on a repeated key), while at runtime Assign appends and Swap appends
  up to two entries. Remove is the reliable "this link is now gone, no matter what" cleanup.
- **DO count on same-frame visibility** — `UpdateBefore` TargetPatch + Parent, in-place write
  with no ECB: a Mutate clip and a CopyTransform/TargetPatch/Parent clip starting the SAME frame
  → the downstream clip resolves against the ALREADY-mutated buffer.
- **DON'T size the clip to the effect** — edge-trigger fires exactly once at activation; clip
  LENGTH is cosmetic beyond that frame.
- **DON'T create schema assets — a missing prerequisite (protocol §6)** — discover existing ones by type
  (§3.4). Ids are import-assigned: a freshly created asset reads id 0 in its creating exec block
  (and bakes a key that never resolves).

## 3. DISCOVERY RECIPES

Act only through `unity-cli exec` / `unity-cli console`; never the filesystem; never play mode;
unity-cli Safe Loop on every mutation. Names below are parameters — discover them in THIS
project; never assume the worked example (§5).

**3.1 Confirm the package exists (else report a missing prerequisite — protocol §6):**
```csharp
var t = System.Type.GetType("BovineLabs.Timeline.EntityLinks.Authoring.EntityLinkMutateTrack, BovineLabs.Timeline.EntityLinks.Authoring");
return t == null
    ? "MISSING_PREREQUISITE|EntityLinkMutateTrack not found - the EntityLinks package is absent in this project"
    : "OK|" + t.AssemblyQualifiedName + "|dataPath=" + UnityEngine.Application.dataPath;
```

**3.2 Find the active scene + SubScene(s):** run the unity-cli skill's First Command; record
`parentScenePath` and candidate `subScenePath`(s).

**3.3 Find PlayableDirector(s) inside the SubScene** (read-only additive open, restore parent
after) via `FindObjectsByType<PlayableDirector>(Include, None)`; print hierarchy path,
`scene.path`, `playableAsset`, sibling components. STATE your selection rule in the memory
card; zero directors → protocol §6.

**3.4 Discover the cast, link wiring and schemas** (read-only, same bracket):
- Binding candidates: `FindObjectsByType<TargetsAuthoring>` — print each holder's path AND its
  slot values; the track binds the **TargetsAuthoring COMPONENT**, never the Transform.
- Link wiring: find `EntityLinkSourceAuthoring` / `EntityLinkRootAuthoring` holders; print each
  source's Root + Schemas and each root's authored key set — you must know which keys WILL be
  in the baked buffer (Assign on an absent key appends; Swap with an absent key parks
  `Entity.Null`).
- Schemas by TYPE, ids dumped live (never remembered): `AssetDatabase.FindAssets
  ("t:EntityLinkSchema")` → per asset print path/guid/imported id (reflect the `Id` property or
  `id` field; id==0 ⇒ unusable). NEVER create schema assets. The vex-ee inventory in §5 shows
  the expected shape.
- Derive `readRootFrom` from the discovered layout (`Self` when the bound object itself carries
  the EntityLinkSource).

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

**3.6 Bake-error capture recipe (portable; proven here, refined in the Parent lesson):** saving
the SubScene or `AssetDatabase.ImportAsset(subScenePath, ForceUpdate)` does NOT bake — the
.unity file reimports with DefaultImporter "static dependencies only"; the entity bake is an
on-demand artifact. To surface bake-time `Debug.LogError`s:
1. Reflection-invoke `Unity.Scenes.Editor.SubSceneInspectorUtility.ForceReimport(new[]{subSceneComponent})`.
2. `AssetDatabaseExperimental.ProduceArtifact(new ArtifactKey(GUIDFromAssetPath(
   "Assets/SceneDependencyCache/<guid>.sceneWithBuildSettings"), typeof(Unity.Scenes.Editor.SubSceneImporter)))`
   — all via reflection; `UnityEditor.GUID` doesn't resolve in the exec compiler, use
   `AssetDatabase.GUIDFromAssetPath`. **Produce ALL `.sceneWithBuildSettings` entries** —
   producing only the first can return a CACHED artifact (no bake, silent logs); a clean rebake
   is proven by a CHANGED artifact hash.
3. Read `Logs/AssetImportWorkerHW*.log` via `File.ReadAllText` inside exec — the error lands
   there first and reaches `unity-cli console` later as `[WorkerN] ...`.

**Name resolution rule**: `GameObject.Find` misses inactive objects and is ambiguous on
duplicate names. Confirm the chosen name is active and unique in the SubScene; otherwise walk
the SubScene roots to the recorded hierarchy path (or `FindObjectsByType` filtered by `scene`)
instead of `Find`.

## 4. CANONICAL RECIPES

One logical change per exec block; print `PRE|` captures before mutating (protocol §2), save
inside the block, verify from a fresh load (§7).

**4.1 Create timeline + track + clips, then wire the director** (same skeleton as the
CopyTransform skill §4.1 — SubScene bracket, PRE| folder/asset/director captures, `SaveAssets`,
`SetGenericBinding(track, <TargetsAuthoring component>)`, `SaveScene`, restore parent in
`finally`). Clip patterns:

```csharp
var track = timeline.CreateTrack<BovineLabs.Timeline.EntityLinks.Authoring.EntityLinkMutateTrack>(null, trackName);
var schema = UnityEditor.AssetDatabase.LoadAssetAtPath<BovineLabs.Timeline.EntityLinks.Authoring.EntityLinkSchema>("<DISCOVERED schemaPath>");

// Pattern RETARGET ("from this moment the link means the new entity"):
var clipA = track.CreateClip<BovineLabs.Timeline.EntityLinks.Authoring.EntityLinkMutateClip>();
clipA.start = 0; clipA.duration = 1; clipA.displayName = "<clipName>";   // length cosmetic (edge-trigger)
var a = (BovineLabs.Timeline.EntityLinks.Authoring.EntityLinkMutateClip)clipA.asset;
a.mode = BovineLabs.Timeline.EntityLinks.Data.EntityLinkMutateMode.Assign;
a.link = schema;
a.readRootFrom = BovineLabs.Reaction.Data.Core.Target.Self;   // <DERIVED §3.4> — default Source is a trap
a.newTarget = BovineLabs.Reaction.Data.Core.Target.Target;    // <CHOSEN> slot holding the new entity

// Pattern SWAP ("weapon swap" — self-inverse): mode=Swap, link=<key A>, swapLink=<key B>.
// Both keys end up present; missing keys materialize holding the other's old value (or Entity.Null).

// Pattern CLEAR ("drop the link"): mode=Remove, link=<schema>. Removes all copies;
// no-op when absent; only another Assign/Swap can bring the key back.
```

**Temporary window — the compensating-clip pattern** (the RUNTIME undo a designer authors;
distinct from the agent's editor undo journal in §6):
- **Retarget window**: Assign clip at t=start + compensating **Assign** clip at t=end with
  `newTarget` = a Targets slot that still holds the ORIGINAL entity. `newTarget` resolves
  through the binding's `Targets` at ACTIVATION time — the original must be reachable from some
  slot, because the buffer itself no longer remembers it.
- **Swap window**: Swap is self-inverse — a second identical Swap clip at the window's end
  restores both keys exactly. The cleanest compensation; prefer swap-pairs over assign-pairs
  when both entities live in the link map.
- **Remove window**: compensate with an Assign clip (Assign appends when the key is absent),
  again requiring the original entity reachable via a slot.
- Caveat: if a TargetPatch clip rewrote the slot earlier in the timeline, the compensating
  Assign picks up the patched value, not the authored one.

`EXPECTED:` the training report preserved field VALUES and YAML, not the authoring exec code —
if direct field assignment fails to compile, set via `SerializedObject` using the YAML field
names in §7. Mode/Target enums are byte-backed: `System.Convert.ToInt64`, never `(int)` casts.

## 5. WORKED EXAMPLE (vex-ee training stage) — example environment; rediscover, never assume

- Project `/home/i/GitHub/vex-ee`; parent scene `Assets/Scenes/Main Scene.unity`; SubScene
  `Assets/Scenes/Main Sub Scene.unity`; package under `Packages/`. Stage: `Stage_Director` (the
  only director); `Stage_Actor` (TargetsAuthoring Target=Stage_Target, Owner/Source/Custom
  unset; EntityLinkSource Root=Stage_LinkRoot, Schemas=[Schema_Actor]); `Stage_LinkRoot` bakes
  `{Key=10, Target=Stage_Actor}`.
- Schema inventory found by §3.4 discovery (the known 10 — none created):
```
Assets/Settings/Schemas/EntityLinks/Movement Body Link.asset  id=1
Assets/Settings/Schemas/EntityLinks/Input Consumer Link.asset id=2
Assets/Settings/Schemas/EntityLinks/Root Link.asset           id=3  guid=c0c683033c37a137fae122e6ee8300c9
Assets/Settings/Schemas/EntityLinks/Left Sword Link.asset     id=4
Assets/Settings/Schemas/EntityLinks/Inventory Link.asset      id=5
Assets/Settings/Schemas/EntityLinks/Hitbox Shape Link.asset   id=6
Assets/Settings/Schemas/EntityLinks/Hurtbox Shape Link.asset  id=7
Assets/Settings/Schemas/EntityLinks/Essence Link.asset        id=8
Assets/Settings/Schemas/EntityLinks/Rig Link.asset            id=9
Assets/Training/00-foundations/Schema_Actor.asset             id=10 guid=3b375c42affc2917f956d01310d31894
```
- Asset built: `Assets/Training/08-entitylink-mutate-track/MutateMastery.playable` — track
  `MutateTrack`; clips `A_AssignToCube 0–1 Assign(0)`, `B_SwapWithRootLink 2–3 Swap(1)
  swapLink=Root Link(id=3)`, `C_RemoveActorLink 4–5 Remove(2)` — all link=Schema_Actor(id=10),
  readRootFrom=Self(4), newTarget=Target(1). Clip B YAML: `mode: 1`, `readRootFrom: 4`,
  `newTarget: 1`, both schema refs `{fileID: 11400000, guid: …, type: 2}` (plain asset→asset).
- Designer stories on this stage: A overwrites key 10 with Stage_Target at t=0, forever; B
  exchanges keys 10 and 3 (key 3 absent → key 10 receives Entity.Null and `{Key=3, Target=cube}`
  is appended); C removes every key-10 entry at t=4.
- Demos run in training: temp clip `D_TempSwapNullSwapLink` (silent, no log) and `E_TempNullLink`
  (LOUD: `[Worker2] EntityLinkMutateClip 'E_TempNullLink' missing link schema.` at
  `EntityLinkMutateClip.cs:33`); both removed, clean rebake confirmed (match count stayed 1).
- Wiring after the lesson: director RESTORED to
  `Assets/Training/01-transform-position-track/PositionMastery.playable`; binding table 6
  entries, all → Stage_Actor (Position/Scale/Rotation Transform, TimeScale StatAuthoring,
  CopyTransform + MutateTrack TargetsAuthoring — left as permanent additive stage state).
- Known pre-existing vex-ee console entries: UnityCliConnector HTTP server start,
  PerformanceTesting IPrebuildSetup/IPostBuildCleanup, TestResults.xml save (+ this lesson's
  deliberate E_TempNullLink demo line).

## 6. UNDO APPENDIX

Artifact inventory for one run of §4 (vex-ee instance shown in §5):
1. Created asset `<assetPath>` (.playable: TimelineAsset + track + clip sub-assets —
   `DeleteAsset` removes all sub-assets with the file).
2. Possibly-created folder(s) `<assetFolder>` (only if `PRE|folderExisted=false`).
3. Mutated `director.playableAsset` (vex-ee pre value: PositionMastery, restored in-run;
   capture YOURS per §3.5).
4. Added generic-binding entry for the new track (SubScene file; keyed by track asset, SURVIVES
   playableAsset swaps — vex-ee left it as permanent stage state; full undo must
   `ClearGenericBinding` it). `EXPECTED:` the report proves the POST table (6 entries) and the
   prior asset's restore but never printed the pre-wiring table as `PRE|` lines — derivably the
   5 pre-Mutate entries; capture your own table verbatim per §3.5.
5. If bake-error demos were reproduced: temp clips (training removed them, `YAML_HAS_TEMP|False`)
   plus deliberate console LogError lines and new entity-bake artifact hashes in `Library/` —
   console history and derived bake caches are not undoable state; record them in the card.
6. RUNTIME effects: **none exist in the editor.** The buffer edits this track performs are
   play-mode-only; they persist within a play session but are discarded with the runtime world
   and never write back to authoring data. No play mode was entered in training, so no link map
   was ever actually mutated. The compensating-clip pattern (§4) is the RUNTIME undo story — the
   agent's journal below undoes AUTHORING artifacts only.
7. Schemas: never created, never modified — nothing to undo (creating one would be out of
   domain, protocol §6).

ORDER: restore the director FIRST, THEN delete the asset, THEN other captured scene values —
deleting the asset while the director still points at it would leave a dangling `{fileID: 0}`-
style reference in the scene file instead of the captured pre-state.

Journal entry templates (protocol §5 — fill from YOUR captures, reverse order):

```csharp
// UNDO-1: restore director's captured playableAsset + binding table (SubScene bracket).
// Identical skeleton to the CopyTransform skill's UNDO-1: open SubScene additively,
// ClearGenericBinding every output track of MY asset, re-bind each CAPTURED PRE|binding| line
// (reload the PREVIOUS asset by captured path, match track by name/index, re-find the bound
// object by captured hierarchy path, bind the captured COMPONENT type), director.playableAsset
// = <CAPTURED pre value, never "default">, SetDirty, SaveScene, restore parent Single in
// finally. return "UNDONE|director restored";
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
// family (it never moves editor objects; schemas and the authored link root are never touched).
```

UNDO-4 (verification, fresh load — protocol §7): reload the SubScene additively;
`director.playableAsset` must equal the CAPTURED pre value and the binding table the captured
`PRE|binding|` lines; confirm `AssetDatabase.LoadAssetAtPath<UnityEngine.Object>(assetPath) ==
null`; restore the parent scene; `unity-cli console --filter error` clean against the project
baseline (§5). If a forced bake was run, prove the clean rebake by a CHANGED artifact hash with
zero new error lines.

## 7. VERIFICATION PROTOCOL

1. **Fresh-load asset dump**: `AssetDatabase.LoadAssetAtPath` the `.playable` in a NEW exec
   block; dump track + clips (name, start/end, mode, link asset + imported id, readRootFrom,
   newTarget, swapLink). In-memory state after a save is not evidence. (vex-ee expectation: §5.)
2. **Raw YAML check**: `link:`/`swapLink:` are `{fileID: 11400000, guid: …, type: 2}` where
   assigned (never `{fileID: 0}` unless deliberately demoing); enum bytes match intent (e.g.
   `mode: 1`, `readRootFrom: 4`, `newTarget: 1`).
3. **Schema check**: each referenced schema's fresh YAML `id:` must be non-zero.
4. **Binding check from a RELOADED SubScene**: `BINDING|<trackName>|bound=<bindTarget>
   (TargetsAuthoring)` — the COMPONENT, not the Transform — and all captured prior bindings
   intact.
5. **Parent-scene restore**: end with `sceneCount=1`,
   `scene[0]=<parentScenePath>|loaded=True|active=True|dirty=False`.
6. **Console**: `unity-cli console --filter error` shows nothing new beyond the project baseline
   except any DELIBERATE "missing link schema" demo — remove the temp clip and confirm a clean
   rebake (changed artifact hash, no new error lines).
