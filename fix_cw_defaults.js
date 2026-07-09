const fs = require('fs');
let js = fs.readFileSync('EVA_V4_fixed_v4/js/features/cloudworks.js', 'utf8');

js = js.replace(
`    placeholder: 'Ex: python script.py  ou  npm run build',
    confirmLabel: 'Exécuter',`,
`    placeholder: 'Ex: python script.py  ou  npm run build',
    defaultValue: 'echo "CloudWorks Agent est prêt !" && dir',
    confirmLabel: 'Exécuter',`
);

js = js.replace(
`'<input class="cw-modal-input" id="cwInputField" type="text" placeholder="' + esc(opts.placeholder || '') + '">'`,
`'<input class="cw-modal-input" id="cwInputField" type="text" placeholder="' + esc(opts.placeholder || '') + '" value="' + esc(opts.defaultValue || '') + '">'`
);

js = js.replace(
`'<textarea class="cw-modal-input cw-modal-textarea" id="cwInputField" placeholder="' + esc(opts.placeholder || '') + '" rows="4"></textarea>'`,
`'<textarea class="cw-modal-input cw-modal-textarea" id="cwInputField" placeholder="' + esc(opts.placeholder || '') + '" rows="4">' + esc(opts.defaultValue || '') + '</textarea>'`
);

fs.writeFileSync('EVA_V4_fixed_v4/js/features/cloudworks.js', js, 'utf8');
console.log('Default value added to CloudWorks modal');
