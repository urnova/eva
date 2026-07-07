const fs = require('fs');
let cwJs = fs.readFileSync('EVA_V4_fixed_v4/js/features/cloudworks.js', 'utf8');

const targetSnap = `_cwResultUnsub = window.db.collection('cloudworks').doc(uid).collection('commands')
      .orderBy('updatedAt','desc')
      .limit(MAX_LOG)
      .onSnapshot(function(snap) { _handleResultsSnap(snap); });`;

const replacementSnap = `var _initSnap = true;
    _cwResultUnsub = window.db.collection('cloudworks').doc(uid).collection('commands')
      .orderBy('updatedAt','desc')
      .limit(MAX_LOG)
      .onSnapshot(function(snap) { 
        _handleResultsSnap(snap, _initSnap); 
        _initSnap = false;
      });`;

cwJs = cwJs.replace(targetSnap, replacementSnap);

const targetHandler = `function _handleResultsSnap(snap) {
    snap.docChanges().forEach(function(change) {
      if (change.type !== 'added' && change.type !== 'modified') return;
      var data = change.doc.data();
      if (data.status !== 'done' && data.status !== 'error') return;
      _updateLogEntry(change.doc.id, data);
      if (data.type === 'screenshot' && data.status === 'done' && data.result && data.result.imageBase64) {
        cwShowScreenshot(data.result.imageBase64, data.deviceId);
      }
      if (data.type === 'sysinfo' && data.status === 'done' && data.result) {
        cwShowSysInfo(data.result, data.deviceId);
      }
      if (data.type === 'run_script' && data.status === 'done') {
        cwShowScriptResult(data.result, data.deviceId);
      }`;

const replacementHandler = `function _handleResultsSnap(snap, isInit) {
    snap.docChanges().forEach(function(change) {
      if (change.type !== 'added' && change.type !== 'modified') return;
      var data = change.doc.data();
      if (data.status !== 'done' && data.status !== 'error') return;
      _updateLogEntry(change.doc.id, data);
      
      // Ne pas afficher les popups pour les anciens résultats (initial load)
      if (!isInit) {
        if (data.type === 'screenshot' && data.status === 'done' && data.result && data.result.imageBase64) {
          cwShowScreenshot(data.result.imageBase64, data.deviceId);
        }
        if (data.type === 'sysinfo' && data.status === 'done' && data.result) {
          cwShowSysInfo(data.result, data.deviceId);
        }
        if (data.type === 'run_script' && data.status === 'done') {
          cwShowScriptResult(data.result, data.deviceId);
        }
      }`;

cwJs = cwJs.replace(targetHandler, replacementHandler);

fs.writeFileSync('EVA_V4_fixed_v4/js/features/cloudworks.js', cwJs, 'utf8');
console.log("CLOUDWORKS DUPLICATES FIXED");
