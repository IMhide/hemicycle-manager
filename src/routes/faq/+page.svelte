<script lang="ts">
	/**
	 * FAQ centralisée. Couvre les décisions structurantes (ADR) en français
	 * humain et humble — pas de prétention de neutralité scientifique.
	 *
	 * Lien depuis l'app : header + footer + ancres dans les InfoTip
	 * (`/faq#overall`, `/faq#presence`, etc.).
	 */

	type QA = {
		id: string;
		question: string;
		answer: string; // markdown-light (HTML simple autorisé)
	};

	type Section = {
		id: string;
		title: string;
		emoji: string;
		intro?: string;
		items: QA[];
	};

	const ADR = (n: number, slug: string) =>
		`<a class="underline hover:text-assembly-accent" target="_blank" rel="noopener" href="https://github.com/IMhide/hemicycle-manager/blob/main/decisions/${String(n).padStart(4, '0')}-${slug}.md">ADR ${String(n).padStart(4, '0')}</a>`;

	const sections: Section[] = [
		{
			id: 'principes',
			title: 'Le projet en 3 phrases',
			emoji: '🎯',
			items: [
				{
					id: 'cest-quoi',
					question: 'C\'est quoi PolitiDex au juste ?',
					answer: `<p>Un Pokédex ludique des élus nationaux français, avec une UX qui pique au <i>Football Manager</i> : chaque député a une carte FIFA-style, un overall, des badges, un radar. On agrège les données ouvertes (Etalab) pour donner à voir les votes, les parcours, les groupes.</p>
<p class="mt-2">L'objectif n'est pas d'être un outil scientifique de sociologie politique. C'est de rendre la politique <b>regardable</b> et <b>jouable</b>, comme on regarde un championnat de foot.</p>`
				},
				{
					id: 'objectivite',
					question: 'Vous prétendez à l\'objectivité ?',
					answer: `<p>Honnêtement non. On part de chiffres officiels (votes en hémicycle, appartenances de groupes), mais dès qu'on les <b>combine</b> en scores, en classements ou en blocs, on fait des <b>choix éditoriaux</b>. Un overall, c'est juste un chiffre partant d'un postulat. On a essayé de choisir des postulats défendables et de les expliquer ouvertement.</p>
<p class="mt-2">Tous nos choix sont écrits noir sur blanc dans des <a class="underline hover:text-assembly-accent" target="_blank" rel="noopener" href="https://github.com/IMhide/hemicycle-manager/tree/main/decisions">décisions d'architecture (ADR)</a>. Tu peux les contester sur GitHub : on en discute.</p>`
				},
				{
					id: 'sources',
					question: 'D\'où viennent les données ?',
					answer: `<p>De l'<a class="underline hover:text-assembly-accent" target="_blank" rel="noopener" href="https://data.assemblee-nationale.fr">Open Data de l'Assemblée nationale</a> (datasets <code>AMO10</code>, <code>AMO20</code>, <code>AMO30</code> et les archives de scrutins), publiés sous Licence Ouverte Etalab. On les télécharge à chaque build, on ne stocke rien d'autre.</p>
<p class="mt-2">Les détails techniques sur <i>quel dataset on prend en priorité quand</i> sont dans ${ADR(18, 'identite-paid')}, ${ADR(19, 'priorite-sources-amo')} et ${ADR(3, 'data-sources')}.</p>`
				}
			]
		},
		{
			id: 'overall',
			title: 'Le score Overall (la note FIFA)',
			emoji: '🎮',
			intro: 'C\'est le gros chiffre orange en haut à gauche de chaque carte de député. Voilà comment il marche.',
			items: [
				{
					id: 'overall-formule',
					question: 'C\'est quoi la formule de l\'Overall ?',
					answer: `<p>Une moyenne pondérée de 3 ingrédients, le tout multiplié par 99 et arrondi (oui, 99 comme dans FIFA — c'est volontaire) :</p>
<ul class="list-disc pl-6 mt-2 space-y-1">
	<li><b>55 %</b> &nbsp;<b>Participation</b> : la part des scrutins où le député a voté <b>Pour</b> ou <b>Contre</b>.</li>
	<li><b>35 %</b> &nbsp;<b>Volume</b> : combien de votes il a posés au total, normalisé sur le centile 95 de la cohorte (les 5 % du haut saturent à 100 %).</li>
	<li><b>10 %</b> &nbsp;<b>Présence</b> : il était là, même s'il s'est abstenu (le vote blanc compte un peu).</li>
</ul>
<p class="mt-3">Décision figée dans ${ADR(22, 'score-overall')}.</p>`
				},
				{
					id: 'overall-pourquoi',
					question: 'Pourquoi cette pondération et pas une autre ?',
					answer: `<p>Postulat éditorial : <b>un député est un fonctionnaire de l'État, un employé du peuple, payé pour voter des lois</b>. Donc on récompense surtout l'acte de voter pour ou contre (Participation, 55 %), un peu l'expérience accumulée (Volume, 35 %), et marginalement le simple fait d'être présent (Présence, 10 %).</p>
<p class="mt-2">Est-ce que c'est <i>la</i> bonne pondération ? On ne sait pas. C'est une opinion défendable, écrite noir sur blanc, et qu'on assume. Si tu penses qu'il en faudrait une autre, ouvre une issue sur GitHub.</p>`
				},
				{
					id: 'overall-loyaute',
					question: 'Pourquoi la Loyauté n\'entre pas dans l\'Overall ?',
					answer: `<p>Parce que la loyauté à un groupe est un <b>signal politique</b>, pas un signal d'exemplarité. Un député très loyal est un bon soldat d'appareil ; un député peu loyal est un dissident réfléchi. Aucune de ces deux figures n'est <i>plus</i> exemplaire que l'autre. Mettre la loyauté dans l'Overall reviendrait à pousser l'aiguille en faveur des appareils — on ne veut pas faire ça.</p>
<p class="mt-2">La loyauté reste affichée sur le radar et alimente les badges (<b>Top loyaliste</b>, <b>Frondeur</b>, <b>Transfuge</b>). Cf ${ADR(22, 'score-overall')} et ${ADR(16, 'groupes-multi-appartenance')}.</p>`
				},
				{
					id: 'overall-volume',
					question: 'C\'est quoi le "Volume normalisé centile 95" ?',
					answer: `<p>On veut que les députés qui votent beaucoup soient avantagés (ils font leur boulot), mais sans qu'un seul ultra-actif n'écrase tout le monde. Donc on prend la <b>95ᵉ percentile</b> de la cohorte — autrement dit, le seuil au-dessus duquel se trouvent les 5 % les plus prolifiques. Quiconque dépasse ce seuil sature à 100 %, les autres se positionnent au prorata.</p>
<p class="mt-2">Avantage : ça s'adapte tout seul à la taille de la législature, à sa durée, et c'est moins arbitraire qu'un seuil "magique" type 3000. Inconvénient : c'est un choix qu'on a fait (on aurait pu prendre le 90ᵉ ou le 99ᵉ). Pas de calcul mathématiquement parfait, juste un postulat raisonnable.</p>`
				},
				{
					id: 'overall-anciennete',
					question: 'Et l\'ancienneté, ça compte ?',
					answer: `<p>Pas explicitement. On a hésité, mais finalement non : un fonctionnaire est jugé sur son boulot du moment, pas sur son CV. Cela dit, <b>en vue Carrière</b> (cumul de tous les mandats), le Volume cumulé sur plusieurs législatures fait mécaniquement décoller les vétérans. Donc l'expérience compte de fait, sans qu'on lui mette un coefficient explicite.</p>`
				}
			]
		},
		{
			id: 'classements',
			title: 'Le Championnat & Les Coupes',
			emoji: '🏆',
			intro: 'Les classements de PolitiDex marchent comme une saison de football : un grand championnat (l\'Overall) et plusieurs coupes thématiques.',
			items: [
				{
					id: 'championnat',
					question: 'C\'est quoi <b>Le Championnat</b> ?',
					answer: `<p>Le classement principal, fondé sur l'Overall. Trois sous-vues :</p>
<ul class="list-disc pl-6 mt-2 space-y-1">
	<li><b>Top députés</b> — les meilleurs scores, par législature ou en Carrière.</li>
	<li><b>Top groupes</b> — la moyenne d'Overall des membres de chaque groupe.</li>
	<li><b>Top blocs</b> — la moyenne par bloc politique (5 blocs : extrême-gauche / gauche / centre / droite / extrême-droite).</li>
</ul>`
				},
				{
					id: 'coupes',
					question: 'Et <b>Les Coupes</b> ?',
					answer: `<p>Les classements thématiques mono-stat : Présence, Participation, Loyauté, Frondes. Ce sont des "compétitions du meilleur buteur", des classements pointus sur une seule dimension. Ils restent <b>par législature</b> uniquement, parce que comparer la "présence carrière" d'un primo et d'un vétéran ne veut pas dire grand-chose (cf ${ADR(17, 'stats-mandat-vs-carriere')}).</p>`
				},
				{
					id: 'blocs',
					question: 'Comment vous découpez les 5 blocs politiques ?',
					answer: `<p>On utilise les scores du <a class="underline hover:text-assembly-accent" target="_blank" rel="noopener" href="https://www.chesdata.eu/2024-chapel-hill-expert-survey-ches">Chapel Hill Expert Survey 2024</a>, un dataset académique qui note les partis européens sur l'axe gauche-droite (de 0 à 10) :</p>
<ul class="list-disc pl-6 mt-2 space-y-1 text-xs">
	<li>🚩 <b>Extrême gauche</b> : [0&nbsp;–&nbsp;2.5[</li>
	<li>🌹 <b>Gauche</b> : [2.5&nbsp;–&nbsp;4.5[</li>
	<li>🟡 <b>Centre</b> : [4.5&nbsp;–&nbsp;6.5[</li>
	<li>🔵 <b>Droite</b> : [6.5&nbsp;–&nbsp;8[</li>
	<li>⚓ <b>Extrême droite</b> : [8&nbsp;–&nbsp;10]</li>
</ul>
<p class="mt-3">Les bornes sont arbitraires (on aurait pu prendre 2.0 / 4.0 / 6.0 / 8.0). Les groupes sans score CHES (NI, LIOT…) sont rangés à part dans "Non-inscrits". Cf ${ADR(7, 'political-order')}.</p>`
				},
				{
					id: 'transfuges',
					question: 'Un député qui change de groupe, il compte où ?',
					answer: `<p>Dans son <b>groupe principal</b> = la première appartenance stable de son mandat (en ignorant les passages éphémères chez les NI en début de législature). Pour qu'un transfuge ne booste/plombe pas plusieurs groupes en même temps. Cf ${ADR(16, 'groupes-multi-appartenance')}.</p>`
				}
			]
		},
		{
			id: 'metriques',
			title: 'Les autres métriques',
			emoji: '📊',
			items: [
				{
					id: 'presence',
					question: 'C\'est quoi le <b>taux de présence</b> ?',
					answer: `<p>La part des scrutins où le député a fait acte de vote (<b>Pour</b>, <b>Contre</b> <i>ou</i> <b>Abstention</b>) sur le total des scrutins éligibles de son mandat. Voter "abstention" compte comme être présent.</p>
<p class="mt-2">Cf ${ADR(4, 'metrique-presence')}.</p>`
				},
				{
					id: 'participation',
					question: 'Et la <b>participation</b>, c\'est différent ?',
					answer: `<p>Oui : la participation, c'est uniquement les votes <b>Pour</b> et <b>Contre</b> (l'abstention ne compte pas). Donc <b>Présence ≥ Participation</b> toujours, et la différence entre les deux représente la part d'abstentions.</p>
<p class="mt-2">Cf ${ADR(6, 'metrique-participation')}.</p>`
				},
				{
					id: 'loyaute',
					question: 'La <b>loyauté</b>, ça mesure quoi ?',
					answer: `<p>La part des votes du député qui sont alignés avec la <b>position majoritaire de son groupe au moment du vote</b>. Elle peut être <code>N/A</code> si le groupe n'avait pas de majorité claire (50/50). Pas un jugement moral — juste un constat de cohésion.</p>
<p class="mt-2">Cf ${ADR(16, 'groupes-multi-appartenance')}.</p>`
				},
				{
					id: 'frondes',
					question: 'Et les <b>frondes</b> ?',
					answer: `<p>Le nombre de fois où le député a voté <i>contre</i> la position majoritaire de son groupe. Aucun jugement de valeur : un frondeur peut être un dissident courageux ou un caprice individuel — c'est selon le contexte.</p>`
				}
			]
		},
		{
			id: 'badges',
			title: 'Les badges',
			emoji: '🏅',
			intro: 'On distribue des badges pour saluer des comportements remarquables (positifs ou négatifs). Tous calculés automatiquement à partir des données.',
			items: [
				{
					id: 'badges-mandat',
					question: 'Badges <b>par mandat</b> (top 10 % par législature)',
					answer: `<ul class="list-disc pl-6 space-y-1.5">
	<li>🥇 <b>Présence en or</b> — top 10 % en taux de présence sur la législature</li>
	<li>👻 <b>Absent remarquable</b> — bottom 10 % en taux de présence (oui, c'est aussi un badge)</li>
	<li>🤝 <b>Top loyaliste</b> — top 10 % en taux de loyauté au groupe</li>
	<li>🔥 <b>Frondeur</b> — top 10 % en nombre absolu de votes contre la majorité du groupe</li>
</ul>`
				},
				{
					id: 'badges-carriere',
					question: 'Badges <b>de carrière</b> (sur l\'ensemble des mandats)',
					answer: `<ul class="list-disc pl-6 space-y-1.5">
	<li>♻️ <b>Réélu</b> — au moins 2 mandats consécutifs</li>
	<li>🏛️ <b>Vétéran</b> — au moins 3 législatures (suffisamment rare pour le saluer)</li>
	<li>🔄 <b>Transfuge</b> — a changé de groupe au sein d'un même mandat (hors NI-bridge)</li>
	<li>🎭 <b>Recomposition</b> — groupe principal différent d'une législature à la suivante</li>
</ul>
<p class="mt-3">Cf ${ADR(17, 'stats-mandat-vs-carriere')} et ${ADR(16, 'groupes-multi-appartenance')}.</p>`
				}
			]
		},
		{
			id: 'modele',
			title: 'Le modèle "une personne = une fiche"',
			emoji: '🪪',
			items: [
				{
					id: 'fusion-identite',
					question: 'Pourquoi un député n\'a-t-il qu\'<b>une seule fiche</b> même s\'il a fait plusieurs législatures ?',
					answer: `<p>Posture Pokédex : une personne, une fiche. C'est plus lisible et ça permet de raconter une carrière. On les fusionne grâce à leur identifiant <code>PA-id</code> qui est stable cross-législature dans les données Etalab.</p>
<p class="mt-2">À l'intérieur de la fiche, des onglets <code>[Carrière] [15ᵉ] [16ᵉ] [17ᵉ]</code> permettent de zoomer mandat par mandat. Cf ${ADR(15, 'modele-personne-unique')} et ${ADR(18, 'identite-paid')}.</p>`
				},
				{
					id: 'cumul-carriere',
					question: 'Comment vous calculez les stats <b>en Carrière</b> (sur tous les mandats) ?',
					answer: `<p>Cumul pondéré : on additionne les numérateurs et les dénominateurs sur tous les mandats, puis on recalcule le ratio. Ça revient à pondérer chaque mandat par son nombre de scrutins, ce qui donne plus de poids à un mandat plein qu'à un mandat de 6 mois. Cf ${ADR(17, 'stats-mandat-vs-carriere')}.</p>`
				}
			]
		},
		{
			id: 'senat',
			title: 'Le Sénat (Phase 3)',
			emoji: '🏛️',
			intro: 'Le Sénat couvre les 3 triennats de l\'ère Macron (2017-2020 → 2023-2026), à parité avec les 3 législatures AN (15ᵉ, 16ᵉ, 17ᵉ). Quelques particularités à connaître.',
			items: [
				{
					id: 'senat-overall',
					question: 'L\'<b>Overall</b> au Sénat, c\'est calculé pareil ?',
					answer: `<p>Oui, exactement la même formule que côté AN (cf <a class="underline hover:text-assembly-accent" href="#overall-formule">détails</a>) : 55 % Participation + 35 % Volume (centile 95 cohorte) + 10 % Présence. Les Overall des deux chambres ne se comparent pas directement, parce que les <b>cohortes sont distinctes</b> : un Sénat de 348 places avec une activité différente de l'AN n'a pas la même distribution naturelle.</p>
<p class="mt-2">En pratique, la moyenne d'Overall au Sénat est plus haute (~80) qu'à l'AN (~50–70), parce que la cohorte sénatoriale est quasi exclusivement composée de présents en séance (pas de ministres, peu d'absents systématiques). Cf ${ADR(22, 'score-overall')}.</p>`
				},
				{
					id: 'senat-triennat',
					question: 'Pourquoi vous parlez de "<b>triennat</b>" et plus de "législature" ?',
					answer: `<p>Côté Sénat, le <b>triennat</b> (3 ans entre 2 renouvellements) joue le rôle de la législature AN. C'est l'unité naturelle du Sénat : entre 2 renouvellements, la moitié des sièges qui vient d'être renouvelée siège tout du long, et l'autre moitié (renouvelée 3 ans plus tôt) aussi. La cohorte est <b>strictement stable</b> (sauf décès/démissions/suppléances).</p>
<p class="mt-2">3 triennats sont couverts (scope ère Macron, à parité avec les 3 législatures AN) : <code>2017-2020</code>, <code>2020-2023</code>, <code>2023-2026</code> (en cours ⚡, fin théorique sept. 2026).</p>
<p class="mt-2">Le mandat individuel sénatorial dure <b>6 ans = 2 triennats consécutifs</b> (mandat complet). Un mandat fragmenté ou partiel peut chevaucher 1, 2 ou 3 triennats. Sur la fiche d'un sénateur, l'onglet "Carrière" agrège tous les triennats de sa carrière.</p>
<p class="mt-2">Default tab à l'arrivée sur une fiche : <b>triennat en cours</b> si le sénateur y siège, sinon <b>Carrière</b>. Cf ${ADR(28, 'senat-triennat-unite-regroupement')} et ${ADR(29, 'senat-scope-ere-macron')}.</p>`
				},
				{
					id: 'senat-loyaute',
					question: 'La <b>loyauté</b> et les <b>frondes</b> Sénat, c\'est calculé comment ?',
					answer: `<p>Pareil qu'à l'AN : on regarde la position majoritaire du groupe d'appartenance <b>au moment du vote</b>. Un sénateur qui vote contre est un frondeur, un sénateur qui vote avec est loyaliste. Pas de jugement de valeur — juste un constat.</p>
<p class="mt-2">Le groupe au moment du vote est résolu via la table des appartenances historiques (<code>HISTOGROUPES</code>) qui date chaque entrée et sortie de groupe. Cf ${ADR(16, 'groupes-multi-appartenance')} (transposée).</p>`
				},
				{
					id: 'senat-delegations',
					question: 'Et les <b>délégations de vote</b> ?',
					answer: `<p>Au Sénat, un sénateur peut <b>déléguer son vote</b> à un collègue (typique en commission, ou pendant des absences brèves). Le système de délégation est une particularité institutionnelle sans équivalent côté AN.</p>
<p class="mt-2">En v1 PolitiDex, on <b>ignore les délégations</b>. Tous les votes sont attribués au sénateur enregistré sur la ligne (le délégataire), comme s'il s'agissait d'un vote propre. Conséquence : le taux d'abstention/non-votant des sénateurs qui délèguent souvent est légèrement gonflé.</p>
<p class="mt-2">Simplification consciente. Une ADR future pourra revisiter (badge "Délégant fréquent" ? décote ?). Cf ${ADR(27, 'delegations-vote-senat-v1')}.</p>`
				},
				{
					id: 'senat-bicamerale',
					question: 'Pourquoi un député ET un sénateur ne sont pas <b>fusionnés</b> dans une même fiche ?',
					answer: `<p>Parce qu'on n'a pas (encore) implémenté le matching cross-chambre. En v1 Phase 3, l'AN et le Sénat sont deux datasets <b>strictement disjoints</b> : un sénateur a un <code>matricule</code> (ex. <code>08061X</code>), un député a un <code>PA-id</code>, et on n'essaie pas de réconcilier les deux.</p>
<p class="mt-2">Conséquence : si quelqu'un est passé de l'AN au Sénat (ou inversement), il a deux fiches, une par chambre. La fusion bicamérale viendra en Phase 3c (politique de matching <code>(nom + dateNaissance)</code> à statuer dans une ADR future). Cf ${ADR(23, 'phase3-senat-scope')} et ${ADR(24, 'identifiant-senat-matricule')}.</p>`
				},
				{
					id: 'senat-hemicycle',
					question: 'D\'où vient le layout de l\'<b>hémicycle Sénat</b> à 348 sièges ?',
					answer: `<p>Adapté du projet open-source <a class="underline hover:text-assembly-accent" target="_blank" rel="noopener" href="https://github.com/Kurea/visu_senat">Kurea/visu_senat</a> (MIT). 9 couches concentriques, places 1..348 alignées avec le champ <code>siege</code> de l'API live du Sénat.</p>
<p class="mt-2">Crédit MIT préservé dans le fichier <code>senat-seats.json</code>. Cf ${ADR(26, 'hemicycle-senat-kurea')}.</p>`
				}
			]
		},
		{
			id: 'meta',
			title: 'Méta',
			emoji: '🛠',
			items: [
				{
					id: 'open-source',
					question: 'C\'est open source ?',
					answer: `<p>Oui, sous <a class="underline hover:text-assembly-accent" target="_blank" rel="noopener" href="https://github.com/IMhide/hemicycle-manager/blob/main/LICENSE">Unlicense</a> (domaine public). Le code, les ADR, les choix de pondération, tout est sur <a class="underline hover:text-assembly-accent" target="_blank" rel="noopener" href="https://github.com/IMhide/hemicycle-manager">GitHub</a>. Tu peux forker, contribuer, contester, tout est bienvenu.</p>`
				},
				{
					id: 'contribuer',
					question: 'Comment je peux <b>contribuer</b> ?',
					answer: `<p>Plein de façons :</p>
<ul class="list-disc pl-6 mt-2 space-y-1">
	<li>Ouvrir une <a class="underline hover:text-assembly-accent" target="_blank" rel="noopener" href="https://github.com/IMhide/hemicycle-manager/issues">issue GitHub</a> pour un bug, une idée de feature, ou contester un postulat éditorial.</li>
	<li>Faire une PR — on revue avec plaisir.</li>
	<li>Mettre une étoile ⭐ sur le repo si tu trouves le projet utile.</li>
</ul>
<p class="mt-2">C'est un projet bénévole. Plus on est, plus on s'amuse.</p>`
				},
				{
					id: 'phase-3',
					question: 'Y aura-t-il les <b>sénateurs</b> et les <b>ministres</b> ?',
					answer: `<p><b>Les sénateurs sont là !</b> Phase 3 PolitiDex couvre les 3 triennats de l'ère Macron (2017-2020 → 2023-2026), à parité avec les 3 législatures AN. Voir la <a class="underline hover:text-assembly-accent" href="/senat">home Sénat</a> et la section <a class="underline hover:text-assembly-accent" href="#senat">FAQ Sénat</a> ci-dessus.</p>
<p class="mt-2">Côté <b>ministres</b> et <b>présidents de la République</b>, c'est la suite de la Phase 3. Pour l'instant on couvre députés (15ᵉ + 16ᵉ + 17ᵉ législatures) et sénateurs en séparé — la fusion bicamérale (Phase 3c) viendra ensuite. Cf ${ADR(14, 'pivot-politidex')}.</p>`
				}
			]
		}
	];

	let openSection = $state<string | null>(null);

	function toggleSection(id: string) {
		openSection = openSection === id ? null : id;
	}
</script>

<svelte:head>
	<title>FAQ — PolitiDex</title>
	<meta name="description" content="Comment ça marche ? Toutes les décisions de PolitiDex expliquées en clair." />
</svelte:head>

<section class="max-w-4xl mx-auto px-6 py-10">
	<div class="mb-8">
		<h1 class="title-display text-5xl">📚 FAQ</h1>
		<p class="text-assembly-muted mt-3">
			Comment ça marche ici ? Réponses honnêtes aux questions qu'on se pose en regardant les chiffres.
		</p>
		<p class="text-xs text-assembly-muted mt-2 italic">
			Spoiler : on n'a pas la prétention d'être mathématiquement parfaits. On a fait des choix, on les explique, et on les écrit noir sur blanc dans des <a class="underline hover:text-assembly-accent" target="_blank" rel="noopener" href="https://github.com/IMhide/hemicycle-manager/tree/main/decisions">ADR sur GitHub</a>.
		</p>
	</div>

	<!-- TOC -->
	<nav class="card p-4 mb-8">
		<div class="text-[10px] uppercase tracking-widest text-assembly-muted mb-2">Sommaire</div>
		<ul class="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1 text-sm">
			{#each sections as section (section.id)}
				<li>
					<a href="#{section.id}" class="hover:text-assembly-accent transition-colors">
						<span aria-hidden="true">{section.emoji}</span>
						{section.title}
					</a>
				</li>
			{/each}
		</ul>
	</nav>

	{#each sections as section (section.id)}
		<div id={section.id} class="mb-10 scroll-mt-20">
			<h2 class="title-display text-3xl mb-2 flex items-center gap-2">
				<span aria-hidden="true">{section.emoji}</span>
				{section.title}
			</h2>
			{#if section.intro}
				<p class="text-sm text-assembly-muted mb-4">{section.intro}</p>
			{/if}

			<div class="space-y-2">
				{#each section.items as item (item.id)}
					<details
						id={item.id}
						class="card p-0 group scroll-mt-20"
						open={openSection === item.id}
					>
						<!-- svelte-ignore a11y_no_redundant_roles -->
						<summary
							class="cursor-pointer p-4 flex items-start gap-3 list-none hover:bg-assembly-border/20 transition-colors rounded-lg"
							onclick={(e) => {
								e.preventDefault();
								toggleSection(item.id);
								history.replaceState(null, '', `#${item.id}`);
							}}
						>
							<span
								class="text-assembly-accent text-lg leading-none transition-transform group-open:rotate-90 select-none"
								aria-hidden="true">▸</span
							>
							<span class="font-semibold flex-1">{@html item.question}</span>
						</summary>
						<div class="px-4 pb-4 pl-12 text-sm text-slate-300 leading-relaxed">
							{@html item.answer}
						</div>
					</details>
				{/each}
			</div>
		</div>
	{/each}

	<div class="card p-5 text-center">
		<div class="title-display text-xl mb-2">Une question qui n'a pas sa réponse ?</div>
		<p class="text-sm text-assembly-muted">
			Ouvre une <a class="underline hover:text-assembly-accent" target="_blank" rel="noopener" href="https://github.com/IMhide/hemicycle-manager/issues">issue sur GitHub</a> ou viens nous filer un coup de main 🙌
		</p>
	</div>
</section>

<script module lang="ts">
	export const prerender = true;
</script>
