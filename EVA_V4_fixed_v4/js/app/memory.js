/* ═══════════════════════════════════════════════════
   MÉMOIRE ÉVOLUTIVE — Extraction & Sauvegarde
═══════════════════════════════════════════════════ */
async function extractUserInsights(lastUserMsg, lastEvaMsg) {
  if (!S.user || !S.adaptationEnabled) return;
  if (window.setEvaStatusHeader) window.setEvaStatusHeader('🧠 MISE À JOUR CERVEAU...', 'thinking');
  try {
    /* Construire l'extrait de conversation (6 derniers messages) */
    var recentMsgs = (S.messages || []).slice(-6).map(function(m) {
      return (m.role === 'eva' || m.role === 'assistant' ? 'EVA' : 'Utilisateur') + ' : ' + (m.content || '').slice(0, 2000);
    }).join('\n');
    /* Fallback si S.messages est vide (ex: 1er message d'une nouvelle conversation) */
    if (!recentMsgs && (lastUserMsg || lastEvaMsg)) {
      recentMsgs = 'Utilisateur : ' + (lastUserMsg || '').slice(0, 2000) + '\nEVA : ' + (lastEvaMsg || '').slice(0, 2000);
    }
    if (!recentMsgs) {
      if (window.setEvaStatusHeader) window.setEvaStatusHeader(null);
      return;
    }

    var existingMemory = S.evaMemory && S.evaMemory.nodes ? JSON.stringify({nodes: S.evaMemory.nodes, links: S.evaMemory.links}) : '{"nodes":[],"links":[]}';
    var nick = (S.profile && (S.profile.nickname || S.profile.displayName)) || 'l\'utilisateur';

    var extractPrompt = 'Tu es l\'ARCHIVISTE STRICT du Cerveau Neuronal de l\'IA EVA. Ton but est de modéliser la vie de ' + nick + ' sous forme de graphe.\n' +
      'À partir de la conversation ci-dessous et du graphe actuel, renvoie UNIQUEMENT un JSON représentant les **MODIFICATIONS** (Patch) à apporter au graphe.\n' +
      'RÈGLES ABSOLUES :\n' +
      '1. Structure exacte : {"_etape1_analyse": "Liste les nouveaux faits", "_etape2_actions": "Explication des ajouts/modifs", "add_nodes": [{"id":"...", "label":"...", "type":"person|concept|project|preference", "details": "Description exhaustive..."}], "update_nodes": [{"id":"...", "label":"Nouveau nom optionnel", "details":"Nouveau texte qui remplace l\'ancien"}], "remove_nodes": ["id_du_noeud_a_supprimer"], "add_links": [{"source":"...", "target":"...", "label":"..."}]}\n' +
      '  - _etape1_analyse : Copie TOUTES les entités et faits de la conversation récente (Utilisateur ET Eva). (PÉNALITÉ EXTRÊME SI TU RESSUMES OU OUBLIES UNE INFO).\n' +
      '  - _etape2_actions : Explication des ajouts/modifs/suppressions.\n' +
      '3. NE RENVOIE JAMAIS LE GRAPHE ENTIER. Renvoie uniquement ce qui change :\n' +
      '   - "add_nodes" : pour les entités totalement nouvelles.\n' +
      '   - "update_nodes" : pour modifier le champ "details" ou renommer ("label") d\'une entité existante (utilise son "id" exact).\n' +
      '   - "remove_nodes" : pour SUPPRIMER DÉFINITIVEMENT un nœud (ex: si l\'utilisateur demande de l\'oublier ou de le fusionner et détruire l\'ancien). Mets juste les IDs dans un tableau.\n' +
      '   - "add_links" : pour lier de nouvelles choses. RÈGLE CRUCIALE : Le "label" d\'un lien DOIT FAIRE ENTRE 1 ET 3 MOTS MAXIMUM (ex: "aime", "travaille pour", "déteste"). Les explications longues vont dans "details" du nœud.\n' +
      '4. DÉDUPLICATION OBLIGATOIRE : Avant de créer dans "add_nodes", vérifie si ça n\'existe pas déjà. Si oui, utilise "update_nodes".\n' +
      '5. SUPPRESSION : Si tu dois regrouper deux nœuds, copie les infos du mauvais dans le bon via "update_nodes", puis mets l\'ID du mauvais dans "remove_nodes".\n' +
      '6. NŒUD CENTRAL OBLIGATOIRE : L\'entité centrale de l\'utilisateur a TOUJOURS l\'id "utilisateur". Tu ne dois JAMAIS créer un nouveau nœud avec son prénom pour le représenter lui-même.\n' +
      '7. RAMIFICATIONS COMPLEXES (TRÈS IMPORTANT) : Ne force pas tous les liens vers "utilisateur". Si l\'utilisateur dit "Ma mère habite à Paris", tu DOIS créer un lien [mère] -> habite à -> [Paris], ET un lien [utilisateur] -> a pour mère -> [mère]. Il est crucial de créer un vrai réseau connecté (graphe), et pas juste une étoile centrée sur l\'utilisateur.\n' +
      '8. TEMPORALITÉ ET HISTORIQUE : Si une information change ou évolue (ex: déménagement, rupture, changement de goût), NE SUPPRIME PAS l\'ancienne information. Garde l\'historique ! Utilise "update_nodes" pour ajouter la nouvelle info tout en mentionnant l\'ancienne dans le champ "details", ou modifie les "add_links" avec des labels au passé (ex: "habitait à", "ex-copine").\n\n' +
      'GRAPHE ACTUEL :\n' + existingMemory + '\n\n' +
      'CONVERSATION RÉCENTE :\n' + recentMsgs;

    var newMemoryText = null;
    var usedProvider = 'Aucun';

    /* Tentative 1 : Puter AI */
    if (window.puter && S.config && S.config.puterUsername) {
      try {
        var puterResp = await puter.ai.chat(extractPrompt, { model: 'gpt-4o-mini', response_format: { type: 'json_object' }, max_tokens: 4000 });
        var puterContent = typeof puterResp === 'string' ? puterResp
          : (puterResp && puterResp.message && puterResp.message.content) || (puterResp && puterResp.content) || '';
        newMemoryText = puterContent.trim();
        usedProvider = 'Puter';
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
            response_format: { type: 'json_object' }
          })
        });
        if (oaiResp.ok) {
          var oaiData = await oaiResp.json();
          newMemoryText = (oaiData.choices && oaiData.choices[0] && oaiData.choices[0].message && oaiData.choices[0].message.content || '').trim();
          usedProvider = 'OpenAI';
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
          usedProvider = 'Fallback (' + (S.config.aiProvider || 'inconnu') + ')';
        }
      } catch(e) { console.warn('[Mémoire] Provider actif extraction failed:', e); }
    }

    if (!newMemoryText) {
      console.warn('[Mémoire Évolutive] Échec total de tous les providers.');
      if (window.setEvaStatusHeader) window.setEvaStatusHeader(null);
      return;
    }
    console.log('[Mémoire Évolutive] Provider ayant généré le JSON :', usedProvider);
    console.log('[Mémoire Évolutive] JSON Brut reçu :\n', newMemoryText);
    
    /* Extraction robuste : on cherche le premier { et le dernier } */
    var jsonMatch = newMemoryText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      newMemoryText = jsonMatch[0];
    } else {
      if (window.setEvaStatusHeader) window.setEvaStatusHeader(null);
      throw new Error("Aucun objet JSON trouvé dans la réponse");
    }
    
    var parsedMemory = JSON.parse(newMemoryText);
    
    var patch = JSON.parse(newMemoryText);
    
    var currentMem = S.evaMemory || { nodes: [], links: [] };
    if (!currentMem.nodes) currentMem.nodes = [];
    if (!currentMem.links) currentMem.links = [];
    
    var updated = false;

    // 1. Ajouter les nouveaux noeuds
    if (patch.add_nodes && Array.isArray(patch.add_nodes)) {
      patch.add_nodes.forEach(function(n) {
        if (n && n.id && !currentMem.nodes.find(function(ex){ return ex.id === n.id; })) {
          currentMem.nodes.push(n);
          updated = true;
        }
      });
    }

    // 2. Mettre à jour les noeuds existants
    if (patch.update_nodes && Array.isArray(patch.update_nodes)) {
      patch.update_nodes.forEach(function(un) {
        if (un && un.id) {
          var target = currentMem.nodes.find(function(ex){ return ex.id === un.id; });
          if (target) {
            if (un.details) target.details = un.details;
            if (un.label) target.label = un.label;
            updated = true;
          }
        }
      });
    }

    // 2.5 Supprimer les noeuds (et leurs liens orphelins)
    if (patch.remove_nodes && Array.isArray(patch.remove_nodes)) {
      patch.remove_nodes.forEach(function(delId) {
        if (delId && typeof delId === 'string') {
          var initialLen = currentMem.nodes.length;
          currentMem.nodes = currentMem.nodes.filter(function(ex){ return ex.id !== delId; });
          if (currentMem.nodes.length < initialLen) {
            // Le nœud a été supprimé, on nettoie les liens
            currentMem.links = currentMem.links.filter(function(l){
              return l.source !== delId && l.target !== delId;
            });
            updated = true;
          }
        }
      });
    }

    // 3. Ajouter ou fusionner les liens
    if (patch.add_links && Array.isArray(patch.add_links)) {
      patch.add_links.forEach(function(l) {
        if (l && l.source && l.target) {
          // Chercher si un lien existe déjà entre ces deux nœuds (peu importe le sens)
          var exists = currentMem.links.find(function(ex){ 
            return (ex.source === l.source && ex.target === l.target) || 
                   (ex.source === l.target && ex.target === l.source); 
          });
          
          if (exists) {
            // Si le lien existe, on vérifie si le label est différent pour le concaténer
            if (exists.label !== l.label && !exists.label.includes(l.label)) {
              exists.label = exists.label + " | " + l.label;
              // Limiter la taille du label si ça devient trop grand
              var parts = exists.label.split(" | ");
              if (parts.length > 3) parts.shift(); // garder les 3 derniers contextes max
              exists.label = parts.join(" | ");
              updated = true;
            }
          } else {
            currentMem.links.push(l);
            updated = true;
          }
        }
      });
    }

    if (!updated) {
      console.log('[Mémoire Évolutive] Aucun changement détecté.');
      if (window.setEvaStatusHeader) window.setEvaStatusHeader(null);
      return;
    }

    /* Sauvegarder en Firebase */
    var memoryData = {
      nodes: currentMem.nodes,
      links: currentMem.links,
      lastUpdated: new Date().toISOString(),
      version: ((S.evaMemory && S.evaMemory.version) || 0) + 1
    };
    
    await db.collection('users').doc(S.user.uid).set({ evaMemory: memoryData }, { merge: true });
    S.evaMemory = memoryData;
    if (S.profile) S.profile.evaMemory = memoryData;
    console.log('[Mémoire Évolutive] Cerveau mis à jour — v' + memoryData.version + ' (par ' + usedProvider + ')', memoryData);
    
    if (window.setEvaStatusHeader) {
      window.setEvaStatusHeader('🧠 CERVEAU MIS À JOUR', 'action');
      setTimeout(function(){ window.setEvaStatusHeader(null); }, 3000);
    }
    
    /* Injecter l'étape dans la boîte de réflexion du dernier message */
    try {
      var chatList = document.getElementById('chatList');
      if (chatList) {
        var evaMsgs = chatList.querySelectorAll('.msg.eva .msg-thought-wrap');
        if (evaMsgs.length > 0) {
          var lastThoughtWrap = evaMsgs[evaMsgs.length - 1];
          var listEl = lastThoughtWrap.querySelector('.msg-thought-list');
          var hdrArrow = lastThoughtWrap.querySelector('.msg-thought-hdr span:last-child');
          if (listEl) {
            var stepIdx = listEl.children.length + 1;
            var newStep = document.createElement('div');
            newStep.className = 'msg-thought-item';
            
            var addC = patch.add_nodes ? patch.add_nodes.length : 0;
            var upC = patch.update_nodes ? patch.update_nodes.length : 0;
            var rmC = patch.remove_nodes ? patch.remove_nodes.length : 0;
            var lnkC = patch.add_links ? patch.add_links.length : 0;
            
            newStep.innerHTML = '<span style="color:rgba(123,139,245,0.4);min-width:14px;">' + stepIdx + '.</span>' +
                                '<div><span style="color:rgba(200,205,230,0.6);">Mémoire (Arrière-plan)</span>' +
                                '<span style="margin-left:5px;opacity:0.5;">Cerveau mis à jour : ' + addC + ' ajout(s), ' + upC + ' modif(s), ' + rmC + ' suppr(s), ' + lnkC + ' lien(s)</span></div>';
            listEl.appendChild(newStep);
            if (hdrArrow) {
               var open = lastThoughtWrap.classList.contains('open');
               hdrArrow.textContent = stepIdx + ' étape(s) ' + (open ? '▲' : '▼');
            }
          }
        }
      }
    } catch(e) { console.warn('Erreur injection réflexion:', e); }
    
    // Si la page des paramètres est ouverte sur Cerveau, rafraîchir
    if (window.renderBrainMap && document.getElementById('brainCanvas')) {
      setTimeout(window.renderBrainMap, 100);
    }

  } catch(e) {
    console.warn('[Mémoire Évolutive] Erreur extraction (JSON attendu):', e);
    if (window.setEvaStatusHeader) window.setEvaStatusHeader(null);
  }
}
window.extractUserInsights = extractUserInsights;
