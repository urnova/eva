const fs = require('fs');

const overlayHtml = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <title>E.V.A Overlay</title>
  <style>
    :root {
      --bg: rgba(10, 12, 16, 0.85);
      --border: rgba(123, 139, 245, 0.15);
      --cyan: #7b8bf5;
      --pink: #ff4d6d;
      --text: #e4e4ef;
    }
    body {
      margin: 0;
      padding: 10px;
      overflow: hidden;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      background: transparent;
      display: flex;
      justify-content: flex-end;
      align-items: flex-start;
      -webkit-app-region: drag;
      user-select: none;
    }
    
    .pill {
      background: var(--bg);
      border: 1px solid var(--border);
      border-radius: 40px;
      padding: 6px 6px 6px 14px;
      display: flex;
      align-items: center;
      gap: 12px;
      box-shadow: 0 8px 32px rgba(0,0,0,0.4), 0 0 10px rgba(123, 139, 245, 0.1);
      backdrop-filter: blur(16px);
      -webkit-backdrop-filter: blur(16px);
      transition: all 0.3s ease;
    }

    .indicator {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: var(--cyan);
      box-shadow: 0 0 8px var(--cyan);
      flex-shrink: 0;
      animation: pulse 2s infinite;
    }

    .text-container {
      display: flex;
      flex-direction: column;
      justify-content: center;
      margin-right: 10px;
    }

    .title {
      font-size: 11px;
      font-weight: 700;
      color: var(--cyan);
      letter-spacing: 0.5px;
      text-transform: uppercase;
      margin-bottom: 2px;
    }

    .subtitle {
      font-size: 10px;
      color: rgba(228, 228, 239, 0.7);
      white-space: nowrap;
    }

    .btn-disconnect {
      -webkit-app-region: no-drag;
      background: rgba(255, 77, 109, 0.1);
      border: 1px solid rgba(255, 77, 109, 0.3);
      color: var(--pink);
      border-radius: 30px;
      padding: 6px 12px;
      font-size: 10px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s;
      display: flex;
      align-items: center;
      gap: 5px;
    }

    .btn-disconnect:hover {
      background: rgba(255, 77, 109, 0.2);
      box-shadow: 0 0 10px rgba(255, 77, 109, 0.2);
    }

    /* States */
    .state-remote .indicator { background: var(--pink); box-shadow: 0 0 8px var(--pink); animation: pulse-fast 1s infinite; }
    .state-remote .title { color: var(--pink); }

    .state-thinking .indicator { background: #ffd700; box-shadow: 0 0 8px #ffd700; animation: pulse-fast 0.5s infinite; }
    .state-thinking .title { color: #ffd700; }

    @keyframes pulse { 0% { opacity: 0.6; transform: scale(0.9); } 50% { opacity: 1; transform: scale(1.1); } 100% { opacity: 0.6; transform: scale(0.9); } }
    @keyframes pulse-fast { 0% { opacity: 0.5; transform: scale(0.8); } 50% { opacity: 1; transform: scale(1.2); } 100% { opacity: 0.5; transform: scale(0.8); } }

  </style>
</head>
<body>

  <div class="pill" id="pill">
    <div class="indicator"></div>
    <div class="text-container">
      <div class="title" id="titleText">ACTION À DISTANCE</div>
      <div class="subtitle" id="subText">Connexion sécurisée établie</div>
    </div>
    <button class="btn-disconnect" onclick="closeOverlay()">
      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M18.36 6.64a9 9 0 1 1-12.73 0"></path><line x1="12" y1="2" x2="12" y2="12"></line></svg>
      Interrompre
    </button>
  </div>

  <script>
    if (window.eva && window.eva.overlay) {
      const pill = document.getElementById('pill');
      const titleText = document.getElementById('titleText');
      const subText = document.getElementById('subText');

      if (window.eva.overlay.onSetState) {
        window.eva.overlay.onSetState((state, text) => {
          pill.className = 'pill state-' + state;
          
          if (state === 'cloudworks' || state === 'remote' || state === 'action') {
            titleText.textContent = 'ACTION À DISTANCE';
            subText.textContent = text || 'Connexion sécurisée établie';
            pill.className = 'pill state-remote';
          } else if (state === 'thinking') {
            titleText.textContent = 'ANALYSE...';
            subText.textContent = text || 'Traitement en cours...';
          } else {
            titleText.textContent = 'E.V.A ACTIF';
            subText.textContent = text || 'En écoute...';
          }
        });
      }
    }

    function closeOverlay() {
      // Notifier le main process pour arrêter (par ex: couper la connexion CloudWorks)
      if (window.eva) {
        if (window.eva.overlay.setState) {
          window.eva.overlay.setState('killed');
        }
        window.eva.overlay.hide();
      }
    }
  </script>
</body>
</html>`;

fs.writeFileSync('eva-pc/web/overlay.html', overlayHtml, 'utf8');
console.log('Overlay redesign applied');
