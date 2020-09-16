const returnHome = document.querySelector('#returnHome');
const navigationBack = document.querySelector('#navigationBack');
const navigationForward = document.querySelector('#navigationForward');
const pageReload = document.querySelector('#pageReload');
const copyURL = document.querySelector('#copyURL');

returnHome.onclick = window.api.returnHome;
navigationBack.onclick = window.api.goBack;
navigationForward.onclick = window.api.goForward;
pageReload.onclick = window.api.reload;
copyURL.onclick = async () => {
    const url = await window.api.copyURL();
    try {
        await navigator.clipboard.writeText(url);
        copyURL.classList.add('success');
        setTimeout(() => {
            copyURL.classList.remove('success');
        }, 1150);
    } catch {
        copyURL.classList.add('failure');
        setTimeout(() => {
            copyURL.classList.remove('failure');
        }, 1150);
    }
};

window.api.onNavigation((data) => {
    navigationBack.classList.toggle('disabled', !data.canGoBack);
    navigationForward.classList.toggle('disabled', !data.canGoForward);
});

const VideosFoundButton = document.querySelector('#videos_found');

window.api.onSetVideoCount((count) => {
    VideosFoundButton.children[0].innerHTML = `Videos: ${count}`;
});

VideosFoundButton.onclick = () => {
    window.api.openDownloadPanel();
}
