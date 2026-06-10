# flue-pipeline

An N-step agent pipeline on [Flue](https://flueframework.com). One agent executes a workflow of N ordered steps; each step is its own skill. The pipeline is data, not code: `src/pipeline.ts` is the single declaration of which steps exist and in what order.

## Architecture

```
src/
├─ pipeline.ts                 the pipeline: an ordered, readonly list of skill references
├─ skills/
│  ├─ outline/SKILL.md         step 1
│  ├─ draft/SKILL.md           step 2
│  └─ polish/SKILL.md          step 3 … step N
├─ agents/
│  └─ pipeline-runner.ts       the agent: model + every pipeline skill
└─ workflows/
   └─ run-pipeline.ts          the run: a fold of the session over the pipeline
```

The workflow threads each step's `output` into the next step's `input`. Every edge is typed and validated: the payload is parsed by a schema on entry, and every skill must return `{ output: string }` before the fold continues. The result contains the full per-step trace, so each step's output is visible.

## Setup

```sh
npm install
cp .env.example .env        # then paste your real Anthropic API key into .env
```

## Run the pipeline

```sh
npm run pipeline -- '{"input": "why composable systems beat monoliths"}'
```

Or directly:

```sh
npx flue run run-pipeline --target node --payload '{"input": "why composable systems beat monoliths"}'
```

The printed JSON contains `input`, `steps` (name + output of every step, in order), and `result` (the final step's output).

## Add step N+1

1. Create `src/skills/<name>/SKILL.md` with `name` and `description` frontmatter, instructions that read `input` from the arguments, and a structured result with one field `output`.
2. Add two lines to `src/pipeline.ts`: the import, and its position in the list.

Nothing else changes. Removing a step is deleting those two lines and the folder.

## Other commands

```sh
npm run typecheck           # tsc --noEmit
npm run dev                 # dev server on :3583, rebuilds on edit
npm run build               # production server at dist/server.mjs
```
