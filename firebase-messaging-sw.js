/* ═══════════════════════════════════════════════════════════
   EVA V3 — Firebase Cloud Messaging Service Worker
   Gère les notifications push en arrière-plan
   ═══════════════════════════════════════════════════════════ */

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

const messaging = firebase.messaging();

/* ─── Notifications en arrière-plan ─── */
messaging.onBackgroundMessage(function(payload) {
  var data   = payload.data || {};
  var notif  = payload.notification || {};
  var title  = notif.title  || data.title  || 'E.V.A';
  var body   = notif.body   || data.body   || 'Nouvelle notification';
  var type   = data.type    || 'general';
  var icon   = '/assets/images/favicon.svg';

  var actions = [];
  if (type === 'alarm') {
    actions = [
      { action: 'snooze', title: '😴 Reporter 10 min' },
      { action: 'stop',   title: '⏹ Arrêter' }
    ];
  } else {
    actions = [{ action: 'open', title: '📱 Ouvrir EVA' }];
  }

  var options = {
    body:    body,
    icon:    icon,
    badge:   icon,
    tag:     data.tag || ('eva-' + type + '-' + Date.now()),
    data:    data,
    actions: actions,
    requireInteraction: type === 'alarm',
    vibrate: type === 'alarm' ? [200, 100, 200, 100, 200] : [200]
  };

  self.registration.showNotification(title, options);
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

  if (action === 'stop') {
    return;
  }

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(list) {
      for (var i = 0; i < list.length; i++) {
        if (list[i].url && 'focus' in list[i]) {
          list[i].focus();
          list[i].postMessage({ type: 'EVA_NOTIFICATION_CLICK', data: data });
          return;
        }
      }
      if (clients.openWindow) {
        return clients.openWindow('/chat.html');
      }
    })
  );
});
