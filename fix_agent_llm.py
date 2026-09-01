import sys
sys.stdout.reconfigure(encoding='utf-8')

# ═══════════════════════════════════════════════════════
# FIX 2: pc-agent.js — status always 'done' even on error
# ═══════════════════════════════════════════════════════
with open(r'eva-pc/web/js/features/pc-agent.js', 'r', encoding='utf-8') as f:
    pa = f.read()

# Fix the status = 'done' bug after runAgenticLoop
OLD = """      resultData = await runAgenticLoop(prompt, cmdId, uid, cmdRef);
        status = 'done';"""
if OLD in pa:
    pa = pa.replace(OLD, """      resultData = await runAgenticLoop(prompt, cmdId, uid, cmdRef);
        status = (resultData && resultData.error) ? 'error' : 'done';""", 1)
    print('FIX 2a: agentic_task status fix applied')
else:
    # Try without indent variation
    idx = pa.find("runAgenticLoop(prompt, cmdId, uid, cmdRef);")
    if idx >= 0:
        end = pa.find("status = 'done';", idx)
        if end >= 0:
            pa = pa[:end] + "status = (resultData && resultData.error) ? 'error' : 'done';" + pa[end+len("status = 'done';"):]
            print('FIX 2a: agentic_task status fix applied (alt)')
        else:
            print('WARN FIX 2a: status done not found after runAgenticLoop')
    else:
        print('WARN FIX 2a: runAgenticLoop call not found')

# Also fix screenshot / sysinfo results
for t in ['screenshot', 'sysinfo', 'lock', 'sleep', 'shutdown']:
    old_t = f"}} else if (data.type === '{t}')"
    if old_t in pa:
        print(f'Found {t} case')

with open(r'eva-pc/web/js/features/pc-agent.js', 'w', encoding='utf-8') as f:
    f.write(pa)
print('pc-agent.js saved')

print()
# ═══════════════════════════════════════════════════════
# FIX 3: PC cloudworks.js — LLM auto-start, remove start/stop buttons
# ═══════════════════════════════════════════════════════
with open(r'eva-pc/web/js/features/cloudworks.js', 'r', encoding='utf-8') as f:
    pc = f.read()

# Fix LLM section: remove toggle and start/stop, keep only restart
OLD_LLM = """        <div class="cw-llm-toggle-row">
          <label class="cw-toggle-label">Démarrer le LLM avec CloudWorks</label>
          <label class="cw-switch">
            <input type="checkbox" id="cwLLMAutoStart" onchange="window._cwToggleLLMAutostart(this.checked)">
            <span class="cw-switch-slider"></span>
          </label>
        </div>
        <div class="cw-llm-actions">
          <button class="cw-btn cw-btn-primary" onclick="window._cwStartLLM()">▶ Démarrer</button>
          <button class="cw-btn cw-btn-secondary" onclick="window._cwStopLLM()">■ Arrêter</button>
          <button class="cw-btn cw-btn-warning" onclick="window._cwRestartLLM()">⟳ Redémarrer</button>
        </div>"""

NEW_LLM = """        <div class="cw-llm-actions">
          <button class="cw-btn cw-btn-warning" onclick="window._cwRestartLLM()">⟳ Redémarrage d'urgence</button>
        </div>"""

if OLD_LLM in pc:
    pc = pc.replace(OLD_LLM, NEW_LLM, 1)
    print('FIX 3a: LLM buttons simplified')
else:
    print('WARN FIX 3a: LLM buttons block not found')

# Also fix _initLLMPanel to auto-start LLM when CW opens
OLD_INIT = """async function _initLLMPanel() {
  // Récupérer l'état autostart depuis electron-store
  if (window.eva && window.eva.store) {
    try {
      var autostart = await window.eva.store.get('cwLLMAutoStart');
      var el = document.getElementById('cwLLMAutoStart');
      if (el) el.checked = !!autostart;
    } catch(e) {}
  }
  // Poll statut LLM toutes les 5s
  _updateLLMStatus();
  if (_llmPollInterval) clearInterval(_llmPollInterval);
  _llmPollInterval = setInterval(_updateLLMStatus, 5000);
}"""

NEW_INIT = """async function _initLLMPanel() {
  // CloudWorks est actif = LLM DOIT être actif sans exception
  _updateLLMStatus();
  if (_llmPollInterval) clearInterval(_llmPollInterval);
  _llmPollInterval = setInterval(_updateLLMStatus, 5000);
  // Démarrer le LLM automatiquement si pas déjà actif
  if (window.eva && window.eva.system && window.eva.system.llmStatus) {
    try {
      var res = await window.eva.system.llmStatus();
      if (!res || !res.running) {
        console.log('[CloudWorks] LLM inactif → démarrage automatique');
        window._cwStartLLM();
      }
    } catch(e) {
      window._cwStartLLM();
    }
  }
}"""

if OLD_INIT in pc:
    pc = pc.replace(OLD_INIT, NEW_INIT, 1)
    print('FIX 3b: _initLLMPanel auto-start applied')
else:
    print('WARN FIX 3b: _initLLMPanel pattern not found')

with open(r'eva-pc/web/js/features/cloudworks.js', 'w', encoding='utf-8') as f:
    f.write(pc)
print('PC cloudworks.js saved')
