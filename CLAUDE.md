# MaDA — contexte du projet

## Vision (mots de Ryan, 25 octobre 2026)

Ma Da est une application iOS (App Store) de création et de montage vidéo assistée par IA. L'utilisateur importe photos, vidéos et textes, et l'IA monte à sa place selon sa demande, dans le style d'Edits d'Instagram. Ma Da est aussi un studio tout-en-un pour les créateurs, influenceurs et marques : flyers, affiches, stories, posts, pubs. L'IA y joue le rôle de directeur artistique et doit éviter les rendus génériques. L'appli gère plusieurs comptes et doit fonctionner sans que l'utilisateur ait à se connecter à un service d'IA.

Conséquences pour le code : les clés d'IA restent côté serveur (jamais dans l'appli), l'utilisateur ne crée qu'un compte MaDA, et chaque espace de marque (compte) a ses propres médias, couleurs et historique.

## Décisions de Ryan (25 octobre 2026, après le questionnaire « grill-me »)

Ces décisions priment sur `source/MISSION.md` (qui visait React Native + Expo) et sur la PR #1 (Capacitor, Android, offre à vie).

- **Plateforme** : iOS uniquement, en Swift natif (SwiftUI + AVFoundation) dès la v1. Pas d'Android pour l'instant.
- **Rendu vidéo** : sur l'iPhone avec AVFoundation. Le serveur ne sert qu'à l'IA. Pas de Remotion ni de rendu serveur dans l'appli.
- **IA** : images clés en basse résolution et en nombre limité ; un modèle léger analyse les plans, le modèle puissant ne sert qu'aux décisions de montage. Estimation du coût par montage : `docs/cout-ia-et-grille-qualite.md`.
- **Cible n°1** : les petits établissements et les événements (bars, restaurants, hôtels, organisateurs de soirées, BDE). Ils ont une marque, publient beaucoup, n'ont pas de graphiste. Ryan y a son réseau pour tester. L'offre multi-comptes ou agence viendra plus tard.
- **Différence face à Edits, CapCut et Canva** : le montage fait à la place de l'utilisateur à partir d'une phrase, avec l'identité de marque de l'établissement.
- **Modèle économique** : abonnement uniquement, **pas d'offre à vie** (l'IA coûte à chaque usage). Offre « Pro » : une marque, sa charte, posts + flyers + vidéos. Montage manuel gratuit et illimité (tout se fait sur l'appareil). 3 montages IA gratuits, puis paywall avec essai de 7 jours via l'App Store. Quota mensuel de montages IA.
- **App Store** : « Se connecter avec Apple », suppression du compte depuis l'appli, étiquettes de confidentialité complètes, mention claire de l'usage de l'IA.
- **Musique** : v1 = import de ses propres sons et export d'une version sans musique, pour ajouter le son tendance dans Instagram. Licence de catalogue (Epidemic Sound) à chiffrer, v2 au plus tôt.
- **Qualité** : 20 briefs réels du réseau de Ryan (bars, soirées BDE, hôtel), notés avec la grille sur 5 critères de `docs/cout-ia-et-grille-qualite.md` avant d'écrire l'appli.

## Le produit aujourd'hui

Studio de création assisté par IA pour créateurs, influenceurs, marques et agences : visuels (flyers, affiches, stories, posts, collages, pubs), montage vidéo, identité de marque, analyse Instagram, idées et veille. Toute l'interface est en français. Propriétaire du produit : Ryan.

Nom commercial : **MaDA : Studio créatif IA** (« ma DA », ma directrice artistique). Promesse : créer posts, vidéos et stories pour Instagram et TikTok en toute simplicité. Les bases IndexedDB gardent leurs anciens noms (`ryanreel-studio`, `ryanreel`) pour ne pas perdre les données existantes.

## État actuel

Prototype fonctionnel en une seule page HTML, assemblée à partir des modules de `source/` par `source/build.py`. Deux sorties :

- `source/mada-studio.html` : version publiée dans Claude (artefact). L'IA passe par `claude.use("sample")`, la sauvegarde par `claude.use("db")`.
- `public/index.html` : version site web (déployée sur Vercel). `public/shim.js` remplace `window.claude` et appelle `/api/generate` (`api/generate.js` + `lib/claude.js`), qui garde la clé API Anthropic côté serveur, applique le code d'accès `APP_PASSWORD` et une limite de demandes par visiteur (`MAX_PER_HOUR`). `server.js` sert la même chose hors Vercel.

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

1. Tester la qualité sur les 20 briefs réels avec le prototype web actuel et la grille de notation, avant d'écrire l'appli.
2. Mesurer le coût réel par montage (champ `usage` des réponses de l'API) et fixer le quota mensuel.
3. Appli SwiftUI : import depuis la photothèque, timeline et aperçu AVFoundation, export 1080 × 1920 sur l'appareil, éditeur de visuels qui dessine le JSON des calques.
4. Serveur : l'API IA existante (clés côté serveur), comptes avec « Se connecter avec Apple », espaces de marque, quotas.
5. Abonnement Pro par achat intégré Apple (StoreKit, éventuellement via RevenueCat), essai de 7 jours.
6. Dossier App Store : suppression du compte, étiquettes de confidentialité, mention de l'IA.

Le prototype web reste la référence de la logique : `render.js` (rendu des calques) et `aidesign.js` (consignes du directeur artistique, schéma JSON, relecture critique) sont à porter en Swift, le JSON `{w, h, background, fx, layers[]}` restant le format pivot entre l'IA et le moteur de rendu.

## Stack technique retenue

Swift natif, iOS uniquement : SwiftUI pour l'interface, AVFoundation (`AVComposition`, `AVVideoComposition`, `AVAssetExportSession`) pour la timeline et l'export, Core Image ou Metal pour les effets, reconnaissance vocale d'Apple pour la transcription. Le serveur Node actuel (`api/generate.js`, `lib/claude.js`) garde les clés de l'API Anthropic et applique les quotas.

Options écartées par Ryan le 25 octobre 2026 : Capacitor (l'aperçu vidéo vivrait dans une WebView, notre point faible) et React Native + Expo (inutile sans Android).

## Skills et plugins installés (portée projet)

Plugins officiels (marketplace `claude-plugins-official`, activés dans `.claude/settings.json`) :

| Plugin | Quand l'utiliser |
| --- | --- |
| `swift-lsp` | Navigation et diagnostics dans le code Swift (nécessite Xcode, qui fournit SourceKit-LSP). |
| `frontend-design` | Direction visuelle d'une page ou d'un écran web (site vitrine, prototype) ; ses principes anti-générique valent aussi pour les consignes du directeur artistique IA. |
| `skill-creator` | Écrire un skill propre à MaDA (par exemple le style maison du directeur artistique IA) ou améliorer un skill existant. |
| `claude-md-management` | Relire et tenir à jour ce fichier CLAUDE.md après une session de travail. |
| `claude-code-setup` | Proposer des automatisations pour le dépôt (hooks, sous-agents, serveurs MCP). |

À ajouter plus tard si besoin : `revenuecat` (configurer produits et droits depuis Claude), `supabase`.

Skills communautaires (copiés dans `.claude/skills/`, provenance et vérifications dans `.claude/skills/SOURCES.md`) :

| Skill | Quand l'utiliser |
| --- | --- |
| `ui-ux-pro-max` | Choisir palette, typographie, styles et règles d'ergonomie, ou relire un écran pour l'accessibilité et la cohérence. Il a une base dédiée à SwiftUI. |
| `design-taste-frontend` | Quand une page web fait « générique », « fait par une IA » : direction artistique stricte et boucle capture d'écran → corrections. Utile pour le site vitrine et le prototype web. Remplace `minimalist-ui`. |
| `grill-me` (+ `grilling`) | Avant de coder une fonction ou de trancher un choix : se faire challenger question par question. Se lance avec `/grill-me`. |
| `content-strategy` | Planifier les sujets et piliers de contenu des comptes de Ryan et de MaDA. |
| `social` | Posts, scripts de vidéos courtes et calendrier pour TikTok, Instagram et YouTube. |
| `pricing` | Revoir la grille Pro, l'essai gratuit, le quota de montages IA et l'annuel face au mensuel. |
