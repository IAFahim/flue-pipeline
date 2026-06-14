import { defineTool } from '@flue/runtime';
import { execFileSync } from 'node:child_process';

// Phase 1a: expose the deterministic Unity "vex" tools (the [UnityCliTool] family)
// to flue AI agents as model-callable tools, so an agent can INVOKE a verified
// tool instead of hand-authoring C#. Both tools shell out to the `unity-cli`
// binary exactly the way the workflows do (execFileSync, 120s timeout) — the
// agent has no shell of its own; the runtime runs this on the user's machine.

// Run unity-cli and return its output. unity-cli exits NON-ZERO when a tool
// reports success:false, but the JSON envelope is still printed to stdout — so
// on error we prefer the captured stdout (the real envelope) and only fall back
// to stderr/message when there is no stdout. We RETURN the error string rather
// than throwing so the model always sees the envelope/error as the tool result.
function cli(args: string[]): string {
	try {
		return execFileSync('unity-cli', args, { encoding: 'utf8', timeout: 120000 }).trim();
	} catch (e: any) {
		const out = e?.stdout?.toString?.().trim?.();
		if (out) return out;
		return 'CLI FAILED: ' + (e?.stderr?.toString?.() || e?.message || String(e));
	}
}

const vexSchemas = defineTool({
	name: 'vex_schemas',
	description:
		'List the deterministic Unity vex tools you can call with vex_call. CALL THIS FIRST before authoring C#; if a tool fits, use vex_call instead of writing C#. Optional `filter` substring-matches tool name/description.',
	parameters: {
		type: 'object',
		properties: {
			filter: {
				type: 'string',
				description: 'Optional substring to match against tool name/description.',
			},
		},
	},
	async execute(args) {
		const raw = cli(['vex_schemas']);
		const filter = String(args?.filter ?? '').trim().toLowerCase();
		if (!filter) return raw;
		// Best-effort filter: parse, keep tools whose name/description contains the
		// substring, re-stringify. On any parse failure return the raw output.
		try {
			const parsed = JSON.parse(raw);
			const match = (t: any) =>
				JSON.stringify(t?.name ?? '').toLowerCase().includes(filter) ||
				JSON.stringify(t?.description ?? '').toLowerCase().includes(filter);
			if (Array.isArray(parsed)) {
				return JSON.stringify(parsed.filter(match));
			}
			// Envelope shape: {success,message,data:{...tools...}} — filter the most
			// likely tool-bearing array/object without assuming an exact shape.
			const container = parsed?.data ?? parsed;
			if (Array.isArray(container)) return JSON.stringify(parsed);
			if (container && typeof container === 'object') {
				for (const k of Object.keys(container)) {
					if (Array.isArray(container[k])) {
						const filtered = { ...parsed, data: { ...container, [k]: container[k].filter(match) } };
						return JSON.stringify(filtered);
					}
				}
			}
			return raw;
		} catch {
			return raw;
		}
	},
});

const vexCall = defineTool({
	name: 'vex_call',
	description:
		'Invoke a deterministic Unity vex tool by name. Returns {success,message,data:{result,pre,undo,verify}}. Prefer this over hand-written C#; tools handle the SubScene save/restore bracket, capture pre-state, return an undo journal, and self-verify. Use vex_schemas to discover names+params. Fall back to authoring C# only when no tool fits.',
	parameters: {
		type: 'object',
		properties: {
			tool: { type: 'string', description: 'The vex tool name to invoke.' },
			params: { type: 'object', description: 'Parameter object for the tool (default {}).' },
		},
		required: ['tool'],
	},
	async execute(args) {
		const tool = String(args?.tool ?? '').trim();
		if (!tool) return 'CLI FAILED: vex_call requires a `tool` name.';
		const params = args?.params ?? {};
		return cli([tool, '--params', JSON.stringify(params)]);
	},
});

export const vexTools = [vexSchemas, vexCall];
