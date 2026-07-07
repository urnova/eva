import re

with open('eva-pc/electron/main.ts', 'r', encoding='utf-8') as f:
    content = f.read()

# Fix window controls
content = content.replace("titleBarStyle: 'hidden',", "titleBarStyle: 'hidden',\n      titleBarOverlay: {\n        color: '#111113',\n        symbolColor: '#7b8bf5',\n        height: 32\n      },")
content = re.sub(r'frame:\s*false,\s*//\s*Fenêtre sans bordure native', 'frame: true, // Re-enabled for titleBarOverlay', content)

with open('eva-pc/electron/main.ts', 'w', encoding='utf-8') as f:
    f.write(content)
print('Fixed main.ts')
