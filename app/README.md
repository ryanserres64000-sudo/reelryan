# App iPhone MaDa (Expo)

L'inscription (lot 4 : profil, questionnaire, logo, carnet de marque), puis le parcours import → brief → musique → génération → résultat (lots 2 et 3), avec des rushes d'exemple tant que le module natif vidéo n'existe pas. Le catalogue du design system s'ouvre avec `#catalogue` dans l'aperçu web.

- `src/design/tokens.ts` : généré depuis `../design/tokens.json` par `node ../design/build.mjs`. Ne pas modifier à la main.
- `src/design/` : thème clair et sombre (sombre par défaut), `Text`, composants (boutons, puces, cartes de rush, frise, sélecteur de musique, forme d'onde, paywall, pastille « Enregistré », écran de génération).
- `src/copy/fr.ts` : tous les textes de l'app, au ton MaDa.
- `src/flow/` : l'enchaînement des écrans, les données d'exemple, le client de `POST /api/montage`.
- `src/brand/` : la marque gardée sur l'iPhone (AsyncStorage), la lecture des couleurs du logo (copie 64 × 64 décodée en JS, sans IA) et l'appel unique à `POST /api/adn`. Sans serveur, le carnet est écrit à partir du profil (`offlineDna` dans `../core/brand.ts`).
- `src/music/` : téléchargement du lien MP3, import de fichier, cache (`sound.ts` sur iPhone, `sound.web.ts` pour l'aperçu web). Les règles et la détection du tempo sont dans `../core/music.ts`.
- `modules/mada-audio/` : module natif Swift qui décode un son avec AVAudioFile. Pas encore compilé : il faut Xcode. Sans lui, l'app propose « Tape le rythme ».
- `src/visual/` : les visuels (lot 6) : rendu des calques `{w, h, background, fx, layers[]}` en vues natives (`DesignView.tsx`, SVG pour formes et photos, vrais `Text` pour les textes), les 12 polices OFL, l'appel à `POST /api/visuel` avec mise en page hors ligne, et les 20 derniers visuels gardés sur l'iPhone.
- `src/export/` : export PNG d'un visuel (capture à taille réelle, Photos en écriture seule, feuille de partage) et pont vers le futur module natif `MadaVideo` (AVFoundation), absent tant que l'app n'est pas compilée sur Mac.
- `src/plans/` : offres et compteur des créations IA offertes (copie locale de `core/plans.ts`, le vrai compte est sur le serveur), identifiant d'appareil anonyme dans le trousseau (`expo-secure-store`), pont vers le futur module natif StoreKit `MadaStore`. `src/legal.ts` : liens Conditions et Confidentialité (`EXPO_PUBLIC_MADA_SITE`).
- `src/consent.ts` : accord daté avant tout envoi à l'IA, demandé au premier besoin (`ConsentScreen`), modifiable dans Réglages ; sans accord, `aiUrl()` renvoie null et l'app passe à la main ou hors ligne. `src/account.ts` : suppression du compte (iPhone et serveur).
- `src/screens/` : les écrans. Aucune couleur, taille ni texte en dur : `node ../design/check-hardcoded.mjs` le vérifie.

Serveur : `EXPO_PUBLIC_MADA_API` (adresse du serveur) et `EXPO_PUBLIC_MADA_ACCESS` (code `APP_PASSWORD`) dans `app/.env`. Sans eux, l'app fonctionne hors ligne avec des réponses d'exemple.

Commandes : `npm run typecheck`, `npx expo export --platform web` (aperçu dans un navigateur), `npx expo run:ios` sur un Mac avec Xcode (dev build).
Les dépendances suivent le SDK 58 (`node_modules/expo/bundledNativeModules.json`).
