# Prototype de montage MaDA (sur ordinateur)

Le but : vérifier que MaDA monte mieux que CapCut et Edits **avant** d'écrire l'appli iPhone. Tu donnes un dossier de rushes et une phrase, tu récupères un Reel 1080 × 1920 prêt à publier, et le coût réel de l'IA pour ce montage.

Ce que fait le script, dans l'ordre :

1. **Tri des plans** (gratuit, sur ton ordinateur) : il repère les changements de plan, prend des images clés, écarte les images floues, trop sombres ou brûlées, et en garde 30 au maximum, réduites à 288 × 512. Sur l'iPhone, ce sera le framework Vision d'Apple.
2. **Étiquetage** (Claude Haiku 5.5) : chaque image clé est décrite et notée (valeur de plan, visages, qualité, intérêt, bonne accroche ou non).
3. **Décision de montage** (Claude Sonnet 5.5, ou Opus 5.5 avec `--modele opus`) : l'IA renvoie seulement une timeline JSON (plans retenus, coupes, cadrage, transitions, textes).
4. **Rendu** (FFmpeg, sur ton ordinateur) : la timeline devient une vidéo MP4.
5. **Relecture critique** (en option, `--relecture`) : l'IA regarde des images du rendu, corrige la timeline, et la vidéo est rendue une seconde fois.

## Installation sur Mac (une seule fois)

1. Installe [Homebrew](https://brew.sh) si tu ne l'as pas, puis dans le Terminal : `brew install node ffmpeg`
2. Dans le dossier du projet : `npm install`
3. Crée un fichier `.env` à la racine du projet avec ta clé de l'API Claude (sur [console.anthropic.com](https://console.anthropic.com)) :
   ```
   ANTHROPIC_API_KEY=sk-ant-...
   ```

## Utilisation

Mets les vidéos d'un brief dans un dossier (elles sont lues par ordre alphabétique), puis :

```bash
npm run montage -- monter ~/Desktop/brief01 --brief "Montre le plat du jour, ambiance chaleureuse, donne envie de réserver" --style prototype/exemple-style.json
```

Options utiles :

| Option | Effet |
| --- | --- |
| `--duree 20` | Durée visée en secondes (20 par défaut) |
| `--bpm 120` | Cale toutes les coupes sur ce tempo (celui du son tendance que tu ajouteras dans Instagram) |
| `--modele opus` | Utilise Opus 5.5 pour la décision au lieu de Sonnet 5.5 (environ deux fois plus cher) |
| `--relecture` | Ajoute la relecture critique sur le rendu |
| `--musique son.mp3` | Ajoute une musique sous le son d'origine (pour tester ; par défaut, la vidéo sort sans musique) |
| `--sortie dossier` | Où écrire le résultat (par défaut `sortie/<date>`) |

Dans le dossier de sortie :

- `montage.mp4` : la vidéo ;
- `timeline.json` : le montage décidé par l'IA (c'est le même format que lira l'appli iPhone) ;
- `cout.json` : le coût réel de chaque appel à l'IA, en dollars, et le temps total ;
- `etiquettes.json` : le tri et les étiquettes de chaque image clé.

Autres commandes :

```bash
npm run montage -- trier ~/Desktop/brief01
# Montre le tri des plans sans appeler l'IA (gratuit).

npm run montage -- rendre sortie/<date>/timeline.json ~/Desktop/brief01 --style prototype/exemple-style.json
# Rend à nouveau une timeline, par exemple après l'avoir retouchée à la main. Pas d'IA.

npm run montage -- corriger prototype/exemple-style.json "Jamais de texte en haut de l'écran"
# Ajoute une correction à la mémoire du style : l'IA la respectera aux montages suivants.
```

## Le style

Un fichier JSON par personne testée (copie `exemple-style.json`). Tout est facultatif :

- `nom`, `activite`, `ton`, `public` : décrivent la personne, l'IA s'en sert pour les textes ;
- `couleurs.texte` et `couleurs.principale` (fond des textes d'accroche et de signature quand `textes` vaut `"bandeau"`) ;
- `textes` : `"sobre"` (par défaut, texte avec une ombre douce) ou `"bandeau"` (accroche et signature sur un bandeau de couleur) ;
- `police` : chemin d'un fichier `.ttf` ou `.otf` ;
- `logo` : chemin d'un PNG, affiché pendant les 2,5 dernières secondes ;
- `corrections` : la mémoire du style, alimentée par la commande `corriger`.

## Pour le test à l'aveugle

Le protocole complet est dans `docs/cout-ia-et-grille-qualite.md`. En bref : mêmes rushes dans MaDA, dans le montage automatique de CapCut et dans Edits, trois vidéos exportées sans musique, renommées au hasard, puis préférence des juges. Objectif : au moins 70 % de préférence pour MaDA face à chacun des deux.

## Limites connues du prototype

- Les photos (JPG, PNG, HEIC) deviennent des plans fixes de 4 s au plus, avec un léger zoom.
- Les emojis des textes ne s'affichent pas dans la vidéo (police sans emojis) : ils restent dans `timeline.json`, à remettre dans la légende.
- Le tempo se donne à la main (`--bpm`) : pas de détection automatique du rythme.
- Pas de détection de visages avant l'IA (c'est Haiku qui les compte) ; l'iPhone le fera avec Vision.
- La parole est repérée par le volume dans la bande de la voix, pas par une vraie reconnaissance vocale : une ambiance bruyante peut passer pour une voix.
- Les textes écrits entre guillemets dans le brief sont imposés : l'IA doit les reprendre mot pour mot, et le script signale ceux qui manquent. La relecture critique est écartée si elle raccourcit trop le montage ou perd un texte imposé.
- Les textes utilisent une police système si le style n'en donne pas.

## Test à l'aveugle en 3 commandes (lot 0)

1. Un sous-dossier par brief dans un dossier `briefs` : les rushes, un fichier `brief.txt` (la phrase, plus si besoin les lignes `durée : 30` et `bpm : 110`), éventuellement `style.json` et `musique.mp3`, et un sous-dossier `concurrents` avec les exports `capcut.mp4`, `edits.mp4` (et `youtube.mp4` si tu as YouTube Edit with AI).
2. `npm run montage -- lot ~/Downloads/briefs` : monte tous les briefs, reprend là où il s'est arrêté, écrit `resume.csv` (temps, coût, textes imposés manquants).
3. `npm run montage -- preparer-test ~/Downloads/briefs sortie/lot-<date>` : copie les versions sans leurs métadonnées, les renomme au hasard (A, B, C…) et crée `test-aveugle/fiche-de-vote.html`. Les juges reçoivent le dossier sans `cle-secrete.json`, votent dans la page et renvoient leur fichier `votes-<prénom>.json`.
4. `npm run montage -- resultats test-aveugle` : taux de préférence face à chaque concurrent, fourchette probable, notes de la grille, verdict (objectif 70 %).

Les juges classent toutes les versions et les notent toutes sur la grille : noter seulement MaDa dévoilerait laquelle est MaDa.
