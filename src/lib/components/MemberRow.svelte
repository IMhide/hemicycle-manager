<script lang="ts">
	import type { Depute, DeputeStats } from '$lib/types';

	interface Props {
		depute: Depute;
		stats: DeputeStats;
		highlight?: 'loyaute' | 'frondes' | 'presence' | null;
		isPresident?: boolean;
	}

	let { depute, stats, highlight = null, isPresident = false }: Props = $props();

	function pct(n: number | null): string {
		if (n === null) return 'N/A';
		return `${Math.round(n * 100)} %`;
	}
</script>

<a
	href="/deputes/{depute.id}/"
	class="card p-3 flex items-center gap-3 hover:border-assembly-accent/60 transition-colors"
>
	<img
		src={depute.photoUrl}
		alt=""
		class="w-10 h-10 rounded-full object-cover bg-assembly-border flex-shrink-0"
		loading="lazy"
		referrerpolicy="no-referrer"
	/>
	<div class="min-w-0 flex-1">
		<div class="text-sm font-semibold truncate flex items-center gap-1.5">
			{depute.prenom} {depute.nom}
			{#if isPresident}
				<span
					class="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-400/20 text-amber-300 border border-amber-400/30"
					title="Président du groupe"
				>
					⭐ Président
				</span>
			{/if}
		</div>
		{#if depute.circo}
			<div class="text-[10px] text-assembly-muted">
				{depute.circo.dep} ({depute.circo.depNum}-{depute.circo.num})
			</div>
		{/if}
	</div>
	<div class="grid grid-cols-3 gap-3 text-right text-xs flex-shrink-0">
		<div>
			<div
				class="title-display text-base tabular-nums {highlight === 'presence'
					? 'text-blue-400'
					: ''}"
			>
				{pct(stats.tauxPresence)}
			</div>
			<div class="text-[9px] text-assembly-muted uppercase">Prés.</div>
		</div>
		<div>
			<div
				class="title-display text-base tabular-nums {highlight === 'loyaute'
					? 'text-emerald-400'
					: ''}"
			>
				{pct(stats.tauxLoyaute)}
			</div>
			<div class="text-[9px] text-assembly-muted uppercase">Loy.</div>
		</div>
		<div>
			<div
				class="title-display text-base tabular-nums {highlight === 'frondes'
					? 'text-rose-400'
					: ''}"
			>
				{stats.frondes}
			</div>
			<div class="text-[9px] text-assembly-muted uppercase">Frd.</div>
		</div>
	</div>
</a>
