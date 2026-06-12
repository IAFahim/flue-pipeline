---
name: unity-track-world-timescale
description: Master of WorldTimeScaleTrack + WorldTimeScaleClip (package BovineLabs.Timeline.Time) — global bullet-time/slow-mo via the WorldTimeScale singleton, the timeScale-0 GameTime deadlock, and world×timeline compounding. Portable to any project containing the package; worked example from vex-ee. Use when a designer asks for "bullet time", "freeze frame", or "global slow-mo".
---

# WorldTimeScaleTrack specialist

## 1. SCOPE

You are the specialist for **`WorldTimeScaleTrack`** and its single clip type **`WorldTimeScaleClip`**
from the package `BovineLabs.Timeline.Time`. Scope: exactly this track family — authoring the
track/clips in a `.playable` TimelineAsset, the **`WorldTimeScale` singleton** they drive, and the
apply chain into `UnityEngine.Time.timeScale` / `fixedDeltaTime` /
`FixedStepSimulationSystemGroup.Timestep`. This track is **GLOBAL ONLY**: clips from ALL timelines
merge into ONE singleton and scale the whole world clock. Per-timeline playback speed (one director's
own clock, stat-driven) is `TimelineTimeScaleTrack`'s job — the `unity-track-timeline-timescale`
skill; know the boundary in both directions. Stage construction belongs to `unity-stage-foundations`;
transform tracks to the position/rotation/scale skills. Behave per unity-agent-protocol; operate the
editor per unity-cli.

## 2. PORTABLE SEMANTICS

True in ANY project containing `BovineLabs.Timeline.Time`. Provenance tags say where a fact was
PROVEN, not where it applies. (All verified vex-ee 2026-06 via reflection dumps, package-source
reads, raw YAML reads of .playable/.asset/.prefab files, fresh-load read-backs through `unity-cli
exec`. No play mode: runtime effects on `UnityEngine.Time` are proven from quoted source. One honest
caveat: the runtime verdicts rest on one explicitly UNQUOTED link — the documented engine fact
`Time.deltaTime = unscaledDeltaTime * Time.timeScale` (so `deltaTime == 0` when `timeScale == 0`).
Every other link in every chain was quoted from source.)

Types (assembly `BovineLabs.Timeline.Time.Authoring`):

- `BovineLabs.Timeline.Time.Authoring.WorldTimeScaleTrack : DOTSTrack` — an **empty class by
  design**: `[TrackClipType(typeof(WorldTimeScaleClip))]`, `[TrackColor(0.92, 0.92, 0.92)]`,
  `[DisplayName("BovineLabs/Time/World Time Scale")]`. NO `TrackBindingType`, NO `Bake` override, no
  fields beyond the inherited `DOTSTrack` `resetOnDeactivate`. There is nothing to bind — contrast
  `TimelineTimeScaleTrack`, which carries `[TrackBindingType(typeof(StatAuthoring))]` because its
  clips can read stats.
- `BovineLabs.Timeline.Time.Authoring.WorldTimeScaleClip : DOTSClip` — `ClipCaps.Blending | Looping`.

### WorldTimeScaleClip fields
| Member | Type | Default | Meaning |
|---|---|---|---|
| `timeScale` | `float` | `0.1` | Global multiplier. Tooltip: "Global time scale for the entire world. 0 = Freeze Frame, 0.1 = Slow Mo, 1 = Normal, >1 = Fast Forward." |
| `timeScale` attrs | `[Range(0f, 10f)]` | — | **Editor-slider only** — no runtime/serialization clamp (50 round-trips, proven) |
| `duration` (override) | `double` | returns `1` | Seeds initial TimelineClip length at `CreateClip` only; freely settable after |
| `clipCaps` | `ClipCaps` | `Blending \| Looping` | Read back live: `Looping, Blending` |

Bake payload (clip `Bake`, quoted): `WorldTimeScaleAnimated{ AuthoredData = timeScale,
Value = timeScale }` onto the CLIP entity. Unlike `TimelineTimeScaleAnimated` there is
**no `StatKey`/`StatEntity`** — no stat override exists for world scale.

### WorldTimeScale singleton + settings
| Type | Facts |
|---|---|
| `WorldTimeScale` (asm `BovineLabs.Timeline.Time.Data`) | Fields: `DefaultScale`, `ActiveScale` (float), `IsActive`, `ScaleFixedDeltaTime` (bool), `DefaultFixedDeltaTime` (float) |
| `WorldTimeScaleSettings : SettingsBase` | `[SettingsGroup("Timeline")]`; fields `defaultTimeScale=1`, `scaleFixedDeltaTime=true`, `defaultFixedDeltaTime=0.02f` (C# initializers); `Bake(Baker<SettingsAuthoring>)` adds the singleton `{1, 1, false, true, 0.02}` |
| Provenance mechanism | The singleton exists ONLY if a `WorldTimeScaleSettings` asset is listed in a `SettingsAuthoring` component baked into the world (in vex-ee: a Required prefab in the SubScene, §5). **No settings asset in a SettingsAuthoring → no singleton → `WorldTimeScaleApplySystem` has `RequireForUpdate<WorldTimeScale>()` → every world-timescale clip in the project is silently inert.** READ ONLY — never create or modify settings assets |
| Settings YAML caveat | The asset may serialize ONLY `defaultTimeScale`; `scaleFixedDeltaTime`/`defaultFixedDeltaTime` absent from YAML means the C# field initializers govern on load — reading YAML alone under-reports the effective singleton |

### Runtime semantics
Every frame, `WorldTimeScaleSystem` (TimelineComponentAnimationGroup) rebuilds a single zeroed
`MixData<float>` and runs `AccumulateJob` over EVERY active `WorldTimeScaleAnimated` clip entity in
the world — across ALL timelines at once — inserting each clip's value into a 4-slot weight-sorted
shift register (quoted):

```csharp
private static void AddWeighted(ref MixData<float> mix, float value, float weight)
{
    if (weight <= math.EPSILON) return;
    if (weight > mix.Weights.x)
    {
        mix.Weights = mix.Weights.xxyz;
        mix.Weights.x = weight;
        mix.Value4 = mix.Value3; mix.Value3 = mix.Value2; mix.Value2 = mix.Value1;
        mix.Value1 = value;
    }
    else if (weight > mix.Weights.y) { /* insert at slot 2, shift 3,4 */ }
    else if (weight > mix.Weights.z) { /* insert at slot 3, shift 4 */ }
    else if (weight > mix.Weights.w) { mix.Weights.w = weight; mix.Value4 = value; }
}
```

`ApplyJob` writes the singleton (quoted): `ActiveScale = JobHelpers.Blend<float, FloatMixer>(ref mix,
DefaultScale)` — missing weight is padded with `DefaultScale`, which is what makes eases ramp against
1 — and `IsActive = mix.Weights.x > EPSILON`. `WorldTimeScaleApplySystem` (PresentationSystemGroup)
then pushes `targetScale = IsActive ? ActiveScale : DefaultScale` into `UnityEngine.Time.timeScale`
(0.001 write deadband, NO clamp) and, when `ScaleFixedDeltaTime`,
`Time.fixedDeltaTime = max(0.0001, DefaultFixedDeltaTime * targetScale)`.
`WorldTimeScaleFixedStepSystem` (InitializationSystemGroup) mirrors the same formula onto
`FixedStepSimulationSystemGroup.Timestep` from a base captured ONCE on first update (it deliberately
ignores later external Timestep edits). The loop closes through the engine: scaled `Time.deltaTime` →
`UpdateWorldTimeSystem` → `ClockUpdateSystem` (GameTime clocks) → every timeline's `ClockData` — so
world scale slows the very timelines that host the clips. `TimelineTimeScaleApplySystem` multiplies
its per-timeline multiplier in between clock and timer update, so the two COMPOUND multiplicatively
(see traps). Source locations: the Time package lives under `Packages/`, but the BovineLabs CORE
timeline sources (ClockUpdateSystem, TimerUpdateSystem, bakers) live in
`Library/PackageCache/com.bovinelabs.timeline@<hash>` — namespace folder spelled **`Schedular`**
(vex-ee hash in §5).

### Traps & DO/DON'T (each proven live or source-quoted, vex-ee 2026-06)
- **DON'T trust `[Range(0,10)]`** — editor-slider UI only: `timeScale = 50` set via SerializedObject
  survived save → raw YAML `timeScale: 50` → fresh load 50; no clamp in serialization, baking, or
  apply (`Time.timeScale = 50` would apply verbatim). Guard designer input at the tool level.
- **DON'T stack more than 4 simultaneous world-scale clips** — `MixData<float>` holds exactly 4
  weight-sorted slots; insertion requires strictly greater weight (`>` not `>=`, ties lose) and
  evicts slot 4, so a 5th clip at equal weight is silently dropped, no warning. This shift-register
  is byte-for-byte `JobHelpers.AccumulateWeighted` — **the 4-clip blend ceiling is global to ALL
  BovineLabs track blending**, not a world-timescale quirk.
- **DO rely on automatic restoration** — the mix is rebuilt from zero every frame; when the last
  clip ends, `IsActive = mix.Weights.x > EPSILON` goes false and the apply ternary snaps
  `Time.timeScale` back to `DefaultScale` (no cleanup pass) — the singleton-side analogue of the
  per-timeline track's per-frame `ResetJob`.
- **DO leave `ScaleFixedDeltaTime` on** — at `timeScale = 0.1` with unchanged
  `fixedDeltaTime = 0.02`, physics steps once per 0.2 real seconds (5 Hz stutter); scaling to
  `0.02 * 0.1 = 0.002` keeps the real-time step rate constant. The `max(0.0001, …)` floor guards
  **fixedDeltaTime ONLY** against degenerate 0 — `targetScale` itself is never clamped.
- **DON'T put a full-weight 0-scale clip on a GameTime-clock timeline — it NEVER self-unfreezes**
  (source-proven deadlock): `timeScale = 0` → next frame `Time.deltaTime = 0` (the one unquoted
  engine-doc link) → `ClockData.DeltaTime = 0` → `timer.Time += 0` → the clip never reaches its end
  → `ClipActive` stays on → `IsActive` stays true → apply re-asserts 0 every frame (the 0.001
  deadband even overwrites an external `Time.timeScale = 1`). Escapes are all external: stop the
  timeline entity (disabling `TimelineActive` cascades, mix empties, default restored); or author
  the director as **`UnscaledGameTime`** — its clock advances at 1x regardless of world scale, the
  clip ends on schedule — **the correct freeze-frame recipe**. Corollary (inference, not separately
  proven): an ease-in TOWARD 0 on a GameTime clock approaches the freeze asymptotically.
- **DO expect world × timeline compounding (multiplicative)** — quoted chain: Time.timeScale=W →
  engine deltaTime → `UpdateWorldTimeSystem` → `ClockUpdateSystem`
  (`clockData.DeltaTime = GameTimeDeltaTime`) → `TimelineTimeScaleApplySystem`
  (`clock.DeltaTime *= T`) → `TimerUpdateSystem`. A timeline carrying both runs at
  **unscaledDelta × W × T** (W=0.5, T=0.5 → 0.25x) while every other GameTime timeline runs at W and
  UnscaledGameTime timelines at 1x. W is **one frame latent** (written in PresentationSystemGroup
  frame N, first affects deltaTime frame N+1); T applies same-frame. Division of labor: T touches
  only its own clock entity's `ClockData`, never `UnityEngine.Time`; W touches only
  `UnityEngine.Time` + fixed-step Timestep, never another entity's `ClockData`.
- **DON'T expect ease to survive an overlap** — authoring a clip with easeOut then overlapping it by
  the same span made Timeline silently convert the ease into a real blend (blendOut/blendIn pair in
  YAML; ease survives only on the non-overlapped edge). Ease ramps ONE clip's weight against the
  default; blend crossfades TWO clips; `-1` in YAML means "no blend".
- **DO know the baker's clock mappings** — `PlayableDirectorBaker`: `DirectorUpdateMode.GameTime →
  ClockUpdateMode.GameTime`, `DSPClock → UnscaledGameTime` (with LogWarning "DSP Clock mode not yet
  supported in DOTS"), `Manual → Constant`.
- **NEVER create or modify settings assets** — the project's `WorldTimeScaleSettings` asset and
  whatever prefab/object carries its SettingsAuthoring are infrastructure, READ ONLY.

## 3. DISCOVERY RECIPES
Act only through `unity-cli exec` / `unity-cli console`; never the filesystem; never play mode.
Follow the unity-cli Safe Loop on every mutation. Names below are parameters — discover them in THIS
project; never assume the worked example (§5).

**3.1 Confirm the package exists (else report a missing prerequisite — protocol §6):**
```csharp
var t = System.Type.GetType("BovineLabs.Timeline.Time.Authoring.WorldTimeScaleTrack, BovineLabs.Timeline.Time.Authoring");
return t == null ? "MISSING_PREREQUISITE|WorldTimeScaleTrack not found - package BovineLabs.Timeline.Time absent here"
                 : "OK|" + t.AssemblyQualifiedName + "|dataPath=" + UnityEngine.Application.dataPath;
```

**3.2 Find the active scene + SubScene(s):** the unity-cli First Command → `parentScenePath`, `subScenePath`(s).

**3.3 Find PlayableDirector(s) inside the SubScene** (read-only additive open, restore parent
after): `FindObjectsByType<PlayableDirector>(Include, None)`; print per director its hierarchy path,
`playableAsset`, AND **`timeUpdateMode`** — GameTime vs UnscaledGameTime decides whether a 0-scale
clip deadlocks (trap, §2). Selection rule when several exist (STATE it in your memory card): prefer
the single director in the chosen SubScene; if several, prefer one carrying the project's
timeline-reference authoring component. Zero → missing prerequisite, protocol §6.
**NO bind target is needed for this track** — no StatAuthoring, no Transform, nothing.

**3.4 Singleton provenance check (read-only, MANDATORY)** — find the settings asset by
TYPE and the SettingsAuthoring that bakes it:
```csharp
// 1) AssetDatabase.FindAssets("t:WorldTimeScaleSettings") -> real path(s); zero hits =>
//    every world clip will be silently inert: missing prerequisite, protocol §6
//    (an infrastructure specialist must add it; you never create settings assets).
// 2) Find which SettingsAuthoring lists it: search the SubScene roots (and their prefab
//    sources) for BovineLabs.Core.Authoring.Settings.SettingsAuthoring and print each
//    one's settings entries; the asset must appear in one that bakes into this world.
// 3) Read the asset YAML inside exec (File.ReadAllText) for defaultTimeScale — and
//    remember absent fields fall back to C# initializers (caveat, §2).
```

**3.5 Capture the chosen director's existing state — this is pre-state (`PRE|`)**:
```csharp
// PRE|playableAsset=<asset PATH or null>   via AssetDatabase.GetAssetPath(director.playableAsset)
// PRE|binding|<i>|<track name>|<track type>|<bound object hierarchy path + component type, or null>
//   one line per GetOutputTracks() of the CURRENT asset, via director.GetGenericBinding(track).
//   Capture the asset PATH and each track's NAME/index even when the table looks empty —
//   they make the undo journal replayable (UNDO-1 reloads the old asset by path and
//   re-binds by matching track name/index).
// PRE|timeUpdateMode=<mode>   (read-only here; you normally never change it — if the
//   freeze-frame recipe requires UnscaledGameTime, that change is its own journaled mutation)
// Record ALL of these in the undo journal (§6) before any mutation.
```

**Name resolution rule**: `GameObject.Find` misses inactive objects and is ambiguous on duplicate
names. Discovery (§3.3) must confirm the chosen name is active and unique in the SubScene; else
resolve by walking SubScene roots to the recorded hierarchy path (or `FindObjectsByType` filtered by
`scene`) instead of `Find`.

## 4. CANONICAL RECIPES
One logical change per exec block; each block prints its `PRE|` capture before mutating (protocol
§2), saves inside the block, and is verified from a fresh load (§7).

**4.1 Bullet time on a beat:**

```csharp
// ---- parameters (discovered in §3 / chosen with designer) ----
var assetFolder = "<CHOSEN>"; var assetPath = assetFolder + "/<Name>.playable";
// CAPTURE (print + journal): PRE|folderExisted=<bool> PRE|assetExisted=<bool>

// 1) Asset (no binding, no SubScene needed for this part)
var timeline = UnityEngine.ScriptableObject.CreateInstance<UnityEngine.Timeline.TimelineAsset>();
UnityEditor.AssetDatabase.CreateAsset(timeline, assetPath);
var track = timeline.CreateTrack<BovineLabs.Timeline.Time.Authoring.WorldTimeScaleTrack>(null, "<trackName>");

var clip = track.CreateClip<BovineLabs.Timeline.Time.Authoring.WorldTimeScaleClip>();
clip.displayName = "<clipName>";
clip.start = 1.0;          // <CHOSEN> lead-in at normal speed
clip.duration = 6.0;       // fresh clip arrives with duration=1 (seed); set freely
clip.easeInDuration = 0.4; // designer-grade enter ramp (1 -> timeScale)
clip.easeOutDuration = 0.4;// exit ramp (timeScale -> 1)
((BovineLabs.Timeline.Time.Authoring.WorldTimeScaleClip)clip.asset).timeScale = 0.1f;  // <CHOSEN>
UnityEditor.AssetDatabase.SaveAssets();

// 2) Wire (SubScene bracket): print the §3.5 PRE| lines, then
//    director.playableAsset = timeline;  SetDirty;  SaveScene.  THAT'S ALL.
//    No SetGenericBinding — the track has no binding slot; clips drive the
//    WorldTimeScale singleton (provenance per §3.4 — if the settings asset were
//    missing, every clip would be silently inert).
```

Rules of thumb (proven in training): keep `timeScale` in (0, 10] and treat 0 as "freeze trap" unless
the director clock is `UnscaledGameTime`; use ease for enter/exit of one clip, overlap two clips for
value-to-value crossfade (recover-to-1 pattern: a ts=1.0 clip overlapping the slow clip's tail);
never stack more than 4 world-scale clips project-wide at the same instant; leave
`ScaleFixedDeltaTime` on so physics stays smooth in slow-mo.

**4.2 The no-binding verification.** After wiring (SubScene bracket, save, fresh load), the binding
table must gain NO entry for this track: `GetGenericBinding(track) == null` is CORRECT here, not a
bug — the empty track class has no `TrackBindingType` and clips bake to clip entities + the world
singleton. Pre-existing binding entries for other tracks must read back untouched (compare against
the `PRE|binding|` lines).

## 5. WORKED EXAMPLE (vex-ee training stage) — example environment; rediscover, never assume

- Project: `/home/i/GitHub/vex-ee` (`dataPath=/home/i/GitHub/vex-ee/Assets`). Parent scene `Assets/Scenes/Main Scene.unity`;
  SubScene `Assets/Scenes/Main Sub Scene.unity`. Core sources: `Library/PackageCache/com.bovinelabs.timeline@4331b95d072a`.
- Stage: `Stage_Director` (PlayableDirector + TimelineReferenceAuthoring, `timeUpdateMode=GameTime`,
  read live); pre-wiring `PRE|playableAsset=Assets/Training/01-transform-position-track/PositionMastery.playable`.
- Singleton provenance: `Assets/Settings/Settings/WorldTimeScaleSettings.asset` (GUID
  `89916598b6c3ca6e5b1109a31001f189`; `m_Script` GUID `56fa96f300b14967bc18e0064f5e51a6` →
  `WorldTimeScaleSettings.cs`), YAML serializes ONLY `defaultTimeScale: 1`; referenced by the
  `SettingsAuthoring` on `Assets/Prefabs/Required.prefab` (entry 6 of 7), instanced as the `Required`
  root of the Main Sub Scene. Effective baked singleton: `{1, 1, false, true, 0.02}`.
- Asset built in training: `Assets/Training/05-world-timescale-track/WorldTimeScaleMastery.playable`
  — track `WorldTimeScale` (`resetOnDeactivate: 1`), fresh-load:
  ```
  CLIP|A_BulletTime|start=0|dur=1.5|easeIn=0.3|easeOut=0.3|blendIn=-1|blendOut=0.3|ts=0.1
  CLIP|B_Recover|start=1.2|dur=1.3|easeIn=0|easeOut=0|blendIn=0.3|blendOut=-1|ts=1
  CLIP|C_FreezeFrame|start=3|dur=0.5|easeIn=0|easeOut=0|blendIn=-1|blendOut=-1|ts=0
  ```
  C_FreezeFrame is a deliberate deadlock demo (trap, §2), NOT a usable pattern on a GameTime
  director. The A/B overlap is the live proof of ease→blend conversion (A authored easeOut=0.3,
  ended up `m_BlendOutDuration: 0.30000000000000004`).
- In-project reference asset: `Assets/SlowMoDemo/SlowMoTimeline.playable` (1s lead-in, 6s clip
  timeScale 0.1, easeIn/Out 0.4).
- No-binding verification output: `VERIFY|GetGenericBinding(WorldTimeScale)=null`; the stage's
  4-entry binding table (Position/Scale/Rotation/TimeScale → Stage_Actor) untouched throughout and
  quoted intact at restore; director restored to PositionMastery.
- Console baseline: UnityCliConnector HTTP server start, PerformanceTesting
  IPrebuildSetup/IPostBuildCleanup, TestResults.xml save.

## 6. UNDO APPENDIX
Artifact inventory for one run of §4 (vex-ee instance shown in §5):
1. Created asset `<assetPath>` (.playable: TimelineAsset + 1 track + clip sub-assets —
   `DeleteAsset` removes all sub-assets with the file).
2. Possibly-created folder(s) `<assetFolder>` (`EXPECTED:` the lesson-05 report never printed
   `folderExisted` — capture it yourself per recipe 4.1).
3. Mutated `director.playableAsset` — vex-ee: VERIFIED capture exists (the report's environment
   section printed the pre-wiring value, PositionMastery, before any mutation; capture yours per §3.5).
4. NO generic-binding entry added (the track has no `TrackBindingType`; verified
   `GetGenericBinding=null` post-wiring). The undo asserts the table still equals the captured
   `PRE|binding|` lines — vex-ee: `EXPECTED:` the 4-entry table contents were printed only at
   restore time, not as a pre-wiring `PRE|` dump; equality with the true pre-state is inference from
   the lesson-04 final state.
5. Settings asset / SettingsAuthoring carrier / singleton: READ ONLY, never mutated — nothing to
   restore, and the undo must NOT touch them.
6. If the freeze-frame job changed `director.timeUpdateMode` (GameTime → UnscaledGameTime), that is
   a journaled value mutation: restore the CAPTURED mode. (vex-ee training never changed it.)

ORDER: restore the director FIRST so nothing in the scene references the asset, THEN delete the
asset, THEN restore any other captured scene values (timeUpdateMode, if changed) — deleting the
asset while the director still points at it would leave a dangling `{fileID: 0}`-style reference in
the scene file instead of the captured pre-state.

Journal entry templates (protocol §5 — fill from YOUR captures, reverse order):

```csharp
// UNDO-1: restore director's captured playableAsset + assert binding table unchanged (SubScene bracket)
var director = /* resolve by CAPTURED hierarchy path */;
// this track added NO binding; do NOT ClearGenericBinding anything you did not add.
// Assert the table equals the PRE|binding| lines (count + each entry) and quote it.
director.playableAsset =                         // restore CAPTURED value, never "default"
    UnityEditor.AssetDatabase.LoadAssetAtPath<UnityEngine.Playables.PlayableAsset>("<CAPTURED pre path>") /* or null if captured null */;
// if timeUpdateMode was changed by this job: director.timeUpdateMode = <CAPTURED>;
UnityEditor.EditorUtility.SetDirty(director);
UnityEditor.SceneManagement.EditorSceneManager.SaveScene(subScene);
return "UNDONE|director restored";
```

```csharp
// UNDO-2: delete the created .playable (+ folder, only if PRE|folderExisted=false and now empty)
var ok = UnityEditor.AssetDatabase.DeleteAsset("<assetPath>");
if (!folderExisted && UnityEditor.AssetDatabase.FindAssets("", new[]{ "<assetFolder>" }).Length == 0)
    UnityEditor.AssetDatabase.DeleteAsset("<assetFolder>");
return "UNDONE|deleted=" + ok + "|<assetPath>";
```

UNDO-3 (verification, fresh load — protocol §7): reload the SubScene additively and
print `director.playableAsset` (must equal the CAPTURED pre value), `timeUpdateMode`
(must equal the captured mode), and the binding table (must equal the captured
`PRE|binding|` lines); confirm
`AssetDatabase.LoadAssetAtPath<UnityEngine.Object>(assetPath) == null`; confirm the
settings asset and its SettingsAuthoring carrier are byte-identical untouched (raw
YAML read); restore the parent scene; `unity-cli console --filter error` clean
against the project baseline.

## 7. VERIFICATION PROTOCOL

1. **Fresh-load asset dump**: in a new exec block, `AssetDatabase.LoadAssetAtPath` the
   `.playable` at `<assetPath>` and dump every track/clip (name, start/duration,
   ease/blend durations, `timeScale`, caps). In-memory state after a save is not evidence.
2. **Raw YAML check**: confirm `timeScale` values, `m_EaseInDuration` /
   `m_BlendIn/OutDuration` (`-1` = no blend; overlap converts ease→blend), and the
   inherited `resetOnDeactivate` on the track.
3. **No-binding proof from a RELOADED SubScene**:
   `GetGenericBinding(worldTimeScaleTrack) == null` AND the director's pre-existing
   binding entries intact (match the `PRE|binding|` lines).
4. **Singleton provenance check (read-only)**: a `WorldTimeScaleSettings` asset exists
   (found by TYPE, §3.4) and is listed in a `SettingsAuthoring` that bakes into this
   world — else all world clips are silently inert.
5. **Clock-mode check**: print the director's `timeUpdateMode`; if any clip has
   `timeScale = 0` (or eases toward 0) on a GameTime director, flag the deadlock trap
   (§2) to the designer before claiming success.
6. **Parent-scene restore**: end with `sceneCount=1`,
   `scene[0]=<parentScenePath>|loaded=True|active=True|dirty=False`, and the director
   restored to its prior playableAsset if you swapped it temporarily.
7. **Console**: `unity-cli console --filter error` must show nothing new beyond the
   project's known pre-existing background entries (vex-ee baseline listed in §5).
