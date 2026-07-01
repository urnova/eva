export default function handler(request, response) {
  // CORS configuration
  response.setHeader('Access-Control-Allow-Credentials', true);
  response.setHeader('Access-Control-Allow-Origin', '*');
  response.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  response.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (request.method === 'OPTIONS') {
    response.status(200).end();
    return;
  }

  // Configuration de l'en-tête pour retourner du JavaScript
  response.setHeader('Content-Type', 'application/javascript; charset=utf-8');

  // Génération du JavaScript
  const scriptContent = `
/* ═══════════════════════════════════════════════════════════
   EVA V4 - FIREBASE CONFIG (Dynamique via Vercel)
   ═══════════════════════════════════════════════════════════ */

const firebaseConfig = {
  apiKey: "${process.env.VITE_FIREBASE_API_KEY || ''}",
  authDomain: "${process.env.VITE_FIREBASE_AUTH_DOMAIN || ''}",
  projectId: "${process.env.VITE_FIREBASE_PROJECT_ID || ''}",
  storageBucket: "${process.env.VITE_FIREBASE_STORAGE_BUCKET || ''}",
  messagingSenderId: "${process.env.VITE_FIREBASE_MESSAGING_SENDER_ID || ''}",
  appId: "${process.env.VITE_FIREBASE_APP_ID || ''}"
};

if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

window.auth = firebase.auth();
window.db = firebase.firestore();
window.timestamp = firebase.firestore.FieldValue.serverTimestamp;
window.increment = firebase.firestore.FieldValue.increment;

window.db.settings({
  cacheSizeBytes: firebase.firestore.CACHE_SIZE_UNLIMITED,
  merge: true
});

window.db.enablePersistence({ synchronizeTabs: true })
  .catch((err) => {
    if (err.code === 'failed-precondition') console.warn('[EVA] Persistance: plusieurs onglets');
  });

console.log('✅ Firebase initialized (Secure Vercel Config)');
`;

  response.status(200).send(scriptContent);
}
