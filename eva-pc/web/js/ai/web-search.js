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

/* ── Extraction de ville (sans /i sur les majuscules pour ne pas confondre "est" et "Estonie") ── */
var CITY_PATTERNS = [
  /(?:à|a|sur|pour|chez)\s+(?:la\s+ville\s+de\s+)?([A-ZÀÂÄÉÈÊËÎÏÔÖÙÛÜÇ][a-zàâäéèêëîïôöùûüçœ'\-]+(?:\s+[A-ZÀÂÄÉÈÊËÎÏÔÖÙÛÜÇa-zàâäéèêëîïôöùûüçœ'\-]+){0,2})/,
  /\bm[eé]t[eé]o\s+(?:à|a|de|du|d'|pour|sur)\s+([A-Za-zÀ-ÖØ-öø-ÿ'\-]{2,30}(?:\s+[A-Za-zÀ-ÖØ-öø-ÿ'\-]{2,20})?)/i,
  /\b([A-ZÀÂÄÉÈÊËÎÏÔÖÙÛÜÇ][a-zàâäéèêëîïôöùûüçœ\-]{2,})\b(?=.*\b(?:m[eé]t[eé]o|temps|weather|temp[eé]rature)\b)/,
  /\b(?:m[eé]t[eé]o|temps|weather|temp[eé]rature)\b.*\b(?:à|a|en|sur|pour|de)\s+([A-ZÀÂÄÉÈÊËÎÏÔÖÙÛÜÇ][a-zàâäéèêëîïôöùûüçœ\-]{2,})\b/
];

var CITY_STOPWORDS = new Set([
  'la','le','les','un','une','des','ce','cette','ces','mon','ma','mes','son','sa','ses','du','au','aux','de','en','dans','sur','sous','pour','par','avec','sans','vers','chez',
  'est','sont','etait','était','sera','etre','être','fait','faire','fais','dit','dis','va','vas','aller','niveau','moment','etat','état','point',
  'meteo','météo','temps','weather','temperature','température','quel','quelle','quels','quelles','comment','pourquoi','quand','ou','où','ici','la-bas','là-bas','dehors','moi','nous','toi','vous',
  'aujourd','aujourdhui','aujourd\'hui','demain','hier','matin','soir','midi','nuit','semaine','weekend','week-end','jour','mois','annee','année',
  'bien','mal','beau','chaud','froid','pluie','neige','vent','soleil','orage','nuage','bruine','france','bonjour','salut','eva','éva'
]);

function _cleanCandidateCity(raw) {
  if (!raw) return null;
  var cleaned = String(raw).trim().replace(/^['"\s,.;:!?]+|['"\s,.;:!?]+$/g, '');
  if (!cleaned || cleaned.length < 2) return null;
  var tokens = cleaned.split(/\s+/).filter(Boolean);
  while (tokens.length > 0 && CITY_STOPWORDS.has(tokens[0].toLowerCase())) tokens.shift();
  while (tokens.length > 0 && CITY_STOPWORDS.has(tokens[tokens.length - 1].toLowerCase())) tokens.pop();
  if (!tokens.length) return null;
  var res = tokens.join(' ');
  if (res.length < 2 || CITY_STOPWORDS.has(res.toLowerCase())) return null;
  return res;
}

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
  var stated = String(msg || '').match(/\b(?:je suis|j['’]habite|ma ville est|ici c['’]est)\s+(?:à|a|en)?\s*([A-Za-zÀ-ÖØ-öø-ÿ'\-]{2,30})/i);
  if (stated && stated[1]) {
    var stCity = _cleanCandidateCity(stated[1]);
    if (stCity) {
      try { localStorage.setItem('eva_user_city', stCity); } catch(_) {}
      return stCity;
    }
  }
  for (var i = 0; i < CITY_PATTERNS.length; i++) {
    var m = msg.match(CITY_PATTERNS[i]);
    if (m && m[1]) {
      var cand = _cleanCandidateCity(m[1]);
      if (cand) return cand;
    }
  }
  return null;
}

var _geoCache = null;
var _geoCacheAt = 0;
async function _detectUserLocation() {
  if (_geoCache && (Date.now() - _geoCacheAt < 1800000)) return _geoCache;
  try {
    var ss = typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('eva_ip_geo') : null;
    if (ss) {
      var parsed = JSON.parse(ss);
      if (parsed && parsed.ts && (Date.now() - parsed.ts < 1800000) && parsed.city) {
        _geoCache = parsed; _geoCacheAt = parsed.ts;
        return parsed;
      }
    }
  } catch(_) {}
  var endpoints = [
    { url: 'https://get.geojs.io/v1/ip/geo.json', map: function(d){ return d && d.city ? { city: d.city, countryCode: (d.country_code || d.country || '').toUpperCase(), lat: Number(d.latitude), lon: Number(d.longitude) } : null; } },
    { url: 'https://ipwho.is/', map: function(d){ return d && d.success !== false && d.city ? { city: d.city, countryCode: (d.country_code || '').toUpperCase(), lat: Number(d.latitude), lon: Number(d.longitude) } : null; } }
  ];
  for (var i = 0; i < endpoints.length; i++) {
    try {
      var r = await _fetchWithTimeout(endpoints[i].url, 2500);
      if (r.ok) {
        var mapped = endpoints[i].map(await r.json());
        if (mapped && mapped.city) {
          mapped.ts = Date.now();
          _geoCache = mapped; _geoCacheAt = mapped.ts;
          try { sessionStorage.setItem('eva_ip_geo', JSON.stringify(mapped)); } catch(_) {}
          return mapped;
        }
      }
    } catch(_) {}
  }
  return null;
}

async function resolveDefaultCityAndCountry() {
  var saved = null;
  try {
    saved = (window.S && window.S.profile && window.S.profile.city) || localStorage.getItem('eva_user_city') || null;
  } catch(_) {}
  var geo = await _detectUserLocation();
  return {
    city: saved || (geo && geo.city) || 'Paris',
    countryCode: (geo && geo.countryCode) || 'FR',
    coords: (!saved && geo && Number.isFinite(geo.lat) && Number.isFinite(geo.lon)) ? { lat: geo.lat, lon: geo.lon, name: geo.city, country: geo.countryCode } : null
  };
}

function currentDateTimeStr() {
  var now = new Date();
  var date = now.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  var time = now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  return date + ' à ' + time;
}

/* ── Fetch avec timeout strict (5s) pour éviter tout blocage vocal ── */
async function _fetchWithTimeout(url, ms) {
  var ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
  var tId = ctrl ? setTimeout(function() { ctrl.abort(); }, ms || 5000) : null;
  try {
    return await fetch(url, ctrl ? { signal: ctrl.signal } : undefined);
  } finally {
    if (tId) clearTimeout(tId);
  }
}

/* ── Météo via Open-Meteo (gratuit, sans clé) ─────────────── */
async function fetchWeather(city, preferredCountry, fallbackCoords) {
  try {
    var loc = null;
    if (city) {
      var geoRes = await _fetchWithTimeout(
        'https://geocoding-api.open-meteo.com/v1/search?name=' +
        encodeURIComponent(city) + '&count=5&language=fr&format=json',
        5000
      );
      if (geoRes.ok) {
        var geoData = await geoRes.json();
        if (geoData.results && geoData.results.length > 0) {
          var cc = (preferredCountry || 'FR').toUpperCase();
          loc = geoData.results.find(function(x) { return (x.country_code || '').toUpperCase() === cc; }) || geoData.results[0];
        }
      }
    }
    if (!loc && fallbackCoords) {
      loc = { name: fallbackCoords.name || city, admin1: fallbackCoords.country || '', country: fallbackCoords.country || '', latitude: fallbackCoords.lat, longitude: fallbackCoords.lon };
    }
    if (!loc) return null;

    var weatherRes = await _fetchWithTimeout(
      'https://api.open-meteo.com/v1/forecast' +
      '?latitude=' + loc.latitude +
      '&longitude=' + loc.longitude +
      '&current=temperature_2m,relative_humidity_2m,wind_speed_10m,precipitation,weather_code,apparent_temperature' +
      '&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,weather_code' +
      '&timezone=auto&forecast_days=4',
      5000
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
    var res = await _fetchWithTimeout(
      'https://api.duckduckgo.com/?q=' + encodeURIComponent(query) +
      '&format=json&no_redirect=1&no_html=1&skip_disambig=1',
      4500
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

    // 2. Fallback Wikipedia FR + DuckDuckGo HTML via CORS
    if (parts.length === 0) {
      var wikiRes = await _fetchWithTimeout(
        'https://fr.wikipedia.org/w/api.php?action=query&list=search&srsearch=' + encodeURIComponent(query) + '&utf8=1&format=json&origin=*&srlimit=3',
        4500
      ).catch(function() { return null; });
      if (wikiRes && wikiRes.ok) {
        var wData = await wikiRes.json().catch(function() { return null; });
        var hits = wData && wData.query && wData.query.search;
        if (hits && hits.length > 0) {
          parts.push('Wikipedia FR :\n' + hits.map(function(h) {
            return '- ' + h.title + ' : ' + String(h.snippet || '').replace(/<[^>]+>/g, '');
          }).join('\n'));
        }
      }
    }

    if (parts.length === 0) {
      var htmlUrl = 'https://api.allorigins.win/get?url=' + encodeURIComponent('https://html.duckduckgo.com/html/?q=' + encodeURIComponent(query));
      var res2 = await _fetchWithTimeout(htmlUrl, 5000).catch(function() { return null; });
      if (res2 && res2.ok) {
        var data2 = await res2.json();
        var html = data2.contents || '';
        var blockRegex = /<a class="result__url" href="([^"]+)"[^>]*>[\s\S]*?<a class="result__snippet[^>]*>([\s\S]*?)<\/a>/g;
        var match;
        var results = [];
        while ((match = blockRegex.exec(html)) !== null && results.length < 4) {
          var url = match[1];
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
    var explicitCity = extractCity(userMessage);
    var defLoc = await resolveDefaultCityAndCountry();
    var targetCity = explicitCity || defLoc.city;
    var weatherData = await fetchWeather(targetCity, defLoc.countryCode, explicitCity ? null : defLoc.coords);
    if (weatherData) {
      context += '\n' + weatherData;
      return context;
    }
    context += '\n(Impossible de récupérer la météo pour "' + targetCity + '")';
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
async function deepSearch(query) {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return '[ MODE HORS-LIGNE ] Recherche web ignorée (aucune connexion). Réponds avec tes connaissances locales.';
  }
  var cleanQ = String(query || '').replace(/\s+/g, ' ').trim().slice(0, 140);
  var results = [];
  var tasks = [
    search(query),
    _fetchWithTimeout(
      'https://fr.wikipedia.org/w/api.php?action=query&list=search&srsearch=' + encodeURIComponent(cleanQ) + '&utf8=1&format=json&origin=*&srlimit=3',
      4500
    ).then(function(r) { return r.ok ? r.json() : null; }).then(async function(j) {
      var hits = j && j.query && j.query.search;
      if (!hits || !hits.length) return '';
      var topTitle = hits[0].title;
      var summaryTxt = '';
      try {
        var sRes = await _fetchWithTimeout('https://fr.wikipedia.org/api/rest_v1/page/summary/' + encodeURIComponent(topTitle), 3500);
        if (sRes.ok) {
          var sJson = await sRes.json();
          if (sJson && sJson.extract) summaryTxt = sJson.extract;
        }
      } catch(_) {}
      var listTxt = hits.map(function(h) {
        return '- ' + h.title + ' : ' + String(h.snippet || '').replace(/<[^>]+>/g, '');
      }).join('\n');
      return '[WIKIPEDIA FR — RECHERCHE APPROFONDIE]\n' + (summaryTxt ? ('Synthèse (' + topTitle + ') : ' + summaryTxt + '\n\n') : '') + listTxt;
    }).catch(function() { return ''; }),
    _fetchWithTimeout(
      'https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=' + encodeURIComponent(cleanQ) + '&utf8=1&format=json&origin=*&srlimit=2',
      4500
    ).then(function(r) { return r.ok ? r.json() : null; }).then(function(j) {
      var hits = j && j.query && j.query.search;
      if (!hits || !hits.length) return '';
      return '[WIKIPEDIA EN]\n' + hits.map(function(h) {
        return '- ' + h.title + ' : ' + String(h.snippet || '').replace(/<[^>]+>/g, '');
      }).join('\n');
    }).catch(function() { return ''; })
  ];
  var settled = await Promise.all(tasks);
  settled.forEach(function(part) { if (part && String(part).trim()) results.push(part); });
  return results.join('\n\n');
}

window.EVAWebSearch = {
  needsSearch:      needsSearch,
  needsSearchLocal: needsSearchLocal,
  search:           search,
  deepSearch:       deepSearch,
  extractCity:      extractCity
};

})();
