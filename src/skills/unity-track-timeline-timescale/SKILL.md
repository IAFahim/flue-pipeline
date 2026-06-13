---
name: unity-track-timeline-timescale
description: Master of TimelineTimeScaleTrack + TimelineTimeScaleClip (package BovineLabs.Timeline.Time) — stat-driven per-timeline playback speed, the StatAuthoring track binding, StatDefaults setup, and the frozen-timeline stat trap (buffer present, key missing → 0). Portable to any project containing the package; worked example from vex-ee.
---

# TimelineTimeScaleTrack specialist

## 1. SCOPE

You are the specialist for **`TimelineTimeScaleTrack`** and its single clip type
**`TimelineTimeScaleClip`** from the package `BovineLabs.Timeline.Time`. Scope: exactly this track
family — authoring the track/clips in a `.playable` TimelineAsset, the **StatAuthoring track
binding** ("whose stats drive the speed"), the StatDefaults setup that makes stat-driven clips
resolve, and the per-timeline clock semantics. This track is **PER-TIMELINE ONLY**: it scales one
director's own clock and nothing else. Global slow-mo (the world clock, every timeline) is
`WorldTimeScaleTrack`'s job — the `unity-track-world-timescale` skill; know the boundary. Stage
construction belongs to `unity-stage-foundations`; transform tracks to the position/rotation/scale
skills. The stat side cross-references `unity-track-essence-stat` (the ×100 fixed-point model).

Operate per `unity-timeline-track-authoring`; behave per `unity-agent-protocol`; use the editor
per `unity-cli`. Discovery is its §1 (add the StatAuthoring bind-target + stat-schema lookups
below); the SubScene bracket its §2; the undo appendix its §3; verification its §4.

## 2. PORTABLE SEMANTICS

True in ANY project containing `BovineLabs.Timeline.Time` (+ BovineLabs Essence for the stat side).
Provenance tags say where a fact was PROVEN, not where it applies. (All verified vex-ee 2026-06 via
reflection dumps, package-source reads, YAML reads, fresh-load read-backs through `unity-cli exec`.)

Types (assembly `BovineLabs.Timeline.Time.Authoring`):

- `BovineLabs.Timeline.Time.Authoring.TimelineTimeScaleTrack : DOTSTrack`
  — `[TrackBindingType(typeof(StatAuthoring))]` (!), `[TrackColor(0.20, 0.75, 0.45)]`,
  `[DisplayName("BovineLabs/Time/Timeline Time Scale")]`. NO own serialized fields
  (YAML carries only the inherited `DOTSTrack` `resetOnDeactivate`). Its Bake targets
  `context.Timer` — the timeline's own clock entity — NOT the binding.
- `BovineLabs.Timeline.Time.Authoring.TimelineTimeScaleClip : DOTSClip`
  — `[TrackClipType]` of the track; `ClipCaps.Blending | Looping`.

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
| `StatSchemaObject` | ScriptableObject; `ushort key` auto-ID via `[AutoRef("EssenceSettings","statSchemas",...,"Schemas/Stats")]`; implicit conversion to `StatKey`; null → 0. A schema is registered iff its `key` is nonzero |
| `StatModifierAuthoring` | Element of `StatAuthoring.StatDefaults`: `{ StatSchemaObject Stat; StatAuthoringType ModifyType (Added/Subtracted/Increased/Reduced/More/Less); float Value }`. Serialized path: `StatDefaults.Array.data[N].{Stat, ModifyType, Value}` |
| ×100 fixed-point | Essence stats use ×100 fixed-point with an **int** `Added` — `StatAuthoringUtil.GetValueRaw` does `(int)value`, so a fractional flat `Added` (e.g. 0.25) truncates to 0 at bake and `GetValueFloat = 0`. Author **whole numbers**: Value=25 means a 0.25 factor (`ValueFloat = Added/100`). See `unity-track-essence-stat` |

### Runtime semantics
Each frame, `TimelineTimeScaleTrackSystem.PrepareJob` resolves the effective multiplier per active
clip entity (quoted from `BovineLabs.Timeline.Time/TimelineTimeScaleTrackSystem.cs`):

```csharp
if (animated.StatKey.Value != 0 && animated.StatEntity != Entity.Null &&
    Stats.TryGetBuffer(animated.StatEntity, out var statsBuffer))
    animated.Value = statsBuffer.AsMap().GetValueFloat(animated.StatKey);
else
    animated.Value = animated.AuthoredData;
```

`GetValueFloat` returns its `defaultValue` of **0** when the key is absent from the buffer.
`TrackBlendImpl<float, …>` mixes up to four overlapping clips with `FloatMixer` against neutral 1;
the result lands in `TimelineTimeScaleMultiplier` on the clock entity (`ResetJob` re-arms it to 1
each frame, so the effect vanishes with no active clip). Then `TimelineTimeScaleApplySystem` — after
`ClockUpdateSystem`, before `TimerUpdateSystem` — applies it to this ONE timeline's clock, unclamped:

```csharp
if (multiplier.Value == 1f) return;
clock.DeltaTime *= (double)multiplier.Value;
clock.Scale *= multiplier.Value;
```

`ApplyTimeScaleJob` is an `IJobEntity` over `(ref ClockData, in TimelineTimeScaleMultiplier)` — it
can only touch the `ClockData` on the SAME entity as the multiplier, i.e. this timeline's own clock.
It never writes `UnityEngine.Time.timeScale` and never touches other timelines' clocks.
`WorldTimeScaleTrack` instead scales the source `ClockUpdateSystem` reads from — every timeline.

### Silence profile
DOTS-track-typical: no Timeline-editor error for any misconfiguration below. An empty/unresolvable
binding does NOT error (the track bakes against `context.Timer`, not the binding); a missing stat
key does NOT error — it silently freezes the timeline (`×0`). Silence is expected, never proof.

### Traps & DO/DON'T (each proven live, vex-ee 2026-06)
- **DON'T conflate the two frozen-timeline failure modes** — fallback to `AuthoredData` happens ONLY
  when a PrepareJob guard fails: `StatKey == 0` (stat null), `StatEntity == Entity.Null` (no
  binding), or the entity has NO `Stat` buffer at all (`TryGetBuffer` false). **Buffer present but
  key absent** passes the guard → `GetValueFloat` returns 0 → `clock.DeltaTime *= 0` → **frozen
  timeline**, silent and strictly worse than the graceful fallback. The StatDefaults entry (recipe
  below) is what puts the key in the baked buffer — but key presence alone isn't enough: a fractional
  `Added` default truncates to int 0 at bake, the same freeze by another road (×100 fixed-point fact
  above; discovered in vex-ee lesson 13, see §5).
- **DO use `stat = null` for pure authored mode** — serializes as `stat: {fileID: 0}`, bakes
  `StatKey 0`, first guard fails → `AuthoredData` every frame.
- **DON'T expect clamping** — `timeScale = -1` saved and read back verbatim; no clamp anywhere in
  the chain: negative negates `DeltaTime` so the timeline's clock RUNS IN REVERSE, 0 freezes it.
  Defined behavior, zero guard rails for designers.
- **DON'T fear an empty binding breaks the track** — the track's own Bake targets `context.Timer`,
  not the binding; `StatEntity = Entity.Null` only fails the second guard → clips run permanently in
  `AuthoredData` mode, the stat override silently disabled, no Timeline-editor error.
- **DON'T expect `SetGenericBinding` to coerce** — it stores EXACTLY what you pass (a GameObject
  stays a GameObject, a component stays a component). At bake time both forms reach the same entity
  (`ConversionContextExtensions.GetBinding` switches on GameObject/Component);
  `[TrackBindingType(typeof(StatAuthoring))]` only governs the editor drag-slot. Bind the component
  for clarity. (This is unity-cli 5k; the bind target here is the **StatAuthoring component**, not a
  Transform — the one place this family diverges from transform-track bind targets.)
- **DON'T treat the `duration => 1` override as a fixed length** — it only seeds the initial
  TimelineClip length at `CreateClip`; `clip.duration = 2` persisted.
- **NEVER create new StatSchemaObject assets** — keys are auto-ID registry entries (`[AutoRef]` →
  EssenceSettings.statSchemas); polluting the registry is permanent. Reuse the project's existing
  schemas (discover them, below). Out of domain — report a missing schema, never author one.

## 3. DISCOVERY DELTA

Run the unity-timeline-track-authoring §1 preamble (D1–D5) with these type names:
`TimelineTimeScaleTrack` / `TimelineTimeScaleClip` / assembly `BovineLabs.Timeline.Time.Authoring`.
Two track-specific additions to its D4/D5:

- **Bind target = a StatAuthoring component** (not a Transform):
  `FindObjectsByType<BovineLabs.Essence.Authoring.StatAuthoring>(Include, None)` filtered to the
  SubScene. No StatAuthoring anywhere → the stat override is impossible (authored-only mode still
  works; report the gap — a stage/essence specialist adds authoring components, not you). Find the
  schema by TYPE never path: `AssetDatabase.FindAssets("t:StatSchemaObject")`; pick the designer's
  named stat, confirm `key != 0` (registered) by reading the asset.
- **Capture the StatDefaults array as extra PRE| state** (beyond §1's playableAsset + binding lines):
  `PRE|statDefaults|size=<N>` and one `PRE|statDefaults|<i>|Stat=<schema name + path>|ModifyType=<enum>|Value=<float>`
  per existing element (SerializedObject dump of the chosen StatAuthoring's `StatDefaults`). The undo
  restores THIS array, never an empty one — other entries may pre-exist and other stat-driven track
  families may depend on them.

## 4. CLIP PATTERNS (the bracket's track-specific middle)

Slot these into the unity-timeline-track-authoring §2 bracket (one logical change per exec block;
print `PRE|` before mutating; verify per §4 in a SEPARATE block). Timings/values are example
choices, not package constants.

**4.1 "the stat must be there first" — give the bound entity a stat default** (UNIVERSAL for ALL
stat-driven track families — Distance, Essence, EssenceUI…). The canonical SerializedObject append
on the **bind target's StatAuthoring** (scene state, separate from the asset). Capture the full
`PRE|statDefaults|` dump first; PRINT the append index (undo removes exactly it):

```csharp
var schema = UnityEditor.AssetDatabase.LoadAssetAtPath<BovineLabs.Essence.Authoring.StatSchemaObject>("<DISCOVERED registered schema>");
var stat = /* bind target, Name-resolution rule */.GetComponent<BovineLabs.Essence.Authoring.StatAuthoring>();
var so = new UnityEditor.SerializedObject(stat); so.Update();
var defaults = so.FindProperty("StatDefaults");
int i = defaults.arraySize; defaults.arraySize = i + 1;   // PRINT i
var elem = defaults.GetArrayElementAtIndex(i);
elem.FindPropertyRelative("Stat").objectReferenceValue = schema;       // asset->scene-component ref: fine
var mod = elem.FindPropertyRelative("ModifyType");
mod.enumValueIndex = System.Array.IndexOf(mod.enumNames, "Added");     // Added/Subtracted/Increased/Reduced/More/Less
elem.FindPropertyRelative("Value").floatValue = 25f;                   // ×100 fixed-point: 25 = 0.25 factor; 0.25 truncates to int 0 = freeze
so.ApplyModifiedProperties(); UnityEditor.EditorUtility.SetDirty(stat);
```

**4.2 "slow this cutscene to half speed" — pure authored mode.** One clip, `stat = null`:

```csharp
var clip = (BovineLabs.Timeline.Time.Authoring.TimelineTimeScaleClip)
    track.CreateClip<BovineLabs.Timeline.Time.Authoring.TimelineTimeScaleClip>().asset;
clip.timeScale = 0.5f; clip.stat = null;   // first guard fails → AuthoredData every frame; YAML stat: {fileID: 0}
```

**4.3 "make timeline speed follow a stat" — stat-driven override.** Set `stat` to the discovered
schema; `timeScale` becomes a decoy fallback used only when the stat is unresolvable. Bind the
**StatAuthoring component** (4.1 must have seeded the key, or the timeline freezes):

```csharp
b.timeScale = 2.0f;                            // decoy — the stat override wins when resolvable
b.stat = schema;                               // clip(asset) -> schema(asset): serializes fine
// in the §2 bracket's wiring:
director.SetGenericBinding(track, bindTarget.GetComponent<BovineLabs.Essence.Authoring.StatAuthoring>());
```

**4.4 "reverse / freeze it" — out-of-band timeScale.** `timeScale = -1` runs the clock in reverse;
`0` freezes it. No clamp; both serialize verbatim. Same wiring as 4.2.

## 5. WORKED EXAMPLE DELTA (vs the unity-timeline-track-authoring §5 stage)

Same vex-ee stage (rediscover, never assume). This track's specifics on top of §5:
- Bind target is `Stage_LinkRoot/Stage_Actor`'s **StatAuthoring** (not its Transform). Schema used:
  `Assets/Settings/Schemas/Stats/SlowMo.asset` (`key: 94`, nonzero → registered) out of 114 schemas.
- Permanent stage state: Stage_Actor's StatAuthoring carries
  `StatDefaults[0] = {Stat: SlowMo, ModifyType: Added, Value: 25}` — added in lesson 04 as 0.25 and
  **corrected to 25 after lesson 13** (the original 0.25 truncated to int 0 at bake and froze the
  timeline anyway — the ×100 trap, §2). A journal recorded at training time no longer matches; per
  protocol §7 re-derive against current state before replaying a stale journal, and say so.
- Asset: `Assets/Training/04-timeline-timescale-track/TimeScaleMastery.playable`, track
  `TimeScaleTrack`. Fresh-load evidence:
  ```
  CLIP|A_HalfSpeed|start=0|duration=2|timeScale=0.5|stat=null
  CLIP|B_StatDriven|start=2|duration=2|timeScale=2|stat=SlowMo(key=94)
  BINDING|3|key=TimeScaleTrack(TimelineTimeScaleTrack)|value=Stage_Actor(StatAuthoring)
  ```
  Binding-coercion evidence: `BIND_GO|...=GameObject 'Stage_Actor'` vs `BIND_COMP|...=StatAuthoring
  'Stage_Actor'` — stored verbatim, both bake to the same entity. Director restored to
  PositionMastery; all 4 bindings survived the swap-back.

## 6. UNDO DELTA

Follow the unity-timeline-track-authoring §3 appendix (UNDO-1 director+binding, UNDO-2 asset+folder,
UNDO-4 fresh-load verify). This track adds ONE artifact and one ordering note:

- **Extra artifact (the §3 "track-specific extra" slot): the appended StatDefaults element** on the
  bound StatAuthoring — scene state on the BIND TARGET, independent of the asset. Restore the
  **CAPTURED array** (remove exactly the appended index), **never zero or rebuild it**: other
  entries may pre-exist and other stat-driven track families may depend on them. ORDER: it sits LAST
  (after director restore + asset delete); it is order-independent of the asset.

```csharp
// UNDO-3 (the track-specific extra): remove the appended StatDefaults element — SubScene bracket
var appendedIndex = 0; // <CAPTURED> — the index printed by recipe 4.1
var stat = /* bind target by CAPTURED hierarchy path */.GetComponent<BovineLabs.Essence.Authoring.StatAuthoring>();
var so = new UnityEditor.SerializedObject(stat); so.Update();
var defaults = so.FindProperty("StatDefaults");
// guard: element at appendedIndex must still match what I added (schema/ModifyType/Value);
// if not, reality drifted — re-derive per protocol §7 instead of deleting blind.
defaults.DeleteArrayElementAtIndex(appendedIndex);
so.ApplyModifiedProperties(); UnityEditor.EditorUtility.SetDirty(stat);
UnityEditor.SceneManagement.EditorSceneManager.SaveScene(subScene);
// then assert the array equals the PRE|statDefaults| dump (size + every element), not merely "smaller".
```

UNDO-4 verification additionally asserts the bound StatAuthoring's StatDefaults equals the captured
`PRE|statDefaults|` dump (size + every element), beyond §4's playableAsset / binding / asset-gone
checks.

## 7. VERIFICATION DELTA

Run the unity-timeline-track-authoring §4 protocol. Track-specific expectations for its steps:
- **Asset dump (step 1):** dump per clip `timeScale`, `stat` and its `key`, caps.
- **Raw YAML (step 2):** authored-mode clips show `stat: {fileID: 0}`; stat-driven clips a guid asset
  ref; confirm `m_Duration` and the inherited `resetOnDeactivate` on the track.
- **Prerequisite re-check (step 3):** the bound StatAuthoring's StatDefaults must contain recipe
  4.1's entry as a WHOLE number in ×100 fixed-point (e.g. 25 for a 0.25 factor; a fractional value is
  the silent freeze trap, §2).
- **Binding (step 4):** `<trackName>(TimelineTimeScaleTrack) -> <bindTarget>(StatAuthoring)`.
