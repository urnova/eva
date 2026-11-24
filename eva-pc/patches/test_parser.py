import re
import json

def extract_json_block(text):
    start = -1
    for m in re.finditer(r'\{\s*"(?:name|tool|action)"', text):
        start = m.start()
        depth = 0
        in_str = False
        escape = False
        for i in range(start, len(text)):
            c = text[i]
            if escape:
                escape = False
                continue
            if c == '\\':
                escape = True
                continue
            if c == '"':
                in_str = not in_str
                continue
            if not in_str:
                if c == '{':
                    depth += 1
                elif c == '}':
                    depth -= 1
                    if depth == 0:
                        return text[start:i+1]
    return None

def parse_tool_call(text):
    if not text:
        return None
    
    # 1. Format standard <tool_call>...</tool_call>
    m = re.search(r'<tool_call>([\s\S]*?)(?:</tool_call>|$)', text)
    if m:
        raw = m.group(1).strip()
        json_str = extract_json_block(raw) or raw
        try:
            parsed = json.loads(json_str)
            name = parsed.get('name') or parsed.get('tool') or parsed.get('action')
            args = parsed.get('args') or parsed.get('arguments') or parsed.get('parameters') or {}
            if name:
                return {'name': name, 'args': args}
        except:
            pass

    # 2. JSON direct sans balise <tool_call>
    json_block = extract_json_block(text)
    if json_block:
        try:
            parsed = json.loads(json_block)
            name = parsed.get('name') or parsed.get('tool') or parsed.get('action')
            args = parsed.get('args') or parsed.get('arguments') or parsed.get('parameters') or {}
            if name:
                return {'name': name, 'args': args}
        except:
            pass

    # 3. Appel de fonction syntaxique : tool_name(...)
    func_call = re.search(r'\b(app_launch|app_resolve|web_browse|web_search|web_fetch|file_list|file_read|file_create|folder_create|system_status|screenshot_take|process_verify)\s*\(([^)]*)\)', text, re.I)
    if func_call:
        t_name = func_call.group(1).lower()
        raw_args = func_call.group(2).strip()
        if not raw_args:
            return {'name': t_name, 'args': {}}
        arg_m = re.search(r'["\']([^"\']+)["\']', raw_args)
        val = arg_m.group(1) if arg_m else raw_args.strip()
        arg_key = 'target' if t_name in ['app_launch', 'web_browse', 'web_fetch'] else ('query' if t_name in ['app_resolve', 'web_search'] else 'path')
        return {'name': t_name, 'args': {arg_key: val}}

    # 4. URL détectée avec intention de navigation
    url_m = re.search(r'https?://[^\s"\'`<>]+', text, re.I)
    if url_m and re.search(r'app_launch|web_browse|ouvr|lanc|navig|visit|charg|url', text, re.I):
        return {'name': 'app_launch', 'args': {'target': url_m.group(0)}}

    # 5. Extraction de mention d'outil avec argument dans la pensée
    tool_arg = re.search(r'\b(app_launch|app_resolve|web_browse|file_list|file_read|file_create|folder_create)\b[^.\n]*?(?:avec|sur|pour|target|query|path|chemin)\s*(?:[:=]|["\']|\s+)?\s*(?:target|query|path)?\s*[:=]?\s*["\']?([a-zA-Z0-9_.\-:\\/]+)["\']?', text, re.I)
    if tool_arg:
        t_name = tool_arg.group(1).lower()
        val = tool_arg.group(2).strip().rstrip('.,;)"\'')
        if val and val.lower() not in ['avec', 'sur', 'pour', 'target', 'query', 'path']:
            arg_key = 'target' if t_name in ['app_launch', 'web_browse'] else ('query' if t_name in ['app_resolve'] else 'path')
            return {'name': t_name, 'args': {arg_key: val}}

    # 6. Outils sans arguments
    m_zero = re.search(r'\b(screenshot_take|system_status)\b', text, re.I)
    if m_zero:
        return {'name': m_zero.group(1).lower(), 'args': {}}

    return None

test_cases = [
    # Test 1 : Pensée exacte de l'utilisateur sur la capture d'écran
    '''L'utilisateur veut ouvrir YouTube. YouTube est un site web, pas une application Windows installée. La bonne approche est d'ouvrir https://youtube.com dans le navigateur par défaut. Je n'ai pas besoin de chercher "YouTube" dans le registre. J'utilise app_launch avec l'URL directement.''',
    # Test 2 : Format standard complet
    '''<thought>Je vais lancer Discord</thought>\n<tool_call>{"name": "app_resolve", "args": {"query": "discord"}}</tool_call>''',
    # Test 3 : JSON brut sans balises
    '''Je lance l'action suivante :\n{"name": "app_launch", "args": {"target": "notepad.exe"}}''',
    # Test 4 : Exemple 2 du system prompt
    '''<thought>Firefox est trouve. Je lance app_resolve avec "firefox" comme query courte.</thought>''',
    # Test 5 : Appel fonctionnel
    '''Je vais utiliser app_resolve("spotify") pour trouver le binaire.''',
    # Test 6 : Capture d'écran
    '''L'utilisateur veut une capture d'écran. J'utilise screenshot_take() pour la capturer.''',
    # Test 7 : Statut système
    '''Je vérifie les ressources avec system_status.''',
    # Test 8 : Fichier
    '''Je liste les fichiers avec file_list sur C:\\Users\\zozoo\\Documents.''',
    # Test 9 : Création dossier
    '''Je crée le dossier avec folder_create sur C:\\Users\\zozoo\\Desktop\\Projets.''',
]

print("=== RESULTATS DU PARSEUR ROBUSTE V2 ===")
for i, tc in enumerate(test_cases, 1):
    res = parse_tool_call(tc)
    print(f"Test {i}: {res}")

more_tests = [
    '''<thought>Je vais chercher et lancer calc avec app_resolve("calc").</thought>''',
    '''<thought>Je lance l'application bloc-notes avec app_resolve avec "notepad"</thought>''',
    '''<thought>Je recherche des infos sur google avec web_search("meteo paris")</thought>''',
    '''<thought>Je lis le fichier avec file_read sur C:\\test.txt</thought>''',
]

print("=== TESTS COMPLEMENTAIRES ===")
for i, tc in enumerate(more_tests, 10):
    res = parse_tool_call(tc)
    print(f"Test {i}: {res}")
