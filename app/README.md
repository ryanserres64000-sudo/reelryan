# App iPhone MaDa (Expo)

Le parcours import → brief → musique → génération → résultat (lots 2 et 3), avec des rushes d'exemple tant que le module natif vidéo n'existe pas. Le catalogue du design system s'ouvre avec `#catalogue` dans l'aperçu web.

- `src/design/tokens.ts` : généré depuis `../design/tokens.json` par `node ../design/build.mjs`. Ne pas modifier à la main.
- `src/design/` : thème clair et sombre (sombre par défaut), `Text`, composants (boutons, puces, cartes de rush, frise, sélecteur de musique, forme d'onde, paywall, pastille « Enregistré », écran de génération).
- `src/copy/fr.ts` : tous les textes de l'app, au ton MaDa.
- `src/flow/` : l'enchaînement des écrans, les données d'exemple, le client de `POST /api/montage`.
- `src/music/` : téléchargement du lien MP3, import de fichier, cache (`sound.ts` sur iPhone, `sound.web.ts` pour l'aperçu web). Les règles et la détection du tempo sont dans `../core/music.ts`.
- `modules/mada-audio/` : module natif Swift qui décode un son avec AVAudioFile. Pas encore compilé : il faut Xcode. Sans lui, l'app propose « Tape le rythme ».
- `src/screens/` : les écrans. Aucune couleur, taille ni texte en dur : `node ../design/check-hardcoded.mjs` le vérifie.

Commandes : `npm run typecheck`, `npx expo export --platform web` (aperçu dans un navigateur), `npx expo run:ios` sur un Mac avec Xcode (dev build).
Les dépendances suivent le SDK 58 (`node_modules/expo/bundledNativeModules.json`).
