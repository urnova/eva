/* ═══════════════════════════════════════════════════════════
   EVA V4 - FIREBASE CONFIG
   Configuration et initialisation Firebase
   ═══════════════════════════════════════════════════════════ */

// Configuration Firebase
const firebaseConfig = {
  apiKey: "AIzaSyDrXk8X9Ow7CcOc0Sr-yv3mXvzatNxpj3o",
  authDomain: "eva-assistant-a4fdf.firebaseapp.com",
  projectId: "eva-assistant-a4fdf",
  storageBucket: "eva-assistant-a4fdf.firebasestorage.app",
  messagingSenderId: "594189556810",
  appId: "1:594189556810:web:0d72c2110245af92099ab3"
};

// Initialiser Firebase
if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

// Variables globales (accessibles partout sans imports)
window.auth = firebase.auth();
window.auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL).catch(e => console.warn(e));
window.db = firebase.firestore();
window.timestamp = firebase.firestore.FieldValue.serverTimestamp;
window.increment = firebase.firestore.FieldValue.increment;

// Configuration Firestore (merge:true évite le warning "overriding host")
window.db.settings({
  cacheSizeBytes: firebase.firestore.CACHE_SIZE_UNLIMITED,
  merge: true
});

// Activer la persistance offline (multi-onglets uniquement sur Web)
if (!window.eva) {
  window.db.enablePersistence({ synchronizeTabs: true }).catch((err) => {
    console.warn('[EVA] Persistance erreur:', err);
  });
} else {
  console.log('[EVA] PC App: Firestore persistence disabled to prevent IndexedDB lock hangs.');
}

console.log('✅ Firebase initialized');
