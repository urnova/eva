const fs = require('fs');
const files = [
  'EVA_V4_fixed_v4/js/features/cloudworks.js',
  'eva-pc/web/js/features/cloudworks.js'
];

files.forEach(file => {
  if (fs.existsSync(file)) {
    let js = fs.readFileSync(file, 'utf8');
    
    if (!js.includes('let isInitialLoad = true;')) {
      js = js.replace(
        `async function initCloudWorks() {`,
        `let isInitialLoad = true;\n\nasync function initCloudWorks() {`
      );
      
      js = js.replace(
        `_handleResultsSnap(snap) {`,
        `_handleResultsSnap(snap) {\n    if (isInitialLoad) return;`
      );

      js = js.replace(
        `this.unsubResults = onSnapshot(resultsQuery, (snap) => this._handleResultsSnap(snap));`,
        `this.unsubResults = onSnapshot(resultsQuery, (snap) => {\n      this._handleResultsSnap(snap);\n      if (isInitialLoad) {\n        setTimeout(() => isInitialLoad = false, 1500);\n      }\n    });`
      );

      // Also ensure that the duplicate replacement won't fail if already done slightly differently
      fs.writeFileSync(file, js, 'utf8');
      console.log(`FIXED DUPES IN ${file}`);
    }
  }
});
