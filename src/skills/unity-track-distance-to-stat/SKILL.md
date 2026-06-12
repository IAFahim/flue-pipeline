---
name: unity-track-distance-to-stat
description: Master of DistanceToStatTrack + clip in vex-ee — continuous/interval distance measurement into a live-updating while-active stat modifier, the multiplier=100 rule, the mode-doubles-as-readRootFrom link quirk. Use when a designer asks "feed the distance between A and B into a stat".
---

# DistanceToStatTrack specialist

You are the specialist for **`DistanceToStatTrack`** and **`DistanceToStatClip`**
from `Packages/BovineLabs.Timeline.Distance`, namespace
`BovineLabs.Timeline.Distance.Authoring`. Scope: exactly this track — the lone
Distance-package track and the program's first **CAPSTONE clip**: one clip
touches **Targets** (three slots), **EntityLinks** (three link overrides), and
**Essence stats** (while-active modifier) at once. While the clip is active,
`distance(from, to) × multiplier` is `(int)math.round`-ed into a flat-Added
`StatModifier` on the resolved receiver, **replaced in place** every update and
removed on the deactivation edge. Duration IS the effect window.

**Cross-references:** load `unity-track-essence-stat` for the StatModifier
while-active pattern (SourceEntity-keyed buffer entries, the ×100 fixed-point
int-Added truth, the formula Σadded×(1+Σincreased)×Π(1+more)) and
`unity-track-entitylink-copytransform` for schema-link resolution fundamentals
(`EntityLinkResolver.TryResolve`, root hop via `EntityLinkSource.Root`, linear
`EntityLinkEntry` search, key 0 / missing buffer = silent fail).

### Capstone integration map (which prior lesson's machinery each field touches)

| Clip field | Machinery | Prior lesson |
|---|---|---|
| Track binding (TargetsAuthoring) | `TrackBinding.Value` = binding entity; `Targets` component read per frame | 00 (stage), every track since 05 |
| `from` / `to` / `statTarget` | `Targets.Get(mode, self)` — the verified enum `None=0,Target=1,Owner=2,Source=3,Self=4,Custom=6`; None/unset → Entity.Null | 05–07 (Target enum, lesson-07 family ref) |
| `fromLink` / `toLink` / `statTargetLink` | `EntityLinkResolver.TryResolve` — schema ushort key, root hop via `EntityLinkSource.Root`, linear `EntityLinkEntry` search; key 0 / missing buffer = silent fail | 07 (resolver walkthrough), 00 (Schema_Actor id=10, LinkRoot trio) |
| `stat` | `StatSchemaObject.Key` → `StatKey`; null = silent bake abort | 04/13 (schema reuse, never create) |
| `multiplier` | ×100 fixed-point int-Added encoding (`StatValue.ToInt = 100`) | 13 (the ×100 discovery), 04 (the truncated-0.25 vaccine corrected to 25) |
| while-active write | `StatModifiers{SourceEntity, Value}` buffer keyed by clip entity; remove on deactivation edge; `StatChanged` → `StatCalculationSystem` refold | 13 (TimelineEssenceStat pattern) |
| `mode` / `interval` | per-clip `DistanceToStatState.Timer` — clip-entity state like lesson 06's composite timers in spirit | new to 14 |
| System ordering | `UpdateAfter(EntityLinkTargetPatchSystem)` — sees same-frame retargets | 10 (TargetPatch), 11–13 (same ordering) |

All facts verified live in the **vex-ee** project, **2026-06** (reflection
dumps, package-source reads, raw YAML reads, fresh-load read-backs, one real
forced SubScene bake, all via `unity-cli exec`); no play mode — runtime claims
are source-derived.

## Prerequisites & environment

- Act only through `unity-cli exec` / `unity-cli console`; never touch vex-ee
  via the filesystem; never enter play mode. Follow the **unity-cli skill's
  Safe Loop**. Smoke test: return active scene path + `Application.dataPath` →
  expect `Assets/Scenes/Main Scene.unity|/home/i/GitHub/vex-ee/Assets`.
- The `TrainingStage` (unity-stage-foundations) must exist in SubScene
  `Assets/Scenes/Main Sub Scene.unity`. Receiver checklist: bound object
  carries `TargetsAuthoring` (slots filled for every `Target` mode you use!);
  the stat receiver has `StatAuthoring` with `AddStats=True` and
  `StatsCanBeModified=True`; the director has `TimelineReferenceAuthoring`.
  Stage geometry: Stage_Actor world (0,1,0) → Stage_Target (5,0,0),
  distance = √26 ≈ 5.0990 m. Stage_Actor's Targets:
  `Owner=null|Source=null|Target=Stage_Target` (the from=Owner trap's root).
- **NEVER create schema assets** — reuse the **114** `StatSchemaObject` assets
  under `Assets/Settings/Schemas/Stats/` (demo stat: `Luck.asset`, key 57).
- Your assets live only under `Assets/Training/14-distance-to-stat-track/`.
  Canonical asset: `DistanceMastery.playable` — one track `DistanceTrack`,
  clips A_ContinuousCm (0–4s, multiplier=100, Continuous),
  B_IntervalHalfSec (5–8s, multiplier=1, Interval 0.5 — the truncation lesson),
  C_LinkRouted (9–10s, toLink=Schema_Actor kept as living documentation of the
  mode-doubles-as-readRootFrom quirk); all `stat=Luck`, `from=Self`,
  `to=Target`, `statTarget=Self`.

## VERIFIED facts (vex-ee, 2026-06)

| Type | Facts |
|---|---|
| `DistanceToStatTrack` | `BovineLabs.Timeline.Distance.Authoring`, sealed, base `DOTSTrack`. `[TrackClipType(DistanceToStatClip)]`, `[TrackBindingType(BovineLabs.Reaction.Authoring.Core.TargetsAuthoring)]`, `[TrackColor(0.20,0.90,0.70)]`, `[DisplayName("BovineLabs/Distance/Distance To Stat")]`. The lone Distance-package track. |
| `DistanceToStatClip` | sealed, base `DOTSClip`, `clipCaps => ClipCaps.Blending \| ClipCaps.Looping` (COSMETIC — see edge cases), `duration => 1` (seed only). |
| `DistanceUpdateMode` | `BovineLabs.Timeline.Distance.Data`, **byte-backed**: `OnStart=0, Continuous=1, Interval=2`. |
| System | `DistanceToStatSystem` — `[UpdateInGroup(TimelineComponentAnimationGroup)]`, `[UpdateAfter(typeof(EntityLinkTargetPatchSystem))]` (sees same-frame TargetPatch retargets, like the Essence triad). |

### Clip fields — camelCase (reflection + fresh-instance defaults)

| Field | Type | Default | Meaning |
|---|---|---|---|
| `from` | `Target` | **`Owner` (2)** | Distance endpoint A (TRAP — Stage_Actor's Owner is unset; see edge cases) |
| `fromLink` | `EntityLinkSchema` | null | Link override for A |
| `to` | `Target` | `Target` (1) | Distance endpoint B |
| `toLink` | `EntityLinkSchema` | null | Link override for B |
| `statTarget` | `Target` | `Self` (4) | Who receives the stat modifier |
| `statTargetLink` | `EntityLinkSchema` | null | Link override for the receiver |
| `stat` | `StatSchemaObject` | null | Which stat. Null → **SILENT bake abort** (Essence-style) |
| `multiplier` | `float` | 1 | Applied BEFORE the int conversion (tooltip: "e.g., 100 to map 1.5m to 150") |
| `mode` | `DistanceUpdateMode` | `Continuous` (1) | OnStart / Continuous / Interval |
| `interval` | `float` | 0.5 | Used only when mode=Interval |

Bake (quoted from `DistanceToStatClip.Bake`):

```csharp
if (stat == null) return;   // SILENT abort - no LogError, skips base.Bake too
EntityLinkAuthoringUtility.TryGetKey(fromLink, out var fromKey);   // null -> key 0
...
Data = new DistanceToStatData { From = from, FromLinkKey = fromKey, To = to, ToLinkKey = toKey,
    StatTarget = statTarget, StatLinkKey = statTargetKey, StatKey = stat.Key,
    Mode = mode, Interval = interval, Multiplier = multiplier },
HasState = true
```

→ adds `DistanceToStatData` + `DistanceToStatState { float Timer }` (the
interval timer lives ON the clip entity) via `DistanceToStatBuilder.ApplyTo`.

### Demo stat: Luck (key=57) — and why

Quoted YAML: `m_Name: Luck`, `isGlobal: 0`, `key: 57`, guid
`a1894082169143a99b790f676641cb90`. A project-wide guid sweep found Luck (and
ComboCounter) referenced exactly **once** each — only the
`EssenceSettings.asset` registration, zero gameplay consumers (SlowMo by
contrast: 4 refs incl. TimeScaleMastery/StatMastery — correctly avoided).
Luck chosen over ComboCounter on semantics: "ComboCounter" reads as a combat
stat a designer might later wire into fight logic; "Luck" is neutral. Since
training never enters play mode no stat value is ever actually written — the
choice is about leaving a SAFE example for designers to copy.

### Runtime semantics (one paragraph, source-quoted)

`DistanceToStatSystem` runs three jobs per frame: `GatherActiveJob`
(`[WithAll(ClipActive)]`, every active frame) guards
`binding.Value == Entity.Null || data.StatKey.Value == 0` and a missing
`Targets` on the binding (silent returns), detects the activation edge via
`var isFirstFrame = !activePrev.ValueRO`, computes `shouldUpdate` per mode
(OnStart → first frame only; Continuous → always; Interval → first frame does
`state.Timer = 0f; shouldUpdate = true;`, later frames accumulate
`state.Timer += DeltaTime` and fire on `Timer >= Interval` with
`Timer -= Interval`), resolves all three slots through `ResolveTarget` (link
hunt first iff `linkKey != 0`, else/on-failure `targets.Get(mode, self)`),
silently skips if ANY of from/to/stat is `Entity.Null` or from/to lacks
`LocalToWorld`, then computes
`distance = math.distance(fromLtw.Position, toLtw.Position) * data.Multiplier`
and enqueues `StatModifier { Type = StatKey, ModifyType = Added, Value =
(int)math.round(distance) }` keyed by `Source = clipEntity`; `GatherRemoveJob`
(the deactivation edge) re-resolves only statTarget and enqueues an `IsRemove`
mutation; the single-threaded `ApplyJob` drains the one queue in order and for
EVERY mutation first `RemoveAtSwapBack`s the at-most-one buffer entry with
`SourceEntity == mutation.Source` then `buffer.Add`s the fresh value unless
IsRemove — net ONE buffer entry per clip, updated in place while active,
deleted at clip end — and enables `StatChanged` on every touched receiver.

### ResolveTarget — mode doubles as readRootFrom (quoted)

```csharp
if (linkKey != 0 &&
    EntityLinkResolver.TryResolve(self, targets, mode, linkKey, sources, entries, out var linked))
    return linked;
return targets.Get(mode, self);
```

Inside `EntityLinkResolver.TryResolve`:
`var rootCandidate = targets.Get(readRootFrom, self);` — **the clip has NO
separate `readRootFrom` field; the same `mode` enum is BOTH the link-hunt
start AND the fallback slot.** The curriculum's clip-C prediction (`to=Target`
+ `toLink=Schema_Actor` "resolves to Stage_Actor, distance 0") was WRONG: the
hunt starts at Stage_Target, which carries no `EntityLinkSource` and no
`EntityLinkEntry` buffer → silent fail → fallback `targets.Get(Target)` =
Stage_Target. C measures actor→cube ≈ 5.10 m like clip A, NOT 0.

### The multiplier=100 rule (×100 fixed-point chain, concrete numbers)

Chain: `float distance → × multiplier → (int)math.round → int Added → float
readers divide by 100` (`StatValue { int Added; ... ValueFloat => Added *
Multi / 100 }`). Stage distance = √26 ≈ **5.0990 m**:

| Clip | multiplier | distance×mult | `(int)math.round` | Added | Float-side read |
|---|---|---|---|---|---|
| A_ContinuousCm | 100 | 509.90 | **510** | 510 | **5.10** ✓ (meters preserved to cm) |
| B_IntervalHalfSec | 1 | 5.0990 | **5** | 5 | **0.05** ✗ (99% of the value destroyed) |

**multiplier=100 makes the stat's integer units centimeters, which is exactly
×100 fixed-point — float readers get meters back.** multiplier=1 is almost
always a designer mistake under ×100 encoding.

## Canonical recipes (verbatim from the report)

### The proximity-stat pattern

1. Receiver checklist (lesson 00/13): bound object carries `TargetsAuthoring`
   (slots filled for every `Target` mode you use!) and the stat receiver has
   `StatAuthoring` with `AddStats=True`, `StatsCanBeModified=True`; director
   has `TimelineReferenceAuthoring`.
2. Add track "BovineLabs/Distance/Distance To Stat"; bind it to the
   TargetsAuthoring COMPONENT (`director.SetGenericBinding(track, targetsComp)`).
3. One clip: `from=Self` (NEVER trust the Owner default unless Owner is
   actually wired), `to=Target` (or a link override whose mode-entity reaches a
   link root), `statTarget=Self`, `stat=<reused schema>`,
   **`multiplier=100`** (the ×100 rule), `mode` per need.
4. Mode choice: `OnStart` = snapshot once at clip start; `Continuous` =
   per-frame live distance (costs a full stat refold every frame — see
   performance note); `Interval` + `interval=N` = sampled every N seconds
   (timer re-zeroes on every (re)activation).
5. Duration IS the effect window: the stat entry exists only while the clip is
   active and is removed on the deactivation edge (scrub/stop safe — timeline
   deactivation force-clears ClipActive, so GatherRemoveJob still fires).

### The CORRECTED link-routing recipe (measure to a linked thing)

For a link override to actually win, **the mode slot must point at an entity
that reaches a link root**: `to=Self` hunts from Stage_Actor →
`EntityLinkSource.Root = Stage_LinkRoot` → buffer `{Key=10 → Stage_Actor}` →
resolves Stage_Actor (degenerate distance self→self = 0 on this stage — and
indistinguishable from its own fallback). Designer rule: **link overrides on
this clip only re-route a slot whose mode-entity is (or parents under) a link
root** — e.g. measuring to a linked weapon/anchor hanging off the entity the
mode slot already points at.

## Edge cases & traps (each proven live or source-quoted, 2026-06)

- **DON'T trust a clean console for a null `stat` — SILENT bake ABORT,
  real-bake proven** — temp clip TEMP_NullStat + forced SubScene reimport grew
  the import-worker log by 17,245 bytes with ZERO error lines and zero clip
  mentions; `if (stat == null) return;` skips builder AND `base.Bake`.
- **DON'T trust the default `from=Owner` — silent permanent skip; author
  `from=Self`** — Stage_Actor's Targets read back `Owner=null` (fresh SubScene
  load), so `targets.Get(Owner)` = Entity.Null → per-frame silent return;
  fourth family confirmation of the explicit-Self rule.
- **DON'T use multiplier=1 under ×100 encoding — the truncation chain** —
  5.0990 m ×100 → 510 → reads 5.10; ×1 → 5 → reads 0.05 (99% destroyed).
- **DON'T expect a link override to win when the mode-entity reaches no link
  root — mode doubles as readRootFrom** — clip C (`to=Target`,
  toLink=Schema_Actor) fell back to Stage_Target because the hunt starts at
  `targets.Get(mode)`; the curriculum's prediction was wrong — use `to=Self`
  (the corrected recipe above) and the override LOOKS dead otherwise.
- **DO distinguish replace-per-update from EssenceStat's single edge add** —
  EssenceStat adds ONE entry on activation and removes on deactivation;
  Distance enqueues a mutation EVERY update (`RemoveAtSwapBack` own-Source
  entry, `break`, then `Add` unless IsRemove) — net one live entry, both
  remove on clip end. Corollary: GatherRemoveJob RE-resolves statTarget at
  remove time — a same-frame TargetPatch retarget can orphan the modifier
  (stagger such clips).
- **DO remember Distance ROUNDS where EssenceStat TRUNCATES** —
  `(int)math.round(distance)` here vs `(int)value` in lesson 13: 5.099×100 →
  510, not 509.
- **DO trust the interval timer — re-zeroed per activation, drift-free** —
  quoted `if (isFirstFrame) { state.Timer = 0f; shouldUpdate = true; }`; first
  frame ALWAYS samples, then `Timer -= Interval` (not `= 0`) between samples;
  stale `DistanceToStatState` is never read on re-entry.
- **DON'T expect overlaps to blend — Blending|Looping is COSMETIC** — a grep
  of every Distance-package `.cs` for Weight/MixData/TrackBlend/
  IAnimatedComponent/Ease/Blend hits exactly ONE line: the `clipCaps`
  declaration itself; overlapping clips' Added values SUM in the stat fold.
- **DON'T default to Continuous for slow-changing uses — StatChanged EVERY
  update** — `ApplyJob` enables `StatChanged` per mutation, so Continuous =
  full `StatCalculationSystem` refold of the receiver every frame; prefer
  `Interval`, or `OnStart` for one-shot snapshots.
- **DO rely on write-side stat-map self-heal — but mind the reader-only
  trap** — `StatModifierCalculator.ApplyTo` does `stats.Clear()` then
  `GetOrAddRefUnsafe(key)`, so the receiver does NOT need the stat in
  `StatDefaults`; but the key vanishes from the map once the modifier is
  removed — readers polling between/after clips see key-missing again.
- **DON'T create schema assets — ever** — reuse the 114 under
  `Assets/Settings/Schemas/Stats/` (re-count; inventories drift).

## Verification protocol

1. **Fresh-load asset dump** (separate exec block) — 3 clips:
   `A_ContinuousCm 0-4 from=Self to=Target mult=100 Continuous`,
   `B_IntervalHalfSec 5-8 mult=1 Interval 0.5`,
   `C_LinkRouted 9-10 toLink=Schema_Actor(10) mult=100`; all
   `stat=Luck(key=57)`, `statTarget=Self(4)`. In-memory state after a save is
   not evidence.
2. **Raw YAML** — stat guid `a1894082169143a99b790f676641cb90` (Luck) on all
   three; C's toLink `3b375c42affc2917f956d01310d31894` (Schema_Actor, id=10);
   enum bytes (`from: 4`, `to: 1`, `statTarget: 4`, `mode: 1`); no
   `{fileID: 0}` where a ref was intended; no overlap → `m_BlendInDuration: -1`;
   track carries `resetOnDeactivate: 1`.
3. **Stage checks** — StatDefaults[0]={SlowMo,Added,25} (lesson-13 correction);
   Targets Owner/Source unset, Target=Stage_Target; Schema_Actor id=10;
   114 StatSchemaObjects.
4. **Binding from a RELOADED SubScene** — director table **12** entries, #11 =
   `DistanceTrack (DistanceToStatTrack) → Stage_Actor (TargetsAuthoring)`;
   prior 11 byte-for-byte intact.
5. **Parent-scene restore** — sceneCount=1,
   `Assets/Scenes/Main Scene.unity|loaded=True|active=True|dirty=False`,
   director restored to
   `Assets/Training/01-transform-position-track/PositionMastery.playable`.
6. **Console** — only known pre-existing entries (UnityCliConnector HTTP
   start, PerformanceTesting setup/cleanup, TestResults.xml, lessons 08–10
   `[Worker2]` EntityLinks errors). This clip is bake-silent even when
   misconfigured — silence is expected, not evidence.
