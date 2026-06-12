---
name: unity-track-timeline-timescale
description: Master of TimelineTimeScaleTrack + TimelineTimeScaleClip (package BovineLabs.Timeline.Time) — stat-driven per-timeline playback speed, the StatAuthoring track binding, StatDefaults setup, and the frozen-timeline stat trap (buffer present, key missing → 0). Portable to any project containing the package; worked example from vex-ee. Use when a designer asks to "slow this cutscene" or "make timeline speed follow a stat".
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
skills. Behave per unity-agent-protocol; operate the editor per unity-cli.

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

### Traps & DO/DON'T (each proven live, vex-ee 2026-06)
- **DON'T conflate the two frozen-timeline failure modes** — fallback to `AuthoredData` happens ONLY
  when a PrepareJob guard fails: `StatKey == 0` (stat null), `StatEntity == Entity.Null` (no
  binding), or the entity has NO `Stat` buffer at all (`TryGetBuffer` false). **Buffer present but
  key absent** passes the guard → `GetValueFloat` returns 0 → `clock.DeltaTime *= 0` → **frozen
  timeline**, silent and strictly worse than the graceful fallback. The StatDefaults entry (recipe
  4.1) is what puts the key in the baked buffer — but key presence alone isn't enough: a fractional
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
  for clarity.
- **DON'T treat the `duration => 1` override as a fixed length** — it only seeds the initial
  TimelineClip length at `CreateClip`; `clip.duration = 2` persisted.
- **NEVER create new StatSchemaObject assets** — keys are auto-ID registry entries (`[AutoRef]` →
  EssenceSettings.statSchemas); polluting the registry is permanent. Reuse the project's existing
  schemas (discover them, §3.4).
- **DO trust director binding tables across playableAsset swaps** — entries are keyed by track
  asset; in vex-ee all four mastery bindings survived the swap-back to the prior asset.

## 3. DISCOVERY RECIPES

Act only through `unity-cli exec` / `unity-cli console`; never the filesystem; never
play mode. Follow the unity-cli Safe Loop on every mutation. Names below are
parameters — discover them in THIS project; never assume the worked example (§5).

**3.1 Confirm the package exists (else report a missing prerequisite — protocol §6):**
```csharp
var t = System.Type.GetType("BovineLabs.Timeline.Time.Authoring.TimelineTimeScaleTrack, BovineLabs.Timeline.Time.Authoring");
return t == null ? "MISSING_PREREQUISITE|TimelineTimeScaleTrack not found - package BovineLabs.Timeline.Time absent here"
                 : "OK|" + t.AssemblyQualifiedName + "|dataPath=" + UnityEngine.Application.dataPath;
```

**3.2 Find the active scene + SubScene(s):** the unity-cli First Command → `parentScenePath`, `subScenePath`(s).

**3.3 Find PlayableDirector(s) inside the SubScene** (read-only additive open, restore parent
after): `FindObjectsByType<PlayableDirector>(Include, None)`; print per director its hierarchy path,
`playableAsset`, other components. Selection rule when several exist (STATE it in your memory card):
prefer the single director in the chosen SubScene; if several, prefer one carrying the project's
timeline-reference authoring component. Zero → missing prerequisite, protocol §6.

**3.4 Find the bind target and the stat schema** — the binding is a **StatAuthoring component** on a
SubScene-baked object: `FindObjectsByType<BovineLabs.Essence.Authoring.StatAuthoring>(Include, None)`
filtered to the SubScene; no StatAuthoring anywhere → the stat override is impossible (authored-only
mode still works; report the gap — a stage/essence specialist adds authoring components, not you).
Find schemas by TYPE, never by path: `AssetDatabase.FindAssets("t:StatSchemaObject")`; pick the
designer's named stat, confirm its `key != 0` (registered) by reading the asset. NEVER create one.

**3.5 Capture pre-state — this is pre-state (`PRE|`)**:
```csharp
// PRE|playableAsset=<asset PATH or null>   via AssetDatabase.GetAssetPath(director.playableAsset)
// PRE|binding|<i>|<track name>|<track type>|<bound object hierarchy path + component type, or null>
//   one line per GetOutputTracks() of the CURRENT asset, via director.GetGenericBinding(track).
//   Capture the asset PATH and each track's NAME/index even when the table looks empty —
//   they make the undo journal replayable (UNDO-1 reloads the old asset by path and
//   re-binds by matching track name/index).
// PRE|statDefaults|size=<N> and one line per EXISTING element:
//   PRE|statDefaults|<i>|Stat=<schema name + asset path>|ModifyType=<enum>|Value=<float>
//   — full dump of the chosen StatAuthoring's StatDefaults array (SerializedObject). The undo
//   restores THIS array, never an empty one: other entries may pre-exist and other stat-driven
//   track families may depend on them.
// Record ALL of these in the undo journal (§6) before any mutation.
```

**Name resolution rule**: `GameObject.Find` misses inactive objects and is ambiguous on duplicate
names. Discovery (§3.3/3.4) must confirm the chosen name is active and unique in the SubScene; else
resolve by walking SubScene roots to the recorded hierarchy path (or `FindObjectsByType` filtered by
`scene`) instead of `Find`.

## 4. CANONICAL RECIPES
One logical change per exec block; each block prints its `PRE|` capture before mutating (protocol
§2), saves inside the block, and is verified from a fresh load (§7).

**4.1 Give an entity a stat default (UNIVERSAL for ALL stat-driven track families — Distance,
Essence, EssenceUI…).** The "designer sets up the stat" step; the canonical SerializedObject append
pattern. SubScene bracket assumed:

```csharp
var schemaPath  = "<DISCOVERED>";   // §3.4 — an EXISTING registered schema
var statValue   = 25f;              // <CHOSEN> — ×100 fixed-point: 25 means a 0.25 factor
                                    // (a fractional value like 0.25 truncates to int 0 at bake = freeze)
// CAPTURE (print + journal) BEFORE mutating: the full PRE|statDefaults| dump (§3.5)
var stat   = /* resolve bind target per Name resolution rule */.GetComponent<BovineLabs.Essence.Authoring.StatAuthoring>();
var schema = UnityEditor.AssetDatabase.LoadAssetAtPath<BovineLabs.Essence.Authoring.StatSchemaObject>(schemaPath);
var so = new UnityEditor.SerializedObject(stat); so.Update();
var defaults = so.FindProperty("StatDefaults");
int i = defaults.arraySize;          // append index — PRINT IT (the undo removes exactly this element)
defaults.arraySize = i + 1;
var elem = defaults.GetArrayElementAtIndex(i);
elem.FindPropertyRelative("Stat").objectReferenceValue = schema;   // asset->scene-component ref: fine (scene side holds it)
var mod = elem.FindPropertyRelative("ModifyType");
mod.enumValueIndex = System.Array.IndexOf(mod.enumNames, "Added"); // Added/Subtracted/Increased/Reduced/More/Less
elem.FindPropertyRelative("Value").floatValue = statValue;
so.ApplyModifiedProperties();
UnityEditor.EditorUtility.SetDirty(stat); UnityEditor.SceneManagement.EditorSceneManager.SaveScene(subScene);
```

**4.2 Stat-driven timescale timeline.** Build the asset (clip-asset → schema-asset references
serialize fine, no SubScene needed for this part):

```csharp
var assetFolder = "<CHOSEN>"; var assetPath = assetFolder + "/<Name>.playable";
// CAPTURE (print + journal): PRE|folderExisted=<bool> PRE|assetExisted=<bool>
var timeline = UnityEngine.ScriptableObject.CreateInstance<UnityEngine.Timeline.TimelineAsset>();
UnityEditor.AssetDatabase.CreateAsset(timeline, assetPath);
var track = timeline.CreateTrack<BovineLabs.Timeline.Time.Authoring.TimelineTimeScaleTrack>(null, "<trackName>");

var clipA = track.CreateClip<BovineLabs.Timeline.Time.Authoring.TimelineTimeScaleClip>();
// fresh clip arrives with duration=1 (the clip's `duration => 1` override seeds it) — not fixed
clipA.displayName = "<clipName>"; clipA.start = 0; clipA.duration = 2;
var a = (BovineLabs.Timeline.Time.Authoring.TimelineTimeScaleClip)clipA.asset;
a.timeScale = 0.5f; a.stat = null;                      // authored mode
var clipB = track.CreateClip<BovineLabs.Timeline.Time.Authoring.TimelineTimeScaleClip>();
clipB.displayName = "<clipName>"; clipB.start = 2; clipB.duration = 2;
var b = (BovineLabs.Timeline.Time.Authoring.TimelineTimeScaleClip)clipB.asset;
b.timeScale = 2.0f;                                     // decoy — the stat override wins when resolvable
b.stat = schema;                                        // clip(asset) -> schema(asset): serializes fine
UnityEditor.AssetDatabase.SaveAssets();
```

Wire (SubScene bracket — the binding lives in the DIRECTOR's scene-side table; bind the
**StatAuthoring component**, not the Transform). Print the §3.5 `PRE|` lines first:

```csharp
pd.playableAsset = timeline;
pd.SetGenericBinding(track, bindTarget.GetComponent<BovineLabs.Essence.Authoring.StatAuthoring>());
UnityEditor.EditorUtility.SetDirty(pd);
UnityEditor.SceneManagement.EditorSceneManager.SaveScene(subScene);
```

Timings/values above are example choices, not package constants; verify per §7 in SEPARATE blocks
before claiming success.

## 5. WORKED EXAMPLE (vex-ee training stage) — example environment; rediscover, never assume

- Project: `/home/i/GitHub/vex-ee` (`dataPath=/home/i/GitHub/vex-ee/Assets`). Parent scene
  `Assets/Scenes/Main Scene.unity`; SubScene `Assets/Scenes/Main Sub Scene.unity`.
- Stage: `Stage_Director` (PlayableDirector + TimelineReferenceAuthoring),
  `Stage_LinkRoot/Stage_Actor` (capsule with **StatAuthoring** — the binding), `Stage_Target`.
  Schema inventory: **114** StatSchemaObjects under `Assets/Settings/Schemas/Stats/`; the one used:
  `SlowMo.asset` (`m_Name: SlowMo`, `isGlobal: 0`, `key: 94` — nonzero → registered).
- Permanent stage state: Stage_Actor's StatAuthoring carries
  `StatDefaults[0] = {Stat: SlowMo, ModifyType: Added, Value: 25}` — added in lesson 04 as 0.25 and
  **corrected to 25 after lesson 13** (the original 0.25 truncated to int 0 at bake and froze the
  timeline anyway: the ×100 fixed-point trap, §2). Lesson-04 fresh-load read-back at the time:
  `StatDefaults.arraySize=1`, `data[0].Stat=SlowMo`, `ModifyType=Added`, `Value=0.250` — expect
  `Value=25` on read-back today.
- Asset built in training: `Assets/Training/04-timeline-timescale-track/TimeScaleMastery.playable`
  — track `TimeScaleTrack`; fresh-load evidence:
  ```
  CLIP|A_HalfSpeed|start=0|duration=2|timeScale=0.5|stat=null
  CLIP|B_StatDriven|start=2|duration=2|timeScale=2|stat=SlowMo(key=94)
  BINDING|3|key=TimeScaleTrack(TimelineTimeScaleTrack)|value=Stage_Actor(BovineLabs.Essence.Authoring.StatAuthoring)
  ```
  Clip A YAML: `timeScale: 0.5` / `stat: {fileID: 0}`. The binding and the StatDefaults entry were
  deliberately left as permanent stage state; the director was restored to PositionMastery and all 4
  bindings (Position/Scale/Rotation/TimeScale → Stage_Actor) survived the swap-back.
- Binding-coercion evidence: `BIND_GO|...=UnityEngine.GameObject 'Stage_Actor'` vs
  `BIND_COMP|...=StatAuthoring 'Stage_Actor'` — stored verbatim, both bake to the same entity.
- Console baseline: UnityCliConnector HTTP server start, PerformanceTesting
  IPrebuildSetup/IPostBuildCleanup, TestResults.xml save.

## 6. UNDO APPENDIX
Artifact inventory for one full run of §4 (vex-ee instance shown in §5):
1. Created asset `<assetPath>` (.playable: TimelineAsset + 1 track + clip sub-assets —
   `DeleteAsset` removes all sub-assets with the file).
2. Possibly-created folder(s) `<assetFolder>` (`EXPECTED:` the lesson-04 report never printed
   `folderExisted` — capture it yourself per recipe 4.2).
3. Mutated `director.playableAsset` (vex-ee: `EXPECTED:` the pre-wiring value was not printed as a
   `PRE|` line — the restore target was PositionMastery per the report's final state; capture yours
   per §3.5).
4. Added generic-binding entry `<trackName> → <StatAuthoring component>` (lives in the SubScene
   file; in vex-ee deliberately left as permanent stage state).
5. Appended StatDefaults element(s) on the bound StatAuthoring — scene state on the BIND TARGET,
   independent of the asset. The undo must restore the CAPTURED array (remove exactly the appended
   index/indices), **never zero or rebuild it**: other entries may pre-exist and other stat-driven
   track families may depend on them. (vex-ee: pre-append size is derivably 0 — the recipe appended
   at `arraySize` and read back `arraySize=1` — but `EXPECTED:` no `PRE|statDefaults|` dump was
   printed; capture the full array yourself per §3.5.)
6. vex-ee staleness note: the lesson-04 entry was later corrected (0.25 → 25) by lesson 13, so a
   journal recorded at training time no longer matches reality — per protocol §7, re-derive against
   current state before running a stale journal, and say so.

ORDER: restore the director FIRST (playableAsset + binding) so nothing in the scene references the
asset, THEN delete the asset, THEN restore the StatAuthoring's StatDefaults — deleting the asset
while the director still points at it would leave a dangling `{fileID: 0}`-style reference in the
scene file instead of the captured pre-state. (The StatDefaults restore is order-independent of the
asset; it sits last in the "other captured scene values" slot.)

Journal entry templates (protocol §5 — fill from YOUR captures, reverse order):

```csharp
// UNDO-1: restore director's captured playableAsset + binding table (SubScene bracket)
var director = /* resolve by CAPTURED hierarchy path */;
var myAsset = UnityEditor.AssetDatabase.LoadAssetAtPath<UnityEngine.Timeline.TimelineAsset>("<assetPath>");
foreach (var tr in myAsset.GetOutputTracks())
    director.ClearGenericBinding(tr);            // removes the StatAuthoring entry I added
// restore each CAPTURED binding (PRE|binding| lines; none if the table was empty):
// reload the PREVIOUS asset by captured path, match tracks by name/index, re-find each
// bound object by its captured hierarchy path, then SetGenericBinding.
director.playableAsset =                         // restore CAPTURED value, never "default"
    null /* or AssetDatabase.LoadAssetAtPath<UnityEngine.Playables.PlayableAsset>("<CAPTURED pre path>") */;
UnityEditor.EditorUtility.SetDirty(director);
UnityEditor.SceneManagement.EditorSceneManager.SaveScene(subScene);
```

```csharp
// UNDO-2: delete the created .playable (+ folder, only if PRE|folderExisted=false and now empty)
var ok = UnityEditor.AssetDatabase.DeleteAsset("<assetPath>");
if (!folderExisted && UnityEditor.AssetDatabase.FindAssets("", new[]{ "<assetFolder>" }).Length == 0)
    UnityEditor.AssetDatabase.DeleteAsset("<assetFolder>");
return "UNDONE|deleted=" + ok;
```

```csharp
// UNDO-3: remove the StatDefaults element I appended — restore the CAPTURED array, never zero it (SubScene bracket)
var appendedIndex = 0; // <CAPTURED> — the index printed by recipe 4.1
var stat = /* resolve bind target by CAPTURED hierarchy path */.GetComponent<BovineLabs.Essence.Authoring.StatAuthoring>();
var so = new UnityEditor.SerializedObject(stat); so.Update();
var defaults = so.FindProperty("StatDefaults");
// guard: the element at appendedIndex must still match what I added (schema/ModifyType/Value);
// if not, reality drifted — re-derive per protocol §7 instead of deleting blind.
defaults.DeleteArrayElementAtIndex(appendedIndex);
so.ApplyModifiedProperties();
UnityEditor.EditorUtility.SetDirty(stat);
UnityEditor.SceneManagement.EditorSceneManager.SaveScene(subScene);
// then assert the array equals the PRE|statDefaults| dump (size + every element), not merely "smaller".
```

UNDO-4 (verification, fresh load — protocol §7): reload the SubScene additively and
print `director.playableAsset` (must equal the CAPTURED pre value), the binding table
(must equal the captured `PRE|binding|` lines), and the StatAuthoring's StatDefaults
(must equal the `PRE|statDefaults|` dump); confirm
`AssetDatabase.LoadAssetAtPath<UnityEngine.Object>(assetPath) == null`; restore the
parent scene; `unity-cli console --filter error` clean against the project baseline.

## 7. VERIFICATION PROTOCOL

1. **Fresh-load asset dump**: in a new exec block, `AssetDatabase.LoadAssetAtPath` the
   `.playable` at `<assetPath>` and dump every track/clip (name, start/duration,
   `timeScale`, `stat` and its `key`, caps). In-memory state after a save is not evidence.
2. **Raw YAML check**: authored-mode clips must show `stat: {fileID: 0}`; stat-driven
   clips a guid asset reference; confirm `m_Duration` values and the inherited
   `resetOnDeactivate` on the track.
3. **Survival proof from a RELOADED SubScene**: binding table must show
   `<trackName>(TimelineTimeScaleTrack) -> <bindTarget>(StatAuthoring)`, and the bind
   target's StatDefaults must contain the entry recipe 4.1 added — a WHOLE number in
   ×100 fixed-point (e.g. 25 for a 0.25 factor; a fractional value is the silent
   freeze trap, §2).
4. **Parent-scene restore**: end with `sceneCount=1`,
   `scene[0]=<parentScenePath>|loaded=True|active=True|dirty=False`.
5. **Console**: `unity-cli console --filter error` must show nothing new beyond the
   project's known pre-existing background entries (vex-ee baseline listed in §5).
