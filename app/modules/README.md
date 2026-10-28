# Modules natifs de MaDa (Swift, Expo Modules API)

Ils sont écrits mais **pas encore compilés** : il faut un Mac avec Xcode. Expo les trouve tout seul
dans `app/modules/` (autolinking). Tant qu'ils ne sont pas compilés, l'app fonctionne avec ses données
d'exemple et le dit à l'écran.

| Module | Rôle | Côté JS |
| --- | --- | --- |
| `mada-audio` | Décode un son en mono pour trouver le tempo (lot 3) | `src/music/sound.ts` |
| `mada-vision` | Tri des plans sur l'iPhone : netteté, lumière, visages, changements de plan, parole, petites images clés | `src/flow/triage.ts`, règles dans `core/triage.ts` |
| `mada-video` | Une seule composition AVFoundation pour l'aperçu (`AVPlayer`) et l'export (`AVAssetExportSession`) : cadrage 9:16, mouvements, couleurs, transitions, textes, logo, musique, métadonnées « Montage assisté par IA », enregistrement dans Photos | `src/video/Preview.tsx`, `src/video/sources.ts`, `src/export/video.ts` |
| `mada-store` | Abonnement StoreKit 2 : produits, achat (avec l'identifiant d'appareil en `appAccountToken`), restauration, droits actifs, JWS pour le serveur | `src/plans/storekit.ts` |

## Compiler sur le Mac

1. `cd app && npm install`
2. `npx expo prebuild --platform ios` (crée `ios/`), puis `npx expo run:ios --device` sur un iPhone branché.
3. Erreurs Swift : ouvrir `ios/MaDA.xcworkspace` dans Xcode ; le plugin `swift-lsp` aide aussi.

## À tester sur l'iPhone, dans cet ordre

1. **Tri** : importer 5 vidéos (portrait, paysage, une floue, une sombre) et 2 photos. Les badges flou, sombre, visage et parole doivent être justes. Régler `SCENE_THRESHOLD` dans `src/flow/triage.ts` si les changements de plan sont mal repérés.
2. **Aperçu** : sur l'écran de résultat, la vidéo doit être droite (pas couchée), remplir le 9:16 et montrer textes et logo dans la zone sûre.
3. **Export** : les 3 fichiers arrivent dans Photos, avec la même image que l'aperçu. Vérifier la mention dans les métadonnées : `exiftool fichier.mp4 | grep -i description`.
4. **Achat** : avec un fichier StoreKit de test dans Xcode (produits `mada.pro.an`, `mada.pro.mois`, `mada.pro.semaine`), puis en bac à sable.
5. **Mesures** (étude, ch. 9) : montage en moins de 60 s, export en moins de 20 s pour 30 s de vidéo, moins de 3 % de batterie.

Pas encore fait : les sous-titres (il faudra la transcription sur l'appareil avec `Speech`), App Attest, et
la vérification des JWS par le serveur (App Store Server API).
