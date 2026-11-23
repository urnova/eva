/* =================================================================
   CW-WINDOWS-ADAPTER.JS — Interface PC Windows v5.6
   Communication avec Electron via window.electronAPI (preload.js)
   Version WEB : toutes les actions sont stubées (ne font rien de destructif)
   Version PC  : remplacée par eva-pc/web/js/features/cw-windows-adapter.js
   ================================================================= */
(function() {
'use strict';

var EXEC_TIMEOUT = 30000; // 30s par appel IPC

/* ───────────────────────────────────────────
   DÉTECTION D'ENVIRONNEMENT
─────────────────────────────────────────── */
var IS_ELECTRON = !!(window.electronAPI || (window.process && window.process.versions && window.process.versions.electron));

/* ───────────────────────────────────────────
   WRAPPER IPC AVEC TIMEOUT
─────────────────────────────────────────── */
function _ipc(channel, payload) {
  if (!IS_ELECTRON || !window.electronAPI) {
    // Mode Web : retourner un résultat factice honnête
    return Promise.resolve({
      success: false,
      error: 'Cette action n\'est disponible que dans l\'application EVA PC.',
      web_only: true
    });
  }
  return new Promise(function(resolve) {
    var done = false;
    var timer = setTimeout(function() {
      if (!done) {
        done = true;
        resolve({
          success: false,
          error: 'Timeout : aucune réponse du PC en ' + (EXEC_TIMEOUT / 1000) + 's. Statut indéterminé.',
          indeterminate: true
        });
      }
    }, EXEC_TIMEOUT);

    window.electronAPI.invoke(channel, payload)
      .then(function(result) {
        if (!done) {
          done = true;
          clearTimeout(timer);
          resolve(result || { success: true });
        }
      })
      .catch(function(e) {
        if (!done) {
          done = true;
          clearTimeout(timer);
          resolve({ success: false, error: String(e) });
        }
      });
  });
}

/* ───────────────────────────────────────────
   ACTIONS — catalogue fixe
─────────────────────────────────────────── */
var Actions = {

  app_resolve: function(args) {
    return _ipc('cw:app_resolve', { query: String(args.query || '').substring(0, 100) });
  },

  app_launch: function(args) {
    var target = String(args.target || '');
    // Sécurité : si l'URL commence par http on l'ouvre dans le navigateur
    if (target.startsWith('http://') || target.startsWith('https://')) {
      return _ipc('cw:open_url', { url: target });
    }
    return _ipc('cw:app_launch', { target: target, args: args.args || '' });
  },

  file_list: function(args) {
    return _ipc('cw:file_list', { path: String(args.path || ''), depth: args.depth || 1 });
  },

  file_read: function(args) {
    return _ipc('cw:file_read', { path: String(args.path || ''), maxBytes: 50000 });
  },

  file_search: function(args) {
    return _ipc('cw:file_search', {
      query:   String(args.query || ''),
      path:    args.path || null,
      maxResults: 30
    });
  },

  file_create: function(args) {
    return _ipc('cw:file_create', {
      path:    String(args.path || ''),
      content: String(args.content || ''),
      append:  !!args.append
    });
  },

  folder_create: function(args) {
    return _ipc('cw:folder_create', { path: String(args.path || '') });
  },

  folder_organize: function(args) {
    return _ipc('cw:folder_organize', {
      sourcePath: String(args.sourcePath || ''),
      groupBy:    String(args.groupBy || 'extension'),
      dryRun:     args.dryRun !== false // dryRun par défaut pour sécurité
    });
  },

  pdf_create: function(args) {
    return _ipc('cw:pdf_create', {
      path:    String(args.path || ''),
      title:   String(args.title || ''),
      content: String(args.content || '')
    });
  },

  excel_create: function(args) {
    return _ipc('cw:excel_create', {
      path:      String(args.path || ''),
      sheetName: String(args.sheetName || 'Sheet1'),
      headers:   args.headers || [],
      rows:      args.rows || []
    });
  },

  document_create: function(args) {
    return _ipc('cw:document_create', {
      format:      String(args.format || 'txt'),
      filename:    String(args.filename || 'document'),
      content:     String(args.content || ''),
      destination: String(args.destination || '%USERPROFILE%\\Documents')
    });
  },

  web_search: function(args) {
    return _ipc('cw:web_search', {
      query:       String(args.query || ''),
      max_results: args.max_results || 5
    });
  },

  web_fetch: function(args) {
    return _ipc('cw:web_fetch', { url: String(args.url || ''), maxChars: 8000 });
  },

  system_status: function(args) {
    return _ipc('cw:system_status', {});
  },

  screenshot_take: function(args) {
    return _ipc('cw:screenshot_take', {});
  },

  process_verify: function(args) {
    return _ipc('cw:process_verify', {
      type:   String(args.type || 'file'),
      target: String(args.target || '')
    });
  },

  get_running_apps: function(args) {
    return _ipc('cw:get_running_apps', {});
  },

  get_clipboard: function(args) {
    if (!IS_ELECTRON) {
      // Tenter l'API web navigator.clipboard
      if (navigator.clipboard && navigator.clipboard.readText) {
        return navigator.clipboard.readText().then(function(text) {
          return { success: true, content: text };
        }).catch(function(e) {
          return { success: false, error: String(e) };
        });
      }
      return Promise.resolve({ success: false, error: 'Accès presse-papiers non disponible.' });
    }
    return _ipc('cw:get_clipboard', {});
  },

  type_text: function(args) {
    return _ipc('cw:type_text', { text: String(args.text || '') });
  },

  kill_process: function(args) {
    return _ipc('cw:kill_process', { name: String(args.name || '') });
  }
};

/* ───────────────────────────────────────────
   DISPATCHER PRINCIPAL
─────────────────────────────────────────── */
function execute(toolName, args) {
  // 1. Valider dans le catalogue
  var validation = window.CWEngine ? window.CWEngine.validateTool(toolName, args) : { valid: true };
  if (!validation.valid) {
    return Promise.resolve({ success: false, error: validation.error });
  }

  // 2. Dispatcher
  var fn = Actions[toolName];
  if (!fn) {
    return Promise.resolve({ success: false, error: 'Action "' + toolName + '" non implémentée.' });
  }

  return fn(args);
}

/* ───────────────────────────────────────────
   EXPORT GLOBAL
─────────────────────────────────────────── */
window.CWAdapter = {
  execute:    execute,
  IS_ELECTRON: IS_ELECTRON
};

})();
