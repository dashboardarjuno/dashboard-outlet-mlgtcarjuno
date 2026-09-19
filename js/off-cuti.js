// ==========================================================
// OFF-CUTI.JS — Pengajuan izin Off & Cuti karyawan
// Validasi 2 lapis: saat pilih tanggal + saat submit ke backend.
// ==========================================================

let offCutiConfig = null;

// Guard anti klik-ganda / submit bersamaan. Dicek & dikunci secara SINKRON
// di baris pertama submitOffCuti(), sebelum ada `await` apa pun. Ini penting
// karena tanpa guard ini, dua klik cepat (atau double-tap di HP) bisa memicu
// dua eksekusi submitOffCuti() yang berjalan bersamaan — keduanya lolos semua
// validasi karena tombol submit baru ter-disable SETELAH await pertama selesai.
let isSubmittingOffCuti = false;

async function loadOffCutiConfig(forceRefresh = false) {
    try {
        const res = await gasJsonp('getOffCutiConfig', {}, {cacheMs: forceRefresh ? 0 : 30000});
        if (res && res.success) {
            offCutiConfig = res;
            return res;
        }
    } catch (err) {
        console.error('Gagal memuat konfigurasi OFF/Cuti:', err);
    }
    return null;
}

async function openOffCutiModal() {
    // Pasang batas tanggal secara sinkron sebelum modal terlihat. Ini penting
    // pada koneksi lambat/iOS: Safari dapat membuka date picker segera setelah
    // tap, sementara konfigurasi dari server masih dimuat.
    configureOffCutiDateInputs();
    openModal('modal-off-cuti');
    if (employeeList.length === 0) await loadInitialData();

    const config = await loadOffCutiConfig(true);
    await loadDisabledDates();
    configureOffCutiDateInputs();

    const info = document.getElementById('off-cuti-period-info');
    if (info && config) {
        info.textContent = config.isOpen
            ? `Periode pengajuan dibuka tanggal ${config.startDay}–${config.endDay}. Tanggal OFF/Cuti hanya untuk ${config.targetMonthName}.`
            : `Pengajuan sedang ditutup. Dibuka tanggal ${config.startDay}–${config.endDay} setiap bulan untuk pengajuan bulan berikutnya.`;
    }

    if (config && !config.isOpen) {
        showPopup(
            'warning',
            'Periode Pengajuan Ditutup',
            `Pengajuan OFF/Cuti dibuka tanggal ${config.startDay} sampai ${config.endDay} setiap bulan. Pengajuan selalu untuk bulan berikutnya.`
        );
    }
}

function getOffCutiTargetPeriod() {
    if (offCutiConfig && offCutiConfig.minDate && offCutiConfig.maxDate) {
        return {
            year: offCutiConfig.targetYear,
            month: String(offCutiConfig.targetMonth).padStart(2, '0'),
            min: offCutiConfig.minDate,
            max: offCutiConfig.maxDate
        };
    }

    // Fallback UI saja. Backend tetap menjadi sumber kebenaran.
    const now = new Date();
    const targetDate = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const year = targetDate.getFullYear();
    const month = String(targetDate.getMonth() + 1).padStart(2, '0');
    const lastDay = new Date(year, targetDate.getMonth() + 1, 0).getDate();
    return {
        year,
        month,
        min: `${year}-${month}-01`,
        max: `${year}-${month}-${String(lastDay).padStart(2, '0')}`
    };
}

function configureOffCutiDateInputs() {
    bindOffCutiDateEvents();
    const period = getOffCutiTargetPeriod();
    const isOpen = !offCutiConfig || offCutiConfig.isOpen !== false;

    document.querySelectorAll('.input-tgl-off').forEach(function(input) {
        input.min = period.min;
        input.max = period.max;
        input.disabled = !isOpen;
        if (input.value && (input.value < period.min || input.value > period.max)) input.value = '';
    });

    const btnSubmit = document.getElementById('btn-submit-off');
    if (btnSubmit) btnSubmit.disabled = !isOpen;

    const namaSelect = document.getElementById('select-nama-off');
    if (namaSelect && namaSelect.dataset.offCutiBound !== '1') {
        namaSelect.dataset.offCutiBound = '1';
        namaSelect.addEventListener('change', function() {
            recheckPendingOffCutiDates();
        });
    }
}

function normalizeOffCutiDate(value) {
    // input[type="date"] returns YYYY-MM-DD on modern browsers.
    // Keep it as a plain calendar string: never parse through new Date(value),
    // because Safari/WebKit can apply timezone conversions to ISO dates.
    const clean = (value || '').toString().trim();
    return /^\d{4}-\d{2}-\d{2}$/.test(clean) ? clean : '';
}

function bindOffCutiDateEvents() {
    document.querySelectorAll('.input-tgl-off').forEach(function(input) {
        if (input.dataset.offCutiBound === '1') return;
        input.dataset.offCutiBound = '1';

        // Safari iPhone kadang menginisialisasi input date kosong dengan tanggal
        // hari ini walaupun `min` berada di bulan berikutnya. Prime nilainya pada
        // pointerdown (sebelum picker dibuka) supaya roda kalender mulai dari
        // periode yang sah. Programmatic assignment tidak memicu event `change`.
        const prepareNativeDatePicker = function() {
            if (normalizeOffCutiDate(input.value)) return;
            const period = getOffCutiTargetPeriod();
            input.min = period.min;
            input.max = period.max;
            input.value = period.min;
            input.dataset.pickerPrimed = '1';
        };

        input.addEventListener('pointerdown', prepareNativeDatePicker, {passive: true});
        input.addEventListener('touchstart', prepareNativeDatePicker, {passive: true});
        input.addEventListener('focus', prepareNativeDatePicker);

        // `change` fires after the native date picker commits its value.
        // Do not use `input` here: Safari/iOS may fire it while the picker is open.
        input.addEventListener('change', function() {
            delete input.dataset.pickerPrimed;
            delete input.dataset.quotaChecked;
            checkTanggalKuota(input);
        });
    });
}

async function checkTanggalKuota(input) {
    const selectedDate = normalizeOffCutiDate(input.value);
    if (!selectedDate) return;

    // Local validations are safe to do after the picker has committed.
    const period = getOffCutiTargetPeriod();
    if (selectedDate < period.min || selectedDate > period.max) {
        input.value = '';
        showPopup('warning', 'Tanggal Tidak Sesuai', 'Tanggal OFF/Cuti hanya boleh dipilih untuk bulan berikutnya.');
        return;
    }

    const sameDates = [...document.querySelectorAll('.input-tgl-off')]
        .filter(el => el !== input && normalizeOffCutiDate(el.value) === selectedDate);
    if (sameDates.length > 0) {
        input.value = '';
        showPopup('warning', 'Tanggal Duplikat', 'Tanggal yang sama sudah dipilih pada kolom lain.');
        return;
    }

    const namaEl = document.getElementById('select-nama-off');
    const nama = namaEl ? namaEl.value : '';
    const selectedEmployee = employeeList.find(emp =>
        (emp.nama || '').toString().trim().toUpperCase() === nama.toString().trim().toUpperCase()
    );
    const nik = selectedEmployee ? (selectedEmployee.nik || '').toString().trim() : '';

    // IMPORTANT for iPhone/Mac Safari:
    // allow the user to choose a date even when the employee name has not been
    // selected yet. Quota will be checked later (or during final submit).
    // Previously the date was immediately cleared and a popup was shown.
    if (!nama || !nik) {
        input.dataset.quotaPending = '1';
        return;
    }

    // Never disable a date input while Safari's native picker is settling.
    // Use a request token so an older async response cannot overwrite a newer choice.
    const requestToken = String(Date.now()) + Math.random().toString(36).slice(2);
    input.dataset.quotaRequest = requestToken;
    input.dataset.quotaChecking = '1';
    delete input.dataset.quotaPending;

    try {
        const result = await gasJsonp('checkOffCutiDate', {
            nik: nik,
            nama: nama,
            date: selectedDate
        }, {cacheMs: 0});

        if (input.dataset.quotaRequest !== requestToken || input.value !== selectedDate) return;

        if (!result || !result.success) {
            input.value = '';
            delete input.dataset.quotaChecked;
            showPopup('warning', 'Tanggal Tidak Tersedia', result && result.message ? result.message : 'Kuota tanggal ini tidak tersedia.');
            return;
        }

        input.dataset.quotaChecked = '1';
    } catch (err) {
        if (input.dataset.quotaRequest !== requestToken || input.value !== selectedDate) return;
        // Keep the chosen date. Final submit still validates against the backend.
        delete input.dataset.quotaChecked;
        input.dataset.quotaPending = '1';
        console.error('Gagal cek kuota OFF/Cuti:', err);
    } finally {
        if (input.dataset.quotaRequest === requestToken) {
            delete input.dataset.quotaChecking;
        }
    }
}

async function recheckPendingOffCutiDates() {
    const inputs = [...document.querySelectorAll('.input-tgl-off')];
    for (const input of inputs) {
        if (input.value) await checkTanggalKuota(input);
    }
}

// Kirim payload pengajuan OFF/Cuti ke backend dan kembalikan hasil JSON-nya.
// Dipisah jadi fungsi sendiri supaya bisa dipakai ulang untuk auto-retry
// saat backend membalas SERVER_BUSY (lihat submitOffCuti di bawah).
async function postOffCutiPayload(payload) {
    const response = await fetch(GAS_WEB_APP_URL, {
        method: 'POST',
        headers: {'Content-Type': 'text/plain;charset=utf-8'},
        body: JSON.stringify(payload)
    });
    return await response.json();
}

async function submitOffCuti(e) {
    e.preventDefault();

    // --- GUARD ANTI KLIK-GANDA / SUBMIT BERSAMAAN ---
    // Dicek & dikunci di sini juga, SEBELUM baris `await` pertama di bawah.
    // Kalau proses sebelumnya masih berjalan (isSubmittingOffCuti true) atau
    // tombolnya sudah disabled, langsung berhenti — tidak boleh ada eksekusi
    // kedua yang lolos masuk ke validasi/submit.
    const btnSubmit = document.getElementById('btn-submit-off');
    if (isSubmittingOffCuti || (btnSubmit && btnSubmit.disabled)) {
        return;
    }
    isSubmittingOffCuti = true;
    if (btnSubmit) {
        btnSubmit.disabled = true;
        btnSubmit.innerHTML = `<i class="fa-solid fa-spinner animate-spin"></i> Memproses...`;
    }

    try {
        // Refresh konfigurasi agar perubahan tanggal buka/tutup di GSheet langsung dipakai.
        const latestConfig = await loadOffCutiConfig(true);
        if (latestConfig && !latestConfig.isOpen) {
            showPopup(
                'warning',
                'Periode Pengajuan Ditutup',
                `Pengajuan OFF/Cuti hanya dibuka tanggal ${latestConfig.startDay} sampai ${latestConfig.endDay} setiap bulan.`
            );
            configureOffCutiDateInputs();
            return;
        }

        const nama = document.getElementById('select-nama-off').value;
        const selectedEmployee = employeeList.find(emp =>
            (emp.nama || '').toString().trim().toUpperCase() === nama.toString().trim().toUpperCase()
        );
        const nik = selectedEmployee ? (selectedEmployee.nik || '').toString().trim() : '';
        const inputs = document.querySelectorAll('.input-tgl-off');
        const keterangan = document.getElementById('input-keterangan-off').value.trim();

        const selectedDates = [];
        inputs.forEach(inp => {
            if (inp.value) {
                const cleanDate = normalizeOffCutiDate(inp.value);
                if (cleanDate) selectedDates.push(cleanDate);
            }
        });

        const period = getOffCutiTargetPeriod();
        const uniqueDates = [...new Set(selectedDates)].sort();
        const invalidPeriodDate = uniqueDates.find(date => date < period.min || date > period.max);

        if (!nama || !nik || uniqueDates.length === 0 || !keterangan) {
            showPopup('warning', 'Data Belum Lengkap', 'Pilih nama, minimal 1 tanggal, dan isi keterangan acara.');
            return;
        }

        if (invalidPeriodDate) {
            showPopup('warning', 'Tanggal Tidak Sesuai Periode', 'Tanggal libur hanya boleh dipilih untuk bulan berikutnya.');
            return;
        }

        const payload = {
            action: 'submitOffCuti',
            nik: nik,
            nama: nama,
            dates: uniqueDates,
            keterangan: keterangan
        };

        try {
            let result = await postOffCutiPayload(payload);

            // SERVER_BUSY: banyak karyawan lain sedang submit bersamaan dan
            // backend lagi antre (LockService). Coba OTOMATIS sekali lagi
            // setelah jeda singkat sebelum menampilkan apa pun ke user —
            // supaya mereka tidak perlu klik ulang manual sendiri.
            if (result && result.success === false && result.code === 'SERVER_BUSY') {
                await new Promise(resolve => setTimeout(resolve, 2500));
                result = await postOffCutiPayload(payload);
            }

            if (result.success) {
                invalidateGasCache('getDisabledDates');
                invalidateGasCache('getMonthlyRekap');
                invalidateGasCache('getOffCutiConfig');
                showPopup('success', 'Pengajuan Berhasil!', result.message, function () {
                    closeModal('modal-off-cuti');
                    document.getElementById('form-off-cuti').reset();
                    loadDisabledDates();
                    loadDashboardMonthlyRekap();
                });
            } else if (result.code === 'DUPLICATE_SUBMIT') {
                // Pengajuan yang persis sama sudah lebih dulu berhasil disimpan
                // (klik ganda/tab dobel). Ini bukan penolakan biasa, jadi
                // tampilkan sebagai info, bukan error yang bikin khawatir.
                showPopup('warning', 'Sudah Terkirim', result.message);
                await loadDisabledDates();
            } else if (result.code === 'SERVER_BUSY') {
                showPopup('warning', 'Server Sedang Sibuk', result.message || 'Sistem sedang memproses banyak pengajuan sekaligus. Silakan coba lagi sebentar.');
            } else {
                showPopup('error', 'Pengajuan Ditolak', result.message);
                await loadDisabledDates();
            }
        } catch (err) {
            showPopup('error', 'Kesalahan Sistem', 'Terjadi kesalahan koneksi ke Google Sheet: ' + err.toString());
        }
    } finally {
        // Selalu lepas kunci & pulihkan tombol di SETIAP jalur keluar
        // (validasi gagal, periode tutup, sukses, error, ataupun exception
        // tak terduga) supaya tombol tidak macet ke-disable selamanya.
        isSubmittingOffCuti = false;
        if (btnSubmit) {
            btnSubmit.disabled = false;
            btnSubmit.innerHTML = `<span>Kirim Pengajuan Libur</span>`;
        }
        configureOffCutiDateInputs();
    }
}
