# -*- coding: utf-8 -*-
import re

paths = [
    r'f:\code\eva\evaprojectmultiplatforme\EVA_V4_fixed_v4\js\features\cloudworks.js',
    r'f:\code\eva\evaprojectmultiplatforme\eva-pc\web\js\features\cloudworks.js'
]

for path in paths:
    with open(path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # We want to replace "var online = d.online === true;"
    replacement = '''    var online = d.online === true;
    if (online && d.lastSeen && d.lastSeen.toDate) {
      var diffMs = Date.now() - d.lastSeen.toDate().getTime();
      if (diffMs > 120000) { // 2 minutes timeout
        online = false;
        d.online = false;
      }
    }'''
    
    content = content.replace('var online = d.online === true;', replacement)
    
    with open(path, 'w', encoding='utf-8') as f:
        f.write(content)
