# -*- coding: utf-8 -*-
paths = [
    r'f:\code\eva\evaprojectmultiplatforme\EVA_V4_fixed_v4\js\features\pc-agent.js',
    r'f:\code\eva\evaprojectmultiplatforme\eva-pc\web\js\features\pc-agent.js'
]
for path in paths:
    with open(path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    content = content.replace(\"deviceName: isDev ? 'EVA Desktop (Dev)' : 'EVA Desktop',\", \"deviceName: 'EVA Desktop',\\n          sessionId: window.S.sessionId || null,\")
    
    with open(path, 'w', encoding='utf-8') as f:
        f.write(content)
