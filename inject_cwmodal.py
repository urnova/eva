import sys
sys.stdout.reconfigure(encoding='utf-8')
with open(r'eva-pc/web/chat.html', 'r', encoding='utf-8') as f:
    c = f.read()

# Insert cw-modal.js right after pc-agent.js
OLD = 'features/pc-agent.js"></script>'
NEW = 'features/pc-agent.js"></script>\n<script src="/js/features/cw-modal.js"></script>'

if OLD in c:
    c = c.replace(OLD, NEW, 1)
    print('Inserted cw-modal.js after pc-agent.js')
else:
    print('WARN: tag not found, searching...')
    idx = c.find('pc-agent.js')
    print(repr(c[idx-10:idx+60]))

with open(r'eva-pc/web/chat.html', 'w', encoding='utf-8') as f:
    f.write(c)
print('Done')
