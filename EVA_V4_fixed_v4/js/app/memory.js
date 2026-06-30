/* ═══════════════════════════════════════════════════
   MÉMOIRE ÉVOLUTIVE — Extraction & Sauvegarde
═══════════════════════════════════════════════════ */
async function extractUserInsights(lastUserMsg, lastEvaMsg) {
  if (!S.user || !S.adaptationEnabled) return;
  try {
    /* Construire l'extrait de conversation (6 derniers messages) */
    var recentMsgs = (S.messages || []).slice(-6).map(function(m) {
      return (m.role === 'eva' || m.role === 'assistant' ? 'EVA' : 'Utilisateur') + ' : ' + (m.content || '').slice(0, 300);
    }).join('\n');
    /* Fallback si S.messages est vide (ex: 1er message d'une nouvelle conversation) */
    if (!recentMsgs && (lastUserMsg || lastEvaMsg)) {
      recentMsgs = 'Utilisateur : ' + (lastUserMsg || '').slice(0, 300) + '\nEVA : ' + (lastEvaMsg || '').slice(0, 300);
    }
    if (!recentMsgs) return;

    var existingMemory = (S.evaMemory && S.evaMemory.resume) ? S.evaMemory.resume : '';
    var nick = (S.profile && (S.profile.nickname || S.profile.displayName)) || 'l\'utilisateur';

    var extractPrompt = 'Tu es un assistant spécialisé dans l\'analyse de profil utilisateur. ' +
      'À partir de la conversation ci-dessous et des informations déjà connues, ' +
      'mets à jour et enrichis le résumé du profil de ' + nick + '. ' +
      'Inclus uniquement des faits concrets : profession, centres d\'intérêt, habitudes, projets en cours, personnalité, préférences de communication, relations importantes. ' +
      'Sois factuel et concis (3-5 phrases maximum). Ne mentionne pas cette analyse dans ta réponse. ' +
      'Réponds UNIQUEMENT avec le résumé mis à jour, sans introduction ni conclusion.\n\n' +
      (existingMemory ? 'PROFIL ACTUEL :\n' + existingMemory + '\n\n' : '') +
      'CONVERSATION RÉCENTE :\n' + recentMsgs;

    var newMemoryText = null;

    /* Tentative 1 : Puter AI — utilisé si connecté (peu importe le provider actif) */
    if (window.puter && S.config && S.config.puterUsername) {
      try {
        var puterResp = await puter.ai.chat(extractPrompt, { model: 'gpt-4o-mini' });
        var puterContent = typeof puterResp === 'string' ? puterResp
          : (puterResp && puterResp.message && puterResp.message.content)
          || (puterResp && puterResp.content)
          || '';
        newMemoryText = puterContent.trim();
        if (newMemoryText) console.log('[Mémoire Évolutive] Extraction Puter OK');
      } catch(e) { console.warn('[Mémoire] Puter extraction failed:', e); }
    }

    /* Tentative 2 : OpenAI si clé dispo */
    if (!newMemoryText && S.config && S.config.openaiApiKey) {
      try {
        var oaiResp = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + S.config.openaiApiKey },
          body: JSON.stringify({ model: 'gpt-4o-mini', messages: [{ role: 'user', content: extractPrompt }], max_tokens: 300 })
        });
        if (oaiResp.ok) {
          var oaiData = await oaiResp.json();
          newMemoryText = (oaiData.choices && oaiData.choices[0] && oaiData.choices[0].message && oaiData.choices[0].message.content || '').trim();
        }
      } catch(e) { console.warn('[Mémoire] OpenAI extraction failed:', e); }
    }

    /* Tentative 3 : Provider actif (Claude, Pollinations, Ollama, etc.) — fallback universel */
    if (!newMemoryText && window.EVAChatHandler) {
      try {
        var origSys = window.EVA_SYSTEM_PROMPT;
        window.EVA_SYSTEM_PROMPT = 'Tu es un assistant spécialisé en analyse de profil utilisateur. Réponds uniquement avec le résumé demandé, sans introduction ni conclusion.';
        var chatResp = await window.EVAChatHandler.sendMessage(extractPrompt, {});
        window.EVA_SYSTEM_PROMPT = origSys;
        if (chatResp && chatResp.success && chatResp.content) {
          newMemoryText = chatResp.content.trim().slice(0, 800);
          if (newMemoryText) console.log('[Mémoire Évolutive] Extraction via provider actif OK');
        }
      } catch(e) {
        console.warn('[Mémoire] Provider actif extraction failed:', e);
      }
    }

    if (!newMemoryText || newMemoryText.length < 10) return;

    /* Sauvegarder en Firebase */
    var memoryData = {
      resume: newMemoryText.slice(0, 800),
      lastUpdated: new Date().toISOString(),
      version: ((S.evaMemory && S.evaMemory.version) || 0) + 1
    };
    await db.collection('users').doc(S.user.uid).set({ evaMemory: memoryData }, { merge: true });
    S.evaMemory = memoryData;
    if (S.profile) S.profile.evaMemory = memoryData;
    console.log('[Mémoire Évolutive] Mise à jour — v' + memoryData.version);
  } catch(e) {
    console.warn('[Mémoire Évolutive] Erreur extraction:', e);
  }
}
window.extractUserInsights = extractUserInsights;
