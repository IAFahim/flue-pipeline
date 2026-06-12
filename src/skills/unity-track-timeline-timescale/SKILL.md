---
name: unity-track-timeline-timescale
description: Master of TimelineTimeScaleTrack + TimelineTimeScaleClip in vex-ee — stat-driven per-timeline playback speed, the StatAuthoring track binding, StatDefaults setup, and the frozen-timeline stat trap (buffer present, key missing → 0). Use when a designer asks to "slow this cutscene" or "make timeline speed follow a stat".
---

# TimelineTimeScaleTrack specialist

You are the specialist for **`TimelineTimeScaleTrack`** and its single clip type
**`TimelineTimeScaleClip`** from `Packages/BovineLabs.Timeline.Time`. Scope: exactly
this track family — authoring the track/clips in a `.playable` TimelineAsset, the
**StatAuthoring track binding** ("whose stats drive the speed"), the StatDefaults
setup that makes stat-driven clips resolve, and the per-timeline clock semantics.
This track is **PER-TIMELINE ONLY**: it scales one director's own clock and nothing
else. Global slow-mo (the world clock, every timeline) is `WorldTimeScaleTrack`'s
job — a DIFFERENT skill (topic 05); know the boundary. Stage construction belongs to
`unity-stage-foundations`; transform tracks to the position/rotation/scale skills.

All facts below were verified live in the **vex-ee** project, **2026-06** (reflection
dumps, package-source reads, YAML reads of .playable and .unity files, fresh-load
read-backs via `unity-cli exec`).

## Prerequisites & environment

- Act only through `unity-cli exec` / `unity-cli console`; never touch vex-ee via the
  filesystem; never enter play mode. Follow the **unity-cli skill's Safe Loop** on every
  mutation.
- Verify the live project first:
  `unity-cli exec "return UnityEditor.SceneManagement.EditorSceneManager.GetActiveScene().path + \"|\" + Application.dataPath;"`
  → expect `Assets/Scenes/Main Scene.unity|/home/i/GitHub/vex-ee/Assets`.
- The `TrainingStage` (built by unity-stage-foundations) must exist in SubScene
  `Assets/Scenes/Main Sub Scene.unity`: `Stage_Director` (PlayableDirector +
  TimelineReferenceAuthoring), `Stage_LinkRoot/Stage_Actor` (capsule with
  **StatAuthoring** — the binding for this track), `Stage_Target`. If missing, STOP
  and have the stage rebuilt first.
- Stage_Actor's StatAuthoring carries the permanent entry
  `StatDefaults[0] = {Stat: SlowMo, ModifyType: Added, Value: 25}` (added in
  lesson 04 as 0.25, **corrected to 25 after lesson 13**) — that is what makes
  the stat-driven clip resolve instead of freezing. **LESSON-13 CORRECTION:**
  Essence stats are ×100 fixed-point with an **int** `Added` — a flat Added
  value of 0.25 truncates to 0 at bake (`StatAuthoringUtil.GetValueRaw` does
  `(int)value`), giving `GetValueFloat = 0 × 1 / 100 = 0` — a frozen timeline
  by another road. Author **Value = 25** to mean a 0.25 factor
  (`ValueFloat = Added/100`). See `unity-track-essence-stat`.
- Your assets live only under `Assets/Training/04-timeline-timescale-track/`.
  Canonical asset: `TimeScaleMastery.playable` (track `TimeScaleTrack`, clips
  A_HalfSpeed 0–2s timeScale=0.5 stat=null / B_StatDriven 2–4s timeScale=2.0 (decoy)
  stat=SlowMo; track bound to Stage_Actor's StatAuthoring component).

## VERIFIED facts (vex-ee, 2026-06)

Types (assembly `BovineLabs.Timeline.Time.Authoring`):

- `BovineLabs.Timeline.Time.Authoring.TimelineTimeScaleTrack : DOTSTrack`
  — `[TrackBindingType(typeof(StatAuthoring))]` (!), `[TrackColor(0.20, 0.75, 0.45)]`,
  `[DisplayName("BovineLabs/Time/Timeline Time Scale")]`. NO own serialized fields
  (YAML carries only the inherited `DOTSTrack` `resetOnDeactivate`). Its Bake targets
  `context.Timer` — the timeline's own clock entity — NOT the binding.
- `BovineLabs.Timeline.Time.Authoring.TimelineTimeScaleClip : DOTSClip`
  — `ClipCaps.Blending | Looping`.

### TimelineTimeScaleClip fields
| Member | Type | Default | Meaning |
|---|---|---|---|
| `timeScale` | `float` | `0.5` | Authored multiplier for THIS timeline's clock (0.5 = half speed) |
| `stat` | `StatSchemaObject` | `null` | Optional. If resolvable on the bound entity, overrides `timeScale` EVERY FRAME |
| `duration` (override) | `double` | returns `1` | Seeds the initial TimelineClip length at `CreateClip` time; NOT fixed — `clip.duration = 2` works and serializes (`m_Duration: 2` read back fresh) |
| `clipCaps` | `ClipCaps` | `Blending \| Looping` | Up to 4 overlapping clips blend via `FloatMixer` toward neutral 1 |

Bake payload: `TimelineTimeScaleAnimated{ AuthoredData = timeScale,
StatKey = stat?.Key (null → 0), StatEntity = context.Binding != null ?
context.Binding.Target : Entity.Null }`.

### Stat-side types (Essence)
| Type | Facts |
|---|---|
| `StatSchemaObject` | ScriptableObject; `ushort key` auto-ID via `[AutoRef("EssenceSettings","statSchemas",...,"Schemas/Stats")]`; implicit conversion to `StatKey`; null → 0 |
| Existing schema inventory | vex-ee ships **114** at `Assets/Settings/Schemas/Stats/` (e.g. `SlowMo.asset`, `Speed.asset`). **REUSE these — NEVER create new schema assets** (auto-ID registry pollution) |
| `SlowMo.asset` | YAML: `m_Name: SlowMo`, `isGlobal: 0`, `key: 94` (nonzero → registered) |
| `StatModifierAuthoring` | Element of `StatAuthoring.StatDefaults`: `{ StatSchemaObject Stat; StatAuthoringType ModifyType (Added/Subtracted/Increased/Reduced/More/Less); float Value }`. Serialized path: `StatDefaults.Array.data[N].{Stat, ModifyType, Value}` |

### Runtime semantics
Each frame, `TimelineTimeScaleTrackSystem.PrepareJob` resolves the effective multiplier
per active clip entity (quoted from
`Packages/BovineLabs.Timeline.Time/BovineLabs.Timeline.Time/TimelineTimeScaleTrackSystem.cs`):

```csharp
if (animated.StatKey.Value != 0 && animated.StatEntity != Entity.Null &&
    Stats.TryGetBuffer(animated.StatEntity, out var statsBuffer))
    animated.Value = statsBuffer.AsMap().GetValueFloat(animated.StatKey);
else
    animated.Value = animated.AuthoredData;
```

`GetValueFloat` returns its `defaultValue` of **0** when the key is absent from the
buffer. `TrackBlendImpl<float, …>` mixes up to four overlapping clips with `FloatMixer`
against neutral 1; the result lands in `TimelineTimeScaleMultiplier` on the clock entity
(`ResetJob` re-arms it to 1 each frame, so the effect vanishes with no active clip).
Then `TimelineTimeScaleApplySystem` — after `ClockUpdateSystem`, before
`TimerUpdateSystem` — applies it to this ONE timeline's clock, unclamped:

```csharp
if (multiplier.Value == 1f) return;
clock.DeltaTime *= (double)multiplier.Value;
clock.Scale *= multiplier.Value;
```

`ApplyTimeScaleJob` is an `IJobEntity` over `(ref ClockData, in TimelineTimeScaleMultiplier)`
— it can only touch the `ClockData` on the SAME entity as the multiplier, i.e. this
timeline's own clock. It never writes `UnityEngine.Time.timeScale` and never touches
other timelines' clocks. `WorldTimeScaleTrack` (topic 05) instead scales the source
`ClockUpdateSystem` reads from — affecting every timeline.

## Canonical recipe 1 — give an entity a stat default (UNIVERSAL for ALL stat-driven tracks)

This is the "designer sets up the stat" step. It is the canonical SerializedObject
append pattern for EVERY stat-driven track family (Distance, Essence, EssenceUI…),
not just TimeScale. Verbatim from the lesson 04 report:

```csharp
// SubScene bracket assumed (open additive, set active ... save, close, reopen parent Single)
var stat   = actor.GetComponent<BovineLabs.Essence.Authoring.StatAuthoring>();
var schema = UnityEditor.AssetDatabase.LoadAssetAtPath<BovineLabs.Essence.Authoring.StatSchemaObject>(
                 "Assets/Settings/Schemas/Stats/SlowMo.asset");   // REUSE existing
var so = new UnityEditor.SerializedObject(stat);
so.Update();
var defaults = so.FindProperty("StatDefaults");
int i = defaults.arraySize;                       // append (use arraySize = i+1)
defaults.arraySize = i + 1;
var elem = defaults.GetArrayElementAtIndex(i);
elem.FindPropertyRelative("Stat").objectReferenceValue = schema;          // asset->scene-component ref: fine (scene side holds it)
var mod = elem.FindPropertyRelative("ModifyType");
mod.enumValueIndex = System.Array.IndexOf(mod.enumNames, "Added");        // Added/Subtracted/Increased/Reduced/More/Less
elem.FindPropertyRelative("Value").floatValue = 25f;  // x100 fixed-point: 25 means 0.25 (lesson-13 correction — 0.25 would truncate to int 0)
so.ApplyModifiedProperties();
UnityEditor.EditorUtility.SetDirty(stat);
UnityEditor.SceneManagement.EditorSceneManager.SaveScene(subScene);
```

Fresh-load read-back evidence (separate exec block, SubScene reopened from disk):

```
VERIFY|StatDefaults.arraySize=1
VERIFY|StatDefaults.Array.data[0].Stat=SlowMo (Assets/Settings/Schemas/Stats/SlowMo.asset)
VERIFY|StatDefaults.Array.data[0].ModifyType=Added
VERIFY|StatDefaults.Array.data[0].Value=0.250
```

**LESSON-13 CORRECTION to this evidence:** the original `Value=0.250` shown
above was discovered to be a silent no-op — Essence `Added` modifiers are
**int** in a ×100 fixed-point world, so 0.25 truncates to 0 at bake and
`GetValueFloat` reads 0 (frozen timeline by another road, even with key 94
present). The stage entry has been corrected to **Value=25** (= a 0.25 factor;
`ValueFloat = Added/100`). Expect `Value=25` on read-back today.

This entry is PERMANENT stage state on `Stage_Actor` (recorded in the
unity-stage-foundations skill).

## Canonical recipe 2 — stat-driven timescale timeline (verbatim from report)

Build the asset (clip-asset → schema-asset references serialize fine, no SubScene needed
for this part):

```csharp
var timeline = UnityEngine.ScriptableObject.CreateInstance<UnityEngine.Timeline.TimelineAsset>();
UnityEditor.AssetDatabase.CreateAsset(timeline, path);
var track = timeline.CreateTrack<BovineLabs.Timeline.Time.Authoring.TimelineTimeScaleTrack>(null, "TimeScaleTrack");

var clipA = track.CreateClip<BovineLabs.Timeline.Time.Authoring.TimelineTimeScaleClip>();
// fresh clip arrives with duration=1 (the clip's `duration => 1` override seeds it) — not fixed
clipA.displayName = "A_HalfSpeed"; clipA.start = 0; clipA.duration = 2;
var a = (BovineLabs.Timeline.Time.Authoring.TimelineTimeScaleClip)clipA.asset;
a.timeScale = 0.5f; a.stat = null;                      // authored mode
var clipB = track.CreateClip<BovineLabs.Timeline.Time.Authoring.TimelineTimeScaleClip>();
clipB.displayName = "B_StatDriven"; clipB.start = 2; clipB.duration = 2;
var b = (BovineLabs.Timeline.Time.Authoring.TimelineTimeScaleClip)clipB.asset;
b.timeScale = 2.0f;                                     // decoy — proves the stat override wins
b.stat = schema;                                        // clip(asset) -> schema(asset): serializes fine
UnityEditor.AssetDatabase.SaveAssets();
```

Wire (SubScene bracket — the binding lives in the DIRECTOR's scene-side table; bind the
**StatAuthoring component**, not the Transform):

```csharp
pd.playableAsset = timeline;
pd.SetGenericBinding(tsTrack, actor.GetComponent<BovineLabs.Essence.Authoring.StatAuthoring>());
UnityEditor.EditorUtility.SetDirty(pd);
UnityEditor.SceneManagement.EditorSceneManager.SaveScene(subScene);
```

Fresh-load verification evidence:

```
TRACK|TimeScaleTrack|BovineLabs.Timeline.Time.Authoring.TimelineTimeScaleTrack
CLIP|A_HalfSpeed|start=0|duration=2|timeScale=0.5|stat=null
CLIP|B_StatDriven|start=2|duration=2|timeScale=2|stat=SlowMo(key=94)
VERIFY|playableAsset=Assets/Training/04-timeline-timescale-track/TimeScaleMastery.playable
BINDING|3|key=TimeScaleTrack(TimelineTimeScaleTrack)|value=Stage_Actor(BovineLabs.Essence.Authoring.StatAuthoring)
```

## Edge cases & traps (each proven live, 2026-06)

- **DON'T conflate the two frozen-timeline failure modes** — fallback to `AuthoredData`
  happens ONLY when a PrepareJob guard fails: `StatKey == 0` (stat null), `StatEntity ==
  Entity.Null` (no binding), or the entity has NO `Stat` buffer at all (`TryGetBuffer`
  false). **Buffer present but key absent** passes the guard → `GetValueFloat` returns
  0 → `clock.DeltaTime *= 0` → **frozen timeline**, silent and strictly worse than the
  graceful fallback. The StatDefaults entry (recipe 1) is what puts key 94 in the baked
  buffer and avoids the trap — but key presence alone isn't enough (lesson 13): a
  fractional `Added` default truncates to int 0 at bake, so `GetValueFloat` still
  returns 0 — the same freeze by another road. The entry must be a whole number in
  ×100 fixed-point (25 = a 0.25 factor).
- **DO use `stat = null` for pure authored mode** — serializes as `stat: {fileID: 0}`,
  bakes `StatKey 0`, first guard fails → `AuthoredData` every frame (clip A YAML:
  `timeScale: 0.5` / `stat: {fileID: 0}`).
- **DON'T expect clamping** — `timeScale = -1` saved and read back verbatim
  (`CLIP|C_TempNegative|timeScale=-1`); no clamp anywhere in the chain: negative negates
  `DeltaTime` so the timeline's clock RUNS IN REVERSE, 0 freezes it. Defined behavior,
  zero guard rails for designers.
- **DON'T fear an empty binding breaks the track** — the track's own Bake targets
  `context.Timer`, not the binding; `StatEntity = Entity.Null` only fails the second
  guard → clips run permanently in `AuthoredData` mode, the stat override is silently
  disabled, and the Timeline editor raises no error.
- **DON'T expect `SetGenericBinding` to coerce** — it stores EXACTLY what you pass
  (`BIND_GO|...=UnityEngine.GameObject 'Stage_Actor'` vs
  `BIND_COMP|...=StatAuthoring 'Stage_Actor'`). At bake time both forms reach the same
  entity (`ConversionContextExtensions.GetBinding` switches on GameObject/Component);
  `[TrackBindingType(typeof(StatAuthoring))]` only governs the editor drag-slot. Bind
  the component for clarity.
- **DON'T treat the `duration => 1` override as a fixed length** — it only seeds the
  initial TimelineClip length at `CreateClip`; `clip.duration = 2` persisted
  (`m_Duration: 2` after fresh load).
- **NEVER create new StatSchemaObject assets** — keys are auto-ID registry entries
  (`[AutoRef]` → EssenceSettings.statSchemas); polluting the registry is permanent.
  Reuse the 114 existing schemas under `Assets/Settings/Schemas/Stats/`.
- **DO trust director binding tables across playableAsset swaps** — keyed by track
  asset; all FOUR mastery bindings (Position/Scale/Rotation/TimeScale → Stage_Actor)
  survived swapping the director back to PositionMastery.

## Verification protocol

1. **Fresh-load asset dump**: in a new exec block, `AssetDatabase.LoadAssetAtPath` the
   .playable and dump every track/clip (name, start/duration, `timeScale`, `stat` and
   its `key`, caps). In-memory state after a save is not evidence.
2. **Raw YAML check**: authored-mode clips must show `stat: {fileID: 0}`; stat-driven
   clips a guid asset reference; confirm `m_Duration` values and the inherited
   `resetOnDeactivate` on the track.
3. **Survival proof from a RELOADED SubScene**: binding table must show
   `TimeScaleTrack(TimelineTimeScaleTrack) -> Stage_Actor(StatAuthoring)`, and
   Stage_Actor must show `StatDefaults[0]=SlowMo/Added/25` (×100 fixed-point — means
   0.25; corrected after lesson 13 from the original 0.25, which truncated to int 0
   and froze the timeline anyway).
4. **Parent-scene restore**: end with `sceneCount=1`,
   `scene[0]=Assets/Scenes/Main Scene.unity|loaded=True|active=True|dirty=False`.
5. **Console**: `unity-cli console --filter error` must show nothing new; known
   pre-existing vex-ee background entries are UnityCliConnector HTTP server start,
   PerformanceTesting IPrebuildSetup/IPostBuildCleanup, TestResults.xml save.
