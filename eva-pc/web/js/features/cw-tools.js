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
  web_fetch:       'SENSITIVE',
  file_search:     'SENSITIVE',
  file_create:     'SENSITIVE',
  document_create: 'SENSITIVE',
  data_analyze:    'SENSITIVE',
};

/* Schema des outils (pour le prompt LLM) */
var TOOLS_SCHEMA = [
  { name: 'web_search', description: 'Recherche sur Internet. Args: query (string), max_results (number=5)' },
  { name: 'web_fetch', description: 'Recupere le contenu d\'une URL. Args: url (string)' },
  { name: 'file_list', description: 'Liste les fichiers d\'un repertoire. Args: path (string), depth (number=1)' },
  { name: 'file_read', description: 'Lit le contenu d\'un fichier texte. Args: path (string)' },
  { name: 'file_search', description: 'Recherche des fichiers par nom. Args: query (string), path (string)' },
  { name: 'file_create', description: 'Cree ou modifie un fichier. Args: path (string), content (string), append (bool)' },
  { name: 'document_create', description: 'Cree un document formate. Args: format (markdown|html|txt|csv), filename (string), content (string), destination (string)' },
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

/* ---- file_create ---- */
async function tool_file_create(args) {
  if (!args.path) return { success: false, error: 'path manquant' };
  if (args.content === undefined) return { success: false, error: 'content manquant' };
  try {
    var content = args.content;
    if (args.append) { try { var existing = await window.eva.fs.read(args.path); content = existing + '\n' + content; } catch(e) {} }
    await window.eva.fs.write(args.path, content);
    return { success: true, result: { path: args.path, bytes: content.length, message: 'Fichier ' + (args.append ? 'modifie' : 'cree') + ': ' + args.path } };
  } catch (e) {
    return { success: false, error: 'Impossible d\'ecrire ' + args.path + ': ' + e.message };
  }
}

/* ---- document_create ---- */
async function tool_document_create(args) {
  if (!args.format || !args.filename || !args.content) return { success: false, error: 'format, filename et content requis' };
  try {
    var ext = { markdown: 'md', html: 'html', txt: 'txt', csv: 'csv' }[args.format] || args.format;
    var home = '.';
    try { home = await window.eva.fs.homedir(); } catch(e) {}
    var dest = args.destination || (home + '\\Desktop');
    var filePath = dest + '\\' + args.filename + '.' + ext;
    var content = args.content;
    if (args.format === 'html') {
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

/* Dispatcher principal */
async function executeTool(toolName, args) {
  args = args || {};
  switch (toolName) {
    case 'web_search':      return await tool_web_search(args);
    case 'web_fetch':       return await tool_web_fetch(args);
    case 'file_list':       return await tool_file_list(args);
    case 'file_read':       return await tool_file_read(args);
    case 'file_search':     return await tool_file_search(args);
    case 'file_create':     return await tool_file_create(args);
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
