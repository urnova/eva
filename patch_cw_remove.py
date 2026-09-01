# -*- coding: utf-8 -*-
import re

paths = [
    r'f:\code\eva\evaprojectmultiplatforme\EVA_V4_fixed_v4\js\features\cloudworks.js',
    r'f:\code\eva\evaprojectmultiplatforme\eva-pc\web\js\features\cloudworks.js'
]
new_func = '''async function cwRemoveDevice(deviceId, deviceName) {
    if (!window.S || !window.S.user) return;
    if (!confirm('Retirer ' + deviceName + ' de votre compte ?\\n\\nL\\'appareil sera déconnecté.')) return;
    try {
        const docSnap = await window.db.collection('cloudworks').doc(S.user.uid).collection('devices').doc(deviceId).get();
        if (docSnap.exists && docSnap.data().sessionId) {
            await window.db.collection('users').doc(S.user.uid).collection('sessions').doc(docSnap.data().sessionId).update({revoke: true}).catch(()=>{});
        }
        await window.db.collection('cloudworks').doc(S.user.uid).collection('devices').doc(deviceId).delete();
        if (window.toast) window.toast('Appareil retiré et session révoquée.', 'success');
    } catch(e) {
        if (window.toast) window.toast('Erreur : ' + e.message, 'error');
    }
}'''

for path in paths:
    with open(path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    content = re.sub(r'async function cwRemoveDevice\(deviceId, deviceName\).*?catch\(e\) \{\s*if \(window\.toast\) window\.toast\(\'Erreur : \' \+ e\.message, \'error\'\);\s*\}\s*\}', new_func, content, flags=re.DOTALL)
    
    with open(path, 'w', encoding='utf-8') as f:
        f.write(content)
