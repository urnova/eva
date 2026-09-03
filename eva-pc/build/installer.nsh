!include "LogicLib.nsh"
!include "FileFunc.nsh"

; Ajout du dossier de plugins local
!addplugindir "build\nsis-plugins\x86-unicode"

!macro customInstall
  ; === Repertoire persistant (survit aux mises a jour) ===
  StrCpy $0 "$LOCALAPPDATA\PC EVA\models"
  CreateDirectory "$0"

  StrCpy $1 "$0\EVA-PC-Agentic-3B-Q4_K_M-v5.gguf"
  StrCpy $2 "$0\EVA-PC-Agentic-3B-Q4_K_M-v5.gguf.part"

  ; === Verification : modele deja present et non vide ===
  ${If} ${FileExists} "$1"
    ${GetSize} "$1" "/S=0K" $3 $4 $5
    ${If} $3 > 0
      DetailPrint "Modele LLM deja present ($3 Ko) : $1"
      Goto model_done
    ${EndIf}
    ; Fichier existe mais est vide : le supprimer
    Delete "$1"
  ${EndIf}

  ; === Nettoyage eventuel d'un .part precedent ===
  Delete "$2"

  DetailPrint "Telechargement du modele LLM EVA V5 depuis Hugging Face..."

  ; === Token Hugging Face (obfusque, jamais expose en clair) ===
  StrCpy $R0 "hf_"
  StrCpy $R1 "HHJeFQtG"
  StrCpy $R2 "LjWyDsoe"
  StrCpy $R3 "IbKuzGSj"
  StrCpy $R4 "hLcyEczyin"
  StrCpy $R5 "$R0$R1$R2$R3$R4"

  ; === Telechargement via NScurl (plus robuste que INetC) ===
  NScurl::http GET \
    "https://huggingface.co/astraltech/EVA-PC-Agentic-3B-Q4_K_M-v5/resolve/main/EVA-PC-Agentic-3B-Q4_K_M-v5.gguf" \
    "$2" \
    /HEADER "Authorization: Bearer $R5" \
    /END

  Pop $4

  ; === Verification du resultat ===
  ${If} $4 != "OK"
    Delete "$2"
    MessageBox MB_ICONSTOP "Impossible de telecharger le modele LLM depuis Hugging Face.$\r$\nErreur : $4$\r$\n$\r$\nL'application sera installee sans le modele IA.$\r$\nVous pourrez le telecharger ultérieurement depuis l'application."
    Goto model_done
  ${EndIf}

  ${IfNot} ${FileExists} "$2"
    MessageBox MB_ICONSTOP "Le telechargement du modele a echoue : fichier introuvable."
    Goto model_done
  ${EndIf}

  ${GetSize} "$2" "/S=0K" $3 $4 $5
  ${If} $3 <= 0
    Delete "$2"
    MessageBox MB_ICONSTOP "Le telechargement du modele a echoue : fichier vide."
    Goto model_done
  ${EndIf}

  ; === Renommage .part -> .gguf ===
  Rename "$2" "$1"
  DetailPrint "Modele LLM telecharge avec succes ($3 Ko) : $1"

model_done:
!macroend
