---
name: unity-track-physics-kinematic-override
description: Master of PhysicsKinematicOverrideTrack + clip in vex-ee — while-timeline-active kinematic freezing via PhysicsMassOverride, unconditional config-blind exit restore, the gravity cross-track conflict matrix. Use when a designer asks "freeze this body / carry it on rails during the clip".
---

# PhysicsKinematicOverrideTrack specialist

You are the specialist for **`PhysicsKinematicOverrideTrack`** and
**`PhysicsKinematicOverrideClip`** from `Packages/BovineLabs.Timeline.Physics`,
namespace `BovineLabs.Timeline.Physics.Authoring.Kinematics` — the THIRD
Physics-family track. While the override regime is active, the bound body gets
`Unity.Physics.PhysicsMassOverride{IsKinematic=1}` (infinite-mass kinematic,
still velocity-driven), optionally a one-shot `PhysicsVelocity` wipe on enter,
and optionally `PhysicsGravityFactor` zeroed — then EVERYTHING is restored at
timeline deactivation, unconditionally.

**Family patterns live in `unity-track-physics-filter-override`** (the
"PHYSICS FAMILY SHARED PATTERNS" section: two-system split, producer/modifier
groups, central `PhysicsTimelineBakingSystem`, Fired machine's
timeline-activation scope, per-track overlap rules, silence profile).
**Gravity-component mechanics live in `unity-track-physics-gravity-override`**
(add/mutate/remove paths, capture poisoning, EndFixedStep ECB latency). Cite
them; don't re-derive. This track's distinctions:

1. **PhysicsModifierGroup** — the apply system runs AFTER `PhysicsSystemGroup`
   (Gravity's runs before, in the producer group); even in-place enter writes
   first bind the *next* physics step.
2. **NO restoreOnExit field** — exit ALWAYS restores; kinematic overrides
   cannot be made permanent via the timeline (contrast Filter's and Gravity's
   optional flag). Worse: `OnExit` never receives the Config — the exit
   gravity restore is **config-blind** (fires even for `zeroGravity=false`
   regimes).
3. **Touches TWO components** — `PhysicsMassOverride` (owned) AND
   `PhysicsGravityFactor` (shared with the Gravity track, defended by the
   defer-to-gravity guard) — hence THE CONFLICT MATRIX below.

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
  `SHAPE|ShapeType=Sphere|ForceUnique=True`. GravityFactor=1.000 ⇒ no
  `PhysicsGravityFactor` baked (conditional bake rule quoted in the gravity
  skill) ⇒ every gravity-touching path is the ADD path; Dynamic ⇒ no
  `PhysicsMassOverride` baked ⇒ the mass piece also takes ADD on enter,
  REMOVE on exit. ForceUnique is irrelevant here (no blob touched).
- Your assets live only under
  `Assets/Training/17-physics-kinematic-override-track/`. Canonical asset:
  `KinematicMastery.playable` — one track `KinematicTrack`, clips
  A_FullFreeze (0–2s, isKinematic=true, zeroVelocityOnEnter=true,
  zeroGravity=true — the all-defaults freeze-frame exhibit) and
  B_RailsCarryMomentum (3–5s, isKinematic=true, zeroVelocityOnEnter=false,
  zeroGravity=false — the momentum-preserving carry exhibit).
- The track binds **the GameObject itself**; the director table holds **15**
  entries with this binding as the 15th (B13 = lesson 15's
  FilterOverrideTrack, B14 = lesson 16's GravityTrack, same GameObject).

## VERIFIED facts (vex-ee, 2026-06)

| Type | Facts |
|---|---|
| `PhysicsKinematicOverrideTrack` | `BovineLabs.Timeline.Physics.Authoring.Kinematics`, asm `BovineLabs.Timeline.Physics.Authoring`, sealed, EMPTY body, base `DOTSTrack`. `[TrackClipType(typeof(PhysicsKinematicOverrideClip))]`, `[TrackBindingType(typeof(GameObject))]`, `[TrackColor(0.5,0.5,0.5)]`, `[DisplayName("BovineLabs/Physics/Kinematic Override")]`. |
| `PhysicsKinematicOverrideClip` | sealed, base `DOTSClip`, `ITimelineClipAsset`, **`clipCaps => ClipCaps.None`** (first-writer overlap races, like Filter; `DiscreteMixer` is dead code), `duration => 1` (seed only). |
| `PhysicsKinematicOverrideData` | `BovineLabs.Timeline.Physics`, asm `...Physics.Data`: `bool IsKinematic; bool ZeroVelocityOnEnter; bool ZeroGravity;` — **NO RestoreOnExit field.** |
| `PhysicsKinematicOverrideAnimated` | `IAnimatedComponent<PhysicsKinematicOverrideData>` — `AuthoredData` + `Value`, on the CLIP entity. |
| `ActiveKinematicOverride` | IComponentData + **IEnableableComponent**: `PhysicsKinematicOverrideData Config` — on the BINDING entity, added DISABLED at bake. |
| `PhysicsKinematicOverrideState` | `bool Fired; float OriginalGravityScale; bool AddedGravityComponent; bool AddedMassOverrideComponent; byte OriginalIsKinematic;` — binding entity. Source comment: `// PhysicsMassOverride uses byte for IsKinematic`. |
| `Unity.Physics.PhysicsMassOverride` | `byte IsKinematic; byte SetVelocityToZero;` (quoted from `PhysicsComponents.cs`). |
| Systems | `PhysicsKinematicOverrideTrackSystem` (`TimelineComponentAnimationGroup`, `[UpdateAfter(EntityLinkTargetPatchSystem)]`, per rendered frame); `PhysicsKinematicOverrideApplySystem` (**`PhysicsModifierGroup`** = FixedStep AFTER `PhysicsSystemGroup` — unlike Gravity's producer slot; query `WithOptions(EntityQueryOptions.IgnoreComponentEnabledState)`). |

### Clip fields — camelCase (reflection on a fresh instance)

| Field | Type | Default | Meaning |
|---|---|---|---|
| `isKinematic` | bool | `True` | `PhysicsMassOverride.IsKinematic=1` while the regime is active — infinite-mass kinematic, **still velocity-driven**. |
| `zeroVelocityOnEnter` | bool | `True` | Direct `PhysicsVelocity` Linear/Angular = 0 on the ENTER edge only (NOT the `SetVelocityToZero` byte — that stays untouched). |
| `zeroGravity` | bool | `True` | `PhysicsGravityFactor.Value = 0` while active — DEFERRED entirely if a GravityOverride regime is active. |

`DEFAULTS|isKinematic=True|zeroVelocityOnEnter=True|zeroGravity=True|duration=1|clipCaps=None` (quoted).

YAML serialization (raw-read verified): bools as 1/0
(A: `isKinematic: 1 / zeroVelocityOnEnter: 1 / zeroGravity: 1`;
B: `1 / 0 / 0`); no blend/ease YAML — ClipCaps.None. Bake (quoted from
`PhysicsKinematicOverrideClip.Bake`): unconditional — no guard, no LogError;
`PhysicsKinematicOverrideBuilder.ApplyTo` adds
`PhysicsKinematicOverrideAnimated{AuthoredData}`. The binding-entity pair
comes from the central `PhysicsTimelineBakingSystem` (identical family shape;
`Entity.Null` continue ⇒ unbound track = total silent no-op).

### Runtime semantics (one paragraph, source-quoted)

`PhysicsKinematicOverrideTrackSystem` runs the family kernel per rendered
frame: `ResetStateTrackJob` reseeds the State (`Fired=false,
OriginalGravityScale=1f, AddedGravityComponent=false,
AddedMassOverrideComponent=false, OriginalIsKinematic=0`) on clip-activation
edges only while `ActiveKinematicOverride` is disabled; `PrepareJob` copies
`AuthoredData → Value`; no `ClipWeight` is ever baked (ClipCaps.None ⇒
first-writer-wins); `WriteActiveJob` ECB-enables
`ActiveKinematicOverride{Config}` via the BeginSimulation ECB;
`DisableStaleTrackJob` direct-write-disables it
(`ActiveLookup.SetComponentEnabled(target, false)` — no ECB) only on the
timeline-deactivation edge. `PhysicsKinematicOverrideApplySystem`
(`PhysicsModifierGroup`, after the step) runs the Fired machine per fixed
step: **enter** (`isActive && !Fired`) — optional one-shot `PhysicsVelocity`
wipe; `PhysicsMassOverride` mutate-or-ECB-add (capturing
`OriginalIsKinematic`/`AddedMassOverrideComponent`); gravity capture-and-zero
only `if (config.ZeroGravity && !hasActiveGravityOverride)` (mutate-or-add,
mirroring the gravity skill); **stay** — re-assert `IsKinematic` and (same
guard, NO re-add) gravity 0 every step; **exit** (`!isActive && Fired`,
timeline deactivation, no restore flag exists) — unconditional three-branch
restore of the mass piece (remove-if-added / restore-in-place /
re-add-original) plus, *only if no GravityOverride regime is active and
regardless of `config.ZeroGravity`*, the same three-branch restore of
`PhysicsGravityFactor` from the State. All adds/removes ride the EndFixedStep
ECB (one-fixed-step add-path latency; set-on-duplicate adds).

**Kinematic = velocity-driven (the Velocity-track bridge):** quoted from
`PhysicsWorldBuilder.cs` — a body with `MassOverride.IsKinematic != 0` gets
`defaultPhysicsMass` (infinite mass, force/impulse/gravity-immune,
unstoppable in collision response) but its `PhysicsVelocity` is still
integrated every step. The kinematic window is the natural substrate for
deterministic carries: a Velocity-track clip layered in the same window can
write `PhysicsVelocity` directly, and the kinematic exit hands whatever
velocity remains straight back to dynamic simulation.

## Canonical recipes (verbatim from the report)

- **Freeze-frame the body ("hold it in the air during the cutscene beat")** —
  track "BovineLabs/Physics/Kinematic Override" bound to the body's
  **GameObject**; one clip, `isKinematic=true, zeroVelocityOnEnter=true,
  zeroGravity=true` (= A_FullFreeze = the all-defaults clip). Body becomes an
  immovable infinite-mass kinematic: velocity wiped once on enter, gravity
  factor zeroed (belt-and-suspenders — isKinematic already makes gravity
  moot), forces and collision responses ignored; it still PUSHES dynamic
  bodies it touches. Exit restores everything unconditionally — exact baked
  archetype on Stage_PhysicsBall.
- **Rails / timeline-driven carry that keeps momentum** — clip
  `isKinematic=true, zeroVelocityOnEnter=false, zeroGravity=false`
  (= B_RailsCarryMomentum). The body keeps its current `PhysicsVelocity` and
  glides on it, immune to gravity (kinematic bodies ignore gravity by
  construction) and to forces/impacts — the state another track (Velocity;
  or PID) can now drive deterministically. At exit the mass override is
  removed/restored and the body re-enters dynamic simulation **with whatever
  velocity it holds at that moment** — a clean "physics takes over again"
  handoff.
- **Pre-flight** — bind the GameObject itself; the director needs
  `TimelineReferenceAuthoring` (activation gate); NO ForceUnique requirement
  (no blob is touched). There is NO permanence option: if you need the body
  to stay kinematic after the timeline, this track cannot do it.
- **Regime rule (family 5v)** — with multiple kinematic clips on the
  timeline, dynamic behavior returns only at TIMELINE end: gaps hold the last
  Config (stay keeps re-asserting `IsKinematic`), and the single enter/exit
  pair brackets the whole run.

## THE CONFLICT MATRIX (gravity × kinematic on one body — the headline)

`zeroGravity` writes the SAME component (`PhysicsGravityFactor`) that
`PhysicsGravityOverrideTrack` owns. The defense is the **defer-to-gravity
guard**, computed per entity per fixed step from the **live ENABLED bit** of
`ActiveGravityOverride` — the very bit that admits the gravity track's own
apply system (quoted):

```csharp
var hasActiveGravityOverride = hasGravityOverride &&
                               chunk.IsComponentEnabled(ref ActiveGravityOverrideHandle, i);
// ENTER:  if (config.ZeroGravity && !hasActiveGravityOverride) { ... }
// STAY:   if (config.ZeroGravity && lanes.HasGravityFactor && !hasActiveGravityOverride) { ... }
// EXIT:   if (!hasActiveGravityOverride) { ... }   // the ENTIRE gravity restore — config-blind
```

**Safe by design (scenarios 1–3):** (1) **Overlap** — gravity regime already
active when kinematic enters: enter/stay gravity blocks guard-skipped;
gravity owns the component end to end (MassOverride + velocity-zero still
apply). (2) **Sequential** — each regime captures and restores in turn; no
shared window. (3) **Same-frame enters** — both Active bits flip in the same
BeginSimulation playback; gravity's apply (producer, before the step) enters
first; kinematic's apply (modifier, after) reads the same enabled bit →
defers. No interleaving exists where gravity acts and kinematic doesn't see it.

**Residual hazards (where the guard cannot save you):**

- **4a — kinematic-first cross-timeline poisoning.** Kinematic timeline K
  (zeroGravity=true, no gravity active) ADDs `PhysicsGravityFactor{0}`. A
  gravity timeline G then starts: mutate path captures **0 as original**
  (poisoned). K ends while G is active: kinematic's exit guard is TRUE → the
  gravity restore is skipped — **the `{0}`-add is orphaned** (State reseeded
  next run; the knowledge that kinematic added it is gone). G ends with
  restoreOnExit=true → "restores" 0. **Permanent `PhysicsGravityFactor{0}`
  no exit will ever remove — the body falls weightless forever.**
- **4b — same-timeline shared-end clobber.** Both tracks' DisableStale jobs
  fire on the same `TimelineActivePrevious && !TimelineActive` edge, dropping
  BOTH Active bits the same frame, before the apply systems' exits. Kinematic's
  exit then sees the guard false and runs its gravity restore even though
  gravity's exit ran the same fixed step — producer-before-modifier ordering
  makes **kinematic the last writer**. Mutate-path bodies (baked factor, e.g.
  0.5): gravity restores 0.5 → kinematic overwrites with its State (the seeded
  1.0 if its enter deferred). Gravity's `restoreOnExit=false` permanence
  intent is equally defeated. ADD-path bodies are accidentally benign:
  gravity's queued RemoveComponent plays back after kinematic's in-place write
  and wins.
- **4c — the `zeroGravity=false` exit anomaly.** `OnExit` ignores the config:
  a regime whose entering clip had `zeroGravity=false` STILL runs the exit
  gravity branch with the seeded State — on a component-less body it ADDs
  `PhysicsGravityFactor{1f}` (behaviorally neutral, permanent archetype
  change); on a baked factor ≠ 1 it **overwrites the baked factor with 1.0**.
  A "pure rails" timeline on a moon-gravity body silently normalizes it to
  Earth gravity at timeline end.
- **4d — double-add: adjudicated UNREACHABLE.** Both systems ECB-adding in
  one fixed step requires gravity's Active bit enabled AND read as disabled by
  kinematic — a contradiction; and ECB `AddComponent` is set-on-duplicate
  anyway. The real first-tick artifact is the family add-path latency
  (EndFixedStep ECB plays back after that tick's physics step).

**THE DESIGNER RULE (supersedes the curriculum's softer rule):** **never put
a PhysicsKinematicOverrideTrack and a PhysicsGravityOverrideTrack on the same
body in the same timeline** — the guard protects the active window, but the
shared end makes kinematic's config-blind exit the last writer (4b), and
cross-timeline mixes orphan kinematic's added component into a poisoned
gravity capture (4a). "Prefer `zeroGravity=false` + an explicit gravity clip"
is only sufficient on add-path bodies (authored factor = 1); on a baked
factor ≠ 1 even `zeroGravity=false` exits clobber it to the seeded 1 (4c).
Hard-safe: disjoint timelines that never overlap and never end while the
other runs, or give gravity duty to exactly one track. `isKinematic=true`
already makes gravity moot while active — `zeroGravity=true` is only
load-bearing when `isKinematic=false`.

## Edge cases & traps (each source-proven, 2026-06)

- **DO rely on exit ALWAYS restoring — no permanence exists** — reflection
  shows exactly three clip fields and `OnExit` takes no config; the family's
  only track (so far) with mandatory symmetric restore.
- **DON'T expect `zeroVelocityOnEnter` per clip — it fires once per TIMELINE
  activation** — the wipe lives only in `OnEnter` and `ResetStateTrackJob`
  reseeds only while `ActiveKinematicOverride` is disabled (which only
  `DisableStaleTrackJob` does, on the timeline-deactivation edge); clip B at
  t=3 does NOT re-zero (Fired still true), and scrubbing back into A only
  re-runs stay.
- **DO trust the three-branch exit for exact archetype recovery** —
  remove-if-added / restore-in-place / re-add-original per piece (same shape
  as the gravity skill's exit); on Stage_PhysicsBall every run is ADD on
  enter, REMOVE on exit. Footnote: the mutate paths write ONLY `IsKinematic`,
  preserving an external `SetVelocityToZero` byte — but the re-add-if-vanished
  branch reconstructs `new PhysicsMassOverride{IsKinematic = original}`,
  silently resetting `SetVelocityToZero` to 0.
- **DON'T self-heal-assume the gravity piece in stay** — kinematic's stay has
  NO gravity re-add (contrast Gravity's stay, which ECB-re-adds); an external
  removal mid-regime stays removed until exit's third branch.
- **DO know gravity is moot under `isKinematic=true`** — quoted
  `PhysicsWorldBuilder.cs`: kinematic bodies get infinite `defaultPhysicsMass`
  and gravity is skipped regardless of `PhysicsGravityFactor`.
- **DON'T overlap kinematic clips** — `ClipCaps.None` ⇒ no `ClipWeight` ⇒
  first-writer-wins races (the `DiscreteMixer` is dead code, exactly like
  Filter's). Stagger them.
- **DO note the silence profile (family rule 7, fully silent variant)** —
  bake unconditional, unbound track = `Entity.Null` continue, runtime has NO
  loud failure at all (no blob ⇒ not even Filter's shared-blob warning). A
  clean console proves nothing.

## Verification protocol

1. **Fresh-load asset dump** (separate exec block; in-memory state after a
   save is not evidence) — 2 clips:
   `A_FullFreeze 0-2 isKinematic=True zeroVelocityOnEnter=True zeroGravity=True`,
   `B_RailsCarryMomentum 3-5 isKinematic=True zeroVelocityOnEnter=False
   zeroGravity=False`; both `caps=None`.
2. **Raw YAML** — three bools as 1/0 per clip sub-asset; NO blend/ease YAML
   (all four m_*Duration = 0 — ClipCaps.None, no overlap).
3. **Stage checks** — Stage_PhysicsBall fresh-load dump:
   `MotionType=Dynamic|Mass=1.000|GravityFactor=1.000` (⇒ both pieces take
   the ADD path; if GravityFactor≠1 or a MassOverride exists, paths flip to
   mutate).
4. **Binding from a RELOADED SubScene** — director table **15** entries,
   #15 = `KinematicTrack (PhysicsKinematicOverrideTrack) → Stage_PhysicsBall
   (GameObject)`; prior 14 intact (B13 Filter, B14 Gravity).
5. **Parent-scene restore** — sceneCount=1,
   `Assets/Scenes/Main Scene.unity|loaded=True|active=True|dirty=False`;
   director back to `Assets/Training/01-transform-position-track/PositionMastery.playable`.
6. **Console** — only known pre-existing entries (UnityCliConnector HTTP
   start, PerformanceTesting setup/cleanup, TestResults.xml, lessons 08–10
   `[Worker2]` EntityLinks errors). This pipeline is silent even when
   misconfigured — silence is expected, not evidence (family pattern 7).
