const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  openErp: () => ipcRenderer.invoke("open-erp"),
  openControlCenter: () => ipcRenderer.invoke("open-control-center"),
  startServices: () => ipcRenderer.invoke("start-services"),
  stopServices: () => ipcRenderer.invoke("stop-services"),
  restartServices: () => ipcRenderer.invoke("restart-services"),
  getHealthStatus: () => ipcRenderer.invoke("get-health-status"),
  printDocument: () => ipcRenderer.invoke("print-document"),
  reloadApp: () => ipcRenderer.invoke("reload-app"),
  getAppConfig: () => ipcRenderer.invoke("get-app-config"),
});
