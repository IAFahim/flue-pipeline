---
name: unity-track-transform-position
description: Master of BovineLabs TransformPositionTrack + PositionClip/PositionStartClip (package com.bovinelabs.timeline.transform) — creating timelines that move SubScene-baked objects (World/Offset/Target modes, blending, reset semantics) and the cross-scene-reference traps. Portable to any project containing the package; worked example from vex-ee. Use when a designer asks to "move this thing along the timeline".
---

# TransformPositionTrack specialist

## 1. SCOPE

You are the specialist for **`TransformPositionTrack`** and its two clip types
**`PositionClip`** and **`PositionStartClip`** from the package
`com.bovinelabs.timeline.transform`. Scope: exactly this track family —
authoring the track/clips in a `.playable` TimelineAsset, wiring a SubScene
PlayableDirector, and the runtime position-blending semantics. Stage construction
belongs to `unity-stage-foundations`; scale belongs to `unity-track-transform-scale`;
persistent cross-object references belong to the EntityLinks track family.

Operate per `unity-timeline-track-authoring`; behave per `unity-agent-protocol`;
use the editor per `unity-cli`.

## 2. TYPE FACTS

True in ANY project containing `com.bovinelabs.timeline.transform`. Provenance tags
say where a fact was PROVEN, not where it applies. (All verified vex-ee 2026-06 via
reflection dumps, YAML reads, fresh-load read-backs through `unity-cli exec`.)

Types (assembly `BovineLabs.Timeline.Transform.Authoring` for authoring; runtime in
`BovineLabs.Timeline.Transform`):

- `BovineLabs.Timeline.Transform.Authoring.TransformPositionTrack : DOTSTrack`
  — `[TrackBindingType(typeof(UnityEngine.Transform))]` (the bind target is a plain
  `UnityEngine.Transform` on a SubScene-baked object),
  `[TrackClipType(PositionStartClip)]`, `[TrackClipType(PositionClip)]`.
- `BovineLabs.Timeline.Transform.Authoring.PositionClip : DOTSClip` — `ClipCaps.Blending`.
- `BovineLabs.Timeline.Transform.Authoring.PositionStartClip : DOTSClip` — `ClipCaps.Blending`, NO serialized fields.

Enums (both **byte**-backed):

```
BovineLabs.Timeline.Transform.Authoring.PositionType(Byte): World=0 Offset=1 Target=2
BovineLabs.Timeline.Transform.OffsetType(Byte):             World=0 Local=1
```

(Note `OffsetType` lives in the RUNTIME namespace `BovineLabs.Timeline.Transform`,
not `.Authoring`.)

### TransformPositionTrack fields
| Field | Type | Default | Notes |
|---|---|---|---|
| `ResetPositionOnDeactivate` | bool | — | Declared on the track; adds `PositionState` at bake → capture binding position on track activate, restore on deactivate |
| `resetOnDeactivate` | bool | True (in vex-ee asset) | INHERITED from `DOTSTrack` base, serializes as a SEPARATE YAML key — do not confuse the two |

### PositionClip fields
| Field | Type | Used by | Default |
|---|---|---|---|
| `Type` | `PositionType` | all | World |
| `Position` | Vector3 | World | (0,0,0) |
| `Target` | plain `GameObject` (NOT ExposedReference) | Target | null |
| `OffsetType` | `OffsetType` | Offset, Target | **Local** (field initializer) |
| `Offset` | Vector3 | Offset, Target | (0,0,0) |

`PositionStartClip` has NO serialized fields.

### Runtime semantics
Each PositionClip bakes to its own entity carrying `PositionAnimated` (the float3 the
clip wants the binding at) plus a mode component. **World** clips hold the constant.
**Offset** clips also bake `PositionOffset`; a job gated by `[WithAll(TimelineActive)]
[WithNone(TimelineActivePrevious)]` computes `binding.Position + offset` exactly ONCE
on the activation frame (Local offsets rotated via `TransformPoint`) — the destination
is frozen even if the binding later moves. **Target** clips bake `PositionTarget`; their
job runs EVERY active frame, re-reading the target entity's `LocalTransform`, so they
follow a moving target — and silently do nothing if the target is `Entity.Null`
(`if (!LocalTransforms.TryGetComponent(positionTarget.Target, out ...)) return;`).
**PositionStartClip** bakes `PositionMoveToStart`: on activation it snapshots the binding's
current position into `PositionAnimated`, so blending toward it eases the object back to
where it stood at clip start. `TrackBlendImpl<float3, PositionAnimated>` weights all
simultaneously active clips per binding by their blend curves; `WritePositionJob` writes
the result to `LocalTransform.Position`. `ResetPositionOnDeactivate=true` adds
`PositionState` to the track entity: `ActivateResetJob` captures the binding position on
track activation, `DeactivateResetJob` restores it on deactivation; without it the
binding stays at the last blended value.

**Silence profile**: a `Target=null` Target clip, a parent-scene binding, and a dropped
scene-object `Target` ref all fail with NO console warning — see traps. Per
unity-timeline-track-authoring §4, silence is expected, not proof.

### Traps & DO/DON'T (each proven live, vex-ee 2026-06)

- **DON'T persist scene-object `Target` references in a .playable** — a project asset
  physically cannot serialize a reference to a scene object: after `SaveAssets()` the
  file held `Target: {fileID: 0}` and fresh read-back showed null, with NO console
  warning; in-memory objects (and the Timeline UI until domain reload) keep the stale
  reference and lie. DO use the EntityLinks family (schema id → runtime resolution) for
  persistent cross-object references.
- **DON'T treat `Target=null` with `PositionType.Target` as an error you'll be told
  about** — it bakes `Entity.Null` (`GetEntity(null, ...)`) and the runtime lookup
  fails silently; the clip contributes nothing.
- **DON'T bind the track to a parent-scene object** — binding a parent-scene object
  from a SubScene director is silently nulled on save
  (`m_SceneBindings ... value: {fileID: 0}`), and even if it persisted, the parent
  scene is never baked, so no entity exists for `PositionTrackSystem` to write. DOTS
  tracks can only animate SubScene-baked objects.
- **DON'T conflate the two reset bools** — `resetOnDeactivate` (inherited from
  `DOTSTrack`) and `ResetPositionOnDeactivate` (track-declared, drives `PositionState`)
  serialize as separate YAML keys; set the one you mean.
- **DON'T cast byte-backed enums via `(int)Enum.Parse`** — throws
  InvalidCastException in exec blocks; use `System.Convert.ToInt64`.
- **DON'T use obsolete APIs in exec** — the verified editor build rejects
  `SerializedProperty.objectReferenceInstanceIDValue` (use
  `objectReferenceEntityIdValue`) and `Object.GetInstanceID()` (use `GetEntityId`).
- **DO remember a fresh PositionClip's `Position` default is (0,0,0)** — in World mode
  that actively teleports the binding to the origin (contrast ScaleClip's benign
  Vector3.one default).
- **DO set `blendInDuration` on the later overlapping clip** — an explicit
  `blendIn=0.5` on the later clip produced the mirrored computed `blendOut=0.5` on the
  earlier one; all clips report `caps=Blending`.
- **CAVEAT (inconclusive, reported honestly)**: querying the Editor World for baked
  `PositionAnimated` entities after closing the SubScene returned 0 (only the streaming
  `SceneReference` entity was present; entity-scene import is async). Absence of baked
  entities in the Editor World is NOT proof the bake is broken.

## 3. CEREMONY POINTERS

- **Discovery** (package check, scene/SubScene, director selection, bind-target by
  COMPONENT, `PRE|` capture): unity-timeline-track-authoring §1. Track-specific binds:
  the `[TrackBindingType]` is `UnityEngine.Transform`; find candidates by
  `FindObjectsByType<UnityEngine.Transform>` filtered to the SubScene and confirm with
  the designer. NEVER pick a parent-scene object (trap above).
- **SubScene bracket** (open additive → SetActiveScene → create `.playable` → wire
  director → SaveScene → restore parent in `finally`): unity-timeline-track-authoring §2.
  Fill `<TRACK_TYPE>`=`TransformPositionTrack`, `<CLIP_TYPE>`=`PositionClip`/
  `PositionStartClip`, `<BIND_TARGET>`=`UnityEngine.Transform`, and drop in the clip
  patterns below as the bracket's track-specific middle. Set `track.ResetPositionOnDeactivate`
  on the track after `CreateTrack`. Do NOT rely on assigning scene objects to clip fields
  (Target trap).
- **Undo appendix** (artifact inventory, restore-director-first ORDER, UNDO-1/2/3/4):
  unity-timeline-track-authoring §3. Inventory delta: one run creates the `.playable`
  with 1 track + up to 4 clip sub-assets; no other scene values are changed (the track
  never moves editor objects, schemas, or stage state).
- **Verification** (fresh-load asset dump, raw YAML check, reloaded-SubScene binding,
  parent-scene restore, console baseline): unity-timeline-track-authoring §4. Track-specific
  YAML checks: `Target: {fileID: 0}` (dropped scene ref), BOTH reset keys
  (`resetOnDeactivate` / `ResetPositionOnDeactivate`), and `PositionType`/`OffsetType`
  byte enums as ints.

## 4. CLIP PATTERNS (the bracket's track-specific middle)

Designer intent → wiring. Clip starts/durations/values are example choices, not package
constants. Set byte-backed enums via the runtime/authoring enum values shown; if direct
assignment won't compile in the sandbox, use `SerializedObject` YAML field names.

- **"Go to an absolute point" → WORLD.** `Type=World`; `Position=<absolute float3>`.
  ```csharp
  var clipA = track.CreateClip<BovineLabs.Timeline.Transform.Authoring.PositionClip>();
  clipA.start = 0; clipA.duration = 2; clipA.displayName = "A_World";
  var a = (BovineLabs.Timeline.Transform.Authoring.PositionClip)clipA.asset;
  a.Type = BovineLabs.Timeline.Transform.Authoring.PositionType.World;
  a.Position = new UnityEngine.Vector3(0f, 1f, 5f);   // <CHOSEN> — NOTE default (0,0,0) teleports to origin
  ```
- **"Shift by a fixed amount from where I am" → OFFSET** (computed ONCE at clip
  activation; `OffsetType.Local` = rotated by the binding's orientation, `World` = axis-aligned).
  ```csharp
  var clipB = track.CreateClip<BovineLabs.Timeline.Transform.Authoring.PositionClip>();
  clipB.start = 1.5; clipB.duration = 2; clipB.displayName = "B_OffsetLocal";
  var b = (BovineLabs.Timeline.Transform.Authoring.PositionClip)clipB.asset;
  b.Type = BovineLabs.Timeline.Transform.Authoring.PositionType.Offset;
  b.OffsetType = BovineLabs.Timeline.Transform.OffsetType.Local;
  b.Offset = new UnityEngine.Vector3(2f, 0f, 0f);     // <CHOSEN>
  clipB.blendInDuration = 0.5;                        // overlap previous clip => weighted blend (mirrors blendOut on A)
  ```
- **"Follow that moving thing" → TARGET** (re-evaluated EVERY frame). WARNING: a
  scene-object `Target` serializes as `{fileID: 0}` and silently never resolves — for a
  PERSISTENT cross-object reference, use an EntityLinks track instead.
  ```csharp
  var clipC = track.CreateClip<BovineLabs.Timeline.Transform.Authoring.PositionClip>();
  clipC.start = 3.5; clipC.duration = 1.5; clipC.displayName = "C_Target";
  var c = (BovineLabs.Timeline.Transform.Authoring.PositionClip)clipC.asset;
  c.Type = BovineLabs.Timeline.Transform.Authoring.PositionType.Target;
  c.Target = UnityEngine.GameObject.Find("<DISCOVERED target>"); // see WARNING
  c.OffsetType = BovineLabs.Timeline.Transform.OffsetType.World;
  c.Offset = new UnityEngine.Vector3(0f, 2f, 0f);     // <CHOSEN>
  ```
- **"Ease back to where it started" → START** (`PositionStartClip`, no fields; snapshots
  the binding's position at clip activation and blends toward it).
  ```csharp
  var clipD = track.CreateClip<BovineLabs.Timeline.Transform.Authoring.PositionStartClip>();
  clipD.start = 5; clipD.duration = 1; clipD.displayName = "D_Start";
  ```

## 5. WORKED EXAMPLE DELTA (vex-ee) — rediscover, never assume

Shared stage is unity-timeline-track-authoring §5. This track's delta: built
`Assets/Training/01-transform-position-track/PositionMastery.playable` — one track
`PositionTrack` (`ResetPositionOnDeactivate: 1`, inherited `resetOnDeactivate: 1`),
clips A_World 0–2s pos (0,1,5) / B_OffsetLocal 1.5–3.5s offset (2,0,0) blendIn 0.5
(mirrored blendOut 0.5 on A) / C_Target 3.5–5s OffsetType=World offset (0,2,0),
`Target: {fileID: 0}` on disk (dropped scene ref) / D_Start 5–6s. Wired onto
`Stage_Director` with exactly ONE binding: `PositionTrack → Stage_Actor
(UnityEngine.Transform)`.
