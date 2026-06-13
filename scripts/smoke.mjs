#!/usr/bin/env node
// smoke.mjs — assess the ACTUAL flue LLM, with zero Unity involvement.
//
// Runs the `chat` workflow against the real model (via the prebuilt dist, the
// same plain-JS path the Editor uses) and asserts the model returns the
// requested token. This is the brain checked in isolation: no connector, no
// Assistant window, no VexFlueChatWorkflow.
//
// Usage: node scripts/smoke.mjs ["custom prompt that must echo 'pong'"]
// Exit 0 = PASS, 1 = FAIL.

import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const runner = path.join(root, 'scripts', 'run-dist.mjs');
const dist = path.join(root, 'dist', 'server.mjs');

const prompt = process.argv[2] || 'Reply with exactly one word and nothing else: pong';
const expect = 'pong';
const timeoutMs = 150_000;

if (!fs.existsSync(dist)) {
	console.error('FAIL: dist/server.mjs missing — run `npx flue build --target node` first.');
	process.exit(1);
}

const payload = JSON.stringify({ request: prompt });
const child = spawn('node', [runner, 'chat', payload], { cwd: root });

let out = '';
child.stdout.on('data', (d) => { out += d; });
child.stderr.on('data', (d) => process.stderr.write(d)); // mirror flue progress live

const timer = setTimeout(() => {
	console.error('\nFAIL: timed out after 150s.');
	child.kill('SIGTERM');
	process.exit(1);
}, timeoutMs);

child.on('exit', (code) => {
	clearTimeout(timer);

	const card = lastJsonObject(out);
	if (!card) {
		console.error(`\nFAIL: no JSON card on stdout (flue exit ${code}).`);
		process.exit(1);
	}

	const answer = String(card.explanation ?? '');
	const ok = card.ok === true;
	const hit = answer.toLowerCase().includes(expect);

	console.log('\n--- flue chat card ---');
	console.log('ok:     ', ok);
	console.log('model:  ', card.model ?? '(none)');
	console.log('answer: ', answer.slice(0, 200));

	if (answer && hit) {
		console.log(`\nPASS: the model responded and produced "${expect}".`);
		process.exit(0);
	}
	console.error(`\nFAIL: expected "${expect}" in the answer.`);
	process.exit(1);
});

// Mirror of MemoryCard.FromStdout: prefer a whole-stdout parse, else the last JSON object.
function lastJsonObject(text) {
	const trimmed = text.trim();
	try { const o = JSON.parse(trimmed); if (o && typeof o === 'object') return o; } catch {}

	const starts = [];
	const re = /^\s*\{/gm;
	let m;
	while ((m = re.exec(text))) starts.push(m.index);
	for (let i = starts.length - 1; i >= 0; i--) {
		const sub = text.slice(text.indexOf('{', starts[i]));
		try { const o = JSON.parse(sub); if (o && typeof o === 'object') return o; } catch {}
	}
	return null;
}
