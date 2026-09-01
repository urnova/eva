import sys
sys.stdout.reconfigure(encoding='utf-8')

files = [
    r'f:\code\eva\evaprojectmultiplatforme\EVA_V4_fixed_v4\js\app\file-gen.js',
    r'f:\code\eva\evaprojectmultiplatforme\eva-pc\web\js\app\file-gen.js',
]

OLD = "    } else if (action.type === 'pdf') {\n      _evaGeneratePdf(action);"
NEW = "    } else if (action.type === 'pdf') {\n      _evaGenerateHtmlPdf(action);"

for path in files:
    with open(path, 'r', encoding='utf-8') as f:
        c = f.read()

    if OLD in c:
        c = c.replace(OLD, NEW)
        print('OK:', path)
    else:
        print('NOT FOUND:', path)

    with open(path, 'w', encoding='utf-8') as f:
        f.write(c)

print('done')
