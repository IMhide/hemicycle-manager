<script lang="ts">
	/**
	 * Ligne compacte d'un sénateur dans une liste (équivalent MemberRow côté Sénat).
	 * Modèle Phase 3 (cf ADR 0023..0028) : reçoit `Senateur` + `TriennatStats | null` + `MandatSenat | null`.
	 *
	 * Groupe en prop optionnelle (caller résout via `groupePrincipal`).
	 */
	import type { Senateur, MandatSenat, TriennatStats } from '$lib/types';
	import {
		lookupEluUrlForMatriculeTriennat,
		lookupEluUrlCarriereForMatricule
	} from '$lib/elus';

	interface GroupeChip {
		libelleAbrege: string;
		couleur: string;
	}

	interface Props {
		senateur: Senateur;
		mandat: MandatSenat | null;
		triennat: TriennatStats | null;
		highlight?: 'loyaute' | 'frondes' | 'presence' | null;
		isPresident?: boolean;
		groupe?: GroupeChip | null;
	}

	let {
		senateur,
		mandat,
		triennat,
		highlight = null,
		isPresident = false,
		groupe = null
	}: Props = $props();

	const stats = $derived(triennat ? triennat.stats : senateur.carriere);
	const circo = $derived(mandat?.circonscription ?? senateur.mandats.at(-1)?.circonscription ?? null);
	const href = $derived(
		triennat
			? lookupEluUrlForMatriculeTriennat(senateur.id, triennat.triennat) ?? '/elus/'
			: lookupEluUrlCarriereForMatricule(senateur.id) ?? '/elus/'
	);

	function pct(n: number | null): string {
		if (n === null) return 'N/A';
		return `${Math.round(n * 100)} %`;
	}
</script>

<a
	{href}
	class="card p-3 flex items-center gap-3 hover:border-accent/60 transition-colors"
>
	<img
		src={senateur.identite.photoUrl}
		alt=""
		class="w-10 h-10 rounded-full object-cover bg-border-soft flex-shrink-0"
		loading="lazy"
		referrerpolicy="no-referrer"
	/>
	<div class="min-w-0 flex-1">
		<div class="text-sm font-semibold truncate flex items-center gap-1.5">
			{senateur.identite.prenom} {senateur.identite.nom}
			{#if senateur.identite.etat === 'ANCIEN'}
				<span
					class="text-[10px] px-1.5 py-0.5 rounded bg-border-soft/40 text-fg-muted"
					title="Ancien·ne sénateur·rice"
				>
					ancien
				</span>
			{/if}
			{#if isPresident}
				<span
					class="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-400/20 text-amber-300 border border-amber-400/30"
					title="Président·e du groupe"
				>
					⭐ Président
				</span>
			{/if}
		</div>
		<div class="flex items-center gap-1.5 mt-0.5 flex-wrap text-[10px] text-fg-muted">
			{#if groupe}
				<span
					class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-border-soft/40"
					title={groupe.libelleAbrege}
				>
					<span
						class="w-1.5 h-1.5 rounded-full flex-shrink-0"
						style="background-color: {groupe.couleur}"
					></span>
					<span class="truncate max-w-[10rem]">{groupe.libelleAbrege}</span>
				</span>
			{/if}
			{#if circo}
				<span class="truncate">{circo}</span>
			{/if}
		</div>
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
			<div class="text-[9px] text-fg-muted uppercase">Prés.</div>
		</div>
		<div>
			<div
				class="title-display text-base tabular-nums {highlight === 'loyaute'
					? 'text-emerald-400'
					: ''}"
			>
				{pct(stats.loyaute.rate)}
			</div>
			<div class="text-[9px] text-fg-muted uppercase">Loy.</div>
		</div>
		<div>
			<div
				class="title-display text-base tabular-nums {highlight === 'frondes'
					? 'text-rose-400'
					: ''}"
			>
				{stats.frondes.count}
			</div>
			<div class="text-[9px] text-fg-muted uppercase">Frd.</div>
		</div>
	</div>
</a>
