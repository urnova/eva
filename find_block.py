import sys
sys.stdout.reconfigure(encoding='utf-8')

path = r'eva-pc\web\js\app\messages.js'
with open(path, 'r', encoding='utf-8') as f:
    c = f.read()

# Find the exact block to replace - the CloudWorks+window.eva section
OLD = """  if (window.eva) {
      userCtx += '\\nNOTE IMPORTANTE : Tu tournes actuellement SUR l\\'application PC locale E.V.A Desktop (pas sur le web). Tu AS un accès direct à ce système via tes outils.\\n';
  } else {
      userCtx += '\\nNOTE IMPORTANTE : Tu tournes actuellement sur la version Web / Mobile. Tu n\\'est pas sur le PC localement. Pour agir sur le PC, tu dois impérativement utiliser l\\'outil Tâche PC vers un noeud CloudWorks En Ligne."""

# Let's just find and print the full else block to know what to replace
idx = c.find("if (window.eva) {")
if idx >= 0:
    print("Found 'if (window.eva)' at:", idx)
    end = c.find('\n  }', idx+20)
    end2 = c.find('\n  }', end+5)
    print(repr(c[idx:end2+5]))
else:
    print("Not found")
