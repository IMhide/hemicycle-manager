<script lang="ts">
	/**
	 * Compact FIFA-style card shown on hover. Mirrors DeputeCard's visual
	 * language but small enough to float next to the cursor.
	 */
	import type { Depute, Groupe, DeputeStats } from '$lib/types';
	import Rank from './Rank.svelte';

	interface Props {
		depute: Depute;
		groupe: Groupe | null;
		stats: DeputeStats;
		total?: number;
	}

	let { depute, groupe, stats, total = 577 }: Props = $props();

	const overall = $derived(
		Math.round(
			(stats.tauxPresence * 0.3 +
				stats.tauxParticipation * 0.2 +
				(stats.tauxLoyaute ?? 0) * 0.3 +
				Math.min(1, stats.activite / 3000) * 0.2) *
				99
		)
	);

	function pct(n: number | null): string {
		return n === null ? 'N/A' : `${Math.round(n * 100)} %`;
	}
</script>

<div
	class="card p-3 shadow-2xl"
	style="background: radial-gradient(circle at 20% 0%, {groupe?.couleur ?? '#475569'}33 0%, transparent 60%), linear-gradient(180deg, #1e293b, #0f172a); border-color: {groupe?.couleur ?? '#475569'}55; min-width: 260px;"
>
	<!-- Top row: photo + identity + overall -->
	<div class="flex items-start gap-3">
		<img
			src={depute.photoUrl}
			alt=""
			class="w-16 h-20 object-cover rounded border border-assembly-border bg-assembly-border flex-shrink-0"
			loading="lazy"
			referrerpolicy="no-referrer"
		/>
		<div class="min-w-0 flex-1">
			<div class="flex items-baseline justify-between gap-2">
				<div class="title-display text-xl leading-none" style="color: {groupe?.couleur ?? '#fbbf24'}">
					{overall}
				</div>
				{#if groupe}
					<div class="flex items-center gap-1 text-[10px]">
						<span class="w-1.5 h-1.5 rounded-full" style="background-color: {groupe.couleur}"></span>
						<span class="font-semibold">{groupe.libelleAbrege}</span>
					</div>
				{/if}
			</div>
			<div class="mt-1">
				<div class="text-[10px] uppercase tracking-widest text-assembly-muted">{depute.civ ?? ''}</div>
				<div class="title-display text-sm leading-tight">{depute.prenom}</div>
				<div class="title-display text-base leading-tight">{depute.nom}</div>
			</div>
			{#if depute.circo}
				<div class="text-[10px] text-assembly-muted mt-1">
					{depute.circo.dep} · {depute.circo.depNum}-{depute.circo.num}
				</div>
			{/if}
		</div>
	</div>

	<!-- Stats grid -->
	<div class="grid grid-cols-3 gap-2 mt-3 pt-2 border-t border-assembly-border/40 text-center">
		<div>
			<div class="text-[9px] uppercase text-assembly-muted">Présence</div>
			<div class="title-display text-base text-blue-400 leading-tight tabular-nums">
				{pct(stats.tauxPresence)}
			</div>
			<div class="mt-0.5">
				<Rank rank={stats.rangs.presence} {total} size="xs" />
			</div>
		</div>
		<div>
			<div class="text-[9px] uppercase text-assembly-muted">Loyauté</div>
			<div class="title-display text-base text-emerald-400 leading-tight tabular-nums">
				{pct(stats.tauxLoyaute)}
			</div>
			<div class="mt-0.5">
				<Rank rank={stats.rangs.loyaute} {total} size="xs" />
			</div>
		</div>
		<div>
			<div class="text-[9px] uppercase text-assembly-muted">Frondes</div>
			<div class="title-display text-base text-rose-400 leading-tight tabular-nums">
				{stats.frondes}
			</div>
			<div class="mt-0.5">
				<Rank rank={stats.rangs.frondes} {total} size="xs" />
			</div>
		</div>
	</div>

	<!-- Hint -->
	<div class="text-[9px] text-assembly-muted text-center mt-2 italic">
		Cliquez pour voir la fiche complète
	</div>
</div>
