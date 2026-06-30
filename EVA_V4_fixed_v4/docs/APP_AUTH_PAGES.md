# Pages d'authentification App — E.V.A

## Présentation

Deux pages HTML autonomes, indépendantes du site principal, conçues pour servir de portail de connexion aux applications mobiles et PC d'E.V.A. Elles partagent le même thème visuel que le site web (fond marine, grille cyan, typographie Orbitron/Space Mono).

---

## Fichiers

| Fichier | Description |
|---------|-------------|
| `app-login.html` | Page de connexion (email/password + Google) |
| `app-signup.html` | Page d'inscription (email/password + Google) |

---

## Fonctionnement

### Détection de plateforme

Les pages détectent automatiquement l'appareil via `navigator.userAgent` :

| Valeur `PLATFORM` | Appareil détecté |
|-------------------|-----------------|
| `mobile` | Android, iPhone, iPod |
| `tablet` | iPad, tablette Android |
| `windows` | PC Windows |
| `mac` | Mac (macOS) |
| `linux` | Linux desktop |
| `web` | Navigateur non identifié |

Un banner en haut de la carte informe l'utilisateur de l'appareil détecté.

### Après connexion (app-login.html)

Selon la plateforme, l'utilisateur voit des boutons de redirection :
- **Mobile/Tablette** → bouton vers l'app mobile (deep-link ou store)
- **PC (Windows/Mac/Linux)** → bouton vers E.V.A Desktop (protocol handler)
- **Web** → redirection vers `/chat`

### Après inscription (app-signup.html)

- Crée le compte Firebase Auth
- Crée automatiquement le profil Firestore dans la collection `users`
- Affiche un message de confirmation adapté à la plateforme

---

## Configuration Firebase

Chaque page contient un bloc `firebaseConfig` à remplir avec vos identifiants Firebase :

```javascript
const firebaseConfig = {
  apiKey: "VOTRE_API_KEY",
  authDomain: "VOTRE_PROJECT.firebaseapp.com",
  projectId: "VOTRE_PROJECT_ID",
  storageBucket: "VOTRE_PROJECT.appspot.com",
  messagingSenderId: "VOTRE_SENDER_ID",
  appId: "VOTRE_APP_ID"
};
```

Ces informations se trouvent dans la console Firebase → Paramètres du projet → Vos applications.

---

## URLs des applications (à adapter)

Dans `app-login.html`, le bloc `APP_URLS` définit les liens de redirection :

```javascript
var APP_URLS = {
  mobile:   'eva://login',           // Deep-link app mobile (Android/iOS)
  android:  'https://play.google.com/store/apps/details?id=fr.astral.eva',
  ios:      'https://apps.apple.com/app/eva-astral/id0000000000',
  windows:  'eva-desktop://login',   // Protocol handler app PC Windows
  mac:      'eva-desktop://login',   // Protocol handler app PC macOS
  linux:    'eva-desktop://login',   // Protocol handler app PC Linux
  web:      '/chat'                  // Fallback web
};
```

- **Apps mobiles** : remplacez les URLs store par les vrais liens une fois les apps publiées.
- **Apps desktop** : implémentez un protocol handler dans l'installeur (Electron, Tauri, etc.) pour intercepter `eva-desktop://login`.

---

## Intégration dans Netlify / hébergement

Ces pages sont des fichiers HTML statiques autonomes. Elles peuvent être :

1. **Déployées sur le même domaine** que le site EVA : `/app-login.html`, `/app-signup.html`
2. **Déployées sur un sous-domaine dédié** : `app.eva.astral-technologie.fr`
3. **Utilisées dans une WebView** dans l'app mobile/desktop comme écran de connexion

### Exemple `netlify.toml` (redirections)

```toml
[[redirects]]
  from = "/app/login"
  to = "/app-login.html"
  status = 200

[[redirects]]
  from = "/app/signup"
  to = "/app-signup.html"
  status = 200
```

---

## Règles Firestore requises

Les pages utilisent les collections existantes. Assurez-vous que les règles Firestore autorisent :

```
match /users/{userId} {
  allow write: if request.auth != null && request.auth.uid == userId;
}
```

---

## Liens internes entre pages

| Lien | Destination |
|------|-------------|
| "Pas encore de compte ?" (app-login) | `/app-signup.html` |
| "Déjà inscrit ?" (app-signup) | `/app-login.html` |
| "Mot de passe oublié ?" | `/login?reset=1` |
| Bouton final connexion/inscription | `/chat` (ou deep-link app) |
