const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('epigraph', {
  // Data
  loadData:    ()           => ipcRenderer.invoke('load-data'),
  saveData:    (data)       => ipcRenderer.invoke('save-data', data),
  exportData:  (data)       => ipcRenderer.invoke('export-data', data),
  importData:  ()           => ipcRenderer.invoke('import-data'),

  // Files
  pickImage:   ()           => ipcRenderer.invoke('pick-image'),
  pickPdf:     ()           => ipcRenderer.invoke('pick-pdf'),
  pickFile:    ()           => ipcRenderer.invoke('pick-file'),
  openPath:    (p, mode)    => ipcRenderer.invoke('open-path', p, mode),

  // Git
  listFiles:   (folder, ext)=> ipcRenderer.invoke('list-files', folder, ext),
  gitStatus:   (folder)     => ipcRenderer.invoke('git-status', folder),
  gitCommit:   (folder, msg)=> ipcRenderer.invoke('git-commit', folder, msg),
  gitPush:     (folder, url, token) => ipcRenderer.invoke('git-push', folder, url, token),

  // PDF import + sync
  pdfExtractDoi:        (p)        => ipcRenderer.invoke('pdf-extract-doi', p),
  pdfCopy:              (src, dir) => ipcRenderer.invoke('pdf-copy', src, dir),
  fetchCrossref:        (doi)      => ipcRenderer.invoke('fetch-crossref', doi),
  pdfExtractAnnotations:(p)        => ipcRenderer.invoke('pdf-extract-annotations', p),
  startPdfWatcher:      (folder)   => ipcRenderer.invoke('start-pdf-watcher', folder),
  onPdfChanged:         (cb)       => ipcRenderer.on('pdf-changed', (_e, fname) => cb(fname)),

  isElectron: true
})
