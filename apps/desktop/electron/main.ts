import { app, BrowserWindow, clipboard, globalShortcut, ipcMain, Menu, Tray } from "electron";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;

const isDev = Boolean(process.env.VITE_DEV_SERVER_URL) || !app.isPackaged;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1120,
    height: 760,
    minWidth: 920,
    minHeight: 640,
    titleBarStyle: "hiddenInset",
    backgroundColor: "#f7f4ec",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  if (isDev) {
    void mainWindow.loadURL("http://127.0.0.1:5173");
  } else {
    void mainWindow.loadFile(path.join(__dirname, "../dist/index.html"));
  }
}

function createTray() {
  tray = new Tray(path.join(__dirname, "../dist/tray.png"));
  tray.setToolTip("Keyword Memory");
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: "打开速记", click: () => mainWindow?.show() },
      { type: "separator" },
      { label: "退出", click: () => app.quit() }
    ])
  );
}

app.whenReady().then(() => {
  createWindow();

  globalShortcut.register("CommandOrControl+Shift+K", () => {
    mainWindow?.show();
    mainWindow?.focus();
    mainWindow?.webContents.send("quick-capture");
  });

  try {
    createTray();
  } catch {
    tray = null;
  }
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

app.on("will-quit", () => {
  globalShortcut.unregisterAll();
});

ipcMain.handle("clipboard:read-text", () => clipboard.readText());
