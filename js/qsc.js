// ==========================================================
// QSC.JS — Modul Checklist QSC (Kasir/Depan/Minuman/Dapur)
// Self-Check (staf) + Spot-Check exception-based (MO/WMO)
// File BARU — tidak mengubah file/struktur yang sudah ada.
// ==========================================================

// --- 1. KONFIGURASI CHECKLIST PER POS (total 100 poin per pos) ---
// PENTING: kalau bobot/item di sini diubah, sinkronkan juga salinan
// QSC_CONFIG yang sama persis di backend (QSC.gs) supaya skor final
// yang dihitung server tidak berbeda dengan yang ditampilkan di sini.
const QSC_CONFIG = {
    KASIR: {
        label: 'Kasir',
        items: [
            { id: 'absensi', label: 'Ketepatan Absensi (otomatis dari data absen)', weight: 10, auto: true },
            { id: 'modal', label: 'Uang modal awal shift sesuai (selisih = 0)', weight: 15, critical: true },
            { id: 'antrian', label: 'Struk/nota jalan normal, antrian tidak >15 menit', weight: 10 },
            { id: 'kebersihan', label: 'Area kasir & perlengkapan bersih, tidak ada sampah', weight: 10 },
            { id: 'promo', label: 'Menguasai promo/menu aktif hari ini', weight: 8 },
            { id: 'perangkat', label: 'Router & printer berfungsi normal', weight: 8 },
            { id: 'servis', label: 'Greeting, Upsell, Crossell & closing statement', weight: 12 },
            { id: 'edc', label: 'EDC-QRIS & Merchant Online berfungsi normal', weight: 12, critical: true },
            { id: 'updatemenu', label: 'Update menu POS kasir & merchant online', weight: 10 },
            { id: 'lowseason', label: 'Manfaatkan low season dengan action', weight: 5, needsApproval: true }
        ],
        selfReport: { id: 'void', label: 'Void / Salah Input', pointsPerEvent: 5 }
    },
    DEPAN: {
        label: 'Depan (Dining Area)',
        items: [
            { id: 'absensi', label: 'Ketepatan Absensi (otomatis dari data absen)', weight: 10, auto: true },
            { id: 'parkir', label: 'Area parkir bersih, tidak ada sampah', weight: 8 },
            { id: 'meja', label: 'Meja, kursi, condimenset, no meja, tisu — rapi bersih', weight: 15 },
            { id: 'lantai', label: 'Pintu, kaca & lantai bersih, tidak licin/basah tanpa tanda', weight: 12, critical: true },
            { id: 'toilet', label: 'Toilet, wastafel, mushola bersih wangi, sabun & tisu ada', weight: 15, critical: true },
            { id: 'clearup', label: 'Clear up maksimal 10 menit setelah konsumen pulang', weight: 10 },
            { id: 'ac', label: 'Pencahayaan & AC/kipas berfungsi normal', weight: 8 },
            { id: 'greeting', label: 'Greeting ke konsumen, cek menu sesuai pesanan', weight: 12 },
            { id: 'lowseason', label: 'Manfaatkan low season dengan action', weight: 10, needsApproval: true }
        ],
        selfReport: null
    },
    MINUMAN: {
        label: 'Minuman (Bar/Beverage)',
        items: [
            { id: 'absensi', label: 'Ketepatan Absensi (otomatis dari data absen)', weight: 8, auto: true },
            { id: 'bahan', label: 'Bahan baku tidak lewat tgl exp, FIFO berjalan', weight: 15, critical: true },
            { id: 'es', label: 'Es batu & air dari sumber bersih, wadah tertutup', weight: 15, critical: true },
            { id: 'alat', label: 'Blender, mixer, juicer, gelas bersih & tidak berkerak', weight: 10 },
            { id: 'suhu', label: 'Under counter, freezer, showcase, cupsealer bersih & suhu terjaga', weight: 12, critical: true },
            { id: 'takaran', label: 'Takaran menu sesuai SOP (tidak asal kira-kira)', weight: 10 },
            { id: 'kerja', label: 'Area kerja rapi bersih, tidak ada tumpahan dibiarkan', weight: 8 },
            { id: 'greeting', label: 'Greeting ke konsumen, cek menu sesuai pesanan', weight: 8 },
            { id: 'sop', label: 'SOP maksimal 5 menit siap di meja bar', weight: 9 },
            { id: 'lowseason', label: 'Manfaatkan low season dengan action', weight: 5, needsApproval: true }
        ],
        selfReport: { id: 'gagalproduk', label: 'Gagal Produk / Salah Antar / Salah Resep', pointsPerEvent: 5 }
    },
    DAPUR: {
        label: 'Dapur',
        items: [
            { id: 'absensi', label: 'Ketepatan Absensi (otomatis dari data absen)', weight: 5, auto: true },
            { id: 'bahan', label: 'Bahan baku tidak lewat tgl exp, FIFO berjalan', weight: 15, critical: true },
            { id: 'suhu', label: 'Under counter, freezer, showcase bersih & suhu terjaga', weight: 12, critical: true },
            { id: 'takaran', label: 'Takaran menu sesuai SOP (tidak asal kira-kira)', weight: 8 },
            { id: 'peralatan', label: 'Peralatan & perlengkapan kerja rapi bersih', weight: 12, critical: true },
            { id: 'kerja', label: 'Area kerja rapi bersih tidak ada tumpahan/sampah', weight: 8 },
            { id: 'sampah', label: 'Sampah dapur dibuang rutin, tidak menumpuk', weight: 6 },
            { id: 'gas', label: 'Kompor/peralatan gas dicek aman sebelum & sesudah shift', weight: 12, critical: true },
            { id: 'plating', label: 'Porsi & plating sesuai SOP', weight: 8 },
            { id: 'sop', label: 'SOP maksimal 13 menit siap di meja open kitchen', weight: 9 },
            { id: 'lowseason', label: 'Manfaatkan low season dengan action', weight: 5, needsApproval: true }
        ],
        selfReport: null
    }
};

const QSC_POS_LIST = ['KASIR', 'DEPAN', 'MINUMAN', 'DAPUR'];

// Jam operasional outlet (disamakan dengan updateOutletStatus() di schedule.js)
// dipakai untuk jendela notifikasi spot-check "jam opening & closing".
function qscGetOutletHoursToday_() {
    const day = new Date().getDay();
    if (day >= 1 && day <= 4) return { open: 11 * 60, close: 22 * 60 };
    if (day === 5) return { open: 12 * 60 + 45, close: 23 * 60 };
    return { open: 10 * 60, close: 23 * 60 };
}

// --- 2. STATE MODAL ---
let qscMode = 'self'; // 'self' | 'spot'
let qscSelectedPos = null;
let qscSpotFindings = {}; // {itemId: {jenis:'minor'|'mayor', catatan, foto}}
let qscKomplain = null; // {catatan, foto} atau null
let qscFotoTempCache = {}; // key -> base64

// --- 3. BUKA MODAL (dipanggil dari tombol menu utama) ---
async function openQscModal() {
    openModal('modal-qsc');
    qscSpotFindings = {};
    qscKomplain = null;
    qscSelectedPos = null;

    const isMoWmo = qscIsMoWmo_();
    const tabSpot = document.getElementById('qsc-tab-spot');
    if (tabSpot) tabSpot.classList.toggle('hidden', !isMoWmo);

    qscSwitchMode('self');
    qscPopulateNamaDropdown_();
}

function qscIsMoWmo_() {
    const jabatan = (window.dashboardAuth && window.dashboardAuth.employee && window.dashboardAuth.employee.jabatan || '').toString().trim().toUpperCase();
    return jabatan === 'MO' || jabatan === 'WMO' || jabatan.indexOf('MANAGER OUTLET') !== -1 || jabatan.indexOf('WAKIL MANAGER') !== -1;
}

function qscPopulateNamaDropdown_() {
    const select = document.getElementById('qsc-select-nama');
    if (!select || !Array.isArray(employeeList)) return;
    let options = '<option value="">-- Pilih Nama Karyawan --</option>';
    employeeList.forEach(emp => {
        const nama = emp.nama ? emp.nama.toString().trim() : '';
        const nik = emp.nik ? emp.nik.toString().trim() : '';
        if (!nama) return;
        options += `<option value="${escapeHtml(nama)}" data-nik="${escapeHtml(nik)}">${escapeHtml(nama)} (${escapeHtml(nik)})</option>`;
    });
    select.innerHTML = options;
}

function qscSwitchMode(mode) {
    qscMode = mode;
    const btnSelf = document.getElementById('qsc-tab-self');
    const btnSpot = document.getElementById('qsc-tab-spot');
    if (btnSelf) btnSelf.classList.toggle('bg-brand-red', mode === 'self');
    if (btnSelf) btnSelf.classList.toggle('text-white', mode === 'self');
    if (btnSpot) btnSpot.classList.toggle('bg-brand-red', mode === 'spot');
    if (btnSpot) btnSpot.classList.toggle('text-white', mode === 'spot');

    const namaWrap = document.getElementById('qsc-nama-wrap');
    if (namaWrap) namaWrap.classList.toggle('hidden', mode === 'spot');

    document.getElementById('qsc-body').innerHTML = '<p class="text-center text-slate-400 text-sm py-6">Pilih posisi operasional dulu di atas.</p>';
    const posSelect = document.getElementById('qsc-select-posisi');
    if (posSelect) posSelect.value = '';
    qscSelectedPos = null;
}

// --- 4. RENDER CHECKLIST SESUAI POSISI ---
function qscOnPosisiChange() {
    const posSelect = document.getElementById('qsc-select-posisi');
    const pos = posSelect ? posSelect.value : '';
    qscSelectedPos = pos;
    qscSpotFindings = {};
    qscKomplain = null;

    const body = document.getElementById('qsc-body');
    if (!pos || !QSC_CONFIG[pos]) {
        body.innerHTML = '<p class="text-center text-slate-400 text-sm py-6">Pilih posisi operasional dulu di atas.</p>';
        return;
    }

    body.innerHTML = qscMode === 'self' ? qscRenderSelfCheckHtml_(pos) : qscRenderSpotCheckHtml_(pos);
}

function qscRenderSelfCheckHtml_(pos) {
    const config = QSC_CONFIG[pos];
    let html = '<div class="space-y-2.5">';

    config.items.forEach(item => {
        if (item.auto) {
            html += `<div class="flex items-center justify-between bg-slate-50 rounded-xl px-3 py-2.5 text-xs sm:text-sm text-slate-500">
                <span><i class="fa-solid fa-clock-rotate-left mr-1.5"></i>${escapeHtml(item.label)}</span>
                <span class="font-semibold">Otomatis</span>
            </div>`;
            return;
        }
        html += `<label class="flex items-center justify-between gap-3 bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-xs sm:text-sm cursor-pointer hover:border-brand-red transition">
            <span class="text-slate-700">${escapeHtml(item.label)}${item.critical ? ' <span class="text-rose-500 font-bold">*Kritis</span>' : ''}${item.needsApproval ? ' <span class="text-amber-500">(perlu approval MO)</span>' : ''}</span>
            <input type="checkbox" data-qsc-item="${item.id}" class="qsc-self-item w-5 h-5 accent-emerald-600 shrink-0" checked>
        </label>`;
    });

    if (config.selfReport) {
        html += `<div class="mt-3 border-t border-dashed border-slate-200 pt-3">
            <label class="block text-xs sm:text-sm font-semibold text-slate-700 mb-1.5">${escapeHtml(config.selfReport.label)} — jumlah kejadian shift ini</label>
            <input type="number" id="qsc-selfreport-count" min="0" value="0" class="w-24 border border-slate-200 rounded-lg px-3 py-2 text-sm mb-2">
            <textarea id="qsc-selfreport-note" rows="2" placeholder="Wajib diisi kalau ada kejadian: jelaskan singkat tiap kejadian" class="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs sm:text-sm"></textarea>
        </div>`;
    }

    html += '</div>';
    return html;
}

function qscRenderSpotCheckHtml_(pos) {
    const config = QSC_CONFIG[pos];
    let html = `<p class="text-xs text-slate-500 mb-3"><i class="fa-solid fa-circle-info mr-1"></i>Semua item dianggap <b>lolos</b> secara default. Cukup tandai item yang <b>TIDAK sesuai</b> saat Anda cek fisik ke lapangan.</p>`;
    html += '<div class="space-y-2.5">';

    config.items.forEach(item => {
        if (item.auto) return; // absensi tidak relevan untuk spot-check
        const finding = qscSpotFindings[item.id];
        html += `<div class="bg-white border ${finding ? 'border-rose-300 bg-rose-50/40' : 'border-slate-200'} rounded-xl px-3 py-2.5 text-xs sm:text-sm">
            <label class="flex items-center justify-between gap-3 cursor-pointer">
                <span class="text-slate-700">${escapeHtml(item.label)}${item.critical ? ' <span class="text-rose-500 font-bold">*Kritis</span>' : ''}</span>
                <input type="checkbox" onchange="qscToggleFinding('${item.id}', this.checked)" class="w-5 h-5 accent-rose-600 shrink-0" ${finding ? 'checked' : ''}>
            </label>
            ${finding ? `
            <div class="mt-2 space-y-2">
                <select id="qsc-finding-jenis-${item.id}" onchange="qscUpdateFindingField('${item.id}','jenis',this.value)" class="w-full border border-rose-200 rounded-lg px-2 py-1.5 text-xs">
                    <option value="minor" ${finding.jenis === 'minor' ? 'selected' : ''}>Temuan Minor (-10)</option>
                    <option value="mayor" ${finding.jenis === 'mayor' ? 'selected' : ''}>Temuan Mayor (-15)</option>
                </select>
                <textarea placeholder="Catatan temuan (wajib)" onchange="qscUpdateFindingField('${item.id}','catatan',this.value)" class="w-full border border-rose-200 rounded-lg px-2 py-1.5 text-xs" rows="2">${escapeHtml(finding.catatan || '')}</textarea>
                <input type="file" accept="image/*" onchange="qscHandleFindingFoto('${item.id}', this)" class="w-full text-[11px]">
            </div>` : ''}
        </div>`;
    });

    html += '</div>';

    // Blok Komplain (terpisah dari 100 poin item)
    html += `<div class="mt-4 border-t border-dashed border-slate-200 pt-3">
        <label class="flex items-center justify-between gap-3 cursor-pointer">
            <span class="text-xs sm:text-sm font-semibold text-slate-700">Ada Komplain Konsumen? (-15 poin)</span>
            <input type="checkbox" onchange="qscToggleKomplain(this.checked)" class="w-5 h-5 accent-rose-600" ${qscKomplain ? 'checked' : ''}>
        </label>
        ${qscKomplain ? `
        <div class="mt-2 space-y-2">
            <textarea placeholder="Catatan komplain (wajib)" onchange="qscUpdateKomplainField('catatan', this.value)" class="w-full border border-rose-200 rounded-lg px-2 py-1.5 text-xs" rows="2">${escapeHtml(qscKomplain.catatan || '')}</textarea>
            <input type="file" accept="image/*" onchange="qscHandleKomplainFoto(this)" class="w-full text-[11px]">
        </div>` : ''}
    </div>`;

    return html;
}

function qscToggleFinding(itemId, checked) {
    if (checked) {
        qscSpotFindings[itemId] = qscSpotFindings[itemId] || { jenis: 'minor', catatan: '', foto: '' };
    } else {
        delete qscSpotFindings[itemId];
    }
    qscOnPosisiChange();
}
function qscUpdateFindingField(itemId, field, value) {
    if (!qscSpotFindings[itemId]) return;
    qscSpotFindings[itemId][field] = value;
}
function qscHandleFindingFoto(itemId, input) {
    const file = input.files && input.files[0];
    if (!file || !qscSpotFindings[itemId]) return;
    const reader = new FileReader();
    reader.onload = () => { qscSpotFindings[itemId].foto = reader.result; };
    reader.readAsDataURL(file);
}
function qscToggleKomplain(checked) {
    qscKomplain = checked ? { catatan: '', foto: '' } : null;
    qscOnPosisiChange();
}
function qscUpdateKomplainField(field, value) {
    if (!qscKomplain) return;
    qscKomplain[field] = value;
}
function qscHandleKomplainFoto(input) {
    const file = input.files && input.files[0];
    if (!file || !qscKomplain) return;
    const reader = new FileReader();
    reader.onload = () => { qscKomplain.foto = reader.result; };
    reader.readAsDataURL(file);
}

// --- 5. HITUNG SKOR LOKAL (pratinjau — skor final tetap dihitung ulang server) ---
function qscComputeSelfScore_(pos) {
    const config = QSC_CONFIG[pos];
    let base = 0;
    config.items.forEach(item => {
        if (item.auto) { base += item.weight; return; } // diasumsikan lolos, server yang koreksi via data absensi asli
        const el = document.querySelector(`[data-qsc-item="${item.id}"]`);
        if (el && el.checked) base += item.weight;
    });
    return base;
}

// --- 6. SUBMIT SELF-CHECK ---
async function submitQscSelfCheck() {
    const namaEl = document.getElementById('qsc-select-nama');
    const nama = namaEl ? namaEl.value : '';
    const nik = namaEl && namaEl.selectedOptions[0] ? namaEl.selectedOptions[0].dataset.nik : '';
    const pos = qscSelectedPos;

    if (!nama || !nik) { showPopup('warning', 'Lengkapi Data', 'Pilih nama karyawan terlebih dahulu.'); return; }
    if (!pos || !QSC_CONFIG[pos]) { showPopup('warning', 'Lengkapi Data', 'Pilih posisi operasional terlebih dahulu.'); return; }

    const config = QSC_CONFIG[pos];
    const itemsChecked = {};
    config.items.forEach(item => {
        if (item.auto) return;
        const el = document.querySelector(`[data-qsc-item="${item.id}"]`);
        itemsChecked[item.id] = !!(el && el.checked);
    });

    let selfReportCount = 0;
    let selfReportNote = '';
    if (config.selfReport) {
        selfReportCount = parseInt(document.getElementById('qsc-selfreport-count').value, 10) || 0;
        selfReportNote = (document.getElementById('qsc-selfreport-note').value || '').trim();
        if (selfReportCount > 0 && !selfReportNote) {
            showPopup('warning', 'Keterangan Wajib', `Isi keterangan untuk ${config.selfReport.label} karena ada ${selfReportCount} kejadian.`);
            return;
        }
    }

    const btn = document.getElementById('qsc-btn-submit');
    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner animate-spin"></i> Menyimpan...'; }

    const payload = {
        action: 'submitQscSelfCheck',
        nik, nama, posisi: pos,
        itemsChecked: JSON.stringify(itemsChecked),
        selfReportCount, selfReportNote
    };

    try {
        const response = await fetch(GAS_WEB_APP_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify(payload)
        });
        const result = await response.json();
        if (result.success) {
            showPopup('success', 'Checklist QSC Tersimpan', result.message, () => closeModal('modal-qsc'));
        } else {
            showPopup('error', 'Gagal Menyimpan', result.message || 'Terjadi kesalahan.');
        }
    } catch (err) {
        showPopup('error', 'Kesalahan Sistem', 'Terjadi kesalahan koneksi: ' + err.toString());
    } finally {
        if (btn) { btn.disabled = false; btn.innerHTML = '<span>Simpan Checklist</span>'; }
    }
}

// --- 7. SUBMIT SPOT-CHECK (MO/WMO) ---
async function submitQscSpotCheck() {
    if (!qscIsMoWmo_()) {
        showPopup('error', 'Akses Ditolak', 'Fitur Spot-Check hanya untuk MO/WMO.');
        return;
    }
    const pos = qscSelectedPos;
    if (!pos || !QSC_CONFIG[pos]) { showPopup('warning', 'Lengkapi Data', 'Pilih posisi operasional terlebih dahulu.'); return; }

    for (const itemId in qscSpotFindings) {
        if (!qscSpotFindings[itemId].catatan) {
            showPopup('warning', 'Catatan Wajib', 'Isi catatan untuk setiap temuan sebelum menyimpan.');
            return;
        }
    }
    if (qscKomplain && !qscKomplain.catatan) {
        showPopup('warning', 'Catatan Wajib', 'Isi catatan komplain sebelum menyimpan.');
        return;
    }

    const employee = window.dashboardAuth && window.dashboardAuth.employee;
    const btn = document.getElementById('qsc-btn-submit');
    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner animate-spin"></i> Menyimpan...'; }

    const payload = {
        action: 'submitQscSpotCheck',
        nikMo: employee ? employee.nik : '',
        namaMo: employee ? employee.nama : '',
        posisi: pos,
        findings: JSON.stringify(qscSpotFindings),
        komplain: qscKomplain ? JSON.stringify(qscKomplain) : ''
    };

    try {
        const response = await fetch(GAS_WEB_APP_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify(payload)
        });
        const result = await response.json();
        if (result.success) {
            invalidateGasCache('getQscTeamSummary');
            showPopup('success', 'Spot-Check Tersimpan', result.message, () => closeModal('modal-qsc'));
        } else {
            showPopup('error', 'Gagal Menyimpan', result.message || 'Terjadi kesalahan.');
        }
    } catch (err) {
        showPopup('error', 'Kesalahan Sistem', 'Terjadi kesalahan koneksi: ' + err.toString());
    } finally {
        if (btn) { btn.disabled = false; btn.innerHTML = '<span>Simpan Spot-Check</span>'; }
    }
}

function qscHandleSubmitClick() {
    if (qscMode === 'self') submitQscSelfCheck();
    else submitQscSpotCheck();
}

// ==========================================================
// 8. NOTIFIKASI OTOMATIS
// ==========================================================

// 8a. Self-check: dipanggil dari absensi.js sesudah CHECKIN/REST_OUT/CHECKOUT
//     berhasil (REST_IN sengaja TIDAK memicu). Ini fungsi baru yang berdiri
//     sendiri — absensi.js hanya menambah satu baris pemanggilan opsional.
function maybeShowQscSelfCheckPrompt(tipe, nik, nama) {
    const trigger = ['CHECKIN', 'REST_OUT', 'CHECKOUT'];
    if (trigger.indexOf((tipe || '').toString().toUpperCase()) === -1) return;

    Swal.fire({
        icon: 'info',
        title: 'Waktunya Checklist QSC',
        text: 'Segera isi checklist QSC untuk posisi Anda hari ini.',
        confirmButtonText: 'Isi Sekarang',
        showCancelButton: true,
        cancelButtonText: 'Nanti',
        confirmButtonColor: '#ED1C24'
    }).then(res => {
        if (res.isConfirmed) {
            openQscModal();
            const namaSelect = document.getElementById('qsc-select-nama');
            if (namaSelect) namaSelect.value = nama;
        }
    });
}
window.maybeShowQscSelfCheckPrompt = maybeShowQscSelfCheckPrompt;

// 8b. Spot-check: dicek sekali saat data karyawan siap (event yang sama
//     dipakai fitur lain di core.js), tanpa mengubah core.js sama sekali —
//     qsc.js cukup memasang listener-nya sendiri untuk event yang sama.
async function qscCheckSpotCheckSchedule_() {
    if (!qscIsMoWmo_()) return;

    const now = new Date();
    const day = now.getDay(); // 0=Minggu ... 6=Sabtu
    const isTuesFriSatSun = [0, 2, 5, 6].indexOf(day) !== -1; // Selasa=2, Jumat=5, Sabtu=6, Minggu=0

    let isHoliday = false;
    try {
        const holidays = await loadNationalHolidays(now.getFullYear());
        const dateKey = now.toISOString().slice(0, 10);
        isHoliday = !!(holidays && holidays[dateKey]);
    } catch (err) { /* diamkan, tidak menghalangi fitur lain */ }

    if (!isTuesFriSatSun && !isHoliday) return;

    const hours = qscGetOutletHoursToday_();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    const nearOpen = Math.abs(currentMinutes - hours.open) <= 30;
    const nearClose = Math.abs(currentMinutes - hours.close) <= 30;
    if (!nearOpen && !nearClose) return;

    const flagKey = 'qsc_spotcheck_notif_' + now.toISOString().slice(0, 10) + '_' + (nearOpen ? 'open' : 'close');
    if (sessionStorage.getItem(flagKey)) return; // 1x per sesi jam itu, tidak spam
    sessionStorage.setItem(flagKey, '1');

    Swal.fire({
        icon: 'info',
        title: 'Waktunya Spot-Check QSC',
        text: `Sesi ${nearOpen ? 'opening' : 'closing'} hari ini — lakukan spot-check ke pos-pos operasional.`,
        confirmButtonText: 'Mulai Spot-Check',
        showCancelButton: true,
        cancelButtonText: 'Nanti',
        confirmButtonColor: '#ED1C24'
    }).then(res => {
        if (res.isConfirmed) {
            openQscModal();
            qscSwitchMode('spot');
        }
    });
}
window.addEventListener('arjunohub:employee-ready', function () {
    setTimeout(qscCheckSpotCheckSchedule_, 1500);
});

// ==========================================================
// 9. BADGE SKOR QSC DI KARTU PROFIL TIM
// Tidak mengubah team.js sama sekali — badge disisipkan dari luar
// dengan membungkus renderOurTeamSection() setelah file itu dimuat.
// ==========================================================
(function wrapRenderOurTeamSectionForQscBadge_() {
    const original = window.renderOurTeamSection;
    if (typeof original !== 'function') return; // team.js belum siap, badge dilewati (tidak fatal)

    window.renderOurTeamSection = function () {
        original.apply(this, arguments);
        qscInjectBadges_();
    };
})();

async function qscInjectBadges_() {
    try {
        const result = await gasJsonp('getQscTeamSummary', {}, { cacheMs: 5 * 60 * 1000 });
        if (!result || !result.success || !result.data) return;

        document.querySelectorAll('[id^="team-nik-"]').forEach(el => {
            const nik = (el.textContent || '').replace('NIK:', '').trim().toUpperCase();
            const summary = result.data[nik];
            // Hapus badge lama (kalau render ulang) sebelum pasang yang baru
            const existingBadge = el.parentElement ? el.parentElement.querySelector('.qsc-badge') : null;
            if (existingBadge) existingBadge.remove();
            if (!summary) return;

            const color = qscScoreColor_(summary.monthly);
            const badge = document.createElement('div');
            badge.className = 'qsc-badge mt-1 text-[9px] sm:text-[10px] font-semibold px-2 py-0.5 rounded-full border inline-flex items-center gap-1 ' + color;
            badge.innerHTML = `<i class="fa-solid fa-clipboard-check"></i> QSC: Minggu ${summary.weekly}% · Bulan ${summary.monthly}%`;
            el.insertAdjacentElement('afterend', badge);
        });
    } catch (err) { /* diamkan — badge bersifat pelengkap, tidak boleh mengganggu render tim */ }
}

function qscScoreColor_(score) {
    if (score >= 90) return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    if (score >= 75) return 'bg-lime-50 text-lime-700 border-lime-200';
    if (score >= 60) return 'bg-amber-50 text-amber-700 border-amber-200';
    return 'bg-rose-50 text-rose-700 border-rose-200';
}
