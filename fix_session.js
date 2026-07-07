const fs = require('fs');

let login = fs.readFileSync('eva-pc/web/app-login.html', 'utf8');

const oldSessionData = /var sessionData = \{\s*uid: payload\.user_id,\s*email: payload\.email,[\s\S]*?expirationTime: Date\.now\(\) \+ \(parseInt\(res\.expires_in\) \* 1000\)\s*\}\s*\};/;

const newSessionData = `var sessionData = {
                uid: payload.user_id,
                email: payload.email,
                emailVerified: payload.email_verified || false,
                displayName: payload.name || payload.email.split('@')[0],
                isAnonymous: false,
                photoURL: payload.picture || null,
                providerData: [{
                  providerId: "password",
                  uid: payload.email,
                  displayName: payload.name || null,
                  email: payload.email,
                  phoneNumber: null,
                  photoURL: payload.picture || null
                }],
                stsTokenManager: {
                  refreshToken: data.refreshToken,
                  accessToken: res.id_token,
                  expirationTime: Date.now() + (parseInt(res.expires_in) * 1000)
                },
                createdAt: String(Date.now()),
                lastLoginAt: String(Date.now()),
                apiKey: firebaseConfig.apiKey,
                appName: "[DEFAULT]"
              };`;

login = login.replace(oldSessionData, newSessionData);
fs.writeFileSync('eva-pc/web/app-login.html', login, 'utf8');

console.log("SESSION FIXED");
