import https from 'https';
import crypto from 'crypto';

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method Not Allowed' });
  }

  try {
    const serviceAccountRaw = process.env.FIREBASE_SERVICE_ACCOUNT;

    if (!serviceAccountRaw) {
      return res.status(503).json({ 
        ok: false, 
        error: 'Service push non configuré sur Vercel (FIREBASE_SERVICE_ACCOUNT manquant)' 
      });
    }

    const serviceAccount = JSON.parse(serviceAccountRaw);
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const userId = body.userId;

    // Champs pour les alarmes (titre, corps de la notif)
    const title = body.title || 'Notification E.V.A';
    const messageBody = body.body || 'Vous avez une nouvelle alarme.';
    const tag = body.tag || `eva-notif-${Date.now()}`;

    if (!userId) {
      return res.status(400).json({ ok: false, error: 'userId requis' });
    }

    // Obtenir un access token OAuth2 pour l'API Firebase Admin
    const accessToken = await getFirebaseAccessToken(serviceAccount);

    // Lire les tokens FCM depuis Firestore REST API
    const projectId = serviceAccount.project_id;
    const firestoreUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/users/${userId}`;
    const userDoc = await httpsGet(firestoreUrl, { Authorization: `Bearer ${accessToken}` });
    const uData = userDoc.fields || {};
    let tokens = [];

    if (uData.fcmTokens && uData.fcmTokens.arrayValue && uData.fcmTokens.arrayValue.values) {
      tokens = uData.fcmTokens.arrayValue.values.map(v => v.stringValue).filter(Boolean);
    } else if (uData.fcmToken && uData.fcmToken.stringValue) {
      tokens = [uData.fcmToken.stringValue];
    }

    if (!tokens.length) {
      return res.status(404).json({ ok: false, error: 'Token FCM introuvable — activez les notifications sur au moins un appareil' });
    }

    // Envoyer le push FCM
    let sent = 0;
    for (const token of tokens) {
      try {
        await sendFCMPush(projectId, accessToken, token, title, messageBody, tag, userId);
        sent++;
      } catch (e) {
        console.warn('Token failed:', token, e.message);
      }
    }

    if (sent === 0) {
      return res.status(500).json({ ok: false, error: 'Tous les envois ont échoué' });
    }

    return res.status(200).json({ ok: true, sentCount: sent });

  } catch(e) {
    console.error('[send-notification]', e.message);
    return res.status(500).json({ ok: false, error: e.message });
  }
}

/* ─── Helpers ─── */

function httpsGet(url, reqHeaders) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: reqHeaders }, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); } catch(e) { reject(new Error('JSON parse failed')); }
      });
    }).on('error', reject);
  });
}

function httpsPost(url, reqHeaders, body) {
  return new Promise((resolve, reject) => {
    const bodyStr = JSON.stringify(body);
    const urlObj = new URL(url);
    const options = {
      hostname: urlObj.hostname,
      path: urlObj.pathname + urlObj.search,
      method: 'POST',
      headers: Object.assign({ 
        'Content-Type': 'application/json', 
        'Content-Length': Buffer.byteLength(bodyStr) 
      }, reqHeaders)
    };
    const req = https.request(options, res => {
      let data = '';
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
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT' };
  const payload = {
    iss: sa.client_email,
    scope: 'https://www.googleapis.com/auth/cloud-platform https://www.googleapis.com/auth/firebase.messaging',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now
  };

  const b64 = s => Buffer.from(JSON.stringify(s)).toString('base64url');
  const unsigned = b64(header) + '.' + b64(payload);
  const sign = crypto.createSign('RSA-SHA256');
  sign.update(unsigned);
  const sig = sign.sign(sa.private_key, 'base64url');
  const jwt = unsigned + '.' + sig;

  return httpsPost('https://oauth2.googleapis.com/token', {}, {
    grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
    assertion: jwt
  }).then(r => {
    if (!r.access_token) throw new Error('OAuth2 failed');
    return r.access_token;
  });
}

function sendFCMPush(projectId, accessToken, token, title, body, tag, userId) {
  const url = `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`;
  return httpsPost(url, { Authorization: `Bearer ${accessToken}` }, {
    message: {
      token: token,
      data: {
        title: title,
        body: body,
        type: 'alarm',
        tag: tag,
        userId: userId
      }
    }
  });
}
