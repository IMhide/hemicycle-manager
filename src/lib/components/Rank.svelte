<script lang="ts">
	/**
	 * Display a rank as either a tier-colored pill (top 50 %) or a #X/Y badge.
	 *
	 * Tier breakdown (aplats francs DS §2, pas d'emoji médaille) :
	 *  - top 10 % → or
	 *  - top 25 % → argent
	 *  - top 50 % → bronze
	 *  - reste    → "#X/Y" en gris
	 */
	interface Props {
		rank: number | null;
		total: number;
		size?: 'xs' | 'sm';
	}

	let { rank, total, size = 'sm' }: Props = $props();

	const tier = $derived.by(() => {
		if (rank === null || total === 0) return 'na';
		const ratio = rank / total;
		if (ratio <= 0.1) return 'gold';
		if (ratio <= 0.25) return 'silver';
		if (ratio <= 0.5) return 'bronze';
		return 'plain';
	});

	// Aplats francs par tier : fond couleur plein + texte noir + bordure
	// brutaliste. Contraste AA garanti en Light comme en Dark.
	const config = $derived(
		{
			gold: 'bg-amber-400 text-[#0a0a0a] border-2 border-border',
			silver: 'bg-surface-2 text-fg border-2 border-border',
			bronze: 'bg-orange-400 text-[#0a0a0a] border-2 border-border',
			plain: 'text-fg-muted bg-border-soft/30',
			na: 'text-fg-muted/50'
		}[tier]
	);

	const textSize = $derived(size === 'xs' ? 'text-[9px] px-1' : 'text-[10px] px-1.5');
</script>

{#if rank === null}
	<span class="{textSize} {config} font-medium tabular-nums whitespace-nowrap">N/A</span>
{:else if tier === 'plain'}
	<span class="{textSize} {config} font-medium tabular-nums whitespace-nowrap" title="Rang {rank} sur {total}">
		#{rank}/{total}
	</span>
{:else}
	<span
		class="{textSize} {config} font-bold tabular-nums whitespace-nowrap"
		title="Rang {rank} sur {total}"
	>
		#{rank}
	</span>
{/if}
