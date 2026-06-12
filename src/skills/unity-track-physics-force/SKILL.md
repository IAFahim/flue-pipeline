---
name: unity-track-physics-force
description: Master of PhysicsForceTrack + clip in vex-ee — impulse/continuous forces with 7 direction modes, latching, deterministic per-entity randomness, pre-fire velocity reset, the one-impulse-per-activation trap. Use when a designer asks "kick / launch / thrust / knock back / scatter this body".
---

# PhysicsForceTrack specialist

You are the specialist for **`PhysicsForceTrack`** ("BovineLabs/Physics/Force")
and **`PhysicsForceClip`** from `Packages/BovineLabs.Timeline.Physics`, ns
`BovineLabs.Timeline.Physics.Authoring` — bound to a **PhysicsBodyAuthoring
component**. It appends `PendingForce{Linear, Angular}` elements drained the
SAME tick through mass/inertia: Impulse fires a raw momentum kick once per
activation; Continuous applies a dt-scaled force every fixed step. The
family's RICHEST clip: **18** fields, 7 direction modes, latching,
deterministic randomness, a once-per-activation velocity reset.

**Family patterns live in `unity-track-physics-filter-override`** (two-system
split, producer/modifier groups, the central `PhysicsTimelineBakingSystem`,
the TrackBlendDriver kernel/overlap rules, timeline-activation scope, the
silence profile — patterns 1–7). **PendingForce/accumulator mechanics and the
stat chain (`StatStrengthUtility.Resolve`, the triple trap) are banked in
`unity-track-physics-angular-pid`.** Cite both; don't re-derive. This skill
owns direction modes, latching, randomness, the velocity reset, and the
one-impulse-per-activation trap.

All facts verified live in **vex-ee**, **2026-06** (reflection dumps,
package-source reads inside exec, raw YAML reads, fresh-load read-backs), all
via `unity-cli exec`; no play mode — runtime claims are source-derived.

## Prerequisites & environment

- Act only through `unity-cli exec` / `unity-cli console`; never touch vex-ee
  via the filesystem; never enter play mode; follow the **unity-cli Safe
  Loop**. Smoke test → `Assets/Scenes/Main Scene.unity|/home/i/GitHub/vex-ee/Assets`.
- The `TrainingStage` (unity-stage-foundations) must exist in SubScene
  `Assets/Scenes/Main Sub Scene.unity`. Binding target: **Stage_PhysicsBall's
  `PhysicsBodyAuthoring` COMPONENT** (rule 5k: pass the component; the baker
  coerces component→entity). Stage_PhysicsBall: pos (0,1,5), Dynamic, Mass=1,
  `Targets.Target=Stage_Target` (clip C's seek needs it), **NO StatAuthoring**
  (keeps the silent-×1 stat exhibit live).
- Your assets live only under `Assets/Training/21-physics-force-track/`.
  Canonical asset: `ForceMastery.playable` — one track `ForceTrack`, four
  clips A–D (exact configs in the Verification protocol's fresh-load dump).
  Director table holds **19** entries with this binding as the 19th.

## VERIFIED facts (vex-ee, 2026-06)

| Type | Facts |
|---|---|
| `PhysicsForceTrack` | ns + asm `BovineLabs.Timeline.Physics.Authoring`, base `DOTSTrack`, EMPTY body. `[TrackClipType(typeof(PhysicsForceClip))]`, `[TrackColor(0.8,0.4,0.2)]`, `[TrackBindingType(typeof(Unity.Physics.Authoring.PhysicsBodyAuthoring))]`, `[DisplayName("BovineLabs/Physics/Force")]`. |
| `PhysicsForceClip` | base `DOTSClip`, `ITimelineClipAsset`, `clipCaps => ClipCaps.Blending \| ClipCaps.Looping` (REAL mixer), `duration => 1` (seed only). Bake: unconditional, SILENT (family pattern 7); cone degrees→radians at bake (`math.radians`); link schemas → ushort keys, null → 0. |
| `PhysicsForceData` | the 18-field config baked verbatim (cone fields in **radians**). |
| `PhysicsForceState` | IComponentData on BINDING: `bool Fired; bool ResetApplied; bool DirectionLatched; float3 LatchedDirection;` |
| `PhysicsForceRandom` | IComponentData on BINDING: `Random Value` — **separate from State by design** (doc comment verbatim): *"Lives outside PhysicsForceState so clip re-activation resets fire/latch state without rewinding the stream — each activation draws fresh values. A zero state is lazily seeded from (Seed, entity), so a given entity and seed always replays the same sequence."* The only family branch adding a Random component. |
| `ActiveForce` | IComponentData + IEnableableComponent: `PhysicsForceData Config` — BINDING entity, added DISABLED at bake, plus `PendingForce`/`PendingVelocity` buffers + `PendingVelocityReset` (disabled) via `EnsureAccumulationBuffers`. |
| Enums | `PhysicsForceMode : byte {Continuous=0, Impulse=1}`; `PhysicsForceDirectionMode : byte {FixedVector=0, TowardTarget=1, AwayFromTarget=2, RandomSphere=3, RandomCone=4, AlongVelocity=5, AgainstVelocity=6}`; `VelocityResetFlags : byte {None=0, Linear=1, Angular=2, Both=3}`. |
| Systems | `PhysicsForceTrackSystem` (`TimelineComponentAnimationGroup`, `[UpdateAfter(EntityLinkTargetPatchSystem)]`) = family kernel (ResetState → Prepare → DisableStale → blend → WriteActive via BeginSim ECB). Apply: `AppendForceJob` in **`Kinematics/PhysicsKinematicsApplySystem.cs`** (`PhysicsProducerGroup`, before the physics step). `PhysicsProducerForceAccumulatorSystem` (`[UpdateAfter(PhysicsKinematicsApplySystem)]`, `[UpdateAfter(PhysicsPidApplySystem)]`) drains reset + buffers the SAME tick; a twin `PhysicsModifierForceAccumulatorSystem` exists after the step. |

**Naming oddity (file-level confirmed):** there is NO `PhysicsForceApplySystem`.
`AppendForceJob` AND the Velocity track's `AppendVelocityJob` are both hosted
by `PhysicsKinematicsApplySystem.cs` — "Kinematics" is the umbrella for direct
force/velocity application; the family's second shared-apply-system pair
(after Linear/Angular PID sharing `PhysicsPidApplySystem`).

### Clip fields — ALL 18, camelCase, defaults from a fresh instance (reflection `FIELDCOUNT|18`; the curriculum's "17" was an erratum)

| Field | Type | Default | Meaning / tooltip (verbatim where quoted) |
|---|---|---|---|
| `mode` | PhysicsForceMode | `Impulse(1)` | *"Impulse mode applies force exactly once per clip activation and ignores Looping."* |
| `directionMode` | PhysicsForceDirectionMode | `FixedVector(0)` | How the linear force direction is derived. |
| `linearForce` | Vector3 | `(0,0,0)` | FixedVector mode's force (N for Continuous, N·s for Impulse). |
| `space` | Target | `Self(4)` | Frame for FixedVector/RandomCone/angularForce: None=raw world, Self=body frame, others via Targets. |
| `magnitude` | float | `10` | Scale for ALL direction-derived modes (Toward/Away/RandomSphere/RandomCone/Along/Against). |
| `directionTarget` | Target | `Target(1)` | Targets slot (on the BODY) naming the seek/flee target. |
| `directionTargetLink` | EntityLinkSchema | `null` | Optional link hop from the resolved slot entity. |
| `coneAzimuthCenter` | float | `0` | *"Azimuth 0 points along +Z of the Space frame; 180 points behind it."* Degrees. |
| `coneAzimuthHalfRange` | float | `30` `[Range(0,180)]` | Degrees. |
| `coneElevationCenter` | float | `0` | Degrees. |
| `coneElevationHalfRange` | float | `15` `[Range(0,89)]` | Degrees. |
| `seed` | uint | `0` | *"Offsets this body's random stream. 0 is valid; entity identity already decorrelates bodies."* |
| `latchDirection` | bool | `True` | *"Sample random/velocity-relative directions once per clip activation and hold them. Disable to re-evaluate every fire."* |
| `resetVelocityOnFire` | VelocityResetFlags | `None(0)` | *"Zeroes the body's velocity once per clip activation, immediately before this force lands. Use Linear for dashes that must always travel the same distance."* |
| `angularForce` | Vector3 | `(0,0,0)` | Torque, resolved through the same `space` frame; rides the same PendingForce element. |
| `strengthStat` | StatSchemaObject | `null` | Family ×100 fixed-point stat multiplier — gates EARLY (below). |
| `readStatFrom` | Target | `Self(4)` | Whose Stat buffer. |
| `readStatLink` | EntityLinkSchema | `null` | Optional link override for the stat hunt. |

YAML side keeps **degrees** — radians exist only in baked data (raw-read
verified; exact per-clip YAML in the Verification protocol).

### Runtime semantics (one paragraph, source-derived)

Per rendered frame, the family kernel: `ResetStateTrackJob` resets
`PhysicsForceState` to `{Fired=false}` (zeroing ResetApplied,
DirectionLatched, LatchedDirection) on a clip-activation edge **only while
`ActiveForce` is disabled**; clips blend through the real `PhysicsForceMixer`
into one enabled `ActiveForce{Config}` (BeginSim ECB — one rendered frame of
enable latency); `DisableStaleTrackJob` disables it only at TIMELINE
deactivation. Per fixed step, `AppendForceJob` walks enabled bindings:
Impulse skips if `state.Fired`; Continuous skips if `DeltaTime <= 0.0001f`;
the stat multiplier resolves EARLY (`math.abs(multiplier) < 1e-5f` skips
everything); the direction resolves per mode (fixed vectors via
`ResolveSpaceVector`, target modes via `Targets`+optional link,
random/velocity modes via the latch-aware `TryResolveDynamicDirection`, which
can return false = defer); a first-fire `resetVelocityOnFire` request ORs
into `PendingVelocityReset`; then ONE `PendingForce{Linear, Angular}` element
is appended scaled by `timeScale = Impulse ? 1 : DeltaTime` and the
multiplier, and Impulse sets `Fired=true`. The SAME tick the accumulator
applies the reset first, then sums PendingForce through
`InverseMass`/`InverseInertia` (angular world→local→world) — the reset always
lands immediately before the force. Exit restores nothing: momentum kept,
State lazily reset on the next activation's first clip edge,
`PhysicsForceRandom` never reset.

## THE LATCH/DETERMINISM MATRIX

Only the `default:` switch arm of `TryResolveDynamicDirection` reaches the
latch logic — deterministic modes never latch:

| directionMode | Latches? | latchDirection=true | latchDirection=false | Stationary/failure behavior |
|---|---|---|---|---|
| FixedVector | **never** | n/a — re-resolved through `ResolveSpaceVector` every fire (Self-space thrust follows live body rotation) | same | never fails |
| TowardTarget | **never** | n/a — re-aimed every fire (true homing for Continuous) | same | `distSq <= 1e-5f` → **defer** (returns false; overlap with target = no force) |
| AwayFromTarget | **never** | as Toward, negated | same | same defer |
| RandomSphere | yes | ONE `NextFloat3Direction()` draw per state-reset, held in `state.LatchedDirection` | re-rolls EVERY fire (Continuous = new direction every fixed step — noise thrust) | never fails |
| RandomCone | yes | ONE (az,el) pair (2 `NextFloat` draws), resolved through `ResolveSpaceVector`, held | re-rolls every fire, 2 draws per fire | never fails (elevation clamped to ±(π/2−0.01)) |
| AlongVelocity | yes | first MOVING tick's direction latched, then held even if velocity changes | re-derived from live velocity every fire | `!hasVelocity` or `speedSq <= 1e-8f` → **defer** |
| AgainstVelocity | yes | as Along, negated | same | same defer |

The latch block, verbatim:

```csharp
if (config.LatchDirection && state.DirectionLatched)
{
    direction = state.LatchedDirection;
    return true;
}
...
if (config.LatchDirection)
{
    state.DirectionLatched = true;
    state.LatchedDirection = direction;
}
```

**Latched values are post-resolve WORLD vectors**: for RandomCone,
`ResolveSpaceVector` runs BEFORE latching, so a latched Self-space cone
direction does NOT follow later body rotation (contrast FixedVector+Self,
re-rotated every fire). **Re-latch = lazy reset**: DirectionLatched is cleared
only on the next activation's first clip edge (see the trap below —
effectively once per TIMELINE activation per binding).

**Seed mechanics** (`NextRandom`, verbatim):

```csharp
var rng = hasRandom ? randoms[i].Value : default;
if (rng.state == 0)
{
    rng = Random.CreateFromIndex(math.hash(new uint3(seed, (uint)body.Index, (uint)body.Version)));
    if (rng.state == 0) rng.state = 0x6E624EB7;
}
```

Deterministic per `(seed, entity.Index, entity.Version)`; the `0x6E624EB7`
sentinel guards the astronomically-unlikely zero hash (zero state doubles as
the "not yet seeded" marker); the first random fire after subscene load
lazily seeds the stream, which then only ever advances.

**Stream persistence — the honest determinism story.** `PhysicsForceRandom` is
deliberately NOT in State and never reset: within a session, activations
consume the stream (run 1's scatter kick is draw pair #1, run 2's is pair #2 —
*different direction*). "Same seed → same kick" holds only for the n-th
activation across SESSIONS (fresh world → re-seed → identical sequence). A
`latchDirection=false` Continuous random clip advances the stream every fixed
step, leaving later random clips on the same body at a scrub-dependent cursor.
Determinism is **per-session-at-activation-index**: latching levers WITHIN an
activation, the seed ACROSS sessions, nothing across activations in-session.

## THE ONE-IMPULSE-PER-ACTIVATION TRAP

`Fired` is **binding-level**, cleared by `ResetStateTrackJob` only while
`ActiveForce` is disabled — which only `DisableStaleTrackJob` (TIMELINE
deactivation) ever does. With multiple force clips on one binding, only the
FIRST clip's edge sees a reset; later clips inherit the run's State verbatim:

- **Two impulse clips on one track = the first one only.** In ForceMastery, A
  (Impulse) sets `Fired=true`; at D's edge the reset is skipped, so
  `if (config.Mode == PhysicsForceMode.Impulse && state.Fired) continue;`
  blocks D — D's scatter kick never fires in the same timeline activation as
  A. N impulses on one binding are not achievable with this track alone:
  restart the timeline, or use PhysicsTriggerForce/Velocity tracks.
- Loop wraps are NOT activation edges: a looping Impulse clip stays `Fired` —
  the tooltip's "ignores Looping" is mechanically the Fired guard.
- Scrubbing back into an already-fired region re-fires nothing; a full
  stop+replay is a fresh activation and re-fires/re-latches.
- **Deferred impulses can fire OUTSIDE their clip window**: a defer never
  sets `Fired`, and `ActiveForce` stays enabled through gaps holding the last
  config — a stationary body's AlongVelocity impulse can land after its clip
  ends or in a gap, until the next clip overwrites Config or timeline end.
- `ResetApplied` (the reset's once-guard) shares Fired's binding lifecycle.

## Canonical recipes (verbatim from the report)

- **"Kick / knock-back NOW"**: Impulse + FixedVector, `linearForce` = mass ×
  desired Δv, `space=None` for a world direction (clip A). One per timeline
  activation per binding — the trap above.
- **Deterministic dash/launch (clip A)**: add `resetVelocityOnFire=Linear` —
  prior velocity is zeroed in the same tick immediately before the impulse
  lands, so the dash always travels the same distance, any prior motion.
- **"Rocket thrust while the clip runs" (clip B)**: Continuous + FixedVector +
  `space=Self` — force re-rotates with the body every fixed step. WARNING:
  thrust keeps running through gaps until another force clip overwrites the
  config or the timeline ends.
- **"Seek/home toward the cube" (clip C)**: Continuous + TowardTarget,
  `directionTarget=Target` (the body's `Targets.Target` slot must be set),
  `magnitude` = force in N. Re-aims every fixed step; overlapping the target
  safely defers. `AwayFromTarget` = same, negated (flee).
- **"Scatter upward" (clip D)**: Impulse + RandomCone, `space=None`,
  `coneElevationCenter=45°±15°`, `coneAzimuthHalfRange=180°` = any heading,
  30–60° up, `magnitude=10`. Seeded per (seed, entity): a debris crowd sharing
  one clip scatters differently per body, reproducibly per session.
- **"Brake against motion"**: Continuous + AgainstVelocity +
  `latchDirection=false` — a constant-magnitude retro-force that always
  opposes CURRENT velocity (contrast Drag's proportional decay). Latch=true
  would lock the brake direction to the first tick's motion.
- **Spin**: `angularForce` rides the same clip — both Linear and Angular go
  into ONE `PendingForce` element through inverse mass AND inverse inertia.
- **Stat-scaled kicks**: `strengthStat` + `readStatFrom` per the family chain;
  author ×100 (100 = ×1.0).

## Edge cases & traps (each source-quoted in the report, 2026-06)

- **DO know the units: Impulse = N·s, Continuous = N (Mass=1 walk)** —
  `timeScale = Impulse ? 1f : DeltaTime`, then
  `velocity.Linear += totalLinear * mass.InverseMass`. Clip A's Impulse
  (0,8,0) = 8 N·s → **Δv = 8 m/s upward, instantly, once** (apex ≈ v²/2g ≈
  3.26 m). Clip B's Continuous (0,0,5) = 5 N → 5×0.02 = 0.1 N·s per 50 Hz
  step → **a = 5 m/s², ≈ +10 m/s over the 2 s clip**.
- **DON'T expect a stationary AlongVelocity Impulse to fire on time — it
  WAITS** — `speedSq <= 1e-8f → return false` → `continue` → Fired never set;
  it retries every fixed step and fires on the first moving tick, possibly
  after the clip window (gaps hold Config). Toward/Away defer the same way at
  `distSq <= 1e-5f`; a body without `PhysicsVelocity` defers forever.
- **DON'T trust the stat without the early-gate walk** —
  `math.abs(multiplier) < 1e-5f → continue` resolves BEFORE direction, reset,
  and Fired: buffer-present-key-absent = silent dead force (PID-dead-motor
  symptom); **negative stats pass `math.abs` and INVERT the force** (contrast
  Drag's ≥0 clamp); a stat-dead Impulse is DEFERRED, not consumed — it fires
  if the stat goes nonzero (the random stream does not advance while gated).
- **DO pick the space frame deliberately** — `ResolveSpaceVector`'s three
  paths: `None` = raw world vector (NOT "no target" — inverted vs the Targets
  convention where `Get(None)=Null`, the Target.None two-meanings trap);
  `Self` skips the Targets lookup and rotates by the body's own orientation;
  any other Target resolves the slot's rotation (missing Targets/empty slot
  silently falls back to the body itself). `angularForce` uses the same frame.
- **DON'T treat gaps as neutral — the thrust keeps running** — family pattern
  5: nothing disables `ActiveForce` between clips; in ForceMastery B's 5 N
  thrust continues through the 3–4 s gap and C's seek through 6–7 s. A
  Continuous final clip pushes until timeline end.
- **DO rely on the velocity reset's ordering guarantees** — the request ORs
  into `PendingVelocityReset`; the accumulator applies resets STRICTLY BEFORE
  forces in the same job (`ApplyReset(...)` precedes `AccumulateForces(...)`),
  once per activation (`!state.ResetApplied`). Masks are whole linear/angular
  blocks (None/Linear/Angular/Both), not per-XYZ; the reset also erases what
  other tracks (PID, gravity history) put into velocity — by design.
- **DON'T overlap Continuous and Impulse clips** — the mixer lerps every
  numeric (forces, magnitude, cone fields) but SNAPS discrete fields at
  `s < 0.5f ? a : b`; the moment the blended mode becomes Impulse with Fired
  still false it fires with the half-blended force. `Add` sums numerics,
  keeps A's discrete fields/seed/Strength.
- **DO note the silence profile (family rule 7)** — Bake unconditional;
  unbound track → central-baker silent no-op. Clean console proves nothing.

## Verification protocol

1. **Fresh-load asset dump** (separate exec block; in-memory state is not
   evidence) — 4 clips:
   `A_LaunchUp 0-0.5 mode=Impulse dir=FixedVector linear=(0,8,0) space=None reset=Linear`,
   `B_ThrustForward 1-3 mode=Continuous dir=FixedVector linear=(0,0,5) space=Self`,
   `C_SeekCube 4-6 mode=Continuous dir=TowardTarget mag=6 dirTarget=Target`,
   `D_ScatterKick 7-7.5 mode=Impulse dir=RandomCone space=None mag=10 azH=180 elC=45 elH=15 seed=7 latch=True`;
   `caps=Looping|Blending`.
2. **Raw YAML** (degrees, not radians): A `mode: 1, directionMode: 0,
   linearForce: {x: 0, y: 8, z: 0}, space: 0, resetVelocityOnFire: 1`;
   B `mode: 0, space: 4, linearForce: {z: 5}`; C `mode: 0, directionMode: 1,
   magnitude: 6`; D `mode: 1, directionMode: 4, space: 0, magnitude: 10,
   coneAzimuthHalfRange: 180, coneElevationCenter: 45,
   coneElevationHalfRange: 15, seed: 7, latchDirection: 1`.
3. **Stage checks** — Stage_PhysicsBall: PhysicsBodyAuthoring Dynamic, Mass=1,
   Targets Target=Stage_Target, NO StatAuthoring.
4. **Binding from a RELOADED SubScene** — director table **19** entries,
   `BIND|18|ForceTrack (PhysicsForceTrack) -> Stage_PhysicsBall
   (PhysicsBodyAuthoring)` — `GetGenericBinding` returns the COMPONENT
   verbatim (rule 5k); prior 18 intact.
5. **Parent-scene restore** — sceneCount=1, `Assets/Scenes/Main
   Scene.unity|loaded=True|dirty=False`; director back to
   `Assets/Training/01-transform-position-track/PositionMastery.playable`.
6. **Console** — only known pre-existing entries (UnityCliConnector,
   PerformanceTesting, TestResults.xml, lessons 08–10 `[Worker2]` EntityLinks
   errors). Silence is expected, not evidence.
