# -*- coding: utf-8 -*-
import re

paths = [
    r'f:\code\eva\evaprojectmultiplatforme\EVA_V4_fixed_v4\js\app\settings-panel.js',
    r'f:\code\eva\evaprojectmultiplatforme\eva-pc\web\js\app\settings-panel.js'
]
new_revoke = '''
window.revokeSession = async function(sid) {
    if(!confirm('Révoquer cette session ? Elle sera déconnectée immédiatement.')) return;
    try {
        await window.db.collection('users').doc(S.user.uid).collection('sessions').doc(sid).update({revoke: true});
        const devicesSnap = await window.db.collection('cloudworks').doc(S.user.uid).collection('devices').where('sessionId', '==', sid).get();
        const batch = window.db.batch();
        devicesSnap.forEach(doc => batch.delete(doc.ref));
        await batch.commit();
        if (typeof window.loadSessions === 'function') window.loadSessions();
        if (typeof loadActiveSessions === 'function') loadActiveSessions();
        if(window.toast) window.toast('Session et appareil révoqués.', 'success');
    } catch(e) {
        if(window.toast) window.toast('Erreur: ' + e.message, 'error');
    }
};
'''

for path in paths:
    with open(path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Remove all definitions of revokeSession
    content = re.sub(r'function revokeSession\([^)]*\)\s*\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}', '', content)
    content = re.sub(r'window\.revokeSession\s*=\s*(?:async\s*)?function\([^)]*\)\s*\{[^{}]*(?:\{[^{}]*\}[^{}]*)*(?:\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}[^{}]*)*\}', '', content)
    content = re.sub(r'window\.revokeSession\s*=\s*revokeSession;', '', content)
    
    content += '\n' + new_revoke + '\n'
    
    with open(path, 'w', encoding='utf-8') as f:
        f.write(content)
