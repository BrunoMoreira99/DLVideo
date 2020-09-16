const url_input = document.querySelector('#url_input');
const ok_button = document.querySelector('#ok_button');

url_input.onkeydown = function (e) {
    if (e.keyCode === 13) ok_button.click();
}

ok_button.onclick = function () {
    const url = url_input.value;
    if (url) window.api.openPage(url);
}
