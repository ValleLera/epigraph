const { contextBridge, ipcRenderer } = require('electron')

// Expose a safe API to the renderer (index.html)
// Only these specific functions are accessible - nothing else from Node/Electron
contextBridge.exposeInMainWorld('epigraph', {
  // Data persistence
  loadData:    ()       => ipcRenderer.invoke('load-data'),
  saveData:    (data)   => ipcRenderer.invoke('save-data', data),
  exportData:  (data)   => ipcRenderer.invoke('export-data', data),
  importData:  ()       => ipcRenderer.invoke('import-data'),

  // File picking
  pickImage:   ()       => ipcRenderer.invoke('pick-image'),

  // Environment flag
  isElectron: true
})
