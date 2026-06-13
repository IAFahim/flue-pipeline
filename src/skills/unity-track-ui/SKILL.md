---
name: unity-track-ui
description: "Master of the BovineLabs.Timeline.UI track family — UxmlViewTrack, UITextRevealTrack, NumberTrack, DataDisplayTrack, EssenceUITrack (+ EssenceUIClip/UssClassTrack) — driving on-screen UI (UI Toolkit / app-ui panels) FROM a DOTS timeline: spawn/teardown UXML, typewriter text reveal, show a number, show stat/intrinsic/event readouts. Two runtime families: VisualElement-mutating \"reversible effects\" (UXML/text/USS) vs ViewModel-binding HUD panels (Number/DataDisplay/EssenceUI). Portable to any project with the package; worked example from vex-ee. Use when a designer says \"during this cutscene, pop up a panel / type out a line / show the combo count / show the player's health bar\"."
---

# BovineLabs.Timeline.UI track specialist

## 1. SCOPE

You own the **UI track family** of package `com.bovinelabs.timeline.ui`, authoring namespace
`BovineLabs.Timeline.UI.Authoring`, data namespace `BovineLabs.Timeline.UI.Data`. These tracks make a
**timeline drive the on-screen UI** (Unity UI Toolkit, surfaced through BovineLabs **Anchor** app-ui panels) —
NOT the world. A designer reaches for this when they want "during this beat, show/animate something on the HUD".

Five named tracks + two siblings, splitting into TWO runtime mechanisms (the headline distinction, §2):

| Track | DisplayName | Clip | What the designer gets |
|---|---|---|---|
| `UxmlViewTrack` | `DOTS/UI/UXML View Track` | `UxmlViewClip` | Spawn a UXML view onto the screen for the clip, auto-remove on exit |
| `UITextRevealTrack` | `DOTS/UI/Text Reveal Track` | `UITextRevealClip` | Type a line into an existing text element over the clip (typewriter / instant), restore on exit |
| `UssClassTrack` | `DOTS/UI/USS Class Track` | `UssClassClip` | Add a USS class to an element for the clip, remove on exit (sibling, same mechanism) |
| `NumberTrack` | `DOTS/Number Track` | `NumberClip` | Show one integer on a bound HUD panel while active |
| `DataDisplayTrack` | `DOTS/UI/Data Display Track` | `DataDisplayClip` | Show rows of named numeric values read off a bound entity |
| `EssenceUITrack` | `DOTS/Essence UI Track` | `EssenceUIClip` | Show a player's live stats / intrinsics / fired events as HUD rows |

Stage construction belongs to `unity-stage-foundations`; the Essence number model (stats vs intrinsics, ×100
fixed point, schemas, links) belongs to `unity-track-essence-stat`/`-intrinsic` and `unity-stage-foundations` —
this skill links the readouts, it does not author the numbers. Operate per `unity-timeline-track-authoring`
(the SubScene open/save/restore bracket, discovery preamble, `PRE|` capture, undo-appendix structure,
fresh-load verification); behave per `unity-agent-protocol`; drive the editor per `unity-cli`.

## 2. PORTABLE SEMANTICS

True in ANY project containing `com.bovinelabs.timeline.ui` (depends on Anchor, Core, Reaction,
Timeline.EntityLinks, Timeline.core). Provenance tags = where PROVEN, not where they apply. Verified against
package source at `Packages/BovineLabs.Timeline.UI/` (vex-ee, 2026-06); rediscover every name in YOUR project.

### THE HEADLINE — two mechanisms, one giant shared trap

Every track here is a `DOTSTrack` whose clip is a `DOTSClip` of **`duration => 1` and `ClipCaps.None`** (text
reveal is the sole exception, below). But they split at RUNTIME into two unrelated systems:

- **A. Reversible VisualElement effects** — `UxmlViewTrack`, `UITextRevealTrack`, `UssClassTrack`. The system
  derives from `ReversibleEffectSystem<TData, TInverse, TCleanup>`: on the clip's ACTIVATION edge it calls
  `TryApply` (instantiate the UXML / capture the old text / add the class), stores an INVERSE, adds a cleanup
  tag, and on the deactivation edge calls `Revert` (remove the view / restore the text / remove the class).
  These **directly touch the live `VisualElement` tree** — they need an Anchor app root to exist at runtime.
- **B. ViewModel HUD panels** — `NumberTrack`, `DataDisplayTrack`, `EssenceUITrack`. The system is a plain
  `ISystem` holding a `UIHelper<TViewModel, TViewModel.Data>`; each frame it scans the ACTIVE clips, folds
  their data into the ViewModel binding, and sets `IsVisible`. The number/rows appear on whatever panel binds
  that ViewModel; **nothing happens unless the project's UI binds the ViewModel** (`NumberViewModel`,
  `DataDisplayViewModel`, `EssenceUIViewModel`). There is no per-element targeting — the panel is the target.

**THE GIANT SHARED TRAP: a perfectly-baked UI track is SILENT without an Anchor app + the right UI asset.**
Family A needs `AnchorApp.Current.RootVisualElement` (`ReversibleEffectSystem.OnUpdate` early-returns if null).
UXML additionally needs `IUXMLService` registered (`UxmlViewTrackSystem.Ready` returns false otherwise) AND the
`UxmlKey` to resolve to a real UXML; text/USS need the `TargetId` element to actually exist in the live tree.
Family B needs a panel that binds the ViewModel. None of this is in the .playable — verify the project ships a
`TimelineUIAppBuilder`/Anchor app, the UXML registry, and the panels, or the track does nothing and you cannot
prove success from authoring alone (say so honestly — protocol §6).

### Clip field tables (verified field NAMES, types, defaults from source)

**UxmlViewClip** (`UxmlViewClip.cs`) — public string fields, PascalCase serialized names:

| Field | Type | Default | Meaning |
|---|---|---|---|
| `UxmlKey` | `string` | "" | Key the runtime `IUXMLService.Instantiate(UxmlKey)` resolves into a `VisualElement`. Unresolved → `TryApply` returns false → warning, no view |
| `TargetId` | `string` | "" | `name` of an existing element to attach near (`root.Q(TargetId)`). Empty OR not found → appended to `root` |
| `Mode` | `UxmlAttachmentMode` (byte) | `AppendToRoot` (0) | `AppendToRoot` / `AppendToElement` / `InsertBeforeElement` / `InsertAfterElement`. Insert modes need `target.parent`; fall back to `root.Add` |

→ bakes `UxmlViewData { FixedString64Bytes UxmlKey; FixedString64Bytes TargetId; UxmlAttachmentMode Mode }`.
Note the **64-byte cap** on key/id (long names truncate).

**UITextRevealClip** (`UITextRevealClip.cs`) — the ONLY animated clip in the family:

| Field | Type | Default | Meaning |
|---|---|---|---|
| `TargetId` | `string` | "" | `name` of an existing `TextElement` (`root.Q<TextElement>(TargetId)`). Empty/not-found/not-a-TextElement → `TryApply` false → warning, no reveal |
| `Text` | `string` `[TextArea]` | "" | The line to reveal. **`FixedString512Bytes`** at runtime — over ~511 bytes truncates |
| `Mode` | `UITextRevealMode` (byte) | `Typewriter` (0) | `Typewriter` reveals char-by-char over the clip; `Instant` sets full text immediately |

→ `clipCaps = ClipCaps.ClipIn | ClipCaps.SpeedMultiplier` (the ONLY clip with caps — supports clip-in offset
and speed). Bakes `UITextRevealData { FixedString64Bytes TargetId; FixedString512Bytes Text; UITextRevealMode
Mode }`. Reveal percent = `(time − ClipIn) / ((End − Start) × Scale)` clamped 0..1, then
`Text.Substring(0, round(len × percent))`. On exit, the ORIGINAL captured text is restored (it does not leave
the typed line on screen).

**NumberClip** (`NumberClip.cs`): one field `int Number` → `NumberComponent { int Value }`. While any
NumberClip is active the panel shows `IsVisible=true` and the **MAX** `Number` across all active clips
(`folded = math.max(...)`) — overlapping clips do not sum, the largest wins.

**DataDisplayClip** (`DataDisplayClip.cs`): one field `HealthSchemaObject[] Health` (a package-local
`ScriptableObject : IUID`, AutoRef registry `"GameSettings"/"healthSchemas"`). Each non-null schema bakes a
`ClipDataId { int Id; FixedString32Bytes Label=schema.name }` buffer element. **The track binds a `Transform`**
(`[TrackBindingType(typeof(Transform))]`) → resolves to that object's baked entity; the system reads the
entity's `IdValue { int Id; float Value }` buffer and emits a row per `ClipDataId` matching by `Id` (no match →
value 0). So the bound entity must carry an `IdValue` buffer whose ids line up with the chosen `HealthSchemaObject`s.

**EssenceUIClip** (`EssenceUIClip.cs`) — the richest; **the track binds `StatAuthoring`**
(`[TrackBindingType(typeof(BovineLabs.Essence.Authoring.StatAuthoring))]`):

| Field | Type | Meaning |
|---|---|---|
| `Source` | `UISourceAuthoring` (struct) | WHO to read numbers off (see resolver below). Always baked via `Source.ToComponent()` |
| `Stats` | `StatSchemaObject[]` | Stats to show; each non-null → `ClipStat { StatKey Key; name }`. Row shows scaled value + `Added × Multi` breakdown |
| `Intrinsics` | `IntrinsicSchemaObject[]` | Counters to show; each → `ClipIntrinsic { IntrinsicKey Key; Min; Max; StatKey MinStat; MaxStat }`. Row shows `Current / Max` + fraction; if the schema set MinStat/MaxStat and the player HAS that stat, the live stat floors the bound |
| `Events` | `EventUIConfig[]` | Each = `{ ConditionEventObject Event; float DisplayDuration }` → `ClipEvent { ConditionKey Key; name; float Duration }`. When that event fires on the resolved player it shows as a row for `DisplayDuration` seconds, then fades (popup/toast feel) |

→ also bakes an empty `ActiveUIEvent` buffer the system populates at runtime. Rows render only for schemas the
**resolved player actually has** in its `Stat`/`Intrinsic`/`ConditionEvent` buffers (missing key → no row, silent).

### UISourceAuthoring resolver (EssenceUIClip's "whose numbers") — verified

`UISourceAuthoring { UISourceMode Mode; int Player; Target Route; EntityLinkSchema Link }` →
`UISource { byte Player; Target Route; ushort LinkKey }`. Resolution (`UISourceResolver.TryResolve`):

1. **Seed**: `Mode==Player` → look up `ControllableRegistry.Resolve(Player)` (the joined player of that index;
   null → not visible). `Mode==Binding` → seed = the track-bound entity itself (`Player=NoPlayer=255`).
2. **Route** (`BovineLabs.Reaction.Data.Core.Target` enum): `Self`/`None` → seed as-is; otherwise read the
   seed's `Targets` component and `Get(Route, seed)` (Owner/Source/Target/Custom). No `Targets` component on the
   seed → NOT visible.
3. **Link**: `LinkKey==0` → done; else follow the `EntityLinkSchema` from the routed entity
   (`EntityLinkResolver.TryResolve`), falling back to the routed entity if the link doesn't resolve.

So "show MY health" = `Mode=Player, Player=0, Route=Self, Link=none`. "Show whatever I'm linked to" = a Route +
Link. The bound `StatAuthoring` only matters in `Binding` mode (it IS the seed).

### Type facts (all five tracks)

| Track | Base | TrackBindingType | Clip caps | TrackColor |
|---|---|---|---|---|
| `UxmlViewTrack` | `DOTSTrack` | none | None | (0.2,0.9,0.5) |
| `UITextRevealTrack` | `DOTSTrack` | none | ClipIn\|SpeedMultiplier | (0.9,0.1,0.5) |
| `UssClassTrack` | `DOTSTrack` | none | None | (0.8,0.4,0.1) |
| `NumberTrack` | `DOTSTrack` | none | None | (1,1,1) |
| `DataDisplayTrack` | `DOTSTrack` | `Transform` | None | (0.2,0.7,0.9) |
| `EssenceUITrack` | `DOTSTrack` | `StatAuthoring` | None | (0.8,0.2,0.8) |

All tracks are EMPTY-bodied (no fields). All clips are `[Serializable] : DOTSClip, ITimelineClipAsset`. Systems
all `[UpdateInGroup(TimelineComponentAnimationGroup)]`; `EssenceUITrackSystem` updates AFTER the Essence
stat/intrinsic/event systems (so it reads post-mutation values) and requires the `ControllableRegistry`
singleton; `UITextRevealTrackSystem` updates after `UssClassTrackSystem`; `UssClassTrackSystem` after
`UxmlViewTrackSystem`.

### Traps & DO/DON'T (each source-derived)

- **DON'T expect ANY visible result from authoring alone — the runtime app is a hidden prerequisite.** Family A
  needs the Anchor app root (and UXML needs `IUXMLService`); Family B needs a panel bound to the ViewModel. A
  clean bake + correct .playable proves the data, NOT the pixels. Report this prerequisite honestly.
- **DON'T confuse the two binding regimes.** `UxmlView`/`TextReveal`/`UssClass`/`Number` have **no track
  binding** — they address UI by string id (`TargetId`/`UxmlKey`) or just the panel. `DataDisplayTrack` binds a
  **Transform**, `EssenceUITrack` binds **StatAuthoring**. Binding the wrong type silently yields no data.
- **DO match `TargetId` to a real element NAME.** Text/UXML-insert/USS resolve via `root.Q(TargetId)`; a typo or
  a missing element → false `TryApply` → a console warning ("unresolved target") and nothing on screen. UXML with
  a bad target degrades gracefully to `root.Add` (still appears, just at root).
- **DO mind the FixedString caps.** `UxmlKey`/`TargetId` are 64 bytes; reveal `Text` is 512 bytes; row labels
  (`ClipStat.Name` etc.) are 32 bytes. Long strings truncate silently.
- **DON'T expect Number clips to sum — the MAX wins.** Two overlapping NumberClips show the larger value, not
  the total. Use one clip per intended value.
- **DON'T flip EssenceUI Route from `Self` to `Owner`/`Target` and expect numbers** unless the seed entity has a
  `Targets` component with that slot filled — otherwise the resolver returns false and the whole panel is hidden.
- **DO remember reveal/UXML/USS REVERT on exit.** TextReveal restores the captured original text at clip end
  (the typed line vanishes); UXML removes the spawned view; USS removes the class. To leave UI persistently, this
  family is the wrong tool — these are transient cutscene effects.
- **DO know EssenceUI reads POST-Essence values** (UpdateAfter the stat/intrinsic/event systems) — it mirrors
  what the stat/intrinsic tracks just did this frame; rows for keys the player lacks simply don't appear.
- **DON'T author from the wrong list of clip names.** `EssenceUIClip` lives on `EssenceUITrack` (not on any
  "EssenceUITrack-less" track) — pair every clip with its declared `[TrackClipType]` track.

## 3. DISCOVERY RECIPES

Act only via `unity-cli exec`; never the filesystem, never play mode. Names below are PARAMETERS — discover them
in THIS project; never assume the §5 worked example.

**3.1 Confirm the package + pick the track type (else MISSING_PREREQUISITE, protocol §6):**
```csharp
string[] names = {
  "BovineLabs.Timeline.UI.Authoring.UxmlViewTrack",
  "BovineLabs.Timeline.UI.Authoring.UITextRevealTrack",
  "BovineLabs.Timeline.UI.Authoring.NumberTrack",
  "BovineLabs.Timeline.UI.Authoring.DataDisplayTrack",
  "BovineLabs.Timeline.UI.Authoring.EssenceUITrack",
};
var sb = new System.Text.StringBuilder();
foreach (var n in names) {
    System.Type t = System.Type.GetType(n + ", BovineLabs.Timeline.UI.Authoring");
    if (t == null) foreach (var a in System.AppDomain.CurrentDomain.GetAssemblies()) { t = a.GetType(n); if (t != null) break; }
    sb.AppendLine((t == null ? "MISSING|" : "OK|") + n + (t != null ? "|" + t.AssemblyQualifiedName : ""));
}
return sb.ToString();
```

**3.2 Verify the RUNTIME app prerequisite (the giant trap, §2).** Confirm the project ships an Anchor app and
the UI assets, or report that you can author the .playable but cannot prove on-screen behaviour:
```csharp
var hasApp = System.Type.GetType("BovineLabs.Timeline.UI.TimelineUIAppBuilder, BovineLabs.Timeline.UI") != null;
var hasUxmlSvc = System.Type.GetType("BovineLabs.Anchor.Services.IUXMLService, BovineLabs.Anchor") != null;
// also: search for *.uxml assets (UXML keys) and panels binding NumberViewModel/DataDisplayViewModel/EssenceUIViewModel.
return "APP|" + hasApp + "|UXMLSvc|" + hasUxmlSvc;
```

**3.3 Find the active scene + SubScene(s)** (unity-cli First Command) and **the DOTS PlayableDirector** inside
it (read-only additive open, restore parent after; needs a timeline-reference authoring component) — per
`unity-timeline-track-authoring`. Zero directors → protocol §6.

**3.4 Discover bind targets / element ids / schemas — NEVER assume, NEVER create assets.**
- `DataDisplayTrack`: a SubScene-baked object with a **`Transform`** whose baked entity carries an `IdValue`
  buffer; discover `HealthSchemaObject` assets (`FindAssets("t:HealthSchemaObject")`, read their `id`) and match
  ids to that buffer.
- `EssenceUITrack`: a SubScene object with **`StatAuthoring`**; discover `StatSchemaObject` /
  `IntrinsicSchemaObject` / `ConditionEventObject` assets (registered in `EssenceSettings`/`ReactionSettings`);
  for `Route`≠Self confirm the seed has a `TargetsAuthoring` with the slot filled; for `Link` discover
  `EntityLinkSchema` ids.
- UXML/Text/USS: discover the UXML keys the `IUXMLService` registers and the element `name`s in the live UI
  tree; these are runtime UI assets, not in the scene — confirm with the project's UI author if unknown.

**3.5 Capture the director's pre-state (`PRE|` per `unity-timeline-track-authoring`)**: playableAsset path; one
`PRE|binding|<i>|<track name>|<type>|<bound object + component or null>` per output track. Record in the undo
journal before mutating.

## 4. CANONICAL RECIPES

One logical change per exec block, inside the SubScene bracket from `unity-timeline-track-authoring`; print
`PRE|` captures first, save in-block, verify fresh (§7). Below shows only the track-specific clip wiring;
discovered parameters are placeholders.

**4.1 "Pop a panel up during this beat" — UxmlViewTrack + UxmlViewClip** (no binding):
```csharp
var track = timeline.CreateTrack(/* §3.1 UxmlViewTrack type */, null, "UI_View");
var clip = track.CreateClip(/* UxmlViewClip type */);
clip.start = 1; clip.duration = 3; clip.displayName = "ShowBanner";
var so = new UnityEditor.SerializedObject((UnityEngine.Object)clip.asset);
so.FindProperty("UxmlKey").stringValue   = "<DISCOVERED uxml key>";
so.FindProperty("TargetId").stringValue  = "";   // "" => append to root
so.FindProperty("Mode").enumValueIndex   = 0;    // AppendToRoot
so.ApplyModifiedPropertiesWithoutUndo();
// No SetGenericBinding for this track. View auto-removes when the clip ends.
```

**4.2 "Type out a line of dialogue" — UITextRevealTrack + UITextRevealClip** (no binding; only animated clip):
```csharp
var clip = track.CreateClip(/* UITextRevealClip type */);
clip.start = 0; clip.duration = 2.5; clip.displayName = "Line1"; // duration = reveal time
var so = new UnityEditor.SerializedObject((UnityEngine.Object)clip.asset);
so.FindProperty("TargetId").stringValue = "<DISCOVERED TextElement name>"; // MUST exist in the live UI tree
so.FindProperty("Text").stringValue     = "Welcome to the arena.";          // <=511 bytes
so.FindProperty("Mode").enumValueIndex  = 0;   // 0 Typewriter, 1 Instant
so.ApplyModifiedPropertiesWithoutUndo();
// Restores the element's original text at clip end.
```

**4.3 "Show a number on the HUD" — NumberTrack + NumberClip** (panel binds NumberViewModel):
```csharp
var clip = track.CreateClip(/* NumberClip type */);
clip.start = 1; clip.duration = 2; clip.displayName = "Combo3";
var so = new UnityEditor.SerializedObject((UnityEngine.Object)clip.asset);
so.FindProperty("Number").intValue = 3;   // overlapping clips => MAX shown, not sum
so.ApplyModifiedPropertiesWithoutUndo();
```

**4.4 "Show the player's health/stats on the HUD" — EssenceUITrack + EssenceUIClip** (bind StatAuthoring):
```csharp
var track = timeline.CreateTrack(/* EssenceUITrack type */, null, "UI_Essence");
var clip = track.CreateClip(/* EssenceUIClip type */);
clip.start = 0; clip.duration = 5; clip.displayName = "HudStats";
var so = new UnityEditor.SerializedObject((UnityEngine.Object)clip.asset);
// Source = "show MY numbers": Mode=Player(1), Player=0, Route=Self(4), Link=none
so.FindProperty("Source").FindPropertyRelative("Mode").enumValueIndex = 1; // Player
so.FindProperty("Source").FindPropertyRelative("Player").intValue      = 0;
so.FindProperty("Source").FindPropertyRelative("Route").enumValueIndex  = /* Target.Self */;
// Stats[] / Intrinsics[] / Events[] are object-ref arrays -> set arraySize then assign each element's
// objectReferenceValue to a DISCOVERED schema asset; Events elements have .Event (ConditionEventObject) + .DisplayDuration.
so.ApplyModifiedPropertiesWithoutUndo();
var statComp = UnityEngine.GameObject.Find("<bind target>").GetComponent<BovineLabs.Essence.Authoring.StatAuthoring>();
director.SetGenericBinding(track, statComp);   // EssenceUITrack binds StatAuthoring
```
(`DataDisplayTrack` follows the same shape but binds a **`Transform`** and its clip's `Health[]` array takes
`HealthSchemaObject`s whose ids exist in the bound entity's `IdValue` buffer.)

## 5. WORKED EXAMPLE (vex-ee) — example environment; rediscover, never assume

- Package present at `Packages/BovineLabs.Timeline.UI/` (`com.bovinelabs.timeline.ui` 1.0.0), authoring asmdef
  `BovineLabs.Timeline.UI.Authoring`. Depends on Anchor 1.0.0 (the UI app layer), Core 1.6.1, Reaction 1.0.0,
  Timeline.EntityLinks 1.0.0, Timeline.core 1.0.0.
- Confirmed source facts: `UxmlAttachmentMode` = {AppendToRoot, AppendToElement, InsertBeforeElement,
  InsertAfterElement}; `UITextRevealMode` = {Typewriter, Instant}; `UISourceMode` = {Binding, Player};
  `UISource.NoPlayer = 255`, `Binding` default = `{Player=255, Route=Self, LinkKey=0}`; `HealthSchemaObject`
  AutoRef = `GameSettings/healthSchemas`, menu `BovineLabs/UI/Health Schema`; ViewModels `NumberViewModel`,
  `DataDisplayViewModel`, `EssenceUIViewModel` (the last exposes Stats/Intrinsics/Events `UIArray`s + IsVisible).
- The package ships only the empty `TimelineUIAppBuilder : AnchorAppBuilder`; the actual UXML assets, element
  names, and bound panels are PROJECT content — discover them live (§3.2). Treat "is there a runtime app/panel?"
  as an open prerequisite to verify, not an assumption.
- Not yet exercised in a training lesson at time of authoring — no `.playable` built; recipes above are
  source-grounded, not yet a recorded run. State that honestly if asked for a prior result.

## 6. UNDO APPENDIX

Authoring this family **mutates nothing at runtime** — there is no permanent counter/world change to compensate
(unlike the Essence tracks). All UI effects are transient (Family A reverts on clip exit; Family B only shows
while active). So undoing the AUTHORING artifacts is a complete undo. Operate the undo per
`unity-timeline-track-authoring`'s undo-appendix structure.

Artifact inventory for one run of §4:
1. Created `.playable` asset (`DeleteAsset` removes its track/clip sub-assets).
2. Possibly-created asset folder(s) (only if `PRE|folderExisted=false`).
3. Mutated `director.playableAsset` (restore the captured `PRE|` value).
4. Added generic binding entries — only for `DataDisplayTrack` (Transform) and `EssenceUITrack` (StatAuthoring);
   the UXML/Text/USS/Number tracks add NO binding. Restore the captured table.
5. No scene values, schemas, UI assets, or settings changed.

ORDER (per the shared appendix): restore the director FIRST (clear MY tracks' bindings, restore captured
playableAsset + prior bindings), THEN delete the asset, THEN restore any other captured value. Fill the
UNDO-1/2/3 templates from `unity-timeline-track-authoring` with YOUR captures. UNDO-4: fresh-load the SubScene,
assert `director.playableAsset` + binding table equal the `PRE|` captures and the `.playable` is gone; restore
the parent scene to `sceneCount=1`.

## 7. VERIFICATION PROTOCOL

Per `unity-timeline-track-authoring`'s fresh-load protocol, plus this family's specifics:
1. **Fresh-load asset dump**: reload the `.playable`; dump each track type + clip start/duration + the clip
   fields that matter (UxmlKey/TargetId/Mode; TargetId/Text/Mode; Number; Source.Mode/Player/Route + Stats/
   Intrinsics/Events array sizes + each element's referenced schema; DataDisplay Health[] ids). In-memory
   post-save state is not evidence.
2. **Binding check from a reloaded SubScene**: `DataDisplayTrack` → bound to a `Transform`; `EssenceUITrack` →
   bound to `StatAuthoring`; the four others → NO binding expected. Prior entries intact.
3. **Schema/registration checks** (DataDisplay/EssenceUI): the chosen `HealthSchemaObject` ids exist in the
   bound entity's `IdValue` buffer; the chosen Stat/Intrinsic/Event schemas are registered in
   `EssenceSettings`/`ReactionSettings`.
4. **Runtime-prerequisite honesty (§2)**: state explicitly whether the project ships the Anchor app + the UXML
   service/keys + the ViewModel-bound panels. If not confirmed, report: "authored + verified in data; on-screen
   result UNVERIFIED — missing/unconfirmed runtime UI prerequisite" rather than claiming the UI shows.
5. **Parent-scene restore**: end `sceneCount=1`, active parent, not dirty.
6. **Console**: nothing new beyond the project baseline; an "unresolved target" warning at runtime means a bad
   `TargetId`/`UxmlKey` — but that only appears in play mode, never in this authoring flow.
