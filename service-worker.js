/* ═══════════════════════════════════════════════════════════
   E.V.A V3 - SERVICE WORKER
   Notifications push en arrière-plan (alarmes + rappels)
   Fonctionne même quand l'onglet est fermé
   ═══════════════════════════════════════════════════════════ */

var SW_VERSION = 'eva-v3-sw-1.0';

self.addEventListener('install', function(e) {
  self.skipWaiting();
});

self.addEventListener('activate', function(e) {
  e.waitUntil(clients.claim());
});

/* ═══ RÉCEPTION DES MESSAGES DE LA PAGE ═══ */
self.addEventListener('message', function(e) {
  var data = e.data;
  if (!data || !data.type) return;

  if (data.type === 'SHOW_ALARM') {
    showAlarmNotification(data.label, data.id);
  }

  if (data.type === 'SHOW_REMINDER') {
    showReminderNotification(data.text, data.id);
  }

  if (data.type === 'STOP_ALARM') {
    self.registration.getNotifications().then(function(notifs) {
      notifs.forEach(function(n) {
        if (n.data && n.data.type === 'alarm') n.close();
      });
    });
  }
});

/* ═══ AFFICHER NOTIFICATION ALARME ═══ */
function showAlarmNotification(label, id) {
  var tag = 'alarm_' + (id || Date.now());
  return self.registration.showNotification('⏰ E.V.A — Alarme', {
    body: label || 'Alarme',
    icon: '/assets/images/eva.svg',
    badge: '/assets/images/favicon.svg',
    tag: tag,
    requireInteraction: true,
    vibrate: [200, 100, 200, 100, 200],
    actions: [
      { action: 'stop', title: '⛔ Arrêter' },
      { action: 'snooze', title: '💤 Reporter 5 min' }
    ],
    data: {
      label: label,
      id: id,
      type: 'alarm',
      firedAt: Date.now(),
      url: '/chat'
    }
  }).catch(function(err) {
    console.warn('[SW] showNotification alarm failed:', err.message);
  });
}

/* ═══ AFFICHER NOTIFICATION RAPPEL ═══ */
function showReminderNotification(text, id) {
  var tag = 'reminder_' + (id || Date.now());
  return self.registration.showNotification('📌 E.V.A — Rappel', {
    body: text || 'Rappel',
    icon: '/assets/images/eva.svg',
    badge: '/assets/images/favicon.svg',
    tag: tag,
    requireInteraction: true,
    vibrate: [100, 50, 100],
    actions: [
      { action: 'dismiss', title: '✓ Compris' }
    ],
    data: {
      text: text,
      id: id,
      type: 'reminder',
      url: '/chat'
    }
  }).catch(function(err) {
    console.warn('[SW] showNotification reminder failed:', err.message);
  });
}

/* ═══ CLIC SUR LA NOTIFICATION ═══ */
self.addEventListener('notificationclick', function(e) {
  var action = e.action;
  var notif = e.notification;
  var data = notif.data || {};

  notif.close();

  if (action === 'snooze' && data.type === 'alarm') {
    var label = data.label;
    var id = data.id;
    e.waitUntil(
      new Promise(function(resolve) {
        setTimeout(function() {
          showAlarmNotification((label || 'Alarme') + ' (Reportée)', id);
          notifyPageStopSound(false);
          resolve();
        }, 5 * 60 * 1000);
      })
    );
    notifyPageStopSound(true);
    return;
  }

  if (action === 'stop' || action === 'dismiss') {
    notifyPageStopSound(true);
    return;
  }

  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(cls) {
      var targetUrl = (data.url || '/chat');
      for (var i = 0; i < cls.length; i++) {
        var c = cls[i];
        if (c.url.indexOf('/chat') !== -1 && 'focus' in c) {
          c.postMessage({ type: 'STOP_ALARM_SOUND', snoozed: false });
          return c.focus();
        }
      }
      return clients.openWindow(targetUrl);
    })
  );
});

/* ═══ NOTIFIER LA PAGE D'ARRÊTER LE SON ═══ */
function notifyPageStopSound(snoozed) {
  clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(cls) {
    cls.forEach(function(c) {
      c.postMessage({ type: 'STOP_ALARM_SOUND', snoozed: snoozed || false });
    });
  });
}

/* ═══ FERMETURE DE NOTIFICATION ═══ */
self.addEventListener('notificationclose', function(e) {
  var data = e.notification.data || {};
  if (data.type === 'alarm') {
    notifyPageStopSound(false);
  }
});
