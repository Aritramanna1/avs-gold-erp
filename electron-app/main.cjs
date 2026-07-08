// MTJ ERP — Electron desktop shell
// Loads the online Lovable-hosted ERP so the same Supabase database is used
// across web and desktop. No secrets, no local database, no data split.
//
// Override the URL via env var MTJ_ERP_URL if needed (e.g. custom domain).

const { app, BrowserWindow, Menu, shell, dialog } = require("electron");
const path = require("path");

// Set MTJ_ERP_URL at launch / package time to point at your deployed Horizon URL.
// The placeholder below MUST be replaced before shipping to production.
const DEFAULT_URL = process.env.MTJ_ERP_URL || "https://erp.maatara.example";

// In production builds, disable the menu bar (no dev tools exposed by default).
const isProd = app.isPackaged;

function createWindow() {
  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    title: "MTJ ERP",
    backgroundColor: "#0b0b0b",
    autoHideMenuBar: isProd,
    icon: path.join(__dirname, "icon.png"),
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      // Renderer is a pure browser context. No Node access, no preload bridges,
      // so no secret keys can leak from Electron into the page.
      devTools: !isProd,
    },
  });

  if (isProd) {
    Menu.setApplicationMenu(null);
  }

  // Keyboard-wedge barcode scanners send keystrokes directly to the focused
  // input — no special handling needed. They work out of the box.

  // Open target=_blank / external http(s) links in the user's default browser.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("http://") || url.startsWith("https://")) {
      shell.openExternal(url);
    }
    return { action: "deny" };
  });

  // Print works natively (Ctrl+P inside the ERP triggers the OS print dialog).

  win.loadURL(DEFAULT_URL).catch((err) => {
    dialog.showErrorBox(
      "MTJ ERP — cannot reach server",
      `Failed to load ${DEFAULT_URL}\n\n${err.message}\n\nCheck the shop's internet connection and try again.`,
    );
  });

  // Offline / network failure handler.
  win.webContents.on("did-fail-load", (_e, code, desc, url) => {
    if (code === -3) return; // aborted navigation, ignore
    dialog.showErrorBox(
      "MTJ ERP — connection lost",
      `Could not load ${url}\n\n${desc} (code ${code})\n\nMTJ ERP needs an internet connection to reach the online database.`,
    );
  });
}

app.whenReady().then(createWindow);

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
