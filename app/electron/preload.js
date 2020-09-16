const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
    openPage: (url) => ipcRenderer.send('OpenPage', url),
    returnHome: () => ipcRenderer.send('ReturnHome'),
    goBack: () => ipcRenderer.send('navigationBack'),
    goForward: () => ipcRenderer.send('navigationForward'),
    reload: () => ipcRenderer.send('pageReload'),
    copyURL: () => ipcRenderer.invoke('copyURL'),
    onNavigation: (callback) => ipcRendererListener('DidNavigation', callback),

    openDownloadPanel: () => ipcRenderer.send('OpenDownloadPanel'),
    closeDownloadPanel: () => ipcRenderer.send('CloseDownloadPanel'),
    onShowDownloadPanel: (callback) => ipcRendererListener('ShowDownloadPanel', callback),

    onSetVideoCount: (callback) => ipcRendererListener('SetVideoCount', callback),
    onAddNewVideo: (callback) => ipcRendererListener('AddNewVideo', callback),
    onSetVideoAudioStream: (callback) => ipcRendererListener('SetVideoAudioStream', callback),
    onSetVideoThumbnail: (callback) => ipcRendererListener('SetVideoThumbnail', callback),
    onDeleteVideo: (callback) => ipcRendererListener('DeleteVideo', callback),

    startVideoDownload: (src) => ipcRenderer.invoke('StartVideoDownload', src),
    pauseVideoDownload: (src) => ipcRenderer.invoke('PauseVideoDownload', src),
    cancelVideoDownload: (src) => ipcRenderer.invoke('CancelVideoDownload', src),
    onDownloadProgress: (callback) => ipcRendererListener('DownloadProgress', callback),
    onDownloadError: (callback) => ipcRendererListener('DownloadError', callback),
    onDownloadComplete: (callback) => ipcRendererListener('DownloadComplete', callback)
});

function ipcRendererListener(channel, callback) {
    return ipcRenderer.on(channel, (e, ...args) => callback(...args));
}
