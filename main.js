const { app, BrowserWindow, ipcMain, dialog, Menu } = require('electron')
const path = require('path')
const fs = require('fs')

// Data file path - correct for both dev and packaged
function getDataPath() {
  if (app.isPackaged) {
    return path.join(app.getPath('userData'), 'epigraph_data.json')
  }
  return path.join(__dirname, 'epigraph_data.json')
}

let win

function createWindow() {
  win = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    titleBarStyle: 'default',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    },
    title: 'Epigraph'
  })
  win.loadFile('index.html')
  // win.webContents.openDevTools()
}

ipcMain.handle('load-data', () => {
  const dataPath = getDataPath()
  try {
    if (fs.existsSync(dataPath)) {
      return JSON.parse(fs.readFileSync(dataPath, 'utf-8'))
    }
    // Migration from dev folder when first launching packaged app
    if (app.isPackaged) {
      const devPath = path.join(path.dirname(app.getAppPath()), 'epigraph_data.json')
      if (fs.existsSync(devPath)) {
        const data = JSON.parse(fs.readFileSync(devPath, 'utf-8'))
        fs.writeFileSync(dataPath, JSON.stringify(data, null, 2))
        return data
      }
    }
    return null
  } catch (e) {
    console.error('load-data error:', e)
    return null
  }
})

ipcMain.handle('save-data', (event, data) => {
  const dataPath = getDataPath()
  try {
    const dir = path.dirname(dataPath)
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
    fs.writeFileSync(dataPath, JSON.stringify(data, null, 2), 'utf-8')
    return { ok: true }
  } catch (e) {
    console.error('save-data error:', e)
    return { ok: false, error: e.message }
  }
})

ipcMain.handle('export-data', async (event, data) => {
  const { filePath } = await dialog.showSaveDialog(win, {
    title: 'Export Epigraph Backup',
    defaultPath: `epigraph_backup_${new Date().toISOString().slice(0,10)}.json`,
    filters: [{ name: 'JSON', extensions: ['json'] }]
  })
  if (!filePath) return { ok: false, cancelled: true }
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8')
    return { ok: true, filePath }
  } catch (e) {
    return { ok: false, error: e.message }
  }
})

ipcMain.handle('import-data', async () => {
  const { filePaths } = await dialog.showOpenDialog(win, {
    title: 'Import Epigraph Backup',
    filters: [{ name: 'JSON', extensions: ['json'] }],
    properties: ['openFile']
  })
  if (!filePaths || !filePaths[0]) return { ok: false, cancelled: true }
  try {
    const data = JSON.parse(fs.readFileSync(filePaths[0], 'utf-8'))
    return { ok: true, data }
  } catch (e) {
    return { ok: false, error: e.message }
  }
})

ipcMain.handle('pick-image', async () => {
  const { filePaths } = await dialog.showOpenDialog(win, {
    title: 'Add Image or Plot',
    filters: [
      { name: 'Images', extensions: ['png','jpg','jpeg','gif','webp','svg'] },
      { name: 'All Files', extensions: ['*'] }
    ],
    properties: ['openFile']
  })
  if (!filePaths || !filePaths[0]) return { ok: false, cancelled: true }
  try {
    const data = fs.readFileSync(filePaths[0])
    const ext = path.extname(filePaths[0]).toLowerCase().replace('.','')
    const mime = ext === 'svg' ? 'image/svg+xml' : `image/${ext === 'jpg' ? 'jpeg' : ext}`
    return { ok: true, dataUrl: `data:${mime};base64,${data.toString('base64')}`, name: path.basename(filePaths[0]) }
  } catch (e) {
    return { ok: false, error: e.message }
  }
})

function buildMenu() {
  const template = [
    { label: 'Epigraph', submenu: [
      { label: 'About Epigraph', role: 'about' },
      { type: 'separator' },
      { label: 'Hide Epigraph', role: 'hide' },
      { role: 'hideOthers' },
      { type: 'separator' },
      { label: 'Quit', role: 'quit' }
    ]},
    { label: 'Edit', submenu: [
      { role: 'undo' }, { role: 'redo' },
      { type: 'separator' },
      { role: 'cut' }, { role: 'copy' }, { role: 'paste' }, { role: 'selectAll' }
    ]},
    { label: 'View', submenu: [
      { role: 'reload' },
      { type: 'separator' },
      { role: 'resetZoom' }, { role: 'zoomIn' }, { role: 'zoomOut' },
      { type: 'separator' },
      { role: 'togglefullscreen' }
    ]},
    { label: 'Window', submenu: [
      { role: 'minimize' }, { role: 'zoom' },
      { type: 'separator' }, { role: 'front' }
    ]}
  ]
  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}

app.whenReady().then(() => {
  createWindow()
  buildMenu()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
