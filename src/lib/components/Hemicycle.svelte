<script lang="ts">
	/**
	 * Rendu de l'hémicycle pour une législature donnée.
	 *
	 * Modèle Phase 1 (cf ADR 0015) : reçoit des `Personne[]`. La législature
	 * cible est passée en prop pour sélectionner le bon mandat de chaque personne
	 * (place officielle + groupe d'appartenance au moment du rendu).
	 *
	 * Le mode "vote" utilise le groupe **au moment du vote** (cf ADR 0016) ; les
	 * autres modes utilisent le groupe en fin de mandat (ou en cours si le mandat
	 * est actif).
	 */
	import type { Personne, Groupe, VotePosition, Mandat, AppartenanceGroupe } from '$lib/types';
	import { SEAT_MAP, HEMICYCLE_VIEWBOX, SEAT_RADIUS, VOTE_COLORS } from '$lib/hemicycle';
	import { gradientColorFor } from '$lib/political-order';

	type Mode =
		| { kind: 'groupe'; groupes: Groupe[] }
		| { kind: 'gradient'; groupes: Groupe[] }
		| { kind: 'vote'; votes: Record<string, VotePosition>; groupes: Groupe[]; dateScrutin: string }
		| { kind: 'highlight-groupe'; groupeId: string; groupes: Groupe[] };

	interface Props {
		personnes: Personne[];
		legislature: number;
		mode: Mode;
		hovered?: string | null;
		onhover?: (personneId: string | null) => void;
		onselect?: (personneId: string) => void;
	}

	let { personnes, legislature, mode, hovered = null, onhover, onselect }: Props = $props();

	const groupeById = $derived.by(() => {
		const m = new Map<string, Groupe>();
		for (const g of mode.groupes) m.set(g.id, g);
		return m;
	});

	function mandatPourLeg(p: Personne): Mandat | null {
		return p.mandats.find((m) => m.legislature === legislature) ?? null;
	}

	/** Appartenance du mandat couvrant la date donnée (cf ADR 0016). */
	function appartenanceALaDate(m: Mandat, date: string): AppartenanceGroupe | null {
		for (const a of m.appartenancesGroupe) {
			if (a.dateDebut <= date && (a.dateFin === null || a.dateFin >= date)) return a;
		}
		return m.appartenancesGroupe.at(-1) ?? null;
	}

	/** Appartenance "principale" du mandat (la plus récente non-NI-transitoire). */
	function appartenancePrincipale(m: Mandat): AppartenanceGroupe | null {
		for (let i = m.appartenancesGroupe.length - 1; i >= 0; i--) {
			const a = m.appartenancesGroupe[i];
			if (!a.isTransitoireNI) return a;
		}
		return m.appartenancesGroupe.at(-1) ?? null;
	}

	function appartenanceContextuelle(m: Mandat): AppartenanceGroupe | null {
		if (mode.kind === 'vote') return appartenanceALaDate(m, mode.dateScrutin);
		return appartenancePrincipale(m);
	}

	function colorForPersonne(p: Personne, m: Mandat): string {
		const app = appartenanceContextuelle(m);
		const groupe = app ? groupeById.get(app.groupeId) ?? null : null;
		const abrev = groupe?.libelleAbrege ?? null;

		if (mode.kind === 'gradient') return gradientColorFor(abrev);
		if (mode.kind === 'groupe') return groupe?.couleur ?? '#888';

		if (mode.kind === 'highlight-groupe') {
			if (app?.groupeId === mode.groupeId) return groupe?.couleur ?? '#fbbf24';
			return '#334155';
		}

		// vote mode
		const pos = mode.votes[p.id] ?? 'absent';
		return VOTE_COLORS[pos];
	}

	function opacityForPersonne(p: Personne, m: Mandat): number {
		// En mode vote, les absents ont déjà la couleur grise (VOTE_COLORS.absent),
		// on les rend pleinement visibles. Pour les autres modes, l'estompage est conservé.
		if (mode.kind === 'highlight-groupe') {
			const app = appartenanceContextuelle(m);
			if (app?.groupeId !== mode.groupeId) return 0.2;
		}
		return 1;
	}

	const layout = $derived.by(() => {
		const seated: Array<{ personne: Personne; mandat: Mandat; x: number; y: number }> = [];
		const benched: Array<{ personne: Personne; mandat: Mandat }> = [];
		/** Personnes sans `placeHemicycle` dans AMO30 (suppléants, ministres,
		 *  démissionnaires précoces…) qui n'ont pas leur place dans le SVG officiel. */
		let nonPlaces = 0;

		for (const p of personnes) {
			const m = mandatPourLeg(p);
			if (!m) continue;

			const app = appartenanceContextuelle(m);
			const groupe = app ? groupeById.get(app.groupeId) ?? null : null;
			const isNI = groupe?.libelleAbrege === 'NI' || !app;

			if (isNI) {
				benched.push({ personne: p, mandat: m });
				continue;
			}
			if (m.place && SEAT_MAP.has(m.place)) {
				const pos = SEAT_MAP.get(m.place)!;
				seated.push({ personne: p, mandat: m, x: pos.x, y: pos.y });
			} else {
				// Place non renseignée par AMO30 (cf README). On les compte mais
				// on ne les met PAS au banc des NI (ce serait trompeur visuellement).
				nonPlaces++;
			}
		}
		return { seated, benched, nonPlaces };
	});

	const benchY = HEMICYCLE_VIEWBOX.y + HEMICYCLE_VIEWBOX.height + 20;
	const benchPadding = 40;

	const benchedPositions = $derived.by(() => {
		const n = layout.benched.length;
		if (n === 0) return [];
		const usableWidth = HEMICYCLE_VIEWBOX.width - 2 * benchPadding;
		const step = n === 1 ? 0 : usableWidth / (n - 1);
		return layout.benched.map((entry, i) => ({
			...entry,
			x: HEMICYCLE_VIEWBOX.x + benchPadding + step * i,
			y: benchY + 10
		}));
	});

	const fullViewBox = $derived(
		`${HEMICYCLE_VIEWBOX.x} ${HEMICYCLE_VIEWBOX.y} ${HEMICYCLE_VIEWBOX.width} ${HEMICYCLE_VIEWBOX.height + 50}`
	);
</script>

<div class="relative w-full">
	<svg
		viewBox={fullViewBox}
		class="w-full h-auto max-h-[60vh]"
		preserveAspectRatio="xMidYMid meet"
		role="img"
		aria-label="Hémicycle de l'Assemblée nationale, {legislature}ᵉ législature"
	>
		<g opacity="0.5">
			<rect
				x={HEMICYCLE_VIEWBOX.x + HEMICYCLE_VIEWBOX.width / 2 - 30}
				y={HEMICYCLE_VIEWBOX.y + HEMICYCLE_VIEWBOX.height - 18}
				width="60"
				height="6"
				rx="2"
				fill="#475569"
			/>
			<text
				x={HEMICYCLE_VIEWBOX.x + HEMICYCLE_VIEWBOX.width / 2}
				y={HEMICYCLE_VIEWBOX.y + HEMICYCLE_VIEWBOX.height - 4}
				text-anchor="middle"
				fill="#64748b"
				font-size="6"
				font-family="Inter, system-ui"
			>
				PERCHOIR
			</text>
		</g>

		{#each layout.seated as { personne, mandat, x, y } (personne.id)}
			{@const isHovered = hovered === personne.id}
			<circle
				cx={x}
				cy={y}
				r={SEAT_RADIUS * (isHovered ? 1.6 : 1)}
				fill={colorForPersonne(personne, mandat)}
				opacity={opacityForPersonne(personne, mandat)}
				stroke={isHovered ? '#fbbf24' : 'rgba(15,23,42,0.4)'}
				stroke-width={isHovered ? 1.2 : 0.4}
				class="cursor-pointer transition-all duration-300"
				onmouseenter={() => onhover?.(personne.id)}
				onmouseleave={() => onhover?.(null)}
				onclick={() => onselect?.(personne.id)}
				onkeydown={(e) => (e.key === 'Enter' ? onselect?.(personne.id) : null)}
				role="button"
				tabindex="-1"
				aria-label="{personne.identite.prenom} {personne.identite.nom}"
			/>
		{/each}

		{#if benchedPositions.length > 0}
			<g>
				<rect
					x={HEMICYCLE_VIEWBOX.x + 20}
					y={benchY - 4}
					width={HEMICYCLE_VIEWBOX.width - 40}
					height="22"
					rx="4"
					fill="#1e293b"
					stroke="#334155"
					stroke-width="0.5"
				/>
				<text
					x={HEMICYCLE_VIEWBOX.x + 25}
					y={benchY + 9}
					fill="#64748b"
					font-size="6"
					font-family="Inter, system-ui"
					letter-spacing="0.1em"
				>
					BANC · NON INSCRITS
				</text>
				{#each benchedPositions as { personne, mandat, x, y } (personne.id)}
					{@const isHovered = hovered === personne.id}
					<circle
						cx={x}
						cy={y}
						r={SEAT_RADIUS * (isHovered ? 1.6 : 1)}
						fill={colorForPersonne(personne, mandat)}
						opacity={opacityForPersonne(personne, mandat)}
						stroke={isHovered ? '#fbbf24' : 'rgba(15,23,42,0.4)'}
						stroke-width={isHovered ? 1.2 : 0.4}
						class="cursor-pointer transition-all duration-300"
						onmouseenter={() => onhover?.(personne.id)}
						onmouseleave={() => onhover?.(null)}
						onclick={() => onselect?.(personne.id)}
						onkeydown={(e) => (e.key === 'Enter' ? onselect?.(personne.id) : null)}
						role="button"
						tabindex="-1"
						aria-label="{personne.identite.prenom} {personne.identite.nom}"
					/>
				{/each}
			</g>
		{/if}
	</svg>
	{#if layout.nonPlaces > 0}
		<div class="text-[10px] text-fg-muted text-center mt-2 italic">
			{layout.nonPlaces} député·e·s sans siège officiel publié par l'Assemblée pour cette législature (suppléants, démissionnaires, ministres). Visibles dans la liste des députés.
		</div>
	{/if}
</div>
