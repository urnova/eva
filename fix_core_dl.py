import sys
sys.stdout.reconfigure(encoding='utf-8')

for path in [
    r'f:\code\eva\evaprojectmultiplatforme\EVA_V4_fixed_v4\js\app\core.js',
    r'f:\code\eva\evaprojectmultiplatforme\eva-pc\web\js\app\core.js',
]:
    with open(path, 'r', encoding='utf-8') as f:
        c = f.read()

    idx = c.find("if (doc2.ext === 'pdf')")
    if idx < 0:
        print('NOT FOUND pdf check in', path[-40:]); continue

    # Find the closing }  of this if block
    end_idx = c.find('\n  }', idx)
    if end_idx < 0:
        print('Cannot find end of pdf block in', path[-40:]); continue

    old_block = c[idx:end_idx+4]  # include the '  }' and newline
    print('OLD BLOCK:')
    print(repr(old_block))

    new_block = """if (doc2.ext === 'pdf') {
    /* Use html2pdf.js to generate a true PDF matching the viewer */
    if (typeof _downloadHtmlAsPdf === 'function') {
      _downloadHtmlAsPdf(doc2.url, doc2.name);
    } else {
      var w = window.open(doc2.url, '_blank');
      if (w) { w.onload = function() { setTimeout(function(){ w.print(); }, 400); }; }
    }
    return;
  }"""

    c = c[:idx] + new_block + c[end_idx+4:]

    with open(path, 'w', encoding='utf-8') as f:
        f.write(c)
    print('OK:', path[-50:])

print('done')
