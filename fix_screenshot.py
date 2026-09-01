import sys
sys.stdout.reconfigure(encoding='utf-8')

# ═══ FIX main.ts : compresser screenshot via nativeImage ═══
with open(r'eva-pc/electron/main.ts', 'r', encoding='utf-8', errors='replace') as f:
    mt = f.read()

OLD_SS = """ipcMain.handle('system:screenshot', async () => {
  try {
    // @ts-ignore
    const screenshot = await import('screenshot-desktop')
    const img = await screenshot.default()
    return { success: true, data: img.toString('base64') }
  } catch (e) {
    return { success: false, error: String(e) }
  }
})"""

NEW_SS = """ipcMain.handle('system:screenshot', async () => {
  try {
    // @ts-ignore
    const screenshot = await import('screenshot-desktop')
    const img = await screenshot.default()  // Buffer PNG full-res

    // Redimensionner + convertir en JPEG pour rester sous 1 MB Firestore
    const { nativeImage } = require('electron')
    const native = nativeImage.createFromBuffer(img)
    const size = native.getSize()
    // Max 1024px large en conservant le ratio
    const maxW = 1024
    const scale = size.width > maxW ? maxW / size.width : 1
    const resized = native.resize({
      width:  Math.floor(size.width  * scale),
      height: Math.floor(size.height * scale),
      quality: 'good'
    })
    const jpeg = resized.toJPEG(55) // JPEG ~55% qualité → ~80-200 KB
    return { success: true, data: jpeg.toString('base64'), mimeType: 'image/jpeg' }
  } catch (e) {
    return { success: false, error: String(e) }
  }
})"""

if OLD_SS in mt:
    mt = mt.replace(OLD_SS, NEW_SS, 1)
    print('FIX main.ts: screenshot compressé JPEG 1024px')
else:
    print('WARN: screenshot pattern not found in main.ts')

with open(r'eva-pc/electron/main.ts', 'w', encoding='utf-8') as f:
    f.write(mt)
print('main.ts saved')


# ═══ FIX web cloudworks.js : cwShowScreenshot gère JPEG + mimeType ═══
with open(r'EVA_V4_fixed_v4/js/features/cloudworks.js', 'r', encoding='utf-8', errors='replace') as f:
    cw = f.read()

# 1. Fix cwShowScreenshot pour accepter jpeg ou png
OLD_SHOW_SS = "        '<img src=\"data:image/png;base64,' + base64 + '\" class=\"cw-screenshot-img\" alt=\"Capture d\\'écran\" onclick=\"this."
NEW_SHOW_SS = "        '<img src=\"data:image/jpeg;base64,' + base64 + '\" class=\"cw-screenshot-img\" alt=\"Capture d\\'écran\" onclick=\"this."

if OLD_SHOW_SS in cw:
    cw = cw.replace(OLD_SHOW_SS, NEW_SHOW_SS, 1)
    print('FIX web cloudworks: cwShowScreenshot → image/jpeg')
else:
    # Try wider search
    import re
    m = re.search(r"'<img src=\"data:image/\w+;base64,'", cw)
    if m:
        print(f'WARN: found img pattern at different position: {m.group()[:60]}')
    else:
        print('WARN: img pattern not found')

# 2. Fix _handleResultsSnap pour déclencher cwShowScreenshot même en mimeType jpeg
OLD_HANDLE = "    if (data.type === 'screenshot' && data.status === 'done' && data.result && data.result.imageBase64) {\n      cwShowScreenshot(data.result.imageBase64, data.deviceId);\n    }"
NEW_HANDLE = "    if (data.type === 'screenshot' && data.status === 'done' && data.result && data.result.imageBase64) {\n      var mime = (data.result.mimeType || 'image/jpeg');\n      cwShowScreenshot(data.result.imageBase64, data.deviceId, mime);\n    }"

if OLD_HANDLE in cw:
    cw = cw.replace(OLD_HANDLE, NEW_HANDLE, 1)
    print('FIX web cloudworks: _handleResultsSnap passe mimeType')
else:
    print('WARN: _handleResultsSnap screenshot pattern not found')

# 3. Update cwShowScreenshot signature to accept mimeType param
OLD_FN = "function cwShowScreenshot(base64, deviceId) {"
NEW_FN = "function cwShowScreenshot(base64, deviceId, mimeType) {\n  mimeType = mimeType || 'image/jpeg';"
if OLD_FN in cw:
    cw = cw.replace(OLD_FN, NEW_FN, 1)
    print('FIX web cloudworks: cwShowScreenshot signature + mimeType param')
else:
    print('WARN: cwShowScreenshot signature not found')

# 4. Use mimeType in img src
OLD_IMG = "'<img src=\"data:image/jpeg;base64,' + base64 + '\" class=\"cw-screenshot-img\" alt=\"Capture d\\'écran\" onclick=\"this."
NEW_IMG = "'<img src=\"data:' + mimeType + ';base64,' + base64 + '\" class=\"cw-screenshot-img\" alt=\"Capture d\\'écran\" onclick=\"this."
if OLD_IMG in cw:
    cw = cw.replace(OLD_IMG, NEW_IMG, 1)
    print('FIX web cloudworks: img src uses dynamic mimeType')
else:
    print('WARN: img src mimeType not updated (check manually)')

with open(r'EVA_V4_fixed_v4/js/features/cloudworks.js', 'w', encoding='utf-8') as f:
    f.write(cw)
print('EVA_V4_fixed_v4/js/features/cloudworks.js saved')
