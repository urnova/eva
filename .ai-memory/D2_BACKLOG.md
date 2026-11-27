# EVA — Backlog Exhaustif D2 (Verrouillé depuis l'historique complet)

> Créé le 2026-11-26 avant exécution D1. Ce document préserve **100 %** des exigences formulées pour la **D2** afin qu'aucune fonctionnalité ne soit oubliée après validation de D1.

---

## 1. Architecture Dual Codemod + MCP & Anti-Conflit Natif vs MCP
- Support conjoint **MCP** et **Codemod** (alternative économe en tokens à MCP) sélectionnable **par plateforme/service**.
- Gestion sans doublon entre Codemod, MCP et agents natifs : **1 seule source de vérité par service** (ex. Google Agenda natif vs MCP Calendar mutuellement exclusifs ; Gmail natif vs MCP Gmail mutuellement exclusifs ; Notes EVA + MCP Notion/GitHub peuvent coexister proprement).
- Construction dynamique du system prompt EVA en fonction des modes activés.

## 2. Connecteurs Google Workspace (Agenda + Gmail) & Phase 2 + Fonction Live
- **Onboarding Google Workspace** à la création du compte (et badge Paramètres pour comptes existants) pour connecter Google Agenda & Gmail via OAuth en 1 clic (avec bouton *Plus tard*), plus toggle Activer/Désactiver/Déconnecter dans **Paramètres → Connecteurs**.
- **Agent Google Agenda complet (style Jarvis)** : lire aujourd'hui / prochains événements, rechercher, créer, modifier, déplacer, supprimer — **validation explicite obligatoire (boutons texte + vocal)** avant toute création/modification/suppression.
- **Agent Gmail complet** : résumer les mails récents (1h / aujourd'hui / non lus), lire le contenu complet, rédiger une réponse / un nouveau mail en brouillon — **jamais d'envoi ni de suppression sans validation humaine explicite** (bouton *Envoyer* / double confirmation suppression).
- **Phase 2 connecteurs** : Notion, GitHub (via MCP/Codemod).
- **Fonction Live** : intégrer la fonction Live complète prévue en D2 (à revalider/détailler ensemble avant démarrage D2).

## 3. Refonte UI/UX Complète (PC + Web + Mobile, basée sur Prototype V4 corrigé)
- **Identité & Polices** : thème sombre `#0d0d14 / #13131f / #1a1a2e`, accent `#00d4ff` & dégradé `#8b5cf6` ; **remplacer complètement l'ancienne police** par `Inter` + `Orbitron` hébergées/servies proprement (zéro erreur MIME `'text/html'` sur `chat.html` en Electron).
- **Suppression totale de l'avatar / personnage 3D EVA** pour un chat épuré.
- **En-tête dynamique du chat** : remplacer l'ancien rond bleu moche par le **logo EVA animé + salutation** (*« Bonjour Enzo... »*).
- **Indicateur de réflexion** : 3 points animés discrets à la place de la grosse barre de progression.
- **Nouvelle barre de saisie arrondie** :
  - Drag & drop de fichiers + bouton trombone + aperçu en **puce/chip compacte** (nom du fichier + croix de suppression, remplaçant l'ancienne barre moche).
  - Sélecteur de modèle intégré dans la barre.
  - **Bouton « Recherche approfondie » (Deep Search)** à la place du bouton « Web » redondant (l'outil navigateur web d'EVA étant déjà actif par défaut).
  - **Animation Micro style Antigravity** (bulle rouge + barres audio réactives).
- **Bulles, Avatar utilisateur, Agents & Suggestions** :
  - Bulles utilisateur (gradient asymétrique) avec **vraie photo de profil Google/Firebase** (ou initiale du vrai nom — jamais le vieux `U`).
  - **Bulles dédiées par Agent** (CloudWorks, Agenda, Gmail, etc.) + design final harmonisé de la bulle overlay Windows & tracker.
  - **3 suggestions de suivi cliquables style Perplexity** après les réponses EVA.
- **Sidebar** : supprimer le gros bouton moche *« Nouvelle conversation »* (petit `+` discret) ; **corriger « PC Desktop » qui s'enchevêtre avec l'icône paramètres** ; remplacer l'engrenage par `SlidersHorizontal` ; **séparer les conversations vocales (`isVoiceSession`) des conversations textuelles** (afficher par défaut uniquement les chats textuels dans la liste principale et ranger les sessions vocales fréquentes dans une section/onglet dédié).
- **Pages secondaires refaites intégralement (PC + Web)** :
  - **Paramètres** à onglets (Général, IA, Voix, Connecteurs MCP/Codemod, Compte/Sessions, Expérimental, Avancé) ; corriger section Notifications PC (pas de message navigateur/cadenas) ; cerveau/mémoire sélective (uniquement faits personnels durables, pas les recherches ponctuelles).
  - **À propos d'EVA** (soignée, logo animé, version, liens réels).
  - **Signaler un problème** (formulaire réel connecté à Firebase `reports`).
  - **Notes / Alarmes / Rappels** (CSS harmonisé sans casser la logique).
  - **Page CloudWorks PC vs Web** : totalement distinctes mais design unifié ; corriger sur Web la ré-ouverture en boucle des résultats `screenshot`/`sysinfo` déjà consultés.
- **Responsive Mobile (Web)** : `100dvh`, drawer latéral, barre sticky avec `safe-area-inset-bottom`, onglets Paramètres scrollables.
- **Vitrine / Téléchargement / Pages légales** : cohérence Accueil/Téléchargement, téléchargement direct dernière release sans 404, affichage profil connecté cohérent.

## 4. Génération & Visualisation de Documents (PC + Web)
- **PDF** : HTML/CSS multi-thèmes → rendu en **vraies pages A4** portrait (par défaut) ou paysage avec séparation et pagination `1/2, 2/2`, téléchargement `.pdf` réel valide, impression fidèle au visuel, réutilisation des photos/images envoyées dans le chat (ex. CV).
- **PowerPoint (PPTX)** : PptxGenJS avec Slide Masters multi-thèmes + **vrai visualiseur slide-par-slide** + export `.pptx` & impression fonctionnels.
- **Excel (XLSX), HTML/Code, Texte** : rendu tableur propre, éditeur avec coloration + numéros de ligne (style VS Code) pour HTML/code, vue Bloc-notes pour `.txt`.
- **Visualiser / Télécharger / Imprimer** fonctionnels sur **PC ET Web** + **persistance des pièces jointes et documents générés** dans les conversations Firebase après rechargement.

## 5. Providers IA, Barres de Quota, Délai & Image/Vidéo/Audio
- **Provider Gemini** (texte + TTS si pertinent) et recherche d'éventuel meilleur provider gratuit/OAuth sans friction (ou consolidation Puter avec statut sidebar + onboarding 1 clic).
- **Barres de quota visuelles** par modèle / provider.
- **Délai configurable entre requêtes** (activé par défaut pour éviter les rate-limits, désactivable dans Paramètres).
- **Cascade fallback opt-in** (désactivée par défaut dans Paramètres — **jamais silencieuse** si désactivée).
- **Génération Image / Vidéo / Audio** : **désactivée par défaut** tant que non configurée dans Paramètres ; sélecteur de provider dédié (Pollinations, Gemini Imagen, etc.) + rendu direct dans la bulle EVA.

## 6. Gestion des Sessions & Appareils Connectés
- Synchro bidirectionnelle **Compte ↔ CloudWorks** : badge *« Cette session »*, dernière activité, distinction app installée vs dev, empreinte machine/MAC stable pour éviter les appareils en double à chaque reconnexion, et bouton **« Révoquer »** déconnectant immédiatement la session (et notifications associées) sans boucle infinie *« Utilisateur : Chargement »*.

## 7. Conscience Plateforme / Multi-PC, Persistance Modèles & Fluidité
- Conscience PC vs Web dans le prompt EVA (PC connaît le nom de sa machine locale et la privilégie ; Web liste les PC en ligne/hors ligne).
- Persistance absolue du modèle LLM (2 Go) et des modèles STT entre redémarrages/mises à jour tout en restant désinstallables proprement si désinstallation complète.
- Double splash screen fluide post-login + suppression des erreurs console (`firebase-messaging-sw.js` MIME, Google Fonts bloquées).
