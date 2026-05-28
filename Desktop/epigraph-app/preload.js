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
  openPath:    (p, mode)    => ipcRenderer.invoke('open-path', p, mode),

  // Git
  gitStatus:   (folder)     => ipcRenderer.invoke('git-status', folder),
  gitCommit:   (folder, msg)=> ipcRenderer.invoke('git-commit', folder, msg),
  gitPush:     (folder, url, token) => ipcRenderer.invoke('git-push', folder, url, token),

  isElectron: true
})
