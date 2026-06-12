---
name: unity-track-subdirector
description: Master of SubDirectorTrack + SubDirectorClip/SubTimelineClip in vex-ee — timeline nesting via composite timers, scene-vs-asset binding rules, and the no-TimelineReferenceAuthoring-on-sub-directors rule. Use when a designer asks to "play a cutscene inside a cutscene" or "reuse a timeline as a building block".
---

# SubDirectorTrack specialist

You are the specialist for **`SubDirectorTrack`** and its two clip types
**`SubDirectorClip`** and **`SubTimelineClip`** from the CORE timeline package
(`Library/PackageCache/com.bovinelabs.timeline@4331b95d072a/`, namespace
`BovineLabs.Timeline.Authoring` — note the misspelled `Schedular` runtime folder).
Scope: exactly this track family — nesting one timeline inside another via
bake-time **composite timers** (affine clocks `subTime = hostTime × Scale + Offset`),
the two binding models (scene sub-director with its OWN tables vs asset-side
`TrackBindings`), and the activation rule for sub-directors (deliberately NO
`TimelineReferenceAuthoring`). Stage construction belongs to
`unity-stage-foundations`; transform/timescale tracks have their own skills.

All facts below were verified live in the **vex-ee** project, **2026-06**
(reflection dumps, package-source quotes, raw YAML reads of .playable/.unity
files, fresh-load read-backs via `unity-cli exec`). No play mode anywhere: all
runtime claims are source-derived; the depth≥2 caveat is explicitly a
source-reading observation, NOT runtime-tested — stated honestly below.

## Prerequisites & environment

- Act only through `unity-cli exec` / `unity-cli console`; never touch vex-ee via
  the filesystem; never enter play mode. Follow the **unity-cli skill's Safe Loop**
  (inspect → mutate once → save → verify → restore → console check) on every mutation.
- Verify the live project first:
  `unity-cli exec "return UnityEditor.SceneManagement.EditorSceneManager.GetActiveScene().path + \"|\" + Application.dataPath;"`
  → expect `Assets/Scenes/Main Scene.unity|/home/i/GitHub/vex-ee/Assets`.
- The `TrainingStage` (built by unity-stage-foundations) must exist in SubScene
  `Assets/Scenes/Main Sub Scene.unity` with `Stage_Director` (PlayableDirector +
  TimelineReferenceAuthoring) and the permanent lesson-06 addition
  **`Stage_SubDirector`** (Transform + PlayableDirector ONLY — see recipe 1).
- **The SubDirectorTrack itself takes NO binding** — no `TrackBindingType`, no
  `Bake` override; verified live `outputTargetType=null`, `GetGenericBinding=null`.
  Bindings belong to the nested content, never to this track.
- Your assets live only under `Assets/Training/06-subdirector-track/`.
  Canonical asset: `NestingMastery.playable` — track `NestingTrack`, clip
  A_SubDirector (0–5s, clipIn=0.5, timeScale=2 → Stage_SubDirector via
  ExposedReference) and clip B_SubTimeline (5–11s → PositionMastery.playable,
  TrackBindings PositionTrack→null on disk, by design dead — see Question A).

## VERIFIED facts (vex-ee, 2026-06)

Types (assembly `BovineLabs.Timeline.Authoring`, the PackageCache core — NOT the
`Packages/BovineLabs.Timeline.Core` project package):

| Type | Base | Facts |
|---|---|---|
| `SubDirectorTrack` | `DOTSTrack` | `[TrackColor(0.5,0.1,0.5)]`, `[TrackClipType(SubDirectorClip)]`, `[TrackClipType(SubTimelineClip)]`, `[DisplayName("DOTS/Sub Director Track")]`. **NO `TrackBindingType`**, no own fields — pure container. |
| `SubDirectorClip` | `DOTSClip` | `ClipCaps.ClipIn \| SpeedMultiplier` (live: `caps=ClipIn, SpeedMultiplier`; no Blending). The scene-friendly clip. |
| `SubTimelineClip` | `DOTSClip` | Same caps. Private `OnValidate()` → `TrackBindings.SyncToTimeline(Timeline)`. The asset-only clip. |
| `TrackKeyBindings` | struct | `List<TrackKeyPair> Bindings`; `FindObject(track)` keys by TrackAsset identity (`FindIndex(x => x.Track == asset)`); `SyncToTimeline` scaffolds missing pairs / prunes dead ones, PRESERVING `Target` on survivors. |
| `TrackKeyBindings.TrackKeyPair` | struct | `TrackAsset Track; UnityEngine.Object Target` — `Target` is a **plain direct Object reference** (the scene-vs-asset boundary, see edge cases). |

### Clip fields
| Member | Type | Default | Meaning |
|---|---|---|---|
| `SubDirectorClip.SubDirector` | `ExposedReference<PlayableDirector>` | unset (`exposedName=':0'`) | Resolved through the HOST director's scene table at bake; null → SILENT skip |
| `SubDirectorClip.DefaultClipDuration` | `[HideInInspector] double` | **5** (`TimelineClip.kDefaultClipDurationInSeconds`) | **ERRATUM: an earlier curriculum draft said 1; verified 5** (fresh clip seeded `duration=5`, YAML `DefaultClipDuration: 5`). Seeds UI clip length only; the editor updates it to the referenced timeline's duration |
| `SubTimelineClip.Timeline` | `TimelineAsset` | null | The embedded asset; null → SILENT skip. Asset→asset ref, persists fine |
| `SubTimelineClip.TrackBindings` | `TrackKeyBindings` | empty | Per-track targets for the embedded asset's DOTS tracks — ASSET targets only |
| `SubTimelineClip.duration` (override) | `double` | `Timeline != null ? Timeline.duration : base.duration` | Property-level inheritance ONLY; the TimelineClip is seeded 5s at `CreateClip`, BEFORE you can assign `Timeline` from code — set `clip.duration` yourself |

### Package sample reference shape (`Sample~/Timelines/Timeline1.playable`)

```yaml
  m_Name: SubDirectorClip
  SubDirector:
    exposedName: 3db83e7dce6d507429222c35393a05e3
    defaultValue: {fileID: 0}
  DefaultClipDuration: 5
```

### Bake path (source-quoted)

`SubDirectorClip.Bake` — silent-skip guard + director switch:

```csharp
var player = this.SubDirector.Resolve(context.Director);   // host director's scene table
if (player != null)                                        // unset/missing -> SILENT skip
{
    ...
    context = context.CreateCompositeTimer();
    context.Director = player;                             // nested timeline resolves against SUB-director
    PlayableDirectorBaker.ConvertPlayableDirector(context, context.Clip!.GetSubTimelineRange());
```

`SubTimelineClip.Bake` — silent-skip guard + NO director:

```csharp
if (this.Timeline != null)                                 // null -> SILENT skip
{
    ...
    var newContext = context.CreateCompositeTimer();
    newContext.Director = null;                            // bindings come ONLY from TrackBindings
    foreach (var track in this.Timeline.GetDOTSTracks(context.Baker))
    {
        ...
        newContext.Binding = context.GetBinding(track, this.TrackBindings.FindObject(track));
        PlayableDirectorBaker.ConvertTrack(newContext, range);
```

`GetBinding`: `trackBinding != null ? Baker.GetEntity(...) : Entity.Null` — a null
target means the embedded track bakes with `Binding = Entity.Null`, a silent no-op.

### CompositeTimer — fields and the affine math

`CreateCompositeTimer` (ConversionContext.cs) bakes, per nesting clip:
`offset = clipIn − start·timeScale`, `scale = timeScale`, composed with any
ancestor composite and re-anchored to the ROOT timer:

```csharp
if (context.SharedContextValues.CompositeTimers.TryGetValue(context.Timer, out var parent))
{
    parentScale = parent.Scale; parentOffset = parent.Offset;
    masterTimer = parent.SourceTimer;          // <- chains to the ROOT timer, not the immediate parent
}
var composite = new CompositeTimer
{
    SourceTimer = masterTimer,
    Offset = offset + (parentOffset * scale),
    Scale = scale * parentScale,
    ActiveRange = { Start = (range.Start / parentScale) - parentOffset,
                    End   = (range.End   / parentScale) - parentOffset },
};
```

Runtime (TimerUpdateSystem.cs, `Schedular` namespace):

```csharp
timer.Time = (source.Time * composite.Scale) + composite.Offset;
timer.DeltaTime = source.DeltaTime * composite.Scale;
var active = source.Time >= composite.ActiveRange.Start && source.Time < composite.ActiveRange.End;
```

Root timers tick by clock (`[WithNone(typeof(CompositeTimer))]` — composites never
tick themselves); composites are recomputed every frame by recursive descent
through `CompositeTimerLink` buffers, flipping `TimelineActive` on the composite
and all its linked track/clip entities as the parent clock enters/leaves ActiveRange.

**Worked example — Clip A (clipIn=0.5, start=0, timeScale=2, window 0–5s):**

- `offset = clipIn + (−start × timeScale) = 0.5 + (−0 × 2) = 0.5`
- Parent is the host ROOT timer (not composite) → `parentScale=1, parentOffset=0`
- **`CompositeTimer { SourceTimer = root, Offset = 0.5, Scale = 2, ActiveRange = [0, 5) }`**
- Runtime: `subTime = hostTime × 2 + 0.5`. Host t=0 → 0.5s; t=1 → 2.5s; t=2.25 → 5.0s
  (ScaleMastery's 5s content exhausted at host 2.25s); the timer keeps advancing to
  10.5 at host t=5 but no nested clip is active past 5s. Matches
  `GetSubTimelineRange = [0.5, 10.5]`.
- Sub-sub-nesting (clip at start s₂, clipIn c₂, scale k₂ inside the nested asset):
  `SourceTimer = ROOT`, `Offset = (c₂ − s₂k₂) + 0.5·k₂`, `Scale = 2k₂` —
  bake-time composition is exact root-relative math.

## Canonical recipe 1 — the scene-side sub-director (Stage_SubDirector)

Empty GameObject under `TrainingStage` in the SubScene (SubScene bracket per
unity-stage-foundations), exactly `Transform + PlayableDirector`:
`playableAsset = Assets/Training/02-transform-scale-track/ScaleMastery.playable`,
`playOnAwake = false`, ITS OWN binding `SetGenericBinding(ScaleTrack,
Stage_Actor.transform)`, and **NO TimelineReferenceAuthoring** (see edge cases).
Fresh-load proof (verbatim from the report):

```
FRESH|Stage_SubDirector|components=UnityEngine.Transform,UnityEngine.Playables.PlayableDirector
FRESH|playableAsset=Assets/Training/02-transform-scale-track/ScaleMastery.playable|playOnAwake=False
FRESH|binding[ScaleTrack]=Stage_Actor (UnityEngine.Transform)
FRESH|TimelineReferenceAuthoring=False
```

The sub-director owns its own binding — that is the entire point of the
SubDirectorClip pattern: nested bindings/exposed refs resolve against the
SUB-director's scene tables.

## Canonical recipe 2 — "play that scene cutscene inside this one" (SubDirectorClip, scene-friendly)

Verbatim from the report:

1. Scene side: give the nested cutscene its own GameObject with a `PlayableDirector`
   (`playOnAwake=false`, NO TimelineReferenceAuthoring), assign its TimelineAsset, and set
   ITS OWN bindings (`subDirector.SetGenericBinding(track, sceneObject)`).
2. Host side: `timeline.CreateTrack<BovineLabs.Timeline.Authoring.SubDirectorTrack>(null, "...")`,
   `track.CreateClip<BovineLabs.Timeline.Authoring.SubDirectorClip>()`; position the clip;
   optionally `clipIn`/`timeScale` (caps: ClipIn | SpeedMultiplier; no blending).
3. Wire two-sided (rule 5g): mint `exposedName` GUID on the clip asset → `SaveAssets()`;
   `hostDirector.SetReferenceValue(name, subDirector)` → `SaveScene()`. TWO saves.
4. Verify from fresh loads: YAML `exposedName:` non-empty in the .playable, the GUID entry
   in the scene's `m_ExposedReferences`, `GetReferenceValue → idValid=True`.
5. Leave the SubDirectorTrack itself unbound — that is correct.

On-disk proof of step 3 (both sides):

```yaml
# NestingMastery.playable (asset side):
  SubDirector:
    exposedName: 6902b47b-85fa-401f-bf2c-9cb9dd947e28
    defaultValue: {fileID: 0}
# Main Sub Scene.unity (scene side, Stage_Director's table):
  m_ExposedReferences:
    m_References:
    - 6902b47b-85fa-401f-bf2c-9cb9dd947e28: {fileID: 808433437}   # Stage_SubDirector's PlayableDirector
```

## Canonical recipe 3 — "embed a timeline asset as a building block" (SubTimelineClip, asset-only)

Verbatim from the report:

1. `track.CreateClip<BovineLabs.Timeline.Authoring.SubTimelineClip>()`; set
   `asset.Timeline = theTimelineAsset` (asset→asset ref, persists fine); set
   `clip.duration` yourself (the asset's duration only feeds the `duration` property).
2. `TrackBindings`: one `TrackKeyPair` per DOTS track in the embedded asset (OnValidate's
   `SyncToTimeline` will scaffold the list in the editor). `Target` may ONLY be an asset
   Object (prefab etc.) — scene objects null silently to `{fileID: 0}` on save (§3).
3. For scene targets, don't fight it: use Recipe 1, or an EntityLinks track inside the
   embedded timeline.

## Edge cases & traps (each proven live or source-quoted, 2026-06)

- **DON'T put scene objects in `TrackKeyPair.Target` — they die `{fileID: 0}`** —
  `Target = Stage_Actor.transform` read back fine in memory, but after `SaveAssets()`
  the YAML held `Target: {fileID: 0}` and a fresh load read `Target=NULL`, no warning.
- **DO use asset targets in TrackBindings — they survive** — `Target = ScaleMastery`
  persisted as `{fileID: 11400000, guid: 68555533…, type: 2}` and fresh-loaded intact.
- **DO treat SubDirectorClip as THE scene-friendly nesting clip** — its scene-side
  sub-director owns real scene binding tables + `m_ExposedReferences`, reached via
  ExposedReference, the one legal asset→scene bridge; SubTimelineClip is asset-only.
- **DON'T put TimelineReferenceAuthoring on sub-directors** — `PlayableDirectorBaker`
  bakes EVERY director with a TimelineAsset unconditionally (only gate:
  `if (director.playableAsset is not TimelineAsset) return;`), so the sub-timeline
  bakes twice regardless (independently + nested); the marker's only consumer is
  ACTIVATION logic (`WithAll<TimelineReference>` → `SetComponentEnabled<TimelineActive>(true)`)
  — with the marker, the independent root-timer copy would play IN PARALLEL with the
  host-driven nested copy, double-driving the same target. Without it, the independent
  copy sits inert (`TimelineActive` present-but-disabled from bake). The HOST keeps its
  TimelineReferenceAuthoring — that is what starts the whole nested tree.
- **DON'T expect warnings on unset references — silent skip** — `if (player != null)` /
  `if (this.Timeline != null)` are the only guards; temp clips with unset refs saved,
  reloaded, baked nothing, console clean.
- **DON'T create nesting cycles — there is NO recursion guard** — `SubDirectorClip.Bake
  → ConvertPlayableDirector → ConvertTracks → SubDirectorClip.Bake → …` has no depth
  counter or visited set (all three files quoted); a self-(transitively-)nesting
  timeline means unbounded bake recursion — keep nesting a DAG, never point a clip at
  an ancestor timeline.
- **DON'T trust depth≥2 with non-identity transforms (source-derived, NOT runtime-tested)** —
  `TimerUpdateSystem` passes the PARENT's already-transformed time to the child while
  child Offset/Scale are baked root-relative (`SourceTimer` is never read in the update),
  double-applying the parent transform when parent Offset≠0 or Scale≠1; at depth 1
  parent time == root time so everything is exact — keep clips at start=0/clipIn=0/
  timeScale=1 when nesting deeper than one level until proven otherwise.
- **DO set `clip.duration` yourself — duration inheritance is only a CreateClip seed** —
  a fresh SubTimelineClip TimelineClip is seeded 5s (Timeline still null at CreateClip);
  after assigning Timeline, only the clip ASSET's `duration` property read ~6
  (5.999999999999 = PositionMastery.duration); the TimelineClip must be set explicitly.
- **DO remember DefaultClipDuration = 5, not 1** — seeded from
  `TimelineClip.kDefaultClipDurationInSeconds`; it only seeds UI clip length.
- **DON'T "fix" the unbound SubDirectorTrack** — `outputTargetType=null`,
  `GetGenericBinding=null` is correct and permanent.
- **DO rely on director tables surviving playableAsset swaps** — after restoring
  PositionMastery, all 4 scene bindings AND both exposed-ref entries read back intact
  (re-confirmed for the third lesson running).

## Verification protocol

1. **Fresh-load asset dump**: `AssetDatabase.LoadAssetAtPath` the .playable in a NEW
   exec block; dump tracks/clips (name, start/duration/clipIn/timeScale, caps,
   `DefaultClipDuration`, `Timeline`, each `TrackKeyPair`). In-memory state after a
   save is not evidence — the scene-target "lie" proves it.
2. **Raw YAML check**: `exposedName:` non-empty on every SubDirectorClip;
   `Target:` entries are `{fileID: 11400000, guid: …}` (asset) not `{fileID: 0}` (dead);
   clip timing block (`m_Start/m_ClipIn/m_Duration/m_TimeScale`) matches intent.
3. **Scene-side check from a RELOADED SubScene**: the GUID appears in
   `m_ExposedReferences` of the HOST director and
   `GetReferenceValue → idValid=True`; the sub-director's own bindings intact
   (`binding[ScaleTrack]=Stage_Actor`), `playOnAwake=False`,
   `TimelineReferenceAuthoring=False`.
4. **No-binding proof**: `GetGenericBinding(subDirectorTrack) == null` AND the host
   director's pre-existing binding entries intact.
5. **Parent-scene restore**: end with `sceneCount=1`,
   `scene[0]=Assets/Scenes/Main Scene.unity|loaded=True|active=True|dirty=False`,
   director restored to its prior playableAsset.
6. **Console**: `unity-cli console --filter error` must show nothing new; known
   pre-existing vex-ee entries are UnityCliConnector HTTP server start,
   PerformanceTesting IPrebuildSetup/IPostBuildCleanup, TestResults.xml save.
