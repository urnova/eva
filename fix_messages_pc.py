import sys
sys.stdout.reconfigure(encoding='utf-8')

path = r'eva-pc\web\js\app\messages.js'
with open(path, 'r', encoding='utf-8') as f:
    c = f.read()

OLD = """if (window.eva) {
      userCtx += '\\nNOTE IMPORTANTE : Tu tournes actuellement SUR l\\'application PC locale E.V.A Desktop (pas sur le web). Tu AS un accès direct à ce système via tes outils.\\n';
  } else {
      userCtx += '\\nNOTE IMPORTANTE : Tu tournes actuellement sur la version Web / Mobile. Tu n\\'es pas sur le PC localement. Pour agir sur le PC, tu dois impérativement utiliser l\\'outil Tâche PC vers un noeud CloudWorks En Ligne.\\n';
  }"""

NEW = """if (window.eva) {
    // === VERSION PC DESKTOP ===
    var deviceId = window._cwDeviceId || localStorage.getItem('cw_device_id') || 'PC-inconnu';
    userCtx += '\\nENVIRONNEMENT : Tu tournes SUR l\\'application PC locale E.V.A Desktop.\\n';
    userCtx += 'DEVICE ID de ce PC : ' + deviceId + '\\n';

    // Statut LLM (si disponible)
    if (window._llmStatus !== undefined) {
      userCtx += 'LLM LOCAL : ' + (window._llmStatus ? 'Actif (tu peux déléguer des tâches autonomes complexes au LLM local)' : 'Inactif') + '\\n';
    }

    userCtx += '\\nRÈGLES IMPORTANTES POUR CE PC :\\n';
    userCtx += '- Pour toute action système sur CE PC (fichiers, screenshots, scripts), génère [ACTION:{...}] avec "deviceId":"' + deviceId + '"\\n';
    userCtx += '- Si l\\'utilisateur demande une tâche complexe en plusieurs étapes, utilise [ACTION:{"type":"agentic_task","prompt":"...","deviceId":"' + deviceId + '"}]\\n';
    userCtx += '- Si CloudWorks est désactivé, dis-le à l\\'utilisateur et propose de l\\'activer dans les paramètres\\n';
    userCtx += '- Identifie-toi comme étant sur ce PC précis, pas sur le web\\n';
  } else {
    // === VERSION WEB ===
    userCtx += '\\nENVIRONNEMENT : Tu tournes sur la version Web/Navigateur. Tu n\\'es PAS sur le PC localement.\\n';

    // Détecter les PC en ligne
    var onlinePCs = [];
    var offlinePCs = [];
    if (S.cwDevices && S.cwDevices.length > 0) {
      S.cwDevices.forEach(function(d) {
        if (d.online) onlinePCs.push(d);
        else offlinePCs.push(d);
      });
    }

    if (onlinePCs.length === 0 && offlinePCs.length === 0) {
      userCtx += 'CloudWorks : Aucun appareil PC enregistré. L\\'utilisateur doit installer EVA Desktop.\\n';
    } else if (onlinePCs.length === 0) {
      userCtx += 'CloudWorks : Aucun PC en ligne actuellement (' + offlinePCs.length + ' hors ligne). Impossible d\\'exécuter des tâches PC.\\n';
    } else if (onlinePCs.length === 1) {
      userCtx += 'CloudWorks : 1 PC en ligne : ' + (onlinePCs[0].deviceName || onlinePCs[0].deviceId) + ' (ID: ' + onlinePCs[0].deviceId + ')\\n';
      userCtx += 'Pour des tâches sur ce PC, génère [ACTION:{...,"deviceId":"' + onlinePCs[0].deviceId + '"}]\\n';
    } else {
      userCtx += 'CloudWorks : ' + onlinePCs.length + ' PC en ligne :\\n';
      onlinePCs.forEach(function(d) {
        userCtx += '  - ' + (d.deviceName || d.deviceId) + ' (ID: ' + d.deviceId + ') — En ligne\\n';
      });
      userCtx += 'Demande à l\\'utilisateur sur quel PC exécuter la tâche, ou utilise le premier disponible si évident.\\n';
    }
    if (offlinePCs.length > 0) {
      userCtx += 'PCs hors ligne (non disponibles) : ' + offlinePCs.map(function(d){ return d.deviceName || d.deviceId; }).join(', ') + '\\n';
    }
    userCtx += 'Pour toute tâche sur un PC, génère [ACTION:{...}] avec le bon deviceId du PC cible en ligne.\\n';
  }"""

if OLD in c:
    c = c.replace(OLD, NEW, 1)
    print('OK: system prompt enrichi')
else:
    print('WARN: bloc introuvable, recherche alternative...')
    # Try with slightly different spacing
    idx = c.find('if (window.eva) {')
    if idx >= 0:
        end = c.find('\n  }', idx)
        end2 = c.find('\n  }', end + 5)
        print('Bloc trouvé:')
        print(repr(c[idx:end2+5]))

with open(path, 'w', encoding='utf-8') as f:
    f.write(c)
print('Done')
