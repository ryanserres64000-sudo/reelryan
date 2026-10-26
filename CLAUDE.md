# MaDA — contexte du projet

## Vision (mots de Ryan, 25 octobre 2026)

Ma Da est une application iOS (App Store) de création et de montage vidéo assistée par IA. L'utilisateur importe photos, vidéos et textes, et l'IA monte à sa place selon sa demande, dans le style d'Edits d'Instagram. Ma Da est aussi un studio tout-en-un pour les créateurs, influenceurs et marques : flyers, affiches, stories, posts, pubs. L'IA y joue le rôle de directeur artistique et doit éviter les rendus génériques. L'appli gère plusieurs comptes et doit fonctionner sans que l'utilisateur ait à se connecter à un service d'IA.

Conséquences pour le code : les clés d'IA restent côté serveur (jamais dans l'appli), l'utilisateur ne crée qu'un compte MaDA, et chaque espace de marque (compte) a ses propres médias, couleurs et historique.

## Décisions de Ryan (25 octobre 2026, réponses révisées au questionnaire « grill-me »)

Ces décisions priment sur `source/MISSION.md` et sur la PR #1 (Capacitor, Android, offre à vie).

- **Priorité absolue, avant toute ligne de code mobile** : un prototype sur ordinateur, un simple script (rushes → tri → Claude → timeline JSON → rendu FFmpeg). Test à l'aveugle sur 20 briefs réels contre le montage automatique de CapCut et contre Edits. Objectif fixé à l'avance : **au moins 70 % de préférence** pour MaDA. Si on ne bat pas CapCut, le reste n'a pas d'intérêt. Protocole : `docs/cout-ia-et-grille-qualite.md`.
- **Plateforme** : iOS uniquement en v1. Interface en React Native avec Expo (dev build), et un module natif AVFoundation pour l'aperçu **et** l'export dès la v1. Les deux passent par le même `AVComposition` : on exporte exactement ce qu'on voit à l'écran.
- **Rôle de l'IA** : elle ne renvoie qu'une timeline en JSON (plans retenus, coupes, textes, transitions). Le téléphone fait tout le rendu ; le serveur ne sert qu'à l'IA.
- **Coût à la source** : le tri se fait sur l'appareil avec le framework Vision d'Apple (changements de plan, visages, flou, plans ratés). Seules 15 à 30 images basse résolution déjà triées partent vers Claude, réduites sur l'appareil. Un petit modèle étiquette, un gros modèle décide du montage.
- **Promesse** : « Tu donnes tes rushes et une phrase, tu récupères un Reel publiable en 2 minutes, dans TON style, sans template. » La charte (couleurs, polices, logo) fait partie de « ton style ».
- **Cible n°1** : les indépendants qui font leur propre contenu pour leur activité (coachs, restaurateurs, artisans, commerçants, freelances). Ils ont besoin d'une identité de marque, ne savent pas monter et paient pour gagner du temps. L'offre Agence viendra plus tard, en plus, pas comme position de repli.
- **Défense face à Edits, CapCut et Canva** : le multi-plateforme (export pour Reels, TikTok et Shorts, quand Edits reste centré sur Instagram) et la mémoire du style. L'appli apprend des corrections de chaque utilisateur, et ces corrections nourrissent son style. C'est ce que les concurrents ne pourront pas copier.
- **Prix** : 6,99 €/mois (4,99 € est trop bas vu le coût de l'IA). Annuel proposé : 49,99 €/an (environ 40 % de remise), à valider par Ryan. Pas d'offre à vie au lancement ; si un jour il y en a une, prix élevé et quota mensuel.
- **Gratuit et paywall** : montage manuel gratuit (rendu sur l'appareil). Montages IA gratuits limités à des rushes de 60 à 90 s. Le paywall s'affiche juste après le premier très bon résultat. Protection contre les comptes multiples (App Attest et identifiant d'appareil).
- **App Store** : achats intégrés StoreKit dès la v1, « Se connecter avec Apple » (Google en plus, en option), suppression du compte depuis l'appli, étiquettes de confidentialité complètes, mention claire de l'usage de l'IA.
- **Musique** : coupes calées sur le rythme, puis export d'une vidéo prête à recevoir un son tendance, que l'utilisateur ajoute dans Instagram au moment de publier (légal). À côté : import de ses propres sons, et un catalogue sous licence (comparer les tarifs d'API d'Epidemic Sound, Artlist et Soundstripe).

## Le produit aujourd'hui

Studio de création assisté par IA pour créateurs, influenceurs, marques et agences : visuels (flyers, affiches, stories, posts, collages, pubs), montage vidéo, identité de marque, analyse Instagram, idées et veille. Toute l'interface est en français. Propriétaire du produit : Ryan.

Nom commercial : **MaDA : Studio créatif IA** (« ma DA », ma directrice artistique). Promesse : créer posts, vidéos et stories pour Instagram et TikTok en toute simplicité. Les bases IndexedDB gardent leurs anciens noms (`ryanreel-studio`, `ryanreel`) pour ne pas perdre les données existantes.

## État actuel

Prototype fonctionnel en une seule page HTML, assemblée à partir des modules de `source/` par `source/build.py`. Deux sorties :

- `source/mada-studio.html` : version publiée dans Claude (artefact). L'IA passe par `claude.use("sample")`, la sauvegarde par `claude.use("db")`.
- `public/index.html` : version site web (déployée sur Vercel). `public/shim.js` remplace `window.claude` et appelle `/api/generate` (`api/generate.js` + `lib/claude.js`), qui garde la clé API Anthropic côté serveur, applique le code d'accès `APP_PASSWORD` et une limite de demandes par visiteur (`MAX_PER_HOUR`). `server.js` sert la même chose hors Vercel.

Prototype de montage sur ordinateur dans `prototype/` (mode d'emploi : `prototype/README.md`) : `npm run montage -- monter <dossier> --brief "…"`. Tri des plans avec FFmpeg (`lib/sort.mjs`), étiquetage Haiku 5.5 puis décision Sonnet 5.5 ou Opus 5.5 (`lib/ai.mjs`), timeline JSON validée et calée sur le tempo (`lib/timeline.mjs`), rendu FFmpeg 1080 × 1920 (`lib/render.mjs`), coût réel dans `cout.json`. Le schéma de `lib/timeline.mjs` est celui que lira l'appli iPhone.

App iPhone dans `app/` (Expo SDK 58, TypeScript) : design system « Atelier de nuit » dans `app/src/design/`, textes dans `app/src/copy/fr.ts`. Les jetons viennent de `design/tokens.json` (`node design/build.mjs` régénère `app/src/design/tokens.ts`) ; `npm test` vérifie les contrastes WCAG AA, `node design/check-hardcoded.mjs` refuse couleurs, tailles et textes en dur dans l'app. Mode d'emploi : `app/README.md`.

Logique commune dans `core/` (TypeScript lu tel quel par Node ≥ 22.18 et par Metro) : `core/timeline.ts` est la timeline JSON v1 (schéma pour l'IA, validation `sanitizeTimeline`), partagée par l'app et le serveur. Route `POST /api/montage` (`lib/montage.js`) : l'iPhone envoie brief, rushes et 15 à 30 images clés ; Haiku étiquette, Sonnet écrit 2 ou 3 variantes puis les relit, réponse en flux NDJSON (une ligne par étape). Elle reprend les consignes du prototype (`prototype/lib/ai.mjs`), pour que l'app reçoive ce que le test à l'aveugle a mesuré. `npm test` lance tous les tests (prototype, design, core, serveur).

Ne jamais modifier `public/index.html` à la main : modifier les modules, puis lancer `cd source && python3 build.py && node --check all.js`.

## Fichiers sources

| Fichier (dans `source/`) | Rôle |
| --- | --- |
| `shell.css` | Styles de l'application (thème sombre, jetons de couleur dans `:root`) |
| `body.html` | Structure : barre latérale, vues, éditeur. `<!--VIDEO-->` reçoit le studio vidéo |
| `core.js` | Utilitaires, stockage (IndexedDB + base Claude), médias, espaces de marque, `brandContext()`, adaptateur IA, fenêtres modales |
| `render.js` | Moteur de rendu des visuels : fonds, calques texte / forme / image / motif, masques, duotone, grain, test de clic |
| `aidesign.js` | Directeur artistique IA : schéma JSON des calques, consignes de composition, nettoyage (`sanitizeDesign`), création, relecture critique, retouches, adaptation de format |
| `editor.js` | Écran de brief, éditeur de calques (sélection, déplacement, redimensionnement, rotation, magnétisme, historique), variantes, export PNG/JPG/PDF |
| `pages.js` | Coquille, navigation, accueil, identité de marque, analyse Instagram, idées et veille, galerie, compte, démarrage |
| `video_src.html` | Studio vidéo d'origine ; `build.py` le préfixe (`v-`) et l'enferme dans le module `Video` |

## Points clés

- Un visuel = un JSON `{w, h, background, fx, layers[]}` ; l'IA produit ce JSON, `sanitizeDesign` le valide, `renderDesign` le dessine.
- Les images sont des « assets » stockés en IndexedDB (par espace), référencés par id ; l'IA les voit sous des alias (`img1`, `logo`).
- Qualité : création → rendu → relecture critique sur l'image rendue → corrections.
- La veille hebdomadaire est une tâche planifiée Claude qui écrit dans la collection `veille` de la base de l'artefact (version Claude uniquement).
- Le cap produit et technique complet est dans `source/MISSION.md`.

## Prochaines étapes

1. **Prototype sur ordinateur** : fait (`prototype/`). Reste à le lancer sur de vrais rushes et à relever le coût réel de chaque montage (`cout.json`).
2. **Test à l'aveugle** sur 20 briefs réels contre CapCut et Edits, objectif de 70 % de préférence. Rien d'autre ne démarre avant le résultat.
3. **Appli Expo (iOS)** : import depuis la photothèque, tri avec Vision, module natif AVFoundation pour l'aperçu et l'export (un seul `AVComposition`), éditeur de visuels qui dessine le JSON des calques.
4. **Serveur** : l'API IA existante (clés côté serveur), comptes avec « Se connecter avec Apple », quotas, protection contre les comptes multiples (App Attest).
5. **Abonnement** StoreKit (6,99 €/mois, annuel proposé à 49,99 €/an), paywall après le premier très bon résultat.
6. **Mémoire du style** : enregistrer les corrections de chaque utilisateur et les réinjecter dans les consignes du directeur artistique.
7. **Dossier App Store** : suppression du compte, étiquettes de confidentialité, mention de l'IA.

Le prototype web reste la référence de la logique : `render.js` (rendu des calques) et `aidesign.js` (consignes du directeur artistique, schéma JSON, relecture critique) se portent en TypeScript dans l'appli Expo, et le JSON `{w, h, background, fx, layers[]}` reste le format pivot entre l'IA et le moteur de rendu. La timeline vidéo aura son propre schéma JSON, défini pendant le prototype.

## Stack technique retenue

- **Appli** : React Native avec Expo (dev build, pas Expo Go), iOS uniquement en v1.
- **Vidéo** : module natif Swift (Expo Modules API) autour d'AVFoundation : `AVComposition` et `AVVideoComposition` partagés entre l'aperçu (`AVPlayer`) et l'export (`AVAssetExportSession`), 1080 × 1920.
- **Tri des plans** : framework Vision d'Apple sur l'appareil.
- **IA** : le serveur Node actuel (`api/generate.js`, `lib/claude.js`) garde les clés de l'API Anthropic et applique les quotas.
- **Achats** : StoreKit (éventuellement via RevenueCat).
- **Prototype de test** : script Node ou Python sur ordinateur + FFmpeg.

Options écartées par Ryan le 25 octobre 2026 : Capacitor (l'aperçu dans une WebView ne correspondrait pas à l'export natif) et Android en v1.

## Skills et plugins installés (portée projet)

Plugins officiels (marketplace `claude-plugins-official`, activés dans `.claude/settings.json`) :

| Plugin | Quand l'utiliser |
| --- | --- |
| `expo` | Créer, configurer, compiler et publier l'appli Expo (dev build, modules natifs, envoi sur l'App Store). |
| `swift-lsp` | Navigation et diagnostics dans le module natif Swift (nécessite Xcode, qui fournit SourceKit-LSP). |
| `frontend-design` | Direction visuelle d'un écran ou d'une page ; ses principes anti-générique valent aussi pour les consignes du directeur artistique IA. |
| `skill-creator` | Écrire un skill propre à MaDA (par exemple le style maison du directeur artistique IA) ou améliorer un skill existant. |
| `claude-md-management` | Relire et tenir à jour ce fichier CLAUDE.md après une session de travail. |
| `claude-code-setup` | Proposer des automatisations pour le dépôt (hooks, sous-agents, serveurs MCP). |

À ajouter plus tard si besoin : `revenuecat` (configurer produits et droits depuis Claude), `supabase`.

Skills communautaires (copiés dans `.claude/skills/`, provenance et vérifications dans `.claude/skills/SOURCES.md`) :

| Skill | Quand l'utiliser |
| --- | --- |
| `ui-ux-pro-max` | Choisir palette, typographie, styles et règles d'ergonomie, ou relire un écran pour l'accessibilité et la cohérence. Il a des bases dédiées à React Native et SwiftUI. |
| `design-taste-frontend` | Quand un écran ou une page fait « générique », « fait par une IA » : direction artistique stricte et boucle capture d'écran → corrections. Remplace `minimalist-ui`. |
| `grill-me` (+ `grilling`) | Avant de coder une fonction ou de trancher un choix : se faire challenger question par question. Se lance avec `/grill-me`. |
| `content-strategy` | Planifier les sujets et piliers de contenu des comptes de Ryan et de MaDA. |
| `social` | Posts, scripts de vidéos courtes et calendrier pour TikTok, Instagram et YouTube. |
| `pricing` | Revoir le prix, l'essai gratuit, le quota de montages IA et l'annuel face au mensuel. |
