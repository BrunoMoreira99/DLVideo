const { BrowserView, ipcMain } = require('electron');
const path = require('path');
const { URL } = require('url');
const initAdBlocker = require('./util/AdBlocker');

exports = module.exports = async function (win) {
    const view = new BrowserView({
        webPreferences: {
            contextIsolation: true,
            enableRemoteModule: false,
            sandbox: true,
            devTools: false,
            preload: path.join(__dirname, 'observer.js')
        }
    });

    view.webContents.session.setPermissionRequestHandler((webContents, permission, callback) => {
        callback(false);
    });

    view.webContents.on('dom-ready', () => {
        view.webContents.insertCSS(`
            html {
                overflow-x: hidden !important;
            }
            body::-webkit-scrollbar {
                all: initial !important;
                width: 14px !important;
            }
            body::-webkit-scrollbar-thumb {
                all: initial !important;
                background-clip: padding-box !important;
                background-color: rgba(85, 89, 94, 0.5) !important;
            }
            body::-webkit-scrollbar-thumb:hover {
                background-color: rgba(85, 89, 94, 1) !important;
            }
            body::-webkit-scrollbar-track {
                all: initial !important;
                background: #36393f !important;
            }
            body::-webkit-scrollbar-track-piece {
                all: initial !important;
            }
            body::-webkit-scrollbar-button {
                all: initial !important;
                width: 0 !important;
                height: 0 !important;
                display: none !important;
            }
            body::-webkit-scrollbar-corner {
                all: initial !important;
            }`
        );
    });

    view.webContents.on('will-navigate', (e, url) => {
        if (url.includes('reddit.com')) {
            e.preventDefault();
            url = new URL(url);
            url.host = 'old.reddit.com';
            view.webContents.loadURL(url.href);
        }
    });

    view.webContents.on('new-window', (e) => {
        e.preventDefault();
    });

    function onNavigation() {
        win.webContents.send('DidNavigation', {
            canGoBack: view.webContents.canGoBack(),
            canGoForward: view.webContents.canGoForward()
        });
    }

    view.webContents.on('did-navigate', () => onNavigation());
    view.webContents.on('did-frame-navigate', () => onNavigation());
    view.webContents.on('did-navigate-in-page', () => onNavigation());

    ipcMain.on('navigationBack', () => view.webContents.goBack());
    ipcMain.on('navigationForward', () => view.webContents.goForward());
    ipcMain.on('pageReload', () => view.webContents.reload());
    ipcMain.handle('copyURL', () => view.webContents.getURL());

    await initAdBlocker(view.webContents.session);
    return view;
}
