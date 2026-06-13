#!/usr/bin/env node
// gen-skill-plugin-manifests — make each Unity package that ships skills a
// self-contained Claude Code plugin, mirroring App UI's convention:
//
//   <pkg>/Plugins~/.claude-plugin/plugin.json
//   <pkg>/Plugins~/.claude-plugin/marketplace.json
//   <pkg>/Plugins~/skills.json
//
// Every field is DERIVED (package.json + each SKILL.md frontmatter) so the
// manifests can never drift from the shipped skills. Idempotent; safe to re-run.
//
// Usage: node scripts/gen-skill-plugin-manifests.mjs <PackagesDir>

import fs from 'node:fs';
import path from 'node:path';

const packagesDir = process.argv[2];
if (!packagesDir || !fs.existsSync(packagesDir)) {
	console.error(`[gen-manifests] packages dir not found: ${packagesDir}`);
	process.exit(2);
}

function frontmatter(file) {
	const text = fs.readFileSync(file, 'utf8');
	const m = text.match(/^---\n([\s\S]*?)\n---/);
	if (!m) return {};
	const out = {};
	for (const line of m[1].split('\n')) {
		const i = line.indexOf(':');
		if (i <= 0) continue;
		const key = line.slice(0, i).trim();
		let val = line.slice(i + 1).trim();
		if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'")))
			val = val.slice(1, -1);
		out[key] = val;
	}
	return out;
}

const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
const titleize = (id) =>
	id.replace(/^unity-/, '').replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

let count = 0;
for (const pkg of fs.readdirSync(packagesDir).sort()) {
	const skillsDir = path.join(packagesDir, pkg, 'Plugins~', 'skills');
	if (!fs.existsSync(skillsDir) || !fs.statSync(skillsDir).isDirectory()) continue;

	const ids = fs
		.readdirSync(skillsDir)
		.filter((d) => fs.existsSync(path.join(skillsDir, d, 'SKILL.md')))
		.sort();
	if (!ids.length) continue;

	let meta = {};
	try {
		meta = JSON.parse(fs.readFileSync(path.join(packagesDir, pkg, 'package.json'), 'utf8'));
	} catch {}

	const name = slug(pkg);
	const owner = meta?.author?.name || 'Vex Interactive';
	const description = `Vex Unity agent skills shipped with ${meta.displayName || pkg}.`;

	const skills = ids.map((id) => {
		const fm = frontmatter(path.join(skillsDir, id, 'SKILL.md'));
		return { id: fm.name || id, displayName: titleize(fm.name || id), description: fm.description || '' };
	});

	const pluginsDir = path.join(packagesDir, pkg, 'Plugins~');
	const claudePluginDir = path.join(pluginsDir, '.claude-plugin');
	fs.mkdirSync(claudePluginDir, { recursive: true });

	write(path.join(claudePluginDir, 'plugin.json'), {
		name,
		description,
		version: meta.version || '1.0.0',
		author: { name: owner },
	});
	write(path.join(claudePluginDir, 'marketplace.json'), {
		name,
		owner: { name: owner },
		plugins: [{ name, source: './', description }],
	});
	write(path.join(pluginsDir, 'skills.json'), skills);

	console.log(`[gen-manifests] ${pkg}: ${skills.length} skill(s) -> ${name}`);
	count++;
}
console.log(`[gen-manifests] wrote manifests for ${count} package(s)`);

function write(file, obj) {
	fs.writeFileSync(file, JSON.stringify(obj, null, 2) + '\n');
}
