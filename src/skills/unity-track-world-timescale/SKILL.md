---
name: unity-track-world-timescale
description: Master of WorldTimeScaleTrack + WorldTimeScaleClip (package BovineLabs.Timeline.Time) — global bullet-time/slow-mo via the WorldTimeScale singleton, the timeScale-0 GameTime deadlock, and world×timeline compounding. Portable to any project containing the package; worked example from vex-ee. Use when a designer asks for "bullet time", "freeze frame", or "global slow-mo".
---

# WorldTimeScaleTrack specialist

## 1. SCOPE

You are the specialist for **`WorldTimeScaleTrack`** and its single clip type
**`WorldTimeScaleClip`** from `BovineLabs.Timeline.Time`. Scope: authoring the track/clips
in a `.playable`, the **`WorldTimeScale` singleton** they drive, and the apply chain into
`UnityEngine.Time.timeScale` / `fixedDeltaTime` / `FixedStepSimulationSystemGroup.Timestep`.
This track is **GLOBAL ONLY**: clips from ALL timelines merge into ONE singleton and scale
the whole world clock. Per-timeline playback speed (one director's own clock, stat-driven)
is `TimelineTimeScaleTrack`'s job — the `unity-track-timeline-timescale` skill; know the
boundary in both directions. Stage construction belongs to `unity-stage-foundations`;
transform tracks to the position/rotation/scale skills.

**Operate per `unity-timeline-track-authoring`; behave per `unity-agent-protocol`; use the
editor per `unity-cli`.** Discovery preamble → that skill's §1; the SubScene bracket → §2;
the undo-appendix structure → §3; the verification protocol → §4; the shared vex-ee stage →
§5. This skill keeps ONLY the WorldTimeScale-unique facts below.

## 2. TYPE FACTS

Types (assembly `BovineLabs.Timeline.Time.Authoring`):

- `BovineLabs.Timeline.Time.Authoring.WorldTimeScaleTrack : DOTSTrack` — an **empty class by
  design**: `[TrackClipType(typeof(WorldTimeScaleClip))]`, `[TrackColor(0.92, 0.92, 0.92)]`,
  `[DisplayName("BovineLabs/Time/World Time Scale")]`. **NO `[TrackBindingType]`** (nothing to
  bind), NO `Bake` override, no fields beyond the inherited `DOTSTrack.resetOnDeactivate`.
  Contrast `TimelineTimeScaleTrack`, which carries `[TrackBindingType(typeof(StatAuthoring))]`
  because its clips can read stats — this one cannot.
- `BovineLabs.Timeline.Time.Authoring.WorldTimeScaleClip : DOTSClip` — `clipCaps =
  ClipCaps.Blending | Looping` (read back live: `Looping, Blending`).

### WorldTimeScaleClip fields
| Member | Type | Default | Meaning |
|---|---|---|---|
| `timeScale` | `float` | `0.1` | Global multiplier. Tooltip: "Global time scale for the entire world. 0 = Freeze Frame, 0.1 = Slow Mo, 1 = Normal, >1 = Fast Forward." |
| `timeScale` attrs | `[Range(0f, 10f)]` | — | **Editor-slider only** — no runtime/serialization clamp (50 round-trips, proven). |
| `duration` (override) | `double` | returns `1` | Seeds initial TimelineClip length at `CreateClip` only; freely settable after. |

Bake payload (clip `Bake`, quoted): `WorldTimeScaleAnimated{ AuthoredData = timeScale,
Value = timeScale }` onto the CLIP entity. Unlike `TimelineTimeScaleAnimated` there is
**no `StatKey`/`StatEntity`** — no stat override exists for world scale.

### WorldTimeScale singleton + settings (READ ONLY — never create/modify these assets)
| Type | Facts |
|---|---|
| `WorldTimeScale` (asm `BovineLabs.Timeline.Time.Data`) | Fields: `DefaultScale`, `ActiveScale` (float), `IsActive`, `ScaleFixedDeltaTime` (bool), `DefaultFixedDeltaTime` (float). |
| `WorldTimeScaleSettings : SettingsBase` | `[SettingsGroup("Timeline")]`; fields `defaultTimeScale=1`, `scaleFixedDeltaTime=true`, `defaultFixedDeltaTime=0.02f` (C# initializers); `Bake(Baker<SettingsAuthoring>)` adds the singleton `{1, 1, false, true, 0.02}`. |
| Provenance mechanism | The singleton exists ONLY if a `WorldTimeScaleSettings` asset is listed in a `SettingsAuthoring` component baked into the world (vex-ee: a Required prefab in the SubScene, ceremony §5). **No settings asset in a SettingsAuthoring → no singleton → `WorldTimeScaleApplySystem` has `RequireForUpdate<WorldTimeScale>()` → every world-timescale clip in the project is silently inert.** |
| Settings YAML caveat | The asset may serialize ONLY `defaultTimeScale`; absent `scaleFixedDeltaTime`/`defaultFixedDeltaTime` means the C# field initializers govern on load — reading YAML alone under-reports the effective singleton. |

## 3. RUNTIME SEMANTICS

Every frame, `WorldTimeScaleSystem` (TimelineComponentAnimationGroup) rebuilds a single zeroed
`MixData<float>` and runs `AccumulateJob` over EVERY active `WorldTimeScaleAnimated` clip entity
in the world — across ALL timelines at once — inserting each clip's value into a 4-slot
weight-sorted shift register (quoted):

`AddWeighted` (quoted): skip if `weight <= EPSILON`; else insert `value` at the first of the 4
weight slots where `weight > mix.Weights.{x|y|z|w}` (strictly greater), shifting lower slots down
and evicting slot 4. `ApplyJob` writes the singleton (quoted): `ActiveScale = JobHelpers.Blend<float, FloatMixer>(ref
mix, DefaultScale)` — missing weight is padded with `DefaultScale`, which is what makes eases
ramp against 1 — and `IsActive = mix.Weights.x > EPSILON`. `WorldTimeScaleApplySystem`
(PresentationSystemGroup) then pushes `targetScale = IsActive ? ActiveScale : DefaultScale` into
`UnityEngine.Time.timeScale` (0.001 write deadband, NO clamp) and, when `ScaleFixedDeltaTime`,
`Time.fixedDeltaTime = max(0.0001, DefaultFixedDeltaTime * targetScale)`.
`WorldTimeScaleFixedStepSystem` (InitializationSystemGroup) mirrors the same formula onto
`FixedStepSimulationSystemGroup.Timestep` from a base captured ONCE on first update (it
deliberately ignores later external Timestep edits). The loop closes through the engine: scaled
`Time.deltaTime` → `UpdateWorldTimeSystem` → `ClockUpdateSystem` (GameTime clocks) → every
timeline's `ClockData` — so world scale slows the very timelines that host the clips.
`TimelineTimeScaleApplySystem` multiplies its per-timeline multiplier in between clock and timer
update, so the two COMPOUND multiplicatively (traps below). The BovineLabs CORE timeline sources
(ClockUpdateSystem, TimerUpdateSystem, bakers) live in
`Library/PackageCache/com.bovinelabs.timeline@<hash>` — namespace folder spelled **`Schedular`**
(vex-ee hash in ceremony §5).

**Silence profile:** runtime effect lives only in play mode, never written back to authoring data
(undo is purely the authoring artifacts). A clean console is NOT evidence — a missing settings
asset (no singleton) makes every clip silently inert with no warning, and `GetGenericBinding`
returning `null` is CORRECT here, not a failure.

### Traps & DO/DON'T (each proven live or source-quoted, vex-ee 2026-06)
- **DON'T trust `[Range(0,10)]`** — editor-slider UI only: `timeScale = 50` set via SerializedObject
  survived save → raw YAML `timeScale: 50` → fresh load 50; no clamp in serialization, baking, or
  apply (`Time.timeScale = 50` applies verbatim). Guard designer input at the tool level.
- **DON'T stack more than 4 simultaneous world-scale clips** — `MixData<float>` holds exactly 4
  weight-sorted slots; insertion requires strictly greater weight (`>` not `>=`, ties lose) and
  evicts slot 4, so a 5th clip at equal weight is silently dropped. This shift-register is
  byte-for-byte `JobHelpers.AccumulateWeighted` — **the 4-clip blend ceiling is global to ALL
  BovineLabs track blending**, not a world-timescale quirk.
- **DO rely on automatic restoration** — the mix is rebuilt from zero every frame; when the last
  clip ends, `IsActive` goes false and the apply ternary snaps `Time.timeScale` back to
  `DefaultScale` (no cleanup pass) — the singleton-side analogue of the per-timeline track's
  per-frame `ResetJob`.
- **DO leave `ScaleFixedDeltaTime` on** — at `timeScale = 0.1` with unchanged `fixedDeltaTime =
  0.02`, physics steps once per 0.2 real seconds (5 Hz stutter); scaling to `0.02 * 0.1 = 0.002`
  keeps the real-time step rate constant. The `max(0.0001, …)` floor guards **fixedDeltaTime
  ONLY** against degenerate 0 — `targetScale` itself is never clamped.
- **DON'T put a full-weight 0-scale clip on a GameTime-clock timeline — it NEVER self-unfreezes**
  (source-proven deadlock): `timeScale = 0` → next frame `Time.deltaTime = 0` (the one engine-doc
  link: `deltaTime = unscaledDeltaTime * timeScale`) → `ClockData.DeltaTime = 0` → `timer.Time +=
  0` → the clip never reaches its end → `ClipActive` stays on → `IsActive` stays true → apply
  re-asserts 0 every frame (the 0.001 deadband even overwrites an external `Time.timeScale = 1`).
  Escapes are all external: stop the timeline entity (disabling `TimelineActive` cascades, mix
  empties, default restored); or author the director as **`UnscaledGameTime`** — its clock
  advances at 1x regardless of world scale, the clip ends on schedule — **the correct freeze-frame
  recipe**. Corollary (inference): an ease-in TOWARD 0 on a GameTime clock approaches the freeze
  asymptotically.
- **DO expect world × timeline compounding (multiplicative)** — quoted chain: Time.timeScale=W →
  engine deltaTime → `UpdateWorldTimeSystem` → `ClockUpdateSystem` (`clockData.DeltaTime =
  GameTimeDeltaTime`) → `TimelineTimeScaleApplySystem` (`clock.DeltaTime *= T`) →
  `TimerUpdateSystem`. A timeline carrying both runs at **unscaledDelta × W × T** (W=0.5, T=0.5 →
  0.25x) while every other GameTime timeline runs at W and UnscaledGameTime timelines at 1x. W is
  **one frame latent** (written in PresentationSystemGroup frame N, first affects deltaTime frame
  N+1); T applies same-frame. Division of labor: T touches only its own clock entity's `ClockData`,
  never `UnityEngine.Time`; W touches only `UnityEngine.Time` + fixed-step Timestep, never another
  entity's `ClockData`.
- **DON'T expect ease to survive an overlap** — authoring a clip with easeOut then overlapping it
  by the same span made Timeline silently convert the ease into a real blend (blendOut/blendIn pair
  in YAML; ease survives only on the non-overlapped edge). Ease ramps ONE clip's weight against the
  default; blend crossfades TWO clips; `-1` in YAML means "no blend".
- **DO know the baker's clock mappings** — `PlayableDirectorBaker`: `DirectorUpdateMode.GameTime →
  ClockUpdateMode.GameTime`, `DSPClock → UnscaledGameTime` (with LogWarning "DSP Clock mode not yet
  supported in DOTS"), `Manual → Constant`.

## 4. DISCOVERY DELTA (vs ceremony §1)

Run the §1 discovery preamble, with these WorldTimeScale specializations:

- **D3 (directors):** ALSO print each director's **`timeUpdateMode`** — GameTime vs
  UnscaledGameTime decides whether a 0-scale clip deadlocks (§3). **NO bind target is needed for
  this track** — skip D4 entirely (no StatAuthoring, no Transform, nothing to find or bind).
- **D4-replacement — Singleton provenance check (read-only, MANDATORY):**
  ```csharp
  // 1) AssetDatabase.FindAssets("t:WorldTimeScaleSettings") -> real path(s); zero hits =>
  //    every world clip will be silently inert: missing prerequisite, protocol §6
  //    (an infrastructure specialist must add it; you never create settings assets).
  // 2) Find which SettingsAuthoring lists it: search the SubScene roots (and their prefab
  //    sources) for BovineLabs.Core.Authoring.Settings.SettingsAuthoring and print each one's
  //    settings entries; the asset must appear in one that bakes into this world.
  // 3) Read the asset YAML inside exec (File.ReadAllText) for defaultTimeScale — and remember
  //    absent fields fall back to C# initializers (caveat, §2).
  ```
- **D5 (pre-state):** the standard `PRE|playableAsset` + `PRE|binding|` lines, PLUS
  `PRE|timeUpdateMode=<mode>` (read-only here; you normally never change it — if the freeze-frame
  recipe requires UnscaledGameTime, that change is its OWN journaled mutation).

## 5. CLIP PATTERNS (the bracket's track-specific middle, ceremony §2)

The bracket's wiring step is REDUCED for this track: print the §4 `PRE|` lines, then
`director.playableAsset = timeline; SetDirty; SaveScene`. **No `SetGenericBinding`** — the empty
track has no binding slot; clips drive the `WorldTimeScale` singleton (provenance per §4).

**P1 — Bullet time on a beat** (designer: "slow the world for a moment, ease in/out"):
```csharp
var track = timeline.CreateTrack<BovineLabs.Timeline.Time.Authoring.WorldTimeScaleTrack>(null, "<trackName>");
var clip = track.CreateClip<BovineLabs.Timeline.Time.Authoring.WorldTimeScaleClip>();
clip.displayName = "<clipName>";
clip.start = 1.0;           // <CHOSEN> lead-in at normal speed
clip.duration = 6.0;        // fresh clip arrives with duration=1 (seed); set freely
clip.easeInDuration = 0.4;  // designer-grade enter ramp (1 -> timeScale)
clip.easeOutDuration = 0.4; // exit ramp (timeScale -> 1)
((BovineLabs.Timeline.Time.Authoring.WorldTimeScaleClip)clip.asset).timeScale = 0.1f; // <CHOSEN>
```

**P2 — Recover-to-1 crossfade** (designer: "ramp back to normal speed smoothly"): overlap a
second `timeScale = 1.0` clip onto the slow clip's tail. Use OVERLAP (not ease) for value-to-value
crossfade between two clips; ease only ramps ONE clip against the default (§3 trap).

**P3 — Freeze frame** (designer: "stop time dead"): `timeScale = 0` — but ONLY on an
**UnscaledGameTime** director (the correct recipe). On a GameTime director this is the deadlock
trap (§3): the clip never ends and the world stays frozen. Flag the director's `timeUpdateMode` to
the designer before authoring any 0-scale (or ease-toward-0) clip.

Rules of thumb (proven in training): keep `timeScale` in (0, 10]; treat 0 as "freeze trap" unless
the clock is UnscaledGameTime; never stack >4 world-scale clips project-wide at the same instant;
leave `ScaleFixedDeltaTime` on so physics stays smooth in slow-mo.

## 6. VERIFICATION DELTA (vs ceremony §4)

Run the §4 protocol, with these additions/specializations:
- **Asset dump** must include `timeScale` and ease/blend durations per clip.
- **Raw YAML** must confirm `timeScale` values, `m_EaseInDuration` / `m_BlendIn/OutDuration` (`-1`
  = no blend; overlap converts ease→blend), and the inherited `resetOnDeactivate` on the track.
- **No-binding proof** (replaces the §4 binding-readback): from a RELOADED SubScene,
  `GetGenericBinding(worldTimeScaleTrack) == null` is CORRECT, not a bug; the director's
  pre-existing binding entries for OTHER tracks must read back untouched (match the `PRE|binding|`
  lines).
- **Singleton provenance (read-only):** a `WorldTimeScaleSettings` asset exists (found by TYPE,
  §4) and is listed in a `SettingsAuthoring` baking into this world — else all world clips are
  silently inert. Confirm the asset + its carrier are byte-identical untouched (raw YAML).
- **Clock-mode check:** print `timeUpdateMode`; if any clip has `timeScale = 0` (or eases toward 0)
  on a GameTime director, flag the deadlock trap (§3) to the designer before claiming success.

## 7. UNDO DELTA (vs ceremony §3)

Standard artifact inventory + restore-director-first ORDER + UNDO-1/2/3 templates per ceremony §3,
with these WorldTimeScale specializations:
- **UNDO-1 adds NO binding to clear** — the track has no `[TrackBindingType]` (verified
  `GetGenericBinding=null` post-wiring). Do NOT `ClearGenericBinding` anything you did not add;
  instead ASSERT the table still equals the captured `PRE|binding|` lines (count + each entry).
- **Settings asset / SettingsAuthoring carrier / singleton: READ ONLY** — never mutated, nothing
  to restore, and the undo must NOT touch them.
- **If the freeze-frame job changed `director.timeUpdateMode`** (GameTime → UnscaledGameTime), that
  is a journaled value mutation — restore the CAPTURED mode in UNDO-1 (the line after the
  playableAsset restore). vex-ee training never changed it.

## 8. WORKED EXAMPLE DELTA (vs the shared vex-ee stage, ceremony §5)

- **No bind target used** (track has none). Director `Stage_Director`, `timeUpdateMode=GameTime`
  (read live); pre-wiring `PRE|playableAsset=.../01-transform-position-track/PositionMastery.playable`.
- **Singleton provenance:** `Assets/Settings/Settings/WorldTimeScaleSettings.asset` (GUID
  `89916598b6c3ca6e5b1109a31001f189`), YAML serializes ONLY `defaultTimeScale: 1`; referenced by
  the `SettingsAuthoring` on `Assets/Prefabs/Required.prefab` (entry 6 of 7), instanced as the
  `Required` root of the Main Sub Scene. Effective baked singleton: `{1, 1, false, true, 0.02}`.
  Core sources: `Library/PackageCache/com.bovinelabs.timeline@4331b95d072a`.
- **Asset built:** `Assets/Training/05-world-timescale-track/WorldTimeScaleMastery.playable`, track
  `WorldTimeScale` (`resetOnDeactivate: 1`), fresh-load clips:
  ```
  CLIP|A_BulletTime|start=0|dur=1.5|easeIn=0.3|easeOut=0.3|blendIn=-1|blendOut=0.3|ts=0.1
  CLIP|B_Recover|start=1.2|dur=1.3|easeIn=0|easeOut=0|blendIn=0.3|blendOut=-1|ts=1
  CLIP|C_FreezeFrame|start=3|dur=0.5|easeIn=0|easeOut=0|blendIn=-1|blendOut=-1|ts=0
  ```
  C_FreezeFrame is a deliberate deadlock demo (P3/§3 trap), NOT usable on a GameTime director. The
  A/B overlap is the live proof of ease→blend conversion (A authored easeOut=0.3, ended up
  `m_BlendOutDuration: 0.30000000000000004`).
- **In-project reference:** `Assets/SlowMoDemo/SlowMoTimeline.playable` (1s lead-in, 6s clip ts 0.1,
  easeIn/Out 0.4).
- **No-binding verification:** `VERIFY|GetGenericBinding(WorldTimeScale)=null`; the stage's 4-entry
  binding table (Position/Scale/Rotation/TimeScale → Stage_Actor) untouched and quoted intact at
  restore; director restored to PositionMastery.
