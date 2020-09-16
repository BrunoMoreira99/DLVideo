const { contextBridge, ipcRenderer, webFrame } = require('electron');

contextBridge.exposeInMainWorld('api', {
    foundVideoSource: (src) => ipcRenderer.send('ObserverFoundVideo', src)
});

webFrame.executeJavaScript(`
    const subtreeObserver = new MutationObserver(scrapVideos);
    const videoObserver = new MutationObserver(videoMutation);
    const observedVideos = new Set();
    
    window.addEventListener('load', () => {
        subtreeObserver.observe(document.body, { subtree: true, childList: true });
        scrapVideos();
    });
    
    function scrapVideos() {
        const videoElements = document.querySelectorAll('video');
        for (const video of videoElements) {
            if (observedVideos.has(video)) return;
            const videoSrc = video.getAttribute('src')
            if (videoSrc) window.api.foundVideoSource(videoSrc);
            videoObserver.observe(video, { attributes: true, attributeFilter: ['src'] });
            observedVideos.add(video);
        }
    }

    function videoMutation(mutationsList, observer) {
        for (const mutation of mutationsList) {
            if (mutation.type === 'attributes' && mutation.target.getAttribute('src')) {
                window.api.foundVideoSource(mutation.target.getAttribute('src'));
            }
        }
    }
`);
