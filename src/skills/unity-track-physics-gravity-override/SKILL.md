---
name: unity-track-physics-gravity-override
description: Master of PhysicsGravityOverrideTrack + clip in vex-ee — blended while-timeline-active gravity scaling via PhysicsGravityFactor add/mutate, the add-path one-step latency, capture poisoning. Use when a designer asks "zero-g / reverse gravity / moon gravity during this clip".
---

# PhysicsGravityOverrideTrack specialist

You are the specialist for **`PhysicsGravityOverrideTrack`** and
**`PhysicsGravityOverrideClip`** from `Packages/BovineLabs.Timeline.Physics`,
namespace `BovineLabs.Timeline.Physics.Authoring.Gravities` — the SECOND
Physics-family track. While the override regime is active, the bound body's
`Unity.Physics.PhysicsGravityFactor{float Value}` is added or mutated to the
clip's (possibly blended) `GravityScale`; the original is captured once on
first enter and restored/removed only at **timeline** deactivation, only if
the LAST clip's `restoreOnExit` says so.

**Family patterns live in `unity-track-physics-filter-override`** — its
"PHYSICS FAMILY SHARED PATTERNS (for topics 16-26)" section is the canonical
reference for the two-system split, producer/modifier groups, the central
`PhysicsTimelineBakingSystem`, the Fired machine's timeline-activation scope,
per-track overlap rules, and the silence profile. Cite it; don't re-derive.
This track's distinctions from Filter:

1. **REAL blending** — `ClipCaps.Blending`, so every clip bakes a
   `ClipWeight` and overlaps genuinely lerp through
   `PhysicsGravityOverrideMixer` (Filter's `ClipCaps.None` = first-writer
   races, dead-code mixer).
2. **PhysicsProducerGroup** — the apply system FEEDS the simulation (runs
   BEFORE `PhysicsSystemGroup`; Filter's runs after, in the modifier group).
3. **Component add/mutate/remove** — a plain IComponentData, not a blob
   mutation; therefore **NO ForceUnique requirement** and no shared-blob
   warning, but a new asymmetry: the ADD path is one fixed step latent.

All facts verified live in **vex-ee**, **2026-06** (reflection dumps,
package-source reads via `File.ReadAllText` inside exec, raw YAML reads,
fresh-load read-backs, all via `unity-cli exec`); no play mode — runtime
claims are source-derived.

## Prerequisites & environment

- Act only through `unity-cli exec` / `unity-cli console`; never touch vex-ee
  via the filesystem; never enter play mode. Follow the **unity-cli skill's
  Safe Loop**. Smoke test: return active scene path + `Application.dataPath` →
  expect `Assets/Scenes/Main Scene.unity|/home/i/GitHub/vex-ee/Assets`.
- The `TrainingStage` (unity-stage-foundations) must exist in SubScene
  `Assets/Scenes/Main Sub Scene.unity`. Binding target: **Stage_PhysicsBall**
  — dynamic sphere at (0,1,5), fresh-load dump
  `BODY|MotionType=Dynamic|Mass=1.000|GravityFactor=1.000`,
  `SHAPE|ShapeType=Sphere|ForceUnique=True`, plus LifeCycle + Targets.
  **GravityFactor=1.000 means NO `PhysicsGravityFactor` is baked → every clip
  exercises the ADD path** (`AddedComponent=true`). The conditional
  Unity.Physics bake rule, quoted from
  `Packages/com.unity.physics.custom/Unity.Physics.Custom/Bodies/BakingSystems/PhysicsBodyBakingSystem.cs`
  (the compiled copy — NOT PackageCache; Samples~ are not compiled):

  ```csharp
  if (authoring.MotionType == BodyMotionType.Dynamic)
  {
      AddComponent(entity, new PhysicsDamping { ... });
      if (authoring.GravityFactor != 1)
      {
          AddComponent(entity, new PhysicsGravityFactor
          {
              Value = authoring.GravityFactor
          });
      }
  }
  else if (authoring.MotionType == BodyMotionType.Kinematic)
  {
      AddComponent(entity, new PhysicsGravityFactor { Value = 0 });
  }
  ```

  Side fact: Kinematic bodies always bake the component with Value=0.
- Your assets live only under
  `Assets/Training/16-physics-gravity-override-track/`. Canonical asset:
  `GravityOverrideMastery.playable` — one track `GravityTrack`, clips
  A_ZeroG (0–2s, gravityScale=0, restoreOnExit=true), B_ReverseG (1.5–3.5s,
  gravityScale=-1, restoreOnExit=true, blendIn 0.5 — the REAL-blending
  exhibit), C_PermanentMoonG (5–6s, gravityScale=0.5, restoreOnExit=false —
  the permanence/poisoning exhibit).
- The track binds **the GameObject itself**
  (`director.SetGenericBinding(track, stagePhysicsBallGameObject)`); the
  director table holds **14** entries with this binding as the 14th (B13 is
  lesson 15's FilterOverrideTrack → the same GameObject).

## VERIFIED facts (vex-ee, 2026-06)

| Type | Facts |
|---|---|
| `PhysicsGravityOverrideTrack` | `BovineLabs.Timeline.Physics.Authoring.Gravities`, asm BovineLabs.Timeline.Physics.Authoring, sealed, EMPTY body, base `DOTSTrack`. `[TrackClipType(typeof(PhysicsGravityOverrideClip))]`, `[TrackBindingType(typeof(GameObject))]`, `[TrackColor(0.2,0.6,0.8)]`, `[DisplayName("BovineLabs/Physics/Gravity Override")]`. |
| `PhysicsGravityOverrideClip` | sealed, base `DOTSClip`, `ITimelineClipAsset`, **`clipCaps => ClipCaps.Blending`** (contrast Filter's None), `duration => 1` (seed only). |
| `PhysicsGravityOverrideData` | `BovineLabs.Timeline.Physics`, asm `...Physics.Data`, IComponentData: `float GravityScale; bool RestoreOnExit;` |
| `PhysicsGravityOverrideAnimated` | `IAnimatedComponent<PhysicsGravityOverrideData>` — `AuthoredData` + `Value`, on the CLIP entity. |
| `ActiveGravityOverride` | IComponentData + **IEnableableComponent**: `PhysicsGravityOverrideData Config` — on the BINDING entity, added DISABLED at bake. |
| `PhysicsGravityOverrideState` | IComponentData: `bool Fired; float OriginalGravityScale; bool AddedComponent;` — on the BINDING entity. |
| `PhysicsGravityOverrideMixer` | `IMixer<PhysicsGravityOverrideData>` — REAL math: `GravityScale = math.lerp(a.GravityScale, b.GravityScale, s)`, `RestoreOnExit = s >= 0.5f ? b.RestoreOnExit : a.RestoreOnExit`; `Add(a,b) => b`. |
| `Unity.Physics.PhysicsGravityFactor` | `float Value` — the component the apply system adds/mutates/removes. |
| Systems | `PhysicsGravityOverrideTrackSystem` (`TimelineComponentAnimationGroup`, `[UpdateAfter(EntityLinkTargetPatchSystem)]`, per rendered frame) produces the enabled `ActiveGravityOverride{Config}` (enable goes through the **BeginSimulation** ECB — effective next frame); `PhysicsGravityOverrideApplySystem` (**`PhysicsProducerGroup`** = FixedStep, BEFORE `PhysicsSystemGroup`; query uses `IgnoreComponentEnabledState`) consumes it against `PhysicsGravityFactor`. |

### Clip fields — camelCase (reflection on a fresh instance)

| Field | Type | Default | Meaning |
|---|---|---|---|
| `gravityScale` | float | `1` | Gravity multiplier. 1=normal, 0=zero-G, negative=reversed. **UNCLAMPED.** |
| `restoreOnExit` | bool | `True` | Restore/remove at override-REGIME end (timeline deactivation — NOT clip end). |

`DEFAULTS|gravityScale=1|restoreOnExit=True|duration=1|clipCaps=Blending` (quoted).

YAML serialization (raw-read verified): floats plain (`gravityScale: 0` /
`-1` / `0.5`), bools as 1/0 (`restoreOnExit: 0` on C). The A/B overlap
generates REAL blend YAML — A: `m_BlendOutDuration: 0.5` + populated mix
curve; B: `m_BlendInDuration: 0.5` + populated mix curve (contrast lesson 15:
ClipCaps.None produced NO blend YAML at all). The deciding bake line, quoted
from `com.bovinelabs.timeline@4331b95d072a/BovineLabs.Timeline.Authoring/ClipBaker.cs`:

```csharp
if ((clip.clipCaps & ClipCaps.Blending) != 0)
{
    context.Baker.AddComponent(clipEntity, new ClipWeight { Value = 1 });
}
```

Bake (quoted from `PhysicsGravityOverrideClip.Bake`): unconditional — no
guard, no LogError; adds `PhysicsGravityOverrideAnimated{AuthoredData}` via
`PhysicsGravityOverrideBuilder.ApplyTo`, then `base.Bake`. **NO bake-time
failure mode.** The binding-entity pair comes from the central
`PhysicsTimelineBakingSystem` (identical family shape to Filter's quoted
loop, with `PhysicsGravityOverrideAnimated` / `ActiveGravityOverride` /
`PhysicsGravityOverrideState` substituted; same `Entity.Null` continue —
unbound track = total silent no-op).

### Runtime semantics (one paragraph, source-quoted)

`PhysicsGravityOverrideTrackSystem` runs the family kernel per rendered
frame: `ResetStateTrackJob` resets the binding's State to `{Fired=false,
AddedComponent=false, OriginalGravityScale=1}` on clip-activation edges only
while `ActiveGravityOverride` is disabled; `PrepareJob` copies
`AuthoredData → Value`; `TrackBlendImpl` collects per binding entity — and
because every gravity clip bakes a `ClipWeight`, overlaps go through the
4-slot weighted register and `WriteActiveJob` writes `Config =
JobHelpers.Blend<PhysicsGravityOverrideData, PhysicsGravityOverrideMixer>(ref
mixData, default)` — a genuine weighted lerp — then ECB-enables
`ActiveGravityOverride` via the BeginSimulation ECB; `DisableStaleTrackJob`
disables it only on the timeline-deactivation edge.
`PhysicsGravityOverrideApplySystem` then runs the Fired machine per fixed
step: **enter** (`isActive && !Fired`) — component present → capture
`OriginalGravityScale`, write `Value = Config.GravityScale` in place,
`AddedComponent=false`; component absent → `OriginalGravityScale=1`,
`AddedComponent=true`, `ECB.AddComponent(chunkIndex, entity, new
PhysicsGravityFactor{Value})` on the **EndFixedStepSimulation** ECB; **stay**
— re-assert in place, or re-add via ECB if the component is (externally)
missing; **exit** (timeline deactivation, last-written Config) —
`RestoreOnExit` → `AddedComponent ? ECB.RemoveComponent<PhysicsGravityFactor>`
: in-place restore of the captured original (plus a third branch re-ADDING
the original if the component vanished mid-run); `RestoreOnExit=false` →
component and value left permanently.

**The mental model:** same regime shape as Filter — first gravity clip enters
at its first frame, gaps hold the last blended Config (stay keeps
re-asserting), exit fires once at timeline deactivation with the LAST clip's
restore flag deciding for the whole run — but the override target is a plain
IComponentData add/mutate/remove, not a blob, so no ForceUnique requirement
exists, and overlapping clips genuinely lerp instead of racing.

## Canonical recipes (verbatim from the report)

- **Zero-g window**: track "BovineLabs/Physics/Gravity Override" bound to the
  body's GameObject; one clip `gravityScale=0, restoreOnExit=true`. Remember:
  with multiple gravity clips on the timeline, normal gravity returns only at
  TIMELINE end, and only if the LAST clip has restoreOnExit=true.
- **Reverse gravity / float-then-slam**: clip `gravityScale=-1`. Overlap it
  with the previous clip to glide between regimes — overlaps genuinely lerp
  (this track blends; its Filter sibling races). A/B overlap 1.5–2.0s: at
  t=1.75 weights are 0.5/0.5 → `math.lerp(0, -1, 0.5) = -0.5` — the ball's
  gravity scale glides 0 → −1 across the half-second window. `RestoreOnExit`
  blends discretely (`s >= 0.5f ? b : a`).
- **Moon gravity, permanent**: last clip `gravityScale=0.5,
  restoreOnExit=false` — permanent `PhysicsGravityFactor{0.5}` on the body,
  and it poisons the next run's capture (original becomes 0.5). Pair with a
  compensating clip when the change must be temporary across runs.
- **Pre-flight**: NO ForceUnique requirement (no blob involved). But bind the
  GameObject itself, and the director needs TimelineReferenceAuthoring as
  always. A factor-1 body gets the component ADDED (one fixed-step latency on
  first application); a factor≠1 or Kinematic body (always baked factor 0) is
  MUTATED in place (same-tick).

## Edge cases & traps (each source-proven, 2026-06)

- **DO know which path your body takes — add vs mutate, with exact-archetype
  recovery on remove** — quoted `OnEnter`: `hasGravityFactor` → capture
  `gravityFactors[i].Value` into `OriginalGravityScale`,
  `AddedComponent=false`, in-place write (same-tick effect); else →
  `OriginalGravityScale=1`, `AddedComponent=true`, `ECB.AddComponent(...)`
  (one-step latent). Exit symmetry: `AddedComponent ?
  ECB.RemoveComponent<PhysicsGravityFactor>() :` in-place restore. The ball
  (factor 1, no baked component) takes the ADD path: enter adds, restore
  removes — the entity returns to its exact baked archetype.
- **DON'T file the stay-path duplicate-add as a bug — adjudicated NOT A BUG**
  — three source facts close it: (1) the apply system queues on
  `EndFixedStepSimulationEntityCommandBufferSystem`, which is
  `[UpdateInGroup(typeof(FixedStepSimulationSystemGroup), OrderLast = true)]`
  — commands queued during fixed step N play back at the END of step N, so
  the "absent window" closes before the apply system's next update; (2) enter
  and stay are exclusive branches of one per-entity dispatch, so the stay
  re-add is reachable only if an external actor removes the component
  mid-regime — deliberate self-healing (mirroring the exit path's own
  re-add-original third branch); (3) the with-value
  `EntityCommandBuffer.AddComponent<T>` is documented *"At playback, if the
  entity already has this type of component, the value will just be set"* —
  idempotent overwrite, never a throw.
- **DO expect the REAL quirk instead: one-fixed-step latency on the ADD path**
  — the apply system runs in `PhysicsProducerGroup` (before
  `PhysicsSystemGroup`), but the EndFixedStep ECB plays back AFTER the
  physics step — so on the enter tick of a body with no
  `PhysicsGravityFactor`, that tick's physics step still integrates with
  implicit factor 1. The mutate path writes in place before the step and is
  effective the same tick. Asymmetric first-tick behavior; negligible at
  60Hz, but real.
- **DO overlap gravity clips — same family as Filter, OPPOSITE overlap rule**
  — `clipCaps => ClipCaps.Blending` (gravity) vs `ClipCaps.None` (filter);
  the ClipBaker line above adds `ClipWeight` only when caps include Blending,
  so gravity clips take the 4-slot weight-sorted register and
  `PhysicsGravityOverrideMixer.Lerp` actually runs, while filter clips race
  first-writer-wins. >4 simultaneous gravity clips on one binding: lowest
  weight silently dropped.
- **DO use negative/extreme scales freely — UNCLAMPED everywhere** —
  `gravityScale: -1` serializes verbatim (raw YAML quoted); no clamp in clip,
  mixer, or apply system. It scales the world gravity vector via
  `PhysicsGravityFactor`, it does not replace velocity: a falling ball under
  scale −1 decelerates, then rises.
- **DON'T expect normal gravity in gaps — gaps hold the last blended value,
  not neutral** — `DisableStaleTrackJob` keys off `TimelineActivePrevious &&
  !TimelineActive`, never clip end; in the mastery asset the 3.5–5.0s gap
  keeps re-asserting B's −1 every fixed step.
- **DON'T let a restoreOnExit=false clip near a body you ever want back —
  timeline-end restore + capture poisoning (walk A→B→C)** — regime: A enters
  at t=0 (zero-g); A/B blend 1.5–2.0 (lerp 0→−1); B alone →3.5; gap holds −1;
  C 5–6 (moon 0.5). Timeline deactivation: exit runs ONCE with the LAST
  Config = C's `{GravityScale=0.5, RestoreOnExit=false}` → no restore: the
  ball keeps `PhysicsGravityFactor{0.5}` forever. **Next run**: the component
  now EXISTS, so run 2 takes the MUTATE path — enter captures 0.5 as
  `OriginalGravityScale` and `AddedComponent=false`; even all-restore=true
  clips now "restore" moon gravity, and remove never fires. Undo requires a
  compensating clip or external `RemoveComponent`. (Within one run, capture
  stays safe: Fired=true blocks re-capture and ResetStateTrackJob is gated on
  Active being disabled.)
- **DON'T be surprised by a component the authoring never had —
  bake/runtime divergence** — restoreOnExit=false leaves a PERMANENT
  `PhysicsGravityFactor` on an entity whose baked archetype (Dynamic, factor
  1 → no component, per the quoted conditional bake) never authored one;
  "why does this body have gravity factor 0.5? The PhysicsBodyAuthoring says
  1" has no authoring-side answer — the timeline did it. Also flips the next
  run's branch from add to mutate.
- **DO note the silence profile (family rule 7 holds)** — clip bake is
  unconditional; unbound track = `Entity.Null` continue at the central baker
  = total silent no-op; runtime has NO loud failure at all (no blob, no
  ForceUnique, no analogue of Filter's shared-blob warning). A clean console
  proves nothing.

## Verification protocol

1. **Fresh-load asset dump** (separate exec block; in-memory state after a
   save is not evidence) — 3 clips:
   `A_ZeroG 0-2 gravityScale=0 restoreOnExit=True`,
   `B_ReverseG 1.5-3.5 gravityScale=-1 restoreOnExit=True blendIn=0.5`,
   `C_PermanentMoonG 5-6 gravityScale=0.5 restoreOnExit=False`; all
   `caps=Blending`.
2. **Raw YAML** — `gravityScale` plain floats (0 / −1 / 0.5), `restoreOnExit`
   as 1/0; REAL blend YAML on the A/B overlap (`m_BlendOutDuration: 0.5` on
   A, `m_BlendInDuration: 0.5` on B, populated mix curves).
3. **Stage checks** — Stage_PhysicsBall fresh-load dump:
   `MotionType=Dynamic|Mass=1.000|GravityFactor=1.000` (the add-path
   precondition — if GravityFactor≠1, the clips take the mutate path instead).
4. **Binding from a RELOADED SubScene** — director table **14** entries,
   #14 = `GravityTrack (PhysicsGravityOverrideTrack) → Stage_PhysicsBall
   (GameObject)`; prior 13 intact (B13 = lesson 15's FilterOverrideTrack).
5. **Parent-scene restore** — sceneCount=1,
   `Assets/Scenes/Main Scene.unity|loaded=True|active=True|dirty=False`;
   director back to `Assets/Training/01-transform-position-track/PositionMastery.playable`.
6. **Console** — only known pre-existing entries (UnityCliConnector HTTP
   start, PerformanceTesting setup/cleanup, TestResults.xml, lessons 08–10
   `[Worker2]` EntityLinks errors). This pipeline is silent even when
   misconfigured — silence is expected, not evidence (family pattern 7).
