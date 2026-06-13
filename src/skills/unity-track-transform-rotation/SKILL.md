---
name: unity-track-transform-rotation
description: Master of BovineLabs TransformRotationTrack + RotationLookAtTargetClip/RotationLookAtStartClip (package com.bovinelabs.timeline.transform) — the two-sided ExposedReference wiring (asset GUID + director scene table), every-frame look-at vs first-frame orientation capture, NaN look-direction traps, and reset semantics. Portable to any project containing the package; worked example from vex-ee. Use when a designer asks to "make it face / track / turn back".
---

# TransformRotationTrack specialist

## 1. SCOPE

Specialist for **`TransformRotationTrack`** and its two clip types
**`RotationLookAtTargetClip`** and **`RotationLookAtStartClip`** from the package
`com.bovinelabs.timeline.transform`: authoring the track/clips in a `.playable`, the
**two-sided ExposedReference wiring** (canonical for ALL ExposedReference tracks), and the
runtime quaternion-blending / look-at semantics. Stage construction belongs to
`unity-stage-foundations`; position/scale to their own track specialists
(`unity-track-transform-position`, `unity-track-transform-scale`).

**Operate per `unity-timeline-track-authoring`; behave per `unity-agent-protocol`; use the
editor per `unity-cli`.** That shared skill owns the discovery preamble (its §1), the
SubScene create-and-wire bracket (§2), the undo-appendix structure (§3), and the
fresh-load verification protocol (§4). This skill keeps only what is UNIQUE to this track
family. Everything below is portable to any project with the package; every name/path/id
is a worked example (§5) — rediscover it (shared §1). All facts verified vex-ee 2026-06 via
reflection dumps, package-source reads, YAML reads of `.playable`/`.unity`, and fresh-load
read-backs through `unity-cli exec`.

## 2. TYPE FACTS

Assembly `BovineLabs.Timeline.Transform.Authoring`:

- `BovineLabs.Timeline.Transform.Authoring.TransformRotationTrack : DOTSTrack`
  — `[TrackBindingType(typeof(UnityEngine.Transform))]` (the bind target is a plain
  `UnityEngine.Transform`), `[TrackClipType(RotationLookAtTargetClip)]`,
  `[TrackClipType(RotationLookAtStartClip)]`, `[TrackColor(0.85, 0.30, 0.70)]`,
  `[DisplayName("BovineLabs/Timeline/Transform/Rotation")]`.
- `...Authoring.RotationLookAtTargetClip : DOTSClip` — `clipCaps = ClipCaps.Blending`.
- `...Authoring.RotationLookAtStartClip : DOTSClip` — `clipCaps = ClipCaps.Blending`, NO
  serialized fields; bakes `RotationLookAtStartBuilder` → `RotationLookAtStart` tag.

**NAME-COLLISION TRAP**: `BovineLabs.Vibe.Authoring.LocalTransform` declares clips with the
SAME short names (different base, completely different fields). Always use fully qualified
`BovineLabs.Timeline.Transform.Authoring.*` names in exec blocks and sweeps.

### Field tables
TransformRotationTrack:
| Field | Type | Default | Meaning |
|---|---|---|---|
| `ResetRotationOnDeactivate` | bool | false | Track-declared; bakes `RotationState{quaternion Value}` on the track entity → captures binding rotation on track activate, restores on deactivate. |
| `resetOnDeactivate` | bool | false | INHERITED from `DOTSTrack` base; serializes as a SEPARATE YAML key beside the above — do not confuse the two (family pattern, confirmed three-for-three across transform tracks). |

`RotationLookAtTargetClip` — ONE field:
| Field | Type | Default | Meaning |
|---|---|---|---|
| `Target` | `ExposedReference<Transform>` | `exposedName=""`, `defaultValue {fileID: 0}` | The Transform to look at. NOT a plain object field — requires the two-sided wiring below. |

`RotationLookAtStartClip` — no serialized fields.

Bake path (quoted from `Authoring/Rotation/RotationLookAtTargetClip.cs`):
```csharp
UnityEngine.Transform target = null;
if (context.Director != null)
    target = context.Director.GetReferenceValue(Target.exposedName, out _) as UnityEngine.Transform;
var builder = new RotationLookAtTargetBuilder { Target = context.Baker.GetEntity(target, TransformUsageFlags.Dynamic) };
```

### Runtime semantics
Each clip bakes to its own entity carrying `RotationAnimated` (the quaternion the clip wants
the binding at). LookAtTarget entities also carry `RotationLookAtTarget{Entity Target}`;
`LookAtTargetClipJob` runs EVERY active frame, recomputing
`quaternion.LookRotation(targetPos - bindingPos, math.up())` — the binding's +Z tracks a
moving target, silently skipping any frame where either entity lacks `LocalTransform`, and
producing NaN if the look direction is zero or vertical (no guard in source). LookAtStart
entities are edge-gated (`[WithAll(TimelineActive)] [WithNone(TimelineActivePrevious)]`): on
exactly the FIRST active frame the job freezes the binding's CURRENT rotation into
`RotationAnimated`; blending toward it turns the object back to that orientation without
moving it. `TrackBlendImpl<quaternion, RotationAnimated>` weights all simultaneously active
clips per binding through `QuaternionMixer` (`math.nlerp` weighted mixing — cheap,
non-constant angular velocity, fine for short blends; `math.mul` additive composition);
`WriteRotationJob` writes the result into `LocalTransform.Rotation`, flipping the
`ActiveRotation` enableable marker. `ResetRotationOnDeactivate=true` bakes `RotationState`:
`ActivateResetJob` captures `LocalTransform.Rotation` on the track's first active frame,
`DeactivateResetJob` restores it on deactivation; without it the binding keeps the last
blended orientation.

**Silence profile**: an unset `Target` (`exposedName=""`) → `Entity.Null` → every frame
silently skipped, no error ever. NaN look direction → NaN written into the transform, no
error. A clean console is never proof here (shared §4).

### The ExposedReference mechanism — TWO-SIDED (canonical for ALL ExposedReference tracks)
ExposedReference is the asset→scene escape hatch: the `.playable` stores ONLY a GUID string
(`exposedName`); the object reference lives in the scene PlayableDirector's
`m_ExposedReferences` table, serialized WITH the SubScene as a scene-local fileID. Asset
holds the name; scene holds the object — which is why the link SURVIVES save/reload while
plain object fields (e.g. `PositionClip.Target`) die to `{fileID: 0}` (unity-cli 5d). TWO
saves required, one per side: `AssetDatabase.SaveAssets()` (GUID side),
`SaveScene(subScene)` (table side) — skipping the scene save silently loses the object side
while the `.playable` looks correctly wired. On-disk shape (real values in §5):
```
# .playable (clip side):              # .unity (director side):
  Target:                               m_ExposedReferences:
    exposedName: <guid>                   m_References:
    defaultValue: {fileID: 0}             - <guid>: {fileID: <scene-local Transform id>}
```

### Traps & DO/DON'T (each proven live, vex-ee 2026-06)
- **DON'T treat an unset ExposedReference as an error you'll be told about** — an untouched
  clip has `exposedName=""`; `GetReferenceValue` null → `Baker.GetEntity(null)` →
  `Entity.Null` → `LookAtTargetClipJob` silently skips EVERY frame
  (`EDGE_A|GetReferenceValue(unset)=NULL|idValid=False`).
- **DON'T place the look-at target at the binding's position or on its vertical axis** —
  `LookRotation(zero, up)` and `LookRotation(up, up)` both returned
  `float4(NaNf, NaNf, NaNf, NaNf)` live; `WriteRotationJob` writes that NaN into
  `LocalTransform.Rotation`, poisoning the transform. Keep a lateral offset.
- **DON'T expect LookAtStart to restore the timeline-original pose** — it freezes the
  binding's orientation on the clip's OWN activation frame; if another clip already rotated
  the object, that rotated orientation is what gets frozen. True "return to original pose"
  is the track-level `ResetRotationOnDeactivate` job's role (it captures ROTATION, not
  position — the object turns back in place, never travels).
- **DON'T conflate the two reset bools** — `resetOnDeactivate` (inherited from `DOTSTrack`)
  and `ResetRotationOnDeactivate` (track-declared, drives `RotationState`) serialize as
  separate YAML keys, side by side on disk; set the one you mean.
- **DO trust director tables across playableAsset swaps** — binding table (keyed by track
  asset) and exposed-reference table (keyed by GUID name) both survived swapping
  `director.playableAsset` (three coexisting track bindings + the exposed ref). UNDO
  corollary: deleting your `.playable` does NOT remove your table entries — see undo note.
- **DO set `blendInDuration` on the later overlapping clip** for the look-at → turn-back
  handoff (nlerp toward the frozen orientation); both clips `caps=Blending`.

## 3. DISCOVERY

Per shared §1 (D1–D5). Track-specific notes for this family:
- **D1** type/assembly: `BovineLabs.Timeline.Transform.Authoring.TransformRotationTrack,
  BovineLabs.Timeline.Transform.Authoring`; missing → `MISSING_PREREQUISITE|package
  com.bovinelabs.timeline.transform absent`.
- **D4** finds TWO Transforms, both SubScene-baked: (a) the bind target (the Transform the
  track rotates) and (b) the look-at target (the Transform the ExposedReference points at).
  **PLACEMENT CHECK before wiring**: print both positions; the look-at target must be
  neither at the binding's position nor on its vertical axis (NaN trap, §2).
- **D5** additionally captures `PRE|exposedRef|<guid>|<fileID>` — the FULL
  `m_ExposedReferences.m_References` list, read from the SubScene's saved `.unity` text via
  `File.ReadAllText` (the verified method), BEFORE minting your GUID, so UNDO-1 can prove it
  removed only YOUR entry.

## 4. CLIP PATTERNS (the bracket's track-specific middle — per shared §2)

Fill the shared §2 bracket; this family REQUIRES the SubScene open for both wiring sides
(the director owns the exposed-reference table). Use FULL namespaces (Vibe collision, §2).

**Track setup:** `track.ResetRotationOnDeactivate = true;` to snap back to the pre-track
rotation on deactivate.

**Pattern A — "make it face / track that" (every-frame look-at):**
```csharp
var clipA = track.CreateClip<BovineLabs.Timeline.Transform.Authoring.RotationLookAtTargetClip>();
clipA.start = 0; clipA.duration = 2.5; clipA.displayName = "<clipName>";
var a = (BovineLabs.Timeline.Transform.Authoring.RotationLookAtTargetClip)clipA.asset;
// then the two-sided wiring (Pattern C) for a.Target
```

**Pattern B — "turn back to where it started" (first-frame capture, blended handoff):**
```csharp
var clipB = track.CreateClip<BovineLabs.Timeline.Transform.Authoring.RotationLookAtStartClip>();
clipB.start = 2; clipB.duration = 2; clipB.displayName = "<clipName>";
clipB.blendInDuration = 0.5;  // overlaps clipA so the turn-back nlerps in (no field to set)
```

**Pattern C — the two-sided ExposedReference wiring (canonical for ALL ExposedReference
tracks):** mint a GUID on the CLIP ASSET (asset side), then register the object on the
DIRECTOR's table (scene side); two saves.
```csharp
// side one (asset): mint GUID, save .playable. JOURNAL the GUID — UNDO-1 clears the table entry by it.
var exposedName = new UnityEngine.PropertyName(System.Guid.NewGuid().ToString());
a.Target = new UnityEngine.ExposedReference<UnityEngine.Transform> { exposedName = exposedName };
foreach (var o in new UnityEngine.Object[] { timeline, track, a, (UnityEngine.Object)clipB.asset })
    UnityEditor.EditorUtility.SetDirty(o);
UnityEditor.AssetDatabase.SaveAssets();
// side two (scene): bind track + register the look-target on the director, save the SCENE.
director.SetGenericBinding(track, UnityEngine.GameObject.Find(bindTargetPath).GetComponent<UnityEngine.Transform>());
director.SetReferenceValue(exposedName, UnityEngine.GameObject.Find(lookTargetPath).GetComponent<UnityEngine.Transform>());
// return "OK|" + assetPath + "|exposedName=" + exposedName;
```

## 5. WORKED EXAMPLE DELTA (vex-ee) — rediscover, never assume

Same shared stage as `unity-timeline-track-authoring` §5; this family's deltas:
- Bind target = `Stage_LinkRoot/Stage_Actor` (capsule at (0,1,0)); look-at target =
  `Stage_Target` (cube at (5,0,0)). Look direction at wiring:
  `LookRotation((5,-1,0), up) = float4(0.116, 0.697, -0.116, 0.697)` — non-degenerate.
- Asset `Assets/Training/03-transform-rotation-track/RotationMastery.playable` — track
  `RotationTrack` (`ResetRotationOnDeactivate: 1`, inherited `resetOnDeactivate: 1`), clips
  `A_LookAtTarget` 0–2.5s / `B_BackToStart` 2–4s `blendIn=0.5`; clip A
  `exposedName: cca01140-fc94-4eda-9c0d-77166bb79c6a`.
- Director side on disk: `m_ExposedReferences.m_References` holds
  `- cca01140-…: {fileID: 311820019}` (Stage_Target's Transform); binding keys for all three
  mastery tracks (Position/Scale/Rotation) → fileID 1914093324 (Stage_Actor). Fresh-reload:
  `FRESH|GetReferenceValue=Stage_Target (UnityEngine.Transform)|idValid=True`.
- Session end: `playableAsset` RESTORED to lesson 01's `PositionMastery.playable`; the
  RotationTrack binding and exposed-ref entry remain in the scene tables (§2 DO note).

## 6. UNDO (per shared §3, with this family's extra artifact)

Beyond the shared §3 inventory (created `.playable`+folder, mutated `playableAsset`, added
binding entry), this family adds ONE extra undoable artifact and one extra UNDO-1 step:

- **Extra artifact**: an exposed-reference table entry `<guid> → <look-target Transform>` in
  the director's `m_ExposedReferences` (SubScene file). The two-sided wiring inverts
  two-sidedly: deleting the `.playable` removes ONLY the GUID side; the table entry, keyed by
  the GUID string, survives asset swaps AND asset deletion as an invisible orphan no
  inspector shows — undo MUST clear it explicitly.
- **UNDO-1 (a) first step**: before clearing bindings, clear MY exposed-ref entry:
  ```csharp
  // ClearReferenceValue removes the m_References entry — documented IExposedPropertyTable
  // API, never exercised in training. Verify via the UNDO-4 scene-YAML grep; if the entry
  // survives, delete it via SerializedObject (m_ExposedReferences.m_References) and report
  // which path worked.
  director.ClearReferenceValue(new UnityEngine.PropertyName(myExposedName)); // myExposedName = CAPTURED minted GUID
  ```
  Then proceed with shared UNDO-1 (ClearGenericBinding MY tracks, restore captured
  playableAsset, save scene), UNDO-2 (delete asset+folder), UNDO-3 (none for this family).
- **ORDER** (shared §3 + this): restore director FIRST — clear MY exposed-ref, clear MY
  binding, restore captured playableAsset, save — so nothing in the scene references the
  asset OR carries my GUID, THEN delete the asset. Deleting first leaves a dangling
  `{fileID: 0}`-style ref; skipping the table clear leaves an orphaned GUID entry.
- **UNDO-4 verification delta** (atop shared §4): read the saved `.unity` text and confirm
  the minted GUID appears NOWHERE in it (orphan check) and `m_ExposedReferences` equals the
  captured `PRE|exposedRef|` lines.
- vex-ee note: training left artifacts asset/binding/exposed-ref in place, playableAsset
  already restored — undoing means UNDO-1(a,b) + UNDO-2.

## 7. VERIFICATION DELTA (atop shared §4)

The shared §4 fresh-load dump, parent-scene restore (`sceneCount=1`), and console-baseline
steps apply unchanged. This family adds:
- **Both sides of the ExposedReference**: the `.playable` must show the minted
  `exposedName: <guid>` under `Target:` (empty `exposedName:` = unwired silent-no-op clip);
  the SubScene `.unity` must show `- <guid>: {fileID: <n>}` under
  `m_ExposedReferences.m_References`, the fileID resolving to the intended Transform in the
  same scene file. Also confirm the two reset YAML keys (`ResetRotationOnDeactivate`,
  inherited `resetOnDeactivate`).
- **Survival proof from a RELOADED SubScene**: `director.GetReferenceValue(<exposedName>,
  out idValid)` must return the look-target Transform with `idValid=True`; binding dump
  `BINDING|<trackName>|bound=<bindTargetName> (Transform)`.
- Field-table dump (step 1): per track/clip print name, start/duration, blendIn, caps, asset
  type, `ResetRotationOnDeactivate`.
