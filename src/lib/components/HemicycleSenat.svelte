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
	import { gradientColorFor } from '$lib/political-order';

	const VOTE_COLORS = {
		pour: '#22c55e',
		contre: '#ef4444',
		abstention: '#eab308',
		nonVotant: '#64748b',
		absent: '#1e293b'
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
		sesann: number;
		mode: Mode;
		hovered?: string | null;
		onhover?: (matricule: string | null) => void;
		onselect?: (matricule: string) => void;
	}

	let { senateurs, sesann, mode, hovered = null, onhover, onselect }: Props = $props();

	const groupeByCode = $derived.by(() => {
		const m = new Map<string, GroupeSenat>();
		for (const g of mode.groupes) m.set(g.code, g);
		return m;
	});

	function mandatCouvrantSession(s: Senateur): MandatSenat | null {
		for (const m of s.mandats) {
			if (m.sessions.some((sess) => sess.sesann === sesann)) return m;
		}
		return null;
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
		if (mode.kind === 'vote' && !mode.votes[s.id]) return 0.25;
		if (mode.kind === 'highlight-groupe') {
			const app = appartenanceContextuelle(m);
			if (app?.groupeCode !== mode.groupeCode) return 0.2;
		}
		return 1;
	}

	const layout = $derived.by(() => {
		const seated: Array<{ senateur: Senateur; mandat: MandatSenat; x: number; y: number }> = [];
		let nonPlaces = 0;

		for (const s of senateurs) {
			const m = mandatCouvrantSession(s);
			if (!m) continue;

			if (m.place && SEAT_MAP_SENAT.has(m.place)) {
				const pos = SEAT_MAP_SENAT.get(m.place)!;
				seated.push({ senateur: s, mandat: m, x: pos.x, y: pos.y });
			} else {
				nonPlaces++;
			}
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
		aria-label="Hémicycle du Sénat, session {sesann}-{sesann + 1}"
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
		<div class="text-[10px] text-assembly-muted text-center mt-2 italic">
			{layout.nonPlaces} sénateur·rice·s sans siège attribué pour cette session (renouvellement
			récent, fin de mandat). Visibles dans la liste des sénateurs.
		</div>
	{/if}
</div>
