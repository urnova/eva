!macro customInit
  ; ═══════════════════════════════════════════════════════
  ; FIX v5.6.10 — Fermeture CIBLÉE d'EVA avant installation
  ; RÈGLES DE SÉCURITÉ :
  ;   - Aucun "$_" dans ce fichier (NSIS l'interpréterait comme variable)
  ;   - Aucun kill générique par chemin court "%EVA%" (tue des apps tierces !)
  ;   - On ne tue QUE les processus portant exactement le nom de l'exe EVA
  ;     ou dont le chemin contient "EVA Assistant" (nom unique de l'installeur)
  ; ═══════════════════════════════════════════════════════

  ; 1. Tuer directement par nom de processus EVA (noms exacts uniquement)
  nsExec::Exec 'taskkill /F /IM "EVA Assistant.exe" /T'
  nsExec::Exec 'taskkill /F /IM "eva-assistant-pc.exe" /T'

  ; 2. Tuer les processus Electron helper orphelins UNIQUEMENT dans le dossier "EVA Assistant"
  ;    Le chemin contient "EVA Assistant" (nom complet) — pas de faux positifs
  nsExec::Exec 'wmic process where "ExecutablePath like ''%EVA Assistant%''" call terminate'

  ; 3. Lire le chemin d'installation depuis le registre EVA et tuer les processus
  ;    appartenant à CE dossier précis seulement
  ;    Note: electron-builder utilise l'AppId GUID dans Uninstall (ex: 7c... ou com.astraltechnologie.eva)
  ReadRegStr $R0 HKLM "SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\com.astraltechnologie.eva" "InstallLocation"
  ${If} $R0 == ""
    ReadRegStr $R0 HKLM "SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\eva-assistant-pc" "InstallLocation"
  ${EndIf}
  ${If} $R0 != ""
    ; Construire la commande wmic avec le chemin interpolé par NSIS
    StrCpy $1 'wmic process where "ExecutablePath like ''$R0\\%''" call terminate'
    nsExec::Exec '$1'
  ${EndIf}

  ; 4. Libérer le port local EVA 45454 — UNIQUEMENT si le processus est lié à EVA
  ;    On écrit un script PS temporaire pour éviter l'interprétation de $ par NSIS
  ;    Dans NSIS : $$ = dollar littéral, $\r$\n = saut de ligne
  GetTempFileName $R2
  FileOpen $R3 "$R2.ps1" w
  FileWrite $R3 "try { foreach ($$c in (Get-NetTCPConnection -LocalPort 45454 -ErrorAction SilentlyContinue)) { $$info = Get-Process -Id $$c.OwningProcess -EA SilentlyContinue; if ($$info -and ($$info.Name -like '*eva*' -or $$info.Name -like '*EVA*')) { Stop-Process -Id $$c.OwningProcess -Force -EA SilentlyContinue } } } catch {}"
  FileClose $R3
  nsExec::Exec 'powershell -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "$R2.ps1"'
  Delete "$R2.ps1"
  Delete "$R2"

  ; 5. Attendre que les processus soient bien tués
  Sleep 1500
!macroend

!include "LogicLib.nsh"

!macro customUninstall
  ; ═══════════════════════════════════════════════════════
  ; FIX v5.6.15 : NE PAS supprimer userData/models
  ; Le modele LLM (2 Go) persiste apres desinstallation ET mises a jour.
  ; L'utilisateur peut le supprimer manuellement si besoin.
  ; ═══════════════════════════════════════════════════════
  ; (aucune suppression -- le modele est conserve intentionnellement)
!macroend

!macro customInstall
  ; 1. Si un ancien dossier backup temporaire existait (suite a un crash d'une ancienne version), restaurer le fichier
  ${If} ${FileExists} "$INSTDIR-models-backup"
    ${If} ${FileExists} "$INSTDIR-models-backup\EVA-PC-Agentic-3B-Q4_K_M-v5.gguf"
      CreateDirectory "$INSTDIR\resources\models"
      CopyFiles /SILENT "$INSTDIR-models-backup\EVA-PC-Agentic-3B-Q4_K_M-v5.gguf" "$INSTDIR\resources\models\"
    ${EndIf}
    RMDir /r "$INSTDIR-models-backup"
  ${EndIf}

  ; 2. S'assurer que le dossier resources\models existe dans le repertoire d'installation
  StrCpy $0 "$INSTDIR\resources\models"
  CreateDirectory "$0"

  ; 3. Nettoyer les eventuels fichiers temporaires incomplets
  Delete "$0\EVA-PC-Agentic-3B-Q4_K_M-v5.gguf.tmp"
  Delete "$0\EVA-PC-Agentic-3B-Q4_K_M-v5.gguf.part"

  ; Le modele LLM est desormais telecharge a la demande depuis l'application (CloudWorks)
  ; pour une installation ultra-rapide (en quelques secondes).
!macroend
