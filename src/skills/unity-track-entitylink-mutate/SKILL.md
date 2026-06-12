---
name: unity-track-entitylink-mutate
description: Master of EntityLinkMutateTrack + clip in vex-ee — edge-triggered Assign/Swap/Remove of link-map entries, permanent mutations + the compensating-clip pattern. Use when a designer asks "retarget/swap/clear a link from this moment".
---

# EntityLinkMutateTrack specialist

You are the specialist for **`EntityLinkMutateTrack`** and
**`EntityLinkMutateClip`** from the EntityLinks package at
`Packages/BovineLabs.Timeline.EntityLinks/` (under `Packages/`, NOT
PackageCache), namespace `BovineLabs.Timeline.EntityLinks.Authoring`. Scope:
exactly this track family — rewriting a link root's `EntityLinkEntry` buffer
(Assign / Swap / Remove) once, on the frame a clip activates.

**Family fundamentals live in `unity-track-entitylink-copytransform`** — the
verified `Target` enum (None=0, Target=1, Owner=2, Source=3, Self=4, Custom=6;
no 5), the three-step `EntityLinkResolver` chain (Target-enum hop → root hop
via `EntityLinkSource.Root` → linear `EntityLinkEntry` buffer search with
silent key-0/missing guards), and the loud-bake/silent-runtime rule. Load that
skill alongside this one; do not re-derive those facts.

All facts below were verified live in the **vex-ee** project, **2026-06**
(reflection dumps, package-source quotes via `File.ReadAllText` inside
`unity-cli exec`, raw YAML reads, fresh-load read-backs, a real forced bake
for the error demos). No play mode: runtime claims are source-derived.

## THE HEADLINE — mutations PERSIST (evidence of absence)

A Mutate clip's buffer edit **outlives the clip. Nothing in the package ever
puts the link back.** Evidence-of-absence sweep (full package grep over every
non-test `.cs` for `ClipDeactivate`, `ExitJob`, `WithDisabled(typeof(ClipActive))`,
`ClipActivePrevious`, `resetOnDeactivate`, `Restore`, `Revert`, `Snapshot`):

- The package contains exactly five systems: CopyTransform, Mutate, Parent,
  TargetPatch, Debug.
- The ONLY exit/restore logic anywhere is `EntityLinkParentSystem.ExitJob`
  (gated on `RestoreOnEnd`) — topic 09's reparent restore, not Mutate.
- `EntityLinkMutateSystem` schedules exactly ONE job (`MutateJob`), the
  *activation* edge. No deactivation job, no snapshot, no ECB, no
  `TrackResetOnDeactivate` interaction. The write is an in-place
  `UnsafeBufferLookup<EntityLinkEntry>` edit — once written, the old `Target`
  entity is gone.

**Designer consequence:** "point the sword link at the other sword for 2
seconds" is NOT what a single Assign clip does — it points it there *forever*
(until another mutation). Temporary effects must be authored as compensating
clips (below).

## Prerequisites & environment

- Act only through `unity-cli exec` / `unity-cli console`; never touch vex-ee
  via the filesystem; never enter play mode. Follow the **unity-cli skill's
  Safe Loop** (inspect → mutate once → save → verify → restore → console
  check) on every mutation.
- Verify the live project first:
  `unity-cli exec "return UnityEditor.SceneManagement.EditorSceneManager.GetActiveScene().path + \"|\" + Application.dataPath;"`
  → expect `Assets/Scenes/Main Scene.unity|/home/i/GitHub/vex-ee/Assets`.
- The `TrainingStage` (unity-stage-foundations) must exist in SubScene
  `Assets/Scenes/Main Sub Scene.unity`: **Stage_Actor** carries
  `TargetsAuthoring` (Target=Stage_Target) AND `EntityLinkSource`
  (Root=Stage_LinkRoot, Schemas=[Schema_Actor]); **Stage_LinkRoot** bakes the
  `EntityLinkEntry` buffer `{Key=10, Target=Stage_Actor}`.
- **NEVER create new schema assets** — 10 already exist (inventory below);
  referencing production schemas in clips is fine (plain asset→asset guid).
- Your assets live only under `Assets/Training/08-entitylink-mutate-track/`.
  Canonical asset: `MutateMastery.playable` — track `MutateTrack`, clips
  A_AssignToCube (0–1s), B_SwapWithRootLink (2–3s), C_RemoveActorLink (4–5s).

## VERIFIED facts (vex-ee, 2026-06)

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
| `readRootFrom` | `Target` | **`Source(3)`** | Where the link-map hunt starts — TRAP, see edge cases |
| `newTarget` | `Target` | `Target(1)` | Assign/Swap only: which Targets slot supplies the new entity |
| `swapLink` | `EntityLinkSchema` | null | Swap only; null is SILENT → SwapKey=0 = "swap with Entity.Null" |

Bake produces `EntityLinkMutate { Mode, ReadRootFrom, LinkKey, NewTarget,
SwapKey }` via `EntityLinkMutateBuilder.ApplyTo`. The component's own doc
comment confirms: `/// <summary>Second key for swap operations (Swap only).
0 = swap with Entity.Null.</summary>`.

**Default-trap difference inside the family**: CopyTransform defaults
`readRootFrom = Owner(2)`, Mutate defaults `readRootFrom = Source(3)` — BOTH
are unset on Stage_Actor's Targets, so both defaults silently never resolve on
this stage. Always set `Self(4)` when the bound entity itself carries the
`EntityLinkSource`.

### Schema inventory (AssetDatabase-confirmed, the known 10 — none created)

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

## Runtime semantics (`EntityLinkMutateSystem.MutateJob`, source-quoted)

System: `[UpdateInGroup(typeof(TimelineComponentAnimationGroup))]
[UpdateBefore(typeof(EntityLinkTargetPatchSystem))]
[UpdateBefore(typeof(EntityLinkParentSystem))]`.
Job: **edge-triggered, fires ONCE per clip activation** —
`[WithAll(typeof(ClipActive))] [WithDisabled(typeof(ClipActivePrevious))]`.

Resolution preamble is the family chain (silent on every failure); then the
root's buffer is edited **in place, under `EntityLock.Acquire(root)`**
(serializing same-root mutations across the parallel job; order among
same-frame clips is chunk-order, not clip order):

- **Assign** — overwrite the first entry matching `LinkKey` with
  `{LinkKey, targets.Get(NewTarget, binding)}`, else APPEND (append breaks the
  baked sort — harmless, the resolver is a linear first-match search).
- **Swap** — single scan finds both keys (`else if`: LinkKey==SwapKey
  degenerates to a single-key self-overwrite); an absent key reads as
  `Entity.Null` AND gets an entry created — net effect always leaves both keys
  present, targets exchanged.
- **Remove** — backward loop (`for (i = Length-1; i >= 0; i--)`), removes ALL
  entries matching the key; absent = no-op.

In-place write, no ECB → downstream resolutions the SAME frame see the
mutated buffer. Mutate is the family's only zero-latency mutator
(CopyTransform's own write is one frame latent via ECB).

## Canonical recipes (verbatim from the report)

**Retarget a link from a timeline ("from this moment the actor slot means the
cube"):** track `BovineLabs/Entity Links/Mutate` → bind the TargetsAuthoring
of the object whose Targets describe the cast → clip with mode=Assign,
link=<schema>, readRootFrom=Self (if the bound object carries the
EntityLinkSource; the default Source is a trap), newTarget=<Targets slot
holding the new entity>. Takes effect once, at clip start; duration beyond
the first frame is irrelevant; persists forever.

**Swap two links ("weapon swap"):** mode=Swap, link=<key A>,
swapLink=<key B>. Both keys end up present; missing keys materialize
holding the other's old value (or Entity.Null). Self-inverse — author the same
clip again to undo.

**Clear a link ("drop the hitbox link"):** mode=Remove, link=<schema>.
Removes all copies; no-op when absent; only another Assign/Swap can bring the
key back.

**Temporary window — the compensating-clip pattern:**
- **Retarget window**: Assign clip at t=start + compensating **Assign** clip
  at t=end with `newTarget` = a Targets slot that still holds the ORIGINAL
  entity. `newTarget` resolves through the binding's `Targets` at activation
  time — the original entity must be reachable from some slot, because the
  buffer itself no longer remembers it.
- **Swap window**: Swap is self-inverse — a second identical Swap clip at the
  window's end restores both keys exactly. The cleanest compensation; prefer
  swap-pairs over assign-pairs when both entities live in the link map.
- **Remove window**: compensate with an Assign clip (Assign appends when the
  key is absent), again requiring the original entity reachable via a Targets
  slot.
- Caveat: if a TargetPatch clip rewrote the slot earlier in the timeline, the
  compensating Assign picks up the patched value, not the authored one.

Asset-side proof shape (clip B YAML — production-schema refs are plain
asset→asset guids):

```yaml
m_Name: B_SwapWithRootLink
mode: 1
link: {fileID: 11400000, guid: 3b375c42affc2917f956d01310d31894, type: 2}
readRootFrom: 4
newTarget: 1
swapLink: {fileID: 11400000, guid: c0c683033c37a137fae122e6ee8300c9, type: 2}
```

## Edge cases & traps (each proven live or source-quoted, 2026-06)

- **DON'T expect the link back when the clip ends — mutations persist forever** —
  evidence-of-absence verdict: only one job in the system, activation-edge
  only; the package's sole exit logic is ParentSystem's RestoreOnEnd (topic 09).
- **DON'T trust the default `readRootFrom = Source`** — Stage_Actor's
  `Targets.Source` is unset → `Entity.Null` → silent never-resolve; the
  mastery clips all use `Self(4)` for exactly this reason.
- **DO know the silent/loud asymmetry**: `swapLink=null` is SILENT — `Bake`
  calls `TryGetKey(swapLink, out swapKey)` and **ignores the return value**, so
  SwapKey bakes as 0 (temp clip D produced no log line at all); `link=null` is
  LOUD — captured live: `EntityLinkMutateClip 'E_TempNullLink' missing link
  schema.` and the component is never added.
- **DO understand SwapKey=0 as "park on key 0 / clear to Null"** — key 0 is
  never in a baked buffer, so targetB=Entity.Null: the primary link is nulled
  AND `{Key=0, Target=oldEntity}` is appended — retrievable only by a
  SwapKey=0 swap-back (the runtime mutate switch has no key!=0 guard, unlike
  the resolver).
- **DO rely on Remove clearing ALL duplicates** — backward loop deletes every
  entry with the key; duplicates can arise because bake-time validation sees
  only authoring (the root Baker dedupes + sorts), while at runtime Assign
  appends and Swap appends up to two entries — interleaved mutations / repeated
  SwapKey=0 parks can produce multiple entries per key. Remove is the reliable
  "no matter what happened, this link is now gone" cleanup.
- **DO count on same-frame visibility** — `UpdateBefore` TargetPatch + Parent,
  in-place write with no ECB: a Mutate clip and a CopyTransform/TargetPatch/
  Parent clip starting the SAME frame → the downstream clip resolves against
  the ALREADY-mutated buffer (CopyTransform follows the NEW target from its
  very first active frame).
- **DON'T size the clip to the effect — edge-trigger makes clip LENGTH
  irrelevant** — `[WithAll(ClipActive)] [WithDisabled(ClipActivePrevious)]`
  fires exactly once at activation; the duration is cosmetic beyond that frame.
- **DON'T create new schema assets** — reuse the 10-schema inventory above;
  schema ids are assigned at import and a fresh asset reads id 0 in its
  creating exec block.

## Bake-error capture recipe (generally useful, beyond this track)

Saving the SubScene or `AssetDatabase.ImportAsset(subScenePath, ForceUpdate)`
does NOT bake — the .unity file reimports with DefaultImporter "static
dependencies only"; the entity bake is an on-demand artifact. The recipe that
actually surfaces bake-time `Debug.LogError`s:

1. Reflection-invoke
   `Unity.Scenes.Editor.SubSceneInspectorUtility.ForceReimport(new[]{subSceneComponent})`.
2. `AssetDatabaseExperimental.ProduceArtifact(new ArtifactKey(
   GUIDFromAssetPath("Assets/SceneDependencyCache/<guid>.sceneWithBuildSettings"),
   typeof(Unity.Scenes.Editor.SubSceneImporter)))` — all via reflection;
   `UnityEditor.GUID` doesn't resolve in the exec compiler, so use
   `AssetDatabase.GUIDFromAssetPath` to obtain the GUID object.
3. Read `Logs/AssetImportWorkerHW*.log` (via `File.ReadAllText` inside exec) —
   the error lands there first and reaches `unity-cli console` later as
   `[WorkerN] ...`.

Use this whenever any DOTS track family's bake behavior needs proving (loud
LogError demos, clean-rebake confirmations).

## Verification protocol

1. **Fresh-load asset dump**: `AssetDatabase.LoadAssetAtPath` the .playable in
   a NEW exec block; dump track + clips (name, start/end, mode, link asset +
   imported id, readRootFrom, newTarget, swapLink). Expected canonical state:
   `A_AssignToCube 0–1 Assign(0)`, `B_SwapWithRootLink 2–3 Swap(1)
   swapLink=Root Link(id=3)`, `C_RemoveActorLink 4–5 Remove(2)` — all
   link=Schema_Actor(id=10), readRootFrom=Self(4), newTarget=Target(1).
   In-memory state after a save is not evidence.
2. **Raw YAML check**: `link:`/`swapLink:` are `{fileID: 11400000, guid: …,
   type: 2}` where assigned (never `{fileID: 0}` unless deliberately demoing);
   enum bytes match intent (`mode: 1`, `readRootFrom: 4`, `newTarget: 1`).
3. **Schema check**: read the schema asset YAML fresh; `id:` must be non-zero
   (Schema_Actor=10, Root Link=3).
4. **Binding check from a RELOADED SubScene**:
   `BINDING|EntityLinkMutateTrack|MutateTrack|Stage_Actor
   (BovineLabs.Reaction.Authoring.Core.TargetsAuthoring)` — the component, not
   the Transform. Post-lesson-08 the table is 6 entries, all → Stage_Actor;
   keyed by track asset, grows additively, survives playableAsset swaps.
5. **Parent-scene restore**: end with sceneCount=1,
   `Assets/Scenes/Main Scene.unity|loaded=True|active=True|dirty=False`,
   director restored to its prior playableAsset
   (`Assets/Training/01-transform-position-track/PositionMastery.playable`).
6. **Console**: `unity-cli console --filter error` must show nothing new
   except any DELIBERATE "missing link schema" demo (remove the temp clip and
   confirm a clean rebake afterwards); known pre-existing vex-ee entries are
   UnityCliConnector HTTP server start, PerformanceTesting
   IPrebuildSetup/IPostBuildCleanup, TestResults.xml save.
