import re

with open(r'f:\code\eva\evaprojectmultiplatforme\eva-pc\web\chat.html', encoding='utf-8', errors='replace') as f:
    c = f.read()

scripts = re.findall(r'<script[^>]*src=["\']([^"\']*)["\']', c)
print('Scripts CW charges dans chat.html:')
for s in scripts:
    if 'cw' in s.lower() or 'cloud' in s.lower():
        print(' -', s)
print()
print('cw-modal.js:', 'cw-modal.js' in c)
print('cw-modal-enhanced.js:', 'cw-modal-enhanced.js' in c)
print('cw-tools.js:', 'cw-tools.js' in c)
print('cw-agent.js:', 'cw-agent.js' in c)
print('cw-engine.js:', 'cw-engine.js' in c)
print('pc-bridge.js:', 'pc-bridge.js' in c)
