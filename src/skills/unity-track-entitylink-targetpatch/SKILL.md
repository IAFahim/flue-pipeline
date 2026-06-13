---
name: unity-track-entitylink-targetpatch
description: Master of EntityLinkTargetPatchTrack + EntityLinkTargetPatchClip (EntityLinks package, BovineLabs.Timeline.EntityLinks) — one-shot permanent re-pointing of a Targets slot via links, the skip-on-Null safety, the weakest-undo-in-family truth, the assigned-but-unused ECB; carries the EntityLinks FAMILY CLOSING SUMMARY. Portable to any project containing the package; worked example from vex-ee.
---

# EntityLinkTargetPatchTrack specialist

## 1. SCOPE

You are the specialist for **`EntityLinkTargetPatchTrack`** and **`EntityLinkTargetPatchClip`**
from the EntityLinks package (`BovineLabs.Timeline.EntityLinks`, namespace
`BovineLabs.Timeline.EntityLinks.Authoring`). Scope: exactly this track family — rewriting one
slot of the track-binding entity's `Targets` component (the cast list) once at clip activation,
so everything that acts on that slot acts on the link-resolved entity from then on. This skill
also carries the **FAMILY CLOSING SUMMARY** comparing all four EntityLinks tracks (end of §2).

**Family fundamentals live in `unity-track-entitylink-copytransform`** (the verified `Target`
enum: None=0, Target=1, Owner=2, Source=3, Self=4, Custom=6, no 5; the three-step
`EntityLinkResolver` chain; the loud-bake/silent-runtime rule). Mutate semantics + the
bake-error capture recipe live in `unity-track-entitylink-mutate`; Parent's revert in
`unity-track-entitylink-parent`. Stage construction belongs to `unity-stage-foundations`.

**Operate per `unity-timeline-track-authoring`; behave per `unity-agent-protocol`; use the
editor per `unity-cli`.** That shared skill owns the discovery preamble (§1), the SubScene
bracket (§2), the undo-appendix structure (§3), and the verification protocol (§4); this skill
keeps ONLY the EntityLinkTargetPatch-unique facts below and cites those sections where ceremony
applies.

## 2. PORTABLE SEMANTICS

True in ANY project containing the EntityLinks package. Provenance tags say where a fact was
PROVEN, not where it applies. (All verified vex-ee 2026-06 via reflection dumps, package-source
quotes through `unity-cli exec`, raw YAML reads, fresh-load read-backs, real forced bakes for
both error demos. No play mode: runtime claims are source-derived; full `PatchJob` source
quoted in the training report.)

### THE HEADLINE — the family's WEAKEST undo (a runtime truth)

TargetPatch overwrites a `Targets` slot **destructively and stores nothing**: no snapshot, no
revert job (evidence of absence verified across all four family systems — the package's only
revert logic is `EntityLinkParentSystem.ExitJob`), and no self-inverse operation. Contrast
Mutate's Swap, which is self-inverse because the link BUFFER itself is the storage. After a
TargetPatch the original slot value is simply gone unless you parked it first; compensators
must smuggle the old value through a spare Targets slot via deliberate-miss clips (§4), which
is fragile by construction. Mutate undoes with one clip and no preconditions; TargetPatch needs
three clips, a sacrificial slot, and a guaranteed-miss key — and still loses if anyone touches
the slot. (Scope honesty: this is about RUNTIME state inside a play session; nothing the system
does ever writes back to authoring data — the agent's undo journal reverses authoring artifacts
only, which fully reverses everything that persists in the editor.) The flip side is the
family's only failure-safety knob: `Fallback`, where `None` means skip-don't-corrupt — a failed
patch is a no-op, never a null-write.

### Verified type facts

| Type | Base | Facts |
|---|---|---|
| `EntityLinkTargetPatchTrack` | `DOTSTrack` | sealed, `[TrackBindingType(typeof(BovineLabs.Reaction.Authoring.Core.TargetsAuthoring))]`, `[TrackClipType(EntityLinkTargetPatchClip)]`, TrackColor + DisplayName attrs, no Bake override |
| `EntityLinkTargetPatchClip` | `DOTSClip` | `ClipCaps.None`, `duration => 1` (seed only), implements `ITimelineClipAsset` |
| System | `EntityLinkTargetPatchSystem` | `[UpdateInGroup(typeof(TimelineComponentAnimationGroup))]` + WorldSystemFilter ONLY — no ordering attributes of its own |

The bind target (the `[TrackBindingType]`) is the **`TargetsAuthoring` COMPONENT**, never the
Transform.

### Clip fields — **PascalCase, unlike the camelCase fields of the other three family clips** (fresh-instance defaults, reflection)

| Field | Type | Default | Meaning |
|---|---|---|---|
| `Link` | `EntityLinkSchema` | null | ushort key; null → LOUD bake error, component skipped |
| `ReadRootFrom` | `Target` | **`Source(3)`** | Link-map hunt start — TRAP on any binding with an unset Source slot (silent never-resolve); derive from the discovered layout, typically `Self(4)` |
| `WriteTo` | `Target` | `Target(1)` | WHICH `Targets` slot gets overwritten; `None`/`Self` → LOUD bake error |
| `Fallback` | `Target` | `Target(1)` | Slot read when link resolution fails; NOT validated at bake (None legal and meaningful) |

Bakes `EntityLinkTargetPatch { Target ReadRootFrom; ushort LinkKey; Target WriteTo; Target
Fallback; }` via `EntityLinkTargetPatchBuilder.ApplyTo`. Bake guards, both loud (clip source,
quoted): null Link → `Debug.LogError($"{nameof(EntityLinkTargetPatchClip)} '{name}' missing
link schema.")`; `WriteTo is Target.None or Target.Self` →
`Debug.LogError($"... '{name}' cannot write to '{WriteTo}'.")` — both return without adding the
component. `Fallback` is never validated. `Targets.Get` semantics (quoted in the CopyTransform
skill): `Fallback=None` → `Entity.Null` (skip), `Fallback=Self` → the binding entity itself
("point it at me").

### Runtime semantics (`EntityLinkTargetPatchSystem`, source-quoted)

One job, `PatchJob`, edge-triggered `[WithAll(ClipActive)][WithDisabled(ClipActivePrevious)]`
— fires exactly once on the activation frame; clip length beyond that is cosmetic. Flow: take
the track-binding entity's `Targets` (silent skip on null binding / no Targets), run
`EntityLinkResolver.ResolveOrFallback` (link chain first — `targets.Get(ReadRootFrom)` → root
hop → `LinkKey` search — else `targets.Get(Fallback, bindingEntity)`), then
`if (resolved == Entity.Null) return;` — the skip-on-Null guard. Otherwise it acquires
`EntityLock` on the binding entity, RE-READS `Targets` under the lock, overwrites the single
`WriteTo` slot (Owner/Source/Target/Custom) in the local copy, and writes the whole struct back
**in place via `TargetsLookup[bindingEntity]`** — same-frame visible, NOT deferred. There is no
deactivation job and no revert anywhere in the package: the patch persists past clip end,
timeline end, director stop (within the play session).

### PACKAGE BUG — the assigned-but-unused ECB (portable truth about this package version)

`EntityLinkTargetPatchSystem.OnUpdate` builds the job with
`ECB = ...BeginSimulationEntityCommandBufferSystem...AsParallelWriter()` and the job declares
`public EntityCommandBuffer.ParallelWriter ECB;` — but `Execute` never uses it; all writes go
through `TargetsLookup` in place. Harmless dead code — the mirror image of CopyTransform's
used-but-never-ASSIGNED ECB bug. Practical consequence: TargetPatch is same-frame, like Mutate,
not one-frame-latent like CopyTransform.

### Traps & DO/DON'T (each proven live or source-quoted, vex-ee 2026-06)

- **DO expect WriteTo=Self / WriteTo=None to be LOUD at bake** — captured from a real forced
  bake: `... cannot write to 'Self'.` and `... cannot write to 'None'.` (worker log first,
  console later as `[WorkerN] ...`); component never added.
- **DON'T expect Fallback to be validated** — any value, including None and Self, passes the
  bake; validation guards the WRITE slot only.
- **DO rely on skip-on-Null — failure never corrupts the slot** — quoted above. A failed patch
  is a no-op, never a null-write; in fact TargetPatch cannot write `Entity.Null` at all
  (clearing a slot is not expressible). Fallback=None is the safety default to prefer.
- **DON'T expect any undo — one-shot, permanent, no snapshot, no self-inverse** — THE HEADLINE;
  the original slot value is unrecoverable unless parked first.
- **DON'T chain TargetPatch → CopyTransform/Parent same-frame** — attribute dump of all four
  systems: only `EntityLinkMutateSystem` carries `[UpdateBefore(EntityLinkTargetPatchSystem)]
  [UpdateBefore(EntityLinkParentSystem)]`; TargetPatch ↔ Parent ↔ CopyTransform have NO mutual
  ordering — whether a same-frame reader sees the patched slot is undefined; stagger cross-track
  chains by at least one frame. (Guaranteed: a same-frame Mutate IS visible — TargetPatch
  resolves against the already-mutated link buffer.)
- **DO know Fallback=Self writes the BINDING entity** — `Get(Self, self) → self` where `self`
  is the entity baked from the bound `TargetsAuthoring`'s GameObject, not the clip entity and
  not the director — a legitimate "if you can't find the linked thing, act on me" pattern.
  Fallback=Self is legal where WriteTo=Self is a bake error.
- **DON'T grep bake logs for clip display names** — the error prints the clip SUB-ASSET name
  (`m_Name`, default `EntityLinkTargetPatchClip`), NOT the TimelineClip `displayName` — the
  display name never appears in any log.
- **DO cast `EntityLinkSchema` to `UnityEngine.Object` in exec code** — the type has an
  implicit numeric conversion, so `AssetDatabase.GetAssetPath(clip.Link)` is AMBIGUOUS
  (`GetAssetPath(Object)` vs `GetAssetPath(int)`); cast first.
- **DO produce ALL `.sceneWithBuildSettings` artifacts when forcing a bake** — the
  cached-artifact trap; a clean rebake is proven by a CHANGED artifact hash with zero new error
  lines, not by silence. (Recipe in `unity-track-entitylink-mutate` §3.6.)
- **DON'T create schema assets — a missing prerequisite (protocol §6)** — discover existing ones
  by type (per the shared §1 discovery, schema-prerequisite branch); ids are import-assigned,
  id 0 never resolves.

### EntityLinks FAMILY CLOSING SUMMARY (lessons 07–10 — portable)

> The four EntityLinks tracks share one resolver (Target-enum hop → root hop
> via `EntityLinkSource.Root` → linear `EntityLinkEntry` key search), one
> loud-bake/silent-runtime contract (null schema and invalid WriteTo are bake
> `LogError`s that skip the component; every runtime resolution failure is a
> silent skip), `ClipCaps.None`, `duration => 1`, and a `TargetsAuthoring`
> track binding — but they differ in what they write, when, and for how long.
> **CopyTransform** writes the mover's `LocalTransform` (pose), every active
> frame, via a BeginSimulation ECB (one frame latent — and currently broken by
> the unassigned-ECB bug); its effect ends the moment the clip does, no
> restore needed. **Mutate** writes the link ROOT's `EntityLinkEntry` buffer
> (the link map itself), once at clip activation, in place under `EntityLock`
> — same-frame visible, permanent, but Swap is self-inverse so undo is one
> identical clip. **Parent** writes the child's `Parent` pointer (hierarchy)
> at enter/exit edges via the EndFixedStepSimulation ECB (one fixed-step
> latent), and owns the family's ONLY built-in revert (`restoreOnEnd`) — which
> restores the pointer, never the pose. **TargetPatch** writes one slot of the
> binding's `Targets` component (the cast list), once at activation, in place
> under `EntityLock` (same-frame; its ECB is assigned but unused — dead code,
> mirroring CopyTransform's used-but-unassigned bug), permanent, with the
> family's only failure-safety knob (`Fallback`, where None =
> skip-don't-corrupt) but the family's WEAKEST undo: no snapshot and no
> self-inverse, so compensators must park the old value in a spare Targets
> slot via deliberate-miss clips. Ordering is guaranteed in exactly one
> direction — Mutate runs `UpdateBefore` TargetPatch and Parent, so a
> same-frame Mutate is visible to both — while TargetPatch ↔ Parent ↔
> CopyTransform are mutually unordered: any same-frame chain through `Targets`
> or the link map across those three is undefined behavior; stagger by a
> frame. Rule of thumb: CopyTransform moves a thing, Parent attaches a thing,
> Mutate redefines what a link MEANS, TargetPatch redefines who an entity ACTS
> ON — the first two touch transforms (self-limiting or restorable), the last
> two touch the indirection tables (permanent until compensated).

## 3. DISCOVERY DELTA

Discovery is the shared `unity-timeline-track-authoring` §1 preamble (D1 package check, D2
scene/SubScene, D3 director selection, D4 bind target + prerequisites, D5 `PRE|` capture). Run
it with these EntityLinkTargetPatch substitutions:

- **D1 type/assembly:** `BovineLabs.Timeline.EntityLinks.Authoring.EntityLinkTargetPatchTrack,
  BovineLabs.Timeline.EntityLinks.Authoring`; missing →
  `MISSING_PREREQUISITE|EntityLinkTargetPatchTrack not found - the EntityLinks package is absent`.
- **D4 bind target = `TargetsAuthoring` (the COMPONENT).** Print each holder's path AND its slot
  values (Owner/Source/Target/Custom): you must know which slots are SET (Fallback reads them),
  which are FREE (parking slots for the compensator), and which slot the designer wants patched.
- **D4 link wiring (track-specific prerequisite):** find `EntityLinkSourceAuthoring` /
  `EntityLinkRootAuthoring` holders; print Roots, Schemas, and each root's authored key set — a
  deliberate-miss clip needs a schema whose key is PROVABLY absent from the root's buffer; verify
  absence by query, never by assumption. Discover schemas by TYPE
  (`AssetDatabase.FindAssets("t:EntityLinkSchema")`) with live id dump (id==0 ⇒ unusable; cast to
  `UnityEngine.Object` before `GetAssetPath`). **NEVER create schema assets** — out of domain.
- **Derive `ReadRootFrom` from the layout** (`Self` when the bound object itself carries the
  source — the default `Source` is a trap on any binding with an unset Source slot).

## 4. CANONICAL CLIP PATTERNS

The SubScene bracket is shared `unity-timeline-track-authoring` §2; below is only the
track-specific middle (fields are PascalCase — set via `SerializedObject` + YAML names if direct
assignment fails to compile):

```csharp
var track = timeline.CreateTrack<BovineLabs.Timeline.EntityLinks.Authoring.EntityLinkTargetPatchTrack>(null, trackName);
var schema = UnityEditor.AssetDatabase.LoadAssetAtPath<BovineLabs.Timeline.EntityLinks.Authoring.EntityLinkSchema>("<DISCOVERED schemaPath>");

// Pattern SAFE PATCH ("patch the slot to the linked thing, touch nothing on failure"):
var clipA = track.CreateClip<BovineLabs.Timeline.EntityLinks.Authoring.EntityLinkTargetPatchClip>();
clipA.start = 0; clipA.duration = 0.5; clipA.displayName = "<clipName>";   // length cosmetic (edge-trigger)
var a = (BovineLabs.Timeline.EntityLinks.Authoring.EntityLinkTargetPatchClip)clipA.asset;
a.Link = schema;
a.ReadRootFrom = BovineLabs.Reaction.Data.Core.Target.Self;   // <DERIVED §3> — default Source is a trap
a.WriteTo  = BovineLabs.Reaction.Data.Core.Target.Custom;     // <CHOSEN> slot; None/Self won't bake
a.Fallback = BovineLabs.Reaction.Data.Core.Target.None;       // skip-don't-corrupt (the safety default)

// Pattern FALLBACK WRITE ("on failure, point it at me"): Fallback = Self (legal where
// WriteTo=Self is a bake error) — an always-non-null deliberate fallback write.

// Pattern DELIBERATE-MISS SLOT COPY: Link = a schema whose key is PROVABLY absent from
// the root's buffer (§3) + Fallback=<srcSlot> + WriteTo=<dstSlot> — the only way
// TargetPatch can move values between Targets slots.
```

**The honest park-then-restore compensator** (the RUNTIME undo a designer authors; distinct
from the agent's editor undo journal in shared §3): (1) at window start, a deliberate-miss clip
with `Fallback=<patched slot>, WriteTo=<spare slot>` parks the original value; (2) the real
patch; (3) at window end, the inverse deliberate-miss `Fallback=<spare slot>, WriteTo=<patched
slot>` restores it. Constraints that make this fragile: it burns a Targets slot for the whole
window; anything else writing that slot (another TargetPatch, gameplay code) corrupts the
restore; and the "guaranteed miss" key must stay absent — a Mutate Assign of that key mid-window
would turn the restore into a link-resolved write. Its failure mode was demonstrated live (§5):
the compensator restores whatever the parking slot holds NOW, not the authored original — once
no slot remembers the original, the information is simply gone.

**Undo note (track-specific addendum to shared §3):** RUNTIME effects exist in play mode only —
the `Targets`-slot patch persists within a play session (THE HEADLINE; runtime-side it is the
family's weakest undo, recoverable only via the fragile compensator above) but is discarded with
the runtime world and never writes back to authoring data. The agent's journal undoes AUTHORING
artifacts only, which fully reverses everything that persists in the editor. Schemas and the link
root are never created or modified — nothing to undo there; the guaranteed-miss property of the
deliberate-miss schema is authored state owned by the stage.

**Verification addendum (to shared §4):** the §4 raw-YAML/asset-dump step must confirm field
names are **PascalCase in YAML too** (`Link:`, `ReadRootFrom:`, `WriteTo:`, `Fallback:`) and the
`Link:` ref is `{fileID: 11400000, guid: …, type: 2}` (never `{fileID: 0}` unless deliberately
demoing); for a deliberate-miss clip, RE-VERIFY the key is still absent from the intended root's
authored key set; cast `Link` to `UnityEngine.Object` before `GetAssetPath`.

## 5. WORKED EXAMPLE (vex-ee training stage — delta vs shared §5; rediscover, never assume)

Asset built: `Assets/Training/10-entitylink-targetpatch-track/TargetPatchMastery.playable` —
track `TargetPatchTrack`, bound to `Stage_Actor`'s `TargetsAuthoring`. Clips (PascalCase YAML):
`A_PatchCustomToLinked 0–0.5 Link=Schema_Actor(10) ReadRootFrom=Self(4) WriteTo=Custom(6)
Fallback=None(0)` (safe patch); `B_RetargetToCustom 2–2.5 WriteTo=Target(1) Fallback=Self(4)`
(fallback write); `C_CompensateRestore 4–4.5 Link=Root Link(3) WriteTo=Target(1)
Fallback=Custom(6)` (deliberate-miss restore). Clip sub-assets kept the default `m_Name:
EntityLinkTargetPatchClip`.

Stage layout used: `Stage_Actor` (TargetsAuthoring Owner=null, Source=null, Target=Stage_Target,
Custom=null; EntityLinkSource Root=Stage_LinkRoot, Schemas=[Schema_Actor]); `Stage_LinkRoot`
bakes `{Key=10, Target=Stage_Actor}` — key 3 ("Root Link") is deliberately ABSENT, the
guaranteed-miss key. Schemas: Schema_Actor id=10 guid=3b375c42affc2917f956d01310d31894; Root
Link id=3 guid=c0c683033c37a137fae122e6ee8300c9 (full 10-schema inventory: Mutate skill §5).

The compensator failure, demonstrated on this timeline: after A and B run, slots are
`{Owner=Null, Source=Null, Target=Stage_Actor, Custom=Stage_Actor}` — clip C writes Stage_Actor,
not the original Stage_Target; no slot remembers Stage_Target and the system never stored it.

Bake-error demos: temp clips D (WriteTo=Self) and E (WriteTo=None) → real forced bake (ALL
`.sceneWithBuildSettings` artifacts produced) → `cannot write to 'Self'.` / `cannot write to
'None'.` at `EntityLinkTargetPatchClip.cs:31`; temp clips removed; clean rebake proven by changed
artifact hash (`65802f91…` → `11cc804d…`), zero new error lines. After the lesson the director
was RESTORED to `Assets/Training/01-transform-position-track/PositionMastery.playable`; the
binding table held 8 entries, B7 = TargetPatchTrack → TargetsAuthoring (left as permanent
additive stage state — the report proved the POST table but not the 7 pre-TargetPatch entries as
`PRE|` lines; capture your own table verbatim).
