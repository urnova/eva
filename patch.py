# -*- coding: utf-8 -*-
path = 'f:/code/eva/evaprojectmultiplatforme/eva-pc/web/js/app/messages.js'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

# Fix the quote issue
content = content.replace('AUCUN HTML BRUT n\'est autorise.', 'AUCUN HTML BRUT n\\\'est autorise.')

injection = '''
  if (S.cwDevices && S.cwDevices.length > 0) {
    userCtx += '\\n\\nÉTAT CLOUDWORKS (Vos Appareils Connectés) :\\n';
    S.cwDevices.forEach(function(d) {
        userCtx += '- ' + (d.deviceName || d.id) + ' (' + (d.online ? 'En Ligne' : 'Hors Ligne') + ')\\n';
    });
    userCtx += 'Si l\\'utilisateur te demande d\\'exécuter une tâche sur son PC, tu utiliseras l\\'outil Tâche PC [ACTION:{\"type\":\"agentic_task\",\"prompt\":\"...\"}]. S\\'il y a des PC en ligne, la commande y sera envoyée.\\n';
  }

  if (window.eva) {
      userCtx += '\\nNOTE IMPORTANTE : Tu tournes actuellement SUR l\\'application PC locale E.V.A Desktop (pas sur le web). Tu AS un accès direct à ce système via tes outils.\\n';
  } else {
      userCtx += '\\nNOTE IMPORTANTE : Tu tournes actuellement sur la version Web / Mobile. Tu n\\'es pas sur le PC localement. Pour agir sur le PC, tu dois impérativement utiliser l\\'outil Tâche PC vers un noeud CloudWorks En Ligne.\\n';
  }
'''

content = content.replace('formatGraphToText(S.evaMemory);\n  }', 'formatGraphToText(S.evaMemory);\n  }\n' + injection)

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)
