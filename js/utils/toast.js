const TOAST_SHOW_TIME = 3000;

function _getToast() {
    return document.getElementById('toast');
}

export function showToast(msg, isError = false, time = TOAST_SHOW_TIME) {
    const toast = _getToast();
    toast.innerHTML = msg;
    toast.classList.remove('loading');
    toast.classList.add('show');

    if (isError) {
        toast.style.backgroundColor = '#e74c3c';
        toast.style.color = '#fff';
    } else {
        toast.style.backgroundColor = '#fff';
        toast.style.color = '#000';
    }

    setTimeout(() => toast.classList.remove('show'), time);
}

export function showLoadingToast(msg) {
    const toast = _getToast();
    toast.innerHTML = `<img src="assets/loader.gif" class="toast-loader" alt="loading"> ${msg}`;
    toast.style.backgroundColor = '#fff';
    toast.style.color = '#000';
    toast.classList.add('show', 'loading');
}

export function hideToast() {
    const toast = _getToast();
    toast.classList.remove('show', 'loading');
}
