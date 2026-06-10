# flue-pipeline

Bare-minimum N-step agent pipeline on [Flue](https://flueframework.com).

## How it works

```
src/
  pipeline.ts              ordered list of skill references (the pipeline)
  skills/echo/SKILL.md     one step: takes input, returns { output }
  agents/pipeline-runner   createAgent() with model + pipeline skills
  workflows/run-pipeline   folds session over the pipeline
```

The workflow loops through `pipeline`, calling `session.skill()` on each step.
Each skill receives `{ input }` and must return `{ output: string }`.
The output of step N becomes the input of step N+1.

## Setup

```sh
npm install
cp .env.example .env    # paste your MiniMax API key
```

## Run

```sh
npx flue run run-pipeline --target node --payload '{"input":"hello world"}'
```

## Add a step

1. Create `src/skills/<name>/SKILL.md` with name/description frontmatter
2. Import it in `pipeline.ts` and add to the array

That's it. Removing a step is deleting the folder and the import line.
