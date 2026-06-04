<script lang="ts">
	/**
	 * Timeline de carrière politique d'un élu — appartenances de groupe.
	 *
	 * Trois modes via prop `mode` :
	 *   - `carriere` : fusion AN + Sénat, ordre chronologique ascendant. Section
	 *     par législature (AN) ou triennat (Sénat), repérée par un badge couleur.
	 *   - `an-mandat` : appartenances du mandat AN actif (filtré par législature).
	 *   - `senat-mandat` : appartenances du mandat Sénat actif (filtré par triennat).
	 *
	 * Reproduit fonctionnellement la timeline historique de l'ancienne fiche
	 * `/assemblee/deputes/[id]/` (cf ADR 0016) en l'étendant cross-chambre
	 * (cf ADR 0030, 0032).
	 */
	import type { Personne, Senateur, Mandat, MandatSenat, Groupe, GroupeSenat } from '$lib/types';

	type Mode =
		| { kind: 'carriere' }
		| { kind: 'an-mandat'; mandat: Mandat }
		| { kind: 'senat-mandat'; mandat: MandatSenat; triennat: string };

	interface Props {
		mode: Mode;
		personne: Personne | null;
		senateur: Senateur | null;
		groupesByIdAN: Map<string, Groupe>;
		/** Map `groupeCode` → liste des groupes Sénat (un par triennat). */
		groupesByCodeSenat: Map<string, GroupeSenat[]>;
	}

	let { mode, personne, senateur, groupesByIdAN, groupesByCodeSenat }: Props = $props();

	function formatDate(iso: string): string {
		return new Date(iso).toLocaleDateString('fr-FR', {
			day: '2-digit',
			month: 'short',
			year: 'numeric'
		});
	}

	/** Section de timeline = un mandat (AN ou Sénat) avec ses appartenances. */
	type TimelineSection =
		| {
				chambre: 'AN';
				legislature: number;
				dateDebut: string;
				dateFin: string | null;
				circonscription: string | null;
				appartenances: Array<{
					groupe: Groupe | null;
					qualite: string;
					dateDebut: string;
					dateFin: string | null;
					isTransitoireNI: boolean;
				}>;
		  }
		| {
				chambre: 'SENAT';
				triennat: string;
				dateDebut: string;
				dateFin: string | null;
				circonscription: string | null;
				appartenances: Array<{
					groupe: GroupeSenat | null;
					fonction: string;
					dateDebut: string;
					dateFin: string | null;
				}>;
		  };

	function buildANSection(m: Mandat): TimelineSection {
		const dep = m.circonscription;
		return {
			chambre: 'AN',
			legislature: m.legislature,
			dateDebut: m.datePriseFonction,
			dateFin: m.dateFinFonction,
			circonscription: dep ? `${dep.dep} (${dep.depNum}-${dep.num})` : null,
			appartenances: m.appartenancesGroupe.map((a) => ({
				groupe: groupesByIdAN.get(a.groupeId) ?? null,
				qualite: a.qualite,
				dateDebut: a.dateDebut,
				dateFin: a.dateFin,
				isTransitoireNI: a.isTransitoireNI
			}))
		};
	}

	function pickGroupeSenat(code: string, triennat: string): GroupeSenat | null {
		const candidats = groupesByCodeSenat.get(code);
		if (!candidats || candidats.length === 0) return null;
		return candidats.find((g) => g.triennat === triennat) ?? candidats[0];
	}

	function buildSenatSection(m: MandatSenat, triennat: string): TimelineSection {
		return {
			chambre: 'SENAT',
			triennat,
			dateDebut: m.datePriseFonction,
			dateFin: m.dateFinFonction,
			circonscription: m.circonscription,
			appartenances: m.appartenancesGroupe.map((a) => ({
				groupe: pickGroupeSenat(a.groupeCode, triennat),
				fonction: a.fonction,
				dateDebut: a.dateDebut,
				dateFin: a.dateFin
			}))
		};
	}

	const sections = $derived.by((): TimelineSection[] => {
		if (mode.kind === 'an-mandat') return [buildANSection(mode.mandat)];
		if (mode.kind === 'senat-mandat')
			return [buildSenatSection(mode.mandat, mode.triennat)];
		// Carrière fusionnée : tous les mandats AN + une section par triennat Sénat
		const out: TimelineSection[] = [];
		if (personne) {
			for (const m of [...personne.mandats].sort((a, b) => a.legislature - b.legislature)) {
				out.push(buildANSection(m));
			}
		}
		if (senateur) {
			// Pour le Sénat, un mandat couvre potentiellement plusieurs triennats.
			// On émet une section par triennat, en associant le mandat qui le couvre
			// (le plus récent qui touche ce triennat — cf builder elus-manifest).
			const seen = new Set<string>();
			const triennatsOrdered = new Set<string>();
			for (const m of senateur.mandats) {
				for (const t of m.triennats) triennatsOrdered.add(t.triennat);
			}
			for (const triennat of [...triennatsOrdered].sort()) {
				if (seen.has(triennat)) continue;
				seen.add(triennat);
				let pick: MandatSenat | null = null;
				for (const m of senateur.mandats) {
					if (!m.triennats.some((t) => t.triennat === triennat)) continue;
					if (!pick || m.datePriseFonction > pick.datePriseFonction) pick = m;
				}
				if (pick) out.push(buildSenatSection(pick, triennat));
			}
		}
		// Tri chronologique ascendant par date de début.
		out.sort((a, b) => a.dateDebut.localeCompare(b.dateDebut));
		return out;
	});

	const showHeaderPerSection = $derived(mode.kind === 'carriere');
</script>

{#if sections.length > 0}
	<div class="card p-4 mt-3 text-xs">
		<div class="text-[10px] uppercase tracking-widest text-fg-muted mb-3">
			{#if mode.kind === 'an-mandat'}
				Appartenances de groupe — {mode.mandat.legislature}<sup>e</sup>
			{:else if mode.kind === 'senat-mandat'}
				Appartenances de groupe — Sénat {mode.triennat}
			{:else}
				Carrière politique
			{/if}
		</div>
		<div class="space-y-3">
			{#each sections as s, i (s.chambre + ':' + (s.chambre === 'AN' ? s.legislature : s.triennat) + ':' + i)}
				<div>
					{#if showHeaderPerSection}
						<div class="flex items-baseline justify-between gap-2 mb-1.5 pb-1 border-b border-border-soft/40">
							<div class="font-semibold flex items-center gap-1.5">
								{#if s.chambre === 'AN'}
									<span class="text-[10px] px-1.5 py-0.5 rounded bg-border-soft/40 text-fg-muted">
										AN
									</span>
									{s.legislature}<sup>e</sup> législature
								{:else}
									<span class="text-[10px] px-1.5 py-0.5 rounded bg-border-soft/40 text-fg-muted">
										Sénat
									</span>
									Triennat {s.triennat}
								{/if}
								{#if s.circonscription}
									<span class="text-[10px] text-fg-muted font-normal">
										· {s.circonscription}
									</span>
								{/if}
							</div>
							<span class="text-[10px] text-fg-muted whitespace-nowrap">
								{formatDate(s.dateDebut)} → {s.dateFin ? formatDate(s.dateFin) : 'en cours'}
							</span>
						</div>
					{/if}
					<div class="space-y-1.5">
						{#if s.chambre === 'AN'}
							{#each s.appartenances as a (a.dateDebut + ':' + (a.groupe?.id ?? 'unknown'))}
								<div class="flex items-center justify-between gap-2">
									<div class="flex items-center gap-1.5 min-w-0">
										{#if a.groupe}
											<span
												class="w-2 h-2 rounded-full flex-shrink-0"
												style="background-color: {a.groupe.couleur}"
											></span>
											<span class="font-medium truncate">{a.groupe.libelleAbrege}</span>
										{:else}
											<span class="text-fg-muted italic">Groupe inconnu</span>
										{/if}
										<span class="text-[10px] text-fg-muted">· {a.qualite}</span>
										{#if a.isTransitoireNI}
											<span
												class="text-[9px] text-fg-muted/70 italic"
												title="NI transitoire en début de législature, avant inscription au groupe"
												>(transitoire)</span
											>
										{/if}
									</div>
									<span class="text-[10px] text-fg-muted whitespace-nowrap">
										{formatDate(a.dateDebut)} → {a.dateFin ? formatDate(a.dateFin) : 'en cours'}
									</span>
								</div>
							{/each}
						{:else}
							{#each s.appartenances as a (a.dateDebut + ':' + (a.groupe?.code ?? 'unknown'))}
								<div class="flex items-center justify-between gap-2">
									<div class="flex items-center gap-1.5 min-w-0">
										{#if a.groupe}
											<span
												class="w-2 h-2 rounded-full flex-shrink-0"
												style="background-color: {a.groupe.couleur}"
											></span>
											<span class="font-medium truncate">{a.groupe.libelleAbrege}</span>
										{:else}
											<span class="text-fg-muted italic">Groupe inconnu</span>
										{/if}
										<span class="text-[10px] text-fg-muted">· {a.fonction}</span>
									</div>
									<span class="text-[10px] text-fg-muted whitespace-nowrap">
										{formatDate(a.dateDebut)} → {a.dateFin ? formatDate(a.dateFin) : 'en cours'}
									</span>
								</div>
							{/each}
						{/if}
					</div>
				</div>
			{/each}
		</div>
	</div>
{/if}
