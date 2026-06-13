---
name: unity-track-transform-scale
description: Master of BovineLabs TransformScaleTrack + ScaleClip/ScaleStartClip (package com.bovinelabs.timeline.transform) — timeline grow/shrink/squash of SubScene-baked objects, the double-Authoring namespace, the uniform-scale X-collapse trap, and PostTransformMatrix precedence. Portable to any project containing the package; worked example from vex-ee. Use when a designer asks to "grow / shrink / squash this over the timeline".
---

# TransformScaleTrack specialist

## 1. SCOPE

You are the specialist for **`TransformScaleTrack`** and its two clip types **`ScaleClip`**
and **`ScaleStartClip`** from the package `com.bovinelabs.timeline.transform`. Scope:
exactly this track family — authoring the track/clips in a `.playable` TimelineAsset,
wiring a SubScene PlayableDirector, and the runtime scale-write semantics
(PostTransformMatrix vs uniform `LocalTransform.Scale`). Stage construction belongs to
`unity-stage-foundations`; position/rotation to their own track specialists
(`unity-track-transform-position`, `unity-track-transform-rotation`).

Operate per `unity-timeline-track-authoring`; behave per `unity-agent-protocol`; use the
editor per `unity-cli`. The discovery preamble (§1), the SubScene bracket (§2), the undo
appendix (§3), and the verification protocol (§4) of `unity-timeline-track-authoring` are
inherited verbatim — this skill supplies only the placeholders below and the
track-specific clip middle.

## 2. TYPE FACTS

True in ANY project containing `com.bovinelabs.timeline.transform`. Provenance tags say
where a fact was PROVEN, not where it applies. (All verified vex-ee 2026-06 via reflection
dumps, package + entities source reads, YAML reads, fresh-load read-backs via `unity-cli exec`.)

**The namespace really is `BovineLabs.Timeline.Transform.Authoring.Authoring.Scale` —
"Authoring" twice** (folder `Authoring/Scale/` nested under the package's `Authoring`
namespace root). Quote it exactly in every exec snippet; type-name guessing fails. Source
`Authoring/Scale/ScaleTrack.cs`; class `TransformScaleTrack`, `[DisplayName("BovineLabs/Timeline/Transform/Scale")]`.

Types (assembly `BovineLabs.Timeline.Transform.Authoring`):

- `BovineLabs.Timeline.Transform.Authoring.Authoring.Scale.TransformScaleTrack : DOTSTrack`
  — `[TrackBindingType(typeof(UnityEngine.Transform))]` (the `<BIND_TARGET>`: a plain
  `UnityEngine.Transform` on a SubScene-baked object), `[TrackClipType(ScaleStartClip)]`,
  `[TrackClipType(ScaleClip)]`, `[TrackColor(0.3f, 0.8f, 0.4f)]`.
- `...Authoring.Scale.ScaleClip : DOTSClip` — `ClipCaps.Blending`.
- `...Authoring.Scale.ScaleStartClip : DOTSClip` — `ClipCaps.Blending`, NO serialized fields.

### TransformScaleTrack fields
| Field | Type | Default | Notes |
|---|---|---|---|
| `ResetScaleOnDeactivate` | bool | false | Declared on the track. Bake: `ScaleTrackBuilder.ApplyTo` does `if (ResetScaleOnDeactivate) builder.AddComponent<ScaleState>();` on the TRACK entity → capture on activate, restore on deactivate |
| `resetOnDeactivate` | bool | false | INHERITED from `DOTSTrack`, serializes separately — distinct field (family pattern, confirmed three for three); does NOT feed `ScaleTrackBuilder`/`ScaleState` |

### ScaleClip fields
| Field | Type | Default | Notes |
|---|---|---|---|
| `Scale` | Vector3 | **Vector3.one** (field initializer) | The ONLY field. No Type/Offset/Target modes, no enums (contrast PositionClip's 5 fields). Bakes `ScaleAnimated { Value = Scale }` |

`ScaleStartClip` has NO serialized fields.

### Bake
`ScaleBuilder` adds `ScaleAnimated { Value = Scale }` to the clip entity, plus
`AddTransformUsageFlags(binding, TransformUsageFlags.Dynamic)`. `ScaleStartClip` bakes
`ScaleStartBuilder` → `ScaleMoveToStart` tag + empty `ScaleAnimated`; `MoveToStartingScaleClipJob`
fills it with the binding's current scale on the activation frame (edge-detected by
`[WithAll(TimelineActive)] [WithNone(TimelineActivePrevious)]`).

### Runtime semantics
`TrackBlendImpl<float3, ScaleAnimated>` gathers all simultaneously active clips per binding
into one weighted float3. `WriteScaleJob` (`Runtime/Scale/ScaleTrackSystem.cs`) writes it
with strict precedence:

```csharp
if (PostTransforms.TryGetRefRW(entity, out var pt))
{
    var m = pt.ValueRO.Value;
    var current = new float3(math.length(m.c0.xyz), math.length(m.c1.xyz), math.length(m.c2.xyz));
    if (current.Equals(float3.zero)) current = new float3(1f);

    pt.ValueRW.Value = float4x4.Scale(JobHelpers.Blend<float3, Float3Mixer>(ref target, current));
}
else if (LocalTransforms.TryGetRefRW(entity, out var lt))
{
    lt.ValueRW.Scale = JobHelpers.Blend<float3, Float3Mixer>(ref target, new float3(lt.ValueRO.Scale)).x;
}
```

- Binding HAS `PostTransformMatrix` → `float4x4.Scale(blend)`, true per-axis scale.
- Binding has NO `PostTransformMatrix` → `LocalTransform.Scale = blend.x` — a single
  uniform float; **Y and Z of your Vector3 are silently discarded**. THE designer trap.
- Whether the matrix exists is decided at BAKE time: Unity's `TransformBaking.cs`
  (com.unity.entities) only emits `PostTransformMatrix` when
  `!IsUniformScale(transformAuthoring.LocalScale)` — then it forces
  `LocalTransform.Scale = 1` and stores `float4x4.Scale(scale)` in the matrix.
- `ScaleState` (added only when `ResetScaleOnDeactivate=true`) is dual-natured: on track
  activation it captures EITHER the full `PostTransformMatrix.Value` float4x4
  (`IsNonUniform = true`) OR the uniform `LocalTransform.Scale` float; deactivation
  restores exactly the kind it captured — never a lossy uniform approximation.

### Silence profile
A faithfully serialized + baked clip can be 2/3-discarded with NO warning (uniform binding
→ X-only). A fresh ScaleClip (Scale=one) is a visual no-op only when the binding's current
scale IS 1; otherwise it animates back to 1 silently. Zero/negative scale serializes
verbatim and is written verbatim — no clamp, no warning.

### Traps & DO/DON'T (each proven live, vex-ee 2026-06)

- **DON'T expect per-axis scale on a uniform-scale binding** — a uniform authoring
  localScale bakes NO `PostTransformMatrix`, so the write job reduces the blended float3
  to `.x`: a (1.5,0.5,1.5) squash plays as uniform 1.5 on a plain capsule — no squash, no
  warning, the clip inspector still shows the full Vector3. DO give the binding a
  non-uniform authoring localScale to force the matrix branch (even (1, 1.0001, 1) works,
  though an honest value documents intent). A clip field can be faithfully serialized AND
  baked yet 2/3-discarded depending on the BINDING's baked shape.
- **DON'T assume a fresh ScaleClip is inert OR destructive** — default is Vector3.one
  (verified YAML `Scale: {x: 1, y: 1, z: 1}`): a visual no-op only when the binding's
  current scale IS 1; on an already-scaled entity it animates it back to 1. (Contrast
  PositionClip's (0,0,0) default, which teleports to origin.) Defaults define the no-op direction.
- **DON'T promise "zero scale is safe" or "impossible"** — `(0,0,0)` serializes verbatim,
  nothing clamps targets: at full weight it genuinely writes `float4x4.Scale(0,0,0)` or
  `LocalTransform.Scale = 0`. The runtime clamp protects only CURRENT scale, only in the
  PostTransformMatrix branch, only when ALL THREE column lengths are exactly zero (a single
  zero axis is not clamped), and only as the blend's fill value for uncovered weight. The
  uniform branch has NO clamp at all — a zeroed uniform entity has no recovery.
- **DON'T conflate the two reset bools** — saved YAML shows both `resetOnDeactivate: 1`
  (DOTSTrack base) and `ResetScaleOnDeactivate: 1` (track-declared) side by side; only
  the latter feeds `ScaleTrackBuilder`/`ScaleState`. Set the one you mean.
- **DON'T guess type names** (the double-`Authoring` namespace is real and compiles —
  reflection-verify first per `unity-timeline-track-authoring` §1 D1) and **DON'T read
  Editor World entity counts as bake proof** (0 baked entities for a closed SubScene is
  normal: streaming `SceneReference` only, import is async — proves nothing).
- **DO trust director binding tables across playableAsset swaps** — the table is keyed
  per-track asset and persists in the scene file regardless of which timeline is assigned
  (verified: a prior track's binding survived the swap; both coexisted). UNDO corollary:
  deleting your .playable does NOT remove your binding entry.

## 3. DISCOVERY

Per `unity-timeline-track-authoring` §1 (D1–D5), with these scale-specific bindings:
- **D1 type check:** `BovineLabs.Timeline.Transform.Authoring.Authoring.Scale.TransformScaleTrack,
  BovineLabs.Timeline.Transform.Authoring` (note the double `Authoring`). Absent →
  `MISSING_PREREQUISITE|package com.bovinelabs.timeline.transform absent in this project`.
- **D4 bind target:** find candidate `UnityEngine.Transform`s on SubScene-baked objects;
  confirm with the designer when several are plausible. Then ALSO print the binding's
  authoring `localScale` — if UNIFORM, per-axis clip values will X-collapse (§2 trap), so
  for real squash/stretch plan recipe 4.2 (the scene object itself must change).
- **D5 extra capture:** add `PRE|localScale=<binding's current localScale>` whenever
  recipe 4.2 might run — UNDO-3 restores this EXACT captured value, never "(1,1,1)".

## 4. CANONICAL CLIP PATTERNS (the bracket's track-specific middle)

Author per the `unity-timeline-track-authoring` §2 bracket; the block below is only its
TRACK-SPECIFIC MIDDLE (replace the `// ---- TRACK-SPECIFIC MIDDLE ----` region). Values
and timings are example choices, NOT package constants. Three designer intents wired:

**4.1 Grow → squash → ease-back (one timeline, three clips):**

```csharp
var track = timeline.CreateTrack<BovineLabs.Timeline.Transform.Authoring.Authoring.Scale.TransformScaleTrack>(null, trackName);
track.ResetScaleOnDeactivate = true; // restore the binding's pre-track scale on deactivate

// intent "grow uniformly": Scale (2,2,2) over 0-2s
var clipA = track.CreateClip<BovineLabs.Timeline.Transform.Authoring.Authoring.Scale.ScaleClip>();
clipA.start = 0; clipA.duration = 2; clipA.displayName = "<clipName>";
((BovineLabs.Timeline.Transform.Authoring.Authoring.Scale.ScaleClip)clipA.asset).Scale = new UnityEngine.Vector3(2f, 2f, 2f);

// intent "squash" (per-axis): blends in over the overlap with A. WARNING (§2 trap):
// per-axis only works if the binding bakes a PostTransformMatrix; uniform binding uses X only.
var clipB = track.CreateClip<BovineLabs.Timeline.Transform.Authoring.Authoring.Scale.ScaleClip>();
clipB.start = 1.5; clipB.duration = 2; clipB.displayName = "<clipName>";
((BovineLabs.Timeline.Transform.Authoring.Authoring.Scale.ScaleClip)clipB.asset).Scale = new UnityEngine.Vector3(1.5f, 0.5f, 1.5f);
clipB.blendInDuration = 0.5; // explicit blendIn on the LATER clip => mirrored blendOut on A

// intent "ease back to whatever size the binding had when THIS clip activates": ScaleStartClip
var clipC = track.CreateClip<BovineLabs.Timeline.Transform.Authoring.Authoring.Scale.ScaleStartClip>();
clipC.start = 3.5; clipC.duration = 1.5; clipC.displayName = "<clipName>";

foreach (var o in new UnityEngine.Object[] { track, (UnityEngine.Object)clipA.asset, (UnityEngine.Object)clipB.asset, (UnityEngine.Object)clipC.asset })
    UnityEditor.EditorUtility.SetDirty(o);
```

The bracket's bind step uses `GetComponent<UnityEngine.Transform>()` for `<BIND_TARGET>`.

**4.2 OPTIONAL — force the per-axis (PostTransformMatrix) branch** when the designer wants
real squash/stretch on a uniform-scale binding (§2 bake rule; proven live with (1,1.2,1),
then reverted). Mutates the SCENE object, NOT the asset; separate exec block, same SubScene
bracket as `unity-timeline-track-authoring` §2:

```csharp
// PRE|localScale=<CAPTURED current value>   (print + journal - UNDO-3 restores it)
var actor = UnityEngine.GameObject.Find("<bindTargetPath>");
actor.transform.localScale = new UnityEngine.Vector3(1f, 1.2f, 1f); // <CHOSEN, non-uniform>
UnityEditor.SceneManagement.EditorSceneManager.SaveScene(actor.scene);
// verify per §4 from a fresh load: saved scene YAML must show the non-uniform m_LocalScale
```

## 5. UNDO — DELTA vs the shared appendix

Per `unity-timeline-track-authoring` §3 (artifact inventory 1–4, restore-director-first
ORDER, UNDO-1/2/4). This track adds ONE artifact and ONE journal entry:

- **Artifact 5 (only if recipe 4.2 ran):** the binding's authoring `localScale` was
  mutated. Restore the CAPTURED `PRE|localScale` — never assume (1,1,1); the pre-state
  might already be non-uniform. Restored in ORDER position 3 (after director, after asset).

```csharp
// UNDO-3: only if recipe 4.2 ran — restore the binding's CAPTURED localScale (SubScene
// bracket as in shared UNDO-1). VERIFIED inversion: the vex-ee demo was reverted exactly
// this way and confirmed via saved-YAML grep + fresh load.
var actor = UnityEngine.GameObject.Find("<CAPTURED bindTargetPath>");
actor.transform.localScale = new UnityEngine.Vector3(/* CAPTURED PRE|localScale */ 1f, 1f, 1f);
UnityEditor.SceneManagement.EditorSceneManager.MarkSceneDirty(actor.scene);
UnityEditor.SceneManagement.EditorSceneManager.SaveScene(actor.scene);
return "UNDONE|localScale restored";
```

UNDO-4 verification additionally prints the binding's `localScale` (must equal the CAPTURED
`PRE|localScale`) and greps the saved scene YAML for stray non-captured `m_LocalScale` lines.

## 6. VERIFICATION — DELTA vs the shared protocol

Per `unity-timeline-track-authoring` §4. Scale-specific field dumps for its step 1/2:
- Asset dump (step 1): per clip — name, start/duration, blendIn/blendOut, caps, asset type,
  the `Scale` Vector3, both reset fields (`ResetScaleOnDeactivate` + `resetOnDeactivate`),
  and the CLIP COUNT (temp clips must be gone).
- Raw YAML (step 2): `Scale: {x:…, y:…, z:…}` per clip + both reset keys; the binding's
  SubScene `m_LocalScale` exactly what discovery captured (or what 4.2 set) — no stray
  scale mutations on other objects.

## 7. WORKED EXAMPLE — delta vs the shared stage (`unity-timeline-track-authoring` §5)

Same vex-ee stage (`/home/i/GitHub/vex-ee`, parent `Assets/Scenes/Main Scene.unity`,
SubScene `Assets/Scenes/Main Sub Scene.unity`, `Stage_Director` the only director). Binding
was `Stage_LinkRoot/Stage_Actor` (capsule at (0,1,0), localScale (1,1,1) — UNIFORM, so the
X-collapse case applies). This track's delta:
- Asset `Assets/Training/02-transform-scale-track/ScaleMastery.playable` — track `ScaleTrack`
  (`ResetScaleOnDeactivate: 1`, inherited `resetOnDeactivate: 1`); 3 clips: A_Double 0–2s
  Scale (2,2,2) / B_Squash 1.5–3.5s Scale (1.5,0.5,1.5) `blendIn=0.5` (mirrored
  `blendOut=0.5` on A) / C_BackToStart 3.5–5s ScaleStartClip. Temp clips (TMP_Fresh, the
  (0,0,0) demo) removed, verified from fresh load.
- `binding[ScaleTrack]=Stage_Actor (Transform)` added; lesson 01's `binding[PositionTrack]`
  survived the swap; playableAsset RESTORED to `PositionMastery.playable` at session end.
- Recipe 4.2 demo ran: Stage_Actor (1,1,1) → (1,1.2,1) → REVERTED to (1,1,1) (saved-YAML
  grep zero non-uniform lines + fresh load). Stage left in the uniform case.
