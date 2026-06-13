---
name: unity-track-entitylink-mutate
description: Master of EntityLinkMutateTrack + EntityLinkMutateClip (EntityLinks package, BovineLabs.Timeline.EntityLinks) — edge-triggered Assign/Swap/Remove of link-map entries, permanent runtime mutations + the compensating-clip pattern, the bake-error capture recipe. Portable to any project containing the package; worked example from vex-ee.
---

# EntityLinkMutateTrack specialist

## 1. SCOPE

You are the specialist for **`EntityLinkMutateTrack`** and **`EntityLinkMutateClip`** from the
EntityLinks package (`BovineLabs.Timeline.EntityLinks`, namespace
`BovineLabs.Timeline.EntityLinks.Authoring`). Scope: exactly this track family — rewriting a
link root's `EntityLinkEntry` buffer (Assign / Swap / Remove) once, on the frame a clip
activates.

**Family fundamentals live in `unity-track-entitylink-copytransform`** — the verified
`Target` enum (None=0, Target=1, Owner=2, Source=3, Self=4, Custom=6; no 5), the three-step
`EntityLinkResolver` chain (Target-enum hop → root hop via `EntityLinkSource.Root` → linear
`EntityLinkEntry` buffer search with silent key-0/missing guards), and the
loud-bake/silent-runtime rule — load that skill alongside this one; do not re-derive those
facts. Stage construction belongs to `unity-stage-foundations`.

**Operate per `unity-timeline-track-authoring`; behave per `unity-agent-protocol`; use the
editor per `unity-cli`.** Discovery → §1 of that skill; the SubScene create-and-wire bracket
→ §2; the undo-appendix structure → §3; the fresh-load verification protocol → §4. This skill
adds only the track-UNIQUE content below.

## 2. PORTABLE SEMANTICS

True in ANY project containing the EntityLinks package. Provenance tags say where a fact was
PROVEN, not where it applies. (All verified vex-ee 2026-06 via reflection, package-source
quotes, raw YAML, fresh-load read-backs, and a real forced bake for the error demos. No play
mode: runtime claims are source-derived.)

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
scenes/assets are untouched by the runtime system. (This is the runtime-effect-persists case
that `unity-timeline-track-authoring` §3 flags: the journal there undoes only authoring
artifacts; the compensating clip in §4 is the only in-session runtime undo.)

### Verified type facts

| Type | Base | Facts |
|---|---|---|
| `EntityLinkMutateTrack` | `DOTSTrack` | sealed, `[TrackBindingType(typeof(TargetsAuthoring))]` (`BovineLabs.Reaction.Authoring.Core.TargetsAuthoring` — the bind target), `[TrackClipType(EntityLinkMutateClip)]`, no Bake override. |
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
(`unity-timeline-track-authoring` §1 D4), never from the default.

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
- **DON'T create schema assets — a missing prerequisite (protocol §6)** — discover existing ones
  by type (`unity-timeline-track-authoring` §1 D4: `FindAssets("t:EntityLinkSchema")`, read live
  id/key). Ids are import-assigned: a freshly created asset reads id 0 in its creating exec block
  (and bakes a key that never resolves).

### Track-specific discovery additions

Beyond the shared §1 preamble, this track needs the LINK WIRING (read-only, same bracket):
find `EntityLinkSourceAuthoring` / `EntityLinkRootAuthoring` holders; print each source's
Root + Schemas and each root's authored key set — you must know which keys WILL be in the baked
buffer (Assign on an absent key appends; Swap with an absent key parks `Entity.Null`). Derive
`readRootFrom` from this layout (`Self` when the bound object itself carries the
EntityLinkSource).

### Bake-error capture recipe (track-specific; portable; proven here, refined in the Parent lesson)

Saving the SubScene or `AssetDatabase.ImportAsset(subScenePath, ForceUpdate)` does NOT bake —
the .unity file reimports with DefaultImporter "static dependencies only"; the entity bake is an
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

## 3. CLIP PATTERNS (the §2-bracket track-specific middle)

The create-and-wire bracket is `unity-timeline-track-authoring` §2 (PRE| folder/asset/director
captures, `SaveAssets`, `SetGenericBinding(track, <TargetsAuthoring component>)`, `SaveScene`,
restore parent in `finally`). Drop one of these into its track-specific middle. Mode/Target
enums are byte-backed: set via `SerializedObject` + YAML field names using
`System.Convert.ToInt64`, never `(int)` casts.

```csharp
var track = timeline.CreateTrack<BovineLabs.Timeline.EntityLinks.Authoring.EntityLinkMutateTrack>(null, trackName);
var schema = UnityEditor.AssetDatabase.LoadAssetAtPath<BovineLabs.Timeline.EntityLinks.Authoring.EntityLinkSchema>("<DISCOVERED schemaPath>");

// Pattern RETARGET ("from this moment the link means the new entity"):
var clipA = track.CreateClip<BovineLabs.Timeline.EntityLinks.Authoring.EntityLinkMutateClip>();
clipA.start = 0; clipA.duration = 1; clipA.displayName = "<clipName>";   // length cosmetic (edge-trigger)
var a = (BovineLabs.Timeline.EntityLinks.Authoring.EntityLinkMutateClip)clipA.asset;
a.mode = BovineLabs.Timeline.EntityLinks.Data.EntityLinkMutateMode.Assign;
a.link = schema;
a.readRootFrom = BovineLabs.Reaction.Data.Core.Target.Self;   // <DERIVED> — default Source is a trap
a.newTarget = BovineLabs.Reaction.Data.Core.Target.Target;    // <CHOSEN> slot holding the new entity

// Pattern SWAP ("weapon swap" — self-inverse): mode=Swap, link=<key A>, swapLink=<key B>.
// Both keys end up present; missing keys materialize holding the other's old value (or Entity.Null).

// Pattern CLEAR ("drop the link"): mode=Remove, link=<schema>. Removes all copies;
// no-op when absent; only another Assign/Swap can bring the key back.
```

**Temporary window — the compensating-clip pattern** (the RUNTIME undo a designer authors;
distinct from the agent's editor undo journal):
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
names.

## 4. WORKED-EXAMPLE DELTA vs the shared stage

The shared vex-ee stage is `unity-timeline-track-authoring` §5. This track's deltas:
- Stage link wiring: `Stage_Actor` (TargetsAuthoring Target=Stage_Target, Owner/Source/Custom
  unset; EntityLinkSource Root=Stage_LinkRoot, Schemas=[Schema_Actor]); `Stage_LinkRoot` bakes
  `{Key=10, Target=Stage_Actor}`. Schema inventory found by discovery (the known 10, none
  created): ids 1–9 under `Assets/Settings/Schemas/EntityLinks/` (Movement Body=1, Input
  Consumer=2, Root Link=3 guid=c0c683033c37a137fae122e6ee8300c9, Left Sword=4, Inventory=5,
  Hitbox Shape=6, Hurtbox Shape=7, Essence=8, Rig=9) + `Assets/Training/00-foundations/
  Schema_Actor.asset` id=10 guid=3b375c42affc2917f956d01310d31894.
- Asset built: `Assets/Training/08-entitylink-mutate-track/MutateMastery.playable` — track
  `MutateTrack`; clips `A_AssignToCube 0–1 Assign(0)`, `B_SwapWithRootLink 2–3 Swap(1)
  swapLink=Root Link(id=3)`, `C_RemoveActorLink 4–5 Remove(2)` — all link=Schema_Actor(id=10),
  readRootFrom=Self(4), newTarget=Target(1). Clip B YAML: `mode: 1`, `readRootFrom: 4`,
  `newTarget: 1`, both schema refs `{fileID: 11400000, guid: …, type: 2}` (plain asset→asset).
- Designer stories: A overwrites key 10 with Stage_Target at t=0, forever; B exchanges keys 10
  and 3 (key 3 absent → key 10 receives Entity.Null and `{Key=3, Target=cube}` is appended);
  C removes every key-10 entry at t=4.
- Bake demos run: temp clip `D_TempSwapNullSwapLink` (silent, no log) and `E_TempNullLink`
  (LOUD: `[Worker2] EntityLinkMutateClip 'E_TempNullLink' missing link schema.` at
  `EntityLinkMutateClip.cs:33`); both removed, clean rebake confirmed (match count stayed 1).
- Director RESTORED to `Assets/Training/01-transform-position-track/PositionMastery.playable`;
  binding table 6 entries, all → Stage_Actor (CopyTransform + MutateTrack bound to the
  TargetsAuthoring component, left as permanent additive stage state). The deliberate
  E_TempNullLink line is the only addition to the §5 console baseline.

For verification, the track-specific dump fields (§4-step-1 of the shared protocol) are:
mode, link asset + imported id, readRootFrom, newTarget, swapLink; YAML check expects
`link:`/`swapLink:` as `{fileID: 11400000, guid: …, type: 2}` where assigned and enum bytes
matching intent (`mode`, `readRootFrom`, `newTarget`); each referenced schema's fresh YAML `id:`
must be non-zero; binding expects `BINDING|<trackName>|bound=<bindTarget> (TargetsAuthoring)`.
