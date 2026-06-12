---
name: unity-track-essence-stat
description: Master of TimelineEssenceStatTrack + clip in vex-ee — while-active stat modifiers (add-on-enter/remove-on-exit by clip identity), the ×100 fixed-point int-Added truth, and the formula Σadded×(1+Σincreased)×Π(1+more). Use when a designer asks "during this clip, buff/nerf a stat".
---

# TimelineEssenceStatTrack specialist

You are the specialist for **`TimelineEssenceStatTrack`** and
**`TimelineEssenceStatClip`** from `Packages/BovineLabs.Timeline.Essence`,
namespace `BovineLabs.Timeline.Essence.Authoring`. Scope: exactly this track —
one clip = one **while-active** `StatModifier` (tagged with its own clip
entity as `SourceEntity`) appended to the resolved entity's `StatModifiers`
buffer on activation and removed — exactly that one — on deactivation.
Duration IS the effect window. This topic **closes the Essence triad**.
**Family fundamentals live in `unity-track-essence-event`** — load it for the
ESSENCE FAMILY REFERENCE (the quoted `TimelineEssenceResolver` semantics:
routeTo mandatory, resolved FIRST, `None` behaves like `Self`; the all-silent
bake-guard matrix; the dead-`RouteLinkKey`-on-Stat fact — this skill is its
third confirmation). Position in the triad: **events = transient signals,
intrinsics = permanent integer counters, stats = while-active float modifiers
(THIS — the only self-reverting track in the family)**.

All facts verified live in the **vex-ee** project, **2026-06** (reflection
dumps, package-source reads, raw YAML reads, fresh-load read-backs, one real
forced SubScene bake, all via `unity-cli exec`); no play mode — runtime claims
are source-derived.

## FAMILY CLOSING SUMMARY (quoted from the lesson-13 report)

> The Essence timeline triad is one resolver, one binding type, one silence
> policy, and three persistence models. All three tracks are empty sealed
> `DOTSTrack`s bound to `TargetsAuthoring`; all three clips carry `routeTo`
> (default `Self`; the resolver treats `None` like `Self` — unlike
> `Targets.Get(None)=Null`) and a `routeLink` field; all three systems run in
> `TimelineComponentAnimationGroup` after `EntityLinkTargetPatchSystem`, so
> they see same-frame retargets.
>
> **Trigger.** Event and Intrinsic are activation-edge one-shots — duration is
> meaningless, every off→on transition (loop, scrub, replay) re-fires. Stat
> alone listens to BOTH edges: add on activation, handle-based remove on
> deactivation — duration is the effect window.
>
> **Persistence.** Event: transient — the Reaction consumer clears the
> `ConditionEvent` buffer the same frame; nothing to undo. Intrinsic:
> permanent — no deactivation job exists; the only undo is a compensating
> clip, and the clamp can absorb it. Stat: while-active — self-reverting via
> the SourceEntity-matched remove; the only Essence track whose effect is
> guaranteed temporary.
>
> **Routing.** routeTo is mandatory everywhere and resolves FIRST (a dead
> routeTo loses the effect; a link can never rescue it). routeLink is LIVE on
> Event and Intrinsic (override wins when the hunt resolves, graceful fallback
> to routeTo otherwise) but **DEAD on Stat** — `RouteLinkKey` bakes into
> `TimelineEssenceStatData` and is never read (`TryResolveTarget`, not
> `TryResolveLinkedTarget`; confirmed three times across the family).
>
> **Guards.** The family is SILENT EVERYWHERE at bake (contrast EntityLinks:
> loud bake / silent runtime). The flavor differs: Event/Intrinsic bake
> THROUGH a null schema (Null/0 key, filtered per-frame at runtime); Stat
> silently ABORTS bake (`if (stat == null) return;` — no component at all).
> Runtime is silent too, except the family's one loud failure:
> `IntrinsicWriter.Add`'s "Key N not found in the intrinsic config" LogError.
> Numeric quirks per track: Event asserts on value 0; Intrinsic treats 0 as a
> quiet no-op (but still auto-adds the entry); Stat int-truncates flat adds
> and lives in a ×100 fixed-point world. Triage rule for the whole family: a
> clean console proves NOTHING — verify YAML and schema fields directly.
>
> **Designer use-case.** Event = "at this moment, tell gameplay something
> happened". Intrinsic = "at this beat, change a ledger". Stat = "for the
> duration of this clip, modify a number" (buffs, slow-mo windows, damage
> phases — while-active, stacking, auto-reverting). Transient signal,
> permanent counter, temporary modifier — pick by how long the effect must
> outlive the clip: one frame, forever, or exactly as long as the clip.

## Prerequisites & environment

- Act only through `unity-cli exec` / `unity-cli console`; never touch vex-ee
  via the filesystem; never enter play mode. Follow the **unity-cli skill's
  Safe Loop**. Smoke test: return active scene path + `Application.dataPath` →
  expect `Assets/Scenes/Main Scene.unity|/home/i/GitHub/vex-ee/Assets`.
- The `TrainingStage` (unity-stage-foundations) must exist in SubScene
  `Assets/Scenes/Main Sub Scene.unity`. The receiver MUST have `StatAuthoring`
  with **`StatsCanBeModified=True`** (lesson-00 default, confirmed on
  Stage_Actor). False removes at bake (quoted `StatsBuilder.ApplyTo` gate) the
  **`StatModifiers` buffer, the `StatChanged` enableable, AND the
  `StatDefaults` blob** — `StatCalculationSystem` requires all three, so stats
  freeze at baked values and the clip is a silent runtime `continue` skip.
- **NEVER create schema assets** — reuse the **114** `StatSchemaObject` assets
  under `Assets/Settings/Schemas/Stats/` (demo stat: `SlowMo.asset`, key 94).
- Your assets live only under
  `Assets/Training/13-timeline-essence-stat-track/`. Canonical asset:
  `StatMastery.playable` — one track `StatTrack`, clips A_Plus2Flat (0–3s,
  Added, value=2), B_Increased50pct (1–4s, Increased, value=0.5, overlapping
  A), C_Less25pct (5–6s, Less, value=0.25, routeLink=Schema_Actor kept as
  living documentation of the dead key); all `stat=SlowMo`, `routeTo=Self`.

## VERIFIED facts (vex-ee, 2026-06)

| Type | Base | Facts |
|---|---|---|
| `TimelineEssenceStatTrack` | `DOTSTrack` | sealed, EMPTY body. `[TrackClipType(TimelineEssenceStatClip)]`, `[TrackBindingType(BovineLabs.Reaction.Authoring.Core.TargetsAuthoring)]`, `[TrackColor(0.2,0.9,0.4)]`, `[DisplayName("BovineLabs/Essence/Timeline Stat")]` |
| `TimelineEssenceStatClip` | `DOTSClip` | sealed, `ClipCaps.Blending \| Looping` (COSMETIC — see edge cases), `duration => 1` (seed only) |
| System | `TimelineEssenceStatSystem` | `[UpdateInGroup(TimelineComponentAnimationGroup)]`, `[UpdateAfter(typeof(EntityLinkTargetPatchSystem))]` — sees same-frame TargetPatch retargets |

### Clip fields — camelCase (reflection + fresh-instance defaults)

| Field | Type | Default | Meaning |
|---|---|---|---|
| `routeTo` | `BovineLabs.Reaction.Data.Core.Target` | `Self` (4) | Who gets the modifier (`None` behaves like `Self`) |
| `routeLink` | `EntityLinkSchema` | null | **Baked but DEAD** — the Stat system never reads it |
| `stat` | `BovineLabs.Essence.Authoring.StatSchemaObject` | null | Which stat. Null → **SILENT bake ABORT** (no component at all) |
| `modifyType` | `BovineLabs.Essence.Authoring.StatAuthoringType` | `Added` (0) | Designer-positive vocabulary, six values (table below) |
| `value` | `float` | 0 | Magnitude. Negation for Subtracted/Reduced/Less happens at BAKE; **Added is `(int)`-truncated** |

Bake (quoted from `TimelineEssenceStatClip.Bake`):

```csharp
if (stat == null) return;                       // SILENT bake abort - no LogError, no component, skips base.Bake too
EntityLinkAuthoringUtility.TryGetKey(routeLink, out var linkKey);
var builder = new EssenceStatBuilder
{
    RouteTo = routeTo,
    RouteLinkKey = linkKey,                     // baked... and never read again (dead)
    Stat = stat.Key,
    ModifyType = StatAuthoringUtil.GetModifier(modifyType),
    Value = modifyType is StatAuthoringType.Subtracted or StatAuthoringType.Reduced
        or StatAuthoringType.Less ? -value : value   // NEGATION at bake; YAML stores the positive value
};
```

→ adds `TimelineEssenceStatData { Target RouteTo; ushort RouteLinkKey;
StatKey Stat; StatModifyType ModifyType; float Value; }` to the clip entity.

### StatAuthoringType → StatModifyType (quoted `StatAuthoringUtil.GetModifier`)

| StatAuthoringType | StatModifyType | Negated at bake? |
|---|---|---|
| `Added` | `Added` (0) | no |
| `Subtracted` | `Added` (0) | **yes** |
| `Increased` | `Additive` (1) | no |
| `Reduced` | `Additive` (1) | **yes** |
| `More` | `Multiplicative` (2) | no |
| `Less` | `Multiplicative` (2) | **yes** |

### StatModifier — the ×100 fixed-point / int-Added discovery

`StatModifier { StatKey Type; StatModifyType ModifyType; uint ValueRaw }` —
`ValueRaw` is a raw union: `Value` reinterprets as **int** (used by Added),
`ValueFloat` as float (Additive/Multiplicative). The buffer element is
`StatModifiers { Entity SourceEntity; StatModifier Value }`. **Flat adds are
integers** — quoted `StatAuthoringUtil.GetValueRaw` (this is also where
`StatDefaults` entries enter, via `StatModifierAuthoring.ToStatModifier()`):

```csharp
case StatAuthoringType.Added:      { var s = (int)value;  return UnsafeUtility.As<int, uint>(ref s); }
case StatAuthoringType.Subtracted: { var s = (int)-value; return UnsafeUtility.As<int, uint>(ref s); }
case StatAuthoringType.Increased:
case StatAuthoringType.More:       { return UnsafeUtility.As<float, uint>(ref value); }
case StatAuthoringType.Reduced:
case StatAuthoringType.Less:       { var neg = -value; return UnsafeUtility.As<float, uint>(ref neg); }
```

And `StatValue` (quoted — the ×100 fixed-point convention):

```csharp
public const float ToInt = 100f;  public const float ToFloat = 1 / ToInt;
public int Added;  public float Multi;
public float Value      => this.Added * this.Multi;
public float ValueFloat => this.Added * this.Multi * ToFloat;   // GetValueFloat consumers divide by 100
```

### The formula (quoted `StatModifierCalculator` fold)

`Sum` starts `{Added = 0, Increased = 1.0, More = 1.0}`; Added `+=` (int),
Increased `+=`, More `*= (1 + value)`. Final:

**`Value = (Σ added) × (1 + Σ increased) × Π(1 + more)`** — integer Σadded;
float consumers (`GetValueFloat`, e.g. the TimelineTimeScale track) read
`Value / 100`. The fold is commutative (modifiers then defaults — order
doesn't matter). Concrete walkthrough (canonical asset; stage base
`StatDefaults[0] = {SlowMo(94), Added, 0.25}` contributes
`(int)0.25` = **0**, not 0.25):

| Window | Active clips | Sum.Added | Sum.Increased | Sum.More | `Value` | `ValueFloat` |
|---|---|---|---|---|---|---|
| 0–1s | A (+2 Added) | 0(default)+2 = 2 | 1.0 | 1.0 | **2.0** | 0.02 |
| 1–3s | A + B (Increased 0.5) | 2 | 1.5 | 1.0 | **3.0** | 0.03 |
| 3–4s | B only | 0 | 1.5 | 1.0 | **0** | 0 |
| 5–6s | C (Less 0.25 → More ×0.75) | 0 | 1.0 | 0.75 | **0** | 0 |

The overlap stack is `(0 + 2) × (1 + 0.5) × 1 = ` **3.0 — NOT 3.375**: the
naive "(0.25 base + 2) × 1.5" is wrong because the 0.25 default truncates to
int 0 at bake. Corollary (family record correction): the lesson-04 StatDefaults
"vaccine" `{SlowMo, Added, 0.25}` puts key 94 in the buffer (missing-key trap
avoided) but computes `0 × 1 / 100 = 0` — frozen timeline by another road.
**"0.25 speed" must be authored as Value = 25** (`ValueFloat = Added/100`).

## Runtime semantics (one paragraph, source-quoted)

`TimelineEssenceStatSystem` is pure edge logic: on a clip's activation edge
(`[WithAll(ClipActive)] [WithDisabled(ClipActivePrevious)]`) `GatherAddJob`
silently skips null-key/null-binding clips
(`if (data.Stat.Value == 0 || binding.Value == Entity.Null) return;`),
resolves the receiver via `TryResolveTarget(data.RouteTo, binding.Value, ...)`
ONLY (routeLink dead), and enqueues a `StatModifier` whose value is
`(int)data.Value` for Added or float otherwise; on the deactivation edge
(mirror attributes) `GatherRemoveJob` enqueues a value-blind
`{Target, Source = clipEntity}`. A single-threaded `ApplyJob` drains ALL
removes before ALL adds each frame — each remove deletes at most ONE buffer
entry whose `SourceEntity == remove.Source` (`RemoveAtSwapBack` + `break`),
each add appends `{SourceEntity = add.Source, Value = add.Modifier}`;
receivers without a `StatModifiers` buffer are silent `continue` skips; every
touched receiver gets `StatChanged` enabled → `StatCalculationSystem` refolds
defaults + live modifiers → `StatChangedResetSystem` clears the flag.

## Canonical recipes (verbatim from the report)

- **Flat while-active buff ("+2 armor during the clip")**: bind a Stat track
  ("BovineLabs/Essence/Timeline Stat") to the target's `TargetsAuthoring`; one
  clip, `stat = <schema>` (REUSE the 114 under `Assets/Settings/Schemas/Stats/`
  — never create), `modifyType = Added`, `value = N`. **N must be a whole
  number** — flat adds are `(int)`-truncated; and remember the ×100 convention
  if a float consumer reads the stat (GetValueFloat divides by 100: "0.25" to
  a float reader = Added 25).
- **Percent buff ("+50% during the clip")**: `modifyType = Increased`,
  `value = 0.5`. Stacks additively with other Increased/Reduced clips: two
  +50% clips = +100%, not +125%. Author positive values; use `Reduced` for the
  negative direction (negated at bake, YAML stays positive).
- **Multiplicative window ("×0.75 damage while vulnerable")**:
  `modifyType = Less`, `value = 0.25` → `More *= (1 − 0.25)`. Multiplicative
  clips COMPOUND with each other.
- **The zero-base trap**: percent/multiplicative clips scale `Σadded` — if the
  stat has no flat base (int-truncated defaults included!), they compute
  `0 × anything = 0`. Give the stat a whole-number Added default first.
- **Receiver checklist**: `StatAuthoring` with `AddStats=True` and
  `StatsCanBeModified=True` (both default), bound via `TargetsAuthoring`;
  director needs `TimelineReferenceAuthoring`; duration = effect window;
  overlaps stack; loops/scrubs re-fire cleanly (add on each activation, remove
  on each deactivation).

## Edge cases & traps (each proven live or source-quoted, 2026-06)

- **DON'T trust a clean console for a null `stat` — SILENT bake ABORT** — a
  real forced bake of a null-stat temp clip produced ZERO new error lines in
  17,245 bytes of import-worker log growth; `if (stat == null) return;` skips
  the builder AND `base.Bake` — no `TimelineEssenceStatData` at all (the
  family's unique quiet abort).
- **DON'T expect overlaps to blend — blending is COSMETIC** — the A/B overlap
  serialized REAL blend data (`m_BlendIn/OutDuration: 2`, mix curves, dead
  YAML), yet a grep of the entire `BovineLabs.Timeline.Essence` runtime
  assembly for `Weight/Mix/Blend/IAnimatedComponent/TrackBlendImpl/Ease` is
  zero hits — overlapping stat clips STACK at full strength, never blend.
- **DO trust SourceEntity-handle symmetric removal** — removal matches
  `array[i].SourceEntity == remove.Source` only (the remove mutation carries
  NO modifier value): two identical overlapping clips are perfectly symmetric,
  each removing exactly its own buffer entry, the survivor untouched.
- **DO rely on removes-drain-before-adds** — `ApplyJob` processes ALL removes
  before ALL adds each frame, so a same-frame back-to-back clip handoff never
  double-counts.
- **DON'T set `routeLink` expecting routing — DEAD on Stat (third family
  confirmation)** — it bakes into `RouteLinkKey` (proven via Schema_Actor on
  clip C) but `TimelineEssenceStatSystem.cs` has zero references to it.
- **DO trust scrub/stop safety** — timeline deactivation force-clears
  `ClipActive` (quoted `ResetOnTimelineDeactivatedJob`,
  `ClipLocalTimeSystem.cs`) while `ClipActivePrevious` stays set, so
  GatherRemoveJob fires next frame — no orphaned modifiers.
- **DON'T put percent/multiplicative clips on a zero-base stat — invisible** —
  with `Σadded = 0` (int-truncated defaults included), Increased/More clips
  compute `0 × anything = 0` (proven in the 3–6s walkthrough windows).
- **DON'T author fractional flat adds — truncated at bake AND runtime** —
  bake-side `GetValueRaw` does `(int)value` for Added/Subtracted (StatDefaults
  take the same path); runtime-side GatherAddJob does
  `modifier.Value = (int)data.Value` — a flat 0.25 becomes 0 both ways. In the
  ×100 fixed-point world, **author 25 to mean 0.25** (`ValueFloat = Added/100`).

## Verification protocol

1. **Fresh-load asset dump**: `AssetDatabase.LoadAssetAtPath` the .playable in
   a NEW exec block; expect 3 clips: `A_Plus2Flat 0-3 Added value=2`,
   `B_Increased50pct 1-4 Increased value=0.5`, `C_Less25pct 5-6 Less
   value=0.25`; all `stat=SlowMo(key=94)`, `routeTo=Self(4)`. In-memory state
   after a save is not evidence.
2. **Raw YAML check**: clip A `modifyType: 0 / value: 2`; B `modifyType: 2 /
   value: 0.5`; C `modifyType: 5 / value: 0.25` (**positive** — negation is
   bake-only) plus `routeLink: {fileID: 11400000, guid:
   3b375c42affc2917f956d01310d31894, type: 2}` (Schema_Actor, id=10); A/B
   carry auto-generated blend data (cosmetic — expected, harmless).
3. **Stat-side checks**: SlowMo `key: 94`; `FindAssets("t:StatSchemaObject")`
   → 114 (re-count — inventories drift); Stage_Actor `StatsCanBeModified=True`.
4. **Binding check from a RELOADED SubScene**: `StatTrack
   (TimelineEssenceStatTrack) → Stage_Actor (TargetsAuthoring)` — the
   component, not the Transform. Post-lesson-13 the director's scene-binding
   table is **11** entries (prior 10 preserved).
5. **Parent-scene restore**: end with sceneCount=1,
   `Assets/Scenes/Main Scene.unity|loaded=True|active=True|dirty=False`,
   director restored to
   `Assets/Training/01-transform-position-track/PositionMastery.playable`.
6. **Console**: `unity-cli console --filter error` shows nothing new (known
   pre-existing: UnityCliConnector HTTP start, PerformanceTesting
   setup/cleanup, TestResults.xml save, lessons 08–10 `[Worker2]` EntityLinks
   errors). This track is bake-silent even when misconfigured — silence is
   expected, not evidence.
