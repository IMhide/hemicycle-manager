<script lang="ts">
	/**
	 * Carte d'un frondeur sur la page scrutin Sénat (cf ADR 0023..0027).
	 */
	import type { Senateur, GroupeSenat, VotePosition } from '$lib/types';
	import {
		lookupEluUrlForMatriculeTriennat,
		lookupEluUrlCarriereForMatricule
	} from '$lib/elus';

	interface Props {
		senateur: Senateur;
		groupe: GroupeSenat | null;
		position: VotePosition;
		positionMajoritaireGroupe: string;
		/** Triennat du scrutin — sert à pointer le bon onglet sur la fiche Élu. */
		triennat?: string;
	}

	let {
		senateur,
		groupe,
		position,
		positionMajoritaireGroupe,
		triennat
	}: Props = $props();

	const positionColor = $derived(position === 'pour' ? '#22c55e' : '#ef4444');
	const majColor = $derived(positionMajoritaireGroupe === 'pour' ? '#22c55e' : '#ef4444');
	const href = $derived(
		triennat !== undefined
			? lookupEluUrlForMatriculeTriennat(senateur.id, triennat) ?? '/elus/'
			: lookupEluUrlCarriereForMatricule(senateur.id) ?? '/elus/'
	);
</script>

<a
	{href}
	class="card p-3 flex items-center gap-3 hover:border-accent/60 transition-colors"
>
	<img
		src={senateur.identite.photoUrl}
		alt=""
		class="w-12 h-12 rounded-full object-cover bg-border-soft flex-shrink-0"
		loading="lazy"
		referrerpolicy="no-referrer"
	/>
	<div class="min-w-0 flex-1">
		<div class="font-semibold truncate">
			{senateur.identite.prenom}
			{senateur.identite.nom}
		</div>
		{#if groupe}
			<div class="flex items-center gap-1.5 text-xs text-fg-muted">
				<span class="w-2 h-2 rounded-full" style="background-color: {groupe.couleur}"></span>
				<span>{groupe.libelleAbrege}</span>
			</div>
		{/if}
	</div>
	<div class="flex flex-col items-end gap-0.5 text-[10px] flex-shrink-0">
		<span class="title-display text-sm" style="color: {positionColor}">
			A voté {position}
		</span>
		<span class="text-fg-muted">
			groupe : <span style="color: {majColor}">{positionMajoritaireGroupe}</span>
		</span>
	</div>
</a>
