@echo off
echo.
echo =======================================================
echo    Creation du modele local Eva Agentic (Astral Tech)
echo =======================================================
echo.
echo Telechargement du modele de base et creation de l'agent...
ollama create EvaAgentic -f eva-pc/llm/Modelfile.agentic
echo.
echo Termine ! Le modele "Eva Agentic" est desormais disponible localement et pret a repondre instantanement aux requetes CloudWorks sans impacter les performances de votre PC (4Go de RAM recommandees).
pause
