const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  openErp: () => ipcRenderer.invoke("open-erp"),
  openControlCenter: () => ipcRenderer.invoke("open-control-center"),
  startServices: () => ipcRenderer.invoke("start-services"),
  stopServices: () => ipcRenderer.invoke("stop-services"),
  restartServices: () => ipcRenderer.invoke("restart-services"),
  getHealthStatus: () => ipcRenderer.invoke("get-health-status"),
  testConnection: (url) => ipcRenderer.invoke("test-connection", url),
  saveClientConfig: (cfg) => ipcRenderer.invoke("save-client-config", cfg),
  getClientConfig: () => ipcRenderer.invoke("get-client-config"),
  printDocument: () => ipcRenderer.invoke("print-document"),
  reloadApp: () => ipcRenderer.invoke("reload-app"),
  getAppConfig: () => ipcRenderer.invoke("get-app-config"),

  // First-Run Installer & Lock
  completeFirstRunSetup: (payload) => ipcRenderer.invoke("complete-first-run-setup", payload),
  checkSetupLocked: () => ipcRenderer.invoke("check-setup-locked"),

  // Cloudflare Tunnel APIs
  cloudflare: {
    checkInstalled: () => ipcRenderer.invoke("cf-check-installed"),
    install: () => ipcRenderer.invoke("cf-install"),
    login: () => ipcRenderer.invoke("cf-login"),
    createTunnel: (name) => ipcRenderer.invoke("cf-create-tunnel", name),
    routeDns: (params) => ipcRenderer.invoke("cf-route-dns", params),
    startTunnel: (params) => ipcRenderer.invoke("cf-start-tunnel", params),
    stopTunnel: () => ipcRenderer.invoke("cf-stop-tunnel"),
    restartTunnel: () => ipcRenderer.invoke("cf-restart-tunnel"),
    getStatus: () => ipcRenderer.invoke("cf-get-status"),
    saveConfig: (cfg) => ipcRenderer.invoke("cf-save-config", cfg),
    getConfig: () => ipcRenderer.invoke("cf-get-config"),
    repair: () => ipcRenderer.invoke("cf-repair-tunnel"),
    testEndpoint: (hostname) => ipcRenderer.invoke("cf-test-endpoint", hostname),
  },
});
