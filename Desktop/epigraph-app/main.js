const { app, BrowserWindow, ipcMain, dialog, Menu, shell } = require('electron')
const path = require('path')
const fs = require('fs')
const { execFile, exec } = require('child_process')

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
  win.webContents.session.clearCache()
  win.loadFile('index.html')
  win.webContents.openDevTools()
}

// ── FILE I/O ──────────────────────────────────────────────────────────────────

ipcMain.handle('load-data', () => {
  const dataPath = getDataPath()
  try {
    if (fs.existsSync(dataPath)) return JSON.parse(fs.readFileSync(dataPath, 'utf-8'))
    const devPath = path.join(__dirname, 'epigraph_data.json')
    if (app.isPackaged && fs.existsSync(devPath)) {
      const data = JSON.parse(fs.readFileSync(devPath, 'utf-8'))
      fs.writeFileSync(dataPath, JSON.stringify(data, null, 2))
      return data
    }
    return null
  } catch (e) { console.error('load-data:', e); return null }
})

ipcMain.handle('save-data', (event, data) => {
  const dataPath = getDataPath()
  try {
    const dir = path.dirname(dataPath)
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
    fs.writeFileSync(dataPath, JSON.stringify(data, null, 2), 'utf-8')
    return { ok: true }
  } catch (e) { return { ok: false, error: e.message } }
})

ipcMain.handle('export-data', async (event, data) => {
  const { filePath } = await dialog.showSaveDialog(win, {
    title: 'Export Epigraph Backup',
    defaultPath: `epigraph_backup_${new Date().toISOString().slice(0,10)}.json`,
    filters: [{ name: 'JSON', extensions: ['json'] }]
  })
  if (!filePath) return { ok: false, cancelled: true }
  try { fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8'); return { ok: true, filePath } }
  catch (e) { return { ok: false, error: e.message } }
})

ipcMain.handle('import-data', async () => {
  const { filePaths } = await dialog.showOpenDialog(win, {
    title: 'Import Epigraph Backup',
    filters: [{ name: 'JSON', extensions: ['json'] }],
    properties: ['openFile']
  })
  if (!filePaths || !filePaths[0]) return { ok: false, cancelled: true }
  try { return { ok: true, data: JSON.parse(fs.readFileSync(filePaths[0], 'utf-8')) } }
  catch (e) { return { ok: false, error: e.message } }
})

ipcMain.handle('pick-image', async () => {
  const { filePaths } = await dialog.showOpenDialog(win, {
    title: 'Add Image or Plot',
    filters: [{ name: 'Images', extensions: ['png','jpg','jpeg','gif','webp','svg'] }],
    properties: ['openFile']
  })
  if (!filePaths || !filePaths[0]) return { ok: false, cancelled: true }
  try {
    const data = fs.readFileSync(filePaths[0])
    const ext = path.extname(filePaths[0]).toLowerCase().replace('.','')
    const mime = ext === 'svg' ? 'image/svg+xml' : `image/${ext === 'jpg' ? 'jpeg' : ext}`
    return { ok: true, dataUrl: `data:${mime};base64,${data.toString('base64')}`, name: path.basename(filePaths[0]) }
  } catch (e) { return { ok: false, error: e.message } }
})

ipcMain.handle('pick-file', async () => {
  const { filePaths } = await dialog.showOpenDialog(win, {
    title: 'Attach File',
    filters: [
      { name: 'Analysis files', extensions: ['ipynb','py','r','m','ijm','macro','txt','csv','json'] },
      { name: 'All Files', extensions: ['*'] }
    ],
    properties: ['openFile']
  })
  if (!filePaths || !filePaths[0]) return { ok: false, cancelled: true }
  return { ok: true, filePath: filePaths[0], name: require('path').basename(filePaths[0]) }
})

ipcMain.handle('pick-pdf', async () => {
  const { filePaths } = await dialog.showOpenDialog(win, {
    title: 'Attach PDF',
    filters: [{ name: 'PDF', extensions: ['pdf'] }],
    properties: ['openFile']
  })
  if (!filePaths || !filePaths[0]) return { ok: false, cancelled: true }
  return { ok: true, filePath: filePaths[0] }
})

// ── FILE / FOLDER OPENING ─────────────────────────────────────────────────────

ipcMain.handle('open-path', async (event, filePath, mode) => {
  try {
    const expanded = filePath.replace(/^~/, app.getPath('home'))
    const openInVSCode = (p) => {
      // Use open -a which works without code in PATH
      exec(`open -a "Visual Studio Code" "${p}"`, (err) => {
        if (err) {
          // Fallback to vscode:// protocol
          shell.openExternal('vscode://file/' + p.replace(/ /g, '%20'))
        }
      })
    }
    if (mode === 'vscode') {
      openInVSCode(expanded)
    } else if (mode === 'finder') {
      await shell.openPath(expanded)
    } else {
      if (expanded.match(/\.(ipynb|py|r|m|jl|js|ts|json)$/i)) {
        openInVSCode(expanded)
      } else {
        await shell.openPath(expanded)
      }
    }
    return { ok: true }
  } catch (e) { 
    console.error('open-path error:', e)
    return { ok: false, error: e.message } 
  }
})

// ── GIT OPERATIONS ────────────────────────────────────────────────────────────

function runGit(args, cwd) {
  return new Promise((resolve) => {
    const expanded = cwd.replace(/^~/, app.getPath('home'))
    if (!fs.existsSync(expanded)) {
      resolve({ ok: false, error: 'folder not found: ' + expanded })
      return
    }
    execFile('git', args, { cwd: expanded }, (err, stdout, stderr) => {
      if (err) resolve({ ok: false, error: stderr || err.message })
      else resolve({ ok: true, output: stdout.trim() })
    })
  })
}

ipcMain.handle('list-files', async (event, folderPath, ext) => {
  try {
    const expanded = folderPath.replace(/^~/, app.getPath('home'))
    if (!fs.existsSync(expanded)) return { ok: false, error: 'folder not found: ' + expanded }
    const files = fs.readdirSync(expanded)
      .filter(f => !ext || f.toLowerCase().endsWith(ext.toLowerCase()))
      .map(f => ({ name: f, path: path.join(expanded, f) }))
    return { ok: true, files }
  } catch (e) { return { ok: false, error: e.message } }
})

ipcMain.handle('git-status', async (event, folderPath) => {
  const expanded = folderPath.replace(/^~/, app.getPath('home'))
  if (!fs.existsSync(expanded)) return { ok: false, status: 'folder not found' }
  // Check if git repo
  const isRepo = fs.existsSync(path.join(expanded, '.git'))
  if (!isRepo) return { ok: true, status: 'not a git repo — click commit to initialise' }
  const r = await runGit(['log', '--oneline', '-3'], expanded)
  const s = await runGit(['status', '--short'], expanded)
  const changed = s.ok ? s.output.split('\n').filter(Boolean).length : 0
  const lastCommit = r.ok ? r.output.split('\n')[0] : 'no commits yet'
  return { ok: true, status: (changed > 0 ? changed+' changed · ' : '') + 'last: ' + lastCommit }
})

ipcMain.handle('git-commit', async (event, folderPath, message) => {
  const expanded = folderPath.replace(/^~/, app.getPath('home'))
  if (!fs.existsSync(expanded)) return { ok: false, error: 'folder not found' }
  // Init if not a repo
  if (!fs.existsSync(path.join(expanded, '.git'))) {
    await runGit(['init'], expanded)
    // Create .gitignore for large data files
    const gitignore = '*.npz\n*.tif\n*.tiff\n*.nd2\n*.czi\n*.lif\n*.mat\n__pycache__/\n.ipynb_checkpoints/\n'
    fs.writeFileSync(path.join(expanded, '.gitignore'), gitignore)
  }
  await runGit(['add', '-A'], expanded)
  const r = await runGit(['commit', '-m', message, '--allow-empty'], expanded)
  return r
})

ipcMain.handle('git-push', async (event, folderPath, repoUrl, token) => {
  const expanded = folderPath.replace(/^~/, app.getPath('home'))
  // Add token to URL if provided
  let url = repoUrl
  if (token && repoUrl.startsWith('https://')) {
    url = repoUrl.replace('https://', `https://${token}@`)
  }
  // Set remote
  const remotes = await runGit(['remote'], expanded)
  if (!remotes.output || !remotes.output.includes('origin')) {
    await runGit(['remote', 'add', 'origin', url], expanded)
  } else {
    await runGit(['remote', 'set-url', 'origin', url], expanded)
  }
  const r = await runGit(['push', '-u', 'origin', 'HEAD'], expanded)
  return r
})

// ── APP MENU ──────────────────────────────────────────────────────────────────

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
