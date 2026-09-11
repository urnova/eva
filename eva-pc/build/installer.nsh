!macro customInit
  ; 1. Forcer la fermeture de toute instance de l'application ou sous-processus residuel
  nsExec::Exec 'taskkill /F /IM "EVA Assistant.exe" /T'
  nsExec::Exec 'taskkill /F /IM "eva-assistant.exe" /T'
  nsExec::Exec 'taskkill /F /IM "EVA Assistant.exe"'
  Sleep 600
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
