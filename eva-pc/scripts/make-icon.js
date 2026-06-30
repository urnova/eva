// Script de conversion PNG → ICO pour EVA Desktop
const fs = require('fs')
const path = require('path')

const inputPng = path.join(__dirname, '..', 'public', 'eva-icon.png')
const outputIco = path.join(__dirname, '..', 'public', 'eva-icon.ico')

async function convert() {
  try {
    const mod = await import('png-to-ico')
    const pngToIco = mod.default || mod
    const buf = await pngToIco([inputPng])
    fs.writeFileSync(outputIco, buf)
    console.log('eva-icon.ico généré !')
    console.log('→ ' + outputIco)
  } catch(e) {
    console.error('Erreur:', e.message)
    console.log('INFO: eva-icon.png sera utilisé directement (compatible electron-builder)')
    // Fallback: copier le PNG comme .ico (fonctionne avec la plupart des builders)
    fs.copyFileSync(inputPng, outputIco)
    console.log('Fallback: eva-icon.png copié en eva-icon.ico')
  }
}

convert()
