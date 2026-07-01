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

    var extractPrompt = 'Tu es l\'ARCHIVISTE STRICT du Cerveau Neuronal de l\'IA EVA. Ton but est de modéliser TOUTE la vie et les connaissances de ' + nick + ' sous forme de graphe.\n' +
      'À partir de la conversation ci-dessous et du graphe actuel, renvoie UNIQUEMENT un objet JSON (sans markdown) représentant le graphe mis à jour.\n' +
      'RÈGLES ABSOLUES :\n' +
      '1. Structure exacte : {"_reflection": "1. Lister toutes les entités mentionnées (X, Y, Z). 2. Lister les relations...", "nodes": [{"id":"...", "label":"...", "type":"person|concept|project|preference", "details": "Description exhaustive..."}], "links": [{"source":"...", "target":"...", "label":"..."}]}\n' +
      '2. Le champ "_reflection" DOIT être rempli EN PREMIER. Oblige-toi à y lister de manière exhaustive toutes les entités (personnes, lieux, objets) présentes dans la conversation avant de construire la suite.\n' +
      '3. TU NE DOIS RIEN OUBLIER. Tu as interdiction de supprimer ou de simplifier des informations. Extrais CHAQUE NOUVEAU FAIT, CHAQUE NOUVELLE ENTITÉ en un nœud distinct.\n' +
      '4. N\'INVENTE JAMAIS RIEN. Base-toi STRICTEMENT sur ce qui a été dit dans la conversation. Aucune hallucination, aucune supposition.\n' +
      '5. Le champ "details" des nœuds DOIT être un texte long et complet (ex: "Lydie est la partenaire de l\'utilisateur, elle travaille dans une agence immobilière."). C\'est ici que tu stockes toute l\'histoire.\n' +
      '6. Le champ "label" des LIENS (links) doit être TRES COURT (1 à 3 mots max) pour indiquer la relation pure (ex: "dirige", "est ami avec", "habite à").\n' +
      '7. Tu dois absolument CONSERVER tout le graphe actuel. Ajoute simplement les nouveaux nœuds et liens, ou complète le champ "details" des nœuds existants si on t\'en dit plus sur eux.\n\n' +
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
