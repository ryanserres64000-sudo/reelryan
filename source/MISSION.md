# MISSION — Terminer MaDA

> À lire en entier avant toute action. Ce document est la référence produit et technique. CLAUDE.md décrit l'état actuel du code ; ce fichier décrit où on va et comment y aller.

## 1. Ton rôle

Tu es le directeur technique et l'équipe de développement de **MaDA** (nom provisoire, « ma DA » = ma directrice artistique). Ton objectif : transformer le prototype de ce dossier en une application **mobile et web** de niveau professionnel, publiable sur l'App Store et Google Play, aussi fluide que les meilleures applications de création vidéo du marché (Edits d'Instagram, CapCut, TikTok), mais **plus puissante grâce à l'IA intégrée partout**.

Le propriétaire du produit, Ryan, n'est pas développeur : explique tes choix simplement, en français, et demande sa validation aux moments indiqués.

## 2. La promesse produit

**« Tu as l'idée. MaDA fait le reste. »**

Un créateur, un BDE, une marque ou une agence ouvre l'application, importe ses photos et vidéos ou écrit simplement son idée, et obtient en moins de 2 minutes un contenu prêt à publier : Reel, TikTok, story, post, carrousel, flyer, affiche. Il peut tout retoucher à la main comme dans un éditeur professionnel, ou en parlant à l'IA.

Règle d'or de l'expérience : **3 gestes maximum entre l'idée et un contenu publiable.** La puissance est là, mais cachée tant qu'on n'en a pas besoin.

Publics : créateurs et influenceurs, associations étudiantes (BDE), marques et établissements (hôtellerie, restauration, événementiel), agences gérant plusieurs comptes.

## 3. Point de départ

- `CLAUDE.md` : organisation du prototype actuel.
- Prototype web fonctionnel, à réutiliser comme base de logique :
  - `render.js` : moteur de rendu des visuels par calques (fonds, texte, formes, images masquées, motifs, duotone, grain).
  - `aidesign.js` : directeur artistique IA (schéma JSON des calques, consignes de composition, création, relecture critique sur le rendu, retouches, adaptation de format).
  - `editor.js` : éditeur de calques, variantes, export.
  - `video_src.html` : montage vidéo IA (sélection des moments, calage sur le tempo, textes animés, transitions).
  - `pages.js` : espaces de marque, analyse Instagram par captures, idées et veille.
  - `standalone/api/claude.js` : appel serveur à l'API Claude (clé côté serveur).
- Le cahier des charges et le guide (partagés par Ryan) détaillent offres, rôles, coûts et feuille de route.

## 4. Exigences de qualité (non négociables)

- **Fluidité** : aperçu et timeline à 60 images/seconde sur un iPhone récent ; défilement sans saccade ; aucune action de l'interface ne bloque plus de 100 ms (le travail lourd part en tâche de fond avec une progression visible).
- **Démarrage** : application utilisable en moins de 2 secondes après ouverture.
- **Export** : vidéo 1080×1920 en 30 images/seconde (60 en option), H.264 / AAC, compatible Instagram et TikTok ; un Reel de 30 s exporté en moins de 30 s sur un appareil récent (rendu sur l'appareil quand c'est possible, sur serveur sinon).
- **Fiabilité** : aucune perte de travail (sauvegarde automatique, reprise après fermeture, historique annuler / rétablir illimité dans un projet).
- **Qualité créative** : jamais de rendu « bateau ». Chaque génération IA passe par la boucle création → rendu → relecture critique → corrections. Typographie, composition, couleurs et rythme au niveau d'une agence.
- **Accessibilité** : tailles de texte dynamiques, contrastes, VoiceOver sur les écrans principaux.
- **Langues** : français d'abord, interface prête pour l'anglais (i18n dès le départ).
- **Tests** : tests automatiques sur le moteur de rendu, la logique IA (sorties JSON validées) et les parcours principaux ; aucune phase n'est terminée si des tests échouent.

## 5. Architecture cible

Monorepo TypeScript, propose les versions exactes après vérification de ce qui est maintenu en 2026 :

```
apps/mobile     Application iOS / Android (React Native + Expo, modules natifs pour la vidéo)
apps/web        Application web et page d'accueil (Next.js)
packages/engine Moteur de composition partagé : calques, rendu, animations, export d'images
packages/video  Modèle de timeline multipiste, effets, transitions, export vidéo
packages/ai     Orchestrateur IA : prompts, schémas, validation, relecture, coûts
packages/ui     Composants et thème partagés
supabase/       Base de données, sécurité par ligne, stockage, fonctions
workers/        Rendu vidéo serveur (FFmpeg), transcription, tâches longues, agents planifiés
```

- Base de données, authentification et stockage : Supabase (ou équivalent, à justifier).
- Paiements : abonnements in-app sur iOS et Android (obligatoires pour les fonctionnalités numériques vendues dans l'app) et Stripe sur le web ; un seul système de droits côté serveur.
- Clés API toujours côté serveur, jamais dans l'application.
- Hébergement des données en Europe (RGPD).

## 6. Fonctionnalités

### 6.1 Création en un geste (le cœur)
- Barre « Dis-moi ce que tu veux » sur l'écran d'accueil : texte ou voix.
- L'IA déduit le format (Reel, TikTok, story, post, carrousel, flyer, affiche), choisit les médias pertinents, compose, relit, et livre **3 propositions** en parallèle.
- Modèles intelligents : l'utilisateur choisit un style (luxe, soirée, food, street, minimal…) et l'IA l'adapte à ses médias et à sa marque.
- Mode « Événement » : à partir d'une date, d'un lieu et d'un thème, générer en une fois l'affiche, la story d'annonce, le compte à rebours, le Reel teaser et la légende.

### 6.2 Éditeur vidéo (niveau Edits / CapCut)
- Timeline multipiste : vidéo, superpositions (incrustation d'image ou de vidéo), texte, sous-titres, musique, voix, effets sonores.
- Découpe, fractionnement, ordre par glisser-déposer, vitesse (y compris rampes de vitesse), marche arrière, gel d'image.
- Images clés (keyframes) sur position, échelle, rotation, opacité ; courbes d'accélération.
- Transitions, filtres, réglages couleur (exposition, contraste, saturation, température, LUT).
- Texte animé avec styles prêts à l'emploi ; stickers ; formes.
- Fond vert et suppression d'arrière-plan vidéo ; masques.
- Audio : volume par piste, fondus, réduction de bruit, normalisation, atténuation automatique de la musique sous la voix (ducking).
- Recadrage 9:16, 4:5, 1:1, 16:9 avec **recadrage intelligent qui suit le sujet**.
- Enregistrement direct depuis l'appareil photo, avec compte à rebours et téléprompteur.
- Brouillons, duplication de projet, export en arrière-plan.

### 6.3 IA intégrée au montage
- **Montage automatique** à partir d'un lot de médias et d'une consigne (déjà prototypé).
- **Calage sur le rythme** de la musique (déjà prototypé : détection du tempo).
- **Sous-titres automatiques** par transcription, styles animés mot à mot, correction en un geste, traduction.
- **Suppression automatique** des silences, hésitations et mots parasites.
- **Meilleurs moments** : repérer dans une longue vidéo les passages forts et proposer des clips courts.
- **Accroche** : proposer 3 débuts de vidéo plus percutants (texte d'accroche + premier plan).
- **Voix off** générée à partir d'un texte, en français et en anglais.
- **Script vers vidéo** : un script ou une idée devient un plan de tournage, puis un montage.
- **Retouches en conversation** : « plus rythmé », « coupe la deuxième partie », « mets le logo à la fin ».
- **Score avant publication** : l'IA évalue l'accroche, le rythme, la lisibilité et propose des corrections.

### 6.4 Studio visuel
- Tout l'existant du prototype (calques, masques, motifs, duotone, relecture critique, variantes, adaptation de format), porté sur mobile avec des gestes naturels (pincer, faire pivoter, glisser).
- Carrousels multi-pages cohérents.
- Génération et retouche d'images par IA : fonds, objets, détourage, agrandissement, gomme magique. Comparer 2 ou 3 fournisseurs sur de vrais briefs avant de choisir.
- Kit de marque appliqué automatiquement (couleurs, polices, logo, ton).
- Export PNG, JPG, PDF d'impression.

### 6.5 Marque, stratégie et veille
- Espaces de marque multiples, rôles, invitations, circuit de validation client (déjà conçu dans le prototype et le cahier des charges).
- Analyse de compte : par captures (existant) puis par connexion officielle.
- Idées de contenus, calendrier éditorial, agent de veille hebdomadaire sur les tendances.
- Légendes, hashtags et meilleur horaire de publication.

### 6.6 Publication
- Partage natif (feuille de partage iOS / Android) dès la première version.
- Publication directe et programmation via les API officielles d'Instagram et de TikTok, une fois les validations des plateformes obtenues.

### 6.7 Musique
- Bibliothèque de musiques **libres de droits sous licence commerciale** (fournisseur à proposer avec son coût). Ne jamais intégrer de musiques sans licence, ni la bibliothèque sonore d'Instagram ou de TikTok.
- Import des musiques de l'utilisateur, avec un avertissement sur les droits.

## 7. Intelligence artificielle

- Modèle principal : Claude par l'API Anthropic (vérifie la documentation à jour pour les modèles et les tarifs). Utilise un modèle rapide pour les petites tâches et le plus capable pour la direction artistique.
- Toute sortie IA structurée passe par un schéma validé (comme `sanitizeDesign`) ; une sortie invalide est corrigée ou relancée, jamais affichée cassée.
- Mise en cache, quotas par utilisateur et par offre, suivi du coût réel par génération ; objectif : coût IA moyen inférieur à 30 % du prix de l'abonnement.
- Aucun contenu client utilisé pour entraîner des modèles ; mention des contenus générés par IA quand les plateformes l'exigent.

## 8. Exigences des stores (à respecter dès la conception)

- Suppression du compte possible depuis l'application.
- Si une connexion Google est proposée, proposer aussi « Se connecter avec Apple ».
- Achats des fonctionnalités numériques via les achats intégrés d'Apple et de Google.
- Étiquettes de confidentialité, politique de confidentialité, conditions d'utilisation, classification d'âge, signalement et modération si du contenu est partagé entre utilisateurs.
- Vérifie les règles à jour d'Apple et de Google avant chaque soumission.

## 9. Méthode de travail

Pour **chaque phase** :
1. Passe en mode plan. Lis les fichiers concernés, recherche les bibliothèques maintenues, et présente à Ryan un plan court : ce que tu vas faire, les choix techniques, les services payants nécessaires et leur coût, les critères de réussite.
2. Attends sa validation avant de coder.
3. Avance par petites étapes testables ; fais un commit à chaque étape réussie.
4. Écris et lance les tests ; corrige jusqu'à ce que tout passe.
5. Termine par une démonstration : comment Ryan peut tester lui-même (sur son téléphone avec Expo Go ou une version de test, et sur le web).
6. Mets à jour `CLAUDE.md` (état actuel, décisions, prochaine phase).

Règles permanentes :
- Ne mets jamais de clé ou de mot de passe dans le code ni dans Git ; utilise des fichiers `.env` exclus de Git.
- Ne souscris à aucun service payant sans l'accord de Ryan.
- En cas de doute sur un besoin produit, pose une question courte plutôt que d'inventer.
- Préfère une fonctionnalité finie et soignée à trois fonctionnalités à moitié faites.

## 10. Phases

| Phase | Contenu | Terminé quand |
| --- | --- | --- |
| 0 | Audit du prototype, choix de la stack, monorepo, CI, design system (thème, typographie, composants), i18n | L'app mobile et le web s'ouvrent avec la navigation et le thème |
| 1 | Comptes (e-mail, Apple, Google), organisations, espaces de marque, stockage des médias, synchronisation | Créer un compte sur le téléphone, retrouver ses espaces sur le web |
| 2 | Moteur partagé (`packages/engine`) porté depuis le prototype + studio visuel mobile + directeur artistique IA | Créer, retoucher et exporter un flyer et une story depuis le téléphone |
| 3 | Éditeur vidéo : timeline multipiste, découpe, texte, transitions, filtres, musique, export sur l'appareil | Monter et exporter un Reel de 30 s fluide sur iPhone |
| 4 | IA vidéo : montage automatique, calage sur le rythme, sous-titres, suppression des silences, meilleurs moments, accroches, voix off | Une idée + 10 médias donnent un Reel sous-titré en moins de 2 minutes |
| 5 | Fonctions avancées : images clés, rampes de vitesse, fond vert, recadrage intelligent, masques, réduction de bruit | Parité avec les fonctions clés d'Edits / CapCut |
| 6 | Marque, idées, calendrier, veille, analyse de compte, légendes et hashtags | Un plan de contenu hebdomadaire généré et relié aux créations |
| 7 | Abonnements (achats intégrés + Stripe), quotas IA, page Compte | Souscrire avec un compte de test et voir les quotas appliqués |
| 8 | Publication directe Instagram et TikTok (après validations), programmation | Publier un Reel depuis MaDA sur un compte de test |
| 9 | Performance, sécurité, accessibilité, tests de bout en bout, conformité stores, soumission | Application acceptée sur TestFlight puis sur l'App Store |

Commence par la **phase 0**.
