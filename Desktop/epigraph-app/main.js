const { app, BrowserWindow, ipcMain, dialog, Menu, shell } = require('electron')
const path = require('path')
const fs = require('fs')
const https = require('https')
const { execFile, exec } = require('child_process')

function runPy(script, args) {
  return new Promise((resolve) => {
    const b64 = Buffer.from(script).toString('base64')
    execFile('python3', ['-c', `import base64,sys;exec(base64.b64decode('${b64}').decode())`, ...args],
      { maxBuffer: 20 * 1024 * 1024 },
      (err, stdout, stderr) => {
        if (err) { resolve({ ok: false, error: stderr || err.message }); return }
        try { resolve(JSON.parse(stdout.trim())) }
        catch (e) { resolve({ ok: false, error: 'parse: ' + stdout.slice(0, 200) }) }
      }
    )
  })
}

function getDataPath() {
  if (app.isPackaged) {
    return path.join(app.getPath('userData'), 'epigraph_data.json')
  }
  return path.join(__dirname, 'epigraph_data.json')
}

function getBackupDir() {
  return path.join(path.dirname(getDataPath()), 'backups')
}

function doSnapshot(label) {
  const dataPath = getDataPath()
  if (!fs.existsSync(dataPath)) return { ok: false, error: 'no data file' }
  const backupDir = getBackupDir()
  if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true })
  const dest = path.join(backupDir, `epigraph_data_${label}.json`)
  fs.copyFileSync(dataPath, dest)
  return { ok: true, path: dest }
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
    if (fs.existsSync(dataPath)) {
      const data = JSON.parse(fs.readFileSync(dataPath, 'utf-8'))
      // daily snapshot before any writes happen this session
      const today = new Date().toISOString().slice(0, 10)
      const backupDir = getBackupDir()
      const todaySnap = path.join(backupDir, `epigraph_data_${today}.json`)
      if (!fs.existsSync(todaySnap)) {
        try {
          if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true })
          fs.copyFileSync(dataPath, todaySnap)
        } catch (e) { console.error('daily snapshot failed:', e) }
      }
      return data
    }
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
    const tmpPath = dataPath + '.tmp'
    fs.writeFileSync(tmpPath, JSON.stringify(data, null, 2), 'utf-8')
    fs.renameSync(tmpPath, dataPath)
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

ipcMain.handle('backup-now', () => {
  const now = new Date()
  const date = now.toISOString().slice(0, 10)
  const hhmm = now.toTimeString().slice(0, 5).replace(':', '')
  return doSnapshot(`${date}_${hhmm}`)
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
  if (!fs.statSync(expanded).isDirectory()) return { ok: false, status: 'path is a file — set the folder' }
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
  if (!fs.existsSync(expanded)) return { ok: false, error: 'folder not found: ' + expanded }
  // Check it's a directory, not a file
  if (!fs.statSync(expanded).isDirectory()) return { ok: false, error: 'path is a file, not a folder — set the folder containing your notebooks' }
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


// ── PDF UTILITIES ─────────────────────────────────────────────────────────────

ipcMain.handle('pdf-extract-doi', async (event, pdfPath) => {
  const script = `
import fitz,re,sys,json
doi_pat=re.compile(r'10\\.\\d{4,9}/[^\\s"\'<>{}\\[\\]]+')
arxiv_pat=re.compile(r'arXiv:\\s*(\\d{4}\\.\\d{4,5}(?:v\\d+)?)')
try:
 doc=fitz.open(sys.argv[1])
 cands=[]
 m=doc.metadata
 for f in ['subject','title','keywords','creator']:
  if m.get(f):cands.extend(doi_pat.findall(m[f]))
 xmp=doc.get_xml_metadata()
 if xmp:cands.extend(doi_pat.findall(xmp))
 # scan up to 10 pages, stop early if doi found
 for i in range(min(10,len(doc))):
  txt=doc[i].get_text()
  cands.extend(doi_pat.findall(txt))
  ax=arxiv_pat.findall(txt)
  for a in ax:cands.append('10.48550/arXiv.'+a)
  if cands:break
 # extract title/authors from page 1 for pre-fill
 p1=doc[0].get_text() if len(doc)>0 else ''
 lines=[l.strip() for l in p1.split('\\n') if l.strip()]
 guessed_title=lines[0] if lines else ''
 guessed_authors=lines[1] if len(lines)>1 else ''
 doc.close()
 seen,cleaned=set(),[]
 for d in cands:
  d=d.rstrip('.,;):')
  if d not in seen:seen.add(d);cleaned.append(d)
 print(json.dumps({'ok':True,'doi':cleaned[0] if cleaned else None,'title':guessed_title,'authors':guessed_authors}))
except Exception as e:
 print(json.dumps({'ok':False,'error':str(e)}))
`.trim()
  return runPy(script, [pdfPath])
})

ipcMain.handle('pdf-copy', async (event, srcPath, destDir) => {
  try {
    const expanded = destDir.replace(/^~/, app.getPath('home'))
    if (!fs.existsSync(expanded)) fs.mkdirSync(expanded, { recursive: true })
    const dest = path.join(expanded, path.basename(srcPath))
    if (dest !== srcPath) fs.copyFileSync(srcPath, dest)
    return { ok: true, destPath: dest }
  } catch (e) {
    return { ok: false, error: e.message }
  }
})

ipcMain.handle('fetch-crossref', async (event, doi) => {
  return new Promise((resolve) => {
    const url = 'https://api.crossref.org/works/' + encodeURIComponent(doi)
    const req = https.get(url, { headers: { 'User-Agent': 'Epigraph/1.0' } }, (res) => {
      let data = ''
      res.on('data', c => { data += c })
      res.on('end', () => {
        try {
          const j = JSON.parse(data)
          const m = j.message
          const title = (m.title || [])[0] || ''
          const authors = (m.author || []).map(a => [a.family, a.given].filter(Boolean).join(', ')).join(' and ')
          const journal = (m['container-title'] || [])[0] || ''
          const yr = ((m.published || m['published-print'] || m['published-online'] || {})['date-parts'] || [['']])[0][0]
          resolve({ ok: true, title, authors, journal, year: String(yr || ''), doi })
        } catch (e) { resolve({ ok: false, error: 'parse: ' + e.message }) }
      })
    })
    req.on('error', e => resolve({ ok: false, error: e.message }))
    req.setTimeout(10000, () => { req.destroy(); resolve({ ok: false, error: 'timeout' }) })
  })
})

ipcMain.handle('pdf-extract-annotations', async (event, pdfPath) => {
  const script = `
import fitz,json,sys
try:
 doc=fitz.open(sys.argv[1])
 results=[]
 for page in doc:
  for annot in page.annots():
   t=annot.type[0]
   if t==15:continue
   r=annot.rect
   info=annot.info
   color=annot.colors.get('stroke') or annot.colors.get('fill')
   text=''
   content=(info.get('content') or '').strip()
   if t==8:text=page.get_textbox(r).strip().replace('\\n',' ')
   key=(text or content)[:30]
   dedup='p%d|%.0f,%.0f|%s'%(page.number+1,r.x0,r.y0,key)
   if t in(1,2,3,4,8,9,10)and(text or content):
    results.append({'page':page.number+1,'x0':r.x0,'y0':r.y0,'x1':r.x1,'y1':r.y1,'type':annot.type[1],'text':text,'content':content,'color':color,'dedup':dedup})
 doc.close()
 print(json.dumps({'ok':True,'annotations':results}))
except Exception as e:
 print(json.dumps({'ok':False,'error':str(e)}))
`.trim()
  return runPy(script, [pdfPath])
})

let pdfWatcher = null
const pdfDebounce = {}

ipcMain.handle('start-pdf-watcher', async (event, folder) => {
  if (pdfWatcher) { try { pdfWatcher.close() } catch (e) {} pdfWatcher = null }
  try {
    const expanded = folder.replace(/^~/, app.getPath('home'))
    if (!fs.existsSync(expanded)) return { ok: false, error: 'folder not found' }
    pdfWatcher = fs.watch(expanded, { persistent: false }, (eventType, filename) => {
      if (!filename || !filename.toLowerCase().endsWith('.pdf')) return
      clearTimeout(pdfDebounce[filename])
      pdfDebounce[filename] = setTimeout(() => {
        if (win && !win.isDestroyed()) win.webContents.send('pdf-changed', filename)
      }, 2000)
    })
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e.message }
  }
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
