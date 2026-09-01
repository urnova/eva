import sys
sys.stdout.reconfigure(encoding='utf-8')

with open(r'eva-pc/web/js/features/pc-agent.js', 'r', encoding='utf-8', errors='replace') as f:
    pa = f.read()

with open(r'new_agent_loop.js', 'r', encoding='utf-8') as f:
    new_loop = f.read()

# Replace from start of runAgenticLoop to before the "Démarrer dès que" comment
start = pa.find('  async function runAgenticLoop')
end = pa.find('\n  // Démarrer dès que', start)

if start < 0 or end < 0:
    print(f'ERROR: start={start}, end={end}')
    sys.exit(1)

pa = pa[:start] + new_loop + '\n' + pa[end:]
print(f'Replaced runAgenticLoop (chars {start}-{end})')

with open(r'eva-pc/web/js/features/pc-agent.js', 'w', encoding='utf-8') as f:
    f.write(pa)

# Verify
with open(r'eva-pc/web/js/features/pc-agent.js', 'r', encoding='utf-8') as f:
    c = f.read()
print('_buildFallbackPowerShell in file:', '_buildFallbackPowerShell' in c)
print('runAgenticLoop in file:', 'runAgenticLoop' in c)
print('Mode direct in file:', 'Mode direct' in c)
print('DONE')
