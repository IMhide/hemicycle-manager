<script lang="ts">
	/**
	 * Fiche détail d'un groupe Sénat pour une session donnée
	 * (stub PR B — version complète en PR C avec hémicycle highlight).
	 */
	let { data } = $props();

	const membres = $derived.by(() => {
		const out: typeof data.senateurs = [];
		for (const s of data.senateurs) {
			for (const m of s.mandats) {
				if (!m.sessions.some((sess) => sess.sesann === data.sesann)) continue;
				const lastApp = m.appartenancesGroupe.at(-1);
				if (lastApp?.groupeCode === data.groupe.code) {
					out.push(s);
					break;
				}
			}
		}
		return out.sort((a, b) =>
			a.identite.nom.localeCompare(b.identite.nom)
		);
	});

	function libelleSession(sesann: number): string {
		return `${sesann}-${(sesann + 1).toString().slice(-2)}`;
	}
</script>

<svelte:head>
	<title>{data.groupe.libelleAbrege} — Sénat — PolitiDex</title>
</svelte:head>

<section class="max-w-5xl mx-auto px-6 py-8">
	<div class="mb-4">
		<a
			href="/senat/sessions/{data.sesann}/"
			class="text-xs text-assembly-muted hover:text-assembly-accent"
		>
			← Retour à la session {libelleSession(data.sesann)}
		</a>
	</div>

	<div
		class="card p-6 mb-6"
		style="border-left: 4px solid {data.groupe.couleur}"
	>
		<div class="text-xs text-assembly-muted mb-1">
			Session {libelleSession(data.sesann)} · {data.groupe.libelleAbrege}
		</div>
		<h1 class="title-display text-2xl mb-3" style="color: {data.groupe.couleur}">
			{data.groupe.libelle}
		</h1>
		<div class="grid grid-cols-3 gap-4 text-sm mt-4">
			<div>
				<div class="title-display text-xl">{data.groupe.effectifFin}</div>
				<div class="text-xs text-assembly-muted">Sénateurs</div>
			</div>
			<div>
				<div class="title-display text-xl">{data.groupe.overallMoyen}</div>
				<div class="text-xs text-assembly-muted">Overall moyen</div>
			</div>
			<div>
				<div class="title-display text-xl">{data.groupe.preseance}</div>
				<div class="text-xs text-assembly-muted">Préséance</div>
			</div>
		</div>
	</div>

	<div class="card p-5">
		<h2 class="title-display text-lg mb-3">Membres ({membres.length})</h2>
		<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
			{#each membres as s (s.id)}
				<a
					href="/senat/senateurs/{s.id}/?session={data.sesann}"
					class="card p-2 flex items-center gap-2 hover:border-assembly-accent/60 transition-colors"
				>
					<img
						src={s.identite.photoUrl}
						alt=""
						class="w-8 h-8 rounded-full object-cover bg-assembly-border flex-shrink-0"
						loading="lazy"
						referrerpolicy="no-referrer"
					/>
					<div class="text-xs truncate">
						<div class="font-semibold truncate">
							{s.identite.prenom} {s.identite.nom}
						</div>
					</div>
				</a>
			{/each}
		</div>
		<div class="mt-4 text-[10px] text-assembly-muted italic">
			L'hémicycle interactif scopé sur ce groupe arrive en PR C.
		</div>
	</div>
</section>
