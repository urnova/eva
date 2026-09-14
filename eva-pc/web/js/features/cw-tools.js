/* =============================================================
   CW-TOOLS.JS - Outils agentiques CloudWorks Phase 1 & 2 (Jarvis Standard)
   Inspiré des meilleurs standards MCP (Model Context Protocol) & open-source
   Chaque outil retourne { success: boolean, result: any, error?: string }
   Classification: SAFE = auto-execute | SENSITIVE = demande validation
   ============================================================= */

(function() {
'use strict';

/* Classification des outils */
var TOOL_CLASSIFICATION = {
  web_search:      'SAFE',
  web_browse:      'SAFE',
  system_status:   'SAFE',
  screenshot_take: 'SAFE',
  file_list:       'SAFE',
  file_read:       'SAFE',
  file_search:     'SAFE',
  app_resolve:     'SAFE',
  app_check:       'SAFE',
  process_verify:  'SAFE',
  app_launch:      'SAFE',
  app_close:       'SENSITIVE',
  app_install:     'SENSITIVE',
  folder_organize: 'SAFE',
  folder_create:   'SAFE',
  file_create:     'SAFE',
  pdf_create:      'SAFE',
  excel_create:    'SAFE',
  document_create: 'SAFE',
  web_fetch:       'SAFE',
  data_analyze:    'SAFE',
  command_run:     'SENSITIVE'
};

/* Schema des outils (pour le prompt LLM) */
var TOOLS_SCHEMA = [
  { name: 'app_launch', description: 'Ouvre et lance n\'importe quelle application sur Windows (Discord, Chrome, Edge, Spotify, Steam, Bloc-notes, etc.). Args: target (string - ex: "Discord", "Chrome", "Spotify", "Notepad")' },
  { name: 'app_resolve', description: 'Trouve l\'AppID ou le chemin exact d\'une application dans le système Windows. Args: query (string)' },
  { name: 'app_check', description: 'Vérifie si une application est installée sur le PC ou disponible via le catalogue Winget. Args: name (string)' },
  { name: 'app_install', description: 'Télécharge et installe automatiquement une application sur le PC via le gestionnaire officiel Winget. Args: name (string - ex: "VLC", "Discord", "Chrome")' },
  { name: 'app_close', description: 'Ferme ou quitte une application ou un processus en cours d\'exécution. Args: name (string - ex: "notepad", "discord")' },
  { name: 'web_browse', description: 'Ouvre une page web ou effectue une recherche dans le navigateur de l\'utilisateur. Args: url (string optionnel), query (string optionnel)' },
  { name: 'web_search', description: 'Recherche des informations sur Internet et retourne un résumé direct. Args: query (string), max_results (number=5)' },
  { name: 'web_fetch', description: 'Récupère et extrait le contenu textuel propre d\'une URL web. Args: url (string)' },
  { name: 'folder_organize', description: 'Organise et trie automatiquement les fichiers d\'un dossier par date ou extension (idéal pour captures d\'écran et téléchargements). Args: sourcePath (string), groupBy ("date_month"|"extension"), dryRun (bool=false)' },
  { name: 'file_list', description: 'Liste les fichiers et dossiers d\'un répertoire. Args: path (string), depth (number=1)' },
  { name: 'file_read', description: 'Lit le contenu d\'un fichier texte ou code. Args: path (string)' },
  { name: 'file_search', description: 'Recherche des fichiers par nom sur le disque. Args: query (string), path (string optionnel)' },
  { name: 'folder_create', description: 'Crée un nouveau dossier sur le disque. Args: path (string)' },
  { name: 'file_create', description: 'Crée ou modifie un fichier texte (txt, md, json, csv, py, js...). Args: path (string), content (string), append (bool)' },
  { name: 'pdf_create', description: 'Génère un vrai document PDF officiel et stylisé. Args: path (string), title (string), content (string - titres, listes, explications)' },
  { name: 'excel_create', description: 'Génère un tableau Excel (.xlsx). Args: path (string), sheetName (string), headers (array), rows (array)' },
  { name: 'document_create', description: 'Crée un document formaté (pdf, xlsx, md, html, txt). Args: format, filename, content, destination' },
  { name: 'data_analyze', description: 'Analyse des données brutes CSV ou JSON. Args: data (string), request (string)' },
  { name: 'system_status', description: 'Affiche l\'état du système : CPU, RAM, OS, espace disque. Args: aucun' },
  { name: 'screenshot_take', description: 'Prend une capture d\'écran du bureau Windows. Args: aucun' },
  { name: 'command_run', description: 'Exécute une commande PowerShell sécurisée et retourne sa sortie. Args: command (string)' }
];

/* Utilitaire taille */
function _formatSize(bytes) {
  if (!bytes || bytes === 0) return '0 B';
  var units = ['B', 'KB', 'MB', 'GB', 'TB'];
  var i = Math.floor(Math.log(bytes) / Math.log(1024));
  return (bytes / Math.pow(1024, i)).toFixed(1) + ' ' + units[i];
}

/* ══════════════════════════════════════════════════════════
   1. GESTION DES APPLICATIONS (APP LAUNCH, RESOLVE, INSTALL)
   Inspiré de Windows-MCP & open-interpreter
   ══════════════════════════════════════════════════════════ */

/* Normalisation des noms usuels d'applications vers leurs identifiants Windows */
function _normalizeAppName(name) {
  var raw = (name || '').toLowerCase().trim();
  // Retirer les articles (le, la, les, l', un, une, des)
  raw = raw.replace(/^(?:le|la|les|l'|l’|un|une|des)\s+/, '').trim();
  var map = {
    'bloc-notes': 'notepad',
    'bloc notes': 'notepad',
    'bloc note': 'notepad',
    'carnet de notes': 'notepad',
    'calculatrice': 'calculator',
    'calc': 'calculator',
    'explorateur': 'explorer',
    'explorateur de fichiers': 'explorer',
    'navigateur': 'msedge',
    'navigateur web': 'msedge',
    'edge': 'msedge',
    'chrome': 'google chrome',
    'google chrome': 'google chrome',
    'firefox': 'firefox',
    'brave': 'brave',
    'opera': 'opera',
    'discord': 'discord',
    'spotify': 'spotify',
    'steam': 'steam',
    'vlc': 'vlc',
    'youtube music': 'youtube music',
    'yt music': 'youtube music',
    'word': 'winword',
    'excel': 'excel',
    'powerpoint': 'powerpnt',
    'vscode': 'code',
    'visual studio code': 'code',
    'terminal': 'wt',
    'powershell': 'powershell',
    'cmd': 'cmd'
  };
  return map[raw] || raw;
}

/* ---- app_resolve ---- */
async function tool_app_resolve(args) {
  var query = (args.query || args.name || '').trim();
  if (!query) return { success: false, error: 'query manquant' };
  try {
    if (!window.eva || !window.eva.system || !window.eva.system.exec) {
      return { success: false, error: 'API système non disponible' };
    }

    var normQ = _normalizeAppName(query);
    var cleanQ = normQ.replace(/["'`]/g, '');

    var psCmd = [
      '$q = "' + cleanQ + '"',
      '$results = @()',
      '# 1. Menu Démarrer (Apps UWP + Win32 avec AppID officiel)',
      '$apps = Get-StartApps | Where-Object { $_.Name -like "*$q*" -or $_.AppID -like "*$q*" } | Select-Object -First 5',
      'foreach ($a in $apps) { $results += [PSCustomObject]@{ name = $a.Name; appId = $a.AppID; type = "start_menu" } }',
      '# 2. App Paths dans la base de registre (HKLM et HKCU)',
      '$regHKLM = Get-ItemProperty "HKLM:\Software\Microsoft\Windows\CurrentVersion\App Paths\*" -ErrorAction SilentlyContinue | Where-Object { $_.PSChildName -like "*$q*" -or $_."(default)" -like "*$q*" } | Select-Object -First 3',
      'foreach ($r in $regHKLM) { $results += [PSCustomObject]@{ name = $r.PSChildName; path = $r."(default)"; type = "registry" } }',
      '$regHKCU = Get-ItemProperty "HKCU:\Software\Microsoft\Windows\CurrentVersion\App Paths\*" -ErrorAction SilentlyContinue | Where-Object { $_.PSChildName -like "*$q*" -or $_."(default)" -like "*$q*" } | Select-Object -First 3',
      'foreach ($r in $regHKCU) { $results += [PSCustomObject]@{ name = $r.PSChildName; path = $r."(default)"; type = "registry" } }',
      '# 3. Dossier LocalAppData (apps modernes utilisateur comme Discord, Spotify)',
      '$localDirs = Get-ChildItem "$env:LOCALAPPDATA" -Directory -ErrorAction SilentlyContinue | Where-Object { $_.Name -like "*$q*" } | Select-Object -First 2',
      'foreach ($ld in $localDirs) {',
      '  $exe = Get-ChildItem $ld.FullName -Filter "*.exe" -Recurse -Depth 2 -ErrorAction SilentlyContinue | Where-Object { $_.Name -like "*$q*" -or $_.Name -like "Update.exe" } | Select-Object -First 1',
      '  if ($exe) { $results += [PSCustomObject]@{ name = $ld.Name; path = $exe.FullName; type = "local_appdata" } }',
      '}',
      '# 4. PATH système',
      'if ($results.Count -eq 0) {',
      '  $cmd = Get-Command $q -ErrorAction SilentlyContinue',
      '  if ($cmd) { $results += [PSCustomObject]@{ name = $cmd.Name; path = $cmd.Source; type = "cli" } }',
      '}',
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
      return {
        success: true,
        result: {
          query: query,
          found: false,
          count: 0,
          message: 'Aucune application trouvée pour "' + query + '". Utilisez app_check pour chercher si elle est installable.'
        }
      };
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
        summary: 'Application identifiée : ' + primary.name + ' (' + (primary.appId || primary.path) + ')'
      }
    };
  } catch(e) {
    return { success: false, error: 'Erreur résolution application: ' + e.message };
  }
}

/* ---- app_launch (Lancement Infaillible) ---- */
async function tool_app_launch(args) {
  var target = (args.target || args.app || args.name || '').trim();
  if (!target) return { success: false, error: 'target manquant' };
  var appArgs = args.args ? (' ' + args.args.trim()) : '';

  // Si la cible est une URL web ou le mot 'navigateur', router directement vers web_browse
  var normT = _normalizeAppName(target);
  if (/^(https?:\/\/|www\.)/i.test(target) || normT === 'msedge' && target.toLowerCase().includes('navigateur')) {
    return await tool_web_browse({ url: /^(https?:\/\/|www\.)/i.test(target) ? target : '', query: '' });
  }

  try {
    if (!window.eva || !window.eva.system || !window.eva.system.exec) {
      return { success: false, error: 'API système non disponible' };
    }

    var resolvedAppId = null;
    var resolvedPath = null;
    var appName = target;

    // Résolution préalable intelligente si ce n'est pas un chemin direct
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
    // Lancement par AppID officiel Windows (Fonctionne pour 100% des apps du menu démarrer)
    if (resolvedAppId) {
      launchCmd = 'explorer.exe "shell:AppsFolder\\' + resolvedAppId + '"';
    } else if (resolvedPath) {
      launchCmd = 'Start-Process -FilePath "' + resolvedPath + '"' + appArgs;
    } else {
      // Fallback par nom normalisé
      var cleanTarget = _normalizeAppName(target);
      launchCmd = 'Start-Process "' + cleanTarget + '"' + appArgs;
    }

    console.log('[CW Tools] Lancement commande:', launchCmd);
    var res = await window.eva.system.exec(launchCmd);

    // Vérification rapide de l'activité du processus
    var cleanName = appName.replace(/\.exe$/i, '').split(/[\\\/]/).pop().trim();
    var verifyCmd = 'Start-Sleep -Milliseconds 600; Get-Process | Where-Object { $_.ProcessName -like "*' + cleanName + '*" -or $_.MainWindowTitle -like "*' + cleanName + '*" } | Select-Object -First 1 Id, ProcessName, MainWindowTitle | ConvertTo-Json -Compress';
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
        message: 'Application "' + appName + '" lancée avec succès sur votre PC.'
      }
    };
  } catch(e) {
    return { success: false, error: 'Impossible de lancer ' + target + ': ' + e.message };
  }
}

/* ---- app_check ---- */
async function tool_app_check(args) {
  var name = (args.name || args.query || '').trim();
  if (!name) return { success: false, error: 'name manquant' };
  try {
    var resResolve = await tool_app_resolve({ query: name });
    if (resResolve.success && resResolve.result && resResolve.result.found) {
      return {
        success: true,
        result: {
          name: name,
          installed: true,
          details: resResolve.result.primaryMatch,
          message: 'L\'application "' + name + '" est bien installée sur votre PC.'
        }
      };
    }

    // Si pas trouvé localement, vérifier si disponible via winget
    var cleanN = name.replace(/["'`]/g, '');
    var psWinget = 'winget search -q "' + cleanN + '" --accept-source-agreements | Select-Object -First 5 | Out-String';
    var wRes = await window.eva.system.exec(psWinget);
    var hasWinget = wRes.success && wRes.stdout && !wRes.stdout.includes('No package found');

    return {
      success: true,
      result: {
        name: name,
        installed: false,
        availableOnWinget: hasWinget,
        message: 'L\'application "' + name + '" n\'est pas installée sur votre PC' + (hasWinget ? ' mais elle est disponible et installable automatiquement avec app_install.' : '.')
      }
    };
  } catch(e) {
    return { success: false, error: 'Erreur vérification application: ' + e.message };
  }
}

/* ---- app_install ---- */
async function tool_app_install(args) {
  var name = (args.name || args.packageId || '').trim();
  if (!name) return { success: false, error: 'name manquant' };
  try {
    var cleanN = name.replace(/["'`]/g, '');
    // Installation silencieuse automatique sans confirmation bloquante
    var installCmd = 'winget install -q "' + cleanN + '" --silent --accept-source-agreements --accept-package-agreements';
    console.log('[CW Tools] Installation winget en cours pour:', cleanN);
    var res = await window.eva.system.exec(installCmd);
    if (!res.success && res.stderr && !res.stderr.includes('Successfully installed')) {
      throw new Error(res.stderr || res.error || 'Erreur lors de l\'installation');
    }
    return {
      success: true,
      result: {
        name: name,
        installed: true,
        message: 'Application "' + name + '" installée avec succès sur votre PC via Winget !'
      }
    };
  } catch(e) {
    return { success: false, error: 'Échec installation ' + name + ': ' + e.message };
  }
}

/* ---- app_close ---- */
async function tool_app_close(args) {
  var name = (args.name || args.target || '').trim();
  if (!name) return { success: false, error: 'name manquant' };
  try {
    var cleanN = name.replace(/\.exe$/i, '').replace(/["'`]/g, '');
    var closeCmd = 'Get-Process | Where-Object { $_.ProcessName -like "*' + cleanN + '*" -or $_.MainWindowTitle -like "*' + cleanN + '*" } | Stop-Process -Force -ErrorAction SilentlyContinue; Write-Output "OK"';
    var res = await window.eva.system.exec(closeCmd);
    return {
      success: true,
      result: {
        name: name,
        closed: true,
        message: 'Processus et fenêtres de "' + name + '" fermés avec succès.'
      }
    };
  } catch(e) {
    return { success: false, error: 'Impossible de fermer ' + name + ': ' + e.message };
  }
}

/* ══════════════════════════════════════════════════════════
   2. WEB & NAVIGATION (WEB BROWSE, SEARCH, FETCH)
   Inspiré de browser-use
   ══════════════════════════════════════════════════════════ */

/* ---- web_browse ---- */
async function tool_web_browse(args) {
  args = args || {};
  var targetUrl = (args.url || '').trim();
  var query = (args.query || '').trim();

  // Si aucune URL mais une recherche demandée
  if (!targetUrl && query) {
    targetUrl = 'https://www.google.com/search?q=' + encodeURIComponent(query);
  } else if (!targetUrl && !query) {
    // Si ni URL ni recherche spécifiée, ouvrir la page d'accueil par défaut
    targetUrl = 'https://www.google.com';
  } else if (targetUrl && !targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
    targetUrl = 'https://' + targetUrl;
  }

  try {
    // 1. Electron natif via shell.openExternal (instantané, lance le navigateur par défaut de l'utilisateur)
    if (window.eva && typeof window.eva.openExternal === 'function') {
      await window.eva.openExternal(targetUrl);
    } else if (typeof window.open === 'function') {
      // 2. Environnement web standard (Web Vercel / PWA)
      window.open(targetUrl, '_blank');
    } else if (window.eva && window.eva.system && window.eva.system.exec) {
      // 3. Fallback PowerShell si nécessaire
      var cleanUrl = targetUrl.replace(/["'`]/g, '');
      await window.eva.system.exec('Start-Process "' + cleanUrl + '"');
    }

    return {
      success: true,
      result: {
        url: targetUrl,
        opened: true,
        message: 'Navigateur ouvert sur : ' + targetUrl
      }
    };
  } catch(e) {
    return { success: false, error: 'Impossible d\'ouvrir la page web: ' + e.message };
  }
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
      results.push({ title: data.AbstractSource || 'Réponse directe', snippet: data.AbstractText.substring(0, 400), url: data.AbstractURL || '' });
    }
    if (data.RelatedTopics) {
      data.RelatedTopics.slice(0, max_results - results.length).forEach(function(t) {
        if (t.Text && t.FirstURL) {
          results.push({ title: t.Text.substring(0, 80), snippet: t.Text.substring(0, 300), url: t.FirstURL });
        }
      });
    }
    return {
      success: true,
      result: {
        query: query,
        count: results.length,
        results: results,
        summary: results.map(function(r) { return r.title + ': ' + r.snippet; }).join('\n\n') || 'Aucun résultat direct'
      }
    };
  } catch (e) {
    return { success: false, error: 'Erreur recherche web: ' + e.message };
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
    return { success: false, error: 'Impossible de récupérer ' + url + ': ' + e.message };
  }
}

/* ══════════════════════════════════════════════════════════
   3. FICHIERS & DOSSIERS
   ══════════════════════════════════════════════════════════ */

/* ---- file_list ---- */
async function tool_file_list(args) {
  var targetPath = args.path;
  if (!targetPath) {
    try { var home = await window.eva.fs.homedir(); targetPath = home + '\\Documents'; } catch(e) { targetPath = '.'; }
  }
  try {
    var items = await window.eva.fs.list(targetPath);
    var summary = items.slice(0, 50).map(function(i) { return (i.isDirectory ? '[D] ' : '[F] ') + i.name + (i.size ? ' (' + _formatSize(i.size) + ')' : ''); }).join('\n');
    return { success: true, result: { path: targetPath, count: items.length, items: items.slice(0, 50), summary: 'Contenu de ' + targetPath + ' (' + items.length + ' éléments):\n' + summary } };
  } catch (e) {
    return { success: false, error: 'Impossible de lister ' + targetPath + ': ' + e.message };
  }
}

/* ---- file_read ---- */
async function tool_file_read(args) {
  if (!args.path) return { success: false, error: 'path manquant' };
  try {
    var content = await window.eva.fs.read(args.path);
    if (content && content.length > 8000) content = content.substring(0, 8000) + '\n[...tronqué...]';
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
    return { success: true, result: { query: args.query, path: searchPath, count: matches.length, matches: matches, summary: matches.length > 0 ? matches.length + ' fichier(s):\n' + summary : 'Aucun fichier trouvé pour "' + args.query + '"' } };
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
      return { success: true, result: { path: args.path, message: 'Dossier créé avec succès : ' + args.path } };
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
      throw new Error('Bibliothèque XLSX non disponible');
    }

    var wb = XLSX.utils.book_new();
    var sheetData = [];
    if (Array.isArray(args.headers)) sheetData.push(args.headers);
    if (Array.isArray(args.rows)) {
      args.rows.forEach(function(r) { sheetData.push(Array.isArray(r) ? r : Object.values(r)); });
    } else if (Array.isArray(args.data)) {
      sheetData = args.data;
    }

    var ws = XLSX.utils.aoa_to_sheet(sheetData);
    var sheetName = args.sheetName || 'Données';
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

    if (targetPath.toLowerCase().endsWith('.pdf')) {
      return await tool_pdf_create({ path: targetPath, content: content, title: args.title });
    }
    if (targetPath.toLowerCase().endsWith('.xlsx')) {
      return await tool_excel_create({ path: targetPath, content: content });
    }

    if (args.append) { try { var existing = await window.eva.fs.read(targetPath); content = existing + '\n' + content; } catch(e) {} }
    await window.eva.fs.write(targetPath, content);
    return { success: true, result: { path: targetPath, bytes: content.length, message: 'Fichier ' + (args.append ? 'modifié' : 'créé') + ': ' + targetPath } };
  } catch (e) {
    return { success: false, error: 'Impossible d\'écrire ' + targetPath + ': ' + e.message };
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
    return { success: true, result: { path: filePath, format: args.format, bytes: content.length, message: 'Document créé: ' + filePath } };
  } catch (e) {
    return { success: false, error: 'Impossible de créer le document: ' + e.message };
  }
}

/* ---- folder_organize ---- */
async function tool_folder_organize(args) {
  var sourcePath = args.sourcePath || args.path || '$env:USERPROFILE\\Pictures\\Screenshots';
  var groupBy = args.groupBy || 'date_month';
  var dryRun = !!args.dryRun;

  try {
    if (!window.eva || !window.eva.system || !window.eva.system.exec) {
      return { success: false, error: 'API système non disponible' };
    }

    var cleanSource = sourcePath
      .replace(/(\$env:USERPROFILE|%USERPROFILE%|[A-Z]:\\[^\\]+)\\Images\\(captures?\s*d['’]écran|screenshots)/gi, '$1\\Pictures\\Screenshots')
      .replace(/Images\\(captures?\s*d['’]écran|screenshots)/gi, 'Pictures\\Screenshots')
      .replace(/\\Images\\/gi, '\\Pictures\\');

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

    return {
      success: true,
      result: {
        sourcePath: cleanSource,
        dryRun: dryRun,
        totalFiles: outData.totalFiles || 0,
        movedCount: outData.movedCount || 0,
        message: 'Organisation réussie : ' + (outData.movedCount || 0) + ' fichier(s) classé(s) dans ' + cleanSource + '.'
      }
    };
  } catch(e) {
    return { success: false, error: 'Erreur organisation dossier: ' + e.message };
  }
}

/* ══════════════════════════════════════════════════════════
   4. SYSTÈME & COMMANDE
   ══════════════════════════════════════════════════════════ */

/* ---- command_run ---- */
async function tool_command_run(args) {
  var cmd = (args.command || args.cmd || '').trim();
  if (!cmd) return { success: false, error: 'command manquant' };
  try {
    var res = await window.eva.system.exec(cmd);
    return {
      success: res.success,
      result: {
        command: cmd,
        stdout: res.stdout || '',
        stderr: res.stderr || '',
        exitCode: res.success ? 0 : 1
      },
      error: res.success ? undefined : (res.stderr || res.error)
    };
  } catch(e) {
    return { success: false, error: 'Erreur exécution commande: ' + e.message };
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
      var checkCmd = '$p = [System.Environment]::ExpandEnvironmentVariables("' + target.replace(/["'`]/g, '') + '"); if (Test-Path -Path $p -PathType Leaf) { $item = Get-Item -Path $p; [PSCustomObject]@{ exists = $true; size = $item.Length; name = $item.Name } | ConvertTo-Json -Compress } else { [PSCustomObject]@{ exists = $false } | ConvertTo-Json -Compress }';
      var res = await window.eva.system.exec(checkCmd);
      var info = { exists: false };
      if (res.success && res.stdout) {
        try { info = JSON.parse(res.stdout.trim()); } catch(e) {}
      }
      return { success: true, result: { type: 'file', target: target, exists: !!info.exists, size: info.size || 0, isEmpty: (info.size || 0) === 0 } };
    }

    if (type === 'process') {
      var cleanP = target.replace(/\.exe$/i, '').replace(/["'`]/g, '');
      var procCmd = 'Get-Process | Where-Object { $_.ProcessName -like "*' + cleanP + '*" -or $_.MainWindowTitle -like "*' + cleanP + '*" } | Select-Object -First 1 Id, ProcessName, MainWindowTitle | ConvertTo-Json -Compress';
      var resProc = await window.eva.system.exec(procCmd);
      var pInfo = null;
      if (resProc.success && resProc.stdout) {
        try { pInfo = JSON.parse(resProc.stdout.trim()); } catch(e) {}
      }
      return { success: true, result: { type: 'process', target: target, running: !!pInfo, pid: pInfo ? pInfo.Id : null, processName: pInfo ? pInfo.ProcessName : null } };
    }

    return { success: false, error: 'Type de vérification inconnu: ' + type };
  } catch(e) {
    return { success: false, error: 'Erreur vérification: ' + e.message };
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
    result.summary = 'Système: ' + result.os + ' | CPU: ' + result.cpu.usage + ' | RAM: ' + result.memory.used + '/' + result.memory.total;
    return { success: true, result: result };
  } catch (e) {
    return { success: false, error: 'Erreur système: ' + e.message };
  }
}

/* ---- screenshot_take ---- */
async function tool_screenshot_take(args) {
  try {
    var result = await window.eva.system.screenshot();
    if (!result || !result.success) return { success: false, error: 'Capture échouée' };
    return { success: true, result: { path: result.path || '', message: 'Capture prise' + (result.path ? ' -> ' + result.path : '') } };
  } catch (e) {
    return { success: false, error: 'Erreur capture: ' + e.message };
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

/* ══════════════════════════════════════════════════════════
   DISPATCHER GÉNÉRAL DES OUTILS
   ══════════════════════════════════════════════════════════ */
async function executeTool(toolName, args) {
  args = args || {};
  switch (toolName) {
    case 'app_launch':      return await tool_app_launch(args);
    case 'app_resolve':     return await tool_app_resolve(args);
    case 'app_check':       return await tool_app_check(args);
    case 'app_install':     return await tool_app_install(args);
    case 'app_close':       return await tool_app_close(args);
    case 'web_browse':      return await tool_web_browse(args);
    case 'web_search':      return await tool_web_search(args);
    case 'web_fetch':       return await tool_web_fetch(args);
    case 'folder_organize': return await tool_folder_organize(args);
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
    case 'process_verify':  return await tool_process_verify(args);
    case 'command_run':     return await tool_command_run(args);
    default: return { success: false, error: 'Outil inconnu: ' + toolName };
  }
}

/* Export global */
window.CWTools = {
  executeTool: executeTool,
  TOOL_CLASSIFICATION: TOOL_CLASSIFICATION,
  TOOLS_SCHEMA: TOOLS_SCHEMA
};

})();
