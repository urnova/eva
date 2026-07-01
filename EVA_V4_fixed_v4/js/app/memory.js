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

    var existingMemory = S.evaMemory && S.evaMemory.nodes ? JSON.stringify({nodes: S.evaMemory.nodes, links: S.evaMemory.links}) : '{"nodes":[],"links":[]}';
    var nick = (S.profile && (S.profile.nickname || S.profile.displayName)) || 'l\'utilisateur';

    var extractPrompt = 'Tu es le Cerveau Neuronal (Graphe de Connaissances) de l\'IA EVA. Ton but est de modéliser TOUT ce que tu sais sur ' + nick + ' sous forme de graphe strict et EXHAUSTIF.\n' +
      'À partir de la conversation ci-dessous et du graphe actuel, renvoie UNIQUEMENT un objet JSON (sans markdown) représentant le graphe mis à jour.\n' +
      'RÈGLES ABSOLUES :\n' +
      '1. Structure exacte : {"nodes": [{"id":"...", "label":"...", "type":"person|concept|project|preference", "details": "Description complète de ce qu\'est ce noeud..."}], "links": [{"source":"...", "target":"...", "label":"..."}]}\n' +
      '2. Le champ "details" des nœuds DOIT être complet et descriptif (ex: "Astral Technologie est l\'entreprise fondée par l\'utilisateur qui se spécialise dans..."). C\'est ici que tu stockes la vraie information.\n' +
      '3. Le champ "label" des LIENS (links) doit être TRES COURT (1 à 3 mots max) pour indiquer la relation pure (ex: "dirige", "est ami avec", "aime", "travaille sur"). Ne mets jamais de longues phrases dans les liens !\n' +
      '4. Sois extrêmement exhaustif. Extrait un maximum de faits et d\'entités distinctes. Fusionne les nœuds s\'ils parlent de la même chose.\n\n' +
      'GRAPHE ACTUEL :\n' + existingMemory + '\n\n' +
      'CONVERSATION RÉCENTE :\n' + recentMsgs;

    var newMemoryText = null;

    /* Tentative 1 : Puter AI */
    if (window.puter && S.config && S.config.puterUsername) {
      try {
        var puterResp = await puter.ai.chat(extractPrompt, { model: 'gpt-4o-mini', response_format: { type: 'json_object' } });
        var puterContent = typeof puterResp === 'string' ? puterResp
          : (puterResp && puterResp.message && puterResp.message.content) || (puterResp && puterResp.content) || '';
        newMemoryText = puterContent.trim();
      } catch(e) { console.warn('[Mémoire] Puter extraction failed:', e); }
    }

    /* Tentative 2 : OpenAI si clé dispo */
    if (!newMemoryText && S.config && S.config.openaiApiKey) {
      try {
        var oaiResp = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + S.config.openaiApiKey },
          body: JSON.stringify({ 
            model: 'gpt-4o-mini', 
            messages: [{ role: 'user', content: extractPrompt }], 
            response_format: { type: 'json_object' },
            max_tokens: 800 
          })
        });
        if (oaiResp.ok) {
          var oaiData = await oaiResp.json();
          newMemoryText = (oaiData.choices && oaiData.choices[0] && oaiData.choices[0].message && oaiData.choices[0].message.content || '').trim();
        }
      } catch(e) { console.warn('[Mémoire] OpenAI extraction failed:', e); }
    }

    /* Tentative 3 : Provider actif — fallback universel */
    if (!newMemoryText && window.EVAChatHandler) {
      try {
        var origSys = window.EVA_SYSTEM_PROMPT;
        window.EVA_SYSTEM_PROMPT = 'Tu es un parseur JSON. Renvoie uniquement du JSON valide sans aucun formatage markdown.';
        var chatResp = await window.EVAChatHandler.sendMessage(extractPrompt, {});
        window.EVA_SYSTEM_PROMPT = origSys;
        if (chatResp && chatResp.success && chatResp.content) {
          newMemoryText = chatResp.content.trim();
        }
      } catch(e) { console.warn('[Mémoire] Provider actif extraction failed:', e); }
    }

    if (!newMemoryText) return;
    
    /* Nettoyage du markdown potentiel au cas où l'IA a quand même renvoyé ```json */
    newMemoryText = newMemoryText.replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim();
    var parsedMemory = JSON.parse(newMemoryText);
    
    if (!parsedMemory.nodes || !Array.isArray(parsedMemory.nodes) || !parsedMemory.links || !Array.isArray(parsedMemory.links)) {
      throw new Error("Structure JSON invalide");
    }

    /* Sauvegarder en Firebase */
    var memoryData = {
      nodes: parsedMemory.nodes,
      links: parsedMemory.links,
      lastUpdated: new Date().toISOString(),
      version: ((S.evaMemory && S.evaMemory.version) || 0) + 1
    };
    
    await db.collection('users').doc(S.user.uid).set({ evaMemory: memoryData }, { merge: true });
    S.evaMemory = memoryData;
    if (S.profile) S.profile.evaMemory = memoryData;
    console.log('[Mémoire Évolutive] Cerveau mis à jour — v' + memoryData.version, memoryData);
    
    // Si la page des paramètres est ouverte sur Cerveau, rafraîchir
    if (window.renderBrainMap && document.getElementById('brainCanvas')) {
      setTimeout(window.renderBrainMap, 100);
    }

  } catch(e) {
    console.warn('[Mémoire Évolutive] Erreur extraction (JSON attendu):', e);
  }
}
window.extractUserInsights = extractUserInsights;
