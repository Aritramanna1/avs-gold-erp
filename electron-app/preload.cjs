const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  isElectron: true,
  platform: process.platform,
  version: "1.1.2",
  print: () => ipcRenderer.invoke("print-document"),
  reloadApp: () => ipcRenderer.invoke("reload-app"),
  getAppConfig: () => ipcRenderer.invoke("get-app-config"),
});
