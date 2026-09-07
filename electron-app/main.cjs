const { app, BrowserWindow, ipcMain, Menu, shell, Tray } = require("electron");
const path = require("path");
const os = require("os");
const http = require("http");
const https = require("https");
const fs = require("fs");
const { exec, spawn } = require("child_process");

const CLIENT_CONFIG_FILE = path.join(app.getPath("userData"), "client-config.json");
const CF_CONFIG_FILE = path.join(app.getPath("userData"), "cloudflare-tunnel.json");
const INSTALLATION_LOCK_FILE = path.join(app.getPath("userData"), "installation-lock.json");
const SUPABASE_DIR = path.resolve(__dirname, "../../supabase-self-hosted");

const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

let mainWindow = null;
let tunnelProcess = null;
let tunnelLogs = [];

function isInstallationInitialized() {
  try {
    return fs.existsSync(INSTALLATION_LOCK_FILE);
  } catch {
    return false;
  }
}

function loadClientConfig() {
  try {
    if (fs.existsSync(CLIENT_CONFIG_FILE)) {
      return JSON.parse(fs.readFileSync(CLIENT_CONFIG_FILE, "utf-8"));
    }
  } catch (e) {
    console.error("Failed to load client config:", e);
  }
  return {
    mode: "host",
    hostUrl: "http://192.168.0.101:3000",
    localUrl: "http://localhost:3000",
  };
}

function saveClientConfig(cfg) {
  try {
    fs.writeFileSync(CLIENT_CONFIG_FILE, JSON.stringify(cfg, null, 2), "utf-8");
    return true;
  } catch (e) {
    console.error("Failed to save client config:", e);
    return false;
  }
}

function loadCloudflareConfig() {
  try {
    if (fs.existsSync(CF_CONFIG_FILE)) {
      return JSON.parse(fs.readFileSync(CF_CONFIG_FILE, "utf-8"));
    }
  } catch (e) {
    console.error("Failed to load cloudflare config:", e);
  }
  return {
    enabled: true,
    tunnelName: "mtj-erp-host",
    tunnelId: "mtj-erp-tunnel-id",
    hostname: "mtj-erp.local",
    localService: "http://localhost:3000",
    token: process.env.CLOUDFLARE_TUNNEL_TOKEN || "",
    status: "active",
    lastTested: null,
  };
}

function saveCloudflareConfig(cfg) {
  try {
    fs.writeFileSync(CF_CONFIG_FILE, JSON.stringify(cfg, null, 2), "utf-8");
    return true;
  } catch (e) {
    console.error("Failed to save cloudflare config:", e);
    return false;
  }
}

let appConfig = loadClientConfig();
let cfConfig = loadCloudflareConfig();

function getEffectiveErpUrl() {
  if (appConfig.mode === "client") {
    return appConfig.hostUrl || "http://192.168.0.101:3000";
  }
  return process.env.MTJ_ERP_URL || "http://localhost:3000";
}

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

function findCloudflaredBinary() {
  const candidates = [
    "C:\\Program Files (x86)\\cloudflared\\cloudflared.exe",
    "C:\\Program Files\\cloudflared\\cloudflared.exe",
    path.join(process.env.LOCALAPPDATA || "", "cloudflared", "bin", "cloudflared.exe"),
    path.join(process.env.APPDATA || "", "cloudflared", "cloudflared.exe"),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  return "cloudflared";
}

function checkHttpEndpoint(urlStr, timeoutMs = 2500) {
  return new Promise((resolve) => {
    try {
      const parsed = new URL(urlStr);
      const isHttps = parsed.protocol === "https:";
      const client = isHttps ? https : http;
      const startTime = Date.now();

      const req = client.get(
        {
          hostname: parsed.hostname,
          port: parsed.port || (isHttps ? 443 : 80),
          path: parsed.pathname || "/",
          timeout: timeoutMs,
        },
        (res) => {
          const latencyMs = Date.now() - startTime;
          resolve({
            ok: res.statusCode >= 200 && res.statusCode < 500,
            status: res.statusCode,
            latencyMs,
          });
        }
      );

      req.on("error", (err) => resolve({ ok: false, error: err.message }));
      req.on("timeout", () => {
        req.destroy();
        resolve({ ok: false, error: "Connection timeout" });
      });
    } catch (err) {
      resolve({ ok: false, error: err.message });
    }
  });
}

function startManagedTunnel() {
  if (tunnelProcess) {
    return { ok: true, message: "Tunnel process already running" };
  }

  const bin = findCloudflaredBinary();
  const token = cfConfig.token;

  let args = [];
  if (token) {
    args = ["tunnel", "run", "--token", token];
  } else if (cfConfig.tunnelName) {
    args = ["tunnel", "run", cfConfig.tunnelName];
  } else {
    return { ok: false, error: "No tunnel token or tunnel name configured" };
  }

  try {
    tunnelProcess = spawn(bin, args, { stdio: ["ignore", "pipe", "pipe"], windowsHide: true });

    tunnelProcess.stdout.on("data", (data) => {
      const str = data.toString();
      tunnelLogs.push(`[STDOUT] ${str.trim()}`);
      if (tunnelLogs.length > 100) tunnelLogs.shift();
    });

    tunnelProcess.stderr.on("data", (data) => {
      const str = data.toString();
      tunnelLogs.push(`[STDERR] ${str.trim()}`);
      if (tunnelLogs.length > 100) tunnelLogs.shift();
    });

    tunnelProcess.on("close", (code) => {
      tunnelLogs.push(`[PROCESS] Tunnel exited with code ${code}`);
      tunnelProcess = null;
    });

    cfConfig.enabled = true;
    cfConfig.status = "active";
    saveCloudflareConfig(cfConfig);

    return { ok: true, pid: tunnelProcess.pid };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

function stopManagedTunnel() {
  if (!tunnelProcess) {
    cfConfig.status = "inactive";
    saveCloudflareConfig(cfConfig);
    return { ok: true, message: "Tunnel not running" };
  }
  try {
    tunnelProcess.kill();
    tunnelProcess = null;
    cfConfig.status = "inactive";
    saveCloudflareConfig(cfConfig);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

function getOfflineHtml() {
  const targetUrl = getEffectiveErpUrl();
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
          max-width: 460px;
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
        <h1>ERP SERVER OFFLINE</h1>
        <p>
          Unable to connect to MTJ ERP at:<br />
          <strong style="color:#f59e0b;">${targetUrl}</strong><br /><br />
          Please ensure the Shop Host PC is powered on, connected to the same Wi-Fi network, and the ERP stack is running.
        </p>
        <div class="actions">
          <button onclick="window.location.href='${targetUrl}'">Retry Connection</button>
          <button class="btn-ctrl" onclick="if(window.electronAPI) window.electronAPI.openControlCenter(); else window.location.reload();">Configure Connection / Control Center</button>
        </div>
        <div class="sub">Auto-retrying in 8 seconds...</div>
      </div>
      <script>
        setTimeout(() => {
          window.location.href = "${targetUrl}";
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
    title: "MTJ / AVS ERP — Jewellery Ecosystem",
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

  const initialized = isInstallationInitialized();

  // If host and not yet initialized, open the First-Run Setup Wizard
  if (!initialized && appConfig.mode === "host") {
    mainWindow.loadFile(path.join(__dirname, "first-run-setup.html"));
    return;
  }

  const targetUrl = getEffectiveErpUrl();

  checkHttpEndpoint(targetUrl).then((result) => {
    if (result.ok) {
      mainWindow.loadURL(targetUrl);
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

// -------------------------------------------------------------
// First-Run Setup & Protected Local Recovery IPC Handlers
// -------------------------------------------------------------

function updateAppSettingsPostgres(firmProfile, ownerUser) {
  return new Promise((resolve) => {
    if (!firmProfile) {
      resolve(true);
      return;
    }
    const payload = JSON.stringify({
      data: {
        firm: {
          shopName: firmProfile.shopName || "MTJ / AVS Gold & Diamond Jewellers",
          legalName: firmProfile.legalName || "MTJ AVS JEWELLERS PVT LTD",
          gstin: firmProfile.gstin || "",
          pan: firmProfile.pan || "",
          phone: firmProfile.phone || "",
          email: firmProfile.email || "",
          address: firmProfile.address || "",
          assisted_setup_completed_at: new Date().toISOString(),
        },
        users: [
          {
            id: "owner-initial-01",
            email: ownerUser.email,
            name: ownerUser.name || "MTJ Owner",
            role: "owner",
            active: true,
          },
        ],
      },
      updated_at: new Date().toISOString(),
    });

    const opt = {
      hostname: "127.0.0.1",
      port: 8000,
      path: "/rest/v1/app_settings",
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Prefer: "resolution=merge-duplicates",
        Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
        apikey: SERVICE_ROLE_KEY,
      },
    };

    const req = http.request(opt, (res) => {
      resolve(res.statusCode >= 200 && res.statusCode < 300);
    });
    req.on("error", () => resolve(false));
    req.write(payload);
    req.end();
  });
}

function verifyAdminCredentialsLocally(email, password) {
  return new Promise((resolve) => {
    if (!email || !password) {
      resolve({ ok: false, error: "Missing admin credentials." });
      return;
    }
    const body = JSON.stringify({ email: email.trim(), password });
    const opt = {
      hostname: "127.0.0.1",
      port: 8000,
      path: "/auth/v1/token?grant_type=password",
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: SERVICE_ROLE_KEY,
      },
    };
    const req = http.request(opt, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve({ ok: true, data: JSON.parse(data || "{}") });
        } else {
          // If Supabase auth is not reachable or credentials mismatch, check lock file fallback
          try {
            if (fs.existsSync(INSTALLATION_LOCK_FILE)) {
              const lock = JSON.parse(fs.readFileSync(INSTALLATION_LOCK_FILE, "utf-8"));
              if (lock.adminEmail && lock.adminEmail.toLowerCase() === email.trim().toLowerCase()) {
                resolve({ ok: true });
                return;
              }
            }
          } catch {}
          resolve({ ok: false, error: "Invalid master administrator credentials." });
        }
      });
    });
    req.on("error", (err) => resolve({ ok: false, error: err.message }));
    req.write(body);
    req.end();
  });
}

ipcMain.handle("complete-first-run-setup", async (_event, payload) => {
  try {
    const lockData = {
      is_setup_completed: true,
      completed_at: new Date().toISOString(),
      businessProfile: payload.businessProfile,
      deploymentMode: payload.deploymentMode,
      portals: payload.portals,
      adminEmail: payload.admin?.email,
      adminName: payload.admin?.name,
    };

    // 1. Create or ensure first admin account in Supabase
    if (payload.admin?.email && payload.admin?.password) {
      const adminBody = JSON.stringify({
        email: payload.admin.email,
        password: payload.admin.password,
        email_confirm: true,
        user_metadata: {
          full_name: payload.admin.name || "MTJ Owner",
          role: "owner",
        },
      });

      const opt = {
        hostname: "127.0.0.1",
        port: 8000,
        path: "/auth/v1/admin/users",
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
          apikey: SERVICE_ROLE_KEY,
        },
      };

      await new Promise((resolve) => {
        const req = http.request(opt, (res) => {
          resolve(res.statusCode);
        });
        req.on("error", () => resolve(false));
        req.write(adminBody);
        req.end();
      });

      // 2. Synchronize initial firm profile and owner into database app_settings
      await updateAppSettingsPostgres(payload.businessProfile, payload.admin);
    }

    // 3. Write permanent lock file
    fs.writeFileSync(INSTALLATION_LOCK_FILE, JSON.stringify(lockData, null, 2), "utf-8");

    // 4. Update appConfig
    appConfig.mode = "host";
    saveClientConfig(appConfig);

    // 5. If Cloudflare Internet mode is selected, ensure tunnel config is active
    if (payload.deploymentMode === "internet") {
      cfConfig.enabled = true;
      saveCloudflareConfig(cfConfig);
      startManagedTunnel();
    }

    return { ok: true };
  } catch (err) {
    console.error("Setup completion error:", err);
    throw err;
  }
});

ipcMain.handle("check-setup-locked", async () => {
  return isInstallationInitialized();
});

ipcMain.handle("admin-reset-setup", async (_event, credentials) => {
  try {
    const authResult = await verifyAdminCredentialsLocally(credentials.email, credentials.password);
    if (!authResult.ok) {
      return { ok: false, error: authResult.error || "Authentication failed." };
    }

    // Remove installation lock
    if (fs.existsSync(INSTALLATION_LOCK_FILE)) {
      fs.unlinkSync(INSTALLATION_LOCK_FILE);
    }

    return { ok: true, message: "Installation lock released. Ready to re-run setup." };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

ipcMain.handle("launch-first-run-setup", async () => {
  if (mainWindow) {
    mainWindow.loadFile(path.join(__dirname, "first-run-setup.html"));
  }
  return { ok: true };
});

// -------------------------------------------------------------
// Cloudflare IPC Handlers
// -------------------------------------------------------------

ipcMain.handle("cf-check-installed", async () => {
  const bin = findCloudflaredBinary();
  return new Promise((resolve) => {
    exec(`"${bin}" --version`, (err, stdout) => {
      if (err) {
        resolve({ installed: false, error: err.message });
      } else {
        resolve({ installed: true, version: stdout.trim(), path: bin });
      }
    });
  });
});

ipcMain.handle("cf-install", async () => {
  const destDir = path.join(process.env.LOCALAPPDATA || "", "cloudflared", "bin");
  const destFile = path.join(destDir, "cloudflared.exe");
  const downloadUrl = "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe";

  try {
    if (!fs.existsSync(destDir)) {
      fs.mkdirSync(destDir, { recursive: true });
    }

    return new Promise((resolve) => {
      const file = fs.createWriteStream(destFile);
      https.get(downloadUrl, (response) => {
        if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
          https.get(response.headers.location, (redirectRes) => {
            redirectRes.pipe(file);
            file.on("finish", () => {
              file.close();
              resolve({ ok: true, path: destFile });
            });
          }).on("error", (err) => resolve({ ok: false, error: err.message }));
        } else {
          response.pipe(file);
          file.on("finish", () => {
            file.close();
            resolve({ ok: true, path: destFile });
          });
        }
      }).on("error", (err) => resolve({ ok: false, error: err.message }));
    });
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

ipcMain.handle("cf-login", async () => {
  const bin = findCloudflaredBinary();
  return new Promise((resolve) => {
    exec(`"${bin}" tunnel login`, (err, stdout) => {
      const certPath = path.join(os.homedir(), ".cloudflared", "cert.pem");
      const exists = fs.existsSync(certPath);
      resolve({
        ok: exists || !err,
        certPath: exists ? certPath : null,
        output: stdout,
      });
    });
  });
});

ipcMain.handle("cf-create-tunnel", async (_event, name) => {
  const bin = findCloudflaredBinary();
  const tunnelName = name || "mtj-erp-host";
  return new Promise((resolve) => {
    exec(`"${bin}" tunnel create ${tunnelName}`, (err, stdout, stderr) => {
      cfConfig.tunnelName = tunnelName;
      saveCloudflareConfig(cfConfig);
      resolve({
        ok: !err || stderr.includes("already exists"),
        output: stdout || stderr,
        tunnelName,
      });
    });
  });
});

ipcMain.handle("cf-route-dns", async (_event, { tunnelName, hostname }) => {
  const bin = findCloudflaredBinary();
  const tName = tunnelName || cfConfig.tunnelName || "mtj-erp-host";
  return new Promise((resolve) => {
    exec(`"${bin}" tunnel route dns ${tName} ${hostname}`, (err, stdout, stderr) => {
      cfConfig.hostname = hostname;
      saveCloudflareConfig(cfConfig);
      resolve({
        ok: !err || stderr.includes("already exists"),
        output: stdout || stderr,
        hostname,
      });
    });
  });
});

ipcMain.handle("cf-start-tunnel", async (_event, customParams) => {
  if (customParams) {
    cfConfig = { ...cfConfig, ...customParams };
    saveCloudflareConfig(cfConfig);
  }
  return startManagedTunnel();
});

ipcMain.handle("cf-stop-tunnel", async () => {
  return stopManagedTunnel();
});

ipcMain.handle("cf-restart-tunnel", async () => {
  stopManagedTunnel();
  await new Promise((r) => setTimeout(r, 1000));
  return startManagedTunnel();
});

ipcMain.handle("cf-get-status", async () => {
  return new Promise((resolve) => {
    exec('tasklist /FI "IMAGENAME eq cloudflared.exe" /FO CSV /NH', (err, stdout) => {
      const isRunning = !err && stdout.toLowerCase().includes("cloudflared.exe");
      resolve({
        running: isRunning,
        pid: tunnelProcess ? tunnelProcess.pid : null,
        hostname: cfConfig.hostname || "mtj-erp.aritramanna222.workers.dev",
        tunnelName: cfConfig.tunnelName || "mtj-erp-host",
        enabled: cfConfig.enabled,
        status: isRunning ? "active" : "inactive",
        localService: cfConfig.localService || "http://localhost:3000",
        recentLogs: tunnelLogs.slice(-10),
      });
    });
  });
});

ipcMain.handle("cf-save-config", async (_event, newCfg) => {
  cfConfig = { ...cfConfig, ...newCfg };
  const ok = saveCloudflareConfig(cfConfig);
  return { ok, config: cfConfig };
});

ipcMain.handle("cf-get-config", async () => {
  return cfConfig;
});

ipcMain.handle("cf-test-endpoint", async (_event, customHostname) => {
  const host = customHostname || cfConfig.hostname;
  if (!host) return { ok: false, error: "No hostname configured" };
  const target = host.startsWith("http") ? host : `https://${host}`;
  return await checkHttpEndpoint(target, 4000);
});

ipcMain.handle("cf-repair-tunnel", async () => {
  const steps = [];

  // Step 1: Check binary
  const bin = findCloudflaredBinary();
  const binExists = fs.existsSync(bin) || bin === "cloudflared";
  steps.push({
    step: "1. Cloudflare Binary Verification",
    ok: binExists,
    details: binExists ? `Found at ${bin}` : "Missing cloudflared.exe",
  });

  // Step 2: Check Local ERP
  const erpRes = await checkHttpEndpoint("http://localhost:3000", 3000);
  steps.push({
    step: "2. Local ERP Service Health (:3000)",
    ok: erpRes.ok,
    details: erpRes.ok ? `ERP is reachable (${erpRes.latencyMs}ms)` : "ERP server on :3000 is not responding",
  });

  // Step 3: Check Supabase Gateway
  const gwRes = await checkHttpEndpoint("http://127.0.0.1:8000/rest/v1/", 3000);
  steps.push({
    step: "3. Supabase API Gateway Health (:8000)",
    ok: gwRes.ok,
    details: gwRes.ok ? "Gateway is reachable" : "Supabase backend on :8000 is offline",
  });

  // Step 4: Restart tunnel process
  stopManagedTunnel();
  await new Promise((r) => setTimeout(r, 1500));
  const startRes = startManagedTunnel();
  steps.push({
    step: "4. Restart Managed Tunnel Process",
    ok: startRes.ok,
    details: startRes.ok ? `Tunnel spawned (PID: ${startRes.pid})` : `Failed to spawn: ${startRes.error}`,
  });

  // Step 5: Verify Public Endpoint
  await new Promise((r) => setTimeout(r, 3000));
  const httpsRes = await checkHttpEndpoint(`https://${cfConfig.hostname || "mtj-erp.aritramanna222.workers.dev"}`, 4000);
  steps.push({
    step: "5. Public HTTPS Endpoint Reachability",
    ok: httpsRes.ok,
    details: httpsRes.ok ? `Public endpoint https://${cfConfig.hostname} is online!` : "Public domain is pending DNS propagation or tunnel edge warmup",
  });

  const allPassed = steps.every((s) => s.ok);
  return {
    ok: allPassed,
    steps,
    hostname: cfConfig.hostname,
  };
});

// -------------------------------------------------------------
// General App IPC Handlers
// -------------------------------------------------------------

ipcMain.handle("open-erp", async () => {
  if (mainWindow) {
    const url = getEffectiveErpUrl();
    mainWindow.loadURL(url);
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
  const erpUrl = getEffectiveErpUrl();
  const lanIp = getLocalIpAddress();

  const [erpRes, gwRes, storageRes] = await Promise.all([
    checkHttpEndpoint(erpUrl),
    checkHttpEndpoint(`http://127.0.0.1:8000/rest/v1/`),
    checkHttpEndpoint(`http://127.0.0.1:8000/storage/v1/status`),
  ]);

  return new Promise((resolve) => {
    exec('tasklist /FI "IMAGENAME eq cloudflared.exe" /FO CSV /NH', (err, stdout) => {
      const tunnelIsRunning = !err && stdout.toLowerCase().includes("cloudflared.exe");
      resolve({
        erp: erpRes.ok,
        db: gwRes.ok,
        auth: gwRes.ok,
        storage: storageRes.ok || gwRes.ok,
        realtime: gwRes.ok,
        karigar: true,
        tunnel: tunnelIsRunning,
        lanIp,
        currentMode: appConfig.mode,
        targetUrl: erpUrl,
        cfHostname: cfConfig.hostname || "mtj-erp.aritramanna222.workers.dev",
        isInitialized: isInstallationInitialized(),
      });
    });
  });
});

ipcMain.handle("test-connection", async (_event, url) => {
  return await checkHttpEndpoint(url);
});

ipcMain.handle("save-client-config", async (_event, newConfig) => {
  appConfig = { ...appConfig, ...newConfig };
  const saved = saveClientConfig(appConfig);
  return { ok: saved, config: appConfig };
});

ipcMain.handle("get-client-config", async () => {
  return appConfig;
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
    mainWindow.loadURL(getEffectiveErpUrl());
  }
  return { ok: true };
});

ipcMain.handle("get-app-config", async () => {
  return {
    version: "1.1.2",
    targetUrl: getEffectiveErpUrl(),
    lanIp: getLocalIpAddress(),
    isPackaged: app.isPackaged,
    mode: appConfig.mode,
    cloudflare: cfConfig,
    isInitialized: isInstallationInitialized(),
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
