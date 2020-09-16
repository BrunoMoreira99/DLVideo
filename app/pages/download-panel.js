window.api.onShowDownloadPanel(() => {
    document.body.classList.add('active');
});

const outsideArea = document.querySelector('.outside_area');

outsideArea.onmousedown = () => {
    document.body.classList.remove('active');
    setTimeout(() => {
        window.api.closeDownloadPanel();
    }, 500);
}

window.addEventListener('keydown', (e) => {
    if (e.code === 'Escape') {
        document.body.classList.remove('active');
        setTimeout(() => {
            window.api.closeDownloadPanel();
        }, 500);
    }
}, true);

let VideoComponentCollection = [];
const container = document.querySelector('.container');
const no_videos = document.querySelector('.no_videos').cloneNode(true);

window.api.onAddNewVideo((data) => {
    const videoComponent = document.createElement('div');
    videoComponent.className = 'video_component';
    videoComponent.setAttribute('data-src', data.source);
    videoComponent.innerHTML = `
    <div class="content">
        <div class="thumbnail_container">
            <img class="thumbnail" src="resources/loading.svg" alt="" draggable="false"/>
            <span class="size" title="Total size can be inaccurate" data-bytes="${data.size}">${data.size === 0 ? 'Unknown Size' : humanFileSize(data.size)}</span>
        </div>
        <div class="more_info">
            <span class="filename" title="${data.title || data.pageTitle}">${data.title || data.pageTitle}</span>
            <span class="duration" data-seconds="${data.duration}">${data.duration ? secondsToHHMMSS(data.duration) : 'Unknown Duration'}</span>
            <span class="resolution" data-width="${data.width}" data-height="${data.height}">${data.width} × ${data.height}</span>
            <div class="row">
                <span class="video_codec">${data.videoCodec.toUpperCase()}</span>
                <span class="audio_codec">${data.hasAudio ? data.audioCodec.toUpperCase() : 'No Audio'}</span>
                <div class="download-status">
                    <span class="status"></span>
                    <span class="received"></span>
                    <div class="btn download"><svg viewBox="0 0 18 18"><path d="M16,6.5h-4v-6H6v6H2l7,7L16,6.5z M2,15.5v2h14v-2H2z"/></svg></div>
                    <div class="btn cancel" title="Cancel Download"><svg viewBox="0 0 18 18"><path d="M9 1C4.58 1 1 4.58 1 9s3.58 8 8 8 8-3.58 8-8-3.58-8-8-8zm4 10.87L11.87 13 9 10.13 6.13 13 5 11.87 7.87 9 5 6.13 6.13 5 9 7.87 11.87 5 13 6.13 10.13 9 13 11.87z"/></svg></div>
                    <div class="btn pause" title="Pause Download"><svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14H9V8h2v8zm4 0h-2V8h2v8z"/></svg></div>
                    <div class="btn error failure disabled" title="An error occurred when trying to download this video."><svg viewBox="0 0 18 18"><path d="M9 1.03c-4.42 0-8 3.58-8 8s3.58 8 8 8 8-3.58 8-8-3.58-8-8-8zM10 13H8v-2h2v2zm0-3H8V5h2v5z"/></svg></div>
                    <div class="btn complete success disabled"><svg viewBox="0 0 24 24"><path d="M9 16.2L4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4L9 16.2z"/></svg></div>
                </div>
            </div>
        </div>
    </div>
`;
    VideoComponentCollection.push(videoComponent);
    if (VideoComponentCollection.length > 1) {
        VideoComponentCollection = VideoComponentCollection.sort((a, b) => {
            let sortingA = 0, sortingB = 0, sortingC = 0, sortingD = 0;
            try {
                if (a.classList.contains('download-in-progress') ||
                    a.classList.contains('download-complete') ||
                    a.classList.contains('download-error')) sortingA += -1;
                if (b.classList.contains('download-in-progress') ||
                    b.classList.contains('download-complete') ||
                    b.classList.contains('download-error')) sortingA += 1;
                const a_duration = parseInt(a.querySelector('.duration').getAttribute('data-seconds'));
                const b_duration = parseInt(b.querySelector('.duration').getAttribute('data-seconds'));
                if (a_duration && b_duration) sortingB = b_duration - a_duration;
                const a_res = a.querySelector('.resolution');
                const b_res = b.querySelector('.resolution');
                const a_width = parseInt(a_res.getAttribute('data-width'));
                const a_height = parseInt(a_res.getAttribute('data-height'));
                const b_width = parseInt(b_res.getAttribute('data-width'));
                const b_height = parseInt(b_res.getAttribute('data-height'));
                if (a_width && a_height && b_width && b_height) sortingC = b_width * b_height - a_width * a_height;
                const a_size = parseInt(a.querySelector('.size').getAttribute('data-bytes'));
                const b_size = parseInt(b.querySelector('.size').getAttribute('data-bytes'));
                sortingD = b_size - a_size;
                return sortingA || sortingB || sortingC || sortingD;
            } catch {
                return sortingA || sortingB || sortingC || sortingD;
            }
        });
    }
    container.innerHTML = "";
    VideoComponentCollection.forEach((element) => {
        container.appendChild(element);
    });
});

window.api.onSetVideoThumbnail((videoSrc, thumbnail) => {
    const video_component = VideoComponentCollection.find((e) => e.getAttribute('data-src') === videoSrc);
    video_component.querySelector('.thumbnail').src = thumbnail;
});

window.api.onSetVideoAudioStream((videoSrc, data) => {
    const video_component = VideoComponentCollection.find((e) => e.getAttribute('data-src') === videoSrc);
    video_component.querySelector('.audio_codec').innerText = data.audioCodec.toUpperCase();
    const size_element = video_component.querySelector('.size');
    const new_size = parseInt(size_element.getAttribute('data-bytes')) + data.size;
    size_element.setAttribute('data-bytes', new_size);
    size_element.innerText = humanFileSize(new_size);
});

window.api.onDeleteVideo((videoSrc) => {
    const index = VideoComponentCollection.findIndex((e) => e.getAttribute('data-src') === videoSrc);
    if (~index) {
        VideoComponentCollection[index].remove();
        VideoComponentCollection.splice(index, 1);
    }
    if (!VideoComponentCollection.length) {
        container.innerHTML = no_videos.outerHTML;
    }
});

window.api.onDownloadProgress((videoSrc, progress) => {
    const video_component = VideoComponentCollection.find((e) => e.getAttribute('data-src') === videoSrc);
    video_component.classList.add('download-in-progress');
    if (progress.percent !== null) {
        video_component.style.backgroundPositionX = `${100 - progress.percent}%`;
    }
    const received = video_component.querySelector('.download-status .received');
    received.innerText = humanFileSize(progress.bytesReceived, false, 2, true);
    if (!progress.canResume) video_component.querySelector('.btn.pause').style.display = 'none';
});

window.api.onDownloadError((videoSrc) => {
    const video_component = VideoComponentCollection.find((e) => e.getAttribute('data-src') === videoSrc);
    video_component.classList.remove('download-in-progress');
    video_component.classList.add('download-error');
});

window.api.onDownloadComplete((videoSrc) => {
    const video_component = VideoComponentCollection.find((e) => e.getAttribute('data-src') === videoSrc);
    video_component.classList.remove('download-in-progress');
    video_component.classList.add('download-complete');
});

container.addEventListener('click', async (e) => {
    if (!e.target || e.target.matches('.btn.disabled')) return;
    if (e.target.matches('.btn.download')) {
        e.target.classList.add('disabled');
        const downloadStarted = await window.api.startVideoDownload(e.target.closest('.video_component').getAttribute('data-src'));
        if (downloadStarted) {
            const video_component = e.target.closest('.video_component');
            video_component.querySelector('.download-status .status').innerText = 'Downloading';
        } else {
            e.target.classList.remove('disabled');
        }
    } else if (e.target.matches('.btn.pause')) {
        const video_component = e.target.closest('.video_component');
        const res = await window.api.pauseVideoDownload(video_component.getAttribute('data-src'));
        if (res === 1) {
            video_component.querySelector('.download-status .status').innerText = 'Paused';
            e.target.classList.add('active');
            e.target.title = 'Resume Download';
        } else if (res === 2) {
            video_component.querySelector('.download-status .status').innerText = 'Downloading';
            e.target.classList.remove('active');
            e.target.title = 'Pause Download';
        }
    } else if (e.target.matches('.btn.cancel')) {
        const video_component = e.target.closest('.video_component');
        const isCanceled = await window.api.cancelVideoDownload(video_component.getAttribute('data-src'));
        if (isCanceled) {
            video_component.classList.remove('download-in-progress');
            video_component.style.backgroundPositionX = '100%';
            video_component.querySelector('.btn.download').classList.remove('disabled');
        }
    }
});

function secondsToHHMMSS(seconds) {
    return new Date(seconds * 1000).toISOString().substr(11, 8);
}

function humanFileSize(bytes, si=false, dp=2, trailingZeroes=false) {
    const thresh = si ? 1000 : 1024;

    if (Math.abs(bytes) < thresh) {
        return bytes + ' B';
    }

    const units = si
        ? ['kB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB']
        : ['KiB', 'MiB', 'GiB', 'TiB', 'PiB', 'EiB', 'ZiB', 'YiB'];
    let u = -1;
    const r = 10**dp;

    do {
        bytes /= thresh;
        ++u;
    } while (Math.round(Math.abs(bytes) * r) / r >= thresh && u < units.length - 1);

    return (!trailingZeroes && bytes % 1 === 0 ? bytes : bytes.toFixed(dp)) + ' ' + units[u];
}
