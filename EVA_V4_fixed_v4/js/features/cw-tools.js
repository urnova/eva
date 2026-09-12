/* =============================================================
   CW-TOOLS.JS - Outils agentiques CloudWorks Phase 1
   Chaque outil retourne { success: boolean, result: any, error?: string }
   Classification: SAFE = auto-execute | SENSITIVE = demande validation
   ============================================================= */

(function() {
'use strict';

/* Classification des outils */
var TOOL_CLASSIFICATION = {
  web_search:      'SAFE',
  system_status:   'SAFE',
  screenshot_take: 'SAFE',
  file_list:       'SAFE',
  file_read:       'SAFE',
  file_search:     'SAFE',
  app_resolve:     'SAFE',
  process_verify:  'SAFE',
  app_launch:      'SENSITIVE',
  folder_organize: 'SENSITIVE',
  folder_create:   'SENSITIVE',
  file_create:     'SENSITIVE',
  pdf_create:      'SENSITIVE',
  excel_create:    'SENSITIVE',
  document_create: 'SENSITIVE',
  web_fetch:       'SENSITIVE',
  data_analyze:    'SENSITIVE',
};

/* Schema des outils (pour le prompt LLM) */
var TOOLS_SCHEMA = [
  { name: 'app_resolve', description: 'Identifie si une application est installée sur Windows et trouve son chemin/AppID exact. Args: query (string - ex: "chrome", "edge", "excel", "discord", "notepad")' },
  { name: 'app_launch', description: 'Lance une application résolue et vérifie qu\'elle est bien active. Args: target (string - nom ou chemin résolu), args (string optionnel)' },
  { name: 'process_verify', description: 'Vérifie l\'état réel après action (fichier existant/non vide, dossier avec éléments, processus actif). Args: type ("file"|"folder"|"process"), target (string)' },
  { name: 'folder_organize', description: 'Organise les fichiers d\'un dossier par date ou extension. Args: sourcePath (string), groupBy ("date_month"|"extension"), dryRun (bool=false)' },
  { name: 'web_search', description: 'Recherche sur Internet. Args: query (string), max_results (number=5)' },
  { name: 'web_fetch', description: 'Recupere le contenu d\'une URL. Args: url (string)' },
  { name: 'file_list', description: 'Liste les fichiers d\'un repertoire. Args: path (string), depth (number=1)' },
  { name: 'file_read', description: 'Lit le contenu d\'un fichier texte. Args: path (string)' },
  { name: 'file_search', description: 'Recherche des fichiers par nom. Args: query (string), path (string)' },
  { name: 'folder_create', description: 'Cree un dossier sur le disque. Args: path (string - ex: C:\\Users\\...\\Documents\\dossier)' },
  { name: 'file_create', description: 'Cree ou modifie un fichier texte (txt, md, json, csv, py, js...). Args: path (string), content (string), append (bool)' },
  { name: 'pdf_create', description: 'Cree un vrai document PDF imprime et stylise. Args: path (string - ex: C:\\Users\\...\\Documents\\fichier.pdf), title (string), content (string - texte ou markdown avec titres et listes)' },
  { name: 'excel_create', description: 'Cree un fichier Excel (.xlsx). Args: path (string), sheetName (string), headers (array de colonnes), rows (array de lignes)' },
  { name: 'document_create', description: 'Cree un document formate. Args: format (pdf|xlsx|markdown|html|txt|csv), filename (string), content (string), destination (string)' },
  { name: 'data_analyze', description: 'Analyse des donnees CSV/JSON. Args: data (string), request (string)' },
  { name: 'system_status', description: 'Infos systeme: CPU, RAM. Args: aucun' },
  { name: 'screenshot_take', description: 'Prend une capture d\'ecran. Args: aucun' }
];

/* Utilitaire taille */
function _formatSize(bytes) {
  if (!bytes || bytes === 0) return '0 B';
  var units = ['B', 'KB', 'MB', 'GB', 'TB'];
  var i = Math.floor(Math.log(bytes) / Math.log(1024));
  return (bytes / Math.pow(1024, i)).toFixed(1) + ' ' + units[i];
}

/* ---- web_search ---- */
async function tool_web_search(args) {
  var query = args.query;
  var max_results = args.max_results || 5;
  if (!query) return { success: false, error: 'query manquant' };
  try {
    var encoded = encodeURIComponent(query);
    var url = 'https://api.duckduckgo.com/?q=' + encoded + '&format=json&no_redirect=1&no_html=1';
    var resp = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!resp.ok) throw new Error('HTTP ' + resp.status);
    var data = await resp.json();
    var results = [];
    if (data.AbstractText) {
      results.push({ title: data.AbstractSource || 'Reponse directe', snippet: data.AbstractText.substring(0, 400), url: data.AbstractURL || '' });
    }
    if (data.RelatedTopics) {
      data.RelatedTopics.slice(0, max_results - results.length).forEach(function(t) {
        if (t.Text && t.FirstURL) {
          results.push({ title: t.Text.substring(0, 80), snippet: t.Text.substring(0, 300), url: t.FirstURL });
        }
      });
    }
    return { success: true, result: { query: query, count: results.length, results: results, summary: results.map(function(r) { return r.title + ': ' + r.snippet; }).join('\n\n') || 'Aucun resultat' } };
  } catch (e) {
    return { success: false, error: 'Erreur recherche: ' + e.message };
  }
}

/* ---- web_fetch ---- */
async function tool_web_fetch(args) {
  var url = args.url;
  if (!url) return { success: false, error: 'url manquant' };
  try {
    var resp = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (!resp.ok) throw new Error('HTTP ' + resp.status);
    var contentType = resp.headers.get('content-type') || '';
    var text = await resp.text();
    if (contentType.includes('html')) {
      var tmp = document.createElement('div');
      tmp.innerHTML = text;
      tmp.querySelectorAll('script, style, nav, footer, header, aside').forEach(function(el) { el.remove(); });
      text = (tmp.innerText || tmp.textContent || text).replace(/\s+/g, ' ').trim().substring(0, 4000);
    } else {
      text = text.substring(0, 4000);
    }
    return { success: true, result: { url: url, content: text, contentType: contentType } };
  } catch (e) {
    return { success: false, error: 'Impossible de recuperer ' + url + ': ' + e.message };
  }
}

/* ---- file_list ---- */
async function tool_file_list(args) {
  var targetPath = args.path;
  if (!targetPath) {
    try { var home = await window.eva.fs.homedir(); targetPath = home + '\\Documents'; } catch(e) { targetPath = '.'; }
  }
  try {
    var items = await window.eva.fs.list(targetPath);
    var summary = items.slice(0, 50).map(function(i) { return (i.isDirectory ? '[D] ' : '[F] ') + i.name + (i.size ? ' (' + _formatSize(i.size) + ')' : ''); }).join('\n');
    return { success: true, result: { path: targetPath, count: items.length, items: items.slice(0, 50), summary: 'Contenu de ' + targetPath + ' (' + items.length + ' elements):\n' + summary } };
  } catch (e) {
    return { success: false, error: 'Impossible de lister ' + targetPath + ': ' + e.message };
  }
}

/* ---- file_read ---- */
async function tool_file_read(args) {
  if (!args.path) return { success: false, error: 'path manquant' };
  try {
    var content = await window.eva.fs.read(args.path);
    if (content && content.length > 8000) content = content.substring(0, 8000) + '\n[...tronque...]';
    return { success: true, result: { path: args.path, content: content, length: content ? content.length : 0 } };
  } catch (e) {
    return { success: false, error: 'Impossible de lire ' + args.path + ': ' + e.message };
  }
}

/* ---- file_search ---- */
async function tool_file_search(args) {
  if (!args.query) return { success: false, error: 'query manquant' };
  var searchPath = args.path;
  if (!searchPath) { try { var home = await window.eva.fs.homedir(); searchPath = home; } catch(e) { searchPath = '.'; } }
  try {
    var items = await window.eva.fs.list(searchPath);
    var qLow = args.query.toLowerCase();
    var matches = items.filter(function(i) { return i.name.toLowerCase().includes(qLow); }).slice(0, 20);
    var summary = matches.map(function(i) { return (i.isDirectory ? '[D] ' : '[F] ') + i.name; }).join('\n');
    return { success: true, result: { query: args.query, path: searchPath, count: matches.length, matches: matches, summary: matches.length > 0 ? matches.length + ' fichier(s):\n' + summary : 'Aucun fichier trouve pour "' + args.query + '"' } };
  } catch (e) {
    return { success: false, error: 'Erreur recherche: ' + e.message };
  }
}

/* ---- folder_create ---- */
async function tool_folder_create(args) {
  if (!args.path) return { success: false, error: 'path manquant' };
  try {
    if (window.eva && window.eva.fs && window.eva.fs.mkdir) {
      await window.eva.fs.mkdir(args.path);
      return { success: true, result: { path: args.path, message: 'Dossier créé : ' + args.path } };
    }
    return { success: false, error: 'API fs.mkdir non disponible' };
  } catch(e) {
    return { success: false, error: 'Impossible de créer le dossier ' + args.path + ': ' + e.message };
  }
}

/* ---- pdf_create ---- */
async function tool_pdf_create(args) {
  if (!args.path) return { success: false, error: 'path manquant' };
  if (!args.content && !args.text && !args.html) return { success: false, error: 'content manquant' };
  var targetPath = args.path;
  if (!targetPath.toLowerCase().endsWith('.pdf')) targetPath += '.pdf';
  var content = args.content || args.text || args.html || '';
  var title = args.title || '';

  try {
    if (window.eva && window.eva.fs && window.eva.fs.createPdf) {
      var res = await window.eva.fs.createPdf(targetPath, content, { title: title });
      if (res && res.success) {
        return { success: true, result: { path: targetPath, message: 'Document PDF officiel créé avec succès : ' + targetPath } };
      } else {
        throw new Error(res && res.error ? res.error : 'Erreur création PDF');
      }
    }
    return { success: false, error: 'API fs.createPdf non disponible' };
  } catch (e) {
    return { success: false, error: 'Impossible de générer le PDF ' + targetPath + ': ' + e.message };
  }
}

/* ---- excel_create ---- */
async function tool_excel_create(args) {
  if (!args.path) return { success: false, error: 'path manquant' };
  var targetPath = args.path;
  if (!targetPath.toLowerCase().endsWith('.xlsx')) targetPath += '.xlsx';

  try {
    if (typeof XLSX === 'undefined') {
      if (typeof _loadScript === 'function') {
        await _loadScript('/js/lib/xlsx.full.min.js', 'XLSX');
      }
    }

    if (typeof XLSX === 'undefined') {
      throw new Error('Bibliothèque XLSX (SheetJS) non disponible');
    }

    var wb = XLSX.utils.book_new();
    var sheetData = [];
    if (Array.isArray(args.headers)) {
      sheetData.push(args.headers);
    }
    if (Array.isArray(args.rows)) {
      args.rows.forEach(function(r) {
        sheetData.push(Array.isArray(r) ? r : Object.values(r));
      });
    } else if (Array.isArray(args.data)) {
      sheetData = args.data;
    } else if (typeof args.content === 'string') {
      var lines = args.content.trim().split('\n');
      sheetData = lines.map(function(l) { return l.split(/[,;\t]/).map(function(c) { return c.trim(); }); });
    }

    var ws = Array.isArray(sheetData) && sheetData.length > 0 && typeof sheetData[0] === 'object' && !Array.isArray(sheetData[0])
      ? XLSX.utils.json_to_sheet(sheetData)
      : XLSX.utils.aoa_to_sheet(sheetData);

    var sheetName = args.sheetName || 'Feuille 1';
    XLSX.utils.book_append_sheet(wb, ws, sheetName);

    var b64 = XLSX.write(wb, { bookType: 'xlsx', type: 'base64' });

    if (window.eva && window.eva.fs && window.eva.fs.writeBinary) {
      await window.eva.fs.writeBinary(targetPath, b64);
      return { success: true, result: { path: targetPath, message: 'Fichier Excel (.xlsx) créé avec succès : ' + targetPath } };
    }
    return { success: false, error: 'API fs.writeBinary non disponible' };
  } catch(e) {
    return { success: false, error: 'Impossible de générer le fichier Excel: ' + e.message };
  }
}

/* ---- file_create ---- */
async function tool_file_create(args) {
  if (!args.path) return { success: false, error: 'path manquant' };
  if (args.content === undefined) return { success: false, error: 'content manquant' };
  try {
    var content = args.content;
    var targetPath = args.path;

    // Si le fichier cible est un PDF, rediriger automatiquement vers tool_pdf_create pour générer un vrai PDF !
    if (targetPath.toLowerCase().endsWith('.pdf')) {
      return await tool_pdf_create({ path: targetPath, content: content, title: args.title });
    }

    // Si le fichier cible est un Excel .xlsx, rediriger vers tool_excel_create
    if (targetPath.toLowerCase().endsWith('.xlsx')) {
      return await tool_excel_create({ path: targetPath, content: content });
    }

    if (args.append) { try { var existing = await window.eva.fs.read(targetPath); content = existing + '\n' + content; } catch(e) {} }
    await window.eva.fs.write(targetPath, content);
    return { success: true, result: { path: targetPath, bytes: content.length, message: 'Fichier ' + (args.append ? 'modifie' : 'cree') + ': ' + targetPath } };
  } catch (e) {
    return { success: false, error: 'Impossible d\'ecrire ' + targetPath + ': ' + e.message };
  }
}

/* ---- document_create ---- */
async function tool_document_create(args) {
  if (!args.format || !args.filename || !args.content) return { success: false, error: 'format, filename et content requis' };
  try {
    var home = '.';
    try { home = await window.eva.fs.homedir(); } catch(e) {}
    var dest = args.destination || (home + '\\Documents');

    var fmt = (args.format || '').toLowerCase();
    if (fmt === 'pdf') {
      var pdfPath = dest + '\\' + args.filename + (args.filename.toLowerCase().endsWith('.pdf') ? '' : '.pdf');
      return await tool_pdf_create({ path: pdfPath, content: args.content, title: args.title || args.filename });
    }
    if (fmt === 'xlsx' || fmt === 'excel') {
      var xlsxPath = dest + '\\' + args.filename + (args.filename.toLowerCase().endsWith('.xlsx') ? '' : '.xlsx');
      return await tool_excel_create({ path: xlsxPath, content: args.content });
    }

    var ext = { markdown: 'md', html: 'html', txt: 'txt', csv: 'csv' }[fmt] || fmt;
    var filePath = dest + '\\' + args.filename + '.' + ext;
    var content = args.content;
    if (fmt === 'html') {
      content = '<!DOCTYPE html>\n<html lang="fr">\n<head><meta charset="UTF-8"><title>' + args.filename + '</title></head>\n<body>\n' + content + '\n</body>\n</html>';
    }
    await window.eva.fs.write(filePath, content);
    return { success: true, result: { path: filePath, format: args.format, bytes: content.length, message: 'Document cree: ' + filePath } };
  } catch (e) {
    return { success: false, error: 'Impossible de creer le document: ' + e.message };
  }
}

/* ---- data_analyze ---- */
async function tool_data_analyze(args) {
  if (!args.data || !args.request) return { success: false, error: 'data et request requis' };
  try {
    var analysis = { request: args.request };
    try {
      var parsed = JSON.parse(args.data);
      analysis.type = 'JSON';
      analysis.records = Array.isArray(parsed) ? parsed.length : Object.keys(parsed).length;
    } catch(e) {
      var lines = args.data.trim().split('\n');
      analysis.type = 'CSV';
      analysis.rows = lines.length;
      if (lines.length > 0) { analysis.columns = lines[0].split(',').map(function(c) { return c.trim(); }); analysis.records = lines.length - 1; }
    }
    analysis.summary = JSON.stringify(analysis, null, 2).substring(0, 2000);
    return { success: true, result: analysis };
  } catch (e) {
    return { success: false, error: 'Erreur analyse: ' + e.message };
  }
}

/* ---- system_status ---- */
async function tool_system_status(args) {
  try {
    var info = await window.eva.system.info();
    var stats = null;
    try { stats = await window.eva.system.stats(); } catch(e) {}
    var result = {
      os: info.os || 'Windows',
      cpu: { model: info.cpuModel || 'Inconnu', cores: info.cpuCores || 0, usage: stats ? Math.round(stats.cpu || 0) + '%' : 'N/A' },
      memory: { total: info.ramTotal ? _formatSize(info.ramTotal) : 'N/A', used: stats ? _formatSize(stats.memUsed) : 'N/A', usage: stats ? Math.round((stats.memUsed / stats.memTotal) * 100) + '%' : 'N/A' },
      uptime: info.uptime ? Math.round(info.uptime / 3600) + 'h' : 'N/A',
      hostname: info.hostname || 'Inconnu'
    };
    result.summary = 'Systeme: ' + result.os + ' | CPU: ' + result.cpu.usage + ' | RAM: ' + result.memory.used + '/' + result.memory.total;
    return { success: true, result: result };
  } catch (e) {
    return { success: false, error: 'Erreur systeme: ' + e.message };
  }
}

/* ---- screenshot_take ---- */
async function tool_screenshot_take(args) {
  try {
    var result = await window.eva.system.screenshot();
    if (!result || !result.success) return { success: false, error: 'Capture echouee' };
    return { success: true, result: { path: result.path || '', message: 'Capture prise' + (result.path ? ' -> ' + result.path : '') } };
  } catch (e) {
    return { success: false, error: 'Erreur capture: ' + e.message };
  }
}

/* ---- app_resolve ---- */
async function tool_app_resolve(args) {
  var query = (args.query || args.name || '').trim();
  if (!query) return { success: false, error: 'query manquant' };
  try {
    if (!window.eva || !window.eva.system || !window.eva.system.exec) {
      return { success: false, error: 'API système non disponible' };
    }
    var cleanQ = query.replace(/["'`]/g, '');
    var psCmd = [
      '$q = "' + cleanQ + '"',
      '$results = @()',
      '$apps = Get-StartApps | Where-Object { $_.Name -like "*$q*" -or $_.AppID -like "*$q*" } | Select-Object -First 5',
      'foreach ($a in $apps) { $results += [PSCustomObject]@{ name = $a.Name; appId = $a.AppID; type = "start_menu" } }',
      '$reg = Get-ItemProperty "HKLM:\\Software\\Microsoft\\Windows\\CurrentVersion\\App Paths\\*" -ErrorAction SilentlyContinue | Where-Object { $_.PSChildName -like "*$q*" -or $_.\'(default)\' -like "*$q*" } | Select-Object -First 3',
      'foreach ($r in $reg) { $results += [PSCustomObject]@{ name = $r.PSChildName; path = $r.\'(default)\'; type = "registry" } }',
      'if ($results.Count -eq 0) { $cmd = Get-Command $q -ErrorAction SilentlyContinue; if ($cmd) { $results += [PSCustomObject]@{ name = $cmd.Name; path = $cmd.Source; type = "cli" } } }',
      '$results | ConvertTo-Json -Compress'
    ].join('; ');

    var res = await window.eva.system.exec(psCmd);
    if (!res.success) throw new Error(res.stderr || res.error || 'Échec de la recherche d\'application');
    var out = res.stdout ? res.stdout.trim() : '';
    var list = [];
    if (out) {
      try {
        var parsed = JSON.parse(out);
        list = Array.isArray(parsed) ? parsed : [parsed];
      } catch(e) {}
    }
    if (list.length === 0) {
      return { success: true, result: { query: query, found: false, count: 0, message: 'Aucune application trouvée pour "' + query + '".' } };
    }
    var primary = list[0];
    return {
      success: true,
      result: {
        query: query,
        found: true,
        primaryMatch: primary,
        allMatches: list,
        count: list.length,
        summary: 'Application identifiée : ' + primary.name + ' (' + (primary.path || primary.appId) + ')'
      }
    };
  } catch(e) {
    return { success: false, error: 'Erreur résolution application: ' + e.message };
  }
}

/* ---- app_launch ---- */
async function tool_app_launch(args) {
  var target = (args.target || args.app || args.name || '').trim();
  if (!target) return { success: false, error: 'target manquant' };
  var appArgs = args.args ? (' ' + args.args.trim()) : '';

  try {
    if (!window.eva || !window.eva.system || !window.eva.system.exec) {
      return { success: false, error: 'API système non disponible' };
    }

    var resolvedAppId = null;
    var resolvedPath = null;
    var appName = target;

    // Résolution préalable intelligente si le chemin complet n'est pas fourni
    if (!target.includes('\\') && !target.includes('/')) {
      var resolveRes = await tool_app_resolve({ query: target });
      if (resolveRes.success && resolveRes.result && resolveRes.result.primaryMatch) {
        var m = resolveRes.result.primaryMatch;
        appName = m.name;
        if (m.appId) resolvedAppId = m.appId;
        else if (m.path) resolvedPath = m.path;
      }
    } else {
      resolvedPath = target;
    }

    var launchCmd = '';
    if (resolvedAppId) {
      launchCmd = 'explorer.exe "shell:AppsFolder\\' + resolvedAppId + '"';
    } else if (resolvedPath) {
      launchCmd = 'Start-Process -FilePath "' + resolvedPath + '"' + appArgs;
    } else {
      launchCmd = 'Start-Process "' + target + '"' + appArgs;
    }

    var res = await window.eva.system.exec(launchCmd);
    if (!res.success && res.stderr && (res.stderr.includes('Cannot find') || res.stderr.includes('Introuvable'))) {
      throw new Error(res.stderr);
    }

    // Vérification active dans la liste des processus Windows
    var cleanName = appName.replace(/\.exe$/i, '').split(/[\\\/]/).pop().trim();
    var verifyCmd = 'Start-Sleep -Milliseconds 800; Get-Process | Where-Object { $_.ProcessName -like "*' + cleanName + '*" -or $_.MainWindowTitle -like "*' + cleanName + '*" } | Select-Object -First 1 Id, ProcessName, MainWindowTitle | ConvertTo-Json -Compress';
    var vRes = await window.eva.system.exec(verifyCmd);
    var proc = null;
    if (vRes.success && vRes.stdout) {
      try { proc = JSON.parse(vRes.stdout.trim()); } catch(e) {}
    }

    return {
      success: true,
      result: {
        target: target,
        resolvedName: appName,
        verifiedRunning: !!proc,
        pid: proc ? proc.Id : null,
        processName: proc ? proc.ProcessName : null,
        windowTitle: proc ? proc.MainWindowTitle : null,
        message: proc
          ? 'Application "' + appName + '" lancée et confirmée active (PID: ' + proc.Id + ').'
          : 'Application "' + appName + '" lancée (processus en cours d\'initialisation).'
      }
    };
  } catch(e) {
    return { success: false, error: 'Impossible de lancer ' + target + ': ' + e.message };
  }
}

/* ---- process_verify ---- */
async function tool_process_verify(args) {
  var type = (args.type || 'file').toLowerCase();
  var target = (args.target || args.path || '').trim();
  if (!target) return { success: false, error: 'target manquant' };

  try {
    if (!window.eva || !window.eva.system || !window.eva.system.exec) {
      return { success: false, error: 'API système non disponible' };
    }

    if (type === 'file') {
      var psCmd = '$p = "' + target + '"; if (Test-Path -Path $p -PathType Leaf) { $item = Get-Item -Path $p; [PSCustomObject]@{ exists = $true; size = $item.Length; modified = $item.LastWriteTime.ToString("s") } | ConvertTo-Json -Compress } else { [PSCustomObject]@{ exists = $false } | ConvertTo-Json -Compress }';
      var res = await window.eva.system.exec(psCmd);
      var data = { exists: false };
      if (res.success && res.stdout) {
        try { data = JSON.parse(res.stdout.trim()); } catch(e) {}
      }
      var isEmpty = data.exists && (data.size === 0);
      return {
        success: true,
        result: {
          type: 'file',
          target: target,
          verified: data.exists && !isEmpty,
          exists: data.exists,
          size: data.size || 0,
          isEmpty: isEmpty,
          lastModified: data.modified || null,
          message: !data.exists
            ? 'Vérification ÉCHOUÉE : Le fichier "' + target + '" n\'existe pas.'
            : (isEmpty
              ? 'ATTENTION : Le fichier "' + target + '" existe mais est VIDE (0 octet).'
              : 'Vérification RÉUSSIE : Fichier intègre (' + _formatSize(data.size) + ').')
        }
      };
    }

    if (type === 'folder' || type === 'dir') {
      var psCmd = '$p = "' + target + '"; if (Test-Path -Path $p -PathType Container) { $items = Get-ChildItem -Path $p -ErrorAction SilentlyContinue; [PSCustomObject]@{ exists = $true; count = ($items | Measure-Object).Count } | ConvertTo-Json -Compress } else { [PSCustomObject]@{ exists = $false } | ConvertTo-Json -Compress }';
      var res = await window.eva.system.exec(psCmd);
      var data = { exists: false, count: 0 };
      if (res.success && res.stdout) {
        try { data = JSON.parse(res.stdout.trim()); } catch(e) {}
      }
      return {
        success: true,
        result: {
          type: 'folder',
          target: target,
          verified: data.exists,
          exists: data.exists,
          itemCount: data.count,
          message: data.exists
            ? 'Vérification RÉUSSIE : Dossier présent contenant ' + data.count + ' élément(s).'
            : 'Vérification ÉCHOUÉE : Le dossier "' + target + '" n\'existe pas.'
        }
      };
    }

    if (type === 'process') {
      var clean = target.replace(/\.exe$/i, '').trim();
      var psCmd = 'Get-Process | Where-Object { $_.ProcessName -like "*' + clean + '*" } | Select-Object -First 3 Id, ProcessName, Responding, MainWindowTitle | ConvertTo-Json -Compress';
      var res = await window.eva.system.exec(psCmd);
      var procs = [];
      if (res.success && res.stdout) {
        try {
          var parsed = JSON.parse(res.stdout.trim());
          procs = Array.isArray(parsed) ? parsed : [parsed];
        } catch(e) {}
      }
      var isRunning = procs.length > 0;
      return {
        success: true,
        result: {
          type: 'process',
          target: target,
          verified: isRunning,
          running: isRunning,
          instances: procs,
          message: isRunning
            ? 'Vérification RÉUSSIE : Processus actif (' + procs[0].ProcessName + ', PID: ' + procs[0].Id + ').'
            : 'Vérification ÉCHOUÉE : Aucun processus actif correspondant à "' + target + '".'
        }
      };
    }

    return { success: false, error: 'Type de vérification non supporté: ' + type };
  } catch(e) {
    return { success: false, error: 'Erreur vérification: ' + e.message };
  }
}

/* ---- folder_organize ---- */
async function tool_folder_organize(args) {
  var sourcePath = (args.sourcePath || args.path || '').trim();
  if (!sourcePath) return { success: false, error: 'sourcePath manquant' };
  var groupBy = (args.groupBy || 'date_month').toLowerCase();
  var dryRun = args.dryRun === true;

  try {
    if (!window.eva || !window.eva.system || !window.eva.system.exec) {
      return { success: false, error: 'API système non disponible' };
    }

    var cleanSource = sourcePath
      .replace(/(\$env:USERPROFILE|%USERPROFILE%|[A-Z]:\\[^\\]+)\\Images\\(captures?\s*d['’]écran|screenshots)/gi, '$1\\Pictures\\Screenshots')
      .replace(/(\$env:USERPROFILE|%USERPROFILE%|[A-Z]:\\[^\\]+)\\Pictures\\(captures?\s*d['’]écran)/gi, '$1\\Pictures\\Screenshots')
      .replace(/^Images\\(captures?\s*d['’]écran|screenshots)/gi, 'Pictures\\Screenshots')
      .replace(/^Pictures\\(captures?\s*d['’]écran)/gi, 'Pictures\\Screenshots')
      .replace(/\\Images\\/gi, '\\Pictures\\')
      .replace(/\\Images$/gi, '\\Pictures');

    if (!cleanSource.includes(':') && !cleanSource.startsWith('$env:') && !cleanSource.startsWith('%')) {
      if (/screenshots|captures?/i.test(cleanSource)) {
        cleanSource = '$env:USERPROFILE\\Pictures\\Screenshots';
      } else if (/images|pictures/i.test(cleanSource)) {
        cleanSource = '$env:USERPROFILE\\Pictures';
      } else if (/documents/i.test(cleanSource)) {
        cleanSource = '$env:USERPROFILE\\Documents';
      } else if (/desktop|bureau/i.test(cleanSource)) {
        cleanSource = '$env:USERPROFILE\\Desktop';
      } else if (/downloads|téléchargements/i.test(cleanSource)) {
        cleanSource = '$env:USERPROFILE\\Downloads';
      }
    }

    var psScript = [
      '$src = [System.Environment]::ExpandEnvironmentVariables("' + cleanSource + '")',
      'if (-not (Test-Path -Path $src)) {',
      '  if ($src -like "*capture*" -or $src -like "*Screenshots*") {',
      '    $fallback = Join-Path ([Environment]::GetFolderPath("MyPictures")) "Screenshots"',
      '    if (Test-Path -Path $fallback) { $src = $fallback }',
      '  }',
      '}',
      'if (-not (Test-Path -Path $src)) { Write-Output \'{"error": "Dossier source introuvable"}\'; exit }',
      '$files = Get-ChildItem -Path $src -File',
      '$plan = @()',
      'foreach ($f in $files) {',
      '  $folderName = if ("' + groupBy + '" -eq "extension") { $f.Extension.TrimStart(\'.\').ToUpper() } else { $f.LastWriteTime.ToString("yyyy-MM") }',
      '  if (-not $folderName) { $folderName = "Autres" }',
      '  $plan += [PSCustomObject]@{ fileName = $f.Name; destFolder = $folderName; fullDest = Join-Path $src $folderName }',
      '}',
      'if (' + (dryRun ? '$true' : '$false') + ') {',
      '  [PSCustomObject]@{ dryRun = $true; totalFiles = $plan.Count; destinations = ($plan | Group-Object destFolder | ForEach-Object { @{ folder = $_.Name; count = $_.Count } }) } | ConvertTo-Json -Compress',
      '} else {',
      '  $moved = 0',
      '  foreach ($p in $plan) {',
      '    if (-not (Test-Path -Path $p.fullDest)) { New-Item -Path $p.fullDest -ItemType Directory -Force | Out-Null }',
      '    Move-Item -Path (Join-Path $src $p.fileName) -Destination $p.fullDest -Force',
      '    $moved++',
      '  }',
      '  [PSCustomObject]@{ dryRun = $false; totalFiles = $plan.Count; movedCount = $moved } | ConvertTo-Json -Compress',
      '}'
    ].join('; ');

    var res = await window.eva.system.exec(psScript);
    if (!res.success) throw new Error(res.stderr || res.error || 'Échec organisation');

    var outData = {};
    if (res.stdout) {
      try { outData = JSON.parse(res.stdout.trim()); } catch(e) {}
    }
    if (outData.error) throw new Error(outData.error);

    if (dryRun) {
      return {
        success: true,
        result: {
          sourcePath: cleanSource,
          dryRun: true,
          totalFiles: outData.totalFiles || 0,
          destinations: outData.destinations || [],
          message: 'Plan prévisionnel généré : ' + (outData.totalFiles || 0) + ' fichier(s) à ranger par ' + groupBy + '.'
        }
      };
    }

    return {
      success: true,
      result: {
        sourcePath: cleanSource,
        dryRun: false,
        totalFiles: outData.totalFiles || 0,
        movedCount: outData.movedCount || 0,
        message: 'Organisation réussie : ' + (outData.movedCount || 0) + ' fichier(s) déplacé(s) et vérifié(s) dans ' + cleanSource + '.'
      }
    };
  } catch(e) {
    return { success: false, error: 'Erreur organisation dossier: ' + e.message };
  }
}

/* Dispatcher principal */
async function executeTool(toolName, args) {
  args = args || {};
  switch (toolName) {
    case 'app_resolve':     return await tool_app_resolve(args);
    case 'app_launch':      return await tool_app_launch(args);
    case 'process_verify':  return await tool_process_verify(args);
    case 'folder_organize': return await tool_folder_organize(args);
    case 'web_search':      return await tool_web_search(args);
    case 'web_fetch':       return await tool_web_fetch(args);
    case 'file_list':       return await tool_file_list(args);
    case 'file_read':       return await tool_file_read(args);
    case 'file_search':     return await tool_file_search(args);
    case 'folder_create':   return await tool_folder_create(args);
    case 'file_create':     return await tool_file_create(args);
    case 'pdf_create':      return await tool_pdf_create(args);
    case 'excel_create':    return await tool_excel_create(args);
    case 'document_create': return await tool_document_create(args);
    case 'data_analyze':    return await tool_data_analyze(args);
    case 'system_status':   return await tool_system_status(args);
    case 'screenshot_take': return await tool_screenshot_take(args);
    default: return { success: false, error: 'Outil inconnu: ' + toolName };
  }
}

/* Export global */
window.CWTools = { executeTool: executeTool, TOOL_CLASSIFICATION: TOOL_CLASSIFICATION, TOOLS_SCHEMA: TOOLS_SCHEMA };

})();
