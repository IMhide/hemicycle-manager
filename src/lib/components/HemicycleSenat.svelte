<script lang="ts">
	/**
	 * Rendu de l'hémicycle du Sénat (348 sièges) pour une session donnée.
	 *
	 * Modèle Phase 3 (cf ADR 0023..0027) : reçoit des `Senateur[]`. La session
	 * cible permet de filtrer les sénateurs qui siégeaient à ce moment, et de
	 * sélectionner l'appartenance de groupe pertinente (cf ADR 0016 transposée).
	 *
	 * Différences notables avec l'AN :
	 *  - Pas de banc NI séparé : les NI Sénat ont leurs propres places (cf plan F.1)
	 *  - Seuls les sénateurs ACTIF avec un mandat couvrant la session ont une place
	 */
	import type {
		Senateur,
		GroupeSenat,
		VotePosition,
		MandatSenat,
		AppartenanceGroupeSenat
	} from '$lib/types';
	import {
		SEAT_MAP_SENAT,
		HEMICYCLE_VIEWBOX_SENAT,
		SEAT_RADIUS_SENAT
	} from '$lib/hemicycle-senat';
	import { gradientColorFor, POLITICAL_ORDER } from '$lib/political-order';

	// `absent` en gris clair franc (slate-400) pour que les sénateurs absents
	// soient visibles, et non fantômes (cf alignement avec hemicycle.ts AN).
	const VOTE_COLORS = {
		pour: '#22c55e',
		contre: '#ef4444',
		abstention: '#eab308',
		nonVotant: '#64748b',
		absent: '#94a3b8'
	} as const;

	type Mode =
		| { kind: 'groupe'; groupes: GroupeSenat[] }
		| { kind: 'gradient'; groupes: GroupeSenat[] }
		| {
				kind: 'vote';
				votes: Record<string, VotePosition>;
				groupes: GroupeSenat[];
				dateScrutin: string;
		  }
		| { kind: 'highlight-groupe'; groupeCode: string; groupes: GroupeSenat[] };

	interface Props {
		senateurs: Senateur[];
		/** TriennatId (ex. "2023-2026"), cf ADR 0028. */
		triennat: string;
		mode: Mode;
		hovered?: string | null;
		onhover?: (matricule: string | null) => void;
		onselect?: (matricule: string) => void;
	}

	let { senateurs, triennat, mode, hovered = null, onhover, onselect }: Props = $props();

	const groupeByCode = $derived.by(() => {
		const m = new Map<string, GroupeSenat>();
		for (const g of mode.groupes) m.set(g.code, g);
		return m;
	});

	function mandatCouvrantTriennat(s: Senateur): MandatSenat | null {
		// Préférer un mandat encore actif (dateFinFonction null) pour éviter de
		// dupliquer un sénateur qui a fini puis recommencé un mandat dans le même
		// triennat. À défaut, prendre le premier mandat couvrant.
		const actif = s.mandats.find(
			(m) => m.dateFinFonction === null && m.triennats.some((t) => t.triennat === triennat)
		);
		if (actif) return actif;
		return s.mandats.find((m) => m.triennats.some((t) => t.triennat === triennat)) ?? null;
	}

	function appartenanceALaDate(
		m: MandatSenat,
		date: string
	): AppartenanceGroupeSenat | null {
		for (const a of m.appartenancesGroupe) {
			if (a.dateDebut <= date && (a.dateFin === null || a.dateFin >= date)) return a;
		}
		return m.appartenancesGroupe.at(-1) ?? null;
	}

	/** Appartenance la plus récente au sein d'un mandat. Pas de notion de NI-transitoire
	 *  côté Sénat (HISTOGROUPES n'a pas la même temporalité que l'AN). */
	function appartenancePrincipale(m: MandatSenat): AppartenanceGroupeSenat | null {
		return m.appartenancesGroupe.at(-1) ?? null;
	}

	function appartenanceContextuelle(m: MandatSenat): AppartenanceGroupeSenat | null {
		if (mode.kind === 'vote') return appartenanceALaDate(m, mode.dateScrutin);
		return appartenancePrincipale(m);
	}

	function colorForSenateur(s: Senateur, m: MandatSenat): string {
		const app = appartenanceContextuelle(m);
		const groupe = app ? groupeByCode.get(app.groupeCode) ?? null : null;
		const abrev = groupe?.libelleAbrege ?? null;

		if (mode.kind === 'gradient') return gradientColorFor(abrev);
		if (mode.kind === 'groupe') return groupe?.couleur ?? '#888';

		if (mode.kind === 'highlight-groupe') {
			if (app?.groupeCode === mode.groupeCode) return groupe?.couleur ?? '#fbbf24';
			return '#334155';
		}

		const pos = mode.votes[s.id] ?? 'absent';
		return VOTE_COLORS[pos];
	}

	function opacityForSenateur(s: Senateur, m: MandatSenat): number {
		// En mode vote, les absents ont déjà la couleur grise (VOTE_COLORS.absent),
		// on les rend pleinement visibles. Pour les autres modes, l'estompage est conservé.
		if (mode.kind === 'highlight-groupe') {
			const app = appartenanceContextuelle(m);
			if (app?.groupeCode !== mode.groupeCode) return 0.2;
		}
		return 1;
	}

	function rankOfMandat(m: MandatSenat): number {
		const app = appartenanceContextuelle(m);
		const code = app?.groupeCode;
		// On utilise libelleAbrege via groupeByCode (clé canonique POLITICAL_ORDER) ;
		// les codes Sénat (UMP, UC, SOC…) sont eux-mêmes mappés directement.
		const fromGroupes = code ? groupeByCode.get(code)?.libelleAbrege : null;
		const key = fromGroupes ?? code ?? '';
		return POLITICAL_ORDER[key]?.rank ?? 12;
	}

	const layout = $derived.by(() => {
		// 1. Cohorte du triennat (1 entrée par sénateur) avec le mandat couvrant.
		//    `mandatCouvrantTriennat` privilégie déjà le mandat actif quand il existe.
		const cohorte: Array<{ senateur: Senateur; mandat: MandatSenat }> = [];
		for (const s of senateurs) {
			const m = mandatCouvrantTriennat(s);
			if (m) cohorte.push({ senateur: s, mandat: m });
		}

		// 2. Sièges occupés par les `place` réelles (api-senat, mandats actifs).
		const seated: Array<{ senateur: Senateur; mandat: MandatSenat; x: number; y: number }> = [];
		const usedPlaces = new Set<number>();
		const sansPlace: Array<{ senateur: Senateur; mandat: MandatSenat }> = [];

		for (const entry of cohorte) {
			const m = entry.mandat;
			if (m.place && SEAT_MAP_SENAT.has(m.place) && !usedPlaces.has(m.place)) {
				const pos = SEAT_MAP_SENAT.get(m.place)!;
				seated.push({ senateur: entry.senateur, mandat: m, x: pos.x, y: pos.y });
				usedPlaces.add(m.place);
			} else {
				sansPlace.push(entry);
			}
		}

		// 3. Cas spécial : si la salle est déjà entièrement remplie par des
		//    `place` réelles (348/348), pas de fallback — les sénateurs partis
		//    en cours de triennat resteraient en surplus. C'est le cas du
		//    triennat en cours (2023-2026) : les 348 mandats actifs aujourd'hui
		//    occupent toutes les places, les 183 mandats clos chevauchant le
		//    triennat ne sont pas redessinés par-dessus.
		if (usedPlaces.size >= SEAT_MAP_SENAT.size) {
			return { seated, nonPlaces: sansPlace.length };
		}

		// 4. Sièges libres triés par x croissant (gauche → droite). Le siège est
		//    une approximation de "position politique" par sa coordonnée x ; on
		//    aligne donc le rank groupe (1=gauche, 11=droite) sur ce gradient.
		const siegesLibres = [...SEAT_MAP_SENAT.values()]
			.filter((s) => !usedPlaces.has(s.place))
			.sort((a, b) => a.x - b.x);

		// 5. Sénateurs sans place triés par (rank groupe, nom). Tous les sans-place
		//    de la cohorte sont éligibles (mandats actifs ET clos chevauchant le
		//    triennat), pour ne pas vider l'hémicycle des triennats anciens.
		const sansPlaceSorted = [...sansPlace].sort((a, b) => {
			const rA = rankOfMandat(a.mandat);
			const rB = rankOfMandat(b.mandat);
			if (rA !== rB) return rA - rB;
			return a.senateur.identite.nom.localeCompare(b.senateur.identite.nom);
		});

		let nonPlaces = 0;
		for (let i = 0; i < sansPlaceSorted.length; i++) {
			const seat = siegesLibres[i];
			if (!seat) {
				nonPlaces++;
				continue;
			}
			const entry = sansPlaceSorted[i];
			seated.push({ senateur: entry.senateur, mandat: entry.mandat, x: seat.x, y: seat.y });
		}

		return { seated, nonPlaces };
	});

	const fullViewBox = $derived(
		`${HEMICYCLE_VIEWBOX_SENAT.x} ${HEMICYCLE_VIEWBOX_SENAT.y} ${HEMICYCLE_VIEWBOX_SENAT.width} ${HEMICYCLE_VIEWBOX_SENAT.height}`
	);
</script>

<div class="relative w-full">
	<svg
		viewBox={fullViewBox}
		class="w-full h-auto max-h-[60vh]"
		preserveAspectRatio="xMidYMid meet"
		role="img"
		aria-label="Hémicycle du Sénat, triennat {triennat}"
	>
		<g opacity="0.5">
			<rect
				x={HEMICYCLE_VIEWBOX_SENAT.x + HEMICYCLE_VIEWBOX_SENAT.width / 2 - 40}
				y={HEMICYCLE_VIEWBOX_SENAT.y + HEMICYCLE_VIEWBOX_SENAT.height - 24}
				width="80"
				height="8"
				rx="2"
				fill="#475569"
			/>
			<text
				x={HEMICYCLE_VIEWBOX_SENAT.x + HEMICYCLE_VIEWBOX_SENAT.width / 2}
				y={HEMICYCLE_VIEWBOX_SENAT.y + HEMICYCLE_VIEWBOX_SENAT.height - 6}
				text-anchor="middle"
				fill="#64748b"
				font-size="9"
				font-family="Inter, system-ui"
			>
				PRÉSIDENCE
			</text>
		</g>

		{#each layout.seated as { senateur, mandat, x, y } (senateur.id)}
			{@const isHovered = hovered === senateur.id}
			<circle
				cx={x}
				cy={y}
				r={SEAT_RADIUS_SENAT * (isHovered ? 1.4 : 1)}
				fill={colorForSenateur(senateur, mandat)}
				opacity={opacityForSenateur(senateur, mandat)}
				stroke={isHovered ? '#fbbf24' : 'rgba(15,23,42,0.4)'}
				stroke-width={isHovered ? 1.5 : 0.5}
				class="cursor-pointer transition-all duration-300"
				onmouseenter={() => onhover?.(senateur.id)}
				onmouseleave={() => onhover?.(null)}
				onclick={() => onselect?.(senateur.id)}
				onkeydown={(e) => (e.key === 'Enter' ? onselect?.(senateur.id) : null)}
				role="button"
				tabindex="-1"
				aria-label="{senateur.identite.prenom} {senateur.identite.nom}"
			/>
		{/each}
	</svg>
	{#if layout.nonPlaces > 0}
		<div class="text-[10px] text-fg-muted text-center mt-2 italic">
			{layout.nonPlaces} sénateur·rice·s en surplus (cohorte cumulée &gt; 348 sièges via
			suppléances et renouvellements). Visibles dans la liste des sénateurs.
		</div>
	{/if}
</div>
