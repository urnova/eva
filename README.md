# 🚀 E.V.A V3 - Evolutionary Virtual Assistant

**Assistant virtuel intelligent propulsé par l'IA**

---

## ✨ Fonctionnalités

- 💬 **Chat IA** avec 6 providers (Qwen, Puter, OpenAI, Claude, LM Studio, Ollama)
- 🎤 **Synthèse vocale** (Microsoft Denise par défaut)
- 👂 **Reconnaissance vocale** (Web Speech API)
- 💾 **Conversations sauvegardées** (Firestore)
- ⏰ **Alarmes & Rappels**
- 📅 **Agenda** (événements)
- 📝 **Notes** (avec tags)
- 🖼️ **Analyse d'images** (GPT-4o)
- 📱 **100% Responsive** (Mobile/Tablet/Desktop)

---

## 🚀 Déploiement sur Netlify

### Méthode 1 : Drag & Drop (⚡ Recommandé)

1. Va sur [app.netlify.com](https://app.netlify.com)
2. Connecte-toi (ou crée un compte gratuit)
3. Clique **"Add new site"** → **"Deploy manually"**
4. **Glisse-dépose ce dossier complet**
5. Attends 30 secondes
6. ✅ Site en ligne !

### Méthode 2 : Git

```bash
# 1. Init git
git init
git add .
git commit -m "Initial commit - Eva V3"

# 2. Push to GitHub
# (Crée un repo sur GitHub first)
git remote add origin https://github.com/TON-USERNAME/eva-v3.git
git push -u origin main

# 3. Sur Netlify
# "Add new site" → "Import from Git" → Sélectionne ton repo
```

---

## ⚙️ Configuration Firebase

### 1. Créer un projet Firebase

1. Va sur [console.firebase.google.com](https://console.firebase.google.com)
2. Crée un nouveau projet
3. Active **Authentication** (Google + Email/Password)
4. Active **Firestore Database**

### 2. Configuration

Les credentials Firebase sont déjà dans `js/core/firebase-config.js`.

**⚠️ IMPORTANT** : Change ces credentials par les tiens !

### 3. Règles Firestore

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Users
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
      
      // Conversations
      match /conversations/{convId} {
        allow read, write: if request.auth != null && request.auth.uid == userId;
        match /messages/{messageId} {
          allow read, write: if request.auth != null && request.auth.uid == userId;
        }
      }
      
      // Alarms, Reminders, Events, Notes
      match /{subcollection=**} {
        allow read, write: if request.auth != null && request.auth.uid == userId;
      }
    }
    
    // Dev Keys (read only)
    match /dev_keys_valid/{keyId} {
      allow read: if request.auth != null;
    }
    
    // Reports
    match /reports/{reportId} {
      allow create: if request.auth != null;
      allow read: if request.auth != null && 
                     (resource.data.userId == request.auth.uid ||
                      get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role in ['creator', 'developer']);
    }
  }
}
```

---

## 🔑 Clés Développeur

Ajoute ces clés dans Firestore (`dev_keys_valid` collection) :

```javascript
// Document ID: ASTRAL-CREATE-7X9K2
{
  key: "ASTRAL-CREATE-7X9K2",
  role: "creator",
  label: "Créateur — PDG Astral",
  active: true
}

// Document ID: ASTRAL-EPOUSE-3M8P1
{
  key: "ASTRAL-EPOUSE-3M8P1",
  role: "creator_wife",
  label: "Épouse du Créateur",
  active: true
}

// Document ID: ASTRAL-DEVTEAM-5R4J8
{
  key: "ASTRAL-DEVTEAM-5R4J8",
  role: "developer",
  label: "Développeur — Équipe Astral",
  active: true
}
```

---

## 📦 Structure du Projet

```
eva-v3/
├── index.html              # Landing page
├── login.html              # Authentification
├── onboarding.html         # Configuration profil
├── chat.html               # App principale
│
├── assets/
│   ├── images/             # Logos (eva.svg, logo.svg, favicon.svg)
│   ├── styles/             # CSS (5 fichiers)
│   └── sounds/             # Sons (notification, alarm)
│
└── js/
    ├── core/               # Config, auth, utils
    ├── ai/                 # Providers IA, chat handler, vision
    ├── voice/              # TTS, STT, wake word
    ├── ui/                 # Sidebar, chat UI, modals, animations
    ├── features/           # Conversations, alarmes, rappels, etc.
    ├── settings/           # Settings UI, profile, dev keys
    └── app.js              # Point d'entrée
```

---

## 🧪 Tester Localement

```bash
# Simple HTTP server
python -m http.server 8000

# Ou avec Node.js
npx serve

# Puis ouvre http://localhost:8000
```

---

## 🎨 Personnalisation

### Couleurs

Modifie `assets/styles/main.css` :

```css
:root {
  --cyan: #00d4ff;        /* Couleur principale */
  --green: #00ff88;       /* Succès */
  --red: #ff4d6d;         /* Erreur */
  --navy: #05080d;        /* Background */
}
```

### Logo

Remplace `assets/images/eva.svg` par ton logo.

---

## 🐛 Problèmes Courants

### "Firebase is not defined"

→ Vérifie que les scripts Firebase sont chargés avant `app.js`

### "Provider not available"

→ Qwen 3 prend ~30s à charger au premier lancement

### "Voix ne fonctionne pas"

→ Teste dans Chrome (meilleur support Web Speech API)

### "Conversations ne se sauvegardent pas"

→ Vérifie les règles Firestore

---

## 📄 Licence

© 2026 Astral Technology — Tous droits réservés

---

## 🆘 Support

Pour toute question, utilise le système de rapports dans l'app (bouton ⚠️).

---

**🎉 Profite d'E.V.A ! 🎉**
