import re

tests = [
    '''L'utilisateur veut ouvrir YouTube. YouTube est un site web, pas une application Windows installee. La bonne approche est d'ouvrir https://youtube.com dans le navigateur par defaut. Je n'ai pas besoin de chercher "YouTube" dans le registre. J'utilise app_launch avec l'URL directement.''',
    '''Je vais utiliser app_resolve avec "discord" comme query courte.''',
    '''Je vais utiliser app_resolve avec "calc"''',
    '''J'utilise app_launch pour ouvrir C:\\Windows\\notepad.exe''',
    '''J'appelle screenshot_take() pour capturer l'ecran.''',
    '''Je vais creer un fichier avec file_create sur C:\\Users\\zozoo\\Desktop\\test.txt avec "bonjour".''',
    '''Je liste les fichiers avec file_list sur C:\\Users\\zozoo\\Documents.''',
]

print("--- TEST ACTUEL ---")
old_pattern = re.compile(r'(app_launch|app_resolve|web_browse|file_list|file_create|system_status)\s*(?:\(|avec\s+target\s*[:=]?\s*["\']?|\s*["\'])([a-zA-Z0-9_.\-\\/:\s]+)', re.I)
for t in tests:
    m = old_pattern.search(t)
    print("Match:", m.groups() if m else None)
