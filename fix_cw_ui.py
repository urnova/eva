import sys
sys.stdout.reconfigure(encoding='utf-8')

# ═══ FIX 1: chat.html — supprimer le guide "Connecter un appareil / Télécharger EVA Desktop" ═══
with open(r'eva-pc/web/chat.html', 'r', encoding='utf-8', errors='replace') as f:
    html = f.read()

OLD_GUIDE = """
          <!-- Guide de connexion -->
          <div class=\"cw-guide-v2\" style=\"margin-top:28px;\">"""
END_GUIDE = """
          </div>

        </div>
      </div>
    </div>

  </div>

  <!-- ══ EVA PANEL ══ -->"""

# Find start and end
gs = html.find('\n          <!-- Guide de connexion -->')
ge = html.find('\n          </div>\n\n        </div>\n      </div>\n    </div>\n\n  </div>\n\n  <!-- ══ EVA PANEL ══ -->')

if gs >= 0 and ge >= 0:
    html = html[:gs] + '\n' + html[ge:]
    print(f'FIX 1: Guide de connexion supprimé (chars {gs}-{ge})')
else:
    print(f'WARN FIX 1: guide not found gs={gs} ge={ge}')

with open(r'eva-pc/web/chat.html', 'w', encoding='utf-8') as f:
    f.write(html)
print('chat.html saved')


# ═══ FIX 2: cloudworks.js — activité max 5, vue détaillée tâche IA ═══
with open(r'eva-pc/web/js/features/cloudworks.js', 'r', encoding='utf-8', errors='replace') as f:
    cw = f.read()

# 2a: MAX_LOG = 5 (was 20)
cw = cw.replace('var MAX_LOG = 20;', 'var MAX_LOG = 5;', 1)
print('FIX 2a: MAX_LOG = 5')

# 2b: _loadActivity limit to 5
cw = cw.replace('.limit(MAX_LOG)', '.limit(5)', 1)
print('FIX 2b: activity query limit = 5')

# 2c: _addActivity — garder seulement 5 entrées max
OLD_ADD = """function _addActivity(text, status) {
  var el = document.getElementById('cwActivityList');
  if (!el) return;
  var icon = status === 'done' ? '✓' : status === 'error' ? '✗' : '·';
  var entry = document.createElement('div');
  entry.className = 'cw-activity-item ' + (status || '');
  entry.innerHTML = `<span class="cw-act-icon">${icon}</span><span class="cw-act-label">${esc(text)}</span><span class="cw-act-time">${new Date().toLocaleString('fr-FR')}</span>`;
  el.prepend(entry);
}"""

NEW_ADD = """function _addActivity(text, status) {
  var el = document.getElementById('cwActivityList');
  if (!el) return;
  var icon = status === 'done' ? '✓' : status === 'error' ? '✗' : '·';
  var entry = document.createElement('div');
  entry.className = 'cw-activity-item ' + (status || '');
  entry.innerHTML = `<span class="cw-act-icon">${icon}</span><span class="cw-act-label">${esc(text)}</span><span class="cw-act-time">${new Date().toLocaleString('fr-FR')}</span>`;
  el.prepend(entry);
  // Garder seulement les 5 dernières entrées
  while (el.children.length > 5) el.removeChild(el.lastChild);
}"""

if OLD_ADD in cw:
    cw = cw.replace(OLD_ADD, NEW_ADD, 1)
    print('FIX 2c: _addActivity capped to 5')
else:
    print('WARN FIX 2c: _addActivity pattern not found')

# 2d: Vue détaillée des étapes dans _cwRunAgenticTask (liste déroulante des steps)
OLD_TASK_STATUS = """  statusEl.style.display = 'block';
  statusEl.textContent = '⟳ Envoi au LLM local...';
  statusEl.className = 'cw-agentic-status running';

  try {
    var cmdId = await window.pcAgent.sendCommand('agentic_task', { prompt }, window.S.user.uid);
    statusEl.textContent = '⟳ LLM en cours de traitement...';

    // Écouter les étapes en temps réel
    var stepUnsub = window.db.collection('cloudworks').doc(window.S.user.uid)
      .collection('commands').doc(cmdId)
      .onSnapshot(function(doc) {
        var d = doc.data();
        if (!d) return;
        if (d.step) statusEl.textContent = '⟳ ' + d.step;
        if (d.status === 'done') {
          stepUnsub();
          statusEl.textContent = '✓ ' + (d.result?.output || 'Tâche terminée');
          statusEl.className = 'cw-agentic-status done';
          promptEl.value = '';
          _updateLLMStatus();
        } else if (d.status === 'error') {
          stepUnsub();
          statusEl.textContent = '✗ Erreur: ' + (d.result?.error || 'Inconnue');
          statusEl.className = 'cw-agentic-status error';
        }
      });
  } catch(e) {
    statusEl.textContent = '✗ Erreur: ' + e.message;
    statusEl.className = 'cw-agentic-status error';
  }"""

NEW_TASK_STATUS = """  statusEl.style.display = 'block';
  statusEl.innerHTML = '<div class="cw-task-header">⟳ Envoi au LLM local...</div><div class="cw-task-steps" id="cwTaskSteps"></div>';
  statusEl.className = 'cw-agentic-status running';
  var stepsEl = document.getElementById('cwTaskSteps');

  function _appendStep(text, cls) {
    if (!stepsEl) return;
    var d = document.createElement('div');
    d.className = 'cw-task-step ' + (cls || '');
    d.textContent = text;
    stepsEl.appendChild(d);
    stepsEl.scrollTop = stepsEl.scrollHeight;
    // Max 20 steps visible
    while (stepsEl.children.length > 20) stepsEl.removeChild(stepsEl.firstChild);
  }

  try {
    var cmdId = await window.pcAgent.sendCommand('agentic_task', { prompt }, window.S.user.uid);
    _appendStep('⟳ LLM en cours de traitement...', 'pending');

    var _seenSteps = new Set();
    var stepUnsub = window.db.collection('cloudworks').doc(window.S.user.uid)
      .collection('commands').doc(cmdId)
      .onSnapshot(function(doc) {
        var d = doc.data();
        if (!d) return;

        // Afficher le step courant s'il est nouveau
        if (d.step && !_seenSteps.has(d.step)) {
          _seenSteps.add(d.step);
          var hdr = statusEl.querySelector('.cw-task-header');
          if (hdr) hdr.textContent = '⟳ ' + d.step;
          _appendStep(d.step, 'running');
        }

        // Afficher chaque étape de l'historique (steps[])
        if (d.steps && Array.isArray(d.steps)) {
          d.steps.forEach(function(s) {
            var key = s.ts + '|' + s.text;
            if (!_seenSteps.has(key)) {
              _seenSteps.add(key);
              _appendStep(s.text, s.text.startsWith('✓') ? 'done' : s.text.startsWith('✗') ? 'error' : 'running');
            }
          });
        }

        if (d.status === 'done') {
          stepUnsub();
          var out = (d.result && d.result.output) ? d.result.output : 'Tâche terminée';
          _appendStep('✓ ' + out.substring(0, 120), 'done');
          var hdr2 = statusEl.querySelector('.cw-task-header');
          if (hdr2) hdr2.textContent = '✓ Terminé';
          statusEl.className = 'cw-agentic-status done';
          promptEl.value = '';
          _addActivity('Tâche IA: ' + prompt.substring(0, 50), 'done');
        } else if (d.status === 'error') {
          stepUnsub();
          var err = (d.result && d.result.error) ? d.result.error : 'Inconnue';
          _appendStep('✗ Erreur: ' + err.substring(0, 120), 'error');
          var hdr3 = statusEl.querySelector('.cw-task-header');
          if (hdr3) hdr3.textContent = '✗ Erreur';
          statusEl.className = 'cw-agentic-status error';
          _addActivity('Tâche IA erreur: ' + err.substring(0, 40), 'error');
        }
      });
  } catch(e) {
    statusEl.innerHTML = '<div class="cw-task-header">✗ ' + esc(e.message) + '</div>';
    statusEl.className = 'cw-agentic-status error';
  }"""

if OLD_TASK_STATUS in cw:
    cw = cw.replace(OLD_TASK_STATUS, NEW_TASK_STATUS, 1)
    print('FIX 2d: Detailed step view for agentic task')
else:
    print('WARN FIX 2d: agentic task status pattern not found')

# 2e: Ajouter les styles pour les steps détaillés
OLD_STYLE_END = "    .cw-empty { padding:20px; text-align:center; color:#88889a; font-size:0.78em; }"
NEW_STYLE_END = """    .cw-empty { padding:20px; text-align:center; color:#88889a; font-size:0.78em; }
    .cw-task-header { font-weight:700; margin-bottom:6px; }
    .cw-task-steps { max-height:180px; overflow-y:auto; border-top:1px solid rgba(0,212,255,0.1); margin-top:6px; padding-top:6px; }
    .cw-task-step { padding:3px 0; font-size:0.9em; border-bottom:1px solid rgba(255,255,255,0.04); }
    .cw-task-step.done { color:#00ff88; }
    .cw-task-step.error { color:#ff4d6d; }
    .cw-task-step.running { color:#ffc800; }
    .cw-task-step.pending { color:#88889a; }"""

if OLD_STYLE_END in cw:
    cw = cw.replace(OLD_STYLE_END, NEW_STYLE_END, 1)
    print('FIX 2e: Step view styles added')
else:
    print('WARN FIX 2e: style end not found')

with open(r'eva-pc/web/js/features/cloudworks.js', 'w', encoding='utf-8') as f:
    f.write(cw)
print('cloudworks.js saved')
