/* =================================================================
   CW-ENGINE.JS — Moteur CloudWorks v5.6
   10 états de tâche, validation stricte, catalogue fixe PowerShell.
   Inspiré du moteur GPT-6.2-SOL, adapté à l'architecture EVA.

   États : queued | running | executing | waiting_user |
           succeeded | partial | failed | cancelled | expired | indeterminate
   ================================================================= */
(function() {
'use strict';

/* ───────────────────────────────────────────
   CONSTANTES
─────────────────────────────────────────── */
var CW_STATES = {
  QUEUED:        'queued',
  RUNNING:       'running',
  EXECUTING:     'executing',
  WAITING_USER:  'waiting_user',
  SUCCEEDED:     'succeeded',
  PARTIAL:       'partial',
  FAILED:        'failed',
  CANCELLED:     'cancelled',
  EXPIRED:       'expired',
  INDETERMINATE: 'indeterminate'
};

var TASK_TIMEOUT_MS  = 5 * 60 * 1000;  // 5 min → expired
var EXEC_TIMEOUT_MS  = 30 * 1000;       // 30s par outil → indeterminate si pas de réponse
var APPROVAL_TIMEOUT = 45 * 1000;       // 45s pour approuver

/* ───────────────────────────────────────────
   CATALOGUE D'OUTILS VALIDÉS (fixe — pas d'interpolation LLM)
   Chaque entrée : { desc, params[], sensitive }
─────────────────────────────────────────── */
var TOOL_CATALOG = {
  app_resolve:       { desc: 'Cherche une application installée sur Windows', params: ['query'], sensitive: false },
  app_launch:        { desc: 'Lance une application ou ouvre une URL', params: ['target'], sensitive: false },
  file_list:         { desc: 'Liste le contenu d\'un dossier', params: ['path'], sensitive: false },
  file_read:         { desc: 'Lit un fichier texte', params: ['path'], sensitive: false },
  file_search:       { desc: 'Recherche des fichiers par nom', params: ['query'], sensitive: false },
  file_create:       { desc: 'Crée ou modifie un fichier texte', params: ['path', 'content'], sensitive: true },
  folder_create:     { desc: 'Crée un dossier', params: ['path'], sensitive: true },
  folder_organize:   { desc: 'Organise un dossier par date ou extension', params: ['sourcePath', 'groupBy'], sensitive: true },
  pdf_create:        { desc: 'Crée un PDF', params: ['path', 'title', 'content'], sensitive: true },
  excel_create:      { desc: 'Crée un fichier Excel', params: ['path', 'sheetName', 'headers', 'rows'], sensitive: true },
  document_create:   { desc: 'Crée un document formaté', params: ['format', 'filename', 'content', 'destination'], sensitive: true },
  web_search:        { desc: 'Recherche sur Internet', params: ['query'], sensitive: false },
  web_fetch:         { desc: 'Récupère le contenu d\'une page web', params: ['url'], sensitive: false },
  system_status:     { desc: 'Infos CPU, RAM, système', params: [], sensitive: false },
  screenshot_take:   { desc: 'Capture d\'écran', params: [], sensitive: false },
  process_verify:    { desc: 'Vérifie qu\'un fichier/dossier/processus existe', params: ['type', 'target'], sensitive: false },
  get_running_apps:  { desc: 'Liste les applications en cours', params: [], sensitive: false },
  get_clipboard:     { desc: 'Lit le presse-papiers', params: [], sensitive: false },
  type_text:         { desc: 'Tape du texte dans l\'application active', params: ['text'], sensitive: true },
  kill_process:      { desc: 'Termine un processus', params: ['name'], sensitive: true }
};

/* ───────────────────────────────────────────
   GÉNÉRATEUR D'ID DE TÂCHE
─────────────────────────────────────────── */
function _genTaskId() {
  return 'cw_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
}

/* ───────────────────────────────────────────
   HASH DE PLAN (lie l'approbation à un plan précis)
─────────────────────────────────────────── */
function _hashPlan(plan) {
  var str = JSON.stringify(plan);
  var hash = 0;
  for (var i = 0; i < str.length; i++) {
    var c = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + c;
    hash = hash & hash;
  }
  return 'ph_' + Math.abs(hash).toString(16);
}

/* ───────────────────────────────────────────
   VALIDATION D'OUTIL
─────────────────────────────────────────── */
function validateTool(name, args) {
  var tool = TOOL_CATALOG[name];
  if (!tool) {
    return { valid: false, error: 'Outil "' + name + '" non reconnu dans le catalogue.' };
  }
  for (var i = 0; i < tool.params.length; i++) {
    var p = tool.params[i];
    if (args[p] === undefined || args[p] === null || args[p] === '') {
      return { valid: false, error: 'Paramètre requis manquant : "' + p + '" pour l\'outil "' + name + '".' };
    }
  }
  // Sécurité : interdire les chemins hors-limites
  if (args.path) {
    var safePath = String(args.path);
    var forbidden = ['C:\\Windows\\System32', 'C:\\Windows\\SysWOW64', 'C:\\Program Files\\EVA'];
    for (var j = 0; j < forbidden.length; j++) {
      if (safePath.toLowerCase().startsWith(forbidden[j].toLowerCase())) {
        return { valid: false, error: 'Chemin interdit : ' + safePath };
      }
    }
  }
  return { valid: true };
}

/* ───────────────────────────────────────────
   CLASSE TÂCHE
─────────────────────────────────────────── */
function CWTask(opts) {
  this.id          = opts.id || _genTaskId();
  this.prompt      = opts.prompt || '';
  this.uid         = opts.uid || '';
  this.deviceId    = opts.deviceId || 'web';
  this.state       = CW_STATES.QUEUED;
  this.plan        = null;
  this.planHash    = null;
  this.steps       = [];        // { tool, args, state, result, ts }
  this.thoughts    = [];        // string[]
  this.createdAt   = Date.now();
  this.updatedAt   = Date.now();
  this.approvedAt  = null;
  this.completedAt = null;
  this._timer      = null;
  this._listeners  = [];
}

CWTask.prototype.setState = function(newState, meta) {
  this.state     = newState;
  this.updatedAt = Date.now();
  if (newState === CW_STATES.SUCCEEDED || newState === CW_STATES.FAILED ||
      newState === CW_STATES.CANCELLED || newState === CW_STATES.EXPIRED ||
      newState === CW_STATES.PARTIAL) {
    this.completedAt = Date.now();
    this._clearTimer();
  }
  this._emit('stateChange', { state: newState, meta: meta });
};

CWTask.prototype.addThought = function(thought) {
  this.thoughts.push({ text: thought, ts: Date.now() });
  this._emit('thought', thought);
};

CWTask.prototype.addStep = function(step) {
  this.steps.push(step);
  this._emit('step', step);
};

CWTask.prototype.on = function(event, fn) {
  this._listeners.push({ event: event, fn: fn });
};

CWTask.prototype._emit = function(event, data) {
  for (var i = 0; i < this._listeners.length; i++) {
    if (this._listeners[i].event === event) {
      try { this._listeners[i].fn(data); } catch(e) {}
    }
  }
};

CWTask.prototype._clearTimer = function() {
  if (this._timer) { clearTimeout(this._timer); this._timer = null; }
};

CWTask.prototype.toFirestore = function() {
  return {
    id:          this.id,
    prompt:      this.prompt,
    uid:         this.uid,
    deviceId:    this.deviceId,
    state:       this.state,
    plan:        this.plan,
    plan_hash:   this.planHash,
    steps:       this.steps,
    thoughts:    this.thoughts.map(function(t) { return t.text; }),
    created_at:  this.createdAt,
    updated_at:  this.updatedAt,
    approved_at: this.approvedAt,
    completed_at:this.completedAt
  };
};

/* ───────────────────────────────────────────
   MOTEUR PRINCIPAL
─────────────────────────────────────────── */
var CWEngine = {

  _tasks: {},

  /* Crée et enregistre une tâche */
  createTask: function(opts) {
    var task = new CWTask(opts);
    this._tasks[task.id] = task;

    // Timer global : expired si pas terminé dans TASK_TIMEOUT_MS
    task._timer = setTimeout(function() {
      if (task.state === CW_STATES.QUEUED ||
          task.state === CW_STATES.RUNNING ||
          task.state === CW_STATES.EXECUTING ||
          task.state === CW_STATES.WAITING_USER) {
        task.setState(CW_STATES.EXPIRED, { reason: 'Timeout global dépassé (' + (TASK_TIMEOUT_MS / 60000) + ' min)' });
      }
    }, TASK_TIMEOUT_MS);

    return task;
  },

  /* Récupère une tâche existante */
  getTask: function(id) {
    return this._tasks[id] || null;
  },

  /* Annule une tâche */
  cancelTask: function(id) {
    var task = this._tasks[id];
    if (!task) return false;
    if (task.state === CW_STATES.QUEUED ||
        task.state === CW_STATES.RUNNING ||
        task.state === CW_STATES.EXECUTING ||
        task.state === CW_STATES.WAITING_USER) {
      task.setState(CW_STATES.CANCELLED, { cancelledAt: Date.now() });
      return true;
    }
    return false;
  },

  /* Valide un outil et retourne le résultat de validation */
  validateTool: validateTool,

  /* Accesseurs */
  STATES:  CW_STATES,
  CATALOG: TOOL_CATALOG,
  APPROVAL_TIMEOUT: APPROVAL_TIMEOUT,
  EXEC_TIMEOUT_MS:  EXEC_TIMEOUT_MS,
  hashPlan: _hashPlan
};

/* ───────────────────────────────────────────
   EXPORT GLOBAL
─────────────────────────────────────────── */
window.CWEngine = CWEngine;
window.CW_STATES = CW_STATES;

})();
