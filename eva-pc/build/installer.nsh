!macro customInit
  ; Fermeture rapide et ciblée d'EVA avant installation (sans wmic ni PowerShell lents)
  nsExec::Exec 'taskkill /F /IM "EVA Assistant.exe" /T'
  nsExec::Exec 'taskkill /F /IM "eva-assistant-pc.exe" /T'
  Sleep 500
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

!macro customFinishPage
  Function CustomStartApp
    ${if} ${isUpdated}
      StrCpy $1 "--updated"
    ${else}
      StrCpy $1 ""
    ${endif}
    ${StdUtils.ExecShellAsUser} $0 "$launchLink" "open" "$1"
  FunctionEnd

  Function finishPagePre
    ${if} ${isUpdated}
      Call CustomStartApp
      Abort
    ${endif}
  FunctionEnd

  !define MUI_PAGE_CUSTOMFUNCTION_PRE finishPagePre
  !ifndef HIDE_RUN_AFTER_FINISH
    !define MUI_FINISHPAGE_RUN
    !define MUI_FINISHPAGE_RUN_FUNCTION "CustomStartApp"
  !endif
  !insertmacro MUI_PAGE_FINISH
!macroend
