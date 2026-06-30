const https = require('https');

https.get('https://api.allorigins.win/get?url=' + encodeURIComponent('https://html.duckduckgo.com/html/?q=cours+action+google'), (resp) => {
  let data = '';
  resp.on('data', (chunk) => { data += chunk; });
  resp.on('end', () => {
    try {
      const json = JSON.parse(data);
      const html = json.contents;
      const regex = /<a class="result__snippet[^>]*>([\s\S]*?)<\/a>/g;
      let match;
      let count = 0;
      while ((match = regex.exec(html)) !== null && count < 3) {
        console.log(match[1].replace(/<b>|<\/b>/g, '').trim());
        count++;
      }
    } catch(e) { console.error(e); }
  });
});
