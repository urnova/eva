!include "LogicLib.nsh"
!include "FileFunc.nsh"

!macro customInstall
  ; === Repertoire persistant dans ProgramData (stable en mode admin perMachine) ===
  StrCpy $0 "$COMMONAPPDATA\PC EVA\models"
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
    MessageBox MB_ICONSTOP "Impossible de telecharger le modele LLM.$\r$\nErreur : $4$\r$\nVous pourrez relancer l'installation pour reessayer."
    Goto model_done
  ${EndIf}

  ${IfNot} ${FileExists} "$2"
    MessageBox MB_ICONSTOP "Telechargement echoue : fichier introuvable."
    Goto model_done
  ${EndIf}

  ${GetSize} "$2" "/S=0K" $3 $4 $5
  ${If} $3 <= 0
    Delete "$2"
    MessageBox MB_ICONSTOP "Telechargement echoue : fichier vide."
    Goto model_done
  ${EndIf}

  Rename "$2" "$1"
  DetailPrint "Modele telecharge avec succes ($3 Ko) : $1"

model_done:
!macroend
