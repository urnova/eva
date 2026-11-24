# -*- coding: utf-8 -*-
import io

cw_path = r'f:\code\eva\evaprojectmultiplatforme\eva-pc\web\js\features\cw-agent.js'

with io.open(cw_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Trouver la section _parseThought / _parseToolCall
start_marker = 'function _parseThought(text) {'
end_marker = 'function _stripTags(text) {'

start_idx = content.find(start_marker)
end_idx = content.find(end_marker)

if start_idx == -1 or end_idx == -1:
    print("Erreur: marqueurs non trouvés!")
    exit(1)

new_block = '''function _parseThought(text) {
  if (!text) return null;
  // FIX v5.6.19: Supporte <thought>...</thought> ET <think>...</think> (variante du modele GGUF)
  var match = text.match(/<(?:thought|think)>([\s\S]*?)<\/(?:thought|think)>/i);
  return match ? match[1].trim() : null;
}

function _extractJsonBlock(text) {
  if (!text) return null;
  var match = text.match(/\\{\\s*"(?:name|tool|action)"/);
  if (!match) return null;
  var start = match.index;
  var depth = 0;
  var inStr = false;
  var escape = false;
  for (var i = start; i < text.length; i++) {
    var c = text[i];
    if (escape) { escape = false; continue; }
    if (c === '\\\\') { escape = true; continue; }
    if (c === '"') { inStr = !inStr; continue; }
    if (!inStr) {
      if (c === '{') depth++;
      else if (c === '}') {
        depth--;
        if (depth === 0) return text.substring(start, i + 1);
      }
    }
  }
  return null;
}

function _parseToolCall(text) {
  if (!text) return null;

  // 1. Format standard <tool_call>...</tool_call>
  var m = text.match(/<tool_call>([\\s\\S]*?)(?:<\\/tool_call>|$)/i);
  if (m) {
    var raw = m[1].trim();
    var jsonStr = _extractJsonBlock(raw) || raw;
    try {
      var parsed = JSON.parse(jsonStr);
      var name = parsed.name || parsed.tool || parsed.action;
      var args = parsed.args || parsed.arguments || parsed.parameters || {};
      if (name) return { name: name, args: args };
    } catch(e) {}
  }

  // 2. FIX v5.6.21: JSON direct sans balise <tool_call>
  var directJson = _extractJsonBlock(text);
  if (directJson) {
    try {
      var pDirect = JSON.parse(directJson);
      var dName = pDirect.name || pDirect.tool || pDirect.action;
      var dArgs = pDirect.args || pDirect.arguments || pDirect.parameters || {};
      if (dName) return { name: dName, args: dArgs };
    } catch(e) {}
  }

  // 3. FIX v5.6.21: Appel de fonction syntaxique : tool_name(...)
  var funcCall = text.match(/\\b(app_launch|app_resolve|web_browse|web_search|web_fetch|file_list|file_read|file_create|folder_create|system_status|screenshot_take|process_verify)\\s*\\(([^)]*)\\)/i);
  if (funcCall) {
    var fnName = funcCall[1].toLowerCase();
    var rawArgs = (funcCall[2] || '').trim();
    if (!rawArgs) return { name: fnName, args: {} };
    var argM = rawArgs.match(/["']([^"']+)["']/);
    var val = argM ? argM[1] : rawArgs.trim();
    var argKey = (fnName === 'app_launch' || fnName === 'web_browse' || fnName === 'web_fetch') ? 'target' : ((fnName === 'app_resolve' || fnName === 'web_search') ? 'query' : 'path');
    var resArgs = {};
    resArgs[argKey] = val;
    return { name: fnName, args: resArgs };
  }

  // 4. FIX v5.6.21: URL detectee dans la pensee ou la reponse avec intention web/launch
  var urlMatch = text.match(/https?:\\/\\/[^\\s"'`<>]+/i);
  if (urlMatch && /app_launch|web_browse|ouvr|lanc|navig|visit|charg|url/i.test(text)) {
    return { name: 'app_launch', args: { target: urlMatch[0] } };
  }

  // 5. FIX v5.6.21: Extraction de mention d'outil avec argument dans la pensee (modele 3B)
  var toolArg = text.match(/\\b(app_launch|app_resolve|web_browse|file_list|file_read|file_create|folder_create)\\b[^.\\n]*?(?:avec|sur|pour|target|query|path|chemin)\\s*(?:[:=]|["']|\\s+)?\\s*(?:target|query|path)?\\s*[:=]?\\s*["']?([a-zA-Z0-9_.\\-:\\\\/]+)["']?/i);
  if (toolArg) {
    var tName = toolArg[1].toLowerCase();
    var tVal = toolArg[2].trim().replace(/[.,;)"']+$/g, '');
    var blacklist = ['avec', 'sur', 'pour', 'target', 'query', 'path'];
    if (tVal && blacklist.indexOf(tVal.toLowerCase()) === -1) {
      var tKey = (tName === 'app_launch' || tName === 'web_browse') ? 'target' : (tName === 'app_resolve' ? 'query' : 'path');
      var tObj = {};
      tObj[tKey] = tVal;
      return { name: tName, args: tObj };
    }
  }

  // 6. FIX v5.6.21: Outils sans arguments
  var zeroTool = text.match(/\\b(screenshot_take|system_status)\\b/i);
  if (zeroTool) {
    return { name: zeroTool[1].toLowerCase(), args: {} };
  }

  return null;
}

'''

updated_content = content[:start_idx] + new_block + content[end_idx:]

with io.open(cw_path, 'w', encoding='utf-8') as f:
    f.write(updated_content)

print("Patch applique avec succes sur cw-agent.js!")
