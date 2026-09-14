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

        function updateTime() {
            const now = new Date();
            const timeStr = now.toLocaleTimeString('id-ID', {hour: '2-digit', minute: '2-digit'});
            const timeElement = document.getElementById("current-time");
            if (timeElement) {
                timeElement.textContent = timeStr;
            }
        }


// Inisialisasi utama saat halaman dimuat: banner, status outlet, dan data awal
document.addEventListener("DOMContentLoaded", function () {
    const dateElement = document.getElementById("current-date");
    if (dateElement) {
        const now = new Date();
        dateElement.textContent = now.toLocaleDateString('id-ID', {
            weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
        });
    }

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
        });
    });
}, {once: true});

updateTime();
setInterval(updateTime, 60000);
