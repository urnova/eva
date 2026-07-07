const fs = require('fs');
let login = fs.readFileSync('eva-pc/web/app-login.html', 'utf8');

// Replace the static 'password' with dynamic provider
const replacement = `
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
`;

login = login.replace(/var fbaseKey = 'firebase:authUser:' \+ firebaseConfig\.apiKey \+ ':\[DEFAULT\]';\s*var sessionData = \{\s*uid: payload\.user_id,\s*email: payload\.email,\s*emailVerified: payload\.email_verified \|\| false,\s*displayName: payload\.name \|\| payload\.email\.split\('@'\)\[0\],\s*isAnonymous: false,\s*photoURL: payload\.picture \|\| null,\s*providerData: \[\{\s*providerId: "password",/g, replacement);

fs.writeFileSync('eva-pc/web/app-login.html', login, 'utf8');
console.log("DYNAMIC PROVIDER ADDED");
