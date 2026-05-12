<script lang="ts">
	/**
	 * Bandeau chronologique navette parlementaire (N3.d, cf ADR 0036).
	 *
	 * Affiche 5 jalons principaux du parcours d'un texte législatif :
	 *  1. Dépôt initial
	 *  2. 1ère lecture AN
	 *  3. 1ère lecture Sénat
	 *  4. CMP / lecture définitive (si présent)
	 *  5. Promulgation (si présent)
	 *
	 * Les jalons sont placés sur une frise horizontale (desktop) ou verticale
	 * (mobile via flex-wrap). Les dates sont prises des `dateDebut` AN/Sénat et
	 * `datePromulgation` du TexteUnifie.
	 *
	 * Limitation connue (cf ADR 0036) : on ne détecte pas automatiquement les
	 * 2ᵉ/nouvelle lecture, CMP, etc. Pour la v1 N3.d on se contente des jalons
	 * principaux.
	 */
	import type { TexteUnifie } from '$lib/types';

	let { texte }: { texte: TexteUnifie } = $props();

	function formatDate(iso: string | null): string {
		if (!iso) return '';
		return new Date(iso).toLocaleDateString('fr-FR', {
			day: 'numeric',
			month: 'short',
			year: 'numeric'
		});
	}

	interface Jalon {
		label: string;
		date: string | null;
		chambre: 'AN' | 'SEN' | 'JO' | 'NONE';
		statut: 'past' | 'current' | 'future';
	}

	const jalons = $derived.by<Jalon[]>(() => {
		const out: Jalon[] = [];
		// Dépôt initial = min des dateDebut
		out.push({
			label: 'Dépôt',
			date: texte.dateDebut,
			chambre: 'NONE',
			statut: 'past'
		});
		// 1ère lecture AN
		out.push({
			label: '1ʳᵉ lecture AN',
			date: texte.an?.dateDebut ?? null,
			chambre: 'AN',
			statut: texte.an ? 'past' : 'future'
		});
		// 1ère lecture Sénat
		out.push({
			label: '1ʳᵉ lecture Sénat',
			date: texte.senat?.dateDebut ?? null,
			chambre: 'SEN',
			statut: texte.senat ? 'past' : 'future'
		});
		// CMP/lect.défin. : si bicaméral, on regarde si dateFin > 1ère lecture des deux
		if (texte.bicameral && texte.an && texte.senat) {
			const finMax = texte.an.dateFin > texte.senat.dateFin ? texte.an.dateFin : texte.senat.dateFin;
			const debutMin = texte.an.dateDebut < texte.senat.dateDebut ? texte.an.dateDebut : texte.senat.dateDebut;
			// Si la phase couvre plus que 30 jours, on suppose qu'il y a eu navette/CMP
			const diffDays =
				(new Date(finMax).getTime() - new Date(debutMin).getTime()) / 86400000;
			if (diffDays > 30) {
				out.push({
					label: 'Navette / CMP',
					date: finMax,
					chambre: 'NONE',
					statut: 'past'
				});
			}
		}
		// Promulgation
		out.push({
			label: 'Promulgation',
			date: texte.datePromulgation,
			chambre: 'JO',
			statut: texte.datePromulgation ? 'past' : 'future'
		});
		return out;
	});

	function chambreClass(c: Jalon['chambre'], statut: Jalon['statut']): string {
		if (statut === 'future') return 'bg-assembly-border/30 text-assembly-muted/60 border-assembly-border/30';
		if (c === 'AN') return 'bg-blue-500/15 text-blue-300 border-blue-500/40';
		if (c === 'SEN') return 'bg-red-500/15 text-red-300 border-red-500/40';
		if (c === 'JO') return 'bg-vote-pour/15 text-vote-pour border-vote-pour/40';
		return 'bg-assembly-border/50 text-assembly-fg border-assembly-border';
	}
</script>

<div class="card p-4">
	<div class="text-xs uppercase tracking-widest text-assembly-muted mb-3">
		Parcours navette parlementaire
	</div>
	<div class="flex flex-wrap items-stretch gap-2 sm:gap-0">
		{#each jalons as j, i}
			<div class="flex items-stretch flex-1 min-w-[120px]">
				<div
					class="flex-1 rounded-md border px-3 py-2 text-center {chambreClass(j.chambre, j.statut)}"
				>
					<div class="text-[10px] uppercase tracking-wider opacity-80">{j.label}</div>
					{#if j.date}
						<div class="text-xs font-medium mt-0.5">{formatDate(j.date)}</div>
					{:else}
						<div class="text-xs italic opacity-60 mt-0.5">—</div>
					{/if}
				</div>
				{#if i < jalons.length - 1}
					<div class="hidden sm:flex items-center px-1 text-assembly-muted/40">→</div>
				{/if}
			</div>
		{/each}
	</div>
</div>
