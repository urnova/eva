!macro customInit
  ; ═══════════════════════════════════════════════════════
  ; FIX v5.6.7 — Fermeture COMPLÈTE d'EVA avant installation
  ; IMPORTANT : aucun "$_" dans ce fichier — NSIS l'interpréterait
  ;             comme variable NSIS et génèrerait un warning fatal.
  ;             On utilise wmic et netstat/taskkill à la place de PowerShell $_ pipelines.
  ; ═══════════════════════════════════════════════════════

  ; 1. Tuer directement par nom de processus
  nsExec::Exec 'taskkill /F /IM "EVA Assistant.exe" /T'
  nsExec::Exec 'taskkill /F /IM "eva-assistant.exe" /T'
  nsExec::Exec 'taskkill /F /IM "EVA.exe" /T'

  ; 2. Tuer les processus Electron helper/GPU orphelins liés à EVA
  ;    (ces processus ne portent pas le nom EVA mais tournent dans le dossier d'installation)
  nsExec::ExecToStack 'wmic process where "ExecutablePath like ''%EVA Assistant%''" get ProcessId /format:csv'
  Pop $0  ; code retour
  Pop $1  ; output (liste des PIDs)

  ; 3. Tuer explicitement par chemin d'installation (wmic, sans PowerShell $_)
  ReadRegStr $R0 HKLM "SOFTWARE\EVA Assistant" "InstallLocation"
  ${If} $R0 != ""
    nsExec::Exec 'wmic process where "ExecutablePath like ''%EVA Assistant%''" call terminate'
  ${EndIf}

  ; 4. Fallback wmic par chemin générique EVA (sans PowerShell $_ — wmic natif)
  nsExec::Exec 'wmic process where "ExecutablePath like ''%EVA%''" call terminate'

  ; 5. Libérer le port local EVA 45454 (PowerShell sans $_ — accès direct à la propriété)
  nsExec::Exec 'powershell -NoProfile -NonInteractive -Command "Stop-Process -Id (Get-NetTCPConnection -LocalPort 45454 -ErrorAction SilentlyContinue).OwningProcess -Force -ErrorAction SilentlyContinue"'

  ; 6. Attendre que les processus soient bien tués
  Sleep 1500
!macroend

!include "LogicLib.nsh"

!macro customUninstall
  ; ═══════════════════════════════════════════════════════
  ; Nettoyage du modèle LLM stocké dans AppData à la désinstallation
  ; Le modèle est dans %APPDATA%\eva-assistant-pc\models\
  ; ═══════════════════════════════════════════════════════
  ReadEnvStr $R1 APPDATA
  ; IfFileExists est la syntaxe NSIS native correcte (pas ${If} ${DirExists})
  IfFileExists "$R1\eva-assistant-pc\models\*.*" 0 +2
    RMDir /r "$R1\eva-assistant-pc\models"
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
