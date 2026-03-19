# 🔧 CORRECTIONS URGENTES - EVA V3

## ✅ CE QUI A ÉTÉ CORRIGÉ

### 1. **index.html** ✅ TERMINÉ
- ✅ Logo Eva en haut (petit)
- ✅ Logo Eva au centre (grand, SANS animation flottante)
- ✅ Badge "Version Web Bêta" ajouté
- ✅ Section features complète (9 cards)
- ✅ Profil utilisateur en haut quand connecté
- ✅ Dropdown avec "Accéder à Eva", "Paramètres", "Déconnexion"
- ✅ Uniquement "Accéder à Eva" si connecté (pas "Se connecter")

### 2. **firebase-config.js** ✅ CORRIGÉ
- ✅ Enlevé les `export` ES6
- ✅ Utilise `window.auth`, `window.db`, etc.
- ✅ Plus d'erreur "Unexpected token 'export'"

---

## ❌ CE QUI RESTE À CORRIGER

### 🔴 **PRIORITÉ 1 : Paramètres Non Fonctionnels**

**Problème :** Les sections Voix/IA/Clé sont vides

**Solution :**

1. Ouvre `js/settings/settings-ui.js`
2. Les fonctions `renderVoiceSection()`, `renderAISection()`, `renderDevSection()` sont déjà créées
3. **Mais** elles ne sont pas appelées au chargement

**Fix rapide dans chat.html :**

À la fin du script, après `initApp()`, ajoute :

```javascript
// Charger les paramètres au clic
function openSettings() {
  document.getElementById('settingsModal').classList.add('active');
  
  // Charger la section par défaut
  showSettingsSection('account');
}

function showSettingsSection(section) {
  const content = document.getElementById('settingsContent');
  
  switch(section) {
    case 'account':
      content.innerHTML = renderAccountHTML();
      break;
    case 'voice':
      content.innerHTML = renderVoiceHTML();
      break;
    case 'ai':
      content.innerHTML = renderAIHTML();
      break;
    case 'dev':
      content.innerHTML = renderDevHTML();
      break;
  }
}

function renderAccountHTML() {
  return `
    <div class="settings-section">
      <h3 class="settings-section-title">Compte utilisateur</h3>
      <div class="settings-field">
        <label class="settings-label">Nom</label>
        <input type="text" class="settings-input" id="settingsDisplayName" value="">
      </div>
      <div class="settings-field">
        <label class="settings-label">Surnom</label>
        <input type="text" class="settings-input" id="settingsNickname" value="">
      </div>
      <button class="btn-primary" onclick="saveAccountSettings()">Sauvegarder</button>
    </div>
  `;
}

function renderVoiceHTML() {
  return `
    <div class="settings-section">
      <h3 class="settings-section-title">Configuration Voix</h3>
      <div class="settings-field">
        <label class="settings-label">Voix</label>
        <select class="settings-input" id="voiceSelect">
          <option value="auto">Auto (Meilleure voix)</option>
        </select>
      </div>
      <div class="settings-field">
        <label class="settings-label">Vitesse</label>
        <input type="range" class="settings-input" id="speechRate" min="0.5" max="2" step="0.1" value="1.0">
        <span id="speechRateValue">1.0</span>
      </div>
      <button class="btn-outline" onclick="testVoice()">🔊 Tester</button>
      <button class="btn-primary" onclick="saveVoiceSettings()">Sauvegarder</button>
    </div>
  `;
}

function renderAIHTML() {
  return `
    <div class="settings-section">
      <h3 class="settings-section-title">Intelligence Artificielle</h3>
      <div class="settings-field">
        <label class="settings-label">Provider IA</label>
        <select class="settings-input" id="aiProviderSelect">
          <option value="qwen">Qwen 3 (Local)</option>
          <option value="puter">Puter Cloud</option>
          <option value="openai">OpenAI API</option>
          <option value="claude">Claude API</option>
        </select>
      </div>
      <button class="btn-primary" onclick="saveAISettings()">Sauvegarder</button>
    </div>
  `;
}

function renderDevHTML() {
  return `
    <div class="settings-section">
      <h3 class="settings-section-title">Clé Développeur</h3>
      <div class="settings-field">
        <label class="settings-label">Code d'accès</label>
        <input type="text" class="settings-input" id="devKeyInput" placeholder="ASTRAL-XXXXX-XXXXX">
      </div>
      <button class="btn-primary" onclick="activateDevKey()">Activer</button>
    </div>
  `;
}

async function saveAccountSettings() {
  const displayName = document.getElementById('settingsDisplayName').value;
  const nickname = document.getElementById('settingsNickname').value;
  
  await db.collection('users').doc(window.currentUser.uid).update({
    displayName,
    nickname
  });
  
  alert('Profil sauvegardé !');
}

async function saveVoiceSettings() {
  const voice = document.getElementById('voiceSelect').value;
  const rate = parseFloat(document.getElementById('speechRate').value);
  
  await db.collection('users').doc(window.currentUser.uid).update({
    'preferences.selectedVoice': voice,
    'preferences.speechRate': rate
  });
  
  alert('Voix sauvegardée !');
}

async function saveAISettings() {
  const provider = document.getElementById('aiProviderSelect').value;
  
  await db.collection('users').doc(window.currentUser.uid).update({
    'preferences.aiProvider': provider
  });
  
  alert('Provider IA sauvegardé !');
}

function testVoice() {
  const utterance = new SpeechSynthesisUtterance("Bonjour ! Je suis Eva.");
  utterance.lang = 'fr-FR';
  speechSynthesis.speak(utterance);
}

async function activateDevKey() {
  const key = document.getElementById('devKeyInput').value.trim();
  
  if (!key) {
    alert('Veuillez saisir une clé');
    return;
  }
  
  // Valider la clé
  const snapshot = await db.collection('dev_keys_valid')
    .where('key', '==', key)
    .where('active', '==', true)
    .get();
  
  if (snapshot.empty) {
    alert('Clé invalide ou inactive');
    return;
  }
  
  const keyData = snapshot.docs[0].data();
  
  await db.collection('users').doc(window.currentUser.uid).update({
    role: keyData.role,
    devKey: key
  });
  
  alert('Clé activée ! Rechargement...');
  window.location.reload();
}
```

---

### 🔴 **PRIORITÉ 2 : Aide Non Fonctionnelle**

**Problème :** Clic sur "Aide" affiche "Fonctionnalité non disponible"

**Solution :**

Dans chat.html, remplace la fonction `openHelp()` :

```javascript
function openHelp() {
  // Créer modal aide
  const helpModal = document.createElement('div');
  helpModal.className = 'modal-overlay active';
  helpModal.innerHTML = `
    <div class="modal">
      <div class="modal-header">
        <h2 class="modal-title">❓ Aide</h2>
        <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">✕</button>
      </div>
      <div class="modal-body">
        <h3>📚 Documentation</h3>
        <ul>
          <li><a href="README.md" target="_blank">Guide général</a></li>
          <li><a href="docs/DEPLOIEMENT.md" target="_blank">Déploiement</a></li>
          <li><a href="docs/FIREBASE_SETUP.md" target="_blank">Configuration Firebase</a></li>
          <li><a href="docs/TROUBLESHOOTING.md" target="_blank">Dépannage</a></li>
        </ul>
        
        <h3 style="margin-top: 20px;">🎤 Commandes Vocales</h3>
        <p>Dites "Hey Eva" pour activer l'écoute</p>
        
        <h3 style="margin-top: 20px;">⚡ Raccourcis</h3>
        <ul>
          <li><kbd>Enter</kbd> - Envoyer un message</li>
          <li><kbd>Shift+Enter</kbd> - Nouvelle ligne</li>
          <li><kbd>Esc</kbd> - Fermer les modals</li>
        </ul>
      </div>
    </div>
  `;
  
  document.body.appendChild(helpModal);
  
  // Fermer au clic sur overlay
  helpModal.addEventListener('click', (e) => {
    if (e.target === helpModal) {
      helpModal.remove();
    }
  });
}
```

---

### 🔴 **PRIORITÉ 3 : Navigation Paramètres**

**Problème :** Clic sur les onglets Voix/IA/Clé ne fait rien

**Solution :**

Dans chat.html, ajoute :

```javascript
// Navigation paramètres
document.querySelectorAll('.settings-nav-item').forEach(item => {
  item.addEventListener('click', () => {
    // Remove active
    document.querySelectorAll('.settings-nav-item').forEach(i => i.classList.remove('active'));
    
    // Add active
    item.classList.add('active');
    
    // Show section
    const section = item.getAttribute('data-section');
    showSettingsSection(section);
  });
});
```

---

## 📋 CHECKLIST RAPIDE

- [x] Index.html refait avec toutes les features
- [x] Logo Eva sans animation flottante
- [x] "Version Web Bêta" ajoutée
- [x] Profil utilisateur en haut quand connecté
- [x] Firebase erreur export corrigée
- [ ] Paramètres sections Voix/IA/Clé remplies
- [ ] Navigation onglets paramètres fonctionnelle
- [ ] Aide modal créée
- [ ] Toutes les fonctions save/test créées

---

## 🚀 POUR TESTER

1. Recharge la page
2. Teste index.html (logo, version bêta, profil)
3. Connecte-toi
4. Va dans Paramètres
5. Clique sur Voix/IA/Clé
6. Teste les sauvegardes

---

**Note :** Tous ces codes sont à ajouter dans `chat.html` à la fin du script, juste avant `</script>`.

Je peux te créer un `chat.html` complet avec tout ça si tu veux !
