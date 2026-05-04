<script lang="ts">
	import type { Badge } from '$lib/badges';

	interface Props {
		badge: Badge;
	}

	let { badge }: Props = $props();

	const tierStyle = $derived(
		{
			gold: 'border-amber-400/60 bg-amber-400/10 text-amber-200',
			silver: 'border-slate-400/60 bg-slate-400/10 text-slate-200',
			bronze: 'border-orange-700/60 bg-orange-700/15 text-orange-300',
			special: 'border-rose-400/60 bg-rose-400/10 text-rose-200'
		}[badge.tier]
	);
</script>

<div
	class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-xs {tierStyle}"
	title={badge.description}
>
	<span aria-hidden="true">{badge.emoji}</span>
	<span class="font-semibold whitespace-nowrap">{badge.label}</span>
</div>
