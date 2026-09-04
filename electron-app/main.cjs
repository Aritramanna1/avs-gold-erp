const { app, BrowserWindow, ipcMain, Menu, shell, Tray } = require("electron");
const path = require("path");
const os = require("os");
const http = require("http");
const { exec } = require("child_process");

const ERP_URL = process.env.MTJ_ERP_URL || "http://localhost:3000";
const GATEWAY_URL = process.env.SUPABASE_GATEWAY_URL || "http://127.0.0.1:8000";
const SUPABASE_DIR = path.resolve(__dirname, "../../supabase-self-hosted");

let mainWindow = null;

function getLocalIpAddress() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name] || []) {
      if (iface.family === "IPv4" && !iface.internal) {
        return iface.address;
      }
    }
  }
  return "192.168.0.101";
}

function checkHttpEndpoint(url, timeoutMs = 2000) {
  return new Promise((resolve) => {
    try {
      const parsed = new URL(url);
      const req = http.get(
        {
          hostname: parsed.hostname,
          port: parsed.port || 80,
          path: parsed.pathname || "/",
          timeout: timeoutMs,
        },
        (res) => {
          resolve(res.statusCode >= 200 && res.statusCode < 500);
        }
      );
      req.on("error", () => resolve(false));
      req.on("timeout", () => {
        req.destroy();
        resolve(false);
      });
    } catch {
      resolve(false);
    }
  });
}

function getOfflineHtml() {
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>MTJ ERP — Offline</title>
      <style>
        body {
          margin: 0;
          padding: 0;
          background-color: #020617;
          color: #f8fafc;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
          display: flex;
          align-items: center;
          justify-content: center;
          min-height: 100vh;
        }
        .card {
          background-color: #0f172a;
          border: 1px solid #1e293b;
          border-radius: 12px;
          padding: 36px 32px;
          max-width: 440px;
          width: 90%;
          text-align: center;
          box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5);
        }
        .icon {
          width: 56px;
          height: 56px;
          border-radius: 28px;
          background: rgba(245, 158, 11, 0.1);
          border: 1px solid rgba(245, 158, 11, 0.2);
          color: #f59e0b;
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 0 auto 16px;
          font-size: 24px;
        }
        h1 {
          font-size: 20px;
          font-weight: 700;
          margin: 0 0 8px;
          color: #ffffff;
          letter-spacing: 0.5px;
        }
        p {
          font-size: 13px;
          line-height: 1.6;
          color: #94a3b8;
          margin: 0 0 24px;
        }
        .actions {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        button {
          background-color: #d97706;
          color: #020617;
          border: none;
          font-weight: 600;
          padding: 12px 20px;
          border-radius: 6px;
          cursor: pointer;
          font-size: 14px;
          width: 100%;
          transition: background 0.2s;
        }
        button:hover {
          background-color: #b45309;
        }
        .btn-ctrl {
          background-color: #1e293b;
          color: #f8fafc;
          border: 1px solid #334155;
        }
        .btn-ctrl:hover {
          background-color: #334155;
        }
        .sub {
          font-size: 11px;
          color: #64748b;
          margin-top: 16px;
        }
      </style>
    </head>
    <body>
      <div class="card">
        <div class="icon">⚡</div>
        <h1>ERP OFFLINE</h1>
        <p>
          The shop server is currently offline.<br />
          Please start the MTJ ERP application on the main shop PC.
        </p>
        <div class="actions">
          <button onclick="window.location.href='${ERP_URL}'">Retry Connection</button>
          <button class="btn-ctrl" onclick="if(window.electronAPI) window.electronAPI.openControlCenter(); else window.location.reload();">Open Control Center</button>
        </div>
        <div class="sub">Auto-retrying connection every 8 seconds...</div>
      </div>
      <script>
        setTimeout(() => {
          window.location.href = "${ERP_URL}";
        }, 8000);
      </script>
    </body>
    </html>
  `;
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1366,
    height: 860,
    minWidth: 1024,
    minHeight: 700,
    title: "MTJ / AVS ERP — Host Control Shell",
    backgroundColor: "#020617",
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
    },
    autoHideMenuBar: true,
    show: false,
  });

  mainWindow.once("ready-to-show", () => {
    mainWindow.maximize();
    mainWindow.show();
  });

  // Check if ERP is already online; if so, open ERP, else open Control Center
  checkHttpEndpoint(ERP_URL).then((isUp) => {
    if (isUp) {
      mainWindow.loadURL(ERP_URL);
    } else {
      mainWindow.loadFile(path.join(__dirname, "control-center.html"));
    }
  });

  mainWindow.webContents.on("did-fail-load", (_event, errorCode) => {
    if (errorCode !== -3) {
      mainWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(getOfflineHtml())}`);
    }
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("http:") || url.startsWith("https:")) {
      shell.openExternal(url);
      return { action: "deny" };
    }
    return { action: "allow" };
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

// IPC Handlers for Service Orchestration
ipcMain.handle("open-erp", async () => {
  if (mainWindow) {
    mainWindow.loadURL(ERP_URL);
  }
  return { ok: true };
});

ipcMain.handle("open-control-center", async () => {
  if (mainWindow) {
    mainWindow.loadFile(path.join(__dirname, "control-center.html"));
  }
  return { ok: true };
});

ipcMain.handle("get-health-status", async () => {
  const [erpUp, gwUp, storageUp] = await Promise.all([
    checkHttpEndpoint(ERP_URL),
    checkHttpEndpoint(`${GATEWAY_URL}/rest/v1/`),
    checkHttpEndpoint(`${GATEWAY_URL}/storage/v1/status`),
  ]);

  return {
    erp: erpUp,
    db: gwUp,
    auth: gwUp,
    storage: storageUp || gwUp,
    realtime: gwUp,
    karigar: true,
    tunnel: false,
    lanIp: getLocalIpAddress(),
  };
});

ipcMain.handle("start-services", async () => {
  return new Promise((resolve) => {
    exec("docker compose up -d", { cwd: SUPABASE_DIR }, (err, stdout) => {
      resolve({ ok: !err, output: stdout || err?.message });
    });
  });
});

ipcMain.handle("stop-services", async () => {
  return new Promise((resolve) => {
    exec("docker compose down", { cwd: SUPABASE_DIR }, (err, stdout) => {
      resolve({ ok: !err, output: stdout || err?.message });
    });
  });
});

ipcMain.handle("restart-services", async () => {
  return new Promise((resolve) => {
    exec("docker compose restart", { cwd: SUPABASE_DIR }, (err, stdout) => {
      resolve({ ok: !err, output: stdout || err?.message });
    });
  });
});

ipcMain.handle("print-document", async () => {
  if (mainWindow) {
    mainWindow.webContents.print({ silent: false, printBackground: true });
  }
  return { ok: true };
});

ipcMain.handle("reload-app", async () => {
  if (mainWindow) {
    mainWindow.loadURL(ERP_URL);
  }
  return { ok: true };
});

ipcMain.handle("get-app-config", async () => {
  return {
    version: "1.1.2",
    targetUrl: ERP_URL,
    lanIp: getLocalIpAddress(),
    isPackaged: app.isPackaged,
  };
});

app.whenReady().then(() => {
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
