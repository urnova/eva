!macro customInit
  ; ═══════════════════════════════════════════════════════
  ; FIX v5.6.2 — Fermeture COMPLÈTE d'EVA avant installation
  ; Tue tous les processus liés à EVA (tray inclus)
  ; ═══════════════════════════════════════════════════════

  ; 1. Envoyer un signal de quit propre à l'app via le protocole custom
  ;    (au cas où EVA est en cours et peut gérer le quit)
  nsExec::Exec 'taskkill /F /IM "EVA Assistant.exe" /T'
  nsExec::Exec 'taskkill /F /IM "eva-assistant.exe" /T'
  nsExec::Exec 'taskkill /F /IM "EVA.exe" /T'

  ; 2. Tuer les processus Electron helper/GPU orphelins liés à EVA
  ;    (ces processus ne portent pas le nom EVA mais tournent dans le dossier d'installation)
  nsExec::ExecToStack 'wmic process where "ExecutablePath like ''%EVA Assistant%''" get ProcessId /format:csv'
  Pop $0  ; code retour
  Pop $1  ; output (liste des PIDs)

  ; 3. Tuer explicitement par chemin d'installation
  ReadRegStr $R0 HKLM "SOFTWARE\EVA Assistant" "InstallLocation"
  ${If} $R0 != ""
    nsExec::Exec 'wmic process where "ExecutablePath like ''%$R0%''" call terminate'
  ${EndIf}

  ; 4. Fallback : tuer tous les electron.exe qui tournent depuis le dossier EVA
  nsExec::Exec 'powershell -NoProfile -NonInteractive -Command "Get-Process | Where-Object { $_.Path -like ''*EVA*'' } | Stop-Process -Force -ErrorAction SilentlyContinue"'
  nsExec::Exec 'powershell -NoProfile -NonInteractive -Command "Get-Process | Where-Object { $_.MainWindowTitle -like ''*EVA*'' } | Stop-Process -Force -ErrorAction SilentlyContinue"'

  ; 5. Libérer le port local EVA si encore occupé
  nsExec::Exec 'powershell -NoProfile -NonInteractive -Command "netstat -ano | Where-Object { $_ -match '':45454'' } | ForEach-Object { $pid = ($_ -split \s+)[-1]; Stop-Process -Id $pid -Force -ErrorAction SilentlyContinue }"'

  ; 6. Attendre que les processus soient bien tués
  Sleep 1500
!macroend

!include "LogicLib.nsh"

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
