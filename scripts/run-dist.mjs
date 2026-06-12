#!/usr/bin/env node
// run-dist — invoke ONE workflow against the ALREADY-BUILT dist/server.mjs,
// skipping the `flue run` rebuild that otherwise happens on every invocation.
//
// `flue run` = build + spawn `node dist/server.mjs` (FLUE_MODE=local, IPC) +
// one {type:"invoke"} message + print the result JSON. This script replays
// exactly that local IPC protocol minus the build. Callers are responsible
// for freshness (rebuild when anything under src/ is newer than
// dist/server.mjs — see marimo-unity-cli src/unity_codex/flue.py).
//
// Usage: node scripts/run-dist.mjs <workflow> [payload-json]
// Output contract matches `flue run`: progress/events on stderr, the
// workflow's result as formatted JSON on stdout, exit 0/1.

import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const serverPath = path.join(root, 'dist', 'server.mjs');

const [workflow, payloadJson = '{}'] = process.argv.slice(2);
if (!workflow) {
	console.error('usage: node scripts/run-dist.mjs <workflow> [payload-json]');
	process.exit(2);
}
if (!fs.existsSync(serverPath)) {
	console.error(`[run-dist] ${serverPath} not found — run \`npx flue build --target node\` first`);
	process.exit(2);
}
let payload;
try {
	payload = JSON.parse(payloadJson);
} catch (err) {
	console.error(`[run-dist] payload is not valid JSON: ${err.message}`);
	process.exit(2);
}

// .env loading, same precedence as the flue CLI: shell values win, the file
// only fills gaps. NEVER echo values — the file holds the provider API key.
function loadDotEnv(file) {
	let text;
	try {
		text = fs.readFileSync(file, 'utf8');
	} catch {
		return;
	}
	for (const rawLine of text.split('\n')) {
		const line = rawLine.trim();
		if (!line || line.startsWith('#')) continue;
		const eq = line.indexOf('=');
		if (eq <= 0) continue;
		const key = line.slice(0, eq).trim().replace(/^export\s+/, '');
		if (process.env[key] !== undefined) continue;
		let value = line.slice(eq + 1).trim();
		if (
			(value.startsWith('"') && value.endsWith('"')) ||
			(value.startsWith("'") && value.endsWith("'"))
		) {
			value = value.slice(1, -1);
		}
		process.env[key] = value;
	}
}
loadDotEnv(path.join(root, '.env'));

const child = spawn('node', [serverPath], {
	stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
	cwd: root,
	env: {
		...process.env,
		FLUE_MODE: 'local',
		FLUE_CLI_TARGET: 'workflow',
		FLUE_CLI_NAME: workflow,
	},
});
const pipeOutput = (data) => {
	for (const line of data.toString().trimEnd().split('\n')) {
		if (line.trim()) console.error(line);
	}
};
child.stdout?.on('data', pipeOutput);
child.stderr?.on('data', pipeOutput);

// Minimal mirror of the flue CLI's event logger: enough for a human (or the
// marimo log stream) to follow progress; everything goes to stderr.
let textBuffer = '';
function flushText() {
	if (!textBuffer) return;
	for (const line of textBuffer.split('\n')) if (line) console.error(`  ${line}`);
	textBuffer = '';
}
function logEvent(event) {
	switch (event?.type) {
		case 'text_delta': {
			const lines = (textBuffer + (event.text ?? '')).split('\n');
			textBuffer = lines.pop() ?? '';
			for (const line of lines) console.error(`  ${line}`);
			break;
		}
		case 'thinking_start':
			flushText();
			console.error('[flue] thinking:start');
			break;
		case 'tool_start':
			flushText();
			console.error(`[flue] tool:start  ${event.toolName ?? ''}`);
			break;
		case 'tool_call':
			flushText();
			console.error(`[flue] tool:${event.isError ? 'error' : 'done'}   ${event.toolName ?? ''}`);
			break;
		case 'compaction_start':
			flushText();
			console.error(`[flue] compaction:start  reason=${event.reason}`);
			break;
		case 'log':
			flushText();
			console.error(`[flue] ${event.level ?? 'info'}: ${event.message ?? ''}`);
			break;
		case 'error':
			flushText();
			console.error(`[flue] ERROR [${event.error?.type ?? 'unknown'}]: ${event.error?.message ?? ''}`);
			break;
		default:
			break;
	}
}
function formatLocalError(message) {
	const error = message?.error;
	if (!error) return 'Unknown local execution error.';
	const lines = [`[${error.type ?? 'unknown'}] ${error.message ?? 'Unknown error'}`];
	if (error.details) lines.push(String(error.details));
	if (error.dev) lines.push(String(error.dev));
	return lines.join('\n');
}

const requestId = `req_${randomUUID()}`;
let finished = false;
function finish(code) {
	if (finished) return;
	finished = true;
	if (!child.killed) child.kill('SIGTERM');
	process.exitCode = code;
}

const readyTimeout = setTimeout(() => {
	console.error('[run-dist] server did not become ready within 5 seconds.');
	finish(1);
}, 5000);

child.on('message', (message) => {
	switch (message?.type) {
		case 'ready':
			if (message.target === 'workflow' && message.name === workflow) {
				clearTimeout(readyTimeout);
				console.error(`[flue] Running workflow: ${workflow} (prebuilt dist)`);
				child.send({ type: 'invoke', requestId, payload });
			}
			break;
		case 'started':
			console.error(`[flue] Run ID: ${message.runId}`);
			break;
		case 'event':
			if (message.requestId === requestId) logEvent(message.event);
			break;
		case 'result':
			if (message.requestId !== requestId) break;
			flushText();
			if (message.result !== undefined && message.result !== null) {
				console.log(JSON.stringify(message.result, null, 2));
			}
			console.error('[flue] Done.');
			finish(0);
			break;
		case 'error':
			flushText();
			console.error(`[flue] Workflow error: ${formatLocalError(message)}`);
			finish(1);
			break;
		default:
			break;
	}
});
child.once('exit', (code) => {
	clearTimeout(readyTimeout);
	if (!finished) {
		console.error(`[run-dist] server exited before returning a result${code === null ? '' : ` (code ${code})`}.`);
		finished = true;
		process.exitCode = 1;
	}
});
