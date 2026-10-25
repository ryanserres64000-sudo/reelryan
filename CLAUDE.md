# MaDA — contexte du projet

Studio de création assisté par IA pour créateurs, influenceurs, marques et agences : visuels (flyers, affiches, stories, posts, collages, pubs), montage vidéo, identité de marque, analyse Instagram, idées et veille. Toute l'interface est en français. Propriétaire du produit : Ryan.

Nom commercial : **MaDA : Studio créatif IA** (« ma DA », ma directrice artistique). Promesse : créer posts, vidéos et stories pour Instagram et TikTok en toute simplicité. Les bases IndexedDB gardent leurs anciens noms (`ryanreel-studio`, `ryanreel`) pour ne pas perdre les données existantes.

## État actuel

Prototype fonctionnel en une seule page HTML, assemblée à partir des modules de `source/` par `source/build.py`. Deux sorties :

- `source/mada-studio.html` : version publiée dans Claude (artefact). L'IA passe par `claude.use("sample")`, la sauvegarde par `claude.use("db")`.
- `public/index.html` : version site web (déployée sur Vercel). `public/shim.js` remplace `window.claude` et appelle `/api/generate` (`api/generate.js` + `lib/claude.js`), qui garde la clé API Anthropic côté serveur, applique le code d'accès `APP_PASSWORD` et une limite de demandes par visiteur (`MAX_PER_HOUR`). `server.js` sert la même chose hors Vercel.

Application mobile : Capacitor emballe `public/` (`npm run mobile:build` → `www/`, puis `ios/` et `android/`). `scripts/build-mobile.mjs` injecte `MADA_API_BASE` (adresse du serveur) et les clés publiques RevenueCat ; `shim.js` expose alors `window.MadaServer` (musique, statut Pro) et `window.MadaNative` (partage natif, enregistrement). Serveur : `api/music.js` (`lib/music.js`, catalogue Jamendo), `api/status.js` et `lib/pro.js` (abonnement RevenueCat, quota gratuit), `lib/cors.js` (origines de l'app). Comptes (facultatifs) : Supabase (`public/vendor/supabase.js`, schéma dans `supabase/schema.sql`) ; connecté, `Store` passe en mode « cloud » via `SupaDB` (table `mada_docs`). Instagram / TikTok : `lib/social.js` (connexion officielle, publication, statistiques ; jetons chiffrés par `lib/seal.js` dans `mada_social`), routes `/api/social/<action>`, suppression du compte `/api/account`. Plan des stores : https://claude.ai/artifact/MRN1UeigwGgb5yE8goHvV3

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
| `music.js` | Galerie de musique : recherche, écoute, « Mes musiques » hors connexion, import |
| `pro.js` | MaDA Pro : statut, écran d'achat (RevenueCat), carte du compte |
| `auth.js` | Comptes (e-mail par code, Apple, Google), synchronisation `SupaDB`, suppression du compte, premier lancement guidé |
| `social.js` | Connexion Instagram / TikTok, écran « Publier », page Statistiques et conseils de l'IA |
| `pages.js` | Coquille, navigation, accueil, identité de marque, analyse Instagram, idées et veille, galerie, compte, démarrage |
| `video_src.html` | Studio vidéo d'origine ; `build.py` le préfixe (`v-`) et l'enferme dans le module `Video` |

## Points clés

- Un visuel = un JSON `{w, h, background, fx, layers[]}` ; l'IA produit ce JSON, `sanitizeDesign` le valide, `renderDesign` le dessine.
- Les images sont des « assets » stockés en IndexedDB (par espace), référencés par id ; l'IA les voit sous des alias (`img1`, `logo`).
- Qualité : création → rendu → relecture critique sur l'image rendue → corrections.
- La veille hebdomadaire est une tâche planifiée Claude qui écrit dans la collection `veille` de la base de l'artefact (version Claude uniquement).
- Le cap produit et technique complet est dans `source/MISSION.md`.

## Prochaines étapes (cahier des charges, phase 1 — MVP)

1. Passer à une vraie application : Next.js + API Node, PostgreSQL (Supabase), authentification (e-mail, Google, Apple), stockage des médias en ligne.
2. Organisations, espaces de marque, rôles et invitations.
3. Rendu vidéo côté serveur en MP4 (FFmpeg) et transcription automatique des voix.
4. Abonnements Stripe et quotas d'IA.
5. Préparer le dossier de validation Meta pour la connexion Instagram (phase 2).

Réutiliser `render.js`, `aidesign.js` et la logique de l'éditeur : c'est le cœur du produit.
