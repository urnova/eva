const https = require('https');

exports.handler = async function(event, context) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ ok: false, error: 'Method Not Allowed' }) };
  }

  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*'
  };

  try {
    var serviceAccountRaw = process.env.FIREBASE_SERVICE_ACCOUNT;
    var vapidKey = process.env.FCM_VAPID_KEY;

    if (!serviceAccountRaw) {
      return {
        statusCode: 503,
        headers,
        body: JSON.stringify({ ok: false, error: 'Service push non configuré sur Netlify (FIREBASE_SERVICE_ACCOUNT manquant)' })
      };
    }

    var serviceAccount = JSON.parse(serviceAccountRaw);
    var body = JSON.parse(event.body || '{}');
    var userId = body.userId;

    if (!userId) {
      return { statusCode: 400, headers, body: JSON.stringify({ ok: false, error: 'userId requis' }) };
    }

    /* Obtenir un access token OAuth2 pour l'API Firebase Admin */
    var accessToken = await getFirebaseAccessToken(serviceAccount);

    /* Lire les tokens FCM depuis Firestore REST API */
    var projectId = serviceAccount.project_id;
    var firestoreUrl = 'https://firestore.googleapis.com/v1/projects/' + projectId + '/databases/(default)/documents/users/' + userId;
    var userDoc = await httpsGet(firestoreUrl, { Authorization: 'Bearer ' + accessToken });
    var uData = userDoc.fields || {};
    var tokens = [];

    if (uData.fcmTokens && uData.fcmTokens.arrayValue && uData.fcmTokens.arrayValue.values) {
      tokens = uData.fcmTokens.arrayValue.values.map(v => v.stringValue).filter(Boolean);
    } else if (uData.fcmToken && uData.fcmToken.stringValue) {
      tokens = [uData.fcmToken.stringValue];
    }

    if (!tokens.length) {
      return { statusCode: 404, headers, body: JSON.stringify({ ok: false, error: 'Token FCM introuvable — activez les notifications sur au moins un appareil' }) };
    }

    /* Envoyer le push FCM via FCM HTTP v1 */
    var sent = 0;
    for (var token of tokens) {
      try {
        await sendFCMPush(projectId, accessToken, token, userId);
        sent++;
      } catch(e) {
        console.warn('Token failed:', token, e.message);
      }
    }

    if (sent === 0) {
      return { statusCode: 500, headers, body: JSON.stringify({ ok: false, error: 'Tous les tokens ont échoué' }) };
    }

    return { statusCode: 200, headers, body: JSON.stringify({ ok: true }) };

  } catch(e) {
    console.error('[test-notification]', e.message);
    return { statusCode: 500, headers, body: JSON.stringify({ ok: false, error: e.message }) };
  }
};

/* ─── Helpers ─── */

function httpsGet(url, reqHeaders) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: reqHeaders }, res => {
      var data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); } catch(e) { reject(new Error('JSON parse: ' + data.slice(0, 100))); }
      });
    }).on('error', reject);
  });
}

function httpsPost(url, reqHeaders, body) {
  return new Promise((resolve, reject) => {
    var bodyStr = JSON.stringify(body);
    var urlObj = new URL(url);
    var options = {
      hostname: urlObj.hostname,
      path: urlObj.pathname + urlObj.search,
      method: 'POST',
      headers: Object.assign({ 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(bodyStr) }, reqHeaders)
    };
    var req = https.request(options, res => {
      var data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); } catch(e) { resolve({}); }
      });
    });
    req.on('error', reject);
    req.write(bodyStr);
    req.end();
  });
}

function getFirebaseAccessToken(sa) {
  var now = Math.floor(Date.now() / 1000);
  var header = { alg: 'RS256', typ: 'JWT' };
  var payload = {
    iss: sa.client_email,
    scope: 'https://www.googleapis.com/auth/cloud-platform https://www.googleapis.com/auth/firebase.messaging',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now
  };

  var crypto = require('crypto');
  var b64 = s => Buffer.from(JSON.stringify(s)).toString('base64url');
  var unsigned = b64(header) + '.' + b64(payload);
  var sign = crypto.createSign('RSA-SHA256');
  sign.update(unsigned);
  var sig = sign.sign(sa.private_key, 'base64url');
  var jwt = unsigned + '.' + sig;

  return httpsPost('https://oauth2.googleapis.com/token', {}, {
    grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
    assertion: jwt
  }).then(r => {
    if (!r.access_token) throw new Error('OAuth2 failed: ' + JSON.stringify(r));
    return r.access_token;
  });
}

function sendFCMPush(projectId, accessToken, token, userId) {
  var url = 'https://fcm.googleapis.com/v1/projects/' + projectId + '/messages:send';
  return httpsPost(url, { Authorization: 'Bearer ' + accessToken }, {
    message: {
      token: token,
      data: {
        title: '🧪 Test — E.V.A',
        body: 'Les notifications push fonctionnent ! Vos alarmes arriveront même site fermé.',
        type: 'test',
        tag: 'eva-test-' + Date.now(),
        userId: userId
      }
    }
  });
}
