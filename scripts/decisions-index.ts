/**
 * Auto-generate decisions/README.md from the ADR files.
 *
 * Each ADR file is parsed for its title (line 1: "# 0001 — Title"), date,
 * status, and tags. We render a sortable table and a tag cloud.
 *
 * Run: `npm run decisions:index`
 */

import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DIR = join(ROOT, 'decisions');
const OUT = join(DIR, 'README.md');

interface Adr {
	file: string;
	id: string;
	title: string;
	date: string;
	status: string;
	tags: string[];
	summary: string; // first non-meta paragraph
}

function extractField(content: string, label: string): string {
	const re = new RegExp(`\\*\\*${label}\\*\\*\\s*:\\s*(.+)`, 'i');
	const m = content.match(re);
	return m ? m[1].trim() : '';
}

function extractSummary(content: string): string {
	// Find the first content paragraph after the "## Décision" heading.
	const m = content.match(/##\s*Décision\s*\n+([^\n]+)/);
	if (m) return m[1].trim().replace(/\*\*/g, '');
	// Fallback: first sentence after the metadata block
	const lines = content.split('\n');
	for (const line of lines) {
		const t = line.trim();
		if (!t || t.startsWith('#') || t.startsWith('*') || t.startsWith('-')) continue;
		return t.replace(/\*\*/g, '').slice(0, 200);
	}
	return '';
}

function parseAdr(file: string, content: string): Adr | null {
	// First non-empty line should be `# 0001 — Title`
	const title = content.match(/^#\s*(\d+)\s*[—-]\s*(.+)$/m);
	if (!title) return null;
	const id = title[1];
	const titleText = title[2].trim();

	const date = extractField(content, 'Date');
	const status = extractField(content, 'Statut');
	const tagsRaw = extractField(content, 'Tags');
	const tags = tagsRaw
		.split(',')
		.map((t) => t.trim())
		.filter(Boolean);

	return {
		file,
		id,
		title: titleText,
		date,
		status,
		tags,
		summary: extractSummary(content)
	};
}

function statusBadge(status: string): string {
	const s = status.toLowerCase();
	if (s.includes('accepté') || s.includes('accepted')) return '✅';
	if (s.includes('refusé') || s.includes('rejected')) return '❌';
	if (s.includes('proposé') || s.includes('proposed')) return '🟡';
	if (s.includes('déprécié') || s.includes('deprecated')) return '⚠️';
	if (s.includes('superseded') || s.includes('remplacé')) return '🔄';
	return '·';
}

async function main() {
	const files = (await readdir(DIR))
		.filter((f) => /^\d{4}-.+\.md$/.test(f))
		.sort();

	const adrs: Adr[] = [];
	for (const file of files) {
		const content = await readFile(join(DIR, file), 'utf8');
		const adr = parseAdr(file, content);
		if (adr) adrs.push(adr);
	}

	// Build the index
	const lines: string[] = [];
	lines.push('# Décisions du projet — Architecture Decision Records (ADR)');
	lines.push('');
	lines.push(
		'> Ce fichier est **auto-généré** par `npm run decisions:index`. Ne pas l\'éditer à la main.'
	);
	lines.push('');
	lines.push(
		`Cette mémoire intra-repo recense les décisions structurantes du projet. Chaque décision est un fichier dédié au format [ADR](https://adr.github.io). Pour ajouter une décision : créer \`${'decisions'}/NNNN-slug.md\` avec la trame de \`TEMPLATE.md\`, puis lancer \`npm run decisions:index\`.`
	);
	lines.push('');
	lines.push(`**${adrs.length} décisions** consignées.`);
	lines.push('');

	// Quick stats
	const byTag = new Map<string, number>();
	for (const a of adrs) {
		for (const t of a.tags) byTag.set(t, (byTag.get(t) ?? 0) + 1);
	}
	if (byTag.size > 0) {
		const tagsLine = [...byTag.entries()]
			.sort((a, b) => b[1] - a[1])
			.map(([t, n]) => `\`${t}\`(${n})`)
			.join(' · ');
		lines.push(`**Tags** : ${tagsLine}`);
		lines.push('');
	}

	// Index table
	lines.push('## Index chronologique');
	lines.push('');
	lines.push('| # | Décision | Statut | Tags | Date |');
	lines.push('|---|---|---|---|---|');
	for (const a of adrs) {
		const tagsStr = a.tags.map((t) => `\`${t}\``).join(' ');
		lines.push(
			`| ${a.id} | [${a.title}](${a.file}) | ${statusBadge(a.status)} ${a.status} | ${tagsStr} | ${a.date} |`
		);
	}
	lines.push('');

	// Detail blocks
	lines.push('## Résumés');
	lines.push('');
	for (const a of adrs) {
		lines.push(`### ${a.id} — ${a.title}`);
		lines.push('');
		if (a.summary) lines.push(`> ${a.summary}`);
		lines.push('');
		lines.push(`📄 [Lire la décision complète](${a.file})`);
		lines.push('');
	}

	const output = lines.join('\n');
	await writeFile(OUT, output);
	console.log(`✅ ${adrs.length} ADR indexées → ${OUT}`);
}

main().catch((err) => {
	console.error('❌', err);
	process.exit(1);
});
