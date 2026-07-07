const fs = require('fs');
let splashHtml = fs.readFileSync('eva-pc/web/splash.html', 'utf8');

const targetHtml = `  <div class="splash-container">
    <div class="logo-container">`;

const replacementHtml = `  <!-- Modal de mise à jour -->
  <div id="update-modal" style="display:none; position:fixed; inset:0; background:rgba(17,17,19,0.85); backdrop-filter:blur(10px); z-index:999999; flex-direction:column; justify-content:center; align-items:center; -webkit-app-region:no-drag;">
    <div style="background:rgba(25,25,28,0.95); border:1px solid rgba(123,139,245,0.3); border-radius:12px; padding:30px; width:400px; text-align:center; box-shadow:0 10px 40px rgba(0,0,0,0.5);">
      <h2 style="color:var(--cyan); margin-bottom:15px; font-family:'Orbitron', monospace;">Mise à jour requise</h2>
      <p style="color:var(--text-muted); font-size:0.9em; margin-bottom:25px; line-height:1.5;">Une nouvelle version d'E.V.A est disponible. Vous devez l'installer pour continuer à utiliser l'application.</p>
      
      <div id="update-progress" style="display:none; margin-bottom:20px;">
        <div style="width:100%; height:6px; background:rgba(255,255,255,0.1); border-radius:3px; overflow:hidden; margin-bottom:8px;">
          <div id="update-bar" style="width:0%; height:100%; background:var(--cyan); transition:width 0.2s;"></div>
        </div>
        <div id="update-percent" style="font-size:0.8em; color:var(--cyan);">0%</div>
      </div>
      
      <div id="update-countdown" style="display:none; color:var(--text); font-size:1.1em; margin-bottom:20px; font-weight:bold;">
        Fermeture dans <span id="countdown-val">3</span>...
      </div>
      
      <div id="update-actions" style="display:flex; justify-content:center; gap:15px;">
        <button onclick="window.eva.window.close()" style="padding:10px 20px; border:1px solid rgba(255,255,255,0.1); background:transparent; color:var(--text); border-radius:6px; cursor:pointer; font-family:'Space Mono', monospace; transition:all 0.2s;" onmouseover="this.style.background='rgba(255,255,255,0.05)'" onmouseout="this.style.background='transparent'">Quitter</button>
        <button id="btn-download" onclick="startUpdate()" style="padding:10px 20px; border:none; background:var(--cyan); color:#111; border-radius:6px; cursor:pointer; font-weight:bold; font-family:'Space Mono', monospace; transition:all 0.2s; box-shadow:0 0 15px var(--cyan-glow);" onmouseover="this.style.boxShadow='0 0 25px var(--cyan)'" onmouseout="this.style.boxShadow='0 0 15px var(--cyan-glow)'">Télécharger</button>
      </div>
    </div>
  </div>

  <div class="splash-container">
    <div class="logo-container">`;

splashHtml = splashHtml.replace(targetHtml, replacementHtml);

const targetScript = `<script>
    if (window.eva && window.eva.onSplashStatus) {
      window.eva.onSplashStatus((status) => {
        document.getElementById('status-text').innerText = status;
      });
    }
    if (window.eva && window.eva.onSplashDone) {
      window.eva.onSplashDone(() => {
        window.location.href = 'chat.html';
      });
    }
  </script>`;

const replacementScript = `<script>
    let downloadStarted = false;
    
    function startUpdate() {
      if (downloadStarted) return;
      downloadStarted = true;
      document.getElementById('update-actions').style.display = 'none';
      document.getElementById('update-progress').style.display = 'block';
      if (window.eva && window.eva.updater) {
        window.eva.updater.startDownload();
      }
    }

    if (window.eva) {
      if (window.eva.onSplashStatus) {
        window.eva.onSplashStatus((status) => {
          document.getElementById('status-text').innerText = status;
        });
      }
      if (window.eva.onSplashDone) {
        window.eva.onSplashDone(() => {
          window.location.href = 'chat.html';
        });
      }
      
      if (window.eva.updater) {
        window.eva.updater.onUpdateAvailable((info) => {
          document.getElementById('update-modal').style.display = 'flex';
        });
        
        window.eva.updater.onUpdateProgress((prog) => {
          if (prog && prog.percent) {
            let p = Math.round(prog.percent);
            document.getElementById('update-bar').style.width = p + '%';
            document.getElementById('update-percent').innerText = p + '%';
          }
        });
        
        window.eva.updater.onUpdateDownloaded(() => {
          document.getElementById('update-progress').style.display = 'none';
          document.getElementById('update-countdown').style.display = 'block';
          
          let count = 3;
          let iv = setInterval(() => {
            count--;
            document.getElementById('countdown-val').innerText = count;
            if (count <= 0) {
              clearInterval(iv);
              window.eva.updater.quitAndInstall();
            }
          }, 1000);
        });
      }
    }
  </script>`;

splashHtml = splashHtml.replace(targetScript, replacementScript);

fs.writeFileSync('eva-pc/web/splash.html', splashHtml, 'utf8');
console.log("SPLASH UPDATER UI ADDED");
