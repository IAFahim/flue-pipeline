---
name: unity-track-essence-intrinsic
description: Master of TimelineEssenceIntrinsicTrack + clip in vex-ee — one-shot permanent integer counters with self-healing auto-add and stat-driven clamping. Use when a designer asks "at this beat, grant +N / consume N of a counter".
---

# TimelineEssenceIntrinsicTrack specialist

You are the specialist for **`TimelineEssenceIntrinsicTrack`** and
**`TimelineEssenceIntrinsicClip`** from `Packages/BovineLabs.Timeline.Essence`,
namespace `BovineLabs.Timeline.Essence.Authoring`. Scope: exactly this track —
one clip = one edge-triggered, **permanent**, clamped delta to an integer
counter (`IntrinsicKey` + signed amount) in a resolved entity's `Intrinsic`
buffer.

**Family fundamentals live in `unity-track-essence-event`** — load it for the
ESSENCE FAMILY REFERENCE: the quoted `TimelineEssenceResolver` semantics
(routeTo mandatory and resolved FIRST; `Target.None` behaves like `Self`;
routeLink override wins when it resolves and falls back to routeTo, still
firing), the all-silent bake-guard matrix, and the dead-`RouteLinkKey`-on-Stat
fact. Position in the Essence triad: **events = transient signals (fire,
react, evaporate), intrinsics = permanent integer counters (THIS — the counter
IS the state), stats = while-active float modifiers**. `routeLink` is LIVE on
this clip, unlike Stat's dead key — only Event and Intrinsic route through
links.

All facts verified live in the **vex-ee** project, **2026-06** (reflection
dumps, raw YAML reads, full package-source reads via `unity-cli exec`,
fresh-load read-backs, a real forced bake for the silent-null demo); no play
mode — runtime claims are source-derived.

## THE HEADLINE — permanent, clamped, self-healing

Everything this track writes **persists forever** — the exact opposite of the
Event track's same-frame evaporation. There is no deactivation job, no revert,
no stored "before": the only undo is a compensating clip with the opposite
amount (and the clamp may eat part of it). The writer **self-heals** missing
entity entries (auto-add at schema default — the anti-lesson-04), clamps every
delta into static-range-unless-stat-overridden bounds, and carries the Essence
family's **only LOUD failure**: an unknown key in the runtime config LogErrors
— at RUNTIME, never at bake.

## Prerequisites & environment

- Act only through `unity-cli exec` / `unity-cli console`; never touch vex-ee
  via the filesystem; never enter play mode. Follow the **unity-cli skill's
  Safe Loop** (inspect → mutate once → save → verify → restore → console
  check). Smoke test:
  `unity-cli exec "return UnityEditor.SceneManagement.EditorSceneManager.GetActiveScene().path + \"|\" + Application.dataPath;"`
  → expect `Assets/Scenes/Main Scene.unity|/home/i/GitHub/vex-ee/Assets`.
- The `TrainingStage` (unity-stage-foundations) must exist in SubScene
  `Assets/Scenes/Main Sub Scene.unity`. **Stage_Actor's `StatAuthoring` with
  `AddIntrinsics=True` and EMPTY `IntrinsicDefaults` is FINE** — verified:
  `AddIntrinsics=True | IntrinsicDefaults.size=0 | IntrinsicDefaultGroups.size=0`.
  At bake that yields an empty `Intrinsic` buffer
  (`DynamicHashMap<IntrinsicKey,int>`, no entries); entries are auto-added on
  first writer touch at the schema's `defaultValue`. This is a deliberate
  CONTRAST with lesson 04's stat track, which required a `StatDefaults`
  append (the vaccine) — no stage mutation is needed here.
- **NEVER create schema assets** — reuse the **78** `IntrinsicSchemaObject`
  assets under `Assets/Settings/Schemas/Intrinsics/` (proven-neutral choice:
  `BaseTime`).
- Your assets live only under
  `Assets/Training/12-timeline-essence-intrinsic-track/`. Canonical asset:
  `IntrinsicMastery.playable` — one track `IntrinsicTrack`, clips A_Add5
  (1–1.5s, +5), B_Subtract2 (3–3.5s, −2), C_Add3 + D_Add4 (both 5–5.5s,
  deliberately overlapping on one track), all `intrinsic=BaseTime`,
  `routeTo=Self`.

## VERIFIED facts (vex-ee, 2026-06)

| Type | Base | Facts |
|---|---|---|
| `TimelineEssenceIntrinsicTrack` | `DOTSTrack` | sealed, EMPTY body. `[TrackClipType(TimelineEssenceIntrinsicClip)]`, `[TrackBindingType(BovineLabs.Reaction.Authoring.Core.TargetsAuthoring)]`, `[TrackColor(0.2,0.6,0.9)]`, `[DisplayName("BovineLabs/Essence/Timeline Intrinsic")]` |
| `TimelineEssenceIntrinsicClip` | `DOTSClip` | sealed, `ClipCaps.None`, `duration => 1` (seed only) |
| System | `TimelineEssenceIntrinsicSystem` | `[UpdateInGroup(TimelineComponentAnimationGroup)]`, `[UpdateAfter(typeof(EntityLinkTargetPatchSystem))]` — sees same-frame TargetPatch retargets |

### Clip fields — camelCase (reflection + fresh-instance defaults)

| Field | Type | Default | Meaning |
|---|---|---|---|
| `routeTo` | `BovineLabs.Reaction.Data.Core.Target` | **`Self` (4)** | Who receives the counter change (`None` behaves like `Self`) |
| `routeLink` | `EntityLinkSchema` | null | Optional link override — **LIVE here** (unlike Stat); wins when it resolves, falls back to routeTo otherwise |
| `intrinsic` | `BovineLabs.Essence.Authoring.IntrinsicSchemaObject` | null | Which counter. Null is SILENT at bake (key 0) and runtime-filtered |
| `amount` | `int` | 1 | Signed delta. **Negative is legal = subtract** (`amount: -2` serialized verbatim in YAML, nothing clamps at authoring). **Zero is a legal quiet no-op — NO zero-assert**, unlike the Event family |

Bake (quoted from `TimelineEssenceIntrinsicClip.Bake`):

```csharp
EntityLinkAuthoringUtility.TryGetKey(routeLink, out var linkKey);
var builder = new EssenceIntrinsicBuilder
{
    RouteTo = routeTo,
    RouteLinkKey = linkKey,
    Intrinsic = intrinsic ? intrinsic.Key : default(IntrinsicKey),   // SILENT null guard
    Amount = amount
};
```

→ adds `TimelineEssenceIntrinsicData { Target RouteTo; ushort RouteLinkKey;
IntrinsicKey Intrinsic; int Amount; }` to the clip entity. No `Debug.LogError`
anywhere — Essence = silent everywhere at bake.

### Schema inventory & demo schema

**78** `IntrinsicSchemaObject` assets under
`Assets/Settings/Schemas/Intrinsics/`; all 78 registered in
`Assets/Settings/Settings/EssenceSettings.asset` (intrinsics=78, stats=114).
**39 of the 78 set `maxStat`** (none set `minStat`) — e.g. `BlazeStacks`
(key 10, range [0,5]) whose `maxStat` guid resolves to
`Assets/Settings/Schemas/Stats/MaxBlazeStacks.asset` (StatKey **73**).
Demo schema — `Assets/Settings/Schemas/Intrinsics/BaseTime.asset` (raw YAML):

```yaml
m_Name: BaseTime
key:
  Value: 45
defaultValue: 0
range: {x: 0, y: 999999}
minStat: {fileID: 0}
maxStat: {fileID: 0}
```

## THE CORE — IntrinsicWriter.Add + GetLimits, quoted

Source: `com.bovinelabs.essence@48b66d5fa12e/BovineLabs.Essence/IntrinsicWriter.cs`.

```csharp
public (int Current, int Delta) Add(IntrinsicKey key, int delta)
{
    if (!this.EssenceConfig.Value.Value.IntrinsicDatas.TryGetValue(key, out var ptr))
    {
        BLGlobalLogger.LogError($"Key {key.Value} not found in the intrinsic config");
        return (0, 0);
    }

    ref var data = ref ptr.Ref;
    ref var intrinsic = ref this.intrinsics.AsMap().GetOrAddRefUnsafe(key, data.DefaultValue);

    var (min, max) = this.GetLimits(data);

    var before = intrinsic;
    intrinsic = math.clamp(intrinsic + delta, min, max);
    delta = intrinsic - before; // The actual delta

    if (Hint.Unlikely(delta == 0))
    {
        return (intrinsic, 0);
    }

    this.TryWriteEvents(data, delta);
    return (intrinsic, delta);
}
```

(`Subtract(key, delta)` is literally `Add(key, -delta)`; `Set` is the same
shape with `intrinsic = math.clamp(value, min, max);`.) `GetLimits`: min/max
start at the schema's static `range`; if the schema sets `MinStatKey`/
`MaxStatKey` (≠ 0) AND that stat key is present in the entity's stat buffer
(`statMap.TryGetValue`), the bound becomes `(int)math.floor(stat.Value)`; a
configured-but-missing stat gracefully falls back to the static bound (a
TryGetValue — no lesson-04 default-0 trap inside GetLimits).
`TryWriteEvents`: `if (this.eventWriter.IsValid && intrinsicData.Event != 0)
this.eventWriter.Trigger(intrinsicData.Event, delta);`.

The walkthrough: (1) **config lookup** — the family's ONLY loud failure, at
RUNTIME (`LogError` + no-op `(0,0)`); (2) **auto-add** — `GetOrAddRefUnsafe`
creates a missing entity entry at the schema default, then applies the delta
(self-healing); (3) **clamp** — static range unless individually overridden by
`floor(stat)` dynamic bounds; (4) **effective delta** = clamped − before; 0 →
early return, no event, nothing observable — so the Event family's
`Check.Assume(value != 0)` is unreachable from this path; (5) **event bridge**
— on a real change, fires the schema's associated ConditionKey with the
EFFECTIVE delta. Also in the file: internal `RestrictMin`/`RestrictMax`
re-clamp existing intrinsics when a LIMIT stat changes
(`EssenceConfig.StatsLimitIntrinsics` reverse map); they skip `!IsCreated`
entities — auto-add applies only to Add/Set/Subtract.

## Runtime semantics (one paragraph, source-derived)

`TimelineEssenceIntrinsicSystem` mirrors the Event pipeline with a persistent
destination: on each clip's ACTIVATION edge only (`[WithAll(ClipActive)]
[WithDisabled(ClipActivePrevious)]` — duration, end, and deactivation are
meaningless), `GatherJob` skips silently
(`if (data.Intrinsic.Value == 0 || binding.Value == Entity.Null) return;`),
otherwise resolves the receiver through the Essence resolver and accumulates
`(target, key, amount)`; `ApplyJob` coalesces same-frame same-key amounts per
receiver in a `FixedList4096Bytes` (overflow entries apply immediately without
joining the sum; entities without an `Intrinsic` buffer are silently skipped
by `Writers.TryGet`) and issues ONE `IntrinsicWriter.Add(key, summedAmount)`
per (receiver, key) — C_Add3 + D_Add4 land as a single `Add(45, +7)`.

## Canonical recipes (verbatim from the report)

- **Grant ("at this beat, +5 combo points")**: bind an Intrinsic track
  ("BovineLabs/Essence/Timeline Intrinsic") to the receiver's
  `TargetsAuthoring`; one clip, `intrinsic = <schema>`, `routeTo = Self`,
  `amount = +N`. Only the clip's START matters. REUSE the 78 schemas under
  `Assets/Settings/Schemas/Intrinsics/` — never create keys.
- **Consume ("spend 1 charge")**: same, `amount = −N`. Know the floor: if the
  counter is already at min, the consume is silently absorbed (effective delta
  0, no event) — there is no debt and no failure signal on the timeline side.
  Gate the cutscene on the counter via a Reaction condition if "can't afford"
  matters.
- **Coalesce ("3 pickups land at once")**: N clips, same schema, same resolved
  target, same start time (same-track overlap is API-legal) → ONE `Add` with
  the summed amount, one event with the summed effective delta — not N events.
- **Route ("give the LINKED actor the points")**: `routeTo` = a Targets slot
  that resolves (unset slot = silent total loss, link can't rescue it); add
  `routeLink` = an `EntityLinkSchema` to redirect via the link map; a failed
  hunt falls back to the routeTo entity, which still receives.
- **Stat-capped counters**: prefer schemas with `maxStat` (39 exist) when "max
  is a stat" semantics are wanted; remember the receiving entity must actually
  HAVE the bounding stat in its buffer (StatAuthoring.StatDefaults) or the
  static range governs.
- **Receiver checklist**: `StatAuthoring` with `AddIntrinsics=True` (defaults
  fine — auto-add heals), bound through `TargetsAuthoring`; the host director
  needs `TimelineReferenceAuthoring`; schema must be in
  `EssenceSettings.intrinsicSchemas` (all current ones are).

## Edge cases & traps (each proven live or source-quoted, 2026-06)

- **DON'T trust a clean console for a null `intrinsic` — silent bake, key 0**
  — a real forced bake of a null-schema temp clip added ZERO error lines to a
  17,245-byte Worker2 log growth (same log retains lessons 08–10's loud
  EntityLinks errors for contrast); the clip bakes key 0 and GatherJob
  discards it per-frame.
- **DO know WHERE the loud error lives — runtime, config-key only** — "Key N
  not found in the intrinsic config" fires when the clip's key baked fine but
  the schema is absent from `EssenceSettings.intrinsicSchemas` (removed/never
  added, or stale settings bake); deleting the schema ASSET outright nulls the
  clip reference → key 0 → the SILENT skip — **deletion downgrades the
  failure from loud to silent**. Unreachable with current content (all 78
  registered); missing `EssenceConfig` entirely → the system never updates.
- **DO lean on the self-heal / DON'T expect it from stats** — intrinsic key
  missing from the entity's buffer → `GetOrAddRefUnsafe` creates it at the
  schema default; stat key missing (lesson 04) → `GetValueFloat` returns
  silent 0, frozen timeline, no log. The counter API assumes "not seen yet =
  default"; the stat API assumes "not authored = 0".
- **DON'T reorder grant/consume clips casually — the floor absorbs, no debt**
  — BaseTime (default 0, min 0): A(+5) then B(−2) → 5 then 3; B alone →
  clamp(0−2)=0, effective delta **0**, no event, nothing observable; A after
  would give 5, not 3. Subtraction against the floor is ABSORBED, not
  deferred — clip ORDER (time) changes the final counter.
- **DO treat every write as permanent AND re-firing** — no
  deactivation-edge job, no revert path exists in the system source (evidence
  of absence); every off→on transition re-Adds: loops and editor scrubs keep
  incrementing a permanent counter. Only undo: a compensating clip (subject to
  the clamp).
- **DON'T fear amount=0 (Event asserts; Intrinsic doesn't) — but it still
  creates the entry** — GatherJob never filters `Amount == 0`; `Add(key, 0)`
  early-returns with effective delta 0, no event, no assert — yet the auto-add
  side effect still happens: a missing entry IS created at its default. Same
  for same-frame coalescing to zero (+3 and −3) — a quiet no-op where the
  Event track would assert in dev builds.
- **DON'T plan around the intrinsic→event bridge in vex-ee today — dormant**
  — the schema's `Event` key comes from a `ConditionEventObject` **sub-asset
  nested inside the intrinsic schema asset**; ZERO of the 78 schemas carry
  one, so `Event` bakes as 0 everywhere — the code path is real, the content
  doesn't use it yet.
- **DO know the forced-bake tooling traps** — `SubSceneImporter` is internal:
  get it via `Type.GetType("Unity.Scenes.Editor.SubSceneImporter,
  Unity.Scenes.Editor")` and `ProduceArtifact` BOTH
  `Assets/SceneDependencyCache/*.sceneWithBuildSettings` entries
  (cached-artifact trap). And in exec scripts, `IPlayableAsset` lives in
  `UnityEngine.Playables`, not `UnityEngine.Timeline` — qualify it.

## Verification protocol

1. **Fresh-load asset dump**: `AssetDatabase.LoadAssetAtPath` the .playable in
   a NEW exec block; expect 4 clips: `A_Add5 1-1.5 amount=5`,
   `B_Subtract2 3-3.5 amount=-2`, `C_Add3 5-5.5 amount=3`,
   `D_Add4 5-5.5 amount=4`; all `routeTo=Self(4) routeLink=null
   intrinsic=BaseTime`. In-memory state after a save is not evidence.
2. **Raw YAML check**: `routeTo: 4`, `routeLink: {fileID: 0}`, `intrinsic:
   {fileID: 11400000, guid: c4e9e530a0074407a46098adb9ebcbee, type: 2}`
   (BaseTime), **`amount: -2` verbatim** on B; C and D both `m_Start: 5`
   (same-track overlap survives reload).
3. **Schema checks**: BaseTime `key: { Value: 45 }`, default 0, range
   [0,999999], no stat links; `FindAssets("t:IntrinsicSchemaObject")` → 78;
   EssenceSettings registers all 78 (re-count — inventories drift).
4. **Binding check from a RELOADED SubScene**: `IntrinsicTrack
   (TimelineEssenceIntrinsicTrack) → Stage_Actor (TargetsAuthoring)` — the
   component, not the Transform. Post-lesson-12 the director's scene-binding
   table is **10** entries (prior 9 preserved).
5. **Parent-scene restore**: end with sceneCount=1,
   `Assets/Scenes/Main Scene.unity|loaded=True|active=True|dirty=False`,
   director restored to
   `Assets/Training/01-transform-position-track/PositionMastery.playable`.
6. **Console**: `unity-cli console --filter error` shows nothing new (known
   pre-existing: UnityCliConnector HTTP start, PerformanceTesting
   setup/cleanup, TestResults.xml save, lessons 08–10 `[Worker2]` EntityLinks
   bake errors). This track is bake-silent even when misconfigured — silence
   is expected, not evidence; the only loud path is the runtime config-key
   LogError.
