#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Patch main.ts : ajouter les handlers IPC pour PWA detection + shell:open
"""

path = r'f:\code\eva\evaprojectmultiplatforme\eva-pc\electron\main.ts'
with open(path, encoding='utf-8') as f:
    mt = f.read()

import re

# Vérifier si déjà patché
if 'pwa:detect' in mt:
    print('pwa:detect déjà présent, skip')
else:
    # Trouver la fin du fichier ou avant les exports
    # On insère après le dernier ipcMain.handle (tts:stop)
    # Trouver la position de fin de tts:stop handler
    idx_tts_stop = mt.rfind("ipcMain.handle('tts:stop'")
    if idx_tts_stop < 0:
        print('ERREUR: tts:stop non trouvé')
        exit(1)
    
    # Trouver la } correspondante
    zone = mt[idx_tts_stop:]
    depth = 0
    end_rel = -1
    in_handler = False
    for i, ch in enumerate(zone):
        if ch == '{':
            depth += 1
            in_handler = True
        elif ch == '}' and in_handler:
            depth -= 1
            if depth == 0:
                end_rel = i
                break
    
    insert_pos = idx_tts_stop + end_rel + 1
    print(f'Insertion après tts:stop, pos {insert_pos}')
    
    # Vérifier si execSync/exec est déjà importé
    has_exec = 'execSync' in mt
    print(f'execSync déjà importé: {has_exec}')
    
    pwa_handler = '''

// ─── PWA Detection (FIX v5.6.11) ────────────────────────────────────────────
ipcMain.handle('pwa:detect', async (_e: any, args: any) => {
  const name: string = (args && args.name) ? args.name.toLowerCase() : '';
  const url: string  = (args && args.url)  ? args.url  : '';
  try {
    const { execSync } = require('child_process');
    // Chercher les PWA Chrome/Edge dans le registre Windows
    // Chrome stocke les PWA sous HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall
    // Edge aussi. On cherche par nom ou domaine.
    const regOutput = execSync(
      'reg query "HKCU\\\\Software\\\\Microsoft\\\\Windows\\\\CurrentVersion\\\\Uninstall" /s /f "' +
      (name || 'App') + '" 2>nul',
      { encoding: 'utf-8', timeout: 3000 }
    );
    if (regOutput && regOutput.trim()) {
      // Extraire le DisplayName et le chemin d'exécution
      const lines = regOutput.split('\\n');
      let execPath: string | null = null;
      for (const line of lines) {
        if (line.trim().startsWith('DisplayIcon') || line.trim().startsWith('DisplayName')) {
          const parts = line.split('REG_SZ');
          if (parts[1]) {
            const val = parts[1].trim();
            if (val.endsWith('.exe') || val.includes('.exe,')) {
              execPath = val.split(',')[0].trim();
              break;
            }
          }
        }
      }
      return { found: true, execPath };
    }
    return { found: false, execPath: null };
  } catch (err: any) {
    // Pas de PWA trouvée ou reg indisponible
    return { found: false, execPath: null };
  }
});

// ─── shell:open (FIX v5.6.11) ────────────────────────────────────────────────
ipcMain.handle('shell:open', async (_e: any, args: any) => {
  const { shell } = require('electron');
  const path: string = args && args.path ? args.path : '';
  if (!path) return { success: false };
  try {
    await shell.openPath(path);
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
});
'''
    
    mt = mt[:insert_pos] + pwa_handler + mt[insert_pos:]
    print('IPC pwa:detect + shell:open ajoutés OK')

with open(path, 'w', encoding='utf-8') as f:
    f.write(mt)
print('main.ts sauvegardé')
