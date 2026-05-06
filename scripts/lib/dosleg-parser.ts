/**
 * Parser pour les sources Sénat (cf ADR 0025).
 *
 * Couvre 4 préoccupations de bas niveau, toutes pures (pas d'I/O sauf streaming
 * fichier) et toutes testées :
 *
 *  - decodePostgresLiteral : conversion d'un littéral COPY PG (`\N`, `\t`, …)
 *  - splitCsvLine : mini-parser CSV respectant les guillemets et les `""`
 *    échappés (RFC 4180 minimal)
 *  - parseOdsenCsv : parser ODSEN_*.csv complet (ISO-8859-1, préambule `%`)
 *  - streamCopyBlocks : extracteur en flux des blocs `COPY <table> ... FROM stdin`
 *    d'un dump PostgreSQL pg_dump
 *
 * Aucune dépendance externe (pas de csv-parse). Les caractères français passent
 * par TextDecoder('iso-8859-1') natif Node 22.
 */

import { createReadStream } from 'node:fs';

// ────────────────────────────────────────────────────────────────────────────
// decodePostgresLiteral
// ────────────────────────────────────────────────────────────────────────────

/**
 * Décode un littéral du format `COPY ... FROM stdin` de PostgreSQL.
 *
 * Conventions PG :
 *  - `\N` = NULL
 *  - `\t` `\n` `\r` `\b` `\f` `\v` = caractères de contrôle
 *  - `\\` = backslash unique
 *  - `\X` (X non documenté) = X seul (le backslash est consommé)
 *
 * Renvoie `null` pour `\N`, sinon une string décodée.
 */
export function decodePostgresLiteral(raw: string): string | null {
	if (raw === '\\N') return null;
	// Reconstruction caractère par caractère (regex global trop lent sur 1.6M lignes).
	let out = '';
	let i = 0;
	while (i < raw.length) {
		const c = raw[i];
		if (c === '\\' && i + 1 < raw.length) {
			const nxt = raw[i + 1];
			switch (nxt) {
				case 't':
					out += '\t';
					break;
				case 'n':
					out += '\n';
					break;
				case 'r':
					out += '\r';
					break;
				case 'b':
					out += '\b';
					break;
				case 'f':
					out += '\f';
					break;
				case 'v':
					out += '\v';
					break;
				case '\\':
					out += '\\';
					break;
				default:
					// Convention PG : `\X` où X n'est pas une séquence connue → X seul
					out += nxt;
			}
			i += 2;
		} else {
			out += c;
			i++;
		}
	}
	return out;
}

// ────────────────────────────────────────────────────────────────────────────
// splitCsvLine
// ────────────────────────────────────────────────────────────────────────────

/**
 * Découpe une ligne CSV en respectant les guillemets et les `""` échappés
 * (RFC 4180 minimal). Pas de support des newlines à l'intérieur des valeurs
 * (les CSV ODSEN n'en contiennent pas).
 */
export function splitCsvLine(line: string): string[] {
	const out: string[] = [];
	let cur = '';
	let inQ = false;
	for (let i = 0; i < line.length; i++) {
		const c = line[i];
		if (inQ) {
			if (c === '"') {
				if (line[i + 1] === '"') {
					cur += '"';
					i++;
				} else {
					inQ = false;
				}
			} else {
				cur += c;
			}
		} else {
			if (c === ',') {
				out.push(cur);
				cur = '';
			} else if (c === '"') {
				inQ = true;
			} else {
				cur += c;
			}
		}
	}
	out.push(cur);
	return out;
}

// ────────────────────────────────────────────────────────────────────────────
// parseOdsenCsv
// ────────────────────────────────────────────────────────────────────────────

/**
 * Parse un fichier ODSEN_*.csv :
 *  - Décode ISO-8859-1 (préserve les accents français)
 *  - Skip le préambule `% Requête : …` et les lignes vides
 *  - Utilise la première ligne non-`%`/non-vide comme header CSV
 *  - Renvoie un tableau de records {col → value}
 */
export function parseOdsenCsv(buffer: Buffer): Array<Record<string, string>> {
	const text = new TextDecoder('iso-8859-1', { fatal: false }).decode(buffer);
	const lines = text.split(/\r?\n/).filter((l) => !l.startsWith('%') && l.trim().length > 0);
	if (lines.length === 0) return [];
	const header = splitCsvLine(lines[0]);
	const out: Array<Record<string, string>> = [];
	for (let i = 1; i < lines.length; i++) {
		const values = splitCsvLine(lines[i]);
		const row: Record<string, string> = {};
		for (let j = 0; j < header.length; j++) {
			row[header[j]] = values[j] ?? '';
		}
		out.push(row);
	}
	return out;
}

// ────────────────────────────────────────────────────────────────────────────
// streamCopyBlocks
// ────────────────────────────────────────────────────────────────────────────

/**
 * Streame un dump pg_dump et appelle `onRow` pour chaque ligne des tables
 * dans `interestingTables`. Les autres tables sont skipées sans surcoût.
 *
 * Avantages d'un parsing en flux (vs read+split) :
 *  - RAM stable (~80 MB pour un dump 124 MB) au lieu de ~200 MB pic
 *  - Pas de blocage event loop sur le split (la 1.6M lignes votsen)
 *
 * Les lignes TSV sont split par `\t` puis chaque champ passe dans
 * `decodePostgresLiteral` (donc `\N` → null).
 */
export async function streamCopyBlocks(
	sqlPath: string,
	interestingTables: Set<string>,
	onRow: (table: string, columns: string[], values: (string | null)[]) => void
): Promise<void> {
	const stream = createReadStream(sqlPath, { encoding: 'utf8' });
	let mode: 'scan' | 'copy' = 'scan';
	let buffer = '';
	let currentTable: string | null = null;
	let currentColumns: string[] = [];
	let interesting = false;

	for await (const chunk of stream) {
		buffer += chunk;
		let nl: number;
		while ((nl = buffer.indexOf('\n')) !== -1) {
			const line = buffer.slice(0, nl);
			buffer = buffer.slice(nl + 1);
			if (mode === 'scan') {
				const m = line.match(/^COPY\s+(?:\w+\.)?(\w+)\s*\(([^)]+)\)\s+FROM\s+stdin/i);
				if (m) {
					currentTable = m[1];
					currentColumns = m[2].split(',').map((s) => s.trim());
					interesting = interestingTables.has(currentTable);
					mode = 'copy';
				}
			} else {
				if (line === '\\.') {
					mode = 'scan';
					currentTable = null;
					interesting = false;
					currentColumns = [];
				} else if (interesting && currentTable) {
					const values = line.split('\t').map(decodePostgresLiteral);
					onRow(currentTable, currentColumns, values);
				}
			}
		}
	}

	// Ligne résiduelle sans newline finale ? On la traite si on est en mode copy.
	if (buffer.length > 0) {
		if (mode === 'copy' && buffer !== '\\.' && interesting && currentTable) {
			const values = buffer.split('\t').map(decodePostgresLiteral);
			onRow(currentTable, currentColumns, values);
		}
	}
}
