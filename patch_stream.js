const fs = require('fs');

let js = fs.readFileSync('EVA_V4_fixed_v4/js/app/messages.js', 'utf8');

let target = `msgContent.appendChild(msgActions);
  div.appendChild(msgContent);`;

let replace = `msgContent.appendChild(msgActions);

  if (window._lastEvaSuggestions && window._lastEvaSuggestions.length > 0) {
    var sugContainer = document.createElement('div');
    sugContainer.className = 'msg-suggestions';
    sugContainer.style.cssText = 'display:flex;flex-wrap:wrap;gap:8px;margin-top:12px;margin-bottom:6px;';
    window._lastEvaSuggestions.forEach(function(sug) {
      if (!sug || typeof sug !== 'string') return;
      var btn = document.createElement('button');
      btn.textContent = sug;
      btn.style.cssText = 'background:rgba(123,139,245,0.08);border:1px solid rgba(123,139,245,0.25);color:var(--text);border-radius:14px;padding:8px 14px;font-size:0.8em;cursor:pointer;text-align:left;line-height:1.3;transition:all 0.2s;flex:1 1 100%;';
      btn.onmouseover = function() { this.style.background = 'rgba(123,139,245,0.18)'; this.style.borderColor = 'rgba(123,139,245,0.5)'; };
      btn.onmouseout = function() { this.style.background = 'rgba(123,139,245,0.08)'; this.style.borderColor = 'rgba(123,139,245,0.25)'; };
      btn.onclick = function() {
        var input = document.getElementById('msgInput');
        if (input) { input.value = sug; document.getElementById('sendBtn').click(); }
      };
      sugContainer.appendChild(btn);
    });
    msgContent.appendChild(sugContainer);
    window._lastEvaSuggestions = null;
  }

  div.appendChild(msgContent);`;

if (js.includes('msgContent.appendChild(msgActions);')) {
  js = js.replace(target, replace);
  fs.writeFileSync('EVA_V4_fixed_v4/js/app/messages.js', js, 'utf8');
}
