# 0037 — Timeline navette via `actesLegislatifs` du dump AN

**Date** : 2026-05-13
**Statut** : accepté
**Tags** : data, navette, timeline, ADR-companion-de-0036

## Contexte

Le jalon N3.d (ADR 0036) a établi la fiche unifiée `/textes/[id]` avec
un composant `TimelineNavette.svelte` qui affiche **5 jalons synthétiques**
(Dépôt, 1ʳᵉ lect AN, 1ʳᵉ lect Sénat, CMP, Promulgation) dérivés des
`dateDebut`/`dateFin` AN et Sénat.

Cette approximation est **insuffisante** :

1. **Détection bicaméralité incorrecte** : un texte n'est marqué bicaméral
   que si nos deux pipelines ont produit des scrutins nominaux dans les
   deux chambres. Or **74 textes promulgués (15 AN-seul + 59 Sénat-seul)**
   sont passés par les deux chambres dans la réalité (sinon ils n'auraient
   pas été promulgués) mais n'ont pas de scrutin nominal côté chambre
   opposée. Notre `bicameral` actuel sous-estime.

2. **Pas de visibilité sur la navette** : 2ᵉ lecture, nouvelle lecture
   après CMP, lecture définitive, recours au Conseil Constitutionnel,
   49.3, motion de censure — tout ça est invisible.

3. **Pas de distinction vote nominal / main levée** : un `SN1-DEBATS-DEC`
   sans scrutin nominal Sénat correspond à un vote à main levée, qui doit
   être affiché comme adopté/rejeté **avec mention**.

L'investigation du dump `Dossiers_Legislatifs.json` AN révèle un arbre
`actesLegislatifs` complet, riche et structuré qui contient **toute la
chronologie navette**, y compris les actes Sénat (`SN1-*`, `SN2-*`,
`CMP-*`, `CC-*`, `PROM-*`). Mesuré sur ~2000 dossiers 15-16-17ᵉ
législatures : **167 codes distincts**, dont 30 codes "remarquables".

## Décision

On définit un nouvel objet **`TimelineActe`** consommé par
`Texte.timelineNavette: TimelineActe[]` côté pipeline AN, et propagé
dans `TexteUnifie.timelineNavette` côté manifest cross-chambre.

Chaque acte représente **un événement chronologique** :

```ts
interface TimelineActe {
  date: string; // YYYY-MM-DD
  code: string; // AN1-DEBATS-DEC, SN1-DEBATS-DEC, CMP-DEC, PROM-PUB…
  chambre: 'AN' | 'SEN' | 'CMP' | 'CC' | 'GVT' | 'JO';
  phase: 'depot' | 'premiere-lecture' | 'deuxieme-lecture'
       | 'nouvelle-lecture' | 'lecture-definitive' | 'lecture-unique'
       | 'cmp' | 'conseil-constitutionnel' | 'promulgation'
       | '49.3' | 'motion-censure' | 'retrait';
  /** Libellé court lisible pour l'UI ("Vote en séance Sénat", "Promulgation"…). */
  label: string;
  /** Si l'acte correspond à un scrutin nominal connu, lien direct (AN ou Sénat).
   *  null si vote à main levée ou pas de scrutin nominal détecté. */
  scrutinUid: string | null;
  scrutinChambre: 'AN' | 'SEN' | null;
}
```

**Codes retenus** (filtrage de l'arbre `actesLegislatifs` AN) :

| Pattern | Phase | Label UI | Chambre |
|---|---|---|---|
| `AN1-DEPOT` / `SN1-DEPOT` | depot | "Dépôt à l'AN" / "Dépôt au Sénat" | AN / SEN |
| `AN1-DEBATS-DEC` / `SN1-DEBATS-DEC` | premiere-lecture | "1ʳᵉ lecture AN/Sénat" | AN / SEN |
| `AN2-DEBATS-DEC` / `SN2-DEBATS-DEC` | deuxieme-lecture | "2ᵉ lecture …" | AN / SEN |
| `ANLUNI-DEBATS-DEC` | lecture-unique | "Lecture unique AN" | AN |
| `ANNLEC-DEBATS-SEANCE` | nouvelle-lecture | "Nouvelle lecture AN" | AN |
| `ANLDEF-COM-FOND-REUNION` (rare) | lecture-definitive | "Lecture définitive AN" | AN |
| `CMP-DEPOT`, `CMP-DEC` | cmp | "Réunion CMP" / "Conclusion CMP" | CMP |
| `CMP-DEBATS-AN-DEC` / `CMP-DEBATS-SN-DEC` | cmp | "Vote CMP AN/Sénat" | AN / SEN |
| `CC-SAISIE-*`, `CC-CONCLUSION` | conseil-constitutionnel | "Saisine CC" / "Décision CC" | CC |
| `PROM-PUB` | promulgation | "Publication au JO" | JO |
| `AN21-MOTION-VOTE`, `ANNLEC-MOTION-VOTE`, `ANLDEF-MOTION-VOTE` | motion-censure | "Vote motion de censure" | AN |
| `AN21-DGVT`, `ANNLEC-DGVT`, `ANLDEF-DGVT` | 49.3 | "Engagement responsabilité (49.3)" | AN |
| `AN1-RTRINI`, `ANLUNI-RTRINI` | retrait | "Retiré par initiateur" | AN |

**Tous les autres codes** (procédure interne : `*-COM-FOND-SAISIE`,
`*-COM-FOND-NOMIN`, `*-COM-FOND-REUNION`, `*-COM-FOND-RAPPORT`,
`*-DEBATS-SEANCE`, `*-PROCACC`…) sont **ignorés pour la timeline UI**.
Ils restent dans le dump mais ne représentent pas des jalons publics.

**Bicaméralité refondue** : `TexteUnifie.bicameral` devient vrai si la
timeline contient au moins un acte `chambre === 'SEN'` (autre que `SN1-DEPOT`
isolé). Un texte promulgué avec uniquement scrutins AN ET un acte
`SN1-DEBATS-DEC` dans sa timeline = vrai bicaméral, même sans scrutin
nominal Sénat dans notre pipeline.

**Croisement avec scrutins nominaux** : pour chaque acte de type
`*-DEBATS-DEC` ou `CMP-DEBATS-*-DEC`, on cherche dans les
scrutins-index (AN ou Sénat selon `chambre`) un scrutin solennel à la
même date sur ce dossier. Si trouvé → `scrutinUid` rempli, l'utilisateur
clique pour voir le vote. Si non trouvé → vote à main levée, on affiche
juste la date et le résultat (à inférer depuis le code de l'acte
suivant : si `PROM-PUB` arrive, c'est adopté).

## Pourquoi

- **La source existe** : le dump AN expose tout l'arbre de la navette
  parlementaire. C'est la source d'autorité officielle Etalab. Ne pas
  l'exploiter serait s'auto-limiter.
- **Bicaméralité fiable** : 74 textes "promulgués mono-chambre"
  faussement classés deviennent correctement bicaméraux. Le badge "mono"
  côté UI ne s'affichera plus que pour les vrais cas (textes rejetés
  avant transmission, textes en cours non encore transmis).
- **Timeline narrative** : Football Manager / Pokédex → on raconte le
  parcours politique d'un texte (dépôt par X → adopté à 320/19 par AN →
  modifié au Sénat → CMP en accord → promulgué le …). C'est notre
  posture éditoriale.
- **Détection 49.3** : pertinent éditorialement (texte adopté sans vote
  à l'AN), gros sujet politique.
- **Filtrage codes "remarquables"** : 30 codes UI vs 167 codes bruts —
  l'arbre Etalab contient beaucoup de bruit administratif (commissions,
  rapports, nominations rapporteur) qui n'a pas sa place dans une
  timeline grand public.
- **`scrutinUid` optionnel** : élégant. Quand un vote nominal existe, on
  lie. Quand il n'existe pas, on affiche quand même l'événement (qui
  vient du dump AN). Plus de "vote invisible".

## Conséquences

- **Pipeline** :
  - `scripts/lib/dossiers-an.ts` étendu : extraction de la timeline
    structurée depuis `actesLegislatifs` (parser récursif + filtre codes
    retenus + projection en `TimelineActe[]`).
  - `Texte.timelineNavette: TimelineActe[]` ajouté côté type AN.
  - `scripts/build-cross-chambre.ts` : propagation dans `TexteUnifie`.
  - Croisement avec `scrutins-index.json` AN ET Sénat pour remplir
    `scrutinUid` quand possible.
- **UI** :
  - `TimelineNavette.svelte` refondu pour consommer la vraie timeline
    plutôt que les jalons synthétiques actuels.
  - Acte cliquable si `scrutinUid` non null.
  - Pictos différenciés (vote nominal / main levée / 49.3 / motion).
- **Données** :
  - `Texte.timelineNavette` ajoute ~5-10 actes/texte = ~5-10 KB par
    `textes.json` (961 textes), soit ~5 MB en plus dans le manifest.
    Acceptable.
  - `TexteUnifie.bicameral` recalculé → probable hausse de ~80-100
    textes bicaméraux supplémentaires.
- **Smoke-test** :
  - Cas canoniques : PJL Mayotte (timeline avec CMP, 2 votes solennels +
    promul), PJL approbation accord (timeline simple AN + Sénat à main
    levée).
  - Invariant : tout texte promulgué a un `PROM-PUB` en dernier acte.
  - Invariant : la timeline est ordonnée chronologiquement.
- **Limitations connues** :
  - On dépend du dump AN qui ne reflète bien que la navette **du point
    de vue AN**. Pour les textes purement sénatoriaux non transmis à
    l'AN (rare), on n'a que la donnée Sénat.
  - Les codes très rares ou nouveaux (Etalab peut en ajouter) seront
    classés en phase 'autre' mais on garde la date affichée.

## Liens

- Code à étendre : `scripts/lib/dossiers-an.ts`, `scripts/lib/textes-an.ts`,
  `src/lib/components/TimelineNavette.svelte`, `src/lib/types.ts`
- Code à créer : (éventuellement) `scripts/lib/timeline-navette.ts`
  pour la lib pure de parsing + tests TDD
- Données : enrichit `static/data/textes.json` et
  `static/data/textes-unifies.json`
- ADR liées : #0035 (Texte AN), #0036 (TexteUnifie cross-chambre)
- Source : dump `Dossiers_Legislatifs.json.zip` AN, déjà téléchargé par
  `scripts/fetch-data.ts` au build (cache HTTP, ADR 0021)
- Inspiration : aucune. Poligraph reconstruit partiellement la timeline
  AN mais pas la navette croisée. Premier dans l'écosystème open source FR.
