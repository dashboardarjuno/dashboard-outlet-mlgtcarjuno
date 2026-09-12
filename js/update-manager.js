// ==========================================================
// UPDATE-MANAGER.JS — cek versi terbaru & safe auto refresh
// Berlaku untuk mode Klasik dan Modern.
// ==========================================================
(function () {
    'use strict';

    const VERSION_URL = 'version.json';
    const STORAGE_KEY = 'arjunohub_app_version';
    const CHECK_INTERVAL = 60 * 1000; // cek tiap 60 detik
    let updatePending = false;
    let updateNoticeOpen = false;

    function hasOpenOperationalModal() {
        const modals = document.querySelectorAll('[id^="modal-"]');
        return Array.from(modals).some(el => {
            const style = window.getComputedStyle(el);
            return !el.classList.contains('hidden') &&
                   style.display !== 'none' &&
                   style.visibility !== 'hidden';
        });
    }

    async function getLatestVersion() {
        const separator = VERSION_URL.includes('?') ? '&' : '?';
        const response = await fetch(
            VERSION_URL + separator + '_=' + Date.now(),
            { cache: 'no-store' }
        );
        if (!response.ok) throw new Error('Version check HTTP ' + response.status);
        const data = await response.json();
        return String(data.version || '').trim();
    }

    function reloadLatest() {
        // Reload normal sudah cukup karena asset HTML terbaru akan diminta lagi.
        // version.json sendiri selalu dicek dengan no-store + cache buster.
        window.location.reload();
    }

    function showUpdateNotice() {
        if (updateNoticeOpen || hasOpenOperationalModal()) return;
        updateNoticeOpen = true;

        if (window.Swal) {
            Swal.fire({
                icon: 'info',
                title: 'ArjunoHub Diperbarui',
                text: 'Versi terbaru sudah tersedia. Halaman akan dimuat ulang agar tampilan dan fitur selalu terbaru.',
                confirmButtonText: 'Update Sekarang',
                allowOutsideClick: false,
                allowEscapeKey: false,
                timer: 3500,
                timerProgressBar: true,
                confirmButtonColor: '#5B45E0'
            }).then(reloadLatest);
        } else {
            // Fallback tanpa native alert agar tidak muncul "...github.io says".
            setTimeout(reloadLatest, 800);
        }
    }

    async function checkForUpdate() {
        try {
            const latest = await getLatestVersion();
            if (!latest) return;

            const current = localStorage.getItem(STORAGE_KEY);

            // First visit: register current version, jangan refresh.
            if (!current) {
                localStorage.setItem(STORAGE_KEY, latest);
                return;
            }

            if (current !== latest) {
                localStorage.setItem(STORAGE_KEY, latest);
                updatePending = true;
            }

            // Jangan ganggu user saat Absensi/Kas/Libur/modal lain sedang dibuka.
            if (updatePending && !hasOpenOperationalModal()) {
                updatePending = false;
                showUpdateNotice();
            }
        } catch (err) {
            console.debug('ArjunoHub update check dilewati:', err);
        }
    }

    document.addEventListener('DOMContentLoaded', function () {
        checkForUpdate();
        setInterval(checkForUpdate, CHECK_INTERVAL);

        // Saat user kembali ke tab/browser, langsung cek versi.
        document.addEventListener('visibilitychange', function () {
            if (!document.hidden) checkForUpdate();
        });

        window.addEventListener('focus', checkForUpdate);

        // Setelah modal ditutup, update yang tertunda boleh berjalan.
        document.addEventListener('click', function () {
            if (updatePending) {
                setTimeout(function () {
                    if (!hasOpenOperationalModal()) {
                        updatePending = false;
                        showUpdateNotice();
                    }
                }, 250);
            }
        }, true);
    });
})();
