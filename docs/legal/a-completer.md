# Pages légales : ce que Ryan doit fournir

Les pages `public/mentions-legales.html`, `conditions.html`, `confidentialite.html` et `aide.html` sont rédigées. Il reste les informations que seul l'éditeur connaît. Elles se remplissent à un seul endroit, `docs/legal/editeur.json`, puis `node scripts/legal.mjs` les place dans les pages. `node scripts/legal.mjs --strict` échoue tant qu'il manque un champ : à lancer avant l'envoi sur l'App Store.

## 1. Choisir un statut (avant tout le reste)

Vendre un abonnement suppose une activité déclarée. Le plus simple pour démarrer : entrepreneur individuel au régime micro (déclaration gratuite sur formalites.entreprises.gouv.fr, numéro SIREN sous une à deux semaines). Une SASU convient si un associé ou une levée de fonds est prévu. À trancher avec un expert-comptable ou l'avocat.

## 2. Les champs

| Champ | Exemple | Obligation |
| --- | --- | --- |
| `editeur_nom` | « Ryan Serres » ou « Ma DA SAS » | LCEN art. 1-1 (identité de l'éditeur) |
| `editeur_forme` | « entrepreneur individuel (EI) » | idem ; « EI » doit suivre le nom d'un entrepreneur individuel |
| `editeur_capital` | « 1 000 € », ou `""` pour un EI | société seulement |
| `editeur_adresse` | adresse, ou domiciliation (pour ne pas publier son domicile) | LCEN |
| `editeur_siren` | « SIREN 123 456 789, RNE » | LCEN |
| `editeur_tva` | « TVA non applicable, art. 293 B du CGI » en franchise, sinon le numéro FR… | Code de commerce |
| `contact_email` | contact@… | LCEN |
| `contact_tel` | un numéro joignable | LCEN |
| `directeur_publication` | le nom de Ryan | LCEN |
| `mediateur` | nom, adresse et site du médiateur | Code de la consommation, art. L612-1 : adhésion obligatoire avant de vendre à des particuliers |
| `email_donnees` | donnees@… | RGPD, art. 13 |
| `email_support` | aide@… | App Store (lien d'assistance obligatoire) |
| `email_droits` | droits@… | conseillé (ayants droit) |
| `email_contact_dsa` | peut être aide@… | DSA, art. 11 et 12 |
| `compteurs` | « Upstash Inc. » | RGPD (sous-traitant) |
| `compteurs_region` | « Francfort (Allemagne) » | choisir une région de l'Union à la création de la base |

Une seule adresse peut servir pour tous les e-mails au début (par exemple contact@ le domaine de Ma DA).

## 3. Les démarches à faire soi-même

1. **Médiateur de la consommation** : adhérer à un médiateur agréé par la CEMC (liste sur economie.gouv.fr/mediation-conso). L'adhésion est payante, à comparer.
2. **Anthropic** : l'accord de traitement des données (DPA) fait partie des conditions commerciales de l'API ; vérifier qu'il est bien accepté sur la console Anthropic du compte qui porte la clé, et le garder en PDF. Pour aller plus loin, demander l'option « zéro rétention » (ZDR) à Anthropic : la politique de confidentialité pourra alors dire « rien n'est gardé ».
3. **Vercel** : `vercel.json` place désormais le serveur à Paris (`"regions": ["cdg1"]`). Accepter le DPA de Vercel dans les réglages de l'équipe.
4. **Upstash** (si utilisé) : créer la base dans une région de l'Union européenne.
5. **App Store Connect** : renseigner l'URL de la politique de confidentialité et l'URL d'assistance (les pages du site), et les réponses de `docs/app-store/confidentialite.md`.
6. **Registre des traitements** : `docs/legal/registre.md`, à garder à jour (RGPD, art. 30).
7. **Relecture par un avocat** : envoyer le dossier préparé (lien dans le fil du projet) avec les quatre pages.
8. **ElevenLabs** (voix off, étape 5) : créer le compte, accepter son DPA, vérifier combien de temps il garde les textes et les sons générés (et s'il propose une option sans conservation), puis remplir `elevenlabs_retention` dans `docs/legal/editeur.json`. Vérifier aussi que la licence de l'offre choisie autorise l'usage commercial des voix.
9. **Instagram** (étape 8) : l'app Meta (Instagram API with Instagram Login) demande, pour la validation, l'URL de la politique de confidentialité (déjà à jour sur la connexion Instagram), une URL de suppression des données (la page d'aide, qui explique « Déconnecter » et la suppression du compte) et une vidéo de démonstration.
