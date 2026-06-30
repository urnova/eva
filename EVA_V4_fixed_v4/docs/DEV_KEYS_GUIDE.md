# 🔑 Guide des Clés Développeur - E.V.A V3

Les clés développeur permettent d'attribuer des rôles spéciaux aux utilisateurs.

---

## 📋 Rôles Disponibles

### 👤 **User** (Par défaut)
- Badge : `👤 Utilisateur`
- Accès : Fonctionnalités standard
- Peut voir : Ses propres données
- Permissions : CRUD sur ses conversations, alarmes, rappels, etc.

### 👑 **Creator** (Créateur)
- Badge : `👑 Créateur`
- Accès : **Tous les accès**
- Peut voir : Tous les rapports
- Peut accéder : Interface admin
- Eva l'appelle par son prénom + "Créateur"
- Contexte IA personnalisé

### 💎 **Creator Wife** (Épouse du Créateur)
- Badge : `💎 Épouse`
- Accès : Fonctionnalités standard + VIP
- Eva est chaleureuse et bienveillante
- Contexte IA personnalisé

### ⚙️ **Developer** (Développeur)
- Badge : `⚙️ Développeur`
- Accès : Voir les rapports
- Accès : Interface admin
- Mode technique activé pour Eva

---

## 🔐 Clés Prédéfinies

### Clé Créateur

```
Code : ASTRAL-CREATE-7X9K2
Rôle : creator
Badge : 👑 Créateur
```

### Clé Épouse

```
Code : ASTRAL-EPOUSE-3M8P1
Rôle : creator_wife
Badge : 💎 Épouse
```

### Clé Développeur

```
Code : ASTRAL-DEVTEAM-5R4J8
Rôle : developer
Badge : ⚙️ Développeur
```

---

## 📝 Ajouter des Clés dans Firestore

### Via Console Firebase :

1. Va dans **Firestore Database**
2. Collection : `dev_keys_valid`
3. **Ajouter un document**

```javascript
ID du document : ASTRAL-CREATE-7X9K2

Champs :
  key (string) : "ASTRAL-CREATE-7X9K2"
  role (string) : "creator"
  label (string) : "Créateur — PDG Astral"
  active (boolean) : true
```

### Via Code (si admin) :

```javascript
await db.collection('dev_keys_valid').doc('MA-CLE-12345').set({
  key: 'MA-CLE-12345',
  role: 'developer',
  label: 'Développeur — Mon Équipe',
  active: true
});
```

---

## 🎯 Activer une Clé (Utilisateur)

### Dans l'App :

1. Ouvre **Paramètres** (⚙️)
2. Section **"Clé développeur"**
3. Entre le code (ex: `ASTRAL-CREATE-7X9K2`)
4. Clique **"Activer"**
5. ✅ Badge mis à jour automatiquement

### Validation :

Le système vérifie dans Firestore :
- La clé existe ?
- Elle est active ?
- Quel rôle attribuer ?

---

## 🛡️ Sécurité

### Règles Firestore :

```javascript
// dev_keys_valid : lecture seule
match /dev_keys_valid/{keyId} {
  allow read: if request.auth != null;
  allow write: if false; // Modifiable uniquement via console
}
```

→ Les utilisateurs peuvent **lire** les clés (pour validation)

→ **Personne** ne peut modifier les clés via l'app

→ Modifications **uniquement** via Firebase Console

### Bonnes Pratiques :

- ✅ Ne partage PAS les clés publiquement
- ✅ Désactive une clé si compromise (`active: false`)
- ✅ Change le rôle si nécessaire
- ✅ Garde une trace des clés distribuées

---

## 🔄 Désactiver une Clé

### Via Console :

1. Firestore → `dev_keys_valid`
2. Trouve le document
3. Change `active` à `false`

→ La clé ne fonctionnera plus

### Révoquer un Rôle :

1. Firestore → `users/{userId}`
2. Change `role` à `"user"`
3. Supprime `devKey` et `devKeyLabel`

---

## 📊 Créer des Clés Personnalisées

### Format Recommandé :

```
PREFIX-CONTEXT-RANDOM
```

Exemples :
- `ASTRAL-ADMIN-X7K9P`
- `ASTRAL-BETATESTR-M3N8Q`
- `CUSTOM-SPECIAL-A1B2C`

### Générateur :

```javascript
function generateDevKey(prefix = 'ASTRAL', context = 'DEV') {
  const random = Math.random().toString(36).substring(2, 7).toUpperCase();
  return `${prefix}-${context}-${random}`;
}

console.log(generateDevKey('ASTRAL', 'ADMIN'));
// → ASTRAL-ADMIN-X7K9P
```

---

## 🎨 Personnaliser les Badges

Dans `js/core/config.js` :

```javascript
export const USER_ROLES = {
  user: {
    label: 'Utilisateur',
    badge: '👤 Utilisateur',
    badgeColor: '#4a6080'
  },
  creator: {
    label: 'Créateur',
    badge: '👑 Créateur',
    badgeColor: '#ffaa00',
    evaContext: (name) => `Tu parles avec ${name}, ton créateur.`
  },
  // Ajoute tes rôles personnalisés ici
  vip: {
    label: 'VIP',
    badge: '⭐ VIP',
    badgeColor: '#ff69b4'
  }
};
```

---

## 📈 Cas d'Usage

### Équipe de Dev :

Distribue des clés `developer` à ton équipe pour :
- Voir les rapports bugs
- Tester les features admin
- Contexte IA technique

### Beta Testers :

Crée un rôle `beta_tester` avec :
- Accès aux features en preview
- Badge spécial

### Partenaires :

Rôle `partner` avec :
- Fonctionnalités VIP
- Support prioritaire

---

## ❓ FAQ

**Q : Une clé peut-elle être réutilisée ?**
R : Oui, plusieurs personnes peuvent utiliser la même clé.

**Q : Comment révoquer l'accès ?**
R : Désactive la clé dans Firestore (`active: false`).

**Q : Peut-on changer de rôle ?**
R : Oui, désactive l'ancienne clé et active une nouvelle.

**Q : Les clés expirent-elles ?**
R : Non, sauf si tu ajoutes un champ `expiresAt`.

**Q : Peut-on avoir plusieurs rôles ?**
R : Non, un utilisateur = un rôle.

---

**🔑 Clés développeur configurées ! Profite des rôles.**
