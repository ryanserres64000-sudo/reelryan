# Coût IA d'un montage et grille « pas générique »

Estimation faite le 25 octobre 2026, avant toute ligne de code. À remplacer par les chiffres mesurés (champ `usage` des réponses de l'API) dès les 20 briefs réels.

## 1. Coût d'un montage IA

### Tarifs de l'API Anthropic utilisés (prix publics, octobre 2026, en dollars par million de jetons)

| Modèle | Rôle dans MaDA | Entrée | Sortie |
| --- | --- | --- | --- |
| Claude Haiku 5.5 (`claude-haiku-5-5`) | Analyse des plans (modèle léger) | 0,10 $ | 0,50 $ |
| Claude Sonnet 5.5 (`claude-sonnet-5-5`) | Décisions de montage, version économique | 2 $ | 10 $ |
| Claude Opus 5.5 (`claude-opus-5-5`) | Décisions de montage, version premium | 4 $ | 20 $ |

Une image coûte environ `largeur × hauteur / 750` jetons. Une image clé verticale en 288 × 512 pixels fait donc environ 200 jetons. La partie fixe des consignes (directeur artistique, schéma JSON) est mise en cache : relue à un dixième du prix.

### Hypothèses d'un montage type

Un Reel de 30 secondes à partir de 10 clips d'environ 15 secondes, plus une phrase de brief et la charte de l'établissement.

1. **Analyse des plans (Haiku 5.5).** 1 image clé toutes les 3 secondes, plafonnée à 60 images en 288 × 512. 5 appels de 12 images. Chaque appel : environ 3 500 jetons en entrée, 1 800 en sortie (description des plans, réflexion comprise). La transcription des voix se fait sur l'iPhone (reconnaissance vocale d'Apple) : 0 €.
2. **Décision de montage (Sonnet 5.5 ou Opus 5.5).** Entrée : consignes en cache (environ 4 000 jetons), descriptions des plans (environ 5 000), brief et charte (environ 1 000), 6 vignettes (environ 1 200). Sortie : la timeline en JSON (environ 3 000 jetons) et la réflexion (environ 4 000).
3. **Relecture critique sur le rendu.** 6 images du montage rendu sur l'iPhone et la timeline, puis une passe de corrections.

### Résultat

| Étape | Avec Sonnet 5.5 | Avec Opus 5.5 |
| --- | --- | --- |
| Analyse des plans (Haiku) | 0,006 $ | 0,006 $ |
| Décision de montage | 0,09 $ | 0,18 $ |
| Relecture critique et corrections | 0,05 $ | 0,10 $ |
| **Total par montage** | **environ 0,15 $ (0,14 €)** | **environ 0,29 $ (0,27 €)** |
| Une retouche demandée à l'IA (« raccourcis la fin ») | environ 0,02 $ | environ 0,04 $ |

Fourchette réaliste : de 0,10 à 0,40 $ par montage selon le nombre de clips et la longueur de la réflexion. Ce qui coûte le plus, c'est la sortie du modèle puissant (la réflexion et la timeline), bien plus que les images.

### Ce que ça veut dire pour l'abonnement à 4,99 €/mois

- Ce qui reste à MaDA sur 4,99 € TTC : 4,99 / 1,2 (TVA) = 4,16 € HT, moins 15 % pour Apple (programme petites entreprises) = **environ 3,53 €**. Sur l'annuel à 39,99 €, il reste **environ 2,36 € par mois**.
- Si l'IA ne doit pas dépasser un tiers de ce revenu (environ 1,10 €/mois), cela fait **environ 8 montages avec Sonnet ou 4 avec Opus** par abonné et par mois, retouches comprises.
- Un gros utilisateur qui fait 30 montages Opus par mois coûte environ 8 €, soit plus que ce qu'il paie. Un quota mensuel est donc indispensable.

Recommandation : Sonnet 5.5 par défaut pour les décisions de montage, quota de 15 montages IA par mois (2,10 € au pire, mais la plupart des abonnés n'iront pas au bout), Opus 5.5 réservé à un test A/B sur les 20 briefs pour voir si la différence de qualité se voit vraiment. Les 3 montages gratuits de l'essai coûtent environ 0,45 $ par nouvel utilisateur.

## 2. Grille de notation « pas générique »

Chaque contenu est noté de 1 à 5 sur cinq critères, par trois juges qui notent séparément : Ryan et deux gérants du réseau qui n'ont pas vu le brief. Ils ne savent pas lequel vient de MaDA et lequel vient d'un modèle Canva rempli à la main, qui sert de point de comparaison.

| # | Critère | 1 (échec) | 3 (passable) | 5 (excellent) |
| --- | --- | --- | --- | --- |
| 1 | **Spécifique à l'établissement** | On remplace le nom par celui d'un autre bar et le contenu marche quand même | Quelques éléments propres (photo, nom), mais une mise en page de modèle | Impossible à confondre : lieu, ambiance, clientèle et offre se reconnaissent |
| 2 | **Fidèle à la marque** | Couleurs, typographie ou ton hors charte | Charte respectée, mais sans personnalité | La charte est utilisée avec intention, on reconnaît la marque sans voir le logo |
| 3 | **Clair en une seconde** | L'info clé (date, lieu, offre, prix) ne se lit pas sur un téléphone | Lisible en cherchant un peu | Lue en une seconde, hiérarchie évidente, rien sous les zones d'interface d'Instagram |
| 4 | **Rythme et composition** | Coupes au hasard, pas d'accroche, ou mise en page déséquilibrée | Correct mais plat | Accroche dans les 2 premières secondes, coupes calées sur le tempo, composition de niveau agence |
| 5 | **Prêt à publier** | Il faut tout refaire | 2 ou 3 retouches avant de publier | Publiable tel quel : zéro faute, bon format, zéro retouche |

### Règle de réussite (fixée avant le test)

- Moyenne des trois juges **d'au moins 4 sur 5** sur l'ensemble des 20 briefs.
- **Aucun critère sous 3** pour au moins 16 briefs sur 20.
- Critère 1 (spécifique) **d'au moins 4** en moyenne, et MaDA mieux noté que le modèle Canva sur au moins 15 briefs sur 20.
- On note aussi le nombre de retouches demandées avant publication et le temps passé, du brief au fichier exporté.

Si le test échoue, on corrige les consignes du directeur artistique et la bibliothèque de styles, puis on relance sur 10 nouveaux briefs avant d'écrire l'appli.
