# Coût IA d'un montage et protocole de test « pas générique »

Estimation faite le 25 octobre 2026, avant toute ligne de code, et revue après les réponses révisées de Ryan (tri sur l'appareil, 15 à 30 images, 6,99 €/mois). Le prototype sur ordinateur doit remplacer ces chiffres par des mesures réelles (champ `usage` des réponses de l'API).

## 1. Coût d'un montage IA

### Tarifs de l'API Anthropic utilisés (prix publics, octobre 2026, en dollars par million de jetons)

| Modèle | Rôle dans MaDA | Entrée | Sortie |
| --- | --- | --- | --- |
| Claude Haiku 5.5 (`claude-haiku-5-5`) | Étiquetage des plans (petit modèle) | 0,10 $ | 0,50 $ |
| Claude Sonnet 5.5 (`claude-sonnet-5-5`) | Décision de montage, version économique | 2 $ | 10 $ |
| Claude Opus 5.5 (`claude-opus-5-5`) | Décision de montage, version premium | 4 $ | 20 $ |

Une image coûte environ `largeur × hauteur / 750` jetons. Une image clé verticale réduite à 288 × 512 pixels fait donc environ 200 jetons. La partie fixe des consignes (directeur artistique, schéma de la timeline) est mise en cache : relue à un dixième du prix.

### Hypothèses d'un montage type

Un Reel de 30 secondes, à partir de 10 clips d'environ 15 secondes, plus une phrase de brief et le style de l'utilisateur (charte et corrections passées).

1. **Tri sur l'iPhone (Vision d'Apple)** : changements de plan, visages, flou, plans ratés. Coût IA : 0. Transcription des voix par la reconnaissance vocale d'Apple : 0.
2. **Étiquetage (Haiku 5.5)** : 30 images au plus, en 3 appels de 10 images. Chaque appel : environ 3 000 jetons en entrée et 1 500 en sortie, réflexion comprise.
3. **Décision de montage (Sonnet 5.5 ou Opus 5.5)** : en entrée, les consignes en cache (environ 4 000 jetons), les étiquettes des plans (environ 2 500), le brief et le style (environ 1 000) et 6 vignettes (environ 1 200). En sortie, la timeline JSON (environ 3 000 jetons) et la réflexion (environ 4 000).
4. **Relecture critique** : 6 images du montage rendu sur l'appareil, plus la timeline, puis une passe de corrections.

### Résultat

| Étape | Avec Sonnet 5.5 | Avec Opus 5.5 |
| --- | --- | --- |
| Étiquetage (Haiku) | 0,003 $ | 0,003 $ |
| Décision de montage | 0,08 $ | 0,16 $ |
| Relecture critique et corrections | 0,05 $ | 0,10 $ |
| **Total par montage** | **environ 0,13 $ (0,12 €)** | **environ 0,26 $ (0,24 €)** |
| Une retouche demandée à l'IA (« raccourcis la fin ») | environ 0,02 $ | environ 0,04 $ |

Fourchette réaliste : de 0,08 à 0,35 $ par montage. Le tri sur l'appareil divise par deux le coût des images, mais ce qui coûte le plus reste la sortie du gros modèle (la réflexion et la timeline). Pour baisser encore, il faut une timeline JSON compacte et un niveau de réflexion (« effort ») réglé au plus bas qui garde la qualité.

### Ce que ça veut dire pour 6,99 €/mois (et un annuel à 49,99 €)

| | Mensuel 6,99 € | Annuel proposé 49,99 € (4,17 €/mois) |
| --- | --- | --- |
| Hors TVA (20 %) | 5,83 € | 3,47 €/mois |
| Après la part d'Apple (15 %, programme petites entreprises) | **environ 4,95 €** | **environ 2,95 €/mois** |
| Budget IA si on garde un tiers du revenu | 1,65 € | 0,98 €/mois |
| Montages par mois dans ce budget, avec Sonnet | environ 13 | environ 8 |
| Montages par mois dans ce budget, avec Opus | environ 7 | environ 4 |

Annuel : 49,99 € (« moins de 50 € », environ 40 % de remise sur 12 × 6,99 € = 83,88 €). Un annuel à 59,99 € garderait plus de marge (environ 3,54 €/mois) mais la remise, environ 28 %, attire moins.

Recommandation : Sonnet 5.5 par défaut et un quota de 15 montages IA par mois. Au pire, un abonné qui va au bout coûte 1,80 €, soit 36 % du revenu mensuel ou 61 % de l'annuel ; la plupart n'iront pas au bout. Opus 5.5 seulement si le test à l'aveugle montre qu'il fait gagner des préférences. Un montage gratuit sur des rushes de 60 à 90 s coûte environ 0,05 à 0,10 $.

Coût du test lui-même : 20 briefs, chacun monté avec Sonnet puis avec Opus, retouches comprises, soit environ 10 $ d'API. Le rendu FFmpeg tourne sur l'ordinateur, il ne coûte rien.

## 2. Protocole du test à l'aveugle

### Ce qu'on compare

- Les mêmes rushes et la même phrase de brief pour les 20 briefs, recueillis auprès d'indépendants du réseau de Ryan (coachs, restaurateurs, artisans, commerçants, freelances).
- Trois versions de chaque Reel : **MaDA** (prototype sur ordinateur), **le montage automatique de CapCut** et **Edits**. Les trois sont exportées sans musique (ou avec le même son), au même format 1080 × 1920, sans filigrane, et renommées au hasard.
- Les juges : l'indépendant qui a donné les rushes, plus au moins deux personnes de la cible qui ne connaissent pas le projet. Personne ne sait quelle version vient de quel outil.

### Critère de réussite (fixé avant le test)

- Pour chaque brief, chaque juge choisit sa version préférée, MaDA contre CapCut d'une part, MaDA contre Edits d'autre part.
- **Réussite : MaDA préféré dans au moins 70 % des comparaisons face à CapCut et dans au moins 70 % face à Edits.** Sinon, on corrige les consignes du directeur artistique et le tri des plans, et on refait le test sur 10 nouveaux briefs avant d'écrire la moindre ligne de code mobile.
- On note aussi, pour MaDA : le temps entre l'envoi des rushes et la vidéo finale, et le nombre de retouches avant que le juge la publierait.

### Grille de diagnostic (pour savoir pourquoi on gagne ou on perd)

Après son choix, chaque juge note la version MaDA de 1 à 5 sur cinq critères. Cette grille ne décide pas de la réussite, elle dit quoi corriger.

| # | Critère | 1 (échec) | 3 (passable) | 5 (excellent) |
| --- | --- | --- | --- | --- |
| 1 | **Dans ton style, sans template** | On reconnaît un modèle tout fait, ça marcherait pour n'importe qui | Quelques éléments personnels, mais une structure de modèle | On reconnaît la personne et son activité, ses couleurs, ses polices et son ton |
| 2 | **Choix des plans** | Plans flous, ratés ou sans intérêt gardés, meilleurs moments oubliés | Les bons plans sont là, mais l'ordre est banal | Les meilleurs moments sont gardés et l'histoire se tient |
| 3 | **Rythme** | Coupes au hasard, pas d'accroche | Correct mais plat | Accroche dans les 2 premières secondes, coupes calées sur le rythme |
| 4 | **Textes clairs en une seconde** | Textes illisibles sur un téléphone ou cachés sous l'interface | Lisibles en cherchant un peu | Lus en une seconde, hiérarchie évidente, dans les zones sûres de Reels, TikTok et Shorts |
| 5 | **Prêt à publier** | Il faut tout refaire | 2 ou 3 retouches avant de publier | Publiable tel quel : zéro faute, bon format, zéro retouche |

Les corrections demandées pendant le test sont gardées : ce sont les premières données de la mémoire du style.
