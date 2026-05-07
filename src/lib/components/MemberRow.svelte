<script lang="ts">
	/**
	 * Ligne compacte d'un député dans une liste (top loyalistes, frondeurs, etc.).
	 * Modèle Phase 1 : reçoit `Personne` + `Mandat | null` (cf ADR 0015, 0017).
	 *
	 * Le groupe (chip couleur + libellé court) est passé en prop optionnelle pour
	 * éviter au composant de connaître `data.groupes`. Caller résout via son
	 * propre helper `groupePrincipal(personne, mandat)`. Sur les pages groupe
	 * (où l'info est redondante), passer `groupe={null}`.
	 */
	import type { Personne, Mandat } from '$lib/types';
	import { lookupEluUrlForPaIdLeg, lookupEluUrlCarriereForPaId } from '$lib/elus';

	interface GroupeChip {
		libelleAbrege: string;
		couleur: string;
	}

	interface Props {
		personne: Personne;
		/** Mandat scopant les stats. Si null : vue carrière (cumul pondéré). */
		mandat: Mandat | null;
		highlight?: 'loyaute' | 'frondes' | 'presence' | null;
		isPresident?: boolean;
		/** Groupe principal à afficher en chip (passé par le caller). Null = pas affiché. */
		groupe?: GroupeChip | null;
	}

	let {
		personne,
		mandat,
		highlight = null,
		isPresident = false,
		groupe = null
	}: Props = $props();

	const stats = $derived(mandat ? mandat.stats : personne.carriere);
	const circo = $derived(mandat?.circonscription ?? personne.mandats.at(-1)?.circonscription ?? null);
	// Lien vers la fiche Élu (cf ADR 0030) — fallback `/elus/` si manifest
	// non chargé (CI placeholder ou orphelin).
	const href = $derived(
		mandat
			? lookupEluUrlForPaIdLeg(personne.id, mandat.legislature) ?? '/elus/'
			: lookupEluUrlCarriereForPaId(personne.id) ?? '/elus/'
	);

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
		<div class="flex items-center gap-1.5 mt-0.5 flex-wrap text-[10px] text-assembly-muted">
			{#if groupe}
				<span
					class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-assembly-border/40"
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
				<span class="truncate">{circo.dep} ({circo.depNum}-{circo.num})</span>
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
