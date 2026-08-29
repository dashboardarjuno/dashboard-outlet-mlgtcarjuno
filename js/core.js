// ==========================================================
// CORE.JS — Variabel global, util bersama, dan inisialisasi utama
// ==========================================================

const GAS_WEB_APP_URL = "https://script.google.com/macros/s/AKfycbwhkpiZMyC3UaM2TCYGK_JQFmcLhCYt_CBa5ncOC5dvXBuan26b5R5v7CHScG9tEVIu/exec";

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
document.addEventListener("DOMContentLoaded", async function () {
    const dateElement = document.getElementById("current-date");
    if (dateElement) {
        const now = new Date();
        dateElement.textContent = now.toLocaleDateString('id-ID', {
            weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
        });
    }

    if (typeof fetchBannerInfo === 'function') fetchBannerInfo();

    updateOutletStatus();
    setInterval(updateOutletStatus, 60000);

    const now = new Date();
    const filterBulanInput = document.getElementById("filter-bulan-matriks");
    if (filterBulanInput && !filterBulanInput.value) {
        const curY = now.getFullYear();
        const curM = String(now.getMonth() + 1).padStart(2, '0');
        filterBulanInput.value = `${curY}-${curM}`;
    }

    // Pemanggilan fungsi dijalankan secara berurutan:
    await loadTeamPhotos();
    await loadInitialData();
    if (typeof loadDisabledDates === 'function') loadDisabledDates();
    if (typeof loadDashboardMonthlyRekap === 'function') loadDashboardMonthlyRekap();

});

updateTime();
setInterval(updateTime, 60000);
