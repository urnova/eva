const http = require('http');

http.get('http://127.0.0.1:5173/splash.html', (res) => {
  console.log(`STATUS: ${res.statusCode}`);
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => console.log('BODY:', data.substring(0, 100)));
}).on('error', console.error);
