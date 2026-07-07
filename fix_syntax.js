const fs = require('fs');
let login = fs.readFileSync('eva-pc/web/app-login.html', 'utf8');

// I will find the exact start and end of the sessionData injection and replace it cleanly
const cleanInjection = `
                var provider = (payload.firebase && payload.firebase.sign_in_provider) ? payload.firebase.sign_in_provider : "password";
                var fbaseKey = 'firebase:authUser:' + firebaseConfig.apiKey + ':[DEFAULT]';
                var sessionData = {
                  uid: payload.user_id,
                  email: payload.email,
                  emailVerified: payload.email_verified || false,
                  displayName: payload.name || payload.email.split('@')[0],
                  isAnonymous: false,
                  photoURL: payload.picture || null,
                  providerData: [{
                    providerId: provider,
                    uid: payload.email,
                    displayName: payload.name || null,
                    email: payload.email,
                    phoneNumber: null,
                    photoURL: payload.picture || null
                  }],
                  stsTokenManager: {
                    refreshToken: data.refreshToken,
                    accessToken: res.idToken,
                    expirationTime: Date.now() + (parseInt(res.expiresIn) * 1000)
                  },
                  createdAt: String(Date.now()),
                  lastLoginAt: String(Date.now()),
                  apiKey: firebaseConfig.apiKey,
                  appName: "[DEFAULT]"
                };
                localStorage.setItem(fbaseKey, JSON.stringify(sessionData));

                setTimeout(function() {
                  window.location.href = 'chat.html';
                }, 100);
`;

// Replace everything between "var provider =" and "dbReq.onerror" (or the catch block)
login = login.replace(/var provider =[\s\S]*?dbReq\.onerror = function\(\) \{ window\.location\.href = 'chat\.html'; \};/, cleanInjection);

fs.writeFileSync('eva-pc/web/app-login.html', login, 'utf8');
console.log("SYNTAX ERROR FIXED");
