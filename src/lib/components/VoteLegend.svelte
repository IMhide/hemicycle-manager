<script lang="ts">
	import { VOTE_COLORS } from '$lib/hemicycle';

	interface Props {
		pour: number;
		contre: number;
		abstention: number;
		total?: number;
	}

	let { pour, contre, abstention, total = 577 }: Props = $props();

	const items = $derived([
		{ label: 'Pour', count: pour, color: VOTE_COLORS.pour },
		{ label: 'Contre', count: contre, color: VOTE_COLORS.contre },
		{ label: 'Abstention', count: abstention, color: VOTE_COLORS.abstention },
		{ label: 'Absents', count: total - pour - contre - abstention, color: VOTE_COLORS.absent }
	]);
</script>

<div class="flex flex-wrap items-center justify-center gap-4 sm:gap-6">
	{#each items as item}
		<div class="flex items-center gap-2 text-sm">
			<span class="w-3 h-3 rounded-full" style="background-color: {item.color}"></span>
			<span class="font-medium">{item.label}</span>
			<span class="title-display text-lg text-assembly-accent">{item.count}</span>
		</div>
	{/each}
</div>
