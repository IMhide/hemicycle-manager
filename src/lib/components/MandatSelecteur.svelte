<script lang="ts">
	/**
	 * Sélecteur unique des mandats sur la fiche Élu (cf ADR 0030, 0032).
	 *
	 * Présente : [Carrière] [AN-15] [AN-16] [AN-17] [Sénat-2017-2020] [Sénat-2020-2023] [Sénat-2023-2026]
	 *
	 * Ordre chronologique ascendant. AN d'abord puis Sénat (les bicaméraux sont
	 * rares mais cohérents). Les mandats en cours (`fin === null`) sont
	 * signalés par un fond légèrement teinté — pas d'icône bruyante.
	 *
	 * Encode l'état actif via querystring `?tab=...` :
	 *   - `?tab=carriere` (défaut)
	 *   - `?tab=an-15`, `?tab=an-16`, `?tab=an-17`
	 *   - `?tab=senat-2017-2020`, `?tab=senat-2020-2023`, `?tab=senat-2023-2026`
	 *
	 * Le composant ne pousse pas l'URL — émet la sélection via `onSelect`,
	 * la route gère le routing pour rester réactive.
	 */
	import type { EluMandatRef } from '$lib/elus';

	export type SelectedTab =
		| { kind: 'carriere' }
		| { kind: 'an'; legislature: number }
		| { kind: 'senat'; triennat: string };

	interface Props {
		mandats: EluMandatRef[];
		selected: SelectedTab;
		onSelect: (tab: SelectedTab) => void;
	}

	let { mandats, selected, onSelect }: Props = $props();

	// Tri : AN par législature ASC, puis Sénat par triennat ASC.
	const ordered = $derived.by(() => {
		const an = mandats
			.filter((m): m is Extract<EluMandatRef, { chambre: 'AN' }> => m.chambre === 'AN')
			.sort((a, b) => a.legislature - b.legislature);
		const senat = mandats
			.filter((m): m is Extract<EluMandatRef, { chambre: 'SENAT' }> => m.chambre === 'SENAT')
			.sort((a, b) => a.triennat.localeCompare(b.triennat));
		return [...an, ...senat];
	});

	function isCurrent(m: EluMandatRef): boolean {
		return m.fin === null;
	}

	function isActive(m: EluMandatRef): boolean {
		if (selected.kind === 'an' && m.chambre === 'AN') return m.legislature === selected.legislature;
		if (selected.kind === 'senat' && m.chambre === 'SENAT') return m.triennat === selected.triennat;
		return false;
	}

	function selectMandat(m: EluMandatRef) {
		if (m.chambre === 'AN') onSelect({ kind: 'an', legislature: m.legislature });
		else onSelect({ kind: 'senat', triennat: m.triennat });
	}

	function libelle(m: EluMandatRef): string {
		if (m.chambre === 'AN') return `${m.legislature}ᵉ AN`;
		return m.triennat;
	}

	function annees(m: EluMandatRef): string {
		const debut = new Date(m.debut).getFullYear();
		const fin = m.fin ? new Date(m.fin).getFullYear() : null;
		return fin ? `${debut}-${fin}` : `${debut}-`;
	}
</script>

<div class="flex flex-wrap gap-1 border-b border-border-soft/50">
	<button
		type="button"
		class="px-4 py-2 text-sm font-semibold transition-colors border-b-2 -mb-px {selected.kind ===
		'carriere'
			? 'border-accent text-link'
			: 'border-transparent text-fg-muted hover:text-fg'}"
		onclick={() => onSelect({ kind: 'carriere' })}
	>
		Carrière
	</button>
	{#each ordered as m (m.chambre + (m.chambre === 'AN' ? m.legislature : m.triennat))}
		<button
			type="button"
			title={isCurrent(m) ? 'Mandat en cours' : undefined}
			class="px-4 py-2 text-sm font-semibold transition-colors border-b-2 -mb-px flex items-center gap-1.5 {isActive(
				m
			)
				? 'border-accent text-link'
				: 'border-transparent text-fg-muted hover:text-fg'} {isCurrent(m)
				? 'bg-accent/5'
				: ''}"
			onclick={() => selectMandat(m)}
		>
			<span class="text-[10px] opacity-60">
				{m.chambre === 'AN' ? '🏛️ AN' : '🏛️ Sén.'}
			</span>
			<span>{libelle(m)}</span>
			<span class="text-[10px] font-normal opacity-60">({annees(m)})</span>
		</button>
	{/each}
</div>
