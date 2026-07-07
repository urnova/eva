const fs = require('fs');
let html = fs.readFileSync('EVA_V4_fixed_v4/download.html', 'utf8');

// Replace dl-subtitle
html = html.replace(
  /<p class="dl-subtitle">.*?<\/p>/,
  `<p class="dl-subtitle">Téléchargez l'application native pour Windows et profitez de l'intégration CloudWorks OS Agent avec E.V.A.</p>`
);

// Replace grid with single flex box and remove APK card
const regex = /<div class="dl-grid">[\s\S]*?<!-- Desktop -->/;
const replacement = `<div class="dl-grid" style="display:flex;justify-content:center;">

    <!-- Desktop -->`;
html = html.replace(regex, replacement);

// Add width to dl-card
html = html.replace(/<div class="dl-card">/, `<div class="dl-card" style="max-width:500px;width:100%;">`);

fs.writeFileSync('EVA_V4_fixed_v4/download.html', html, 'utf8');
console.log("FIXED DOWNLOAD HTML");
