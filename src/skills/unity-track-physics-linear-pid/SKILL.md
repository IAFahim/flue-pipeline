---
name: unity-track-physics-linear-pid
description: Master of PhysicsLinearPIDTrack + clip in vex-ee — a physical position motor with five target modes, the InitialLocal per-activation capture trap, offset-dependent fallback self-chase. Use when a designer asks "make this body physically fly to / hover at / follow / flee a point".
---

# PhysicsLinearPIDTrack specialist

You are the specialist for **`PhysicsLinearPIDTrack`** and
**`PhysicsLinearPIDClip`** from `Packages/BovineLabs.Timeline.Physics`, ns
`BovineLabs.Timeline.Physics.Authoring.PIDs` — the Physics-family track bound
to a **PhysicsBodyAuthoring component**. While a clip is active, a PID
controller computes `error = targetPos − selfPos` (plain float3 subtraction,
UNBOUNDED magnitude — no quaternion math) toward a goal derived per
`PidLinearTargetMode` and appends `force × dt` into **`PendingForce.Linear`**,
drained the SAME tick through **InverseMass** into `PhysicsVelocity.Linear`
(the stage ball's Mass=1 → force ≈ accel) — a real physical motor, never a
transform write. No capture/restore: at timeline end the controller is
disabled and the body keeps its momentum.

**The SHARED PID CORE lives in `unity-track-physics-angular-pid`** —
PidTuning, the `ComputePidForce` anti-windup kernel, `PidStateData`
lifecycle, `PendingForce` drain, `StatStrengthUtility.Resolve` (the stat
triple trap), tuning doctrine + presets. Family patterns (two-system split,
producer groups, silence profile) live in
`unity-track-physics-filter-override`. Cite both; don't re-derive. **This
skill owns the FIVE-MODE MATRIX** and the Linear-vs-Angular deltas:

| Aspect | Linear (this skill) | Angular (banked, topic 18) |
|---|---|---|
| Error space | `targetPos − selfPos`, plain float3, UNBOUNDED | shortest-path axis-angle, \|e\| ≤ π |
| Goal field | `float3 TargetOffset` (offset OR absolute world pos) | `quaternion TargetRotation` |
| Mode set | TargetLocal / InitialLocal / LineOfSight / World / FleeFromTarget | MatchTarget / LookAtTarget / World / FleeFromTarget / MatchTargetOpposite |
| Snapshot mode | **InitialLocal uses `CapturedTargetPosition`** | none — that field is unused plumbing |
| Output channel | `PendingForce{Linear = force×dt}` | `PendingForce{Angular = torque×dt}` |
| Drain | world impulse × **InverseMass** → `PhysicsVelocity.Linear` | world→body-local × **InverseInertia** → `.Angular` |
| Mixer Add | **dominant config by higher Strength carries enums** (tie → lower mode byte); offsets/gains summed | gains summed; rotation via quaternion log/exp sum |
| Saturation | error grows without bound → P easily saturates MaxOutput (Flee guarantees it) | P tops out at P·π (~31 at default) |

All facts verified live in **vex-ee**, **2026-06** (reflection dumps,
package-source reads inside exec, raw YAML reads, fresh-load read-backs,
**direct numeric invocation of the shipped kernel/mixer** — public statics,
no play mode), all via `unity-cli exec`.

## Prerequisites & environment

- Act only through `unity-cli exec` / `unity-cli console`; never touch
  vex-ee via the filesystem; never enter play mode. Follow the **unity-cli
  skill's Safe Loop**. Smoke test: scene path + `Application.dataPath` →
  `Assets/Scenes/Main Scene.unity|/home/i/GitHub/vex-ee/Assets`.
- The `TrainingStage` (unity-stage-foundations) must exist in SubScene
  `Assets/Scenes/Main Sub Scene.unity`. Binding target: **Stage_PhysicsBall's
  `PhysicsBodyAuthoring` COMPONENT** (rule 5k: `SetGenericBinding` never
  coerces — pass the component; the baker coerces component→entity).
  Stage_PhysicsBall: pos (0,1,5), Dynamic, Mass=1, ForceUnique=True,
  `Targets.Target=Stage_Target`, **NO StatAuthoring** (the stat-trap exhibit
  stays live).
- Your assets live only under
  `Assets/Training/19-physics-linear-pid-track/`. Canonical asset:
  `LinearPIDMastery.playable` — one track `LinearPIDTrack`, clips
  A_HoverAtPoint (0–3s, mode=World, offset=(0,3,5), tracking=None),
  B_FollowCubeAbove (4–7s, mode=TargetLocal, tracking=Target,
  offset=(0,2,0)), C_SnapshotGoal (8–10s, mode=InitialLocal,
  tracking=Target, offset=(0,2,0) — kept deliberately as the TRAP exhibit:
  after A/B it seeks the stale snapshot, see below), D_Flee (11–12s,
  mode=FleeFromTarget, tracking=Target). Director table holds **17** entries
  with this binding as the 17th.

## VERIFIED facts (vex-ee, 2026-06)

| Type | Facts |
|---|---|
| `PhysicsLinearPIDTrack` | ns `...Physics.Authoring.PIDs`, asm `...Physics.Authoring`, base `DOTSTrack`, EMPTY body. `[TrackClipType(typeof(PhysicsLinearPIDClip))]`, `[TrackColor(0.9,0.2,0.4)]`, **`[TrackBindingType(typeof(Unity.Physics.Authoring.PhysicsBodyAuthoring))]`**, `[DisplayName("BovineLabs/Physics/Linear PID")]`. |
| `PhysicsLinearPIDClip` | base `DOTSClip`, `ITimelineClipAsset`, **`clipCaps => ClipCaps.Blending \| ClipCaps.Looping`**, `duration => 1` (seed only). Bake: unconditional, SILENT — `PhysicsLinearPIDBuilder.ApplyTo`; null `readStatLink` → LinkKey 0; null `strengthStat` → default StatKey (`IsEnabled()==false` → multiplier 1). |
| `PhysicsLinearPIDData` | `PidTuning Tuning; Target TrackingTarget; PidLinearTargetMode TargetMode; float3 TargetOffset; float Strength; StatStrengthConfig StrengthStat;` — TargetOffset doc: "In World mode, this acts as the absolute world position. In Offset mode, it is an offset from the tracking target." |
| `PhysicsLinearPIDAnimated` | `IAnimatedComponent<PhysicsLinearPIDData>` — `AuthoredData` + `Value`, CLIP entity. |
| `ActiveLinearPid` | IComponentData + **IEnableableComponent**: `PhysicsLinearPIDData Config` — BINDING entity, added DISABLED at bake. **Lowercase "Pid"** (confirmed live: `BovineLabs.Timeline.Physics.ActiveLinearPid`) — fully-qualify in exec snippets. |
| `PhysicsLinearPIDState` | `PidStateData State` — binding entity; comment on `CapturedTargetPosition`: "InitialLocal mode: locked on first tick". |
| Systems | `PhysicsLinearPIDTrackSystem` (`TimelineComponentAnimationGroup`, `[UpdateAfter(EntityLinkTargetPatchSystem)]`; the ANGULAR track system is `[UpdateAfter(...)]` THIS one — Linear runs first); shared **`PhysicsPidApplySystem`** (`PhysicsProducerGroup`, after KinematicsApply, BEFORE the step) hosts `AppendLinearJob`; `PhysicsProducerForceAccumulatorSystem` drains SAME tick. |

### Clip fields — camelCase, defaults from a fresh instance (reflection)

| Field | Type | Default | Meaning |
|---|---|---|---|
| `uniformAxes` | bool | `True` | EDITOR-ONLY sugar: one float drives X=Y=Z per gain. Not baked. |
| `tuning` | PidTuning | P=(10,10,10) D=(1,1,1) I=(2,2,2) Max=100 | Same non-preset default as Angular — integral-heavy/underdamped vs "Balanced". |
| `trackingTarget` | Target | `Target(1)` | Which `Targets` slot ON THE BODY names the target entity. |
| `targetMode` | PidLinearTargetMode | `TargetLocal(0)` | Goal derivation (matrix below). |
| `targetOffset` | Vector3 | `(0,0,0)` | Target-frame offset / sight-line offset / **absolute world goal in World mode**. |
| `strength` | float | `1` `[Min(0)]` | "Output force multiplier. 0 = no effect, 1 = full, 2 = double." |
| `strengthStat` | StatSchemaObject | `null` | Optional ×100-fixed-point stat MULTIPLIER. |
| `readStatFrom` | Target | `Self(4)` | Whose stat buffer (resolved via the BODY's Targets). |
| `readStatLink` | EntityLinkSchema | `null` | Optional link override for the stat-entity hunt. |

Enum (live `Enum.GetValues`): `PidLinearTargetMode : byte` = **`TargetLocal=0,
InitialLocal=1, LineOfSight=2, World=3, FleeFromTarget=4`**. YAML: enums as
ints, `targetOffset` as a Vector3 block, `strengthStat: {fileID: 0}` when
null, `m_BlendInDuration: -1` when no overlap authored.

## THE FIVE-MODE MATRIX (this skill's headline)

`PhysicsMath.ResolveLinearPidTarget`, quoted: unresolvable/missing target →
`targetPos = selfPos; targetRot = selfRot;` (THE FALLBACK, silent), then

```csharp
targetPosition = config.TargetMode switch {
    TargetLocal or InitialLocal => targetPos + math.rotate(targetRot, config.TargetOffset),
    LineOfSight                 => ResolveLineOfSight(selfPos, targetPos, selfRot, config.TargetOffset),
    World                       => config.TargetOffset,
    FleeFromTarget              => selfPos + (selfPos - targetPos),
    _ => selfPos };                                    // unknown mode => zero error
```

`ResolveLineOfSight`: `dir = lengthsq(target−self) > 1e-5 ? normalize(diff) :
mul(selfRot, forward())`; `rot = LookRotationSafe(dir, up())`; goal =
`targetPos + rotate(rot, offset)` — the offset hangs off the TARGET, oriented
along the sight line (offset.z negative stops short: "keep distance" mode).

| Mode (byte) | Goal (target resolved) | Fallback verdict (target := SELF) |
|---|---|---|
| `TargetLocal=0` | `targetPos + rotate(targetRot, offset)` — moves WITH the target, offset in the TARGET's rotating frame | offset=0 → true no-op; **offset≠0 → chases its own offset FOREVER** (constant self-relative error re-derived each tick — linear twin of Angular's MatchTarget+offset trap). |
| `InitialLocal=1` | same formula, captured ONCE into `State.CapturedTargetPosition` on the first uninitialized tick; frozen thereafter | **Captures SELF(+offset) as the frozen goal** — offset=0 settles in place; offset≠0 converges to a frozen world point near where it stood. The least-bad fallback of the target-relative modes (it FREEZES self+offset instead of chasing). |
| `LineOfSight=2` | `targetPos + rotate(LookRotationSafe(normalize(target−self), up), offset)` | diff=0 → dir = self forward; offset=0 → no-op; **offset≠0 → perpetual chase in its own forward-aligned frame** (yaw/pitch only — roll discarded by `LookRotationSafe`). |
| `World=3` | `config.TargetOffset` **IS the absolute world goal** (field doubles as the position — name clips accordingly) | **Fallback-blind / immune** — targetPos/targetRot unused; identical with or without a target. Pair with `trackingTarget=None` (short-circuits before the Targets lookup). |
| `FleeFromTarget=4` | `selfPos + (selfPos − targetPos)` — reflected point, recomputed EVERY tick → goal recedes → **never converges, by design** | `self + (self−self) = self` → error 0 → **true no-op** — the only target-relative mode safely inert on a lost target regardless of offset (offset is IGNORED by this branch entirely). |

The fallback substitutes self BEFORE the offset math, so any nonzero offset
turns a lost target into a perpetual self-chase force — silently, no log.
Triage "ball drifts steadily during a PID clip" as a lost Targets slot, not
as gravity.

## THE INITIALLOCAL TRAP (per-activation capture, not per-clip)

Capture site, quoted from `PhysicsPidApplySystem.AppendLinearJob`:

```csharp
if (config.TargetMode == PidLinearTargetMode.InitialLocal) {
    if (!state.State.IsInitialized)
        state.State.CapturedTargetPosition = resolvedTargetPos;   // capture ONCE
    targetPos = state.State.CapturedTargetPosition;               // frozen goal
}
// ... nextState.CapturedTargetPosition = capturedPos;  // re-threaded every tick
```

The gate is **`IsInitialized`** — which `ComputePidForce` sets `true` on the
first tick of ANY mode. The only reset is `ResetStateTrackJob`, which fires
on clip-activation edges but is **gated on `ActiveLinearPid` being
DISABLED** — and within one timeline activation the Active bit stays enabled
from the first PID clip's first frame until timeline end. Consequences:

1. **InitialLocal as the FIRST PID clip of an activation**: reset ran on its
   edge (Active still disabled — WriteActiveJob's enable is a BeginSimulation
   ECB, one frame later) → `IsInitialized=false` → first apply tick captures
   → frozen for the clip. **Works as advertised.**
2. **InitialLocal AFTER another PID clip in the same activation** (clip C in
   LinearPIDMastery, after A and B): activation edge finds Active ENABLED →
   reset blocked → `IsInitialized` true since clip A's first tick → **capture
   NEVER happens** → the body seeks the stale `CapturedTargetPosition` =
   **`float3.zero` — WORLD ORIGIN**, silently. (If an earlier InitialLocal
   clip captured this activation, the later one reuses THAT stale snapshot.)
   Want a true "freeze where the target was at THIS clip's start"
   mid-timeline? Put the InitialLocal clip on its own timeline activation —
   **snapshot clips go FIRST**.
3. **Exit/re-run**: timeline end disables Active; State sits STALE (capture
   included). The NEXT activation's first clip edge finds Active disabled →
   reset to default → **re-runs re-capture**. State zeroes lazily on the next
   activation edge, never at exit.
4. **Blend-snap interaction**: TargetMode snaps at s=0.5 in the mixer; a
   mid-overlap snap INTO InitialLocal cannot capture (IsInitialized long
   true) → the goal teleports to the stale snapshot at the blend midpoint.

## Canonical recipes (verbatim from the report)

- **"Hover at / fly to a fixed point"**: mode=World, `targetOffset` = the
  absolute world position (NAME the clip after the point — the field is
  overloaded), trackingTarget=None. Works with zero Targets setup;
  fallback-immune.
- **"Follow N units above/behind the thing"**: mode=TargetLocal,
  trackingTarget=Target (body's `Targets.Target` slot must point at the
  thing), offset in the TARGET's local frame — a rotating target SWINGS the
  goal around it (offset (0,0,-2) = trail behind its tail). Retarget
  mid-timeline via EntityLinkTargetPatch (its system is explicitly ordered
  before this track's).
- **"Move to where it WAS (snapshot)"**: mode=InitialLocal — but ONLY as the
  first PID clip of a timeline activation (capture gate above). Offset
  applies in the target's frame AT CAPTURE TIME, then the goal is a frozen
  world point.
- **"Keep the target at arm's length on the sight line"**: mode=LineOfSight,
  offset.z negative to stop short of the target / positive to overshoot past
  it; offset is oriented by `LookRotationSafe(target−self)` — yaw/pitch
  frame, roll discarded.
- **"Shove it away from the threat"**: mode=FleeFromTarget (offset ignored)
  — constant MaxOutput-saturated push; clamp speed with VelocityClamp or
  keep the clip short.
- **"Stat-scaled thrust"**: strengthStat=<schema>, readStatFrom at an entity
  that ACTUALLY carries the stat key (StatAuthoring + StatDefaults, ×100:
  author 200 for double) — walk the triple trap first.
- **Tuning**: shared presets and P → D → I doctrine in the angular skill.
  Default clip tuning (P10 D1 I2) is integral-heavy/underdamped vs Balanced
  — expect overshoot; for crisp arrivals start from Balanced (10/3/1/100).
- **Ending crisp**: a Linear PID clip ending leaves linear momentum — follow
  with VelocityClamp or accept the physical handoff.

## Edge cases & traps (each source-proven or numerically confirmed, 2026-06)

- **DON'T read fallback-to-self as one behavior — it is MODE- AND
  OFFSET-DEPENDENT** — quoted matrix above: World immune, Flee true no-op,
  TargetLocal/LineOfSight perpetual self-chase at offset≠0, InitialLocal
  freezes self+offset. Silent, no log.
- **DO expect REAL blending — and know the Linear Add rule differs from
  Angular** — `PhysicsLinearPIDMixer`, quoted + numerically confirmed:
  `Lerp` lerps Tuning/TargetOffset/Strength component-wise;
  TrackingTarget/TargetMode/StrengthStat snap `s < 0.5f ? a : b` (at exactly
  0.5, **b wins** — confirmed s=0.49/0.50/0.51); `Add` elects a **dominant**
  config by higher Strength (tie → lower TargetMode byte) whose
  enums/StrengthStat carry, while offsets/gains/Strength are SUMMED
  (Angular's Add instead sums rotation via quaternion log/exp).
- **DON'T blend two MODES and expect a smooth goal** — the goal formula
  switches species at s=0.5, so the goal position TELEPORTS at the blend
  midpoint (D-term spikes one tick); same-mode overlaps blend genuinely
  smoothly via the offset lerp.
- **DON'T expect Flee to converge** — goal `self+(self−target)` recomputed
  per tick; error magnitude = distance-to-target and GROWS as it flees →
  P-term saturates MaxOutput → constant max force until drag/collision
  stops it — pair with VelocityClamp for a terminal speed.
- **DON'T trust the stat multiplier without walking the THREE-layer trap**
  (banked in the angular skill, applies verbatim): no Stat buffer →
  multiplier silently 1; buffer present → ×100-decoded (authored 25 =
  ×0.25); buffer present but KEY absent → `GetValueFloat` 0 →
  `force *= strength × 0` — PID silently dead. Stage_PhysicsBall has NO
  StatAuthoring, so `readStatFrom=Self` + any schema lands on layer 1 today.
- **DO trust the kernel numerics — invoked directly**: first tick
  error=(1,0,0) dt=0.02 default tuning → out=(10.04,0,0), prevErr=error
  (ZERO D-kick); error=(100,0,0) → out clamped to len=100 (magnitude clamp
  at MaxOutput); I=0 → IntegralAccumulator hard-zeroed (`math.all(I≤0)` pure
  PD); dt=0 → out=(0,0,0), state untouched; CapturedTargetPosition=(7,8,9)
  survives `ComputePidForce` unchanged (the kernel preserves the snapshot).
- **DON'T treat gaps or exit as neutral** — family pattern 5: between clips
  the last Config keeps seeking (the ball keeps flying to A's World goal
  through the 3–4s gap); at timeline end `DisableStaleTrackJob` merely
  disables the bit — **momentum survives** (no restore path, no
  State.Original).
- **DO know tiny outputs vanish** — the `lengthsq(force) > 1e-5f`
  micro-force skip: a near-settled body appends nothing.
- **DO note the silence profile (family rule 7, fully silent)** — no guard
  or LogError in Bake; unbound track → central-baker continue. Clean console
  proves nothing.

## Verification protocol

1. **Fresh-load asset dump** (separate exec block; in-memory state after a
   save is not evidence) — 4 clips:
   `A_HoverAtPoint 0-3 mode=World(3) tracking=None(0) offset=(0,3,5)`,
   `B_FollowCubeAbove 4-7 mode=TargetLocal(0) tracking=Target(1) offset=(0,2,0)`,
   `C_SnapshotGoal 8-10 mode=InitialLocal(1) tracking=Target(1) offset=(0,2,0)`,
   `D_Flee 11-12 mode=FleeFromTarget(4) tracking=Target(1)`;
   all strength=1, `caps=Looping|Blending`, default tuning P=(10,10,10)
   D=(1,1,1) I=(2,2,2) Max=100, strengthStat=null.
2. **Raw YAML** — `targetMode: 3/0/1/4`, `trackingTarget: 0/1/1/1`,
   `targetOffset: {x:0,y:3,z:5}` etc., `readStatFrom: 4`,
   `strengthStat: {fileID: 0}`, `m_BlendInDuration: -1` everywhere.
3. **Stage checks** — Stage_PhysicsBall has `PhysicsBodyAuthoring`, Mass=1,
   ForceUnique=True, Targets slot Target=Stage_Target, NO StatAuthoring.
4. **Binding from a RELOADED SubScene** — director table **17** entries,
   #17 = `LinearPIDTrack (PhysicsLinearPIDTrack) → Stage_PhysicsBall
   (PhysicsBodyAuthoring)` — `GetGenericBinding` returns the COMPONENT
   verbatim (rule 5k); prior 16 intact.
5. **Parent-scene restore** — sceneCount=1, `Assets/Scenes/Main
   Scene.unity|loaded=True|dirty=False`; director back to
   `Assets/Training/01-transform-position-track/PositionMastery.playable`.
6. **Console** — only known pre-existing entries (UnityCliConnector HTTP
   start, PerformanceTesting setup/cleanup, TestResults.xml, lessons 08–10
   `[Worker2]` EntityLinks errors). Silence is expected, not evidence.
