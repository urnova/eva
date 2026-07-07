const fs = require('fs');
let login = fs.readFileSync('eva-pc/web/app-login.html', 'utf8');

const missingLogic = `
                var fbaseKey = 'firebase:authUser:' + firebaseConfig.apiKey + ':[DEFAULT]';
                var sessionData = {
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
                };
                localStorage.setItem(fbaseKey, JSON.stringify(sessionData));
`;

login = login.replace(/localStorage\.setItem\(fbaseKey, JSON\.stringify\(sessionData\)\);/, missingLogic);
fs.writeFileSync('eva-pc/web/app-login.html', login, 'utf8');
console.log("FBASEKEY RESTORED");
