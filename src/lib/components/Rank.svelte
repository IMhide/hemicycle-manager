<script lang="ts">
	/**
	 * Display a rank as either a medal (top 50 %) or a #X/Y badge.
	 *
	 * Tier breakdown:
	 *  - top 10 % → 🥇 gold
	 *  - top 25 % → 🥈 silver
	 *  - top 50 % → 🥉 bronze
	 *  - reste     → "#X/Y" en gris
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

	const config = $derived(
		{
			gold: { medal: '🥇', cls: 'text-amber-300 bg-amber-400/15 border border-amber-400/40' },
			silver: { medal: '🥈', cls: 'text-fg bg-surface-2 border border-border-soft' },
			bronze: { medal: '🥉', cls: 'text-orange-300 bg-orange-700/15 border border-orange-700/40' },
			plain: { medal: '', cls: 'text-fg-muted bg-border-soft/30' },
			na: { medal: '', cls: 'text-fg-muted/50' }
		}[tier]
	);

	const textSize = $derived(size === 'xs' ? 'text-[9px] px-1' : 'text-[10px] px-1.5');
</script>

{#if rank === null}
	<span class="{textSize} {config.cls} rounded font-medium tabular-nums whitespace-nowrap">N/A</span>
{:else if tier === 'plain'}
	<span class="{textSize} {config.cls} rounded font-medium tabular-nums whitespace-nowrap" title="Rang {rank} sur {total}">
		#{rank}/{total}
	</span>
{:else}
	<span
		class="{textSize} {config.cls} rounded font-bold tabular-nums whitespace-nowrap inline-flex items-center gap-0.5"
		title="Rang {rank} sur {total}"
	>
		<span class="-ml-0.5">{config.medal}</span>
		<span>#{rank}</span>
	</span>
{/if}
