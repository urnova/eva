# -*- coding: utf-8 -*-
import io

# 1. Nettoyer providers.js
p_path = r'f:\code\eva\evaprojectmultiplatforme\eva-pc\web\js\ai\providers.js'
with io.open(p_path, 'r', encoding='utf-8') as f:
    p_code = f.read()

# Rechercher le bloc fallback Pollinations
start_marker = '// FIX v5.6.21: Fallback automatique et transparent sur Pollinations'
end_marker = 'return {\n            success: false,\n            error: \'Crédits Puter épuisés. Basculez sur Pollinations (gratuit) dans Paramètres → IA.\'\n          };\n        }'

idx1 = p_code.find(start_marker)
if idx1 != -1:
    idx2 = p_code.find(end_marker, idx1)
    if idx2 != -1:
        end_idx = idx2 + len(end_marker)
        p_code = p_code[:idx1] + p_code[end_idx:]
        with io.open(p_path, 'w', encoding='utf-8') as f:
            f.write(p_code)
        print("Fallback Pollinations retire de providers.js !")
    else:
        print("Erreur: end_marker introuvable dans providers.js")
else:
    print("start_marker introuvable dans providers.js")

# 2. Nettoyer memory.js (enlever l'injection Pollinations forcee)
m_path = r'f:\code\eva\evaprojectmultiplatforme\eva-pc\web\js\app\memory.js'
with io.open(m_path, 'r', encoding='latin-1') as f:
    m_code = f.read()

m_marker = '/* FIX v5.6.21: Pollinations gratuit en priorite pour la memoire (zero credit consomme) */'
m_idx = m_code.find(m_marker)
if m_idx != -1:
    m_end_marker = '/* Tentative 2 (fallback) : Puter AI si pas deja resolu */'
    m_end_idx = m_code.find(m_end_marker, m_idx)
    if m_end_idx != -1:
        m_code = m_code[:m_idx] + m_code[m_end_idx:]
        with io.open(m_path, 'w', encoding='latin-1') as f:
            f.write(m_code)
        print("Pollinations prioritaire retire de memory.js !")
    else:
        print("m_end_marker introuvable dans memory.js")
else:
    print("m_marker introuvable dans memory.js")
