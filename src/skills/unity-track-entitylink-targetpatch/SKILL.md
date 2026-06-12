---
name: unity-track-entitylink-targetpatch
description: Master of EntityLinkTargetPatchTrack + clip in vex-ee — one-shot permanent re-pointing of a Targets slot via links, the skip-on-Null safety, the weakest-undo-in-family truth. Use when a designer asks "from now on, act on the linked thing instead".
---

# EntityLinkTargetPatchTrack specialist

You are the specialist for **`EntityLinkTargetPatchTrack`** and
**`EntityLinkTargetPatchClip`** from the EntityLinks package at
`Packages/BovineLabs.Timeline.EntityLinks/`, namespace
`BovineLabs.Timeline.EntityLinks.Authoring`. Scope: exactly this track family —
rewriting one slot of the track-binding entity's `Targets` component (the cast
list) once at clip activation, so everything that acts on that slot acts on the
link-resolved entity from then on. This is the LAST EntityLinks track, so this
skill also carries the **FAMILY CLOSING SUMMARY** comparing all four tracks
(end of this file).

**Family fundamentals live in `unity-track-entitylink-copytransform`** — the
verified `Target` enum (None=0, Target=1, Owner=2, Source=3, Self=4, Custom=6;
no 5), the three-step `EntityLinkResolver` chain (Target-enum hop → root hop
via `EntityLinkSource.Root` → linear `EntityLinkEntry` buffer search with
silent key-0/missing guards), and the loud-bake/silent-runtime rule. Load that
skill alongside this one; do not re-derive those facts. Mutate semantics live
in `unity-track-entitylink-mutate`, Parent's revert in `unity-track-entitylink-parent`.

All facts below were verified live in the **vex-ee** project, **2026-06**
(reflection dumps, package-source quotes via `unity-cli exec`, raw YAML reads,
fresh-load read-backs, real forced bakes for both error demos). No play mode:
runtime claims are source-derived (full `PatchJob` source in the report).

## THE HEADLINE — the family's WEAKEST undo

TargetPatch overwrites a `Targets` slot **destructively and stores nothing**:
no snapshot, no revert job (evidence of absence verified across all four
family systems — the package's only revert logic is
`EntityLinkParentSystem.ExitJob`), and no self-inverse operation. Contrast
Mutate's Swap, which is self-inverse because the link BUFFER itself is the
storage — both values survive the swap, just exchanged, so the identical clip
undoes it. After a TargetPatch the original slot value is simply gone unless
you parked it first; compensators must smuggle the old value through a spare
Targets slot via deliberate-miss clips (recipe below), which is fragile by
construction. Mutate undoes with one clip and no preconditions; TargetPatch
needs three clips, a sacrificial slot, and a guaranteed-miss key — and still
loses if anyone touches the slot.

The flip side is the family's only failure-safety knob: `Fallback`, where
`None` means skip-don't-corrupt. A failed patch is a no-op, never a null-write.

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
  `TargetsAuthoring` (Owner=null, Source=null, Target=Stage_Target,
  Custom=null) AND `EntityLinkSource` (Root=Stage_LinkRoot,
  Schemas=[Schema_Actor]); **Stage_LinkRoot** bakes the `EntityLinkEntry`
  buffer `{Key=10, Target=Stage_Actor}`.
- **NEVER create new schema assets** — reuse the known 10 (inventory in
  `unity-track-entitylink-mutate`). This lesson uses Schema_Actor (id=10,
  guid=3b375c42affc2917f956d01310d31894) and Root Link (id=3,
  guid=c0c683033c37a137fae122e6ee8300c9 — deliberately ABSENT from
  Stage_LinkRoot's buffer, the guaranteed-miss key).
- Your assets live only under
  `Assets/Training/10-entitylink-targetpatch-track/`. Canonical asset:
  `TargetPatchMastery.playable` — track `TargetPatchTrack`, clips
  A_PatchCustomToLinked (0–0.5s), B_RetargetToCustom (2–2.5s),
  C_CompensateRestore (4–4.5s); fields in the verification protocol.

## VERIFIED facts (vex-ee, 2026-06)

| Type | Base | Facts |
|---|---|---|
| `EntityLinkTargetPatchTrack` | `DOTSTrack` | sealed, `[TrackBindingType(typeof(BovineLabs.Reaction.Authoring.Core.TargetsAuthoring))]`, `[TrackClipType(EntityLinkTargetPatchClip)]`, TrackColor + DisplayName attrs, no Bake override |
| `EntityLinkTargetPatchClip` | `DOTSClip` | `ClipCaps.None`, `duration => 1` (seed only), implements `ITimelineClipAsset` |
| System | `EntityLinkTargetPatchSystem` | `[UpdateInGroup(typeof(TimelineComponentAnimationGroup))]` + WorldSystemFilter ONLY — no ordering attributes of its own |

### Clip fields — **PascalCase, unlike the camelCase fields of the other three family clips** (fresh-instance defaults, reflection)

| Field | Type | Default | Meaning |
|---|---|---|---|
| `Link` | `EntityLinkSchema` | null | ushort key; null → LOUD bake error, component skipped |
| `ReadRootFrom` | `Target` | **`Source(3)`** | Link-map hunt start — **TRAP on this stage** (Source unset → silent never-resolve); use `Self(4)` |
| `WriteTo` | `Target` | `Target(1)` | WHICH `Targets` slot gets overwritten; `None`/`Self` → LOUD bake error |
| `Fallback` | `Target` | `Target(1)` | Slot read when link resolution fails; NOT validated at bake (None legal and meaningful) |

Bakes `EntityLinkTargetPatch { Target ReadRootFrom; ushort LinkKey; Target
WriteTo; Target Fallback; }` via `EntityLinkTargetPatchBuilder.ApplyTo`.
Bake guards, both loud (clip source, quoted): null Link →
`Debug.LogError($"{nameof(EntityLinkTargetPatchClip)} '{name}' missing link schema.")`;
`WriteTo is Target.None or Target.Self` →
`Debug.LogError($"{nameof(EntityLinkTargetPatchClip)} '{name}' cannot write to '{WriteTo}'.")`
— both return without adding the component. `Fallback` is never validated.

### `Targets.Get` — quoted verbatim from the Reaction package
(`Library/PackageCache/com.bovinelabs.reaction@1eac368d2c34/BovineLabs.Reaction.Data/Core/Targets.cs`)

```csharp
public readonly Entity Get(in Target target, in Entity self)
{
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
}
```

So `Fallback=None` → `Entity.Null` (skip), `Fallback=Self` → the binding
entity itself ("point it at me").

## Runtime semantics (`EntityLinkTargetPatchSystem`, source-quoted)

One job, `PatchJob`, edge-triggered
`[WithAll(ClipActive)][WithDisabled(ClipActivePrevious)]` — fires exactly once
on the activation frame; clip length beyond that is cosmetic. Flow: take the
track-binding entity's `Targets` (silent skip on null binding / no Targets),
run `EntityLinkResolver.ResolveOrFallback` (link chain first —
`targets.Get(ReadRootFrom)` → root hop → `LinkKey` search — else
`targets.Get(Fallback, bindingEntity)`), then:

```csharp
if (resolved == Entity.Null) return;
```

— the skip-on-Null guard. Otherwise it acquires `EntityLock` on the binding
entity, RE-READS `Targets` under the lock, overwrites the single `WriteTo`
slot (Owner/Source/Target/Custom) in the local copy, and writes the whole
struct back **in place via `TargetsLookup[bindingEntity]`** — same-frame
visible, NOT deferred. There is no deactivation job and no revert anywhere in
the package: the patch persists past clip end, timeline end, director stop.

## Canonical recipes (verbatim from the report)

**Patch a Targets slot from the timeline** ("from this moment, things acting
on X act on the linked thing"): track `BovineLabs/Entity Links/Target Patch` →
bind the `TargetsAuthoring` of the entity whose cast you're editing → clip
with `Link=<schema>`, `ReadRootFrom=Self` (when the bound entity carries the
EntityLinkSource — the default `Source` is a trap on any binding with an unset
Source slot), `WriteTo=<slot>`, `Fallback=None`. Fires once at clip start;
length irrelevant; persists forever. (Clip A: WriteTo=Custom, Fallback=None —
if the link ever breaks, NOTHING is touched.)

**Safety-fallback patterns**: `Fallback=None` = "don't touch on failure"
(preferred default); `Fallback=Self` = "on failure, point it at me";
`Fallback=<slot>` = "on failure, copy that slot". Remember WriteTo=None/Self
won't bake. (Clip B: WriteTo=Target, Fallback=Self — everything acting on
Target now acts on the linked entity; if unresolvable, Target := the binding
entity itself, a deliberate, always-non-null fallback write.)

**Deliberate-miss slot copy**: Link = a schema whose key is guaranteed absent
from the root's buffer + `Fallback=<srcSlot>` + `WriteTo=<dstSlot>` — the only
way TargetPatch can move values between Targets slots. Foundation of the
park-then-restore compensator.

**The honest park-then-restore compensator**: (1) at window start, a
deliberate-miss clip with `Fallback=Target, WriteTo=Custom` parks the original
Target value in Custom; (2) the real patch `WriteTo=Target`; (3) at window
end, the inverse deliberate-miss `Fallback=Custom, WriteTo=Target` restores
it. Constraints that make this fragile: it burns a Targets slot for the whole
window; anything else writing that slot (another TargetPatch, gameplay code)
corrupts the restore; and the "guaranteed miss" key must stay absent — a
Mutate Assign of that key mid-window would turn the restore into a
link-resolved write.

**Its failure, demonstrated (clip C)**: on the canonical timeline, clip C
(Link=Root Link key 3 → guaranteed miss → `Fallback=Custom`, `WriteTo=Target`,
"restore Target from the Custom parking slot") cannot restore the ORIGINAL
Stage_Target — clip A repurposed Custom to Stage_Actor at t=0, so C writes
Stage_Actor. The compensator restores whatever the parking slot holds NOW,
not the authored original. After A and B run, the slots are `{Owner=Null,
Source=Null, Target=Stage_Actor, Custom=Stage_Actor}` — no slot remembers
Stage_Target, the system never stored the old value anywhere, and Stage_Target
is in no link map. The information is simply gone.

## Edge cases & traps (each proven live or source-quoted, 2026-06)

- **DO expect WriteTo=Self / WriteTo=None to be LOUD at bake** — captured from
  a real forced bake: `EntityLinkTargetPatchClip 'EntityLinkTargetPatchClip'
  cannot write to 'Self'.` and `... cannot write to 'None'.` (worker log
  first, console later as `[Worker2] ...`); component never added.
- **DON'T expect Fallback to be validated** — any value, including None and
  Self, passes the bake; validation guards the WRITE slot only.
- **DO rely on skip-on-Null — failure never corrupts the slot** — quoted:
  `if (resolved == Entity.Null) return;`. A failed patch is a no-op, never a
  null-write; in fact TargetPatch cannot write `Entity.Null` at all (clearing
  a slot is not expressible). Fallback=None is the safety default a designer
  should prefer unless they explicitly want a fallback write.
- **DON'T expect any undo — one-shot, permanent, no snapshot, no
  self-inverse** — edge trigger fires once at activation (clip length
  cosmetic); the system source contains exactly one job, no
  deactivation/exit/restore path; the original slot value is unrecoverable
  unless parked first. Contrast Mutate's Swap (self-inverse, one identical
  clip undoes it) — see THE HEADLINE.
- **DON'T chain TargetPatch → CopyTransform/Parent same-frame** — attribute
  dump: only `EntityLinkMutateSystem` carries
  `[UpdateBefore(EntityLinkTargetPatchSystem)] [UpdateBefore(EntityLinkParentSystem)]`;
  TargetPatch ↔ Parent ↔ CopyTransform have NO mutual ordering — whether a
  same-frame reader sees the patched slot is undefined; stagger cross-track
  chains by at least one frame. (Guaranteed: a same-frame Mutate IS visible —
  TargetPatch resolves against the already-mutated link buffer.)
- **DO know Fallback=Self writes the BINDING entity** — `Get(Self, self) →
  self` where `self` is the entity baked from the bound `TargetsAuthoring`'s
  GameObject (Stage_Actor here), not the clip entity and not the director —
  a legitimate "if you can't find the linked thing, act on me" pattern. Note
  Fallback=Self is legal where WriteTo=Self is a bake error.
- **DON'T be fooled by the assigned-but-unused ECB** — `OnUpdate` assigns a
  BeginSimulation ECB to the job, but `Execute` never touches it: harmless
  dead code, the mirror image of CopyTransform's used-but-never-ASSIGNED ECB
  bug. Practical consequence: TargetPatch is same-frame (in-place
  `TargetsLookup` write under `EntityLock`), like Mutate, not one-frame-latent
  like CopyTransform.
- **DON'T grep bake logs for clip display names** — the error prints the clip
  SUB-ASSET name (`m_Name`, default `EntityLinkTargetPatchClip`), NOT the
  TimelineClip `displayName` — "D_TempWriteToSelf" never appeared in any log.
- **DO cast `EntityLinkSchema` to `UnityEngine.Object` in exec code** — the
  type has an implicit numeric conversion, so
  `AssetDatabase.GetAssetPath(clip.Link)` is AMBIGUOUS (`GetAssetPath(Object)`
  vs `GetAssetPath(int)`); cast first.
- **DO produce ALL `.sceneWithBuildSettings` artifacts when forcing a bake** —
  the cached-artifact trap (lesson 09); a clean rebake is proven by a CHANGED
  artifact hash with zero new error lines, not by silence.

## Verification protocol

1. **Fresh-load asset dump**: `AssetDatabase.LoadAssetAtPath` the .playable in
   a NEW exec block; dump track + clips. Expected canonical state:
   `A_PatchCustomToLinked 0-0.5 Link=Schema_Actor(id=10) ReadRootFrom=Self(4)
   WriteTo=Custom(6) Fallback=None(0)`; `B_RetargetToCustom 2-2.5
   Link=Schema_Actor(id=10) ReadRootFrom=Self(4) WriteTo=Target(1)
   Fallback=Self(4)`; `C_CompensateRestore 4-4.5 Link=Root Link(id=3)
   ReadRootFrom=Self(4) WriteTo=Target(1) Fallback=Custom(6)`. In-memory state
   after a save is not evidence.
2. **Raw YAML check**: clip A `Link: {fileID: 11400000, guid:
   3b375c42affc2917f956d01310d31894, type: 2}`, `ReadRootFrom: 4`,
   `WriteTo: 6`, `Fallback: 0`; clip B same guid, `WriteTo: 1`, `Fallback: 4`;
   clip C `guid: c0c683033c37a137fae122e6ee8300c9`, `WriteTo: 1`,
   `Fallback: 6`. Field names PascalCase in YAML too.
3. **Schema check**: Schema_Actor YAML `id:` must be 10; Root Link `id:` 3 and
   its key must remain ABSENT from Stage_LinkRoot's buffer (the
   deliberate-miss guarantee).
4. **Binding check from a RELOADED SubScene**:
   `TargetPatchTrack(EntityLinkTargetPatchTrack) -> Stage_Actor
   (TargetsAuthoring)` — the component, not the Transform. Post-lesson-10 the
   table is 8 entries (B7 = TargetPatchTrack), all → Stage_Actor; keyed by
   track asset, grows additively, survives playableAsset swaps.
5. **Parent-scene restore**: end with sceneCount=1,
   `Assets/Scenes/Main Scene.unity|loaded=True|active=True|dirty=False`,
   director restored to
   `Assets/Training/01-transform-position-track/PositionMastery.playable`.
6. **Console**: `unity-cli console --filter error` must show nothing new
   except any DELIBERATE `cannot write to 'Self'` / `cannot write to 'None'`
   demos (remove the temp clips and prove a clean rebake via changed artifact
   hash). Known pre-existing vex-ee entries: UnityCliConnector HTTP server
   start, PerformanceTesting IPrebuildSetup/IPostBuildCleanup, TestResults.xml
   save, lessons 08/09's `E_TempNullLink` / `C_TempNullLink` demos.

## EntityLinks FAMILY CLOSING SUMMARY (lessons 07–10, quoted from the report)

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
