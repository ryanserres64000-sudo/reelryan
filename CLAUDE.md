# MaDA — contexte du projet

## Vision (mots de Ryan, 25 octobre 2026)

Ma Da est une application iOS (App Store) de création et de montage vidéo assistée par IA. L'utilisateur importe photos, vidéos et textes, et l'IA monte à sa place selon sa demande, dans le style d'Edits d'Instagram. Ma Da est aussi un studio tout-en-un pour les créateurs, influenceurs et marques : flyers, affiches, stories, posts, pubs. L'IA y joue le rôle de directeur artistique et doit éviter les rendus génériques. L'appli gère plusieurs comptes et doit fonctionner sans que l'utilisateur ait à se connecter à un service d'IA.

Conséquences pour le code : les clés d'IA restent côté serveur (jamais dans l'appli), l'utilisateur ne crée qu'un compte MaDA, et chaque espace de marque (compte) a ses propres médias, couleurs et historique.

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

## Prochaines étapes (cahier des charges, phase 1 — MVP)

À relire une fois la stack choisie (section suivante) : sur iOS, l'abonnement passe par l'achat intégré Apple (RevenueCat), Stripe ne sert que sur le web.

1. Passer à une vraie application : Next.js + API Node, PostgreSQL (Supabase), authentification (e-mail, Google, Apple), stockage des médias en ligne.
2. Organisations, espaces de marque, rôles et invitations.
3. Rendu vidéo côté serveur en MP4 (FFmpeg) et transcription automatique des voix.
4. Abonnements Stripe et quotas d'IA.
5. Préparer le dossier de validation Meta pour la connexion Instagram (phase 2).

Réutiliser `render.js`, `aidesign.js` et la logique de l'éditeur : c'est le cœur du produit.

## Stack technique de l'appli iOS : deux options (décision ouverte, à Ryan de trancher)

Ne pas engager de réécriture tant que Ryan n'a pas choisi. Socle commun aux deux options :

- **IA côté serveur** : l'appli appelle notre API (aujourd'hui `api/generate.js` sur Vercel), qui garde les clés Anthropic et gère quotas et limites par compte. Claude dirige (brief, choix des plans, rythme, textes, JSON des calques) ; la transcription des voix passe par un service dédié ou par la reconnaissance vocale d'Apple sur l'appareil.
- **Comptes** : un compte MaDA (Supabase Auth ou équivalent), plusieurs espaces de marque par compte. Si on propose Google, il faut aussi « Se connecter avec Apple » (règle App Store 4.8).
- **Paiement** : achat intégré Apple obligatoire pour l'abonnement Pro (règle 3.1.1), géré par RevenueCat. Grille validée par Ryan : 4,99 €/mois, 39,99 €/an, 69,99 € à vie (49,99 € au lancement), avec usage raisonnable de l'IA.
- **Rendu** : le JSON `{w, h, background, fx, layers[]}` reste le format pivot, quel que soit le moteur qui le dessine.

### Option A : Capacitor (l'appli web actuelle dans une coque native)

C'est la voie déjà engagée par la PR #1 (Capacitor iOS/Android, `com.madastudio.app`, galerie musicale, Pro via RevenueCat, partage natif).

- **Pour** : on garde tel quel `render.js`, `aidesign.js`, l'éditeur et le studio vidéo ; une seule base de code pour iOS, Android et le web ; première version sur l'App Store en quelques semaines.
- **Contre** : l'aperçu vidéo et la timeline tournent dans une WebView, loin des 60 images/s visées par `MISSION.md` dès qu'on empile plusieurs pistes ; l'export MP4 sur l'appareil demande un plugin natif (AVFoundation) à écrire, sinon il faut un rendu serveur (FFmpeg ou Remotion) qui coûte à chaque export ; Apple refuse les applis qui ressemblent à un site emballé (règle 4.2), il faut donc des fonctions natives visibles (photothèque, partage, export).

### Option B : React Native + Expo, avec modules natifs pour la vidéo

C'est l'architecture cible de `MISSION.md` (monorepo `apps/mobile`, `packages/engine`, `packages/video`).

- **Pour** : interface et gestes vraiment natifs ; timeline et aperçu fluides grâce à des modules Swift (AVFoundation, Metal) et à Skia ; export MP4 sur l'appareil, donc pas de coût serveur par vidéo ; iOS et Android restent possibles ; Expo simplifie la compilation, les mises à jour et l'envoi sur les stores.
- **Contre** : réécriture de l'interface (le moteur `render.js` et la logique de `aidesign.js` se portent en TypeScript, mais l'éditeur et le studio vidéo sont à refaire) ; plusieurs mois avant une version publiable ; les modules vidéo natifs demandent de vraies compétences Swift.

Variante possible si Ryan choisit B : partir de la PR #1 (A) pour sortir vite et tester le marché, puis migrer l'écran vidéo vers B. Une appli 100 % Swift/SwiftUI serait la plus performante, mais elle ferme Android et ne réutilise presque rien : non retenue comme option principale.

## Skills et plugins installés (portée projet)

Plugins officiels (marketplace `claude-plugins-official`, activés dans `.claude/settings.json`) :

| Plugin | Quand l'utiliser |
| --- | --- |
| `frontend-design` | Construire ou refaire un écran, une page ou un composant d'interface avec une vraie direction visuelle. |
| `skill-creator` | Écrire un skill propre à MaDA (par exemple le style maison du directeur artistique IA) ou améliorer un skill existant. |
| `claude-md-management` | Relire et tenir à jour ce fichier CLAUDE.md après une session de travail. |
| `claude-code-setup` | Proposer des automatisations pour le dépôt (hooks, sous-agents, serveurs MCP) quand la stack sera choisie. |

À ajouter seulement selon la stack retenue : `expo` (option B), `swift-lsp` (modules Swift), `revenuecat` (configurer produits et droits depuis Claude), `supabase`.

Skills communautaires (copiés dans `.claude/skills/`, provenance et vérifications dans `.claude/skills/SOURCES.md`) :

| Skill | Quand l'utiliser |
| --- | --- |
| `ui-ux-pro-max` | Choisir palette, typographie, styles et règles d'ergonomie (web et mobile), ou relire un écran pour l'accessibilité et la cohérence. |
| `design-taste-frontend` | Quand un écran ou une page fait « générique », « fait par une IA » : direction artistique stricte et boucle capture d'écran → corrections. Remplace `minimalist-ui`. |
| `remotion-best-practices` | Générer des vidéos par le code (modèles animés, rendu serveur MP4, sous-titres) avec Remotion. |
| `grill-me` (+ `grilling`) | Avant de coder une fonction ou de trancher un choix : se faire challenger question par question. Se lance avec `/grill-me`. |
| `content-strategy` | Planifier les sujets et piliers de contenu des comptes de Ryan et de MaDA. |
| `social` | Posts, scripts de vidéos courtes et calendrier pour TikTok, Instagram et YouTube. |
| `pricing` | Revoir la grille Pro, l'essai gratuit, le mensuel face à l'annuel et l'offre à vie. |
