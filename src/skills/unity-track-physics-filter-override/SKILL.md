---
name: unity-track-physics-filter-override
description: Master of PhysicsFilterOverrideTrack + clip in vex-ee — while-timeline-active collision-filter blob mutation, the ForceUnique requirement, the timeline-end-not-clip-end restore. Use when a designer asks "make this phase through walls / stop colliding with X during this clip".
---

# PhysicsFilterOverrideTrack specialist

You are the specialist for **`PhysicsFilterOverrideTrack`** and
**`PhysicsFilterOverrideClip`** from `Packages/BovineLabs.Timeline.Physics`,
namespace `BovineLabs.Timeline.Physics.Authoring.Filters` — the FIRST
Physics-family track. While the override regime is active, the bound body's
`PhysicsCollider` BLOB is mutated **in place** (`ptr->SetCollisionFilter`),
replacing `BelongsTo`/`CollidesWith` with the clip's raw uint masks; the
originals are captured once on first enter and restored only at **timeline**
deactivation, only if the LAST clip's `restoreOnExit` says so. GroupIndex
never touched; the program's only track (so far) writing inside a BlobAsset.

**This skill also carries the PHYSICS FAMILY SHARED PATTERNS reference for
topics 16-26** (section below): two-system split, producer/modifier groups,
the central `PhysicsTimelineBakingSystem`, the Fired machine's
timeline-activation scope, per-track overlap rules, the silence profile.
Later physics-track skills cite that section instead of re-deriving it.

All facts verified live in **vex-ee**, **2026-06** (reflection dumps,
package-source reads, raw YAML reads, fresh-load read-backs, all via
`unity-cli exec`); no play mode — runtime claims are source-derived.

## Prerequisites & environment

- Act only through `unity-cli exec` / `unity-cli console`; never touch vex-ee
  via the filesystem; never enter play mode. Follow the **unity-cli skill's
  Safe Loop**. Smoke test: return active scene path + `Application.dataPath` →
  expect `Assets/Scenes/Main Scene.unity|/home/i/GitHub/vex-ee/Assets`.
- The `TrainingStage` (unity-stage-foundations) must exist in SubScene
  `Assets/Scenes/Main Sub Scene.unity` incl. the lesson-15 physics objects.
  Binding target: **Stage_PhysicsBall** — dynamic sphere at (0,1,5),
  PhysicsBodyAuthoring (Dynamic, Mass=1) + PhysicsShapeAuthoring (sphere
  r=0.5) + LifeCycle + Targets (Target=Stage_Target). **Its shape now has
  `ForceUnique=true` — corrected AFTER lesson 15** (the lesson-time dump read
  `m_ForceUnique=False`, which would warn-and-skip at runtime); re-verify
  `m_ForceUnique` before relying on the override. Stage_TriggerZone also
  exists; it is NOT this track's binding target.
- Your assets live only under
  `Assets/Training/15-physics-filter-override-track/`. Canonical asset:
  `FilterOverrideMastery.playable` — one track `FilterOverrideTrack`, clips
  A_Ghost (0–2s, belongsTo=0, collidesWith=0, restoreOnExit=true — the
  phase-through-walls pattern), B_OnlyLayer1 (3–5s, collidesWith=2,
  belongsTo left 0xFFFFFFFF, restoreOnExit=true), C_PermanentGhost (6–7s,
  both 0, restoreOnExit=false — the permanence/poisoning exhibit).
- The track binds **the GameObject itself**, not a component
  (`director.SetGenericBinding(track, stagePhysicsBallGameObject)`); the
  director table holds 13 entries with this binding as the 13th.

## VERIFIED facts (vex-ee, 2026-06)

| Type | Facts |
|---|---|
| `PhysicsFilterOverrideTrack` | `BovineLabs.Timeline.Physics.Authoring.Filters`, assembly BovineLabs.Timeline.Physics.Authoring, sealed, EMPTY body, base `DOTSTrack`. `[TrackClipType(PhysicsFilterOverrideClip)]`, `[TrackBindingType(typeof(GameObject))]` (GameObject, not a component), `[TrackColor(0.8,0.2,0.2)]`, `[DisplayName("BovineLabs/Physics/Filter Override")]`. |
| `PhysicsFilterOverrideClip` | sealed, base `DOTSClip`, `ITimelineClipAsset`, `clipCaps => ClipCaps.None`, `duration => 1` (seed only). |
| `PhysicsFilterOverrideData` | `...Physics.Data`, IComponentData: `uint BelongsToOverride; uint CollidesWithOverride; bool RestoreOnExit;` |
| `PhysicsFilterOverrideAnimated` | `IAnimatedComponent<PhysicsFilterOverrideData>` — `AuthoredData` + `Value`, on the CLIP entity (plumbing only; nothing animates). |
| `ActiveFilterOverride` | IComponentData + **IEnableableComponent**: `PhysicsFilterOverrideData Config` — on the BINDING entity, added DISABLED at bake. |
| `PhysicsFilterOverrideState` | IComponentData: `bool Fired; uint OriginalBelongsTo; uint OriginalCollidesWith;` — on the BINDING entity. |
| Systems | `PhysicsFilterOverrideTrackSystem` (`TimelineComponentAnimationGroup`, `[UpdateAfter(EntityLinkTargetPatchSystem)]`, per rendered frame) produces the enabled `ActiveFilterOverride{Config}`; `PhysicsFilterOverrideApplySystem` (`PhysicsModifierGroup` = FixedStep, after `PhysicsSystemGroup`; query uses `IgnoreComponentEnabledState`) consumes it against the collider blob. |

### Clip fields — camelCase (reflection on a fresh instance)

| Field | Type | Default | Meaning |
|---|---|---|---|
| `belongsToOverride` | uint | `4294967295` (0xFFFFFFFF) | New BelongsTo bitmask, raw |
| `collidesWithOverride` | uint | `4294967295` (0xFFFFFFFF) | New CollidesWith bitmask, raw |
| `restoreOnExit` | bool | `True` | Restore captured masks when the override REGIME ends (timeline deactivation — NOT clip end) |

YAML serialization (raw-read verified): uints as decimal
(`belongsToOverride: 4294967295`, `collidesWithOverride: 2`), bools as 1/0
(`restoreOnExit: 0` on C). No blend/ease YAML — ClipCaps.None, no overlap.

Bake (quoted from `PhysicsFilterOverrideClip.Bake`): unconditional — no
guard, no LogError; adds exactly `PhysicsFilterOverrideAnimated{AuthoredData}`
to the clip entity, then `base.Bake`. **NO bake-time failure mode.** The
binding-entity pair comes from the central baking system (quoted; note the
`Entity.Null` continue — unbound track = total silent no-op):

```csharp
foreach (var binding in SystemAPI.Query<RefRO<TrackBinding>>()
             .WithAll<PhysicsFilterOverrideAnimated>()
             .WithOptions(EntityQueryOptions.IncludeDisabledEntities | EntityQueryOptions.IncludePrefab))
{
    var target = binding.ValueRO.Value;
    if (target == Entity.Null) continue;
    if (!em.HasComponent<ActiveFilterOverride>(target))
    {
        ecb.AddComponent<ActiveFilterOverride>(target);
        ecb.SetComponentEnabled<ActiveFilterOverride>(target, false);
        ecb.AddComponent<PhysicsFilterOverrideState>(target);
    }
}
```

### Runtime semantics (one paragraph, source-quoted)

`PhysicsFilterOverrideTrackSystem` runs the family kernel per rendered frame
(family pattern 4): `ResetStateTrackJob` resets the binding's State to
`{Fired=false}` on clip-activation edges **only if `ActiveFilterOverride` is
currently disabled**; `PrepareJob` copies `AuthoredData → Value`;
`TrackBlendImpl` (no `ClipWeight` ever baked — first writer wins);
`WriteActiveJob` ECB-enables `ActiveFilterOverride` and writes the winning
Config; `DisableStaleTrackJob` disables it ONLY on the timeline-deactivation
edge (`TimelineActivePrevious` && no `TimelineActive`).
`PhysicsFilterOverrideApplySystem` then runs the three-state Fired machine
per fixed step against the collider BLOB: **enter** (`isActive && !Fired`)
captures `ptr->GetCollisionFilter()` into State and writes the overrides via
`ptr->SetCollisionFilter(newFilter)` — direct unsafe in-place blob mutation,
GroupIndex untouched; **stay** re-applies the masks every fixed step;
**exit** (`!isActive && Fired`) restores the captured masks
`if (config.RestoreOnExit)` and clears Fired — and `!isActive` only ever
becomes true at timeline deactivation, using the LAST-written Config.
Guards: invalid collider → silent skip; shared blob → `[BurstDiscard]`
LogWarning + skip (silent in a Bursted player build).

**The mental model:** the override is NOT per-clip while-active — the regime
runs from the first filter clip's first frame to timeline deactivation. In
FilterOverrideMastery the ball goes ghost at t=0, STAYS ghost through the
2–3s gap, holds B's masks 3–6s, ghosts again 6–7s, and at timeline end the
exit runs once with C's `RestoreOnExit=false` → permanently ghost. The last
clip's flag decides for everyone.

## Canonical recipes (verbatim from the report)

- **Ghost / phase-through-walls window**: Filter Override track ("BovineLabs/
  Physics/Filter Override") bound to the body's GameObject; one clip,
  `belongsToOverride=0`, `collidesWithOverride=0`, `restoreOnExit=true`.
  PRE-FLIGHT: tick ForceUnique on the body's PhysicsShapeAuthoring or the
  clip is a warn+skip. Regime rule: with more filter clips on the timeline,
  normal collision only returns at TIMELINE end, and only if the LAST filter
  clip has restoreOnExit=true.
- **Selective collision ("only hit layer 1 during the dash")**:
  `collidesWithOverride = 2` (bit 1; raw uint bitmask — bit N = 1<<N), leave
  `belongsToOverride=0xFFFFFFFF` only if "everything" is acceptable for what
  OTHERS see of this body; both masks always write. Mutual visibility caveat:
  collision requires both bodies' filters to agree (`a.BelongsTo &
  b.CollidesWith` and vice versa) — overriding one body can't force a
  collision the other body's filter rejects. GroupIndex pairs are NOT
  overridable.
- **Permanent filter change from a beat**: `restoreOnExit=false` — but it
  poisons every later capture on that collider (see edge cases).
- **GameObject binding**: `SetGenericBinding(track, theGameObject)` —
  `GetGenericBinding` returns the GameObject verbatim (never coerces, rule
  5k); the PlayableDirectorBaker coerces GameObject→entity at bake. First
  track in the program with a plain-GameObject `TrackBindingType`.

## Edge cases & traps (each proven live or source-quoted, 2026-06)

- **DON'T expect the override on a default-baked collider — baked blobs are
  SHARED by default, the IsUnique guard skips them** — `Collider.IsUnique =>
  m_Header.ForceUniqueBlobID != k_SharedBlobID (0u)`; bake sets
  `ForceUniqueIdentifier = isUnique ? shape.ForceUniqueID : 0u`, `isUnique =
  isForceUniqueComponentPresent || shape.ForceUnique` — only the ForceUnique
  checkbox (or `ForceUniqueColliderAuthoring`) makes a baked blob unique;
  runtime-created colliders default unique. The exact warning, quoted from
  `PhysicsFilterOverrideApplySystem.ApplyJob`:
  `"PhysicsFilterOverride targets a shared collider blob; the override was
  skipped. Enable 'Force Unique' on the bound body's collider authoring so
  the filter can be modified per instance."` Runtime alternative:
  `EnsureUniqueColliderBlobTag` → `EnsureUniqueColliderSystem.MakeUnique`.
- **DON'T treat a clean PLAYER log as proof — the warning is `[BurstDiscard]`**
  — it only exists where managed code runs (editor/mono); in a fully Bursted
  player the shared-blob skip is SILENT.
- **DON'T expect restore at clip end — the exit branch fires at TIMELINE
  deactivation only** — `DisableStaleTrackJob` is the only mid-pipeline
  disabler and it keys off `TimelineActive`, not `ClipActive`; gaps hold the
  last Config (stay branch keeps re-applying), and the LAST clip's
  `restoreOnExit` decides for the whole run.
- **DON'T let a restoreOnExit=false clip near a collider you ever want back —
  capture-of-a-mutated-original poisoning across runs** — within one run the
  hazard cannot occur (Fired stays true; `ResetStateTrackJob` is blocked
  while Active is enabled, so `State.Original*` keeps the true pre-run
  masks), but run 1 ending on a permanent clip leaves mutated masks with
  Fired=false; run 2's first enter captures them as the new "original", so
  even restore=true clips now "restore" the ghost — no log, no undo except a
  compensating override or external `SetCollisionFilter`.
- **DON'T overlap two filter clips on one binding — FIRST-writer-wins, not
  blending** — `ClipBaker.AddClipBaseComponents` adds `ClipWeight` only when
  caps include Blending; under ClipCaps.None no filter clip ever has one, so
  all take `blendData.TryAdd` (fails silently on existing key) — the
  first-processed clip's whole config wins the frame, "first" being
  chunk/entity iteration order. The `DiscreteMixer{ Lerp(a,b,s) => s >= 0.5 ?
  b : a; Add(a,b) => b; }` path is dead code for this track. Applies across
  tracks too (map keyed by binding entity). Stagger filter clips.
- **DO understand why the stay phase re-applies every fixed step** — other
  systems can rebuild or overwrite the collider/filter (scale-driven rebakes,
  gameplay `SetCollisionFilter` calls); re-asserting the masks makes the
  override win the frame and makes scrubbing harmless while active
  (re-entering A mid-run just re-applies its config — capture intact). The
  mutation is invisible to change-version filters (the blob reference never
  changes) and nothing else snapshots it — exactly why the IsUnique guard
  exists: a shared-blob write would change every entity using it, prefab
  sources included.
- **DO remember GroupIndex passes through untouched** — all branches copy the
  live filter and replace only BelongsTo/CollidesWith, and State stores only
  those two; this track cannot express "join/leave collision group N", and a
  nonzero GroupIndex keeps overriding mask decisions during AND after the clip.
- **DO bind the GameObject itself** — `[TrackBindingType(typeof(GameObject))]`;
  `GetGenericBinding` returned `Stage_PhysicsBall (UnityEngine.GameObject)`
  verbatim; the baker coerces to the entity (rule 5k).

## PHYSICS FAMILY SHARED PATTERNS (for topics 16-26)

Quoted from the lesson-15 report; verified from package source, 2026-06.

**1. The two-system split: track system (producer of intent) + apply system
(consumer).** Every physics track is `<X>TrackSystem` in
`TimelineComponentAnimationGroup` (per rendered frame,
`[UpdateAfter(EntityLinkTargetPatchSystem)]`) turning clip state into an
enabled `Active<X>{Config}` on the binding entity, plus `<X>ApplySystem` in a
fixed-step group consuming it — produced per frame, applied per fixed step
(0 or more times per frame).

**2. Producer vs modifier groups — which side of the physics step.**

```csharp
[UpdateInGroup(typeof(FixedStepSimulationSystemGroup))] [UpdateBefore(typeof(PhysicsSystemGroup))]
public partial class PhysicsProducerGroup : ComponentSystemGroup {}
[UpdateInGroup(typeof(FixedStepSimulationSystemGroup))] [UpdateAfter(typeof(PhysicsSystemGroup))]
public partial class PhysicsModifierGroup : ComponentSystemGroup {}
```

Systems that FEED the simulation sit in PhysicsProducerGroup: PID
(linear+angular), Ricochet, GravityOverride, Kinematics, TriggerQuery/
Condition/Force/Instantiate, SocketReturn, ChainFollow. Systems that CORRECT
results or mutate physics state sit in PhysicsModifierGroup:
**FilterOverride**, Drag, KinematicOverride, Teleport, VelocityClamp,
VelocityOverride, ChainGrab/Reel/Release. The force accumulator deliberately
exists in BOTH groups.

**3. The Active*+State component pair on the BINDING entity, added at bake.**
One central `PhysicsTimelineBakingSystem` (BakingSystem world) walks every
clip entity carrying `<X>Animated` + `TrackBinding` and gives the TARGET
entity: `Active<X>` (IEnableableComponent, added DISABLED) + `<X>State`.
Holds for LinearPID, AngularPID, Force (+`PhysicsForceRandom`), Velocity,
Ricochet, FilterOverride, GravityOverride, VelocityClamp, KinematicOverride;
exception: Drag gets `ActiveDrag` only — no State. Force/Velocity/PID/Drag
targets also get `PendingForce` + `PendingVelocity` buffers +
`PendingVelocityReset` (disabled) — those topics write pending buffers an
accumulator drains around the step, not `PhysicsVelocity` directly.

**4. Per-track overlap rules (SharedTrackJobs.cs / TrackBlendDriver kernel).**
`TrackBlendImpl` keeps a per-binding-entity hash map; clips WITHOUT
`ClipWeight` (ClipCaps.None tracks — bake adds ClipWeight only when caps
include Blending) use `TryAdd` = first-writer-wins; clips WITH weights use
the 4-slot weight-sorted register (strict `>` insertion; full-weight tie
normalizes to s=0.5 and `DiscreteMixer` picks the later-accumulated). The
kernel's job sequence is the one in Runtime semantics above —
`TrackBlendDriver<TData,TAnimated,TActive,TMixer>` packages it; FilterOverride
hand-rolls the same sequence.

**5. The Fired state machine — and the family's real "while-active" unit.**
Enter (active && !Fired): capture originals into State, apply, Fired=true.
Stay: re-apply every fixed step (scrub-safe, fights concurrent writers).
Exit (!active && Fired): restore from State if configured, Fired=false.
Because nothing disables Active between clips, **the restore unit is the
whole timeline activation, not the clip**: first clip enters the regime,
later clips only retarget Config, gaps keep the last Config applied, and the
exit runs once at timeline deactivation using the LAST clip's Config
(including its restore flag). Expect the same shape in every capture/restore
physics track (KinematicOverride, GravityOverride, VelocityClamp...). Apply
queries use `IgnoreComponentEnabledState` and read the enabled bit per
entity — what lets the exit branch see "just disabled" entities.

**6. The IsUnique blob rule (for every track that mutates collider blobs).**
Full chain in the first edge case above. Designer checklist item for ALL
collider-mutating physics tracks: tick ForceUnique on the bound body's shape.

**7. Silence profile (family triage rule).** Bake: totally silent — no guards
exist (masks are raw uints; null binding bakes nothing onto any target).
Runtime: silent skips for null/invalid colliders and unbound tracks; the ONE
loud failure is the shared-blob warning, and only in managed builds. A clean
console proves nothing except (in editor) that the blob was unique.

## Verification protocol

1. **Fresh-load asset dump** (separate exec block; in-memory state after a
   save is not evidence) — 3 clips:
   `A_Ghost 0-2 belongsTo=0 collidesWith=0 restoreOnExit=True`,
   `B_OnlyLayer1 3-5 belongsTo=4294967295 collidesWith=2 restoreOnExit=True`,
   `C_PermanentGhost 6-7 belongsTo=0 collidesWith=0 restoreOnExit=False`.
2. **Raw YAML** — uints as decimal (`belongsToOverride: 4294967295`,
   `collidesWithOverride: 2`), bools as 1/0 (`restoreOnExit: 0` on C); no
   blend/ease YAML present (ClipCaps.None, no overlap).
3. **Stage checks** — Stage_PhysicsBall fresh-load dump: pos (0,1,5),
   `m_MotionType=Dynamic, m_Mass=1.000`, `m_ShapeType=Sphere,
   m_SphereRadius=0.500`, **`m_ForceUnique=True`** (post-lesson-15 correction
   — if False, the override warn-and-skips); Targets Target=Stage_Target.
4. **Binding from a RELOADED SubScene** — director table **13** entries,
   #13 = `FilterOverrideTrack (PhysicsFilterOverrideTrack) → Stage_PhysicsBall
   (UnityEngine.GameObject)`; prior 12 intact; entries persist across
   playableAsset swaps (keyed by track asset).
5. **Parent-scene restore** — sceneCount=1,
   `Assets/Scenes/Main Scene.unity|loaded=True|active=True|dirty=False`;
   director back to `Assets/Training/01-transform-position-track/PositionMastery.playable`.
6. **Console** — only known pre-existing entries (UnityCliConnector HTTP
   start, PerformanceTesting setup/cleanup, TestResults.xml, lessons 08–10
   `[Worker2]` EntityLinks errors). This pipeline is bake-silent even when
   misconfigured — silence is expected, not evidence (family pattern 7).
