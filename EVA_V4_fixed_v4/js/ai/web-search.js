/* ═══════════════════════════════════════════════════════════
   EVA V4 — WEB-SEARCH.JS
   Recherche web intelligente (météo, actualité, date/heure)
   ═══════════════════════════════════════════════════════════ */

(function() {

/* ── Patterns déclenchant une recherche ──────────────────── */
var SEARCH_TRIGGERS = [
  /\b(météo|meteo|temps|weather|température|température|pluie|neige|soleil|nuage|vent|orage|brouillard|chaud|froid|degré|°)\b/i,
  /\b(actualités?|actus?|news|nouvelles?|information|dernier|récents?|aujourd'hui|ce soir|cette semaine|en ce moment|en direct)\b/i,
  /\b(qui est|c'est qui|c'est quoi|qu'est-ce que|qu est ce que|what is|who is|c'est quoi|c'est qui|dis.?moi qui|dis.?moi quoi)\b/i,
  /\b(prix|tarifs?|coûts?|cours|taux|bitcoin|crypto|bourse|actions?|marché|euro|dollar|action google|action apple|action tesla|wall street|nasdaq|cac 40|dow jones)\b/i,
  /\b(résultats?|scores?|matchs?|classement|champions?|ligue|liga|coupe|victoire)\b/i,
  /\b(définitions?|définir|signification|que veut dire|qu'est-ce que signifie|c'est quoi)\b/i,
  /\b(heure|time|horaire|fuseau)\b.{0,20}\b(à|au|en|de)\b/i,
  /\b(sorties?|programme|films?|séances?|spectacles?|concerts?)\b/i,
  /\b(recette|ingrédients?|comment faire|comment préparer)\b/i,
  /cherche|recherche|trouve|google|internet|en ligne|sur le web/i,
  /\b(mets.{0,15}(jour|à jour)|mise.{0,10}jour|update|dernières? infos?|dernières? nouvelles?)\b/i,
  /\b(situation actuelle|état actuel|point sur|bilan|résumé des|qu'en est.il de)\b/i
];

var WEATHER_TRIGGERS = [
  /\b(météo|meteo|weather|température|temp)\b/i,
  /\b(pluie|neige|soleil|nuage|vent|orage|brouillard)\b/i,
  /\bquel.{0,10}(temps|météo|meteo)\b/i,
  /\b(va.t.il|fait.il|fait il).{0,20}(pluie|beau|chaud|froid|nuage)/i,
  /\bprévi(sion|s)\b/i
];

var DATE_TRIGGERS = [
  /\b(quelle heure|il est quelle heure|heure il est|what time)\b/i,
  /\b(quelle date|on est quel jour|quel jour sommes|quel jour on est)\b/i,
  /\baujourd'hui c'est quoi\b/i,
  /\bon est le combien\b/i
];

/* ── Extraction de ville ─────────────────────────────────── */
var CITY_PATTERNS = [
  /\b(?:à|a|en|sur|pour|de|au)\s+([A-ZÀÂÄÉÈÊËÎÏÔÖÙÛÜÇ][a-zàâäéèêëîïôöùûüçœ\-]+(?:\s+[A-Za-zàâäéèêëîïôöùûüçœ\-]+)?)\b/,
  /\b([A-ZÀÂÄÉÈÊËÎÏÔÖÙÛÜÇ][a-zàâäéèêëîïôöùûüçœ]+)\b(?=.*\b(?:météo|meteo|temps|weather)\b)/i,
  /\b(?:météo|meteo|temps|weather)\b.*\b([A-ZÀÂÄÉÈÊËÎÏÔÖÙÛÜÇ][a-zàâäéèêëîïôöùûüçœ]+)\b/i
];

var WMO_CODES = {
  0:'Ciel dégagé', 1:'Principalement dégagé', 2:'Partiellement nuageux', 3:'Couvert',
  45:'Brouillard', 48:'Brouillard givrant',
  51:'Bruine légère', 53:'Bruine modérée', 55:'Bruine dense',
  61:'Pluie légère', 63:'Pluie modérée', 65:'Pluie forte',
  71:'Neige légère', 73:'Neige modérée', 75:'Neige forte',
  80:'Averses légères', 81:'Averses modérées', 82:'Averses fortes',
  95:'Orage', 96:'Orage avec grêle', 99:'Orage avec forte grêle'
};

/* ── Déclencheurs supplémentaires pour les modèles locaux ───
   LM Studio / Ollama / Qwen / EVA n'ont pas accès à internet.
   On déclenche la recherche sur toute question factuelle.
──────────────────────────────────────────────────────────── */
var LOCAL_EXTRA_TRIGGERS = [
  /\?/,
  /\b(qui est|c'est qui|c'est quoi|qu['']est.{0,5}ce que?|what is|who is|how is)\b/i,
  /\b(est-ce que|est ce que|dis.{0,5}moi|explique.{0,5}moi|parle.{0,5}moi)\b/i,
  /\b(connais|sais.{0,10}si|peux.{0,10}dire|peux.{0,10}expliquer|pourrais.{0,10}expliquer)\b/i,
  /\b(dernière|récente|nouveau|nouvel|nouvelle|actuel|actuellement|maintenant)\b/i,
  /\b(version|sortie|lancé|lancée|publié|publiée|annoncé|annoncée)\b/i,
  /\b(invente|inventé|créé|fondé|développé|découvert|construit)\b/i,
  /\b(capital|président|premier ministre|chef|dirige|dirig|gouverne)\b/i,
  /\b(population|superficie|monnaie|langue|nationalité)\b/i,
  /\b(film|série|livre|roman|album|chanson|artiste|groupe)\b/i
];

/* ── Helpers ─────────────────────────────────────────────── */
function needsSearch(msg) {
  return SEARCH_TRIGGERS.some(function(r) { return r.test(msg); });
}

/* ── Variante plus agressive pour les modèles locaux ────── */
function needsSearchLocal(msg) {
  if (needsSearch(msg)) return true;
  if (!msg || msg.trim().length < 8) return false;
  return LOCAL_EXTRA_TRIGGERS.some(function(r) { return r.test(msg); });
}

function needsWeather(msg) {
  return WEATHER_TRIGGERS.some(function(r) { return r.test(msg); });
}

function needsDateOnly(msg) {
  return DATE_TRIGGERS.some(function(r) { return r.test(msg); }) &&
    !needsWeather(msg);
}

function extractCity(msg) {
  for (var i = 0; i < CITY_PATTERNS.length; i++) {
    var m = msg.match(CITY_PATTERNS[i]);
    if (m && m[1]) {
      var city = m[1];
      var ignore = ['La','Le','Les','Un','Une','Des','Ce','Cette','Mon','Ma','Mes','Son','Sa','Ses','Du','Au','Aux'];
      if (ignore.indexOf(city) === -1 && city.length > 2) return city;
    }
  }
  return 'Paris';
}

function currentDateTimeStr() {
  var now = new Date();
  var date = now.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  var time = now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  return date + ' à ' + time;
}

/* ── Météo via Open-Meteo (gratuit, sans clé) ─────────────── */
async function fetchWeather(city) {
  try {
    var geoRes = await fetch(
      'https://geocoding-api.open-meteo.com/v1/search?name=' +
      encodeURIComponent(city) + '&count=1&language=fr&format=json'
    );
    if (!geoRes.ok) return null;
    var geoData = await geoRes.json();
    if (!geoData.results || geoData.results.length === 0) return null;
    var loc = geoData.results[0];

    var weatherRes = await fetch(
      'https://api.open-meteo.com/v1/forecast' +
      '?latitude=' + loc.latitude +
      '&longitude=' + loc.longitude +
      '&current=temperature_2m,relative_humidity_2m,wind_speed_10m,precipitation,weather_code,apparent_temperature' +
      '&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,weather_code' +
      '&timezone=auto&forecast_days=4'
    );
    if (!weatherRes.ok) return null;
    var w = await weatherRes.json();
    var c = w.current;
    var d = w.daily;
    var cond = WMO_CODES[c.weather_code] || 'Conditions inconnues';

    var lines = [
      'DONNÉES MÉTÉO EN TEMPS RÉEL pour ' + loc.name + ' (' + (loc.admin1 || loc.country) + ')' ,
      'Date et heure : ' + currentDateTimeStr(),
      'Conditions actuelles : ' + cond,
      'Température : ' + Math.round(c.temperature_2m) + '°C (ressentie ' + Math.round(c.apparent_temperature) + '°C)',
      'Humidité : ' + c.relative_humidity_2m + '%',
      'Vent : ' + Math.round(c.wind_speed_10m) + ' km/h',
      c.precipitation > 0 ? 'Précipitations : ' + c.precipitation + ' mm' : ''
    ].filter(Boolean);

    if (d && d.time && d.time.length > 1) {
      lines.push('Prévisions :');
      for (var i = 1; i < Math.min(4, d.time.length); i++) {
        var dateLabel = new Date(d.time[i]).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
        var dayLine = '- ' + dateLabel + ' : ' + (WMO_CODES[d.weather_code[i]] || '—') +
          ', ' + Math.round(d.temperature_2m_min[i]) + '–' + Math.round(d.temperature_2m_max[i]) + '°C';
        if (d.precipitation_sum[i] > 0) dayLine += ', ' + d.precipitation_sum[i] + 'mm de pluie';
        lines.push(dayLine);
      }
    }

    return lines.join('\n');
  } catch (e) {
    console.warn('[EVA Search] Météo error:', e);
    return null;
  }
}

/* ── Recherche DuckDuckGo (Instant Answer + Scraping HTML Fallback) ── */
async function fetchDDG(query) {
  try {
    var parts = [];
    
    // 1. Essai API Instant Answer (rapide, propre pour les définitions)
    var res = await fetch(
      'https://api.duckduckgo.com/?q=' + encodeURIComponent(query) +
      '&format=json&no_redirect=1&no_html=1&skip_disambig=1'
    );
    if (res.ok) {
      var data = await res.json();
      if (data.Answer) parts.push('Réponse directe : ' + data.Answer);
      if (data.AbstractText) {
        parts.push(data.AbstractText + (data.AbstractSource ? ' (Source : ' + data.AbstractUrl + ')' : ''));
      }
      if (data.RelatedTopics && data.RelatedTopics.length > 0) {
        var topics = data.RelatedTopics.slice(0, 3)
          .filter(function(t) { return t.Text && t.FirstURL; })
          .map(function(t) { return '- ' + t.Text + ' (Source : ' + t.FirstURL + ')'; });
        if (topics.length > 0) parts.push('Informations complémentaires :\n' + topics.join('\n'));
      }
    }

    // 2. Si l'API Instant Answer n'a rien donné, on scrape le HTML via AllOrigins (CORS)
    if (parts.length === 0) {
      var htmlUrl = 'https://api.allorigins.win/get?url=' + encodeURIComponent('https://html.duckduckgo.com/html/?q=' + encodeURIComponent(query));
      var res2 = await fetch(htmlUrl);
      if (res2.ok) {
        var data2 = await res2.json();
        var html = data2.contents;
        
        // Regex pour extraire les snippets et URLs des résultats web
        var blockRegex = /<a class="result__url" href="([^"]+)"[^>]*>[\s\S]*?<a class="result__snippet[^>]*>([\s\S]*?)<\/a>/g;
        var match;
        var results = [];
        while ((match = blockRegex.exec(html)) !== null && results.length < 4) {
          var url = match[1];
          // Nettoyer le HTML du snippet
          var text = match[2].replace(/<[^>]+>/g, '').replace(/&quot;/g, '"').replace(/&#39;/g, "'").trim();
          if (text.length > 20) {
            results.push('- ' + text + '\n  (Source: ' + url + ')');
          }
        }
        if (results.length > 0) {
          parts.push('Résultats Web :\n' + results.join('\n\n'));
        }
      }
    }

    return parts.length > 0 ? parts.join('\n\n') : null;
  } catch (e) {
    console.warn('[EVA Search] DDG error:', e);
    return null;
  }
}

/* ── Point d'entrée principal ────────────────────────────── */
async function search(userMessage) {
  var now = currentDateTimeStr();
  var context = '[ DONNÉES TEMPS RÉEL INJECTÉES PAR LE SYSTÈME ]\nDate et heure actuelles : ' + now + '\n';

  if (needsDateOnly(userMessage)) {
    return context;
  }

  if (needsWeather(userMessage)) {
    var city = extractCity(userMessage);
    var weatherData = await fetchWeather(city);
    if (weatherData) {
      context += '\n' + weatherData;
      return context;
    }
    context += '\n(Impossible de récupérer la météo pour "' + city + '")';
    return context;
  }

  var ddg = await fetchDDG(userMessage);
  if (ddg) {
    context += '\nRésultats de recherche web :\n' + ddg + '\n\nCONSIGNE IMPORTANTE : Ne cite pas les sources (URL) dans ta réponse à moins que l\'utilisateur ne le demande explicitement.';
  } else {
    context += '\n(Aucun résultat de recherche disponible pour cette requête)';
  }

  return context;
}

/* ── Expose ──────────────────────────────────────────────── */
window.EVAWebSearch = {
  needsSearch:      needsSearch,
  needsSearchLocal: needsSearchLocal,
  search:           search
};

})();
