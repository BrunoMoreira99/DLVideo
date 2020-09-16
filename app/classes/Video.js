const ffmpegPath = require('ffmpeg-static').replace('app.asar', 'app.asar.unpacked');
const ffprobePath = require('ffprobe-static').path.replace('app.asar', 'app.asar.unpacked');
const ffmpeg = require('fluent-ffmpeg');
ffmpeg.setFfmpegPath(ffmpegPath);
ffmpeg.setFfprobePath(ffprobePath);

/**
 * Represents a video
 * @prop pageTitle {String} The title of the page where the video is located
 * @prop title {String?} The title of the video extracted from the metadata if present
 * @prop names {String[]} An array with possible names for the video
 * @prop source {String} The URL source of the video
 * @prop filename {String?} The filename of the video, including the extension if present
 * @prop duration {Number?} The duration of the video in seconds
 * @prop width {Number?} The width of the video
 * @prop height {Number?} The height of the video
 * @prop bitrate {Number?} The bitrate of the video
 * @prop framerate {Number?} The framerate of the video
 * @prop videoCodec {String?} The codec of the video
 * @prop audioCodec {String?} The codec of the audio
 * @prop extension {String?} The extension of the video extracted from the filename
 * @prop formats {String[]?} Possible container formats for this video
 * @prop finalFileFormat {String?} The container format to use for this video file
 * @prop size {Number?} The size of the video in bytes
 */
class Video {
    constructor(data) {
        if (!data.source) throw new Error('No video source given.');
        this.pageTitle = data.title;
        this.source = data.source;
        this._metadata = null;
        this._videoStream = null;
        this._audioStream = null;
        this._altAudio = null;
        this._thumbnail = null;
        this.savePath = null;
        this.ffmpegCommand = null;
        this.downloadItem = null;
        this.isUnderDownload = false;
        this.isDownloadPaused = false;
    }

    extractMetadata () {
        return new Promise((resolve, reject) => {
            ffmpeg.ffprobe(this.source, (err, metadata) => {
                if (err) return reject(err);
                this._metadata = metadata;
                return resolve(metadata);
            });
        });
    }

    generateThumbnail () {
        return new Promise((resolve, reject) => {
            const chunks = [];
            const stream = ffmpeg(this.source).seekInput(1).outputOptions(['-vframes 1', '-f image2']).pipe();
            stream.on('data', (chunk) => { chunks.push(chunk); });
            stream.once('end', () => {
                resolve('data:image/jpeg;base64,' + Buffer.concat(chunks).toString('base64'));
            });
            stream.once('error', (err) => {
                reject(err);
            });
        });
    }

    async getThumbnail () {
        if (!this.videoStream) return null;
        if (!this._thumbnail) {
            this._thumbnail = await this.generateThumbnail();
        }
        return this._thumbnail;
    }

    get sourceNoQuery () {
        return this.source.split('?')[0];
    }

    get filename () {
        return this.sourceNoQuery.split('/').pop();
    }

    get title () {
        if (!this._metadata) return null;
        if (this._metadata.format.tags && this._metadata.format.tags.title) return this._metadata.format.tags.title;
    }

    get names () {
        const names = new Set();
        names.add(this.pageTitle);
        if (this.filename) names.add(this.filename);
        if (this.title) names.add(this.title)
        return Array.from(names);
    }

    get duration () {
        if (!this._metadata) return 0;
        return this._metadata.format.duration === 'N/A' ? 0 : Math.round(this._metadata.format.duration);
    }

    get width () {
        if (!this.videoStream) return null;
        return this.videoStream.width;
    }

    get height () {
        if (!this.videoStream) return null;
        return this.videoStream.height;
    }

    get bitrate () {
        if (!this.videoStream) return 0;
        const _bitrate = this.videoStream.bit_rate === 'N/A' ? this._metadata.format.bit_rate : this.videoStream.bit_rate;
        return _bitrate === 'N/A' ? 0 : _bitrate;
    }

    get framerate () {
        if (!this.videoStream) return 0;
        const framerate = this.videoStream.r_frame_rate.split('/').map(n => parseInt(n));
        return framerate[0] / framerate[1];
    }

    get videoCodec () {
        if (!this.videoStream) return null;
        return this.videoStream.codec_name;
    }

    get audioCodec () {
        if (!this.audioStream) return null;
        return this.audioStream.codec_name;
    }

    get extension () {
        if (!this._metadata) return null;
        if (!this.filename.includes('.')) return null;
        return this.filename.split('.').pop();
    }

    get formats () {
        if (!this._metadata) return null;
        return this._metadata.format.format_name.split(',');
    }

    get finalFileFormat () {
        let file_format = this.extension || 'mkv';
        if (this.extension === 'm3u8' || this.extension === 'ts' || this.formats.includes('hls')) {
            file_format = this.videoCodec === 'h264' && this.audioCodec === 'aac' ? 'mp4' : 'mkv';
        } else if (this.extension === 'mp4' || this.formats.includes('mp4') || this.extension === 'webm') {
            file_format = this._altAudio ? (this._altAudio.formats.includes('mp4') ? 'mp4' : 'mkv') : 'mp4';
        }
        return file_format;
    }

    get size () {
        if (!this._metadata) return 0;
        const _size = (metadata) => metadata.format.size === 'N/A' ? 0 : metadata.format.size;
        return this._altAudio ? _size(this._metadata) + _size(this._altAudio._metadata) : _size(this._metadata);
    }

    get videoStream () {
        if (!this._metadata) return null;
        if (this._videoStream) return this._videoStream;
        this._videoStream = this._metadata.streams.find(s => s.codec_type === 'video');
        return this._videoStream;
    }

    get audioStream () {
        if (!this._metadata) return null;
        if (this._altAudio) return this._altAudio.audioStream;
        if (this._audioStream) return this._audioStream;
        this._audioStream = this._metadata.streams.find(s => s.codec_type === 'audio');
        return this._audioStream;
    }

    useAltAudioStream (audio) {
        this._altAudio = audio;
        this._altAudio = audio;
    }

    setupFFmpegCommand (save_path=null) {
        const path = save_path || this.savePath;
        if (!path) throw new Error('No save path specified.');
        const command = ffmpeg().addInput(this.source);
        if (this._altAudio) {
            command.addInput(this._altAudio.source);
            command.addOptions(['-map 0:v:0', '-map 1:a:0']);
        }
        if (path.endsWith('mp4')) {
            command.addOptions('-movflags faststart');
            if (this.videoCodec === 'h264' || this.formats.includes('mp4')) {
                command.addOptions('-c:v copy');
            } else if (this.videoCodec === 'vp8' || this.videoCodec === 'vp9') {
                command.addOptions(['-c:v libx264', '-fflags +genpts', `-r ${this.framerate || 30}`]);
            }
            if (this.audioCodec === 'aac' || (this._altAudio ? this._altAudio.formats.includes('mp4') : this.formats.includes('mp4'))) {
                command.addOptions('-c:a copy');
            } else {
                command.addOptions('-c:a aac');
            }
        } else if (path.endsWith('mkv')) {
            command.addOptions('-c copy');
        }
        command.output(path);
        this.ffmpegCommand = command;
        return command;
    }

    serialize () {
        return {
            'title': this.title,
            'pageTitle': this.pageTitle,
            'names': this.names,
            'source': this.source,
            'filename': this.filename,
            'duration': this.duration,
            'width': this.width,
            'height': this.height,
            'bitrate': this.bitrate,
            'framerate': this.framerate,
            'videoCodec': this.videoCodec,
            'audioCodec': this.audioCodec,
            'size': this.size,
            'hasVideo': Boolean(this.videoStream),
            'hasAudio': Boolean(this.audioStream)
        }
    }
}

exports = module.exports = Video;
