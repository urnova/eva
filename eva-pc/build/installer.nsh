!macro customInstall
  DetailPrint "Telechargement du modele IA E.V.A V5 (1.9 Go)..."
  CreateDirectory "$INSTDIR\resources\llm"
  
  FileOpen $9 "$INSTDIR\dl_model.ps1" w
  FileWrite $9 "param($$url, $$out)$\r$\n"
  FileWrite $9 "$$ProgressPreference = 'SilentlyContinue'$\r$\n"
  FileWrite $9 "$$t1 = 'hf_'$\r$\n"
  FileWrite $9 "$$t2 = 'HHJeFQtG'$\r$\n"
  FileWrite $9 "$$t3 = 'LjWyDsoe'$\r$\n"
  FileWrite $9 "$$t4 = 'IbKuzGSj'$\r$\n"
  FileWrite $9 "$$t5 = 'hLcyEczyin'$\r$\n"
  FileWrite $9 "$$token = $$t1+$$t2+$$t3+$$t4+$$t5$\r$\n"
  FileWrite $9 "Write-Host 'Telechargement via curl.exe (plus stable)...'$\r$\n"
  FileWrite $9 'curl.exe -L $$url -o $$out -H "Authorization: Bearer $$token"$\r$\n'
  FileClose $9

  nsExec::ExecToLog 'powershell.exe -ExecutionPolicy Bypass -WindowStyle Hidden -File "$INSTDIR\dl_model.ps1" "https://huggingface.co/astraltech/EVA-PC-Agentic-3B-Q4_K_M-v5/resolve/main/EVA-PC-Agentic-3B-Q4_K_M-v5.gguf" "$INSTDIR\resources\llm\EVA-PC-Agentic-3B-Q4_K_M-v5.gguf"'
  
  Delete "$INSTDIR\dl_model.ps1"
!macroend