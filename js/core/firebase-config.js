/* ═══════════════════════════════════════════════════════════
   EVA V3 - FIREBASE CONFIG
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

// Configuration Firestore
window.db.settings({
  cacheSizeBytes: firebase.firestore.CACHE_SIZE_UNLIMITED
});

// Activer la persistance offline
window.db.enablePersistence({ synchronizeTabs: true })
  .catch((err) => {
    if (err.code === 'failed-precondition') {
      console.warn('Persistance: Multiple tabs open');
    } else if (err.code === 'unimplemented') {
      console.warn('Persistance: Not supported by browser');
    }
  });

console.log('✅ Firebase initialized');
