import sys
sys.stdout.reconfigure(encoding='utf-8')

path = r'EVA_V4_fixed_v4\js\app\messages.js'
with open(path, 'r', encoding='utf-8') as f:
    c = f.read()

OLD = """if (window.eva) {
      userCtx += '\\nNOTE IMPORTANTE : Tu tournes actuellement SUR l\\'application PC locale E.V.A Desktop (pas sur le web). Tu AS un accès direct à ce système via tes outils.\\n';
  } else {
      userCtx += '\\nNOTE IMPORTANTE : Tu tournes actuellement sur la version Web / Mobile. Tu n\\'es pas sur le PC localement. Pour agir sur le PC, tu dois impérativement utiliser l\\'outil Tâche PC vers un noeud CloudWorks En Ligne.\\n';
  }"""

NEW = """// Web uniquement — pas de window.eva sur le navigateur
    // Détecter les PC en ligne pour le site web
    var onlinePCs = [];
    var offlinePCs = [];
    if (S.cwDevices && S.cwDevices.length > 0) {
      S.cwDevices.forEach(function(d) {
        if (d.online) onlinePCs.push(d);
        else offlinePCs.push(d);
      });
    }

    userCtx += '\\nENVIRONNEMENT : Tu tournes sur la version Web/Navigateur. Pour agir sur un PC, tu dois utiliser CloudWorks.\\n';

    if (onlinePCs.length === 0 && offlinePCs.length === 0) {
      userCtx += 'CloudWorks : Aucun appareil PC enregistré. Propose à l\\'utilisateur d\\'installer EVA Desktop.\\n';
    } else if (onlinePCs.length === 0) {
      userCtx += 'CloudWorks : Aucun PC en ligne (' + offlinePCs.length + ' hors ligne). Tu ne peux pas exécuter de tâches PC en ce moment. Informe l\\'utilisateur.\\n';
    } else if (onlinePCs.length === 1) {
      userCtx += 'CloudWorks : 1 PC disponible : ' + (onlinePCs[0].deviceName || onlinePCs[0].deviceId) + ' [ID: ' + onlinePCs[0].deviceId + '] — En ligne.\\n';
      userCtx += 'Pour une tâche sur ce PC, génère [ACTION:{"type":"...","deviceId":"' + onlinePCs[0].deviceId + '","prompt":"..."}].\\n';
    } else {
      userCtx += 'CloudWorks : ' + onlinePCs.length + ' PC disponibles en ligne :\\n';
      onlinePCs.forEach(function(d) {
        userCtx += '  - ' + (d.deviceName || d.deviceId) + ' [ID: ' + d.deviceId + ']\\n';
      });
      userCtx += 'Si l\\'utilisateur ne précise pas, demande-lui sur quel PC exécuter la tâche. Génère ensuite [ACTION:{...,"deviceId":"<id choisi>"}].\\n';
    }
    if (offlinePCs.length > 0) {
      userCtx += 'Hors ligne (indisponibles) : ' + offlinePCs.map(function(d){ return d.deviceName || d.deviceId; }).join(', ') + '\\n';
    }"""

if OLD in c:
    c = c.replace(OLD, NEW, 1)
    print('OK: system prompt web enrichi')
else:
    print('WARN: bloc introuvable dans web messages.js')
    idx = c.find('if (window.eva)')
    if idx >= 0:
        print('Found at:', idx)
        print(repr(c[idx:idx+300]))

with open(path, 'w', encoding='utf-8') as f:
    f.write(c)
print('Done')
