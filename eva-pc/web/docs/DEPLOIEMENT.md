# 📦 Guide de Déploiement - E.V.A V3

Ce guide explique comment déployer E.V.A V3 sur Netlify en 5 minutes.

---

## 🚀 Méthode 1 : Drag & Drop (Recommandé)

**Temps : 2 minutes**

### Étapes :

1. **Prépare le dossier**
   - Télécharge TOUT le dossier du projet
   - Assure-toi que tous les fichiers sont présents

2. **Va sur Netlify**
   - Ouvre [app.netlify.com](https://app.netlify.com)
   - Connecte-toi (ou crée un compte gratuit)

3. **Déploie**
   - Clique sur **"Add new site"**
   - Sélectionne **"Deploy manually"**
   - **Glisse-dépose le dossier complet**

4. **Attends**
   - Le déploiement prend ~30 secondes
   - Netlify te donne une URL : `https://random-name.netlify.app`

5. **Personnalise** (optionnel)
   - Va dans **Site settings**
   - Clique **"Change site name"**
   - Exemple : `eva-assistant` → `https://eva-assistant.netlify.app`

✅ **C'est tout ! Ton site est en ligne.**

---

## 🔧 Méthode 2 : Git (Pour les devs)

**Temps : 5 minutes**

### Prérequis :

- Git installé
- Compte GitHub
- Compte Netlify

### Étapes :

1. **Init Git**

```bash
cd eva-v3
git init
git add .
git commit -m "Initial commit - Eva V3"
```

2. **Push to GitHub**

```bash
# Crée un nouveau repo sur GitHub.com
# Puis :
git remote add origin https://github.com/TON-USERNAME/eva-v3.git
git branch -M main
git push -u origin main
```

3. **Connect Netlify**

- Va sur [app.netlify.com](https://app.netlify.com)
- Clique **"Add new site"** → **"Import from Git"**
- Sélectionne GitHub
- Choisis ton repo `eva-v3`
- Clique **"Deploy site"**

4. **Configuration**

Netlify détecte automatiquement :
- Build command : (aucune)
- Publish directory : `/`

✅ **Déployé ! Netlify redéploie automatiquement à chaque push.**

---

## ⚙️ Configuration Post-Déploiement

### 1. Variables d'environnement (optionnel)

Si tu veux séparer les configs Firebase :

- Va dans **Site settings** → **Environment variables**
- Ajoute :
  - `FIREBASE_API_KEY`
  - `FIREBASE_PROJECT_ID`
  - etc.

### 2. Domaine personnalisé (optionnel)

- Va dans **Domain management**
- Clique **"Add custom domain"**
- Suis les instructions

### 3. HTTPS

- Activé automatiquement par Netlify
- Certificat SSL gratuit (Let's Encrypt)

---

## 🔥 Fonctionnalités Netlify Utiles

### Redirects & Rewrites

Déjà configuré dans `_redirects` :

```
/*    /index.html   200
```

→ Permet le routing côté client (SPA)

### Headers

Crée `_headers` si besoin :

```
/*
  X-Frame-Options: DENY
  X-Content-Type-Options: nosniff
```

### Formulaires

Netlify détecte automatiquement les `<form>` avec `data-netlify="true"`

---

## 📊 Monitoring

### Analytics

- Va dans **Analytics** (onglet dans Netlify)
- Active **Netlify Analytics** (payant mais optionnel)

### Logs

- Va dans **Deploys** → **Deploy log**
- Voir les erreurs éventuelles

---

## 🐛 Dépannage Déploiement

### "Build failed"

→ Netlify ne build rien par défaut, vérifie la config

### "404 sur les routes"

→ Vérifie que `_redirects` est présent

### "Firebase not defined"

→ Les scripts Firebase sont-ils bien chargés ?

### "Fichiers manquants"

→ Vérifie que tu as uploadé TOUT le dossier

---

## 🔄 Mises à Jour

### Méthode Drag & Drop :

1. Modifie tes fichiers localement
2. Va dans **Deploys**
3. Glisse-dépose le dossier mis à jour

### Méthode Git :

```bash
git add .
git commit -m "Update: message"
git push
```

→ Netlify redéploie automatiquement

---

## 💰 Coûts

**Gratuit pour toujours :**
- 100 GB de bande passante / mois
- 300 build minutes / mois
- HTTPS inclus
- CDN global inclus

**Largement suffisant pour E.V.A !**

---

## 🎯 Checklist Finale

Avant de déployer, vérifie :

- [ ] Tous les fichiers sont présents
- [ ] Firebase config est à jour
- [ ] `_redirects` existe
- [ ] `netlify.toml` existe
- [ ] Assets (images, sons) sont inclus

---

**✅ Prêt à déployer ? Go ! 🚀**
