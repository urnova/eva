!macro customInit
  ; 1. Forcer la fermeture de toute instance de l'application ou sous-processus residuel
  nsExec::Exec 'taskkill /F /IM "EVA Assistant.exe" /T'
  nsExec::Exec 'taskkill /F /IM "eva-assistant.exe" /T'
  nsExec::Exec 'taskkill /F /IM "EVA Assistant.exe"'
  Sleep 600

  ; 2. Sauvegarder le dossier models hors du repertoire INSTDIR des le lancement de l'installateur (pour proteger contre l'ancien desinstallateur)
  ${If} ${FileExists} "$INSTDIR\resources\models"
    Rename "$INSTDIR\resources\models" "$INSTDIR-models-backup"
    DetailPrint "Sauvegarde du modele LLM locale terminee (depuis customInit)."
  ${EndIf}
!macroend

!macro customUnInit
  ; Sauvegarder le dossier models hors du repertoire INSTDIR avant la desinstallation
  ${If} ${FileExists} "$INSTDIR\resources\models"
    Rename "$INSTDIR\resources\models" "$INSTDIR-models-backup"
    DetailPrint "Sauvegarde du modele LLM locale terminee (mise a jour)."
  ${EndIf}
!macroend

!include "LogicLib.nsh"

!macro customInstall

  ; Restaurer la sauvegarde des modeles si elle existe
  ${If} ${FileExists} "$INSTDIR-models-backup"
    CreateDirectory "$INSTDIR\resources"
    Rename "$INSTDIR-models-backup" "$INSTDIR\resources\models"
    DetailPrint "Restauration du modele LLM local terminee."
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
