<script lang="ts">
	/**
	 * Carte d'un frondeur sur la page scrutin.
	 * Modèle Phase 1 (cf ADR 0015, 0016) : reçoit la `Personne` + son groupe
	 * **au moment du vote**.
	 */
	import type { Personne, Groupe, VotePosition } from '$lib/types';

	interface Props {
		personne: Personne;
		/** Groupe d'appartenance au moment du vote (cf ADR 0016). */
		groupe: Groupe | null;
		position: VotePosition;
		positionMajoritaireGroupe: string;
	}

	let { personne, groupe, position, positionMajoritaireGroupe }: Props = $props();

	const positionColor = $derived(position === 'pour' ? '#22c55e' : '#ef4444');
	const majColor = $derived(positionMajoritaireGroupe === 'pour' ? '#22c55e' : '#ef4444');
</script>

<a
	href="/deputes/{personne.id}/"
	class="card p-3 flex items-center gap-3 hover:border-assembly-accent/60 transition-colors"
>
	<img
		src={personne.identite.photoUrl}
		alt=""
		class="w-12 h-12 rounded-full object-cover bg-assembly-border flex-shrink-0"
		loading="lazy"
		referrerpolicy="no-referrer"
	/>
	<div class="min-w-0 flex-1">
		<div class="font-semibold truncate">{personne.identite.prenom} {personne.identite.nom}</div>
		{#if groupe}
			<div class="flex items-center gap-1.5 text-xs text-assembly-muted">
				<span class="w-2 h-2 rounded-full" style="background-color: {groupe.couleur}"></span>
				<span>{groupe.libelleAbrege}</span>
			</div>
		{/if}
	</div>
	<div class="flex flex-col items-end gap-0.5 text-[10px] flex-shrink-0">
		<span class="title-display text-sm" style="color: {positionColor}">
			A voté {position}
		</span>
		<span class="text-assembly-muted">
			groupe : <span style="color: {majColor}">{positionMajoritaireGroupe}</span>
		</span>
	</div>
</a>
