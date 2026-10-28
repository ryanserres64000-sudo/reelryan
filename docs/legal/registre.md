# Registre des traitements (RGPD, article 30)

Responsable : l'éditeur de Ma DA (voir `public/mentions-legales.html`). Contact : l'adresse `email_donnees`. Pas de délégué à la protection des données obligatoire à ce stade (pas de suivi à grande échelle, pas de données sensibles traitées comme telles). Mise à jour : 28 octobre 2026.

| Traitement | Finalité | Base légale | Personnes | Données | Destinataires, sous-traitants | Hors UE | Durée |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Montage et retouche par l'IA | Monter la vidéo demandée | Contrat (6.1.b), accord explicite dans l'app | Utilisateurs, personnes filmées | 15 à 30 images basse résolution, durées des rushes, brief, carnet de style résumé | Serveur Ma DA (Vercel, Paris), Anthropic | États-Unis (Anthropic), DPA et clauses types | Serveur : rien après la réponse ; Anthropic : 30 jours (2 ans en cas d'abus) |
| Carnet de style (ADN de marque) | Écrire le carnet à l'inscription | Contrat, accord explicite | Utilisateurs | Réponses au questionnaire, couleurs du logo | Vercel, Anthropic | États-Unis (Anthropic) | idem |
| Création de visuels | Composer l'affiche ou le post | Contrat, accord explicite | Utilisateurs, personnes photographiées | Photos et logo réduits à 512 px | Vercel, Anthropic | États-Unis (Anthropic) | idem |
| Créations offertes et quotas | Appliquer les offres, éviter les abus | Contrat ; intérêt légitime après suppression du compte | Utilisateurs | Identifiant d'appareil aléatoire, compteurs, adresse IP (plafond par IP, en mémoire) | Upstash ou Vercel KV | selon la région choisie (à prendre dans l'UE) | Compte actif ; après suppression, le compteur des offertes seul, sans lien avec la personne |
| Voix off | Écrire et lire le texte d'une voix off | Contrat, accord explicite | Utilisateurs | Texte de la voix off ou demande (l'enregistrement de sa propre voix reste sur l'iPhone) | Vercel, Anthropic (écriture), ElevenLabs (lecture) | États-Unis (Anthropic, ElevenLabs) ; DPA ElevenLabs à signer | Serveur : rien après la réponse ; ElevenLabs : à vérifier |
| Statistiques Instagram (facultatif) | Dire à la personne ce qui marche sur son compte | Contrat (fonction demandée), accord par l'écran d'autorisation d'Instagram | Utilisateurs ayant connecté un compte pro | Jeton d'accès chiffré (AES-256-GCM), nom du compte, abonnés, 30 dernières publications et leurs statistiques | Vercel ; Meta (responsable indépendant) | Non (serveur à Paris) | Jeton : jusqu'à déconnexion ou suppression ; chiffres : 6 h en cache |
| Lecture d'une capture de statistiques | Recopier les chiffres d'une capture | Contrat, accord explicite | Utilisateurs | Capture d'écran réduite à 1000 px | Vercel, Anthropic | États-Unis (Anthropic) | Serveur : rien après la réponse ; 20 par jour et par appareil |
| Abonnement | Donner accès à Pro | Contrat | Abonnés | Statut d'abonnement fourni par Apple | Apple (responsable indépendant) | selon Apple | Durée de l'abonnement |
| Assistance et droits | Répondre aux demandes | Intérêt légitime, obligation légale | Utilisateurs, ayants droit | E-mail, contenu de la demande | Messagerie choisie | selon la messagerie | 3 ans après le dernier échange |

Mesures de sécurité : clés d'IA côté serveur seulement, HTTPS, aucune vidéo entière transmise, aucun stockage d'images sur le serveur, consentement avant tout envoi, suppression du compte dans l'app.

Analyse d'impact (AIPD) : pas obligatoire a priori (pas de reconnaissance des visages, pas de profilage), à confirmer avec l'avocat.
