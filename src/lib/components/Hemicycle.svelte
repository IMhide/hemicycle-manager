<script lang="ts">
	import type { Depute, Groupe, VotePosition } from '$lib/types';
	import { SEAT_MAP, HEMICYCLE_VIEWBOX, SEAT_RADIUS, VOTE_COLORS } from '$lib/hemicycle';
	import { gradientColorFor, POLITICAL_ORDER } from '$lib/political-order';

	type Mode =
		| { kind: 'groupe'; groupes: Groupe[] }      // tinte par couleur officielle du groupe
		| { kind: 'gradient'; groupes: Groupe[] }    // gradient politique (rouge → bleu)
		| { kind: 'vote'; votes: Record<string, VotePosition>; groupes: Groupe[] }
		| { kind: 'highlight-groupe'; groupeId: string; groupes: Groupe[] };

	interface Props {
		deputes: Depute[];
		mode: Mode;
		hovered?: string | null;
		onhover?: (deputeId: string | null) => void;
		onselect?: (deputeId: string) => void;
	}

	let { deputes, mode, hovered = null, onhover, onselect }: Props = $props();

	const groupeById = $derived.by(() => {
		const m = new Map<string, Groupe>();
		for (const g of mode.groupes) m.set(g.id, g);
		return m;
	});

	function colorForDepute(d: Depute): string {
		const groupe = d.groupeId ? groupeById.get(d.groupeId) : null;
		const abrev = groupe?.libelleAbrege ?? null;

		if (mode.kind === 'gradient') return gradientColorFor(abrev);
		if (mode.kind === 'groupe') return groupe?.couleur ?? '#888';

		if (mode.kind === 'highlight-groupe') {
			if (d.groupeId === mode.groupeId) {
				return groupe?.couleur ?? '#fbbf24';
			}
			return '#334155';
		}

		// vote mode
		const pos = mode.votes[d.id] ?? 'absent';
		return VOTE_COLORS[pos];
	}

	function opacityForDepute(d: Depute): number {
		if (mode.kind === 'vote' && !mode.votes[d.id]) return 0.25;
		if (mode.kind === 'highlight-groupe' && d.groupeId !== mode.groupeId) return 0.2;
		return 1;
	}

	// Split deputies: those with a known seat go to the hémicycle; NI go to
	// the bench. Non-inscrits group is detected by abrégé "NI".
	const layout = $derived.by(() => {
		const seated: Array<{ depute: Depute; x: number; y: number }> = [];
		const benched: Depute[] = [];

		for (const d of deputes) {
			const groupe = d.groupeId ? groupeById.get(d.groupeId) : null;
			const isNI = groupe?.libelleAbrege === 'NI' || !d.groupeId;

			if (isNI) {
				benched.push(d);
				continue;
			}
			if (d.place && SEAT_MAP.has(d.place)) {
				const pos = SEAT_MAP.get(d.place)!;
				seated.push({ depute: d, x: pos.x, y: pos.y });
			} else {
				// fallback: missing seat → put on bench so they don't disappear
				benched.push(d);
			}
		}
		return { seated, benched };
	});

	// Bench geometry: a horizontal row underneath the hémicycle.
	const benchY = HEMICYCLE_VIEWBOX.y + HEMICYCLE_VIEWBOX.height + 20;
	const benchPadding = 40;

	const benchedPositions = $derived.by(() => {
		const n = layout.benched.length;
		if (n === 0) return [];
		const usableWidth = HEMICYCLE_VIEWBOX.width - 2 * benchPadding;
		const step = n === 1 ? 0 : usableWidth / (n - 1);
		return layout.benched.map((d, i) => ({
			depute: d,
			x: HEMICYCLE_VIEWBOX.x + benchPadding + step * i,
			y: benchY + 10
		}));
	});

	// Extend the viewBox to include the bench.
	const fullViewBox = $derived(
		`${HEMICYCLE_VIEWBOX.x} ${HEMICYCLE_VIEWBOX.y} ${HEMICYCLE_VIEWBOX.width} ${HEMICYCLE_VIEWBOX.height + 50}`
	);
</script>

<div class="relative w-full">
	<svg viewBox={fullViewBox} class="w-full h-auto max-h-[60vh]" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Hémicycle de l'Assemblée nationale">
		<!-- Perchoir indicator: small bar at the bottom-center of the hémicycle -->
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

		<!-- Hémicycle seats -->
		{#each layout.seated as { depute, x, y } (depute.id)}
			{@const isHovered = hovered === depute.id}
			<circle
				cx={x}
				cy={y}
				r={SEAT_RADIUS * (isHovered ? 1.6 : 1)}
				fill={colorForDepute(depute)}
				opacity={opacityForDepute(depute)}
				stroke={isHovered ? '#fbbf24' : 'rgba(15,23,42,0.4)'}
				stroke-width={isHovered ? 1.2 : 0.4}
				class="cursor-pointer transition-all duration-300"
				onmouseenter={() => onhover?.(depute.id)}
				onmouseleave={() => onhover?.(null)}
				onclick={() => onselect?.(depute.id)}
				onkeydown={(e) => (e.key === 'Enter' ? onselect?.(depute.id) : null)}
				role="button"
				tabindex="-1"
				aria-label="{depute.prenom} {depute.nom}"
			/>
		{/each}

		<!-- Bench (Non-inscrits row) -->
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
				{#each benchedPositions as { depute, x, y } (depute.id)}
					{@const isHovered = hovered === depute.id}
					<circle
						cx={x}
						cy={y}
						r={SEAT_RADIUS * (isHovered ? 1.6 : 1)}
						fill={colorForDepute(depute)}
						opacity={opacityForDepute(depute)}
						stroke={isHovered ? '#fbbf24' : 'rgba(15,23,42,0.4)'}
						stroke-width={isHovered ? 1.2 : 0.4}
						class="cursor-pointer transition-all duration-300"
						onmouseenter={() => onhover?.(depute.id)}
						onmouseleave={() => onhover?.(null)}
						onclick={() => onselect?.(depute.id)}
						onkeydown={(e) => (e.key === 'Enter' ? onselect?.(depute.id) : null)}
						role="button"
						tabindex="-1"
						aria-label="{depute.prenom} {depute.nom}"
					/>
				{/each}
			</g>
		{/if}
	</svg>
</div>
