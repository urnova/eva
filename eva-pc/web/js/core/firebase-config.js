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
// Configuration Firestore
let firestoreSettings = {
  cacheSizeBytes: firebase.firestore.CACHE_SIZE_UNLIMITED
};
if (window.eva) {
  firestoreSettings.experimentalForceLongPolling = true; // Fix WebSocket hangs in Electron
}
window.db.settings(firestoreSettings);

// Activer la persistance offline (multi-onglets uniquement sur Web)
// ATTENTION: Uniquement sur la page principale pour eviter les locks d'IndexedDB lors des redirections!
var isMainApp = window.location.pathname.includes('chat.html') || window.location.pathname.includes('index.html') || window.location.pathname === '/';
if (isMainApp) {
  if (!window.eva) {
    window.db.enablePersistence({ synchronizeTabs: true }).catch((err) => console.warn(err));
  } else {
    window.db.enablePersistence().catch((err) => console.warn(err));
  }
} else {
  console.log('[EVA] Persistence skipped on secondary page to prevent lock contention.');
}

console.log('✅ Firebase initialized');
