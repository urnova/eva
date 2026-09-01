import sys
sys.stdout.reconfigure(encoding='utf-8')

def check(path, name):
    with open(path, 'r', encoding='utf-8') as f:
        c = f.read()
    print(f'\n=== {name} ===')
    print('  pdf -> _evaGenerateHtmlPdf:', '_evaGenerateHtmlPdf(action)' in c and "action.type === 'pdf'" in c)
    print('  _evaGenerateHtmlPdf defined:', 'function _evaGenerateHtmlPdf' in c)
    print('  PptxGenJS used:', 'new PptxGenJS()' in c)
    print('  _evaGeneratePptx rewritten:', 'pptx.layout' in c)
    print('  No old marp_pptx rename:', "action.type = 'marp_pptx'" not in c)

check(r'f:\code\eva\evaprojectmultiplatforme\EVA_V4_fixed_v4\js\app\file-gen.js', 'WEB file-gen.js')
check(r'f:\code\eva\evaprojectmultiplatforme\eva-pc\web\js\app\file-gen.js', 'PC file-gen.js')

def check_core(path, name):
    with open(path, 'r', encoding='utf-8') as f:
        c = f.read()
    print(f'\n=== {name} ===')
    print('  HTML viewer uses iframe:', "doc.ext === 'html'" in c and 'iframe.src = doc.url' in c)
    print('  PDF type:pdf instruction:', 'type":"pdf"' in c or "type:\"pdf\"" in c)
    print('  New PPTX instruction with content field:', '"content":"Texte libre' in c)
    print('  No pdf code block instruction:', "Utilise simplement le bloc de code markdown suivant" not in c)

check_core(r'f:\code\eva\evaprojectmultiplatforme\EVA_V4_fixed_v4\js\app\core.js', 'WEB core.js')
check_core(r'f:\code\eva\evaprojectmultiplatforme\eva-pc\web\js\app\core.js', 'PC core.js')

print('\nAll checks done')
