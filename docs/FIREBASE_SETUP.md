# 🔥 Configuration Firebase - E.V.A V3

Guide complet pour configurer Firebase.

---

## 📝 1. Créer un Projet Firebase

1. Va sur [console.firebase.google.com](https://console.firebase.google.com)
2. Clique **"Ajouter un projet"**
3. Nom du projet : `eva-assistant` (ou autre)
4. Désactive Google Analytics (optionnel)
5. Clique **"Créer le projet"**

---

## 🔐 2. Activer Authentication

1. Dans le menu, clique **"Authentication"**
2. Clique **"Commencer"**

### Google Sign-In :

1. Onglet **"Sign-in method"**
2. Clique **"Google"**
3. Active le fournisseur
4. Choisis un email de support
5. Sauvegarde

### Email/Password :

1. Toujours dans **"Sign-in method"**
2. Clique **"E-mail/Mot de passe"**
3. Active **"E-mail/Mot de passe"**
4. Sauvegarde

---

## 🗄️ 3. Activer Firestore Database

1. Menu → **"Firestore Database"**
2. Clique **"Créer une base de données"**
3. Mode : **"Production"** (on mettra les règles après)
4. Région : `europe-west1` (ou proche de toi)
5. Clique **"Activer"**

### Règles de Sécurité :

Clique sur **"Règles"** et colle :

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    // === USERS ===
    match /users/{userId} {
      // Un utilisateur peut lire/écrire ses propres données
      allow read, write: if request.auth != null && request.auth.uid == userId;
      
      // Conversations
      match /conversations/{convId} {
        allow read, write: if request.auth != null && request.auth.uid == userId;
        
        match /messages/{messageId} {
          allow read, write: if request.auth != null && request.auth.uid == userId;
        }
      }
      
      // Alarmes, Rappels, Événements, Notes
      match /alarms/{alarmId} {
        allow read, write: if request.auth != null && request.auth.uid == userId;
      }
      
      match /reminders/{reminderId} {
        allow read, write: if request.auth != null && request.auth.uid == userId;
      }
      
      match /events/{eventId} {
        allow read, write: if request.auth != null && request.auth.uid == userId;
      }
      
      match /notes/{noteId} {
        allow read, write: if request.auth != null && request.auth.uid == userId;
      }
    }
    
    // === DEV KEYS ===
    // Lecture seule pour tous les utilisateurs authentifiés
    match /dev_keys_valid/{keyId} {
      allow read: if request.auth != null;
      allow write: if false; // Modifiable uniquement via console
    }
    
    // === REPORTS ===
    match /reports/{reportId} {
      // Tout le monde peut créer un rapport
      allow create: if request.auth != null;
      
      // Lecture : auteur OU admin (creator/developer)
      allow read: if request.auth != null && (
        resource.data.userId == request.auth.uid ||
        get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role in ['creator', 'developer']
      );
      
      // Modification : admin uniquement
      allow update: if request.auth != null &&
        get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role in ['creator', 'developer'];
    }
  }
}
```

Clique **"Publier"**.

---

## 🔑 4. Ajouter les Dev Keys

1. Va dans **Firestore Database**
2. Clique **"Démarrer une collection"**
3. ID de collection : `dev_keys_valid`

### Ajoute ces documents :

**Document 1 :**
```
ID : ASTRAL-CREATE-7X9K2
Champs :
  key: "ASTRAL-CREATE-7X9K2"
  role: "creator"
  label: "Créateur — PDG Astral"
  active: true
```

**Document 2 :**
```
ID : ASTRAL-EPOUSE-3M8P1
Champs :
  key: "ASTRAL-EPOUSE-3M8P1"
  role: "creator_wife"
  label: "Épouse du Créateur"
  active: true
```

**Document 3 :**
```
ID : ASTRAL-DEVTEAM-5R4J8
Champs :
  key: "ASTRAL-DEVTEAM-5R4J8"
  role: "developer"
  label: "Développeur — Équipe Astral"
  active: true
```

---

## 🌐 5. Configuration Web App

1. Dans **Paramètres du projet** (⚙️ en haut)
2. Scroll vers **"Vos applications"**
3. Clique sur l'icône **Web** (`</>`)
4. Nom de l'app : `E.V.A Web`
5. **NE COCHE PAS** "Firebase Hosting"
6. Clique **"Enregistrer l'application"**

### Récupère les credentials :

Firebase te donne un code comme :

```javascript
const firebaseConfig = {
  apiKey: "AIzaSy...",
  authDomain: "eva-assistant-xxx.firebaseapp.com",
  projectId: "eva-assistant-xxx",
  storageBucket: "eva-assistant-xxx.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abcdef"
};
```

### Mets à jour `js/core/firebase-config.js` :

Remplace les valeurs dans le fichier par les tiennes.

---

## 🧪 6. Tester

### Test Auth :

1. Va sur ton site déployé
2. Essaie de te connecter avec Google
3. Essaie Email/Password

### Test Firestore :

1. Crée une conversation
2. Va dans Firestore Console
3. Vérifie que les données apparaissent

---

## 🛡️ 7. Sécurité (Important !)

### Domaines Autorisés :

1. **Authentication** → **Settings**
2. Section **"Authorized domains"**
3. Ajoute ton domaine Netlify : `eva-assistant.netlify.app`

### API Key Restrictions :

1. Va sur [console.cloud.google.com](https://console.cloud.google.com)
2. API & Services → Credentials
3. Clique sur la clé API Firebase
4. **Application restrictions** :
   - HTTP referrers
   - Ajoute : `https://ton-site.netlify.app/*`

---

## 📊 8. Quotas

**Plan Gratuit (Spark) :**
- Auth : Illimité
- Firestore : 50k lectures/jour, 20k écritures/jour
- Storage : 1 GB

**Largement suffisant pour commencer !**

---

## 🔄 9. Backups (Optionnel)

1. Firestore → **Import/Export**
2. Configure un bucket Google Cloud Storage
3. Programme des exports automatiques

---

## ❓ Problèmes Courants

### "Firebase config not found"

→ Vérifie que tu as bien copié les credentials

### "Permission denied" dans Firestore

→ Vérifie les règles de sécurité

### "Unauthorized domain"

→ Ajoute ton domaine dans "Authorized domains"

### "Quota exceeded"

→ Passe au plan Blaze (pay-as-you-go)

---

**✅ Firebase configuré ! Prêt pour le déploiement.**
