---
name: unity-track-physics-drag
description: Master of PhysicsDragTrack + clip in vex-ee — stateless while-timeline-active exponential velocity decay, the honest instant-stop math, the brakes-off stat trap. Use when a designer asks "air-brake / spin down / thicken the air during this clip".
---

# PhysicsDragTrack specialist

You are the specialist for **`PhysicsDragTrack`** ("Drag (Brakes)") and
**`PhysicsDragClip`** from `Packages/BovineLabs.Timeline.Physics`, ns
`BovineLabs.Timeline.Physics.Authoring` — the Physics-family track bound to a
**PhysicsBodyAuthoring component**. While `ActiveDrag` is enabled, every
fixed step multiplies `PhysicsVelocity.Linear/.Angular` IN PLACE by
`exp(-drag × multiplier × dt)` — pure attenuation of whatever velocity the
body currently has. This is the family's SIMPLEST track and its **stateless
exception**: no State component, no Fired machine, no capture, no restore.
The simplicity is the lesson — what the absence of State buys and costs
(its own section below).

**Family patterns live in `unity-track-physics-filter-override`** (two-system
split, producer/modifier groups, the central `PhysicsTimelineBakingSystem`,
the TrackBlendDriver kernel/overlap rules, timeline-activation scope, the
silence profile — patterns 1–7). **The stat chain
(`StatStrengthUtility.Resolve`, the triple trap) is banked in
`unity-track-physics-angular-pid`.** Cite both; don't re-derive. This skill
owns the decay math, the no-State analysis, and the drag edition of the stat
trap (×0 = brakes OFF, the inverse of the PID's dead motor).

All facts verified live in **vex-ee**, **2026-06** (reflection dumps,
package-source reads inside exec, raw YAML reads, fresh-load read-backs, live
Unity.Mathematics computation), all via `unity-cli exec`; no play mode —
runtime claims are source-derived.

## Prerequisites & environment

- Act only through `unity-cli exec` / `unity-cli console`; never touch vex-ee
  via the filesystem; never enter play mode. Follow the **unity-cli skill's
  Safe Loop**. Smoke test: scene path + `Application.dataPath` →
  `Assets/Scenes/Main Scene.unity|/home/i/GitHub/vex-ee/Assets`.
- The `TrainingStage` (unity-stage-foundations) must exist in SubScene
  `Assets/Scenes/Main Sub Scene.unity`. Binding target: **Stage_PhysicsBall's
  `PhysicsBodyAuthoring` COMPONENT** (rule 5k: pass the component; the baker
  coerces component→entity). Stage_PhysicsBall: pos (0,1,5), Dynamic, Mass=1,
  **LinearDamping=0.01, AngularDamping=0.05** (the built-in PhysicsDamping
  side of the compound story is nonzero and live), `Targets.Target=
  Stage_Target`, **NO StatAuthoring** (keeps clip C's triple-trap exhibit live).
- Your assets live only under `Assets/Training/20-physics-drag-track/`.
  Canonical asset: `DragMastery.playable` — one track `DragTrack`, clips
  A_AirBrake (0–2s, linearDrag=20, angularDrag=0), B_SpinDown (1.5–3.5s,
  linearDrag=0, angularDrag=30, 0.5s blend with A), C_StatScaledBrake (5–6s,
  linearDrag=10, angularDrag=10, strengthStat=SlowMo(key=94),
  readStatFrom=Self). Director table holds **18** entries with this binding
  as the 18th.

## VERIFIED facts (vex-ee, 2026-06)

| Type | Facts |
|---|---|
| `PhysicsDragTrack` | ns `BovineLabs.Timeline.Physics.Authoring`, base `DOTSTrack`, **NOT sealed** (unlike the sealed Filter/PID types — cosmetic, but matters when reflecting). `[TrackClipType(PhysicsDragClip)]`, `[TrackBindingType(typeof(Unity.Physics.Authoring.PhysicsBodyAuthoring))]`, `[TrackColor]`, `[DisplayName("BovineLabs/Physics/Drag (Brakes)")]`. |
| `PhysicsDragClip` | base `DOTSClip`, `ITimelineClipAsset`, `clipCaps => ClipCaps.Blending \| ClipCaps.Looping` (REAL mixer), `duration => 1` (seed only). Bake: unconditional, SILENT (family pattern 7) — adds `PhysicsDragAnimated{AuthoredData}` to the clip entity via `PhysicsDragBuilder`. |
| `PhysicsDragData` | `float Linear; float Angular; StatStrengthConfig Strength;` |
| `PhysicsDragAnimated` | `IAnimatedComponent<PhysicsDragData>` + `IPreparable` — `AuthoredData` + `Value`, CLIP entity. |
| `ActiveDrag` | `IActive<PhysicsDragData>` — `Config` only. **No companion State component** (contrast `PhysicsFilterOverrideState`, `PhysicsAngularPIDState`). |
| Systems | `PhysicsDragTrackSystem` (`TimelineComponentAnimationGroup`, `[UpdateAfter(EntityLinkTargetPatchSystem)]`) = pure `TrackBlendDriver<PhysicsDragData, PhysicsDragAnimated, ActiveDrag, PhysicsDragMixer>`; `PhysicsDragApplySystem` (`PhysicsModifierGroup`, `[UpdateBefore(PhysicsVelocityOverrideSystem)]` — AFTER the physics step, before velocity overrides) hosts `ApplyDragJob`. |
| Extras | The package ships Drag DEBUG systems (`DragDebugSystem`, `PhysicsDragGizmoSystem`) and a real test class (`PhysicsDragApplySystemTests`) — the only Physics-family track so far with its own dedicated test file. |

### Clip fields — camelCase, defaults from a fresh instance (reflection)

| Field | Type | Default | Meaning |
|---|---|---|---|
| `linearDrag` | float | `5` | Tooltip verbatim: "Linear drag multiplier. 0 = no drag. 50 = instant stop (at 50hz)." **No `[Min]`** — negatives accepted. |
| `angularDrag` | float | `5` | Tooltip verbatim: "Angular drag multiplier. 0 = no drag. 50 = instant stop (at 50hz)." No `[Min]`. |
| `strengthStat` | StatSchemaObject | `null` | Optional ×100-fixed-point stat MULTIPLIER (shared `StatStrengthConfig`); multiplies BOTH drags inside the exponent. |
| `readStatFrom` | Target | `Self(4)` | Whose stat buffer, resolved via the BODY's Targets. |
| `readStatLink` | EntityLinkSchema | `null` | Optional link override for the stat-entity hunt. |

YAML (raw-read verified): `linearDrag: 20/0/10`, `angularDrag: 0/30/10`,
`readStatFrom: 4` everywhere, `strengthStat: {fileID: 11400000, guid: ...,
type: 2}` when assigned (asset→asset ref, rule 5j), overlap auto-creates
`m_BlendOutDuration: 0.5` / `m_BlendInDuration: 0.5` (Blending caps).

### The no-State evidence — three layers

1. **Type sweep**: reflection over all loaded assemblies —
   `STATE_SWEEP|*DragState* count=0`. No State type exists anywhere.
2. **Apply job**: no Fired/enter/stay/exit branches, no capture fields
   (quoted below — the whole consumer).
3. **Central baker** (`PhysicsTimelineBakingSystem`, Drag section, quoted):
   the binding entity gets **ActiveDrag only, no State** — where every
   sibling gets an Active+State pair:

```csharp
if (!em.HasComponent<ActiveDrag>(target))
{
    ecb.AddComponent<ActiveDrag>(target);
    ecb.SetComponentEnabled<ActiveDrag>(target, false);
}
EnsureAccumulationBuffers(ref ecb, target, em, queuedBuffers);
```

### Runtime source (quoted)

`PhysicsDragApplySystem.ApplyDragJob` — the whole consumer:

```csharp
var dt = SystemAPI.Time.DeltaTime;
if (dt <= 0.0001f) return;                          // dt early-out (system level)
...
var multiplier = StatStrengthUtility.Resolve(in config.Strength, entity, targets,
    LinkSources, Links, StatLookup);
multiplier = math.max(0f, multiplier);              // stat can never flip the sign
if (multiplier <= 0.00001f) continue;               // multiplier 0 => body SKIPPED (drag off)
PhysicsMath.ComputeExponentialDecay(facet.Velocity.ValueRO, config, DeltaTime,
    multiplier, out var vOut);
facet.Velocity.ValueRW = vOut;                      // DIRECT in-place PhysicsVelocity write
```

`PhysicsMath.ComputeExponentialDecay` verbatim — the entire effect:

```csharp
velocityOut = velocityIn;
if (deltaTime <= 0f) return;
velocityOut.Linear  *= math.exp(-drag.Linear  * multiplier * deltaTime);
velocityOut.Angular *= math.exp(-drag.Angular * multiplier * deltaTime);
```

`PhysicsDragMixer` verbatim:

```csharp
public PhysicsDragData Lerp(in PhysicsDragData a, in PhysicsDragData b, in float s)
    => new PhysicsDragData {
        Linear   = math.lerp(a.Linear,  b.Linear,  s),
        Angular  = math.lerp(a.Angular, b.Angular, s),
        Strength = s < 0.5f ? a.Strength : b.Strength };   // threshold copy

public PhysicsDragData Add(in PhysicsDragData a, in PhysicsDragData b)
    => new PhysicsDragData {
        Linear   = a.Linear + b.Linear,                    // drags SUM
        Angular  = a.Angular + b.Angular,
        Strength = a.Strength };                           // FIRST operand's stat config wins
```

Note the Add asymmetry: drags sum but `Strength = a.Strength` — under Add the
first-accumulated clip's stat config silently governs both clips' summed drag.

## THE STATELESSNESS ANALYSIS (this skill's headline)

Why no State is *needed*: exponential decay is a pure function of the CURRENT
velocity — `v *= exp(-k·dt)` never references "what the velocity was before
the clip started". There is nothing to capture because the effect is
multiplicative attenuation, not replacement; at timeline end the bit goes off
and the body keeps whatever velocity remains — the physically-correct handoff.

**What no-State BUYS:**

- **Scrub-proof**: re-entering a clip mid-run just re-applies the same pure
  function; no enter branch to fire twice, no snapshot to corrupt.
- **No capture poisoning**: the family's nastiest trap (pattern 5 — a
  restore=false run ends, the next run captures the mutated state as
  "original") is structurally impossible. Drag has no original.
- **No cross-track restore conflicts**: the Kinematic×Gravity
  exit-clobbers-restore bite cannot involve Drag — no exit write to clobber
  or be clobbered by. Drag composes with any sibling: it attenuates whatever
  velocity they produced this step (PhysicsModifierGroup, after the step,
  before VelocityOverride — a same-step VelocityOverride re-imposes its
  velocity AFTER drag).
- **No restore-flag semantics to teach**: no `restoreOnExit` field, so the
  "LAST clip's flag decides for the whole run" trap (Filter/Gravity) has no
  Drag form.

**What no-State COSTS:**

- **No restore — permanent velocity loss**: velocity lost to drag is gone;
  there is no "undo the braking" any more than for real air. Want the
  original speed back → a Force/Velocity clip to re-accelerate.
- **Gap bleed**: the track system is the stock `TrackBlendDriver` kernel, so
  the family gap trap holds verbatim — `ActiveDrag` stays enabled from the
  first clip to timeline deactivation, gaps hold the last blended config at
  full weight (in DragMastery the ball keeps braking at B's full angular=30
  through the 3.5–5s gap, then C takes over). "Stateless" still has
  timeline-activation-scoped *behavior*, just no stored *data*.
- **No per-clip identity**: only the single blended Config exists at apply
  time — no per-clip cleanup or attribution (contrast EssenceStat's
  remove-by-SourceEntity).

## Canonical recipes (verbatim from the report)

- **Air-brake ("slam the brakes on this body")**: "BovineLabs/Physics/Drag
  (Brakes)" track bound to the body's **PhysicsBodyAuthoring component**;
  one clip, `linearDrag` 10–20, `angularDrag` 0. 20 ≈ visually stopped in
  ~0.2s at 50 Hz; 50 ≈ 2–5 steps. Remember timeline scope: the brake keeps
  dragging through gaps until timeline end.
- **Spin-down ("kill the spin, keep the flight")**: `linearDrag=0`,
  `angularDrag` 20–40. The classic post-PID cleanup: an Angular PID clip
  ends with momentum (no restore) — follow it with a drag clip on the same
  body.
- **Thick air / underwater zone**: one long clip spanning the regime,
  moderate both-drags (3–8). Built-in PhysicsDamping still applies on top.
- **Stat-scaled brakes (slow-mo-aware braking)**: set `strengthStat`,
  `readStatFrom=Self` — and ensure the BOUND BODY actually has StatAuthoring
  with that key in StatDefaults (×100: author 100 for ×1). Missing buffer =
  brakes at ×1; present-buffer-missing-key = brakes OFF (silent).
- **Crossfade brake→spin-down**: overlap two clips (Blending caps) — the
  mixer lerps both drags so the middle genuinely brakes both axes; stack
  same-time full-weight clips only when you WANT summed (harder) braking.
- **Never** author negative drag — exponential energy injection, ×148/s at
  −5; the stat clamp cannot save you.

**Mid-overlap hand math** (DragMastery, t=1.75s, s=0.5):
`Linear = lerp(20, 0, 0.5) = 10`, `Angular = lerp(0, 30, 0.5) = 15`;
`Strength` threshold-copies B's (`s < 0.5f ? a : b` — at exactly 0.5 the
LATER clip's stat config wins). Mid-crossfade the ball brakes linearly at 10
AND angularly at 15 — a lerped crossfade genuinely passes through a
both-drags-active middle.

## Edge cases & traps (each source-proven or computed live, 2026-06)

- **DON'T author negative drag — unguarded exponential runaway** — no
  `[Min]` on the fields; authored `-5` gives `exp(+5·dt)` growth: ×1.105171
  per 50 Hz step, **×148.4 after 1s, ×3.27e6 after 3s** (computed live). The
  stat clamp `math.max(0f, multiplier)` only stops a negative STAT flipping
  a positive drag — a positive multiplier preserves an authored negative
  exponent, so the stat path CANNOT rescue it. Use a Force clip for boosts.
- **DON'T read "50 = instant stop (at 50hz)" literally** —
  `exp(-50 × 0.02) = 0.367880`: one step removes **63.2%**, not 100%; 90% of
  velocity gone in 46.1 ms, 99% in 92.1 ms, ~1.9e-22 after a full second —
  asymptotic decay, exact zero never reached; the tooltip is a perceptual
  approximation ("visually stopped within ~2–5 fixed steps").
- **DON'T expect drag to replace or disable built-in PhysicsDamping — they
  COMPOUND** — grep of every .cs in `Packages/BovineLabs.Timeline.Physics`
  for `PhysicsDamping`: **0 hits**; Unity.Physics integrates its own damping
  every step regardless (Stage_PhysicsBall authors 0.01/0.05), so effective
  braking is slightly stronger than the clip value alone implies.
- **DO pick drag vs VelocityClamp (topic 26) deliberately** — drag is
  proportional decay toward zero (smooth, never quite arrives, scales with
  speed); VelocityClamp is a hard ceiling (no effect below the cap, instant
  truncation above). "Thicker air / fading momentum" → Drag; "never faster
  than X" → VelocityClamp; "kill residual PID spin at a cut" → clamp (or
  kinematic freeze), because drag's asymptote leaves a remainder.
- **DON'T trust the stat multiplier without walking the triple trap — drag
  edition** (chain banked in `unity-track-physics-angular-pid`): (1) no
  buffer/unresolvable → ×1 (clip C on today's stat-less ball = plain 10/10
  brake); (2) buffer present → ×100-decoded (authored 25 = ×0.25 braking,
  not ×25); (3) buffer present, KEY absent → `GetValueFloat` 0 → the
  `continue` skip → **brakes silently OFF** — the body sails on undamped.
  Same root cause as the PID's ×0, OPPOSITE designer symptom: PID reads as
  "my motor is dead", drag reads as "my brakes failed". Triage both by
  checking the buffer's KEYS, not its presence.
- **DO know multiplier-zero SKIPS, not zero-drags** — `if (multiplier <=
  0.00001f) continue;` — a stat-zeroed drag never computes `exp(0)`; the
  body is skipped entirely. Same observable (no braking), cheaper path —
  "stat=0 disables the brakes" is an intended off-switch shape.
- **DON'T treat gaps as neutral — the body keeps braking** — stock
  `TrackBlendDriver` kernel + `DisableStaleTrackJob` disabling only at
  TIMELINE deactivation (family pattern 5): gaps hold the last blended
  config at full weight.
- **DO expect Add to brake HARDER and keep the FIRST stat config** —
  `a.Linear+b.Linear` / `a.Angular+b.Angular` summed inside the exponent
  (two full-weight clips outbrake either alone), `Strength = a.Strength`.
  Contrast the lerped crossfade's weighted middle (10/15 at s=0.5).
- **DO use `Convert.ToInt64(Key)` when printing `StatSchemaObject.Key` in
  exec snippets** — `Key` is a plain value; `.Key.Value` fails to compile
  (rule 5e adjacent).
- **DO note the silence profile (family rule 7)** — Bake unconditional, no
  guards; unbound track → central-baker `Entity.Null` continue = total
  silent no-op. Clean console proves nothing.

## Verification protocol

1. **Fresh-load asset dump** (separate exec block; in-memory state after a
   save is not evidence) — 3 clips:
   `A_AirBrake 0-2 blendOut=0.5 linearDrag=20 angularDrag=0 strengthStat=null`,
   `B_SpinDown 1.5-3.5 blendIn=0.5 linearDrag=0 angularDrag=30 strengthStat=null`,
   `C_StatScaledBrake 5-6 linearDrag=10 angularDrag=10
   strengthStat=SlowMo(key=94)`; `readStatFrom=Self` everywhere,
   `caps=Looping|Blending`.
2. **Raw YAML** — `linearDrag: 20/0/10`, `angularDrag: 0/30/10`,
   `readStatFrom: 4`, C's `strengthStat: {fileID: 11400000, guid: ..., type: 2}`,
   blend pair `m_BlendOutDuration: 0.5` on A / `m_BlendInDuration: 0.5` on B.
3. **Stage checks** — Stage_PhysicsBall: PhysicsBodyAuthoring Dynamic,
   Mass=1, LinearDamping=0.01, AngularDamping=0.05, Targets
   Target=Stage_Target, NO StatAuthoring.
4. **Binding from a RELOADED SubScene** — director table **18** entries,
   #18 = `DragTrack (PhysicsDragTrack) → Stage_PhysicsBall
   (PhysicsBodyAuthoring)` — `GetGenericBinding` returns the COMPONENT
   verbatim (rule 5k); prior 17 intact.
5. **Parent-scene restore** — sceneCount=1, `Assets/Scenes/Main
   Scene.unity|loaded=True|dirty=False`; director back to
   `Assets/Training/01-transform-position-track/PositionMastery.playable`.
6. **Console** — only known pre-existing entries (UnityCliConnector HTTP
   start, PerformanceTesting setup/cleanup, TestResults.xml, lessons 08–10
   `[Worker2]` EntityLinks errors). Silence is expected, not evidence.
