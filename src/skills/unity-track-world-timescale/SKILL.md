---
name: unity-track-world-timescale
description: Master of WorldTimeScaleTrack + WorldTimeScaleClip in vex-ee — global bullet-time/slow-mo via the WorldTimeScale singleton, the timeScale-0 GameTime deadlock, and world×timeline compounding. Use when a designer asks for "bullet time", "freeze frame", or "global slow-mo".
---

# WorldTimeScaleTrack specialist

You are the specialist for **`WorldTimeScaleTrack`** and its single clip type
**`WorldTimeScaleClip`** from `Packages/BovineLabs.Timeline.Time`. Scope: exactly
this track family — authoring the track/clips in a `.playable` TimelineAsset, the
**`WorldTimeScale` singleton** they drive, and the apply chain into
`UnityEngine.Time.timeScale` / `fixedDeltaTime` / `FixedStepSimulationSystemGroup.Timestep`.
This track is **GLOBAL ONLY**: clips from ALL timelines merge into ONE singleton and
scale the whole world clock. Per-timeline playback speed (one director's own clock,
stat-driven) is `TimelineTimeScaleTrack`'s job — the `unity-track-timeline-timescale`
skill (topic 04); know the boundary in both directions. Stage construction belongs to
`unity-stage-foundations`; transform tracks to the position/rotation/scale skills.

All facts below were verified live in the **vex-ee** project, **2026-06** (reflection
dumps, package-source reads, raw YAML reads of .playable/.asset/.prefab files,
fresh-load read-backs via `unity-cli exec`). One honest caveat: the runtime verdicts
in this skill rest on one explicitly UNQUOTED link — the documented engine fact
`Time.deltaTime = unscaledDeltaTime * Time.timeScale` (so `deltaTime == 0` when
`timeScale == 0`). Every other link in every chain was quoted from source.

## Prerequisites & environment

- Act only through `unity-cli exec` / `unity-cli console`; never touch vex-ee via the
  filesystem; never enter play mode (runtime effects on `UnityEngine.Time` are proven
  from quoted source, not demonstrated live). Follow the **unity-cli skill's Safe
  Loop** on every mutation.
- Verify the live project first:
  `unity-cli exec "return UnityEditor.SceneManagement.EditorSceneManager.GetActiveScene().path + \"|\" + Application.dataPath;"`
  → expect `Assets/Scenes/Main Scene.unity|/home/i/GitHub/vex-ee/Assets`.
- The `TrainingStage` (built by unity-stage-foundations) must exist in SubScene
  `Assets/Scenes/Main Sub Scene.unity` with `Stage_Director` (PlayableDirector,
  `timeUpdateMode = GameTime`). **NO binding is needed for this track** — no
  StatAuthoring, no Transform, nothing: the track class has no `TrackBindingType`
  and its clips target the world singleton.
- **Singleton provenance (READ ONLY — project infrastructure, never modify)**:
  `Assets/Settings/Settings/WorldTimeScaleSettings.asset` (a `SettingsBase`
  ScriptableObject, `[SettingsGroup("Timeline")]`) is referenced by the
  `SettingsAuthoring` component on `Assets/Prefabs/Required.prefab` (entry 6 of 7),
  which is instanced as the `Required` root of the Main Sub Scene; its `Bake()` adds
  the `WorldTimeScale` singleton to the baked world. **No settings asset in a
  SettingsAuthoring → no singleton → `WorldTimeScaleApplySystem` has
  `RequireForUpdate<WorldTimeScale>()` → every world-timescale clip in the project is
  silently inert.**
- Your assets live only under `Assets/Training/05-world-timescale-track/`.
  Canonical asset: `WorldTimeScaleMastery.playable` (track `WorldTimeScale`, clips
  A_BulletTime 0–1.5s ts=0.1 easeIn=0.3 / B_Recover 1.2–2.5s ts=1.0 (0.3s blend
  with A) / C_FreezeFrame 3–3.5s ts=0 — a deliberate deadlock demo, see edge cases).
  In-project reference: `Assets/SlowMoDemo/SlowMoTimeline.playable` (1s lead-in,
  6s clip timeScale 0.1, easeIn/Out 0.4).

## VERIFIED facts (vex-ee, 2026-06)

Types (assembly `BovineLabs.Timeline.Time.Authoring`):

- `BovineLabs.Timeline.Time.Authoring.WorldTimeScaleTrack : DOTSTrack`
  — an **empty class by design**: `[TrackClipType(typeof(WorldTimeScaleClip))]`,
  `[TrackColor(0.92, 0.92, 0.92)]`, `[DisplayName("BovineLabs/Time/World Time Scale")]`.
  NO `TrackBindingType`, NO `Bake` override, no fields beyond the inherited `DOTSTrack`
  `resetOnDeactivate`. There is nothing to bind — contrast topic 04, whose track
  carries `[TrackBindingType(typeof(StatAuthoring))]` because its clips can read stats.
- `BovineLabs.Timeline.Time.Authoring.WorldTimeScaleClip : DOTSClip`
  — `ClipCaps.Blending | Looping`.

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
| `WorldTimeScaleSettings : SettingsBase` | Fields `defaultTimeScale=1`, `scaleFixedDeltaTime=true`, `defaultFixedDeltaTime=0.02f` (C# initializers); `Bake(Baker<SettingsAuthoring>)` adds the singleton `{1, 1, false, true, 0.02}` |
| Live asset YAML | Serializes ONLY `defaultTimeScale: 1`; `scaleFixedDeltaTime`/`defaultFixedDeltaTime` are ABSENT from YAML, so the C# field initializers govern on load. `m_Script` GUID `56fa96f300b14967bc18e0064f5e51a6` confirmed → `WorldTimeScaleSettings.cs` |

### Runtime semantics
Every frame, `WorldTimeScaleSystem` (TimelineComponentAnimationGroup) rebuilds a single
zeroed `MixData<float>` and runs `AccumulateJob` over EVERY active
`WorldTimeScaleAnimated` clip entity in the world — across ALL timelines at once —
inserting each clip's value into a 4-slot weight-sorted shift register (quoted):

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

`ApplyJob` writes the singleton (quoted): `ActiveScale = JobHelpers.Blend<float,
FloatMixer>(ref mix, DefaultScale)` — missing weight is padded with `DefaultScale`,
which is what makes eases ramp against 1 — and `IsActive = mix.Weights.x > EPSILON`.
`WorldTimeScaleApplySystem` (PresentationSystemGroup) then pushes
`targetScale = IsActive ? ActiveScale : DefaultScale` into `UnityEngine.Time.timeScale`
(0.001 write deadband, NO clamp) and, when `ScaleFixedDeltaTime`,
`Time.fixedDeltaTime = max(0.0001, DefaultFixedDeltaTime * targetScale)`.
`WorldTimeScaleFixedStepSystem` (InitializationSystemGroup) mirrors the same formula
onto `FixedStepSimulationSystemGroup.Timestep` from a base captured ONCE on first
update (it deliberately ignores later external Timestep edits). The loop closes
through the engine: scaled `Time.deltaTime` → `UpdateWorldTimeSystem` →
`ClockUpdateSystem` (GameTime clocks) → every timeline's `ClockData` — so world scale
slows the very timelines that host the clips. Topic 04's
`TimelineTimeScaleApplySystem` multiplies its per-timeline multiplier in between clock
and timer update, so the two COMPOUND multiplicatively (see edge cases).

Source locations: the Time package is under `Packages/BovineLabs.Timeline.Time`, but
the BovineLabs CORE timeline sources (ClockUpdateSystem, TimerUpdateSystem, bakers)
live in `Library/PackageCache/com.bovinelabs.timeline@4331b95d072a` — namespace folder
spelled **`Schedular`**. Useful for future source hunts.

## Canonical recipe 1 — bullet time on a beat (verbatim from report)

```csharp
// 1) Asset (no binding, no SubScene needed for this part)
var timeline = ScriptableObject.CreateInstance<UnityEngine.Timeline.TimelineAsset>();
UnityEditor.AssetDatabase.CreateAsset(timeline, path);
var track = timeline.CreateTrack<BovineLabs.Timeline.Time.Authoring.WorldTimeScaleTrack>(null, "WorldTimeScale");

var clip = track.CreateClip<BovineLabs.Timeline.Time.Authoring.WorldTimeScaleClip>();
clip.displayName = "BulletTime";
clip.start = 1.0;          // lead-in at normal speed
clip.duration = 6.0;       // fresh clip arrives with duration=1 (seed); set freely
clip.easeInDuration = 0.4; // designer-grade enter ramp (1 -> timeScale)
clip.easeOutDuration = 0.4;// exit ramp (timeScale -> 1)
((BovineLabs.Timeline.Time.Authoring.WorldTimeScaleClip)clip.asset).timeScale = 0.1f;
UnityEditor.AssetDatabase.SaveAssets();

// 2) Wire: director.playableAsset = timeline. THAT'S ALL.
//    No SetGenericBinding — the track has no binding slot; clips drive the
//    WorldTimeScale singleton baked from Assets/Settings/Settings/WorldTimeScaleSettings.asset
//    (via SettingsAuthoring on Required.prefab). If that settings asset were missing,
//    every clip would be silently inert.
```

Rules of thumb (from the report): keep `timeScale` in (0, 10] and treat 0 as "freeze
trap" unless the director clock is `UnscaledGameTime`; use ease for enter/exit of one
clip, overlap two clips when you want value-to-value crossfade (recover-to-1 pattern:
B_Recover ts=1.0 overlapping A's tail); never stack more than 4 world-scale clips
project-wide at the same instant; leave `ScaleFixedDeltaTime` on so physics stays
smooth in slow-mo.

## Canonical recipe 2 — the no-binding verification

After wiring (SubScene bracket, save, fresh-load), the binding table must gain NO
entry for this track. Verified output:

```
VERIFY|playableAsset=Assets/Training/05-world-timescale-track/WorldTimeScaleMastery.playable
VERIFY|GetGenericBinding(WorldTimeScale)=null
```

`GetGenericBinding(track) == null` is CORRECT here, not a bug — the empty track class
has no `TrackBindingType` and clips bake to clip entities + the world singleton. Any
pre-existing binding entries for other tracks stay untouched (the stage's 4-entry
table survived the playableAsset swap and restore intact).

## Edge cases & traps (each proven live or source-quoted, 2026-06)

- **DON'T trust `[Range(0,10)]`** — it is editor-slider UI only: `timeScale = 50` set
  via SerializedObject survived save → raw YAML `timeScale: 50` → fresh load 50; no
  clamp in serialization, baking, or apply (`Time.timeScale = 50` would apply
  verbatim). Guard designer input at the tool level.
- **DON'T stack more than 4 simultaneous world-scale clips** — `MixData<float>` holds
  exactly 4 weight-sorted slots; insertion requires strictly greater weight (`>` not
  `>=`, ties lose) and evicts slot 4, so a 5th clip at equal weight is silently
  dropped, no warning. This shift-register is byte-for-byte
  `JobHelpers.AccumulateWeighted` — **the 4-clip blend ceiling is global to ALL
  BovineLabs track blending**, not a world-timescale quirk.
- **DO rely on automatic restoration** — the mix is rebuilt from zero every frame;
  when the last clip ends, `IsActive = mix.Weights.x > EPSILON` goes false and the
  apply ternary snaps `Time.timeScale` back to `DefaultScale` (no cleanup pass) — the
  singleton-side analogue of topic 04's per-frame `ResetJob`.
- **DO leave `ScaleFixedDeltaTime` on** — at `timeScale = 0.1` with unchanged
  `fixedDeltaTime = 0.02`, physics steps once per 0.2 real seconds (5 Hz stutter);
  scaling to `0.02 * 0.1 = 0.002` keeps the real-time step rate constant. The
  `max(0.0001, …)` floor guards **fixedDeltaTime ONLY** against degenerate 0 —
  `targetScale` itself is never clamped.
- **DON'T put a full-weight 0-scale clip on a GameTime-clock timeline — it NEVER
  self-unfreezes** (source-proven deadlock): `timeScale = 0` → next frame
  `Time.deltaTime = 0` (the one unquoted engine-doc link) → `ClockData.DeltaTime = 0`
  → `timer.Time += 0` → the clip never reaches its end → `ClipActive` stays on →
  `IsActive` stays true → apply re-asserts 0 every frame (the 0.001 deadband even
  overwrites an external `Time.timeScale = 1`). Escapes are all external: stop the
  timeline entity (disabling `TimelineActive` cascades, mix empties, default
  restored); or author the director as **`UnscaledGameTime`** — its clock advances at
  1x regardless of world scale, the clip ends on schedule — **the correct freeze-frame
  recipe**. Corollary (inference, not separately proven): an ease-in TOWARD 0 on a
  GameTime clock approaches the freeze asymptotically.
- **DO expect world × timeline compounding (multiplicative)** — quoted chain:
  Time.timeScale=W → engine deltaTime → `UpdateWorldTimeSystem` →
  `ClockUpdateSystem` (`clockData.DeltaTime = GameTimeDeltaTime`) →
  `TimelineTimeScaleApplySystem` (`clock.DeltaTime *= T`) → `TimerUpdateSystem`. A
  timeline carrying both runs at **unscaledDelta × W × T** (W=0.5, T=0.5 → 0.25x)
  while every other GameTime timeline runs at W and UnscaledGameTime timelines at 1x.
  W is **one frame latent** (written in PresentationSystemGroup frame N, first affects
  deltaTime frame N+1); T applies same-frame. Division of labor: T touches only its
  own clock entity's `ClockData`, never `UnityEngine.Time`; W touches only
  `UnityEngine.Time` + fixed-step Timestep, never another entity's `ClockData`.
- **DON'T expect ease to survive an overlap** — authoring A with easeOut=0.3 then
  overlapping B by 0.3s made Timeline silently convert the ease into a real blend
  (A.blendOut=0.3 / B.blendIn=0.3 in YAML; ease survives only on the non-overlapped
  edge). Ease ramps ONE clip's weight against the default; blend crossfades TWO clips;
  `-1` in YAML means "no blend".
- **DON'T assume the settings YAML shows all fields** — the live asset serializes only
  `defaultTimeScale: 1`; `scaleFixedDeltaTime`/`defaultFixedDeltaTime` are absent and
  the C# initializers (`true`, `0.02f`) govern. Reading YAML alone under-reports the
  effective singleton `{1, 1, false, true, 0.02}`.
- **DO know the baker's clock mappings** — `PlayableDirectorBaker`:
  `DirectorUpdateMode.GameTime → ClockUpdateMode.GameTime`,
  `DSPClock → UnscaledGameTime` (with LogWarning "DSP Clock mode not yet supported in
  DOTS"), `Manual → Constant`. Stage_Director is GameTime (read live).
- **NEVER create or modify settings assets** — `WorldTimeScaleSettings.asset` and
  `Required.prefab` are project infrastructure, READ ONLY.

## Verification protocol

1. **Fresh-load asset dump**: in a new exec block, `AssetDatabase.LoadAssetAtPath` the
   .playable and dump every track/clip (name, start/duration, ease/blend durations,
   `timeScale`, caps). In-memory state after a save is not evidence.
2. **Raw YAML check**: confirm `timeScale` values, `m_EaseInDuration` /
   `m_BlendIn/OutDuration` (`-1` = no blend; overlap converts ease→blend), and the
   inherited `resetOnDeactivate` on the track.
3. **No-binding proof from a RELOADED SubScene**:
   `GetGenericBinding(worldTimeScaleTrack) == null` AND the director's pre-existing
   binding entries (the stage's 4) intact.
4. **Singleton provenance check (read-only)**: `WorldTimeScaleSettings.asset` exists
   at `Assets/Settings/Settings/` and is listed in `Required.prefab`'s
   SettingsAuthoring — else all world clips are silently inert.
5. **Parent-scene restore**: end with `sceneCount=1`,
   `scene[0]=Assets/Scenes/Main Scene.unity|loaded=True|active=True|dirty=False`, and
   the director restored to its prior playableAsset.
6. **Console**: `unity-cli console --filter error` must show nothing new; known
   pre-existing vex-ee background entries are UnityCliConnector HTTP server start,
   PerformanceTesting IPrebuildSetup/IPostBuildCleanup, TestResults.xml save.
