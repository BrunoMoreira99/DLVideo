const { app, BrowserWindow, ipcMain } = require('electron');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');
const initBrowserView = require('./browser-view');
const initDownloadPanel = require('./download-panel');
const initVideoScrapper = require('./util/VideoScrapper');

let ScrappedVideos = null;

async function createWindow () {
    const win = new BrowserWindow({
        width: 1366,
        height: 768,
        minWidth: 540,
        minHeight: 480,
        useContentSize: true,
        autoHideMenuBar: true,
        backgroundColor: '#20232a',
        webPreferences: {
            contextIsolation: true,
            enableRemoteModule: false,
            devTools: false,
            preload: path.join(__dirname, 'preload.js')
        }
    });

    const view = await initBrowserView(win);
    const DownloadPanel = await initDownloadPanel(win);
    ScrappedVideos = initVideoScrapper(win, view, DownloadPanel);
    await win.webContents.loadFile(path.join(__dirname, '../pages/home.html'));

    ipcMain.on('OpenPage', async (e, input) => {
        try {
            if (!input.startsWith('http')) {
                input = `https://www.google.com/search?q=${encodeURIComponent(input)}`;
            }
            const url = new URL(input);
            win.addBrowserView(view);
            win.addBrowserView(DownloadPanel);
            view.setBounds({ x: 0, y: 0, width: win.getContentBounds().width, height: win.getContentBounds().height - 70 });
            view.setAutoResize({ width: true, height: true });
            await win.webContents.loadFile(path.join(__dirname, '../pages/browser-view.html'));

            if (url.host.includes('reddit.com')) url.host = 'old.reddit.com';
            await view.webContents.loadURL(url.href);
        } catch (err) {
            console.log('Error on OpenPage:', err);
        }
    });

    ipcMain.on('ReturnHome', async () => {
        await win.webContents.loadFile(path.join(__dirname, '../pages/browser-view.html'));
        win.setBrowserView(null);
        ScrappedVideos.clear();
    });
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(createWindow);

// Quit when all windows are closed.
app.on('window-all-closed', async function () {
    if (ScrappedVideos) {
        const promises = [];
        ScrappedVideos.forEach((video) => {
            if (!video.isUnderDownload) return;
            promises.push(new Promise((resolve) => {
                if (video.downloadItem) {
                    video.downloadItem.cancel();
                    return resolve();
                }
                if (video.ffmpegCommand) {
                    video.ffmpegCommand.removeAllListeners();
                    video.ffmpegCommand.once('error', () => {
                        fs.unlink(video.savePath, () => resolve());
                    });
                    video.ffmpegCommand.kill('SIGKILL');
                }
            }));
        });
        await Promise.allSettled(promises);
    }
    if (process.platform !== 'darwin') app.quit();
});

app.on('activate', async function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) await createWindow();
});
