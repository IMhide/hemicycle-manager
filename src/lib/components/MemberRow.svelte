<script lang="ts">
	/**
	 * Ligne compacte d'un député dans une liste (top loyalistes, frondeurs, etc.).
	 * Modèle Phase 1 : reçoit `Personne` + `Mandat | null` (cf ADR 0015, 0017).
	 */
	import type { Personne, Mandat } from '$lib/types';

	interface Props {
		personne: Personne;
		/** Mandat scopant les stats. Si null : vue carrière (cumul pondéré). */
		mandat: Mandat | null;
		highlight?: 'loyaute' | 'frondes' | 'presence' | null;
		isPresident?: boolean;
	}

	let { personne, mandat, highlight = null, isPresident = false }: Props = $props();

	const stats = $derived(mandat ? mandat.stats : personne.carriere);
	const circo = $derived(mandat?.circonscription ?? personne.mandats.at(-1)?.circonscription ?? null);
	const href = $derived(mandat ? `/deputes/${personne.id}/?leg=${mandat.legislature}` : `/deputes/${personne.id}/`);

	function pct(n: number | null): string {
		if (n === null) return 'N/A';
		return `${Math.round(n * 100)} %`;
	}
</script>

<a
	{href}
	class="card p-3 flex items-center gap-3 hover:border-assembly-accent/60 transition-colors"
>
	<img
		src={personne.identite.photoUrl}
		alt=""
		class="w-10 h-10 rounded-full object-cover bg-assembly-border flex-shrink-0"
		loading="lazy"
		referrerpolicy="no-referrer"
	/>
	<div class="min-w-0 flex-1">
		<div class="text-sm font-semibold truncate flex items-center gap-1.5">
			{personne.identite.prenom} {personne.identite.nom}
			{#if isPresident}
				<span
					class="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-400/20 text-amber-300 border border-amber-400/30"
					title="Président du groupe"
				>
					⭐ Président
				</span>
			{/if}
		</div>
		{#if circo}
			<div class="text-[10px] text-assembly-muted">
				{circo.dep} ({circo.depNum}-{circo.num})
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
				{pct(stats.presence.rate)}
			</div>
			<div class="text-[9px] text-assembly-muted uppercase">Prés.</div>
		</div>
		<div>
			<div
				class="title-display text-base tabular-nums {highlight === 'loyaute'
					? 'text-emerald-400'
					: ''}"
			>
				{pct(stats.loyaute.rate)}
			</div>
			<div class="text-[9px] text-assembly-muted uppercase">Loy.</div>
		</div>
		<div>
			<div
				class="title-display text-base tabular-nums {highlight === 'frondes'
					? 'text-rose-400'
					: ''}"
			>
				{stats.frondes.count}
			</div>
			<div class="text-[9px] text-assembly-muted uppercase">Frd.</div>
		</div>
	</div>
</a>
