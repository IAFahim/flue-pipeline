---
name: unity-track-entitylink-copytransform
description: Master of EntityLinkCopyTransformTrack + EntityLinkCopyTransformClip (EntityLinks package, BovineLabs.Timeline.EntityLinks) — schema-link resolution, the verified Target enum, follow/attach via per-frame transform copy, and the unassigned-ECB package bug. Portable to any project containing the package; worked example from vex-ee. Use when a designer asks "make this follow/attach to that linked thing during a clip".
---

# EntityLinkCopyTransformTrack specialist

## 1. SCOPE

You are the specialist for **`EntityLinkCopyTransformTrack`** and **`EntityLinkCopyTransformClip`**
from the EntityLinks package (`BovineLabs.Timeline.EntityLinks`, namespace
`BovineLabs.Timeline.EntityLinks.Authoring`): making one entity follow/attach to a
schema-link-resolved source entity via a per-frame world-pose copy while a clip is active.
**This skill also carries the EntityLinks FAMILY reference material** (the verified `Target`
enum, the three-step resolver, the loud-bake/silent-runtime rule) — the Mutate, Parent and
TargetPatch skills cross-reference these sections rather than restating them. Stage construction
belongs to `unity-stage-foundations`; the other three EntityLinks tracks to their own skills.

**Operate per `unity-timeline-track-authoring`; behave per `unity-agent-protocol`; use the
editor per `unity-cli`.** That shared skill owns the discovery preamble (§1), the SubScene
create-and-wire bracket (§2), the undo-appendix structure (§3), and the fresh-load verification
protocol (§4); cited inline below. This skill keeps ONLY what is unique to this track family.
In the proving project the package source lives under `Packages/` (NOT PackageCache, unlike
timeline core) — locate it by query, not by habit.

## 2. TYPE FACTS

All verified vex-ee 2026-06 via reflection dumps, package-source quotes through
`File.ReadAllText` inside `unity-cli exec`, raw YAML reads, fresh-load read-backs. No play mode:
runtime claims are source-derived; the overlap verdict is honestly INCONCLUSIVE.

| Type | Base | Facts |
|---|---|---|
| `EntityLinkCopyTransformTrack` | `DOTSTrack` | sealed, `[TrackBindingType(typeof(TargetsAuthoring))]` (`BovineLabs.Reaction.Authoring.Core.TargetsAuthoring` — the bind target), `[TrackColor(0.85,0.2,0.4)]`, `[TrackClipType(EntityLinkCopyTransformClip)]`, `[DisplayName("BovineLabs/Entity Links/Copy Transform")]`, no Bake override. |
| `EntityLinkCopyTransformClip` | `DOTSClip` | `ClipCaps.None` (no blend/ease), `duration => 1` (seed only — freely resizable after `CreateClip`). |

### Clip fields (reflection + fresh-instance defaults)
| Field | Type | Default | Meaning |
|---|---|---|---|
| `entityToMove` | `Target` | `Target` (=1) | WHO MOVES — resolved through the binding entity's `Targets` |
| `readRootFrom` | `Target` | `Owner` (=2) | Where to start the link-map hunt (TRAP — see traps) |
| `link` | `EntityLinkSchema` | null | The ushort key; null → LOUD bake error |
| `copyPosition` / `copyRotation` | bool | True / True | Copy mask, per-channel |
| `positionOffset` | Vector3 | (0,0,0) | Applied in SOURCE space |
| `rotationOffset` | Vector3 | (0,0,0) | Euler degrees, baked to quaternion |

Bake produces `EntityLinkCopyTransform { Target EntityToMove; Target ReadRootFrom; ushort
LinkKey; bool CopyPosition; bool CopyRotation; float3 PositionOffset; quaternion RotationOffset; }`
on the clip entity (`EntityLinkCopyTransformBuilder.ApplyTo`). Euler→quaternion is bake-time:
`RotationOffset = quaternion.Euler(math.radians(rotationOffset))`; the .playable YAML stores the
authored Euler verbatim — the quaternion only exists post-bake.

### FAMILY REFERENCE 1 — the verified `Target` enum

`BovineLabs.Reaction.Data.Core.Target`, assembly `BovineLabs.Reaction.Data`, **byte-backed**:
`None=0, Target=1, Owner=2, Source=3, Self=4, Custom=6`. **Value 5 does not exist** (gap before
Custom=6); member order differs from older docs. `(int)` casts on boxed values throw — use
`System.Convert.ToInt64`. `Targets.Get` semantics (source-quoted): `None → Entity.Null;
Target/Owner/Source/Custom → that slot; Self → self`. `Targets` is `IComponentData { Entity
Owner, Source, Target, Custom }`, baked from `TargetsAuthoring`; `Self` = the entity carrying
the `Targets` (for timeline clips: the **track-binding entity**); `None` and unset slots resolve
to `Entity.Null`.

### FAMILY REFERENCE 2 — the resolver walkthrough

Every EntityLinks clip resolves a SOURCE entity through the same three-step chain in
`EntityLinkResolver` (`BovineLabs.Timeline.EntityLinks/EntityLinkResolver.cs`):
**Step 0 — Target enum hop.** `targets.Get(readRootFrom, self)` on the track-binding entity's
`Targets`; `None`/unset slot → `Entity.Null` → resolution fails immediately.
**Step 1 — root hop** (`TryResolveRoot`, source-quoted): `root = sources.TryGetComponent(entity,
out var source) && source.Root != Entity.Null ? source.Root : entity;` — if the candidate
carries `EntityLinkSource` (struct `{ Entity Root; }`) with non-null Root, hop there; otherwise
**the candidate itself is the root** — no error.
**Step 2 — buffer search** (`TryResolveFromRoot`): linear search of the root's `EntityLinkEntry`
buffer (`{ ushort Key; Entity Target; }`, baked by `EntityLinkRootAuthoring`'s baker) for
`Key == LinkKey`. Guards: null root, **key 0**, missing buffer, key absent — all return false
**silently**. (Concrete walkthrough on the worked-example stage in §6.)

### FAMILY REFERENCE 3 — the loud-bake/silent-runtime rule

Bake is the ONE loud layer: a null schema makes `EntityLinkAuthoringUtility.TryGetKey`
(`key = schema == null ? (ushort)0 : schema.Id; return key != 0;`) return false and `Bake` does
`Debug.LogError($"... '{name}' missing link schema."); return;` — the component is never added.
EVERY runtime failure (null binding, missing Targets, Entity.Null slot, missing LocalTransform,
key 0, key absent, missing buffer, source without LocalToWorld) is a silent per-frame skip —
CopyTransform hardwires `Fallback = Target.None`. The family clips share this null-link bake
`LogError` pattern, `ClipCaps.None`, and `duration => 1`. Family one-liners (reflection-dumped;
full facts in the sibling skills): MutateClip rewrites the root's `EntityLinkEntry` buffer
(`mode` Assign=0/Swap=1/Remove=2, `readRootFrom` default **Source**, `newTarget` default Target,
`swapLink`); ParentClip reparents `entityToParent` (default Target) under the link-resolved
entity with `localPosition`/`localRotation` + `restoreOnEnd` (default true); TargetPatchClip
writes the link-resolved entity INTO the binding's `Targets` slot `WriteTo` (default Target)
with `Fallback`, bake-erroring on `WriteTo` None/Self.

### Runtime copy mechanics (`EntityLinkCopyTransformSystem.CopyTransformJob`)

`[WithAll(typeof(ClipActive))]`, every active frame in `TimelineComponentAnimationGroup`:
resolve mover via `targets.Get(EntityToMove, binding)`; resolve SOURCE via the family resolver;
take the source's `LocalToWorld` pose; apply offsets **in source space** (source-quoted:
`desiredWorldPos += math.rotate(desiredWorldRot, config.PositionOffset)` when CopyPosition and
offset non-zero; `desiredWorldRot = math.mul(desiredWorldRot, config.RotationOffset)` when
CopyRotation and non-identity — position offset rotated by the source's CURRENT pre-offset
rotation; rotation offset right-multiplied, a local-space twist); then, if the mover has a
`Parent` with `LocalToWorld`, convert world → parent-local before writing `LocalTransform`,
else write world directly. Copy mask is per-channel; the untouched channel keeps the mover's
current value. The write goes through the BeginSimulation ECB — one frame latent, whole-component
replace, no blending. Per-frame only: nothing persists after the clip deactivates, and nothing
ever touches editor/authoring state.

### Silence profile

Bake is loud on a null schema (LogError, component never added) and on the one silent bake path
(id-0 pre-import schema bakes with key 0 but never resolves). EVERYTHING at runtime is silent:
every resolution failure is a per-frame skip with no log. A clean console is therefore not
evidence — verify the YAML and the fresh-load read-back per unity-timeline-track-authoring §4.

### PACKAGE BUG — THE UNASSIGNED ECB (triage rule; portable truth about this package version)

In the shipped `EntityLinkCopyTransformSystem.OnUpdate`, the command buffer is created but
**never assigned to the job** — the `ECB = ecb` line is missing from the job initializer, so
`ECB.SetComponent` operates on an uninitialized writer, expected to throw at the first
fully-resolved active frame. NOT play-mode verified (play mode forbidden); literal reading of
the shipped source. **Triage rule: anyone debugging "CopyTransform clip does nothing / throws"
checks this line in `OnUpdate` FIRST**, before suspecting their own wiring.

### Traps & DO/DON'T (each proven live or source-quoted, vex-ee 2026-06)

- **DON'T expect a silent skip from a null schema — LOUD bake LogError**
  (`"EntityLinkCopyTransformClip '<name>' missing link schema."`); component never added.
- **DO know the ONE silent bake path: an id-0 pre-import schema** — read pre-import it has id 0;
  it bakes fine (key 0) but the `key != 0` guard makes it never resolve, silently. Ids are
  assigned at import — always read ids from a FRESH load.
- **DO rely on the root-hop fallback** — an entity without `EntityLinkSource` is its own root;
  no `EntityLinkEntry` buffer there → `Entity.Null` → silent per-frame skip, no log.
- **DON'T trust the default `readRootFrom = Owner`** — on a binding whose `Targets.Owner` is
  unset, Owner → `Entity.Null` → the clip silently never resolves (proven on the vex-ee stage,
  §6). **Use `Self` when the bound entity itself carries the EntityLinkSource**; derive from the
  discovered slot layout, never from the default.
- **DO read offsets in SOURCE space** — (0,3,0) is "3 units along the SOURCE's local up"; a
  source pitched 90° puts the follower at +3 world X, not above; the offset rides the source's
  orientation every frame.
- **DO trust the parent-aware write** — the desired WORLD pose is converted into the mover's
  parent space before the write, so the visual result is parent-independent; caveat: a `Parent`
  without `LocalToWorld` falls through to the world write, double-transforming.
- **DON'T expect blending — `ClipCaps.None` means hard snaps** at clip entry/exit.
- **DON'T claim an overlap winner — honestly INCONCLUSIVE** — overlapping active clips (two
  tracks, same mover) each `ECB.SetComponent` the whole `LocalTransform`; playback order is
  `sortKey = [EntityIndexInQuery]` (chunk order) — last-writer-wins by entity-in-query order,
  NOT clip start time, and moot until the ECB bug is fixed.
- **DON'T create schema assets — a missing prerequisite (protocol §6)** — discover existing ones
  by type; report a missing/id-0 schema as a missing prerequisite.

## 3. DISCOVERY

Run the discovery preamble per **unity-timeline-track-authoring §1** (D1 package check, D2 scene
+ SubScene, D3 director selection, D4 bind-target by component, D5 `PRE|` capture). Track-specific
deltas to its generic steps:

- **D1 package check** confirms BOTH the track type
  (`BovineLabs.Timeline.EntityLinks.Authoring.EntityLinkCopyTransformTrack,
  BovineLabs.Timeline.EntityLinks.Authoring`) AND the bind type
  (`BovineLabs.Reaction.Authoring.Core.TargetsAuthoring, BovineLabs.Reaction.Authoring`); either
  absent → MISSING_PREREQUISITE.
- **D4 bind target is the `TargetsAuthoring` COMPONENT** (never the Transform). Print each
  holder's hierarchy path AND its slot values (Owner/Source/Target/Custom).
- **Link-wiring discovery (this track's extra prerequisite):** find `EntityLinkSourceAuthoring`
  and `EntityLinkRootAuthoring` holders; print each source's Root + Schemas and each root's
  children/key set. Schema assets by TYPE with a live id dump (ids DRIFT; never trust remembered):
  `AssetDatabase.FindAssets("t:EntityLinkSchema")` → per asset print `SCHEMA|<path>|guid=<g>|id=<n>`,
  reading the `Id` property (or `id` field) via `System.Convert.ToInt64` (byte/ushort-backed).
  id==0 ⇒ unusable (silent never-resolve). A usable schema must already exist with a non-zero
  imported id AND its key present in the intended root's source set. **NEVER create schema
  assets** — out of domain.
- **Derive `readRootFrom` from the discovered layout:** `Self` if the bound object itself carries
  the EntityLinkSource; otherwise the Targets slot whose entity carries it — confirm the slot is
  actually SET. Never accept the default `Owner` blindly (the trap above).

## 4. CANONICAL RECIPES (the bracket's track-specific middle)

Use the SubScene create-and-wire bracket from **unity-timeline-track-authoring §2** verbatim:
track type `BovineLabs.Timeline.EntityLinks.Authoring.EntityLinkCopyTransformTrack`, bind
component `BovineLabs.Reaction.Authoring.Core.TargetsAuthoring`. Load the discovered schema with
`AssetDatabase.LoadAssetAtPath<BovineLabs.Timeline.EntityLinks.Authoring.EntityLinkSchema>(schemaPath)`.
Replace the bracket's clip middle with one of these patterns (designer intent → wiring). Clip
starts/durations/offsets are example choices, not package constants. If direct field assignment
fails to compile in the sandbox, set every field via `SerializedObject` using the camelCase YAML
names.

**HOVER-FOLLOW** — "make this hover above / track that linked thing, position only":
`entityToMove = Target.Target` (the binding's Target slot moves); `readRootFrom = <DERIVED>`
(e.g. `Target.Self` when the bound object carries the EntityLinkSource — default `Owner` is the
trap); `link = schema`; `copyPosition = true`, `copyRotation = false`;
`positionOffset = new Vector3(0,3,0)` (in SOURCE space — "3 along the source's local up").

**FULL-SNAP** — "stick this fully onto that linked thing, pose and facing":
same fields with `copyPosition = copyRotation = true` and
`rotationOffset = <CHOSEN Euler degrees>` (e.g. `(0,90,0)`; YAML keeps the Euler verbatim, the
quaternion is bake-time only).

## 5. CROSS-REFERENCES

Sibling EntityLinks track skills (`unity-track-entitylink-mutate`, `-parent`, `-targetpatch`)
cite FAMILY REFERENCE 1–3 here rather than restating them. Stage construction →
`unity-stage-foundations`. Schema/link concepts → `unity-targets`, `unity-gameplay-config`.

## 6. WORKED EXAMPLE (vex-ee training stage) — example environment; rediscover, never assume

Delta vs the shared stage in unity-timeline-track-authoring §5:
- Package at `/home/i/GitHub/vex-ee/Packages/BovineLabs.Timeline.EntityLinks/` (under `Packages/`,
  not PackageCache). `Stage_Actor` carries `TargetsAuthoring` (Target=Stage_Target,
  Owner/Source/Custom unset) AND `EntityLinkSource` (Root=Stage_LinkRoot, Schemas=[Schema_Actor]);
  `Stage_LinkRoot` bakes `{Key=10, Target=Stage_Actor}`; `Stage_Target` (cube) is a root object
  (direct world-write path). Schema `Assets/Training/00-foundations/Schema_Actor.asset`: imported
  `id: 10`, guid `3b375c42affc2917f956d01310d31894`.
- Asset built: `Assets/Training/07-entitylink-copytransform-track/CopyTransformMastery.playable`,
  track `CopyTransformTrack` bound to `Stage_Actor`'s `TargetsAuthoring`. Clip A_HoverFollow 0–4s
  (entityToMove=Target, readRootFrom=Self, link=Schema_Actor, copyPos=True copyRot=False,
  posOff=(0,3,0)); clip B_FullSnap 4–6s (copy both, rotOff=(0,90,0) Euler verbatim in YAML). Clip A
  YAML: `entityToMove: 1`, `readRootFrom: 4`,
  `link: {fileID: 11400000, guid: 3b375c42affc2917f956d01310d31894, type: 2}`.
- Resolver walkthrough (clip A): binding=Stage_Actor → `Self` → Stage_Actor → Root=Stage_LinkRoot
  → buffer key 10 → SOURCE=Stage_Actor; `entityToMove=Target` → Stage_Target — the cube copies the
  capsule's world position + (0,3,0) in the capsule's local frame, every active frame. Training
  deviation: clip B's unspecified `readRootFrom` set to `Self` (default `Owner` is unset on
  Stage_Actor → guaranteed silent skip).
- After the lesson the director was RESTORED to
  `Assets/Training/01-transform-position-track/PositionMastery.playable`; binding table 5 entries
  all → Stage_Actor (the CopyTransformTrack→TargetsAuthoring entry left as permanent additive
  stage state).

## 7. UNDO & VERIFICATION

Undo per **unity-timeline-track-authoring §3** and verify per **§4** — both standard for this
family, with these track-specific notes:

- **Undo runtime note:** the per-frame `LocalTransform` copy happens only in play mode (and is
  expected to throw under the unassigned-ECB bug, §2); nothing persists after the clip or into
  authoring data — **nothing runtime-side to undo**. The journal reverses only the authoring
  artifacts (asset, folder, `director.playableAsset`, the added generic-binding entry).
- **Loud-bake demo extra (if reproduced):** the temp null-link clip and its deliberate console
  LogError — console history is not undoable; record it in the card instead.
- **Verification field list (§4 step 1):** dump track + clips with name, start/end, `entityToMove`,
  `readRootFrom`, link asset + imported id, copy mask, offsets.
- **Verification YAML check (§4 step 2):** `link:` is `{fileID: 11400000, guid: <schema guid>,
  type: 2}` (never `{fileID: 0}`); enum bytes match intent (`entityToMove: 1`, `readRootFrom: 4`);
  authored Euler verbatim (`rotationOffset:` keeps degrees). Plus a schema check: the schema
  asset's fresh YAML `id:` must be non-zero (vex-ee: 10).
- **Binding expectation (§4 step 4):** `BINDING|<trackName>|bound=<bindTarget> (TargetsAuthoring)`
  — the COMPONENT, not the Transform — all captured prior bindings intact.
