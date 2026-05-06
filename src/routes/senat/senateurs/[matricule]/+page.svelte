<script lang="ts">
	/**
	 * Fiche détail d'un sénateur (stub PR B — version complète en PR C).
	 *
	 * Cette page rend la SenateurCard avec les tabs de sessions et le résumé
	 * historique. Le détail vote-par-vote arrive en PR C.
	 */
	import SenateurCard from '$lib/components/SenateurCard.svelte';
	import SessionTabs from '$lib/components/SessionTabs.svelte';
	import { goto } from '$app/navigation';
	import type { GroupeSenat } from '$lib/types';

	let { data } = $props();

	const groupesByCode = $derived.by(() => {
		const m = new Map<string, GroupeSenat[]>();
		for (const g of data.groupes) {
			const arr = m.get(g.code) ?? [];
			arr.push(g);
			m.set(g.code, arr);
		}
		return m;
	});

	function pickGroupe(): GroupeSenat | null {
		const target = data.sessionScope;
		const lastM = data.senateur.mandats.at(-1);
		const lastApp = lastM?.appartenancesGroupe.at(-1);
		if (!lastApp) return null;
		const candidats = groupesByCode.get(lastApp.groupeCode);
		if (!candidats || candidats.length === 0) return null;
		if (target !== null) {
			const exact = candidats.find((g) => g.sesann === target);
			if (exact) return exact;
		}
		return [...candidats].sort((a, b) => b.sesann - a.sesann)[0];
	}

	const groupe = $derived(pickGroupe());

	function selectSession(sesann: number | null) {
		const url = sesann === null
			? `/senat/senateurs/${data.senateur.id}/`
			: `/senat/senateurs/${data.senateur.id}/?session=${sesann}`;
		goto(url, { replaceState: false, keepFocus: true });
	}

	const nbScrutinsHistorique = $derived(data.historique.length);
</script>

<svelte:head>
	<title>{data.senateur.identite.prenom} {data.senateur.identite.nom} — Sénat — PolitiDex</title>
</svelte:head>

<section class="max-w-5xl mx-auto px-6 py-8">
	<div class="mb-4">
		<a href="/senat/senateurs/" class="text-xs text-assembly-muted hover:text-assembly-accent">
			← Retour à la liste des sénateurs
		</a>
	</div>

	<div class="mb-4">
		<SessionTabs senateur={data.senateur} selected={data.sessionScope} onSelect={selectSession} />
	</div>

	<div class="grid grid-cols-1 lg:grid-cols-[400px_1fr] gap-6 items-start">
		<SenateurCard senateur={data.senateur} {groupe} sesann={data.sessionScope} />

		<div class="card p-5 text-sm space-y-4">
			<div>
				<h2 class="title-display text-lg mb-2">Mandats</h2>
				<ul class="space-y-2">
					{#each data.senateur.mandats as m, i (m.eluId)}
						<li class="border-l-2 border-assembly-border/50 pl-3">
							<div class="text-xs text-assembly-muted">
								Mandat {i + 1}
								{#if m.motifDebut}<span> · {m.motifDebut}</span>{/if}
							</div>
							<div class="font-medium">
								{m.datePriseFonction.slice(0, 10)} →
								{m.dateFinFonction ? m.dateFinFonction.slice(0, 10) : 'en cours'}
							</div>
							{#if m.circonscription}
								<div class="text-xs text-assembly-muted">{m.circonscription}</div>
							{/if}
							{#if m.place}
								<div class="text-xs text-assembly-muted">
									Siège {m.place} · Série {m.serie}
								</div>
							{/if}
							<div class="text-[10px] text-assembly-muted mt-1">
								{m.sessions.length} session{m.sessions.length > 1 ? 's' : ''} couverte{m.sessions.length >
								1
									? 's'
									: ''}
							</div>
						</li>
					{/each}
				</ul>
			</div>

			<div class="border-t border-assembly-border/50 pt-3">
				<h2 class="title-display text-lg mb-2">Historique de vote</h2>
				<p class="text-xs text-assembly-muted">
					{nbScrutinsHistorique} scrutin{nbScrutinsHistorique > 1 ? 's' : ''} dans l'historique.
					L'affichage détaillé arrive en PR C.
				</p>
			</div>
		</div>
	</div>
</section>
