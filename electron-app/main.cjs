const { app, BrowserWindow, ipcMain, Menu, shell } = require("electron");
const path = require("path");

const DEFAULT_URL = process.env.MTJ_ERP_URL || "http://localhost:3000";

let mainWindow = null;

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
          padding: 32px;
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
        }
        p {
          font-size: 13px;
          line-height: 1.5;
          color: #94a3b8;
          margin: 0 0 24px;
        }
        button {
          background-color: #d97706;
          color: #020617;
          border: none;
          font-weight: 600;
          padding: 10px 20px;
          border-radius: 6px;
          cursor: pointer;
          font-size: 14px;
          width: 100%;
          transition: background 0.2s;
        }
        button:hover {
          background-color: #b45309;
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
        <h1>MTJ ERP is currently offline</h1>
        <p>
          The shop host server is unreachable. Please verify that the host machine and Supabase stack are running, or try again later.
        </p>
        <button onclick="window.location.href='${DEFAULT_URL}'">Retry Connection</button>
        <div class="sub">Auto-retrying every 10 seconds...</div>
      </div>
      <script>
        setTimeout(() => {
          window.location.href = "${DEFAULT_URL}";
        }, 10000);
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
    title: "MTJ / AVS ERP",
    backgroundColor: "#020617",
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
    },
    autoHideMenuBar: true,
    show: false,
  });

  mainWindow.once("ready-to-show", () => {
    mainWindow.maximize();
    mainWindow.show();
  });

  mainWindow.loadURL(DEFAULT_URL).catch(() => {
    mainWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(getOfflineHtml())}`);
  });

  mainWindow.webContents.on("did-fail-load", (_event, errorCode) => {
    if (errorCode !== -3) {
      mainWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(getOfflineHtml())}`);
    }
  });

  // Open external links in default OS browser
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

// IPC Handlers
ipcMain.handle("print-document", async () => {
  if (mainWindow) {
    mainWindow.webContents.print({ silent: false, printBackground: true });
  }
  return { ok: true };
});

ipcMain.handle("reload-app", async () => {
  if (mainWindow) {
    mainWindow.loadURL(DEFAULT_URL);
  }
  return { ok: true };
});

ipcMain.handle("get-app-config", async () => {
  return {
    version: "1.1.2",
    targetUrl: DEFAULT_URL,
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
