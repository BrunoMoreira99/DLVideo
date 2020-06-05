const fs = require('fs');
const querystring = require('querystring');
const { ipcMain, dialog } = require('electron');
const Video = require('../../classes/Video');

exports = module.exports = function(win, view, DownloadPanel) {
    class ScrappedVideosCollection extends Map {
        constructor() {
            super();
            this.audioStreams = [];
        }

        async add (data) {
            if (this.has(data.source)) return this;
            try {
                super.set(data.source, null);
                const video = new Video(data);
                await video.extractMetadata();
                if (!video.videoStream && video.audioStream) {
                    const audio = video;
                    this.audioStreams.push(audio);
                    this.forEach((video, src) => {
                        if (video.audioStream && !video._altAudio) return;
                        // If the video already has an audio stream, ignore it, but, if it's using an alt audio stream,
                        // check if the this audio stream is a better fit for it.
                        // Or use this audio stream if the video has no audio stream at all, be it its own or an alt.
                        if (video.source.startsWith(audio.source.substring(0, audio.source.lastIndexOf('/'))) || (!video.source.includes('v.redd.it') && !video._altAudio)) {
                            video.useAltAudioStream(audio);
                            DownloadPanel.webContents.send('SetVideoAudioStream', src, audio.serialize());
                        }
                    });
                    return this;
                } else if (video.videoStream && !video.audioStream && this.audioStreams.length) {
                    // If video doesn't have an audio stream but there's at least one audio stream-only available,
                    // find the best fit for this video or if none found, the first in the audioStreams array.
                    // Note: Reddit must always match URL (except file).
                    const audioStream = this.audioStreams.find((a) => video.source.startsWith(a.source.substring(0, a.source.lastIndexOf('/'))));
                    if (audioStream) video.useAltAudioStream(audioStream);
                    else if (!video.source.includes('v.redd.it')) {
                        video.useAltAudioStream(this.audioStreams[0]);
                    }
                }
                super.set(video.source, video);
                DownloadPanel.webContents.send('AddNewVideo', video.serialize());
                win.webContents.send('SetVideoCount', this.size);
                video.getThumbnail().then((base64) => {
                    DownloadPanel.webContents.send('SetVideoThumbnail', video.source, base64);
                });
            } catch {
                this.delete(data.source);
            }
            return this;
        }

        delete (videoSrc) {
            const _result = super.delete(videoSrc);
            if (_result) DownloadPanel.webContents.send('DeleteVideo', videoSrc);
            return _result;
        }

        clear () {
            super.forEach((value, key) => {
                if (value === null) return super.delete(key);
                if (!value.isUnderDownload) this.delete(key);
            }, this);
            this.audioStreams = [];
            win.webContents.send('SetVideoCount', this.size);
        }

        get size () {
            let _size = 0;
            super.forEach((value) => {
                if (value) ++_size;
            }, this);
            return _size;
        }
    }

    const ScrappedVideos = new ScrappedVideosCollection();

    view.webContents.on('will-navigate', () => {
        ScrappedVideos.clear();
    });

    view.webContents.session.webRequest.onResponseStarted(async (details) => {
        if (!details.responseHeaders) return;
        let contentType = false;
        Object.keys(details.responseHeaders).forEach((key)  => {
            if (key.toLowerCase() === 'content-type') {
                contentType = Array.isArray(details.responseHeaders[key]) ? details.responseHeaders[key][0] : details.responseHeaders[key];
            }
        });
        if (!contentType) return;
        if (!/video|mpegURL|audio/i.test(contentType)) return;
        if (details.url.split('?')[0].split('/').pop().split('.').pop() === 'ts') return;
        const queryIndex = details.url.indexOf('?');
        if (~queryIndex) {
            const query = querystring.parse(details.url.substring(queryIndex + 1));
            if (query['bytestart']) delete query['bytestart'];
            if (query['byteend']) delete query['byteend'];
            details.url = `${details.url.slice(0, queryIndex + 1)}${querystring.stringify(query)}`;
        }
        await ScrappedVideos.add({
            title: view.webContents.getTitle(),
            source: details.url
        });
    });

    ipcMain.on('ObserverFoundVideo', async (e, videoSource) => {
        if (!videoSource.startsWith('http')) return;
        await ScrappedVideos.add({
            title: view.webContents.getTitle(),
            source: videoSource
        });
    });

    ipcMain.handle('StartVideoDownload', async (e, src) => {
        const video = ScrappedVideos.get(src);
        if (!video) throw new Error('Video was not found!');
        const title = (video.title || video.pageTitle).replace(/[<>:"\/\\|?*]+/g, '');
        const defaultPath = `${title}.${video.finalFileFormat}`;
        const prompt = await dialog.showSaveDialog(win, { defaultPath });
        if (prompt.canceled || !prompt.filePath) return false;
        let path = prompt.filePath;
        if (!path.includes('.')) path += `.${video.finalFileFormat}`;
        let extension = path.split('.').pop();
        if (extension !== video.finalFileFormat && extension !== 'mkv') {
            extension = video.finalFileFormat;
            path = `${path.slice(0, -extension.length)}${extension}`;
        }
        video.savePath = path;
        if (extension !== video.extension || video._altAudio) {
            const ffmpeg = video.setupFFmpegCommand();
            ffmpeg.on('start', (commandLine) => {
                video.isUnderDownload = true;
                console.log(`FFMPEG Command: ${commandLine}`);
            });
            ffmpeg.on('progress', (progress) => {
                const bytesReceived = progress.targetSize * 1024;
                const percent = Math.min(progress.percent, 100);
                const canResume = process.platform === 'linux';
                DownloadPanel.webContents.send('DownloadProgress', src, { bytesReceived, percent, canResume });
            });
            ffmpeg.on('error', (err, stdout, stderr) => {
                video.isUnderDownload = false;
                fs.unlink(video.savePath, () => {});
                if (err.message.includes('SIGKILL')) return;
                DownloadPanel.webContents.send('DownloadError', src);
                console.error(err.message, stderr);
            });
            ffmpeg.on('end', () => {
                video.isUnderDownload = false;
                DownloadPanel.webContents.send('DownloadComplete', src);
            });
            ffmpeg.run();
        } else {
            view.webContents.downloadURL(src);
        }
        return true;
    });

    ipcMain.handle('PauseVideoDownload', (e, src) => {
        const video = ScrappedVideos.get(src);
        if (video.isUnderDownload) {
            if (!video.isDownloadPaused) {
                video.isDownloadPaused = true;
                if (video.downloadItem) {
                    video.downloadItem.pause();
                    return 1;
                }
                if (video.ffmpegCommand) {
                    video.ffmpegCommand.kill('SIGSTOP');
                    return 1;
                }
            } else {
                video.isDownloadPaused = false;
                if (video.downloadItem) {
                    video.downloadItem.resume();
                    return 2;
                }
                if (video.ffmpegCommand) {
                    video.ffmpegCommand.kill('SIGCONT');
                    return 2;
                }
            }
        }
        return 0;
    });

    ipcMain.handle('CancelVideoDownload', (e, src) => {
        const video = ScrappedVideos.get(src);
        if (video.isUnderDownload) {
            video.isUnderDownload = false;
            if (video.downloadItem) {
                video.downloadItem.cancel();
                return true;
            }
            if (video.ffmpegCommand) {
                video.ffmpegCommand.kill('SIGKILL');
                return true;
            }
        }
        return false;
    });

    view.webContents.session.on('will-download', (e, item) => {
        const src = item.getURL();
        const video = ScrappedVideos.get(src);
        video.downloadItem = item;
        item.setSavePath(video.savePath);
        item.on('updated', (e, state) => {
            video.isUnderDownload = true;
            if (state === 'progressing') {
                const totalSize = item.getTotalBytes() || video.size;
                const bytesReceived = item.getReceivedBytes();
                const percent = !totalSize ? null : bytesReceived / totalSize * 100;
                const canResume = item.getETag() && item.getLastModifiedTime();
                DownloadPanel.webContents.send('DownloadProgress', src, { bytesReceived, percent, canResume });
            }
        });
        item.once('done', (e, state) => {
            if (state === 'completed') {
                DownloadPanel.webContents.send('DownloadComplete', src);
                video.isUnderDownload = false;
            } else if (state === 'interrupted') {
                DownloadPanel.webContents.send('DownloadError', src);
            }
        });
    });

    return ScrappedVideos;
}
