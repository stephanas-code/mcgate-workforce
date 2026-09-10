const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('path');
const http = require('http');
const fs = require('fs');

let mainWindow = null;
let serverInstance = null;
let serverPort = null;

// Ensure single instance of the desktop application
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
}

/**
 * Starts the embedded Express application on a free local port
 */
async function startEmbeddedServer() {
  // Point database storage to user application data directory
  const userDataDir = app.getPath('userData');
  process.env.DESKTOP_USER_DATA = userDataDir;
  process.env.NODE_ENV = 'production';

  // Ensure data directory exists in userData
  const appDataDir = path.join(userDataDir, 'data');
  if (!fs.existsSync(appDataDir)) {
    fs.mkdirSync(appDataDir, { recursive: true });
  }

  // If seeded db exists in application resources, copy if not already in userData
  const seedCandidates = [
    path.join(__dirname, '..', 'data', 'mcgate.sqlite'),
    path.join(process.resourcesPath || '', 'data', 'mcgate.sqlite')
  ];
  const userDbFile = path.join(appDataDir, 'mcgate.sqlite');
  if (!fs.existsSync(userDbFile)) {
    for (const seed of seedCandidates) {
      if (fs.existsSync(seed)) {
        try {
          fs.copyFileSync(seed, userDbFile);
          break;
        } catch (e) {
          console.warn('[Desktop Server] Could not copy seed DB:', e);
        }
      }
    }
  }

  // Load the pre-bundled server or local entrypoint
  const serverPath = path.join(__dirname, '..', 'dist', 'server.cjs');
  let expressApp;

  if (fs.existsSync(serverPath)) {
    // In production package, the server is bundled into dist/server.cjs
    try {
      // server.cjs starts listening on its own port or exports the handler
      delete require.cache[require.resolve(serverPath)];
      require(serverPath);
    } catch (err) {
      console.error('[Desktop Server] Failed to start dist/server.cjs:', err);
    }
  }

  // Wait for the local server to respond on standard local port (default 3000)
  serverPort = 3000;
  return new Promise((resolve) => {
    const checkServer = (retries = 20) => {
      const req = http.get(`http://127.0.0.1:${serverPort}/api/health`, (res) => {
        if (res.statusCode === 200 || res.statusCode === 401 || res.statusCode === 404) {
          resolve(serverPort);
        } else if (retries > 0) {
          setTimeout(() => checkServer(retries - 1), 250);
        } else {
          resolve(serverPort);
        }
      });
      req.on('error', () => {
        if (retries > 0) {
          setTimeout(() => checkServer(retries - 1), 250);
        } else {
          resolve(serverPort);
        }
      });
      req.end();
    };
    checkServer();
  });
}

/**
 * Creates the primary desktop BrowserWindow
 */
function createMainWindow(port) {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 1080,
    minHeight: 700,
    title: 'McGate Workforce - Enterprise Operations',
    backgroundColor: '#030712',
    icon: path.join(__dirname, '..', 'public', 'favicon.svg'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true
    },
    autoHideMenuBar: true
  });

  mainWindow.loadURL(`http://127.0.0.1:${port}`);

  // Open external links in default OS browser rather than inside Electron
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http://') || url.startsWith('https://')) {
      shell.openExternal(url);
    }
    return { action: 'deny' };
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// Window controls IPC
ipcMain.on('window-minimize', () => {
  if (mainWindow) mainWindow.minimize();
});

ipcMain.on('window-maximize', () => {
  if (mainWindow) {
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow.maximize();
    }
  }
});

ipcMain.on('window-close', () => {
  if (mainWindow) mainWindow.close();
});

app.whenReady().then(async () => {
  const port = await startEmbeddedServer();
  createMainWindow(port);

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow(port);
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  if (serverInstance) {
    try {
      serverInstance.close();
    } catch {}
  }
});
