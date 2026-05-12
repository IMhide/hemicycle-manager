/**
 * Tests TDD pour le parser de titres de scrutins AN (cf ADR à venir sur Textes
 * législatifs). Extrait une signature `(typeTexte, nomNormalise)` qui permet
 * d'agréger tous les scrutins relatifs à un même texte (amendements, articles,
 * vote solennel, navette, CMP, …).
 *
 * Hypothèses validées par le PoC (cf conversation 2026-05-12) :
 *  - Le champ `dossierLegislatif.dossierRef` côté scrutin ne couvre que ~11%
 *    des scrutins 17ᵉ.
 *  - Le titre du scrutin contient quasi-toujours le type et le libellé du
 *    texte (99,5% des cas).
 *  - Pas de collision : quand `dossierRef` ET signature titre sont connus pour
 *    deux scrutins, ils pointent toujours vers le même texte.
 */

import { test, describe } from 'node:test';
import { strict as assert } from 'node:assert';

import {
	extractTexteSignature,
	normaliseNomTexte,
	type TexteSignature,
	type TypeTexte
} from './texte-parser.ts';

// ────────────────────────────────────────────────────────────────────────────
// normaliseNomTexte : minuscule, sans accents, ponctuation neutralisée
// ────────────────────────────────────────────────────────────────────────────

describe('normaliseNomTexte', () => {
	test('minuscules', () => {
		assert.equal(normaliseNomTexte('TITRE'), 'titre');
	});
	test('accents supprimés', () => {
		assert.equal(normaliseNomTexte('Sécurité'), 'securite');
		assert.equal(normaliseNomTexte('élève'), 'eleve');
	});
	test('apostrophes et ponctuation → espace, puis collapse', () => {
		assert.equal(normaliseNomTexte("d'orientation pour la souveraineté"), 'd orientation pour la souverainete');
	});
	test('espaces multiples collapsés', () => {
		assert.equal(normaliseNomTexte('  a   b  '), 'a b');
	});
	test('apostrophe courbe traitée comme droite', () => {
		assert.equal(normaliseNomTexte('l’organisation'), 'l organisation');
	});
});

// ────────────────────────────────────────────────────────────────────────────
// extractTexteSignature : cas représentatifs (cf échantillon 50 scrutins)
// ────────────────────────────────────────────────────────────────────────────

describe('extractTexteSignature — projet de loi simple', () => {
	test('Amendement à un article PLF', () => {
		const sig = extractTexteSignature(
			"l'amendement n° 1357 de Mme Duby-Muller et l'amendement identique suivant après l'article 9 du projet de loi de finances pour 2026 (première lecture)."
		);
		assert.ok(sig);
		assert.equal(sig.typeTexte, 'projet-loi-finances');
		assert.equal(sig.nomNormalise, 'pour 2026');
	});
	test('Article PLFSS', () => {
		const sig = extractTexteSignature(
			"l'amendement n° 1410 de M. Rousset à l'article 21 du projet de loi de financement de la sécurité sociale pour 2026 (première lecture)."
		);
		assert.ok(sig);
		assert.equal(sig.typeTexte, 'projet-loi-financement-ss');
		assert.equal(sig.nomNormalise, 'pour 2026');
	});
	test('Article projet de loi ordinaire', () => {
		const sig = extractTexteSignature(
			"l'article 37 du projet de loi de finances pour 2026 (première lecture)."
		);
		assert.ok(sig);
		assert.equal(sig.typeTexte, 'projet-loi-finances');
		assert.equal(sig.nomNormalise, 'pour 2026');
	});
	test("Ensemble d'un projet de loi", () => {
		const sig = extractTexteSignature(
			"l'ensemble du projet de loi relatif à l'organisation des jeux Olympiques et Paralympiques de 2030 (première lecture)."
		);
		assert.ok(sig);
		assert.equal(sig.typeTexte, 'projet-loi');
		assert.equal(sig.nomNormalise, "relatif a l organisation des jeux olympiques et paralympiques de 2030");
	});
	test('Projet de loi de fin de gestion', () => {
		const sig = extractTexteSignature(
			"l'amendement n° 21 de Mme Duby-Muller et les amendements identiques suivants après l'article 3 du projet de loi de finances de fin de gestion pour 2024 (première lecture)."
		);
		assert.ok(sig);
		// Le segment "de fin de gestion" doit être inclus dans le typeTexte (sinon on confond avec PLF "pour 2024")
		assert.equal(sig.typeTexte, 'projet-loi-finances-fin-gestion');
		assert.equal(sig.nomNormalise, 'pour 2024');
	});
});

describe('extractTexteSignature — proposition de loi', () => {
	test('Amendement à proposition de loi', () => {
		const sig = extractTexteSignature(
			"l'amendement n° 27 de Mme Manon Meunier à l'article premier de la proposition de loi visant à renforcer la stabilité économique et la compétitivité du pays (première lecture)."
		);
		assert.ok(sig);
		assert.equal(sig.typeTexte, 'proposition-loi');
		assert.equal(sig.nomNormalise, 'visant a renforcer la stabilite economique et la competitivite du pays');
	});
	test('Sous-amendement à proposition de loi', () => {
		const sig = extractTexteSignature(
			"le sous-amendement n° 33 du Gouvernement à l'amendement n° 28 (rect.) de M. Dufau après l'article 2 de la proposition de loi visant à lutter contre la suroccupation des logements (première lecture)."
		);
		assert.ok(sig);
		assert.equal(sig.typeTexte, 'proposition-loi');
		assert.equal(sig.nomNormalise, 'visant a lutter contre la suroccupation des logements');
	});
	test('Article unique', () => {
		const sig = extractTexteSignature(
			"l'amendement n° 35 de M. Midy à l'article unique de la proposition de loi visant à améliorer la protection des commerçants grâce à l'usage d'outils numériques (première lecture)."
		);
		assert.ok(sig);
		assert.equal(sig.typeTexte, 'proposition-loi');
		assert.equal(sig.nomNormalise, "visant a ameliorer la protection des commercants grace a l usage d outils numeriques");
	});
});

describe('extractTexteSignature — agrégation cohérente (même texte = même signature)', () => {
	test("Tous les scrutins de la loi sécurité (amendement, sous-amendement, article, ensemble) → même signature", () => {
		const titres = [
			"la motion de rejet préalable, déposée par M. Boris Vallaud, de la proposition de loi visant à renforcer la sécurité, la rétention administrative et la prévention des risques d'attentat (première lecture).",
			"l'amendement n° 5 de M. Léaument à l'article premier de la proposition de loi visant à renforcer la sécurité, la rétention administrative et la prévention des risques d'attentat (première lecture).",
			"le sous-amendement n° 252 de M. Kerbrat à l'amendement n° 170 de Mme Balage El Mariky à l'article 7 de la proposition de loi visant à renforcer la sécurité, la rétention administrative et la prévention des risques d'attentat (première lecture).",
			"l'ensemble de la proposition de loi visant à renforcer la sécurité, la rétention administrative et la prévention des risques d'attentat (première lecture)."
		];
		const sigs = titres.map(extractTexteSignature);
		for (const s of sigs) {
			assert.ok(s, 'chaque titre doit matcher');
		}
		// Tous doivent avoir la même signature
		const refSig = sigs[0]!;
		for (const s of sigs.slice(1)) {
			assert.equal(s!.typeTexte, refSig.typeTexte);
			assert.equal(s!.nomNormalise, refSig.nomNormalise);
		}
		assert.equal(refSig.typeTexte, 'proposition-loi');
		assert.match(refSig.nomNormalise, /visant a renforcer la securite/);
	});

	test('PLF 2026 : amendement, après-article, article, ensemble → même signature', () => {
		const titres = [
			"l'amendement n° 815 de M. Allisio après l'article 29 du projet de loi de finances pour 2026 (première lecture).",
			"l'amendement n° 1832 de M. Buisson après l'article 3 du projet de loi de finances pour 2026 (première lecture).",
			"l'article 37 du projet de loi de finances pour 2026 (première lecture)."
		];
		const sigs = titres.map(extractTexteSignature);
		for (const s of sigs) assert.ok(s);
		const refSig = sigs[0]!;
		for (const s of sigs.slice(1)) {
			assert.equal(s!.typeTexte, refSig.typeTexte);
			assert.equal(s!.nomNormalise, refSig.nomNormalise);
		}
		assert.equal(refSig.typeTexte, 'projet-loi-finances');
		assert.equal(refSig.nomNormalise, 'pour 2026');
	});
});

describe('extractTexteSignature — variations de lecture', () => {
	test('Deuxième lecture → même signature que première lecture', () => {
		const sig1 = extractTexteSignature(
			"l'amendement n° 1265 de M. Bentz à l'article 4 de la proposition de loi relative au droit à l'aide à mourir (première lecture)."
		);
		const sig2 = extractTexteSignature(
			"l'amendement n° 2029 de M. Bentz à l'article 2 de la proposition de loi relative au droit à l'aide à mourir (deuxième lecture)."
		);
		assert.ok(sig1);
		assert.ok(sig2);
		assert.equal(sig1.typeTexte, sig2.typeTexte);
		assert.equal(sig1.nomNormalise, sig2.nomNormalise);
	});
	test('Nouvelle lecture → même signature', () => {
		const sig1 = extractTexteSignature(
			"l'article liminaire du projet de loi de financement de la sécurité sociale pour 2026 (première lecture)."
		);
		const sig2 = extractTexteSignature(
			"l'article liminaire du projet de loi de financement de la sécurité sociale pour 2026 (nouvelle lecture)."
		);
		assert.ok(sig1);
		assert.ok(sig2);
		assert.equal(sig1.typeTexte, sig2.typeTexte);
		assert.equal(sig1.nomNormalise, sig2.nomNormalise);
	});
});

describe('extractTexteSignature — non-matches (textes non législatifs)', () => {
	test('Motion de censure → null', () => {
		const sig = extractTexteSignature(
			"la motion de censure déposée en application de l'article 49, alinéa 2, de la Constitution par Mme Mathilde Panot et 57 députés."
		);
		assert.equal(sig, null);
	});
	test('Suspension de séance → null', () => {
		const sig = extractTexteSignature(
			"la demande de suspension de séance présentée par M. Pribetich (article 58 du Règlement de l'Assemblée nationale)."
		);
		assert.equal(sig, null);
	});
});

describe('extractTexteSignature — examen prioritaire', () => {
	test("Le suffixe 'examen prioritaire' ne doit pas faire diverger les signatures", () => {
		const sig1 = extractTexteSignature(
			"l'amendement n° 341 de M. Boyard à l'article 17 bis (examen prioritaire) du projet de loi relatif à la lutte contre les fraudes sociales et fiscales (première lecture)."
		);
		const sig2 = extractTexteSignature(
			"l'article 4 quater du projet de loi relatif à la lutte contre les fraudes sociales et fiscales (première lecture)."
		);
		assert.ok(sig1);
		assert.ok(sig2);
		assert.equal(sig1.typeTexte, sig2.typeTexte);
		assert.equal(sig1.nomNormalise, sig2.nomNormalise);
	});
});

describe('extractTexteSignature — projet de loi organique / constitutionnelle', () => {
	test('Projet de loi organique', () => {
		const sig = extractTexteSignature(
			"l'article 1er du projet de loi organique relatif au département-région de Mayotte (première lecture)."
		);
		assert.ok(sig);
		assert.equal(sig.typeTexte, 'projet-loi-organique');
		assert.equal(sig.nomNormalise, 'relatif au departement region de mayotte');
	});
});

describe('extractTexteSignature — résolutions', () => {
	test('Proposition de résolution européenne', () => {
		const sig = extractTexteSignature(
			"l'ensemble de la proposition de résolution européenne sur la politique commerciale de l'Union européenne."
		);
		assert.ok(sig);
		assert.equal(sig.typeTexte, 'proposition-resolution-europeenne');
	});
});

// ────────────────────────────────────────────────────────────────────────────
// Bruits "navette" Sénat verbeux (cf scr.scrint dosleg, bug duplication N3.b).
// Les titres de scrutins Sénat insèrent souvent des locutions entre le type
// de texte et le "visant à X" / "relatif à Y". Sans extension du
// NAVETTE_PREFIX_PATTERN, ces variantes créent des signatures dupliquées qui
// se retrouvent en 2 TexteSenat distincts (ex: même PPL en 1re lecture vs
// nouvelle lecture). Toutes ces formulations doivent converger.
// ────────────────────────────────────────────────────────────────────────────

describe('extractTexteSignature — bruits navette Sénat verbeux (convergence)', () => {
	test('PPL "après engagement de la procédure accélérée" converge avec PPL nue', () => {
		const sigVerbeux = extractTexteSignature(
			"sur l'ensemble de la proposition de loi, adoptée par l'Assemblée nationale après engagement de la procédure accélérée, visant à démocratiser le sport en France"
		);
		const sigNue = extractTexteSignature(
			"sur l'ensemble de la proposition de loi visant à démocratiser le sport en France"
		);
		assert.ok(sigVerbeux);
		assert.ok(sigNue);
		assert.equal(sigVerbeux.nomNormalise, sigNue.nomNormalise);
		assert.equal(sigVerbeux.nomNormalise, 'visant a democratiser le sport en france');
	});

	test('PPL "en nouvelle lecture" converge avec PPL nue', () => {
		const sigNL = extractTexteSignature(
			"sur l'ensemble de la proposition de loi, adoptée par l'Assemblée nationale en nouvelle lecture, visant à démocratiser le sport en France"
		);
		const sigNue = extractTexteSignature(
			"sur l'ensemble de la proposition de loi visant à démocratiser le sport en France"
		);
		assert.ok(sigNL && sigNue);
		assert.equal(sigNL.nomNormalise, sigNue.nomNormalise);
	});

	test('PPL "modifiée par le Sénat" converge', () => {
		const sig = extractTexteSignature(
			"sur l'amendement à la proposition de loi, modifiée par le Sénat, relative à la cyber-sécurité"
		);
		const sigNue = extractTexteSignature(
			"sur l'amendement à la proposition de loi relative à la cyber-sécurité"
		);
		assert.ok(sig && sigNue);
		assert.equal(sig.nomNormalise, sigNue.nomNormalise);
	});

	test('PJL "adopté avec modifications par le Sénat" converge', () => {
		const sig = extractTexteSignature(
			"sur l'ensemble du projet de loi, adopté avec modifications par le Sénat, relatif à la transition écologique"
		);
		const sigNue = extractTexteSignature(
			"sur l'ensemble du projet de loi relatif à la transition écologique"
		);
		assert.ok(sig && sigNue);
		assert.equal(sig.nomNormalise, sigNue.nomNormalise);
	});

	test('PJL "adopté définitivement par l\'Assemblée nationale" converge', () => {
		const sig = extractTexteSignature(
			"sur l'ensemble du projet de loi, adopté définitivement par l'Assemblée nationale, relatif aux JO 2024"
		);
		const sigNue = extractTexteSignature("sur l'ensemble du projet de loi relatif aux JO 2024");
		assert.ok(sig && sigNue);
		assert.equal(sig.nomNormalise, sigNue.nomNormalise);
	});

	test('La forme "nue" sans bruit navette reste inchangée', () => {
		const sig = extractTexteSignature(
			"l'ensemble de la proposition de loi visant à démocratiser le sport en France."
		);
		assert.ok(sig);
		assert.equal(sig.nomNormalise, 'visant a democratiser le sport en france');
	});
});
