!macro customInit
  ; Sauvegarder le dossier models hors du repertoire INSTDIR des le lancement de l'installateur (pour proteger contre l'ancien desinstallateur)
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

  ; === Dossier models dans le repertoire d'installation choisi par l'utilisateur ===
  StrCpy $0 "$INSTDIR\resources\models"
  CreateDirectory "$0"

  StrCpy $1 "$0\EVA-PC-Agentic-3B-Q4_K_M-v5.gguf"
  StrCpy $2 "$0\EVA-PC-Agentic-3B-Q4_K_M-v5.gguf.part"

  ; === Verification : modele deja present et non vide (au moins 100 Mo) ===
  ${If} ${FileExists} "$1"
    ClearErrors
    FileOpen $R8 "$1" r
    ${IfNot} ${Errors}
      FileSeek $R8 0 END $3
      FileClose $R8
      ${If} $3 > 100000000
        DetailPrint "Modele LLM deja present : $1"
        Goto model_done
      ${EndIf}
    ${EndIf}
    Delete "$1"
  ${EndIf}

  Delete "$2"
  DetailPrint "Telechargement du modele LLM EVA V5 depuis Hugging Face..."

  ; === Token Hugging Face (obfusque) ===
  StrCpy $R0 "hf_"
  StrCpy $R1 "HHJeFQtG"
  StrCpy $R2 "LjWyDsoe"
  StrCpy $R3 "IbKuzGSj"
  StrCpy $R4 "hLcyEczyin"
  StrCpy $R5 "$R0$R1$R2$R3$R4"

  ; === Telechargement via NScurl (TLS 1.3, redirects, gros fichiers) ===
  NScurl::http GET \
    "https://huggingface.co/astraltech/EVA-PC-Agentic-3B-Q4_K_M-v5/resolve/main/EVA-PC-Agentic-3B-Q4_K_M-v5.gguf" \
    "$2" \
    /HEADER "Authorization: Bearer $R5" \
    /END

  Pop $4

  ${If} $4 != "OK"
    Delete "$2"
    MessageBox MB_ICONSTOP "Impossible de telecharger le modele LLM.$\r$\nErreur : $4$\r$\nRelancez l'installation pour reessayer."
    Goto model_done
  ${EndIf}

  ${IfNot} ${FileExists} "$2"
    MessageBox MB_ICONSTOP "Telechargement echoue : fichier introuvable."
    Goto model_done
  ${EndIf}

  ; === Verification de la taille avec FileSeek (natif et fiable) ===
  ClearErrors
  FileOpen $R8 "$2" r
  ${If} ${Errors}
    Delete "$2"
    MessageBox MB_ICONSTOP "Telechargement echoue : impossible d'ouvrir le fichier."
    Goto model_done
  ${EndIf}

  FileSeek $R8 0 END $3
  FileClose $R8

  ; Verifier que le fichier fait au moins 100 Mo (100000000 octets)
  ${If} $3 < 100000000
    Delete "$2"
    MessageBox MB_ICONSTOP "Telechargement echoue : fichier incomplet."
    Goto model_done
  ${EndIf}

  Rename "$2" "$1"
  DetailPrint "Modele telecharge avec succes : $1"

model_done:
!macroend
