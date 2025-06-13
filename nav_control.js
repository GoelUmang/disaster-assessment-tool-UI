// File name: nav_controls.js
// File description: navigation control active state change

const links = document.querySelectorAll('.controls a');
const currentPath = window.location.pathname.split('/').pop();

links.forEach(link => {
if (link.getAttribute('href') === currentPath) {
    link.classList.add('active');
    // link.setAttribute.diss
} else {
    link.classList.remove('active');
}
});