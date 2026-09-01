import sys, re
sys.stdout.reconfigure(encoding='utf-8')

files = [
    r'f:\code\eva\evaprojectmultiplatforme\EVA_V4_fixed_v4\js\app\messages.js',
    r'f:\code\eva\evaprojectmultiplatforme\eva-pc\web\js\app\messages.js',
]

for path in files:
    with open(path, 'r', encoding='utf-8') as f:
        c = f.read()

    # Replace marp_pptx action type with new pptx format
    # Match the whole PowerPoint instruction line regardless of exact surrounding
    pptx_pat = re.compile(
        r"'- PowerPoint \(Marp\)[^']*marp_pptx[^']*?'",
        re.DOTALL
    )
    pdf_pat = re.compile(
        r"'- PDF \(Marp\)[^']*marp_pdf[^']*?'",
        re.DOTALL
    )

    new_pptx = """'- PowerPoint \\\\u2192 [ACTION:{"type":"pptx","filename":"nom_descriptif.pptx","title":"Titre","slides":[{"title":"Titre slide 1","points":["Point 1","Point 2","Point 3"]},{"title":"Slide 2","content":"Texte libre pour cette slide"},{"title":"Conclusion","points":["Bilan A","Bilan B"]}]}]\\\\n'"""

    new_pdf = """'- PDF \\\\u2192 [ACTION:{"type":"pdf","filename":"nom_descriptif.pdf","content":"<!DOCTYPE html><html><head><meta charset=\\'utf-8\\'><style>body{font-family:Georgia,serif;color:#1a1a1a;line-height:1.75;font-size:14px}h1{color:#1a2e5a;border-bottom:3px solid #3498db;padding-bottom:10px;margin-top:0}h2{color:#2c3e50;margin-top:24px}p{margin:10px 0}ul,ol{padding-left:22px}table{width:100%;border-collapse:collapse;margin:16px 0}th{background:#3498db;color:white;padding:10px;text-align:left}td{padding:8px;border:1px solid #ddd}td:first-child{font-weight:bold}</style></head><body><h1>Titre du document</h1><p>Contenu COMPLET ici.</p></body></html>"}]\\\\n'"""

    changed = []
    if pptx_pat.search(c):
        c = pptx_pat.sub(new_pptx, c)
        changed.append('pptx')
    else:
        print('  WARN pptx regex not matched in', path[-40:])

    if pdf_pat.search(c):
        c = pdf_pat.sub(new_pdf, c)
        changed.append('pdf')
    else:
        print('  WARN pdf regex not matched in', path[-40:])

    with open(path, 'w', encoding='utf-8') as f:
        f.write(c)
    print('OK', changed, path[-50:])

print('done')
