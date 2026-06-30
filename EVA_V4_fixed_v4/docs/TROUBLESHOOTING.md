# 🛠️ Dépannage - E.V.A V3

Solutions aux problèmes courants.

---

## 🔐 Problèmes d'Authentification

### ❌ "Firebase is not defined"

**Cause :** Scripts Firebase pas chargés

**Solution :**
1. Vérifie que les scripts sont dans `<head>` de chat.html
2. Ordre correct :
   ```html
   <script src=".../firebase-app-compat.js"></script>
   <script src=".../firebase-auth-compat.js"></script>
   <script src=".../firebase-firestore-compat.js"></script>
   ```
3. Charge app.js **APRÈS** Firebase

---

### ❌ "Popup fermée" (Google Sign-In)

**Cause :** Popup bloquée ou fermée trop vite

**Solutions :**
1. Autorise les popups pour le site
2. Vérifie que `prompt: 'select_account'` est défini
3. Essaie dans un autre navigateur

---

### ❌ "Unauthorized domain"

**Cause :** Domaine pas autorisé dans Firebase

**Solution :**
1. Firebase Console → Authentication → Settings
2. **Authorized domains** → Ajoute ton domaine
3. Exemple : `eva-assistant.netlify.app`

---

## 🤖 Problèmes IA

### ❌ "Provider not initialized"

**Cause :** Provider pas chargé

**Solutions :**
1. **Qwen** : Attends ~30s au premier lancement (téléchargement modèle)
2. **Puter** : Connecte-toi à Puter dans Paramètres
3. **OpenAI/Claude** : Ajoute ta clé API

---

### ❌ "Quota exceeded"

**Cause :** Limite API atteinte

**Solutions :**
1. Passe à un autre provider (Qwen = gratuit illimité)
2. Attends 24h (quotas se réinitialisent)
3. Upgrade ton plan API

---

### ❌ Eva ne répond pas

**Diagnostic :**
1. Ouvre DevTools (F12) → Console
2. Cherche les erreurs rouges
3. Note le message d'erreur

**Solutions courantes :**
- Provider pas init → Recharge la page
- Network error → Vérifie connexion internet
- API key invalid → Vérifie ta clé

---

## 🎤 Problèmes Voix

### ❌ Synthèse vocale ne fonctionne pas

**Solutions :**
1. **Navigateur :** Chrome recommandé
2. **Permissions :** Autorise l'audio
3. **Test :** Paramètres → Voice → Tester la voix
4. **Voix manquante :** Sélectionne "Auto"

---

### ❌ Reconnaissance vocale ne démarre pas

**Causes :**
- Micro non autorisé
- Navigateur non supporté
- HTTPS requis

**Solutions :**
1. Autorise le micro quand demandé
2. Utilise Chrome ou Edge
3. Teste sur HTTPS (localhost OK)

---

### ❌ "No speech detected"

**Solutions :**
1. Vérifie que le micro fonctionne
2. Parle plus fort ou proche du micro
3. Teste dans Paramètres système

---

## 💾 Problèmes Firestore

### ❌ "Permission denied"

**Cause :** Règles de sécurité trop strictes

**Solution :**
1. Firebase Console → Firestore → Rules
2. Vérifie que les règles permettent l'accès
3. Exemple :
   ```javascript
   allow read, write: if request.auth != null && request.auth.uid == userId;
   ```

---

### ❌ Conversations ne se sauvegardent pas

**Diagnostic :**
1. Console (F12) → Cherche erreurs Firestore
2. Vérifie auth (utilisateur connecté ?)
3. Teste avec une conversation simple

**Solutions :**
- Auth expirée → Déconnecte/reconnecte
- Règles Firestore → Vérifie les permissions
- Quota dépassé → Vérifie usage Firebase

---

## 📱 Problèmes Mobile

### ❌ Sidebar ne s'ouvre pas

**Solution :**
1. Vérifie que `sidebar.js` est chargé
2. Console → Cherche erreurs JavaScript
3. Recharge la page

---

### ❌ Input sticky pas au bon endroit

**Cause :** Safe-area iPhone

**Solution :**
1. Déjà géré dans `responsive.css`
2. Si problème persiste, ajuste :
   ```css
   padding-bottom: calc(var(--spacing-lg) + env(safe-area-inset-bottom));
   ```

---

### ❌ Boutons trop petits

**Cause :** Taille < 44px (recommandation iOS)

**Solution :**
1. Vérifie dans `responsive.css`
2. Tous les boutons doivent avoir `min-height: 44px`

---

## 🌐 Problèmes Réseau

### ❌ "Failed to fetch"

**Causes :**
- Pas de connexion internet
- API down
- CORS bloqué

**Solutions :**
1. Vérifie ta connexion
2. Teste avec un autre provider
3. Vérifie les logs console

---

### ❌ Slow loading

**Solutions :**
1. **Qwen** : Téléchargement initial (~30s)
2. **Images** : Optimise/compress
3. **Cache** : Active service worker (optionnel)

---

## 🔧 Problèmes Généraux

### ❌ Page blanche

**Diagnostic :**
1. F12 → Console
2. Regarde les erreurs

**Solutions courantes :**
- JavaScript error → Corrige le code
- Firebase config missing → Vérifie credentials
- Module not found → Vérifie les imports

---

### ❌ Styles cassés

**Solutions :**
1. Vérifie que tous les CSS sont chargés
2. Regarde Network tab (F12)
3. Clear cache et recharge

---

### ❌ "Module not found"

**Cause :** Import path incorrect

**Solution :**
1. Vérifie les chemins dans les imports
2. Exemple correct :
   ```javascript
   import { something } from './core/utils.js';
   ```
3. N'oublie pas le `.js` !

---

## 🚀 Optimisations

### Lent au démarrage

**Solutions :**
1. Lazy load modules non critiques
2. Preload Qwen uniquement si utilisé
3. Compress images

---

### Consomme trop de mémoire

**Solutions :**
1. Limite le contexte de conversation (10-20 messages)
2. Clear les anciennes conversations
3. Désactive wake word si non utilisé

---

## 📊 Debug Tools

### Console Logs

Active les logs détaillés :

```javascript
// Dans firebase-config.js
firebase.firestore().settings({
  cacheSizeBytes: firebase.firestore.CACHE_SIZE_UNLIMITED
});

// Logs Firestore
firebase.firestore.setLogLevel('debug');
```

### Network Monitoring

1. F12 → Network tab
2. Filtre : XHR
3. Regarde les requêtes Firebase/API

### Performance

1. F12 → Performance tab
2. Record → Utilise l'app → Stop
3. Analyse les bottlenecks

---

## ❓ Aide Supplémentaire

### Si rien ne fonctionne :

1. **Rapporte le bug** dans l'app (bouton ⚠️)
2. Inclus :
   - Message d'erreur exact
   - Screenshot
   - Browser/OS
   - Steps pour reproduire

---

**🛠️ Problème résolu ? Profite d'E.V.A !**
