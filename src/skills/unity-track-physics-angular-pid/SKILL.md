---
name: unity-track-physics-angular-pid
description: Master of PhysicsAngularPIDTrack + clip in vex-ee — a real physical rotation motor via PendingForce, blended PID configs, target-mode semantics, the stat-strength triple trap. Use when a designer asks "make this body physically turn toward / match a rotation with spring-damper feel".
---

# PhysicsAngularPIDTrack specialist

You are the specialist for **`PhysicsAngularPIDTrack`** and
**`PhysicsAngularPIDClip`** from `Packages/BovineLabs.Timeline.Physics`, ns
`BovineLabs.Timeline.Physics.Authoring.PIDs` — the FOURTH Physics-family
track, the FIRST bound to a **PhysicsBodyAuthoring component** (not a
GameObject). While a clip is active, a PID controller computes a
shortest-path axis-angle error toward a goal derived per
`PidAngularTargetMode` and appends `torque × dt` into the body's
`PendingForce` buffer — a real physical motor through mass/inertia, NEVER a
direct `PhysicsVelocity` or transform write. NO capture/restore exists: at
timeline end the controller is disabled and the body keeps its momentum.

**Family patterns live in `unity-track-physics-filter-override`** ("PHYSICS
FAMILY SHARED PATTERNS": two-system split, producer/modifier groups, central
`PhysicsTimelineBakingSystem`, timeline-activation scope, silence profile).
Cite them; don't re-derive. This track's distinctions:

1. **Shared apply system** — ONE `PhysicsPidApplySystem`
   (`PhysicsProducerGroup`, `[UpdateAfter(PhysicsKinematicsApplySystem)]`,
   BEFORE the physics step) hosts BOTH `AppendLinearJob` and
   `AppendAngularJob` — the family's only track pair sharing an apply system.
2. **REAL blending** — `ClipCaps.Blending | Looping`, `ClipWeight` baked,
   `PhysicsAngularPIDMixer` is genuine math (contrast Filter/Kinematic's
   dead `DiscreteMixer`).
3. **No State.Original** — nothing restored on exit; PID hands momentum back
   to physics (contrast Filter/Gravity/Kinematic's capture/restore).

**This skill carries the SHARED PID CORE for topic 19 (LinearPID)** — see
below. Topic 19 differs ONLY in: error = position delta (plain subtraction,
no quaternion math), its own `PidLinearTargetMode` (incl. `InitialLocal` and
`LineOfSight`), `TargetOffset` float3 instead of `TargetRotation`, and
`PendingForce.Linear` instead of `.Angular`.

All facts verified live in **vex-ee**, **2026-06** (reflection dumps,
package-source reads inside exec, raw YAML reads, fresh-load read-backs, all
via `unity-cli exec`); no play mode — runtime claims are source-derived.

## THE SHARED PID CORE (banked for topic 19 — LinearPID)

Literally shared source: `PidCore.cs` + `StatStrengthConfig.cs` in the Data
asm; `PhysicsMath.ComputePidForce` + `StatStrengthUtility.Resolve` in the
runtime asm.

**PidTuning** (verbatim, incl. the tuning-order comment):

```csharp
public struct PidTuning {
    public float3 Proportional;
    public float3 Derivative; // D before I — tune in this order
    public float3 Integral;
    public float MaxOutput;
}
```

**PidStateData + lifecycle**: `float3 IntegralAccumulator; float3
PreviousError; float3 CapturedTargetPosition; bool IsInitialized;`. Reset to
`default` by `ResetStateTrackJob` on clip-activation edges ONLY while the
Active component is disabled — back-to-back clips within one timeline
activation share accumulated state; a FRESH activation starts from a zeroed
controller. First tick (`IsInitialized==false`): `prevError = error` (zero
derivative — no kick), `integral = 0`. Exit: `DisableStaleTrackJob` disables
the Active bit at TIMELINE deactivation; State sits stale until the next
activation's reset; `PhysicsVelocity` is never restored.
`CapturedTargetPosition` is angular-unused plumbing (Linear's `InitialLocal`
locks the resolved target on first tick).

**ComputePidForce — the one true PID kernel** (condensed from the report's
verbatim quote): `deltaTime <= 0` → zero output, state unchanged.
`nextIntegral = ∫e + e·dt`; then **anti-windup**: `math.all(Ki <= 0)` →
accumulator HARD-ZEROED (pure PD, the "Rigid" preset); else clamped per-AXIS
to `±MaxOutput / max(Ki, 0.001)` — the I-term alone can never exceed
MaxOutput per axis (note the `math.all`: mixed gains take the clamp path).
`rawOutput = P·e + I·∫e + D·(e−prev)/dt`; then the **magnitude clamp** on
the vector norm (direction preserved, length capped at MaxOutput). Two
distinct clamps; do not conflate.

**Error math (angular)** — shortest-path axis-angle in radians:

```csharp
var delta = math.mul(target, math.conjugate(current));
var qPositive = math.select(q, -q, q.w < 0f);            // hemisphere fix
if (math.lengthsq(qPositive.xyz) < 1e-6f) return zero;   // zero-delta guard
var angle = 2.0f * math.acos(math.clamp(qPositive.w, -1f, 1f));
error = axis * angle;                                     // radians, |e| ≤ π
```

Max |error| is π — default P=10 tops the P-term out ~31, well under
MaxOutput=100; the cap matters mostly for D spikes and high-gain presets.

**Output → PendingForce, drained SAME tick through inertia** (quoted):

```csharp
torque *= config.Strength * multiplier;
if (math.lengthsq(torque) > 1e-5f)                        // micro-force skip
    pendingForces[i].Add(new PendingForce { Angular = torque * DeltaTime });
```

`PhysicsProducerForceAccumulatorSystem` (end of PhysicsProducerGroup,
explicitly `[UpdateAfter(PhysicsPidApplySystem)]` — SAME tick, no add-path
latency) sums the buffer: world torque impulse → body-local for
`InverseInertia` → back to world into `PhysicsVelocity.Angular` (linear via
`InverseMass`). Additive with gravity, drag, collisions, and any other
PendingForce writer that frame.

**StatStrengthUtility.Resolve** — `StatStrengthConfig{StatKey Stat; Target
ReadFrom; ushort LinkKey}`, `IsEnabled() => Stat.Value != 0`. No schema
authored → 1; entity unresolvable → 1; no `Stat` buffer → 1; **buffer present
but key absent → `GetValueFloat` default 0 — silently kills the PID**. Value
is ×100-decoded (SlowMo authored 25 reads 0.25). `Targets.Get` maps `Self =>
self` even on a default struct, so `readStatFrom=Self` always hits the body.

## Prerequisites & environment

- Act only through `unity-cli exec` / `unity-cli console`; never touch
  vex-ee via the filesystem; never enter play mode. Follow the **unity-cli
  skill's Safe Loop**. Smoke test: scene path + `Application.dataPath` →
  `Assets/Scenes/Main Scene.unity|/home/i/GitHub/vex-ee/Assets`.
- The `TrainingStage` (unity-stage-foundations) must exist in SubScene
  `Assets/Scenes/Main Sub Scene.unity`. Binding target: **Stage_PhysicsBall's
  `PhysicsBodyAuthoring` COMPONENT** (rule 5k: `SetGenericBinding` never
  coerces — pass the component; the baker coerces component→entity, so
  runtime equals lessons 15–17's GameObject bindings). Stage_PhysicsBall has
  a **`Targets` component with Target=Stage_Target** (TargetsAuthoring) — the
  slot `trackingTarget` reads — and **NO StatAuthoring** (clip C's trap
  exhibit).
- Your assets live only under `Assets/Training/18-physics-angular-pid-track/`.
  Canonical asset: `AngularPIDMastery.playable` — one track `AngularPIDTrack`,
  clips A_World90Yaw (0–3s, mode=World, euler=(0,90,0), tracking=None),
  B_LookAtTarget (4–7s, mode=LookAtTarget, tracking=Target, strength=2),
  C_StatDriven (8–10s, mode=MatchTarget, tracking=Target,
  strengthStat=SlowMo(key=94), readStatFrom=Self — the stat-trap exhibit).
  Director table holds **16** entries with this binding as the 16th.

## VERIFIED facts (vex-ee, 2026-06)

| Type | Facts |
|---|---|
| `PhysicsAngularPIDTrack` | ns `...Physics.Authoring.PIDs`, asm `...Physics.Authoring`, base `DOTSTrack`, EMPTY body. `[TrackClipType(typeof(PhysicsAngularPIDClip))]`, `[TrackColor(0.9,0.4,0.4)]`, **`[TrackBindingType(typeof(Unity.Physics.Authoring.PhysicsBodyAuthoring))]`**, `[DisplayName("BovineLabs/Physics/Angular PID")]`. |
| `PhysicsAngularPIDClip` | base `DOTSClip`, `ITimelineClipAsset`, **`clipCaps => ClipCaps.Blending \| ClipCaps.Looping`**, `duration => 1` (seed only). |
| `PhysicsAngularPIDData` | `PidTuning Tuning; Target TrackingTarget; PidAngularTargetMode TargetMode; quaternion TargetRotation; float Strength; StatStrengthConfig StrengthStat;` |
| `PhysicsAngularPIDAnimated` | `IAnimatedComponent<PhysicsAngularPIDData>` — `AuthoredData` + `Value`, CLIP entity. |
| `ActiveAngularPid` | IComponentData + **IEnableableComponent**: `PhysicsAngularPIDData Config` — BINDING entity, added DISABLED at bake. **Lowercase "Pid"** (vs "PID" everywhere else) — fully-qualify in exec snippets. |
| `PhysicsAngularPIDState` | `PidStateData State` — binding entity. |
| `PendingForce` | `[InternalBufferCapacity(0)]` IBufferElementData: `float3 Linear; float3 Angular;` |
| Systems | `PhysicsAngularPIDTrackSystem` (`TimelineComponentAnimationGroup`, `[UpdateAfter(PhysicsLinearPIDTrackSystem)]`, `[UpdateAfter(EntityLinkTargetPatchSystem)]`); **shared `PhysicsPidApplySystem`** (`PhysicsProducerGroup`, after KinematicsApply, BEFORE the step); `PhysicsProducerForceAccumulatorSystem` drains same tick. |

### Clip fields — camelCase, defaults from a fresh instance (reflection)

| Field | Type | Default | Meaning |
|---|---|---|---|
| `uniformAxes` | bool | `True` | EDITOR-ONLY sugar: one float drives X=Y=Z per gain. Not baked. |
| `tuning` | PidTuning | P=(10,10,10) D=(1,1,1) I=(2,2,2) MaxOutput=100 | Per-axis gains + output cap. Matches NO preset — underdamped vs "Balanced", integral-heavier. |
| `trackingTarget` | Target | `Target(1)` | Which `Targets` slot ON THE BODY names the target entity. |
| `targetMode` | PidAngularTargetMode | `LookAtTarget(1)` | How the goal rotation is derived. |
| `targetRotationEuler` | Vector3 | `(0,0,0)` | Euler **DEGREES**; baked `quaternion.Euler(math.radians(...))`. World mode: absolute; all other modes: a post-multiplied OFFSET. |
| `strength` | float | `1` `[Min(0)]` | "Output force multiplier. 0 = no effect, 1 = full, 2 = double." |
| `strengthStat` | StatSchemaObject | `null` | Optional ×100-fixed-point stat MULTIPLIER. |
| `readStatFrom` | Target | `Self(4)` | Whose stat buffer (resolved via the BODY's Targets). |
| `readStatLink` | EntityLinkSchema | `null` | Optional link override for the stat-entity hunt. |

Enums (Enum.GetValues, live): `PidAngularTargetMode`: **`MatchTarget=0,
LookAtTarget=1, World=2, FleeFromTarget=3, MatchTargetOpposite=4`**.
`Target` (Reaction, byte): `None=0, Target=1, Owner=2, Source=3, Self=4,
Custom=6`. YAML: enums as ints, euler in authored DEGREES, tuning as nested
float3 blocks, strengthStat as a normal asset→asset ref. Bake is
unconditional and totally SILENT (family pattern 7); the central
`PhysicsTimelineBakingSystem` (`Entity.Null` continue when unbound) adds
`ActiveAngularPid`(disabled) + `PhysicsAngularPIDState` + `PendingForce`/
`PendingVelocity` buffers + disabled `PendingVelocityReset`.

### Target resolution (quoted) — the mode table + self-fallback

```csharp
if (config.TrackingTarget != Target.None && targetsLookup.TryGetComponent(entity, out var targets))
    targetEntity = targets.Get(config.TrackingTarget, entity);
if (!hasTargetTransform) { targetPos = selfPos; targetRot = selfRot; }   // FALLBACK TO SELF
targetRotation = config.TargetMode switch {
    MatchTarget         => math.mul(targetRot, config.TargetRotation),
    LookAtTarget        => ResolveLookAtTarget(selfPos, targetPos, selfRot, config.TargetRotation),
    World               => config.TargetRotation,
    FleeFromTarget      => ResolveLookAtTarget(selfPos, selfPos + (selfPos - targetPos), selfRot, config.TargetRotation),
    MatchTargetOpposite => math.mul(math.mul(targetRot, quaternion.AxisAngle(math.up(), math.PI)), config.TargetRotation),
    _ => selfRot };                                                       // unknown mode => zero error
```

LookAt uses **`LookRotationSafe`** (no NaN poisoning — contrast lesson 03).
`None` short-circuits BEFORE the Targets lookup (World's natural pairing).

## Canonical recipes (verbatim from the report)

- **"Physically turn to face the cube during the clip"**: Angular PID track
  ("BovineLabs/Physics/Angular PID") bound to the body's PhysicsBodyAuthoring;
  clip targetMode=LookAtTarget, trackingTarget=Target (the body's
  `Targets.Target` slot must point at the cube — set via TargetsAuthoring or
  retarget mid-timeline with an EntityLinkTargetPatch clip, whose system is
  explicitly ordered before this track's). Start from "Balanced" (P10 D3 I1
  Max100); raise P for urgency, then D to kill wobble. strength=2 doubles the
  authored output (clip B).
- **"Match the platform's orientation (ride alignment)"**:
  targetMode=MatchTarget, trackingTarget=Target; targetRotationEuler as a
  deliberate offset if the meshes' forward axes disagree. MatchTargetOpposite
  = same but 180°-yawed (face-off pattern).
- **"Settle at exactly 90° yaw, world space"**: targetMode=World,
  targetRotationEuler=(0,90,0), trackingTarget=None (clip A). No Targets
  needed at all.
- **"Turn away / cower from the threat"**: targetMode=FleeFromTarget —
  look-at the mirror point `self + (self − target)`; same up-righting caveat
  as LookAt.
- **"Stat-scaled turning (buff/debuff turn rate)"**: strengthStat=<schema>,
  readStatFrom pointing at an entity that ACTUALLY CARRIES a Stat buffer WITH
  that key (StatAuthoring + StatDefaults entry — recipe in
  unity-track-timeline-timescale). Author the default in ×100 (100 = ×1.0).
  Avoid readStatFrom=Self unless the bound body itself has stats.
- **Ending crisp**: a PID clip ending leaves spin — follow with a
  VelocityClamp clip, or accept the physical handoff.

**Tuning doctrine** — order **P, then D, then I** ("D before I — tune in
this order"). Tooltips, verbatim: P "How hard the controller pushes. Raise
until it reaches the goal." D "Kills oscillation. Raise after P until
stable. Too high = sluggish." I "Only add if the entity stalls short of the
goal. Too high = slow oscillation." MaxOutput "Hard cap on output each
frame. Prevents explosive behaviour." `PidEditorUtility` presets:

| Preset | Description | P | D | I | Max |
|---|---|---|---|---|---|
| Snappy | Fast with slight overshoot | 20 | 4 | 0.5 | 200 |
| Balanced | Smooth, no overshoot | 10 | 3 | 1 | 100 |
| Floaty | Gentle, large overshoot | 4 | 0.5 | 0.2 | 40 |
| Heavy | High force, well-damped | 30 | 10 | 1 | 400 |
| Precise | Slow but kills drift | 8 | 4 | 5 | 80 |
| Rigid | Near-kinematic feel | 60 | 20 | 0 | 1000 |

## Edge cases & traps (each source-proven, 2026-06)

- **DON'T read fallback-to-self as one behavior — it is MODE-DEPENDENT** —
  quoted `ResolveAngularPidTarget`: unresolvable target silently sets
  goal-from-self, no log; MatchTarget+identity-offset = true quiet no-op
  (zero error → guard → micro-skip), MatchTarget+non-identity offset = the
  body **chases its own offset forever** (constant error off the new self
  each tick), LookAtTarget = `LookRotationSafe` re-derives up so a rolled
  body gets an **up-righting torque**, World = fallback INVISIBLE
  (targetRot unused — identical with or without a target).
- **DO triage "PID does nothing" as a lost target** — check the BODY
  entity's `Targets` component (read on the BINDING, not the director, not
  via readRootFrom like the EntityLinks family).
- **DON'T trust the stat multiplier without walking the THREE-layer trap** —
  quoted `Resolve`: body has no Stat buffer → multiplier silently **1** (clip
  C behaves as a constant, no warning); buffer exists → value is ×100-decoded
  so SlowMo=25 means **×0.25, not ×25** (author 200 for double); buffer
  present but key ABSENT → `GetValueFloat` returns **0** → `torque *= strength
  × 0` — PID silently dead (rule 5j's buffer-vs-key trap, in force form).
- **DO expect REAL blending — one controller, never two** — quoted
  `WriteActiveJob`: overlap blends at CONFIG level through
  `PhysicsAngularPIDMixer` (Lerp: goal **slerped**, tuning/strength
  **lerped**, TrackingTarget/TargetMode/StrengthStat **snap at s=0.5**; Add:
  gains/strength summed, quaternion log/exp rotation sum) — the apply system
  still consumes ONE blended `ActiveAngularPid.Config`, one `PidStateData`.
- **DON'T treat gaps or exit as neutral** — family pattern 5: between clips
  the last Config keeps seeking (the ball chases World-90° through the 3–4s
  gap); at timeline end `DisableStaleTrackJob` merely disables the bit —
  **momentum survives** (pair with VelocityClamp or a Kinematic freeze if
  the spin must die at the cut).
- **DO know tiny outputs vanish** — the `lengthsq(torque) > 1e-5f`
  micro-force skip + 1e-6 zero-delta guard: a near-settled body appends nothing.
- **DON'T expect `uniformAxes` at runtime — authoring sugar only** — absent
  from `PhysicsAngularPIDData`; `PidEditorUtility.DrawGain` writes
  `SetFloat3(prop, v, v, v)` when ticked; script-set uneven gains bake
  verbatim until the inspector flattens them.
- **DO note the silence profile (family rule 7, fully silent)** — no guard
  or LogError in Bake; null strengthStat → `IsEnabled()==false` → harmless;
  unbound track → central-baker continue. Clean console proves nothing.

## Verification protocol

1. **Fresh-load asset dump** (separate exec block; in-memory state after a
   save is not evidence) — 3 clips:
   `A_World90Yaw 0-3 mode=World tracking=None euler=(0,90,0) strength=1`,
   `B_LookAtTarget 4-7 mode=LookAtTarget tracking=Target strength=2`,
   `C_StatDriven 8-10 mode=MatchTarget tracking=Target strengthStat=SlowMo(key=94) readStatFrom=Self`;
   all `caps=Blending|Looping`, default tuning P=(10,10,10) D=(1,1,1) I=(2,2,2) Max=100.
2. **Raw YAML** — enums as ints (`targetMode: 2`/`trackingTarget: 0` on A;
   `targetMode: 1`/`strength: 2` on B; `targetMode: 0`/`readStatFrom: 4` +
   strengthStat asset ref on C); `targetRotationEuler: {x: 0, y: 90, z: 0}`
   in DEGREES; `m_BlendInDuration: -1` everywhere (no overlap authored).
3. **Stage checks** — Stage_PhysicsBall has `PhysicsBodyAuthoring` and a
   Targets slot Target=Stage_Target; NO StatAuthoring (clip C's layer-1 trap
   stays live).
4. **Binding from a RELOADED SubScene** — director table **16** entries,
   #16 = `AngularPIDTrack (PhysicsAngularPIDTrack) → Stage_PhysicsBall
   (PhysicsBodyAuthoring)` — `GetGenericBinding` returns the COMPONENT
   verbatim (rule 5k); prior 15 intact.
5. **Parent-scene restore** — sceneCount=1, `Assets/Scenes/Main
   Scene.unity|loaded=True|dirty=False`; director back to
   `Assets/Training/01-transform-position-track/PositionMastery.playable`.
6. **Console** — only known pre-existing entries (UnityCliConnector HTTP
   start, PerformanceTesting setup/cleanup, TestResults.xml, lessons 08–10
   `[Worker2]` EntityLinks errors). Silence is expected, not evidence
   (family pattern 7).
