---
name: unity-track-essence-event
description: Master of TimelineEssenceEventTrack + clip in vex-ee — firing transient ConditionEvents at entities from the timeline (the cutscene→reaction bridge), routeTo/routeLink resolution, the all-silent Essence guard rule. Use when a designer asks "at this moment, fire the OnX event at this thing".
---

# TimelineEssenceEventTrack specialist

You are the specialist for **`TimelineEssenceEventTrack`** and
**`TimelineEssenceEventClip`** from `Packages/BovineLabs.Timeline.Essence`,
namespace `BovineLabs.Timeline.Essence.Authoring`. Scope: exactly this track —
one clip = one edge-triggered write of a transient `ConditionEvent` (key +
amount) into a resolved entity's event buffer, so Reaction conditions keyed by
that event can respond. This is the FIRST Essence track, so this skill also
carries the **ESSENCE FAMILY REFERENCE** (as
`unity-track-entitylink-copytransform` does for its family) — three facts the
topic-12 (Stat) and topic-13 (Intrinsic) skills cross-reference here:

1. **The corrected all-silent guard matrix** (all three bake guards quoted
   below): the EntityLinks "loud bake / silent runtime" rule does NOT carry
   over — **the Essence family is silent EVERYWHERE** (not a single bake-guard
   `Debug.LogError` in the package; grep verified).
2. **The Essence resolver semantics** (quoted below): `Target.None` behaves
   like `Self`; `routeTo` is mandatory and resolves FIRST (a dead routeTo
   kills the event; the link can never rescue it); `routeLink` is an override
   that wins when it resolves and **falls back to routeTo, still firing**.
3. **The dead `RouteLinkKey` on Stat**: baked but DEAD at runtime —
   `TimelineEssenceStatSystem` resolves with `TryResolveTarget` only, never
   `TryResolveLinkedTarget`. Only Event and Intrinsic route through links.

All facts verified live in the **vex-ee** project, **2026-06** (reflection
dumps, package-source quotes via `unity-cli exec`, raw YAML reads, fresh-load
read-backs, a real forced bake for the silent-null demo); no play mode —
runtime claims are source-derived.

## THE HEADLINE — transient, silent, and summed

Everything this track writes **evaporates the same frame it is consumed** —
the opposite of the EntityLinks family's persistent mutations; nothing to
undo, ever. Every failure mode is **silent** (null event, null link, dead
routeTo): a clip that "does nothing" with a clean console is ALWAYS a
config/resolution problem. And same-frame duplicates are **pre-summed**: ONE
`Trigger` per (receiver, key) — the buffer rejects and dev-logs duplicates.

## Prerequisites & environment

- Act only through `unity-cli exec` / `unity-cli console`; never touch vex-ee
  via the filesystem; never enter play mode. Follow the **unity-cli skill's
  Safe Loop** (inspect → mutate once → save → verify → restore → console
  check). Verify the live project first:
  `unity-cli exec "return UnityEditor.SceneManagement.EditorSceneManager.GetActiveScene().path + \"|\" + Application.dataPath;"`
  → expect `Assets/Scenes/Main Scene.unity|/home/i/GitHub/vex-ee/Assets`.
- The `TrainingStage` (unity-stage-foundations) must exist in SubScene
  `Assets/Scenes/Main Sub Scene.unity`: **Stage_Actor** carries
  `TargetsAuthoring` (Target=Stage_Target) AND `EntityLinkSource`
  (Root=Stage_LinkRoot); **Stage_LinkRoot** bakes the `EntityLinkEntry` buffer
  `{Key=10, Target=Stage_Actor}`. EntityLink resolver fundamentals live in
  `unity-track-entitylink-copytransform`.
- **NEVER create schema/event assets** — reuse the **152**
  `ConditionEventObject` assets under `Assets/Settings/Schemas/Events/`
  (inventory below; proven-innocuous choice: `OnGrabCompleted`).
- Your assets live only under
  `Assets/Training/11-timeline-essence-event-track/`. Canonical asset:
  `EssenceEventMastery.playable` — one track `EssenceEventTrack`, clips
  A_FireAtSelf (1–1.5s), B_FireViaLink (3–3.5s), C_Accumulate (3–3.5s,
  deliberately overlapping B on the same track); fields in the protocol.

## VERIFIED facts (vex-ee, 2026-06)

| Type | Base | Facts |
|---|---|---|
| `TimelineEssenceEventTrack` | `DOTSTrack` | sealed, EMPTY body — no Bake override, no fields. `[TrackClipType(TimelineEssenceEventClip)]`, `[TrackBindingType(BovineLabs.Reaction.Authoring.Core.TargetsAuthoring)]`, `[TrackColor(0.9,0.4,0.2)]`, `[DisplayName("BovineLabs/Essence/Timeline Event")]` |
| `TimelineEssenceEventClip` | `DOTSClip` | sealed, `ClipCaps.None` (no blend/ease), `duration => 1` (seed only) |
| System | `TimelineEssenceEventSystem` | `[UpdateInGroup(TimelineComponentAnimationGroup)]`, `[UpdateAfter(typeof(EntityLinkTargetPatchSystem))]` — events see same-frame TargetPatch retargets |

### Clip fields — camelCase (reflection + fresh-instance defaults)

| Field | Type | Default | Meaning |
|---|---|---|---|
| `routeTo` | `BovineLabs.Reaction.Data.Core.Target` | **`Self` (4)** | Who receives the event (resolved through the binding's `Targets`). Self default — friendlier than the EntityLinks family's defaults; a fresh clip on a bound track already routes somewhere real. |
| `routeLink` | `EntityLinkSchema` | null | OPTIONAL link override: hunt the link map starting at the routeTo-resolved entity; the linked entity wins if found. Null is silent (`TryGetKey` return value IGNORED). |
| `conditionEvent` | `BovineLabs.Reaction.Authoring.Conditions.ConditionEventObject` | null | The event key asset. `.Key` → `ConditionKey` (int). Null is SILENT at bake AND runtime-filtered. |
| `value` | `int` | 1 | The event amount (summed across same-frame duplicates). Never author 0 (dev assert). |

Bake (quoted from `TimelineEssenceEventClip.Bake`, package source):

```csharp
EntityLinkAuthoringUtility.TryGetKey(routeLink, out var linkKey);   // return value IGNORED
var builder = new EssenceEventBuilder
{
    RouteTo = routeTo,
    RouteLinkKey = linkKey,
    Event = conditionEvent ? conditionEvent.Key : ConditionKey.Null,  // SILENT null guard
    Value = value
};
```

→ adds `TimelineEssenceEventData { Target RouteTo; ushort RouteLinkKey;
ConditionKey Event; int Value; }` to the clip entity. BOTH guards are silent —
the EntityLinks clips LogError on the same null-schema condition. Events land
in the target's `ConditionEvent` buffer — `[InternalBufferCapacity(0)] struct
ConditionEvent : IDynamicHashMap<ConditionKey, int>` — a per-entity key→amount
map, plus the `EventsDirty` enableable flag.

### Event key assets (inventory)

`ConditionEventObject : ConditionSchemaObject` — fields `key` (ConditionKey),
`customDataType`; props `IsEvent=True`, `ConditionType="event"`. **152** assets
found by `FindAssets("t:ConditionEventObject")`, all under
`Assets/Settings/Schemas/Events/`. Example:

```
ASSET|Assets/Settings/Schemas/Events/OnGrabCompleted.asset|guid=88e814b9160342b7a8cd01be0478c306
FIELD|key|...|val=ConditionKey 94      (YAML: key: { Value: 94 })
```

## FAMILY REFERENCE — the resolver, quoted

`TimelineEssenceResolver` (`BovineLabs.Timeline.Essence.Data/TimelineEssenceResolver.cs`).
`TryResolveTarget(target, binding, ...)`: `if (target is Target.Self or
Target.None) { resolved = binding; return true; }` — else `resolved =
t.Get(target, binding); return resolved != Entity.Null;` from the binding's
`Targets` (no `Targets` component → false). Then:

```csharp
public static bool TryResolveLinkedTarget(Target targetMode, ushort linkKey, Entity self, ..., out Entity resolved)
{
    resolved = Entity.Null;
    if (!TryResolveTarget(targetMode, self, targetsLookup, out var target))
        return false;
    if (linkKey == 0)
    {
        resolved = target;
        return true;
    }
    if (EntityLinkResolver.TryResolve(target, linkKey, sources, links, out var linked))
    {
        resolved = linked;
        return true;
    }
    resolved = target;
    return true;
}
```

**Precedence verdict**: `routeTo` resolves FIRST and is load-bearing; the link
is a conditional override layered on top. (1) routeTo fails (slot
`Entity.Null`, or no `Targets` for Owner/Source/Target/Custom modes) →
**total failure, event not fired, regardless of routeLink**. (2) routeLink
null/id-0 → the routeTo entity receives. (3) routeLink set and the hunt
RESOLVES → **the linked entity wins** — the hunt starts AT the
routeTo-resolved entity: root-hop via its `EntityLinkSource.Root` (or itself
if none), then linear `EntityLinkEntry{Key,Target}` buffer search. (4) the
hunt FAILS → **graceful fallback to routeTo, still fires** (`resolved =
target; return true;`) — contrast EntityLinks, where the same failure is a
skip. Deviations: (a) **`Target.None` behaves like `Self`** here (in
`Targets.Get`, None → `Entity.Null`); (b) `routeTo` plays BOTH the family's
`readRootFrom` role AND the fallback destination — one knob, two jobs.

## FAMILY REFERENCE — the all-silent guard matrix

All three bake guards quoted from live package source (2026-06):

| Clip | Bake guard (quoted) | Loudness | Consequence |
|---|---|---|---|
| Event | `Event = conditionEvent ? conditionEvent.Key : ConditionKey.Null` | **SILENT, bakes through** | component added with Null key; filtered per-frame at runtime |
| Intrinsic | `Intrinsic = intrinsic ? intrinsic.Key : default(IntrinsicKey)` | **SILENT, bakes through** | component added with key 0; runtime filter `if (data.Intrinsic.Value == 0 ...) return;` |
| Stat | `if (stat == null) return;` (first line of Bake — skips the builder AND `base.Bake`) | **SILENT, bake-ABORT** | NO component added; clip entity inert. (Runtime also guards `if (data.Stat.Value == 0 ...) return;`.) |

Family rule, final form: **EntityLinks = loud bake / silent runtime; Essence =
silent EVERYWHERE.** Within Essence the guards differ only in WHERE the no-op
lands: Event/Intrinsic bake a runtime-filtered component; Stat aborts at bake.

## Runtime semantics (`TimelineEssenceEventSystem`, source-quoted)

Edge-triggered one-shot, three phases. **GatherJob** (parallel,
`[WithAll(ClipActive)][WithDisabled(ClipActivePrevious)]`) fires only on the
activation frame; it returns early `if (data.Event == ConditionKey.Null ||
binding.Value == Entity.Null)`, otherwise resolves the receiver via
`TryResolveLinkedTarget` and accumulates `(target, EventAmount(Event, Value))`
in a multi-hash-map plus a `UniqueKeys` set. **GetKeysJob** dedupes the targets
into a list. **ApplyJob** (per distinct receiver) sums same-key amounts in a
`FixedList4096Bytes<EventAmount>` (`existing.Amount += value.Amount;`) then
calls `writer.Trigger(e.Event, e.Amount)` — ONE Trigger per (target, key);
past ~512 distinct keys per target per frame, overflow keys Trigger
immediately without joining the sum.

`ConditionEventWriter.Trigger` (Reaction package, quoted): returns on
`ConditionKey.Null` (the runtime null-event filter), asserts
`Check.Assume(value != 0, "Can't write 0 value event")`, then
`conditionEvents.AsMap().TryAdd(key, value)` — under collections checks a false
return logs `Trying to write an event {key.Value} multiple times in a frame.`
The pre-sum exists precisely to avoid this.

**The clearing path — events are TRANSIENT.** The CONSUMER clears:
`ConditionEventWriteSystem` matches each `ConditionEvent` entry against the
entity's `EventSubscriber` map, sets matched subscribers' `ConditionActive`
bits, then disables `EventsDirty` and runs `conditionEvents.Clear();`;
downstream `ConditionEventResetSystem` masks the bits back off (`active.Value
= active.Value.BitAnd(reset.Value);`) — both are one-frame transients.

## The timeline → event → reaction bridge (quoted from the report)

> This track is the designed bridge between cutscenes and gameplay logic. A
> designer authors a `ReactionAuthoring` on a gameplay entity whose condition
> list includes an event-type condition keyed by a `ConditionEventObject`
> (e.g. OnGrabCompleted, key 94); baking registers that condition as an
> `EventSubscriber` entry on the entity, keyed by `(ConditionKey,
> conditionType=event)`. When the timeline clip's activation edge fires,
> `TimelineEssenceEventSystem` resolves the receiving entity (routeTo +
> optional routeLink), sums same-frame amounts, and `Trigger`s the key into
> that entity's `ConditionEvent` hash-map buffer. `ConditionEventWriteSystem`
> then matches the entry against subscribers, runs the comparison
> (`ReactionUtil.EqualityCheck` against `ConditionComparisonValue`, with
> optional value storage/accumulation via `ConditionValues`), and atomically
> sets the subscriber's `ConditionActive` bit — which is what flips a Reaction
> active and runs its actions (spawn, destroy, etc.). The event itself is
> cleared the same frame it is consumed and the condition bit is masked back
> off by `ConditionEventResetSystem`, so a cutscene can say "NOW the grab
> completed" and gameplay reacts exactly once — no cleanup clip, no lingering
> state, no direct asset→scene reference anywhere in the chain (the clip
> holds only asset→asset refs: the event key asset and the link schema asset).

## Canonical recipes (verbatim from the report)

**Fire-event (simplest, fire-at-self)**: bind an `EssenceEventTrack`
("BovineLabs/Essence/Timeline Event") to the target's `TargetsAuthoring`
(`director.SetGenericBinding(track, comp)`); one clip, set `conditionEvent` to
a project event asset (reuse `Assets/Settings/Schemas/Events/*` — never create
keys), leave `routeTo = Self`, `value = 1`. The bound entity receives the
event at the clip's start edge — the ONLY timing that matters.

**Routed-event (fire-via-link)**: `routeTo = Target/Owner/Source/Custom` sends
the event through the binding's `Targets` slots — make sure the slot is
assigned in `TargetsAuthoring` or the event is silently lost (failure path 1).
Add `routeLink = <EntityLinkSchema>` to redirect to a link-map entry: the hunt
starts at the routeTo entity, so point routeTo at something carrying
`EntityLinkSource` (or at the link root itself); if the link misses, the
routeTo entity receives — design routeTo to be the acceptable fallback.

**Accumulate (same-frame)**: N clips, same event key, resolving to the same
entity, same start time (overlap is fine — even on one track via API) →
receiver sees ONE event with the summed value. Use for "3 grabs completed at
once" semantics. Never author `value = 0` or same-frame sums of 0 (assert).

**Listening side**: the receiver needs the Reaction stack (`LifeCycleAuthoring`
+ `TargetsAuthoring` + `ReactionAuthoring`) with an event-type condition on the
same `ConditionEventObject`; the reaction activates the frame after the clip
edge and the event evaporates — one-shot by construction.

## Edge cases & traps (each proven live or source-quoted, 2026-06)

- **DON'T trust a clean console — every guard is silent; verify YAML** — a
  real forced bake of a null-`conditionEvent` temp clip produced ZERO
  LogErrors in the worker log (the same log holds lessons 08–10's loud
  EntityLinks errors for comparison); only fresh-load/raw-YAML proves config.
- **DO expect re-fires per activation edge; events auto-clear** —
  `[WithAll(ClipActive)][WithDisabled(ClipActivePrevious)]` matches each
  off→on transition: clip length irrelevant, clip end does nothing, loops and
  scrubs re-fire; the buffer clears the same frame — nothing to compensate.
- **DO rely on pre-summing — a duplicate same-frame Trigger would error** —
  `TryAdd` rejects duplicates and dev-logs `Trying to write an event ...
  multiple times in a frame.`; ApplyJob sums before ONE Trigger per pair.
- **DON'T author value=0 or let same-frame values sum to 0 (e.g. +1 and -1)**
  — `Check.Assume(value != 0, "Can't write 0 value event")` trips in dev
  builds.
- **DON'T expect routeLink to rescue a dead routeTo — the event is lost** —
  `if (!TryResolveTarget(...)) return false;` runs before the link hunt; an
  unassigned Targets slot silently drops the event regardless of the link. (A
  FAILED link still fires at routeTo — proven live by clip B: the hunt from
  Stage_Target fails, Stage_Target receives anyway.)
- **DO know same-track overlap is accepted via API** — B and C both 3.0–3.5s
  on ONE track: `CreateClip` accepted it and it survived save + fresh reload
  (`m_Start: 3` twice in YAML); the DOTS bake treats clips independently.
- **DON'T create schema/event assets, ever** — reuse the 152
  `ConditionEventObject`s under `Assets/Settings/Schemas/Events/`
  (OnGrabCompleted key=94 is the proven-innocuous choice).

## Verification protocol

1. **Fresh-load asset dump**: `AssetDatabase.LoadAssetAtPath` the .playable in
   a NEW exec block; dump track + clips. Expected: `A_FireAtSelf 1-1.5
   routeTo=Self(4) routeLink=null event=OnGrabCompleted key=94 value=1`;
   `B_FireViaLink 3-3.5 routeTo=Target(1) routeLink=Schema_Actor id=10` (same
   event, value=1); `C_Accumulate 3-3.5 routeTo=Target(1) routeLink=null`
   (same event, value=2). In-memory state after a save is not evidence.
2. **Raw YAML check**: clip B `routeTo: 1`, `routeLink: {fileID: 11400000,
   guid: 3b375c42affc2917f956d01310d31894, type: 2}` (Schema_Actor),
   `conditionEvent: {fileID: 11400000, guid:
   88e814b9160342b7a8cd01be0478c306, type: 2}`, `value: 1`; camelCase names.
3. **Event-asset check**: OnGrabCompleted YAML `key: { Value: 94 }`;
   `FindAssets("t:ConditionEventObject")` should report 152 under
   `Assets/Settings/Schemas/Events/` (re-count — it has drifted before).
4. **Binding check from a RELOADED SubScene**:
   `EssenceEventTrack(TimelineEssenceEventTrack) → Stage_Actor
   (TargetsAuthoring)` — the component, not the Transform. Post-lesson-11 the
   director's scene-binding table is 9 entries (prior 8 preserved — keyed by
   track asset, survives playableAsset swaps).
5. **Parent-scene restore**: end with sceneCount=1,
   `Assets/Scenes/Main Scene.unity|loaded=True|active=True|dirty=False`,
   director restored to
   `Assets/Training/01-transform-position-track/PositionMastery.playable`.
6. **Console**: `unity-cli console --filter error` shows nothing new (known
   pre-existing: UnityCliConnector HTTP start, PerformanceTesting
   setup/cleanup, TestResults.xml save, lessons 08–10's `[Worker2]` bake
   errors). This track adds NO errors even when misconfigured — silence is
   expected, not evidence.
