# COMMANDES VÉRIFIÉES

## Déployer l'app PC
```powershell
cd "f:\code\eva\evaprojectmultiplatforme\eva-pc"
$env:PATH = "F:\donnee_app\dev_tool\node;$env:PATH"
$env:TEMP = "F:\temp"
$env:TMP = "F:\temp"
node deploy.js
```
→ Incrémente version patch, compile, publie sur GitHub Releases

## Déployer le web (Vercel)
```powershell
cd "f:\code\eva\evaprojectmultiplatforme"
git add <fichiers>
git commit -m "fix(...): ..."
git push origin main
```
→ Vercel redéploie automatiquement EVA_V4_fixed_v4/

## Git status
```powershell
cd "f:\code\eva\evaprojectmultiplatforme"
$env:PATH = "F:\donnee_app\dev_tool\node;$env:PATH"
git status --short
git log --oneline -5
```

## Tester Pollinations API
```powershell
$body = '{"model":"openai-fast","messages":[{"role":"user","content":"Test"}],"stream":false}'
Invoke-WebRequest -Uri "https://text.pollinations.ai/openai" -Method POST -ContentType "application/json" -Body $body -TimeoutSec 15 -UseBasicParsing
```

## Lire un fichier JS encodé ANSI (PC web/)
```powershell
$bytes = [System.IO.File]::ReadAllBytes("chemin\fichier.js")
$content = [System.Text.Encoding]::GetEncoding(1252).GetString($bytes)
```

## Écrire un fichier JS ANSI (PC web/)
```powershell
$newBytes = [System.Text.Encoding]::GetEncoding(1252).GetBytes($content)
[System.IO.File]::WriteAllBytes("chemin\fichier.js", $newBytes)
```
