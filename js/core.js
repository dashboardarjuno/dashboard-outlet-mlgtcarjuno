// ==========================================================
// CORE.JS — Variabel global, util bersama, dan inisialisasi utama
// ==========================================================

const GAS_WEB_APP_URL = "https://script.google.com/macros/s/AKfycbwhkpiZMyC3UaM2TCYGK_JQFmcLhCYt_CBa5ncOC5dvXBuan26b5R5v7CHScG9tEVIu/exec";

// Satu pintu untuk seluruh GET Apps Script. JSONP dipakai karena stabil untuk
// website statis -> Apps Script, termasuk Chrome Android. Request identik
// digabung agar enam modul tidak menembak server berkali-kali bersamaan.
const gasPendingRequests = new Map();
const gasMemoryCache = new Map();

function gasJsonp(action, params = {}, options = {}) {
    const timeoutMs = options.timeoutMs || 10000;
    const cacheMs = options.cacheMs === undefined ? 30000 : options.cacheMs;
    const query = new URLSearchParams({action, ...params});
    const requestKey = query.toString();
    const cached = gasMemoryCache.get(requestKey);

    if (!options.force && cached && Date.now() - cached.savedAt < cacheMs) {
        return Promise.resolve(cached.data);
    }
    if (!options.force && gasPendingRequests.has(requestKey)) {
        return gasPendingRequests.get(requestKey);
    }

    const request = new Promise((resolve, reject) => {
        const callbackName = '__arjunohub_api_' + Date.now() + '_' + Math.random().toString(36).slice(2);
        const script = document.createElement('script');
        let finished = false;

        const cleanup = () => {
            clearTimeout(timer);
            if (script.parentNode) script.parentNode.removeChild(script);
            try { delete window[callbackName]; } catch (_) { window[callbackName] = undefined; }
        };
        const finish = (fn, value) => {
            if (finished) return;
            finished = true;
            cleanup();
            fn(value);
        };
        const timer = setTimeout(() => finish(reject, new Error('Server melewati batas waktu. Silakan coba lagi.')), timeoutMs);

        window[callbackName] = data => {
            if (cacheMs > 0) gasMemoryCache.set(requestKey, {savedAt: Date.now(), data});
            finish(resolve, data);
        };
        script.onerror = () => finish(reject, new Error('Gagal terhubung ke Google Apps Script.'));
        query.set('callback', callbackName);
        script.src = GAS_WEB_APP_URL + '?' + query.toString();
        script.async = true;
        document.head.appendChild(script);
    }).finally(() => gasPendingRequests.delete(requestKey));

    gasPendingRequests.set(requestKey, request);
    return request;
}

window.gasJsonp = gasJsonp;
window.invalidateGasCache = function (action) {
    for (const key of gasMemoryCache.keys()) {
        if (!action || key === 'action=' + action || key.startsWith('action=' + action + '&')) gasMemoryCache.delete(key);
    }
};

// POST ke Apps Script (satu pintu, sama seperti gasJsonp untuk GET).
// Content-Type text/plain sengaja dipakai agar tidak memicu preflight CORS.
async function gasPost(payload) {
    const response = await fetch(GAS_WEB_APP_URL, {
        method: 'POST',
        headers: {'Content-Type': 'text/plain;charset=utf-8'},
        body: JSON.stringify(payload)
    });
    return await response.json();
}
window.gasPost = gasPost;

// Normalisasi kunci pencocokan (NIK / nama / jabatan): string, trim, HURUF BESAR.
function normKey(value) {
    return (value === null || value === undefined ? '' : value).toString().trim().toUpperCase();
}

// Cari karyawan di employeeList. Mendukung properti huruf kecil maupun kapital
// (nik/NIK, nama/Nama) karena data dari server bisa bervariasi.
function findEmployeeByNik(nik) {
    const key = normKey(nik);
    if (!key) return null;
    return employeeList.find(e => normKey(e.nik || e.NIK) === key) || null;
}

function findEmployeeByNama(nama) {
    const key = normKey(nama);
    if (!key) return null;
    return employeeList.find(e => normKey(e.nama || e.Nama) === key) || null;
}

// Format tanggal kalender YYYY-MM-DD dari angka (tanpa Date -> aman dari timezone/Safari).
function formatYMD(year, month, day) {
    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

// Jam "HH:mm" dan tanggal singkat ("Sab, 03 Okt") versi id-ID untuk tampilan modern.
function formatClockId(date) {
    return date.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', hour12: false }).replace('.', ':');
}

function formatShortDateId(date) {
    return date.toLocaleDateString('id-ID', { weekday: 'short', day: '2-digit', month: 'short' });
}

// KOORDINAT OUTLET & RADIUS MAX (50 METER)
const OUTLET_LOCATION = {
    lat: -7.97919,
    lng: 112.62649,
    maxRadiusMeter: 50
};

let employeeList = [];
let customPhotoStore = {}; // Foto tim dari Google Drive/URL yang dikirim Apps Script
let tempEditPhotoBase64 = null; // Penampungan temporer data Base64 foto ter-upload
let disabledDates = [];
let todayAttendanceRecords = [];
let currentGPS = {lat: null, lng: null, distance: 0, valid: false};
let photoBase64 = null;
let mediaStream = null;

// Status Our Team dihitung dari Matriks Jadwal OFF & Cuti untuk hari ini.
// Struktur: { "NAMA KARYAWAN": { status: "AKTIF|OFF|CUTI", index: 1 } }
let teamScheduleStatus = {};
let teamScheduleStatusReady = false;

// Helper parsing tanggal manual (Mencegah NaN / Invalid Date di iOS Safari)
        function parseDateString(dateStr) {
            if (!dateStr) return new Date();
            const parts = dateStr.split('-');
            if (parts.length === 3) {
                return new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
            }
            return new Date(dateStr);
        }

        function escapeHtml(value) {
            return String(value ?? '')
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#039;');
        }

        function showPopup(type, title, message, callback = null) {
            const colors = {
                success: '#10B981',
                error: '#ED1C24',
                warning: '#F59E0B',
                info: '#3B82F6'
            };

            Swal.fire({
                icon: type,
                title: title,
                text: message,
                confirmButtonColor: colors[type] || '#ED1C24',
                confirmButtonText: 'Mengerti',
                customClass: {
                    popup: 'rounded-2xl p-5 text-center max-w-xs shadow-2xl border border-slate-100',
                    title: 'text-base font-bold text-slate-800',
                    htmlContainer: 'text-xs text-slate-600 mt-1.5 leading-relaxed',
                    confirmButton: 'text-xs font-semibold px-5 py-2 rounded-xl shadow-sm focus:outline-none'
                }
            }).then((result) => {
                if (result.isConfirmed && typeof callback === 'function') {
                    callback();
                }
            });
        }

        function calculateDistanceMeter(lat1, lon1, lat2, lon2) {
            const R = 6371e3;
            const rad = Math.PI / 180;
            const dLat = (lat2 - lat1) * rad;
            const dLon = (lon2 - lon1) * rad;
            const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                Math.cos(lat1 * rad) * Math.cos(lat2 * rad) *
                Math.sin(dLon / 2) * Math.sin(dLon / 2);
            const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
            return R * c;
        }

        function openModal(id) {
            const modal = document.getElementById(id);
            if (modal) {
                modal.classList.remove('hidden');
                document.body.classList.add('overflow-hidden'); // Mencegah scroll pada background page
            }
        }

        function closeModal(id) {
            const modal = document.getElementById(id);
            if (modal) {
                modal.classList.add('hidden');
                document.body.classList.remove('overflow-hidden'); // Mengembalikan scroll background page
            }
            if (id === 'modal-absensi') stopCamera();
        }

        function openClassicModuleDrawer() {
            const drawer = document.getElementById('classic-module-drawer');
            const trigger = document.getElementById('classic-module-open');
            if (!drawer) return;

            drawer.hidden = false;
            drawer.classList.add('is-open');
            drawer.setAttribute('aria-hidden', 'false');
            trigger?.setAttribute('aria-expanded', 'true');
            document.body.classList.add('classic-module-open');
            document.getElementById('classic-module-close')?.focus();
        }

        function closeClassicModuleDrawer(restoreFocus = true) {
            const drawer = document.getElementById('classic-module-drawer');
            const trigger = document.getElementById('classic-module-open');
            const panel = document.getElementById('classic-module-panel');
            if (!drawer || drawer.hidden) return;

            drawer.classList.remove('is-open');
            drawer.setAttribute('aria-hidden', 'true');
            drawer.hidden = true;
            trigger?.setAttribute('aria-expanded', 'false');
            document.body.classList.remove('classic-module-open');
            if (restoreFocus) trigger?.focus();
            if (panel) {
                panel.style.transform = '';
                panel.style.transition = '';
            }
        }

        const classicModuleDrawer = document.getElementById('classic-module-drawer');
        const classicModulePanel = document.getElementById('classic-module-panel');
        const classicModuleHandle = document.getElementById('classic-module-handle');
        let classicModuleDragStartY = 0;
        let classicModuleDragDistance = 0;
        let classicModulePointerId = null;

        classicModuleDrawer?.addEventListener('click', event => {
            if (event.target.closest('[data-module-drawer-close]')) {
                closeClassicModuleDrawer();
                return;
            }
            if (event.target.closest('.classic-module-grid button, .classic-module-grid a')) {
                closeClassicModuleDrawer(false);
            }
        }, true);

        classicModuleDrawer?.addEventListener('keydown', event => {
            if (event.key === 'Escape') {
                event.preventDefault();
                closeClassicModuleDrawer();
                return;
            }
            if (event.key !== 'Tab' || !classicModulePanel) return;

            const focusable = [...classicModulePanel.querySelectorAll('a[href], button:not([disabled])')]
                .filter(element => element.getClientRects().length > 0);
            if (!focusable.length) return;
            const first = focusable[0];
            const last = focusable[focusable.length - 1];
            if (event.shiftKey && document.activeElement === first) {
                event.preventDefault();
                last.focus();
            } else if (!event.shiftKey && document.activeElement === last) {
                event.preventDefault();
                first.focus();
            }
        });

        classicModuleHandle?.addEventListener('pointerdown', event => {
            if (!window.matchMedia('(max-width: 767px)').matches || event.button !== 0) return;
            classicModuleDragStartY = event.clientY;
            classicModuleDragDistance = 0;
            classicModulePointerId = event.pointerId;
            classicModulePanel.style.transition = 'none';
            classicModuleHandle.setPointerCapture(event.pointerId);
        });

        classicModuleHandle?.addEventListener('pointermove', event => {
            if (event.pointerId !== classicModulePointerId || !classicModulePanel) return;
            classicModuleDragDistance = Math.max(0, event.clientY - classicModuleDragStartY);
            classicModulePanel.style.transform = `translateY(${classicModuleDragDistance}px)`;
        });

        const finishClassicModuleDrag = event => {
            if (event.pointerId !== classicModulePointerId) return;
            classicModulePointerId = null;
            if (classicModuleDragDistance > 90) {
                closeClassicModuleDrawer();
            } else if (classicModulePanel) {
                classicModulePanel.style.transition = '';
                classicModulePanel.style.transform = '';
            }
        };

        classicModuleHandle?.addEventListener('pointerup', finishClassicModuleDrag);
        classicModuleHandle?.addEventListener('pointercancel', finishClassicModuleDrag);

        // SATU-SATUNYA pembaruan tanggal & jam: header klasik (lebar + ringkas) dan
        // header modern (desktop + salinan mobile). Elemen yang tidak ada dilewati.
        function updateClocks() {
            const now = new Date();
            const set = function (sel, text) {
                const el = document.querySelector(sel);
                if (el) el.textContent = text;
            };
            const timeStr = now.toLocaleTimeString('id-ID', {hour: '2-digit', minute: '2-digit'});
            const dateLong = now.toLocaleDateString('id-ID', {weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'});
            const dateCompact = now.toLocaleDateString('id-ID', {weekday: 'short', day: 'numeric', month: 'short'});

            set('#current-date', dateLong);
            set('#current-time', timeStr);
            set('#classic-compact-date', dateCompact);
            set('#classic-compact-time', timeStr);

            const clock = formatClockId(now);
            const dateShort = formatShortDateId(now);
            set('#modern-current-time', clock);
            set('#modern-current-date', dateShort);
            set('#modernMobileDateTime .modern-time', clock);
            set('#modernMobileDateTime .modern-date', dateShort);
        }
        window.updateClocks = updateClocks;


// Inisialisasi utama saat halaman dimuat: banner, status outlet, dan data awal
document.addEventListener("DOMContentLoaded", function () {
    updateOutletStatus();
    setInterval(updateOutletStatus, 60000);

    const now = new Date();
    const filterBulanInput = document.getElementById("filter-bulan-matriks");
    if (filterBulanInput && !filterBulanInput.value) {
        const curY = now.getFullYear();
        const curM = String(now.getMonth() + 1).padStart(2, '0');
        filterBulanInput.value = `${curY}-${curM}`;
    }

});

// Mulai mengambil data hanya setelah email berhasil diverifikasi. Data penting
// jalan paralel; jadwal dan kas tetap lazy-load saat dibuka.
window.addEventListener('arjunohub:employee-ready', function () {
    if (typeof fetchBannerInfo === 'function') fetchBannerInfo();
    Promise.allSettled([
        typeof loadInitialData === 'function' ? loadInitialData() : Promise.resolve(),
        typeof loadDisabledDates === 'function' ? loadDisabledDates() : Promise.resolve()
    ]).then(() => {
        if (typeof loadDashboardMonthlyRekap === 'function') loadDashboardMonthlyRekap();
        if (typeof loadTeamPhotos === 'function') loadTeamPhotos().then(() => {
            if (typeof renderOurTeamSection === 'function') renderOurTeamSection();
            if (typeof renderAuthProfile === 'function') renderAuthProfile();
        });
    });
}, {once: true});

updateClocks();
setInterval(updateClocks, 30000);
