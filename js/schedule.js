// ==========================================================
// SCHEDULE.JS — Status jam operasional, jadwal shift, fullscreen tabel,
// dan video motivasi otomatis
// ==========================================================

        function updateOutletStatus() {
            const statusContainer = document.getElementById("outlet-status-container");
            if (!statusContainer) return;

            const now = new Date();
            const day = now.getDay();
            const currentMinutes = (now.getHours() * 60) + now.getMinutes();

            let openMinutes = 0;
            let closeMinutes = 0;

            if (day >= 1 && day <= 4) { // Senin - Kamis (11:00 - 22:00)
                openMinutes = (11 * 60);
                closeMinutes = (22 * 60);
            } else if (day === 5) { // Jumat (12:45 - 23:00)
                openMinutes = (12 * 60) + 45;
                closeMinutes = (23 * 60);
            } else { // Sabtu - Minggu (10:00 - 23:00)
                openMinutes = (10 * 60);
                closeMinutes = (23 * 60);
            }

            const isOpen = currentMinutes >= openMinutes && currentMinutes < closeMinutes;

            if (isOpen) {
                statusContainer.className = "text-xs text-emerald-400 font-semibold flex items-center justify-end gap-1";
                statusContainer.innerHTML = `<i class="fa-solid fa-circle text-[8px] text-emerald-400 animate-pulse"></i> Outlet Open`;
            } else {
                statusContainer.className = "text-xs text-rose-500 font-semibold flex items-center justify-end gap-1";
                statusContainer.innerHTML = `<i class="fa-solid fa-circle text-[8px] text-rose-500"></i> Outlet Closed`;
            }
        }

        function toggleFullscreen() {
            const section = document.getElementById('section-shift');
            const container = document.getElementById('table-container');
            const scheduleContainer = document.getElementById('scheduleContainer');
            const icon = document.getElementById('fullscreen-icon');
            const text = document.getElementById('fullscreen-text');

            if (!document.fullscreenElement) {
                // Request Fullscreen
                const request = section.requestFullscreen || section.webkitRequestFullscreen || section.mozRequestFullScreen || section.msRequestFullscreen;
                if (request) request.call(section);

                // Ubah posisi section menjadi fixed layar penuh
                section.classList.add("fixed", "inset-0", "z-50", "p-6", "bg-white", "overflow-y-auto");

                // Atur container utama agar pas
                container.style.width = "100%";
                container.style.maxWidth = "100%";

                // Bungkus scheduleContainer agar rapi di tengah layar penuh
                if (scheduleContainer) {
                    scheduleContainer.style.width = "100%";
                    scheduleContainer.style.overflowX = "auto";
                }

                // Biarkan tabel aslinya berjalan normal tanpa dipaksa ubah sel-selnya
                const table = container.querySelector('table');
                if (table) {
                    table.style.width = "auto"; // Kembali ke ukuran natural tabel agar tidak berantakan
                }

                icon.className = "fa-solid fa-compress";
                text.innerText = "Tutup / Keluar";
            } else {
                exitFullscreenMode();
            }
        }

        function exitFullscreenMode() {
            const section = document.getElementById('section-shift');
            const container = document.getElementById('table-container');
            const scheduleContainer = document.getElementById('scheduleContainer');
            const icon = document.getElementById('fullscreen-icon');
            const text = document.getElementById('fullscreen-text');

            if (document.fullscreenElement) {
                if (document.exitFullscreen) document.exitFullscreen();
                else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
            }

            // Hapus style fullscreen dari section
            section.classList.remove("fixed", "inset-0", "z-50", "p-6", "bg-white", "overflow-y-auto");

            // Kembalikan style normal
            container.style.width = "";
            container.style.maxWidth = "";

            if (scheduleContainer) {
                scheduleContainer.style.width = "100%";
                scheduleContainer.style.overflowX = "";
            }

            const table = container.querySelector('table');
            if (table) {
                table.style.width = "";
            }

            icon.className = "fa-solid fa-expand";
            text.innerText = "Fullscreen";
        }


document.addEventListener('fullscreenchange', () => {
    if (!document.fullscreenElement) exitFullscreenMode();
});

// === FUNGSI PEMANGGILAN JADWAL BERDASARKAN FILTER (PLEK-KETIPLEK WARNA GSHEET) ===
        function loadSchedule() {
            const tanggal = document.getElementById('inputTanggal').value;
            const outlet = document.getElementById('inputOutlet').value;
            const container = document.getElementById('scheduleContainer');

            container.innerHTML = '<p class="text-xs text-slate-500 text-center py-6">Memuat lembar kerja dan warna...</p>';

            let url = GAS_WEB_APP_URL + `?action=getScheduleByFilter&date=${tanggal}&outlet=${encodeURIComponent(outlet)}`;

            fetch(url)
                .then(res => res.json())
                .then(res => {
                    const result = res.data || res;

                    if (!result.success) {
                        container.innerHTML = `<p class="text-xs text-red-500 text-center py-6">${result.message || "Data tidak ditemukan."}</p>`;
                        return;
                    }

                    const values = result.values;
                    const colors = result.colors;

                    // LEBAR KOLOM PRESISI DENGAN TABLE-LAYOUT FIXED
                    const wCol0 = 20;  // Kolom 0 (NO) super slim = 20px
                    const wCol1 = 130; // Kolom 1 (NAMA) = 130px

                    let html = `<table class="border-collapse text-[9px] bg-white whitespace-nowrap" style="margin:0; padding:0; border-spacing:0; table-layout: fixed; width: max-content;">`;

                    for (let r = 0; r < values.length; r++) {
                        html += '<tr>';
                        for (let c = 0; c < values[r].length; c++) {
                            let cellValue = values[r][c] !== null && values[r][c] !== undefined ? values[r][c] : '';
                            let cellColor = (colors && colors[r] && colors[r][c]) ? colors[r][c] : '#ffffff';

                            let stickyStyle = '';

                            // KOLOM 0: NO (SLIM & STICKY KIRI)
                            if (c === 0) {
                                stickyStyle = `position: -webkit-sticky; position: sticky; left: 0px; width: ${wCol0}px; min-width: ${wCol0}px; max-width: ${wCol0}px; z-index: 10; background-color: ${cellColor}; background-clip: padding-box; padding: 2px 1px;`;
                            }
                            // KOLOM 1: NAMA KARYAWAN (STICKY SEBELAH NO)
                            else if (c === 1) {
                                stickyStyle = `position: -webkit-sticky; position: sticky; left: ${wCol0}px; width: ${wCol1}px; min-width: ${wCol1}px; max-width: ${wCol1}px; z-index: 10; background-color: ${cellColor}; background-clip: padding-box; box-shadow: 3px 0 5px -1px rgba(0,0,0,0.18); padding: 2px 4px; text-align: left; overflow: hidden; text-overflow: ellipsis;`;
                            }
                            // KOLOM LAINNYA (BEBAS SCROLL)
                            else {
                                stickyStyle = `background-color: ${cellColor}; min-width: 40px; padding: 2px 3px;`;
                            }

                            html += `<td style="border: 1px solid #cbd5e1; text-align: center; ${stickyStyle}">${cellValue}</td>`;
                        }
                        html += '</tr>';
                    }

                    html += '</table>';

                    // PERBAIKAN UTAMA: MENGUNCI STICKY AGAR TIDAK BOCOR KELUAR WADAH PADA SCROLL HALAMAN
                    container.className = "";
                    container.style.cssText = "width: 100%; overflow: auto !important; max-height: 75vh; position: relative !important; -webkit-overflow-scrolling: touch; border-radius: 8px;";
                    container.innerHTML = html;
                })
                .catch(error => {
                    console.error("Gagal memuat jadwal:", error);
                    container.innerHTML = `<p class="text-xs text-red-500 text-center py-6">Gagal terhubung ke server.</p>`;
                });
        }


// Otomatis isi tanggal hari ini DAN muat data saat halaman pertama kali dibuka
window.addEventListener('DOMContentLoaded', () => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    const formattedDate = `${year}-${month}-${day}`;

    const inputTanggal = document.getElementById('inputTanggal');
    if (inputTanggal) {
        inputTanggal.value = formattedDate;
    }

    loadSchedule();
});

// ==========================================
// FUNGSI PEMUTAR VIDEO MOTIVASI OTOMATIS
// ==========================================
const motivationVideos = [
    "V96hXqw2oU8",
    "srkG0zqJZSw", // Merry Riana
    "JAdTjHsOid0",
    "oqRX02uhicc",
    "q0GiWKl5aaI",
    "hj9KRxnCc00",
    "VirbuHEjmmY"  // Dihapus &t=94s agar URL embed valid
];

        function loadRandomMotivationVideo() {
            const iframe = document.getElementById('motivationVideo');
            if (!iframe) return;

            const randomIndex = Math.floor(Math.random() * motivationVideos.length);
            const selectedVideoId = motivationVideos[randomIndex];

            // Tambahkan start=94 jika ingin video VirbuHEjmmY mulai dari detik ke-94
            let extraParams = "";
            if (selectedVideoId === "VirbuHEjmmY") {
                extraParams = "&start=94";
            }

            const embedUrl = `https://www.youtube.com/embed/${selectedVideoId}?autoplay=1&mute=1&loop=1&playlist=${selectedVideoId}${extraParams}`;
            iframe.src = embedUrl;
        }


// PEMANGGILAN FUNGSI SAAT HALAMAN DIMUAT
loadRandomMotivationVideo(); // <--- INI YANG TADI KURANG SEHINGGA VIDEO TIDAK MUNCUL
