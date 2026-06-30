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
window.db = firebase.firestore();
window.timestamp = firebase.firestore.FieldValue.serverTimestamp;
window.increment = firebase.firestore.FieldValue.increment;

// Configuration Firestore (merge:true évite le warning "overriding host")
window.db.settings({
  cacheSizeBytes: firebase.firestore.CACHE_SIZE_UNLIMITED,
  merge: true
});

// Activer la persistance offline (multi-onglets)
window.db.enablePersistence({ synchronizeTabs: true })
  .catch((err) => {
    if (err.code === 'failed-precondition') {
      console.warn('[EVA] Persistance: plusieurs onglets ouverts');
    } else if (err.code === 'unimplemented') {
      console.warn('[EVA] Persistance: non supporté par ce navigateur');
    }
  });

console.log('✅ Firebase initialized');
