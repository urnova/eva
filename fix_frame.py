import re

with open('eva-pc/electron/main.ts', 'r', encoding='utf-8') as f:
    content = f.read()

# Replace first frame: false
content = re.sub(r'frame:\s*false,\s*//.*', 'frame: true,', content, count=1)

with open('eva-pc/electron/main.ts', 'w', encoding='utf-8') as f:
    f.write(content)
print('Fixed frame')
