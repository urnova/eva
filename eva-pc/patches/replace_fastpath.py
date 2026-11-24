# -*- coding: utf-8 -*-
path = r'f:\code\eva\evaprojectmultiplatforme\eva-pc\web\js\features\pc-agent.js'

with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

start_marker = "    // ── 0.1 INTERCEPTION D'INTENTION INTELLIGENTE (App, Web, Install, Close) ──"
end_marker = "    const systemPrompt = `Tu es l'Agent PC Windows d'EVA. RÈGLES ABSOLUES :"

replacement = """    // ── 0.1 EXÉCUTION RÉELLE PAR LE LLM LOCAL (CWAgent ReAct) ──
    // FIX v5.6.21: Suppression du faux script regex automatique.
    // Toute tâche CloudWorks passe AUTHENTIQUEMENT par le LLM local (node-llama-cpp).
    if (window.CWAgent && !directCommand) {
      console.log('[PC Agent] Délégation de la tâche au LLM local (CWAgent)...');
      var agent = new window.CWAgent(uid, cmdId, {
        approvalMode: false,
        autonomousMode: true
      });
      var agentRes = await agent.run(userPrompt, async function(text, status, isThought) {
        if (!isThought) {
          steps.push({ text: text, ts: new Date().toISOString() });
          await cmdRef.update({ step: text, steps: steps, updatedAt: new Date() }).catch(function(){});
          window.dispatchEvent(new CustomEvent('cw:step', { detail: { step: text } }));
        }
      });
      if (agentRes && agentRes.success) {
        var finalMsg = agentRes.response || 'Tâche terminée avec succès par le LLM local ✓';
        await cmdRef.update({ status: 'done', step: finalMsg, steps: steps, updatedAt: new Date() }).catch(function(){});
        return { output: finalMsg, steps: steps };
      } else if (agentRes && agentRes.error) {
        return { error: agentRes.error, steps: steps };
      }
    }

    """

if start_marker in content and end_marker in content:
    idx1 = content.index(start_marker)
    idx2 = content.index(end_marker)
    new_content = content[:idx1] + replacement + content[idx2:]
    with open(path, 'w', encoding='utf-8') as f:
        f.write(new_content)
    print("pc-agent.js patched successfully! Removed fast-path regex.")
else:
    print("Markers not found:", start_marker in content, end_marker in content)
