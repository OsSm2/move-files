const { app, BrowserWindow, ipcMain, dialog, protocol, net } = require('electron');
const path = require('path');
const fs = require('fs-extra');

// Fix for SUID sandbox issues on Linux
app.commandLine.appendSwitch('no-sandbox');
app.commandLine.appendSwitch('disable-setuid-sandbox');

const SETTINGS_PATH = path.join(app.getPath('userData'), 'settings.json');

protocol.registerSchemesAsPrivileged([
  { scheme: 'media', privileges: { bypassCSP: true, stream: true } }
]);

function createWindow() {
  const win = new BrowserWindow({
    width: 1300,
    height: 900,
    title: "Move Files",
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true
    }
  });
  win.loadFile('index.html');
}

app.whenReady().then(() => {
  protocol.handle('media', (request) => {
    const filePath = decodeURIComponent(request.url.slice('media://'.length));
    return net.fetch('file://' + filePath);
  });
  createWindow();
});

ipcMain.handle('get-files', async (event, dir) => {
  if (!dir) return [];
  try {
    const files = await fs.readdir(dir);
    return files
      .filter(f => /\.(jpg|jpeg|png|gif|webp|mp4|webm|mov)$/i.test(f))
      .map(f => path.join(dir, f));
  } catch (e) { return []; }
});

ipcMain.handle('select-source', async () => {
  const result = await dialog.showOpenDialog({ properties: ['openDirectory'] });
  return result.canceled ? null : result.filePaths[0];
});

ipcMain.handle('select-dest', async () => {
  const result = await dialog.showOpenDialog({ 
    properties: ['openDirectory', 'multiSelections'] 
  });
  return result.canceled ? null : result.filePaths;
});

ipcMain.handle('move-file', async (event, { oldPath, newDir }) => {
  const fileName = path.basename(oldPath);
  const newPath = path.join(newDir, fileName);
  await fs.move(oldPath, newPath);
  return true;
});

ipcMain.handle('save-settings', async (event, settings) => {
  await fs.writeJson(SETTINGS_PATH, settings);
});

ipcMain.handle('load-settings', async () => {
  if (await fs.pathExists(SETTINGS_PATH)) {
    return await fs.readJson(SETTINGS_PATH);
  }
  return null;
});