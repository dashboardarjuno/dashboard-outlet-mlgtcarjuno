(function () {
    var STORAGE_KEY = 'dashboardTheme'; // value: 'klasik' | 'modern'

    function applyTheme(theme) {
        document.documentElement.setAttribute('data-theme', theme);

        var btnKlasik = document.getElementById('btn-theme-klasik');
        var btnModern = document.getElementById('btn-theme-modern');
        if (btnKlasik && btnModern) {
            btnKlasik.classList.toggle('active', theme === 'klasik');
            btnModern.classList.toggle('active', theme === 'modern');
        }
    }

    function setTheme(theme) {
        try {
            localStorage.setItem(STORAGE_KEY, theme);
        } catch (e) {
            // localStorage tidak tersedia (mode privat dsb) -> abaikan, tetap jalan per-sesi
        }
        applyTheme(theme);
    }

    function getSavedTheme() {
        try {
            return localStorage.getItem(STORAGE_KEY) || 'klasik';
        } catch (e) {
            return 'klasik';
        }
    }

    document.addEventListener('DOMContentLoaded', function () {
        applyTheme(getSavedTheme());

        var btnKlasik = document.getElementById('btn-theme-klasik');
        var btnModern = document.getElementById('btn-theme-modern');

        if (btnKlasik) {
            btnKlasik.addEventListener('click', function () {
                setTheme('klasik');
            });
        }
        if (btnModern) {
            btnModern.addEventListener('click', function () {
                setTheme('modern');
            });
        }
    });
})();
