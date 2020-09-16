const { BrowserView, ipcMain } = require('electron');
const path = require('path');

exports = module.exports = async function (win) {
    const DownloadPanel = new BrowserView({
        webPreferences: {
            contextIsolation: true,
            enableRemoteModule: false,
            devTools: false,
            preload: path.join(__dirname, 'preload.js')
        }
    });

    let isOpened = false;

    ipcMain.on('OpenDownloadPanel', () => {
        if (!isOpened) {
            const bounds = DownloadPanel.getBounds();
            bounds.width = win.getContentBounds().width;
            DownloadPanel.setBounds(bounds);
            DownloadPanel.webContents.send('ShowDownloadPanel');
            DownloadPanel.webContents.focus();
            isOpened = true;
        }
    });

    ipcMain.on('CloseDownloadPanel', () => {
        if (isOpened) {
            const bounds = DownloadPanel.getBounds();
            bounds.width = 0;
            DownloadPanel.setBounds(bounds);
            isOpened = false;
        }
    });

    DownloadPanel.setBounds({ x: 0, y: 0, width: 0, height: win.getContentBounds().height });
    DownloadPanel.setAutoResize({ width: true, height: true, horizontal: true });
    await DownloadPanel.webContents.loadFile('../pages/download-panel.html');
    return DownloadPanel;
}
