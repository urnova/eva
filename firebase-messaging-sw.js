/* ═══════════════════════════════════════════════════════════
   EVA V3 — Service Worker Push Notifications
   Handler brut d'abord (Edge/Firefox/Safari compat),
   Firebase SDK en complément pour le déchiffrement FCM.
   ═══════════════════════════════════════════════════════════ */

/* ─── Activation immédiate sans attente ─── */
self.addEventListener('install', function(event) {
  event.waitUntil(self.skipWaiting());
});
self.addEventListener('activate', function(event) {
  event.waitUntil(clients.claim());
});

/* ─── Handler brut PUSH (prioritaire, tous navigateurs) ─── */
self.addEventListener('push', function(event) {
  var payload = {};

  /* Essai de lecture du payload (brut ou Firebase formaté) */
  try {
    if (event.data) {
      var raw = event.data.text();
      payload = JSON.parse(raw);
    }
  } catch(e) {}

  /* Les données peuvent être à la racine ou dans .data (format FCM) */
  var d     = payload.data || payload.notification || payload;
  var title = d.title || payload.title || 'E.V.A';
  var body  = d.body  || payload.body  || 'Nouvelle notification';
  var type  = d.type  || 'general';
  var icon  = '/assets/images/favicon.svg';

  var actions = [];
  if (type === 'alarm') {
    actions = [
      { action: 'snooze', title: '\uD83D\uDE34 Reporter 10 min' },
      { action: 'stop',   title: '\u23F9 Arr\u00EAter' }
    ];
  } else {
    actions = [{ action: 'open', title: '\uD83D\uDCF1 Ouvrir EVA' }];
  }

  var options = {
    body:    body,
    icon:    icon,
    badge:   icon,
    tag:     d.tag || ('eva-' + type + '-' + Date.now()),
    data:    d,
    actions: actions,
    requireInteraction: type === 'alarm',
    vibrate: type === 'alarm' ? [200, 100, 200, 100, 200] : [200]
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

/* ─── Clic sur notification ─── */
self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  var data   = event.notification.data || {};
  var action = event.action;

  if (action === 'snooze' && data.alarmId && data.userId) {
    event.waitUntil(
      fetch('/api/snooze-alarm', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ userId: data.userId, alarmId: data.alarmId })
      }).catch(function(){})
    );
    return;
  }

  if (action === 'stop') return;

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(list) {
      for (var i = 0; i < list.length; i++) {
        if (list[i].url && 'focus' in list[i]) {
          list[i].focus();
          list[i].postMessage({ type: 'EVA_NOTIFICATION_CLICK', data: data });
          return;
        }
      }
      if (clients.openWindow) return clients.openWindow('/chat.html');
    })
  );
});

/* ─── Firebase SDK en complément (déchiffrement FCM) ─── */
try {
  importScripts('https://www.gstatic.com/firebasejs/9.22.0/firebase-app-compat.js');
  importScripts('https://www.gstatic.com/firebasejs/9.22.0/firebase-messaging-compat.js');

  firebase.initializeApp({
    apiKey:            "AIzaSyDrXk8X9Ow7CcOc0Sr-yv3mXvzatNxpj3o",
    authDomain:        "eva-assistant-a4fdf.firebaseapp.com",
    projectId:         "eva-assistant-a4fdf",
    storageBucket:     "eva-assistant-a4fdf.firebasestorage.app",
    messagingSenderId: "594189556810",
    appId:             "1:594189556810:web:0d72c2110245af92099ab3"
  });

  /* onBackgroundMessage ne fait rien — le raw push handler ci-dessus gère déjà l'affichage */
  firebase.messaging().onBackgroundMessage(function(payload) {});

} catch(e) {
  /* Firebase SDK non disponible — le raw push handler suffit */
  console.warn('[EVA SW] Firebase SDK non chargé, raw handler actif :', e.message);
}
