const fs = require('fs');

function patchFile(path, replacements) {
    if (!fs.existsSync(path)) return;
    let content = fs.readFileSync(path, 'utf8');
    for (let r of replacements) {
        content = content.replace(r.search, r.replace);
    }
    fs.writeFileSync(path, content, 'utf8');
}

const isWin = process.platform === 'win32';

// 1. Splash HTML
patchFile('eva-pc/web/splash.html', [
    {
        search: '<button class="nav-btn" onclick="startApp()">LANCER E.V.A</button>',
        replace: '<button class="nav-btn" style="pointer-events: auto;" onclick="startApp()">LANCER E.V.A</button>'
    },
    {
        search: '<button class="nav-btn" style="background:var(--surface);" onclick="window.eva.window.close()">QUITTER</button>',
        replace: '<button class="nav-btn" style="background:var(--surface); pointer-events: auto;" onclick="window.eva.window.close()">QUITTER</button>'
    }
]);

const paths = {
    chat: ['EVA_V4_fixed_v4/chat.html', 'eva-pc/web/chat.html'],
    messages: ['EVA_V4_fixed_v4/js/app/messages.js', 'eva-pc/web/js/app/messages.js'],
    fileGen: ['EVA_V4_fixed_v4/js/app/file-gen.js', 'eva-pc/web/js/app/file-gen.js'],
    core: ['EVA_V4_fixed_v4/js/app/core.js', 'eva-pc/web/js/app/core.js'],
    settings: ['EVA_V4_fixed_v4/js/app/settings-panel.js', 'eva-pc/web/js/app/settings-panel.js'],
    cw: ['EVA_V4_fixed_v4/js/features/cloudworks.js', 'eva-pc/web/js/features/cloudworks.js'],
    pcAgent: ['EVA_V4_fixed_v4/js/features/pc-agent.js', 'eva-pc/web/js/features/pc-agent.js']
};

// 2. Hide CloudWorks Dashboard on PC
patchFile('eva-pc/web/chat.html', [
    {
        search: 'id="navCloudWorks"',
        replace: 'id="navCloudWorks_hidden_pc"'
    }
]);

// 3. File Gen - unclickable buttons & light theme
for (let p of paths.fileGen) {
    patchFile(p, [
        {
            search: '<button class="btn btn-primary" style="display:none;" id="downloadMarpBtn">',
            replace: '<button class="btn btn-primary" style="display:none; pointer-events:auto; z-index:9999;" id="downloadMarpBtn">'
        },
        {
            search: 'document.getElementById(\'downloadMarpBtn\').style.display = \'inline-block\';',
            replace: 'var btn = document.getElementById(\'downloadMarpBtn\'); if(btn) { btn.style.display = \'inline-block\'; btn.onclick = () => { const a = document.createElement("a"); a.href = url; a.download = filename; a.click(); }; }'
        }
    ]);
}

// 4. Messages.js - strict markdown & cloudworks context
for (let p of paths.messages) {
    patchFile(p, [
        {
            search: "'- PDF (Marp) \\u2192 [ACTION:{\"type\":\"marp_pdf\",\"filename\":\"doc.pdf\",\"content\":\"---\\\\nmarp: true\\\\ntheme: default\\\\n---\\\\n\\\\n# Titre\\\\n\\\\nContenu de la slide\"}]\\\\n' +",
            replace: "'- RÈGLE PDF/PPTX : Remplace NOM_DOCUMENT par un nom de fichier pertinent (ex: synthese_reunion.pdf). Tu dois IMPERATIVEMENT utiliser le format Markdown pur. AUCUN HTML BRUT n\\'est autorisé.\\n' +\n          '- PDF (Marp) \\u2192 [ACTION:{\"type\":\"marp_pdf\",\"filename\":\"NOM_DOCUMENT.pdf\",\"content\":\"---\\\\nmarp: true\\\\ntheme: default\\\\n---\\\\n\\\\n# Titre\\\\n\\\\nContenu de la slide\"}]\\n' +"
        },
        {
            search: "'- PowerPoint (Marp) \\u2192 [ACTION:{\"type\":\"marp_pptx\",\"filename\":\"p.pptx\",\"content\":\"---\\\\nmarp: true\\\\ntheme: default\\\\n---\\\\n\\\\n# Titre\\\\n\\\\nContenu de la slide\"}]\\\\n' +",
            replace: "'- PowerPoint (Marp) \\u2192 [ACTION:{\"type\":\"marp_pptx\",\"filename\":\"NOM_PRESENTATION.pptx\",\"content\":\"---\\\\nmarp: true\\\\ntheme: default\\\\n---\\\\n\\\\n# Titre\\\\n\\\\nContenu de la slide\"}]\\n' +"
        },
        {
            search: "var _now = new Date();",
            replace: "if (S.cwDevices && S.cwDevices.length > 0) {\n    userCtx += '\\n\\nÉTAT CLOUDWORKS (Vos Appareils Connectés) :\\n';\n    S.cwDevices.forEach(function(d) {\n        userCtx += '- ' + (d.deviceName || d.id) + ' (' + (d.online ? 'En Ligne' : 'Hors Ligne') + ')\\n';\n    });\n    userCtx += 'Si l\\'utilisateur te demande d\\'exécuter une tâche sur son PC, tu utiliseras l\\'outil Tâche PC [ACTION:{\"type\":\"agentic_task\",\"prompt\":\"...\"}]. S\\'il y a des PC en ligne, la commande y sera envoyée.\\n';\n  }\n\n  if (window.eva) {\n      userCtx += '\\nNOTE IMPORTANTE : Tu tournes actuellement SUR l\\'application PC locale E.V.A Desktop (pas sur le web). Tu AS un accès direct à ce système via tes outils.\\n';\n  } else {\n      userCtx += '\\nNOTE IMPORTANTE : Tu tournes actuellement sur la version Web / Mobile. Tu n\\'es pas sur le PC localement. Pour agir sur le PC, tu dois impérativement utiliser l\\'outil Tâche PC vers un noeud CloudWorks En Ligne.\\n';\n  }\n\n  var _now = new Date();"
        }
    ]);
}

// 5. PCAgent
for (let p of paths.pcAgent) {
    patchFile(p, [
        {
            search: "deviceName: 'EVA Desktop (Dev)'",
            replace: "deviceName: 'EVA Desktop', sessionId: window.S.sessionId || null"
        }
    ]);
}

// 6. CloudWorks Remove & Offline Timeout
for (let p of paths.cw) {
    patchFile(p, [
        {
            search: /async function cwRemoveDevice.*?catch\(e\)\s*\{\s*if \(window\.toast\) window\.toast\('Erreur : ' \+ e\.message, 'error'\);\s*\}\s*\}/s,
            replace: "async function cwRemoveDevice(deviceId, deviceName) {\n    if (!window.S || !window.S.user) return;\n    if (!confirm('Retirer ' + deviceName + ' de votre compte ?\\n\\nL\\'appareil sera déconnecté.')) return;\n    try {\n        const docSnap = await window.db.collection('cloudworks').doc(S.user.uid).collection('devices').doc(deviceId).get();\n        if (docSnap.exists && docSnap.data().sessionId) {\n            await window.db.collection('users').doc(S.user.uid).collection('sessions').doc(docSnap.data().sessionId).update({revoke: true}).catch(()=>{});\n        }\n        await window.db.collection('cloudworks').doc(S.user.uid).collection('devices').doc(deviceId).delete();\n        if (window.toast) window.toast('Appareil retiré et session révoquée.', 'success');\n    } catch(e) {\n        if (window.toast) window.toast('Erreur : ' + e.message, 'error');\n    }\n}"
        },
        {
            search: "var online = d.online === true;",
            replace: "var online = d.online === true;\n    if (online && d.lastSeen && d.lastSeen.toDate) {\n      var diffMs = Date.now() - d.lastSeen.toDate().getTime();\n      if (diffMs > 120000) {\n        online = false;\n        d.online = false;\n      }\n    }"
        }
    ]);
}

// 7. Settings Revoke Session
for (let p of paths.settings) {
    patchFile(p, [
        {
            search: /async function revokeSession\(sessionId\).*?catch\(e\)\s*\{\s*console\.error\('Erreur revoke session:', e\);\s*\}\s*\}/s,
            replace: "async function revokeSession(sessionId) {\n    if(!confirm('Révoquer cette session ?')) return;\n    try {\n      const uid = window.S.user.uid;\n      await window.db.collection('users').doc(uid).collection('sessions').doc(sessionId).update({revoke: true});\n      const cwSnaps = await window.db.collection('cloudworks').doc(uid).collection('devices').where('sessionId', '==', sessionId).get();\n      cwSnaps.forEach(doc => doc.ref.delete());\n    } catch(e) {\n      console.error('Erreur revoke session:', e);\n    }\n}"
        }
    ]);
}

console.log('All files patched successfully in UTF-8.');
