import sys
sys.stdout.reconfigure(encoding='utf-8')

with open(r'eva-pc/web/js/features/pc-agent.js', 'r', encoding='utf-8', errors='replace') as f:
    pa = f.read()

# Find start and end of runAgenticLoop
start = pa.find('  async function runAgenticLoop')
# Find the end - look for next top-level comment or function
end1 = pa.find('\n  // Démarrer dès que', start)
end2 = pa.find('\n  // Exposer', start)
end = min(x for x in [end1, end2] if x > 0)

print(f'start={start}, end={end}')
print('Old function:')
print(pa[start:start+200])
print('...')
print('End marker:')
print(pa[end:end+80])
