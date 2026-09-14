// ==========================================================
// OFF-CUTI.JS — Pengajuan izin Off & Cuti karyawan
// Validasi 2 lapis: saat pilih tanggal + saat submit ke backend.
// ==========================================================

let offCutiConfig = null;

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
}

async function checkTanggalKuota(input) {
    const selectedDate = normalizeMatrixDate(input.value);
    if (!selectedDate) return;

    const nama = document.getElementById('select-nama-off').value;
    const selectedEmployee = employeeList.find(emp =>
        (emp.nama || '').toString().trim().toUpperCase() === nama.toString().trim().toUpperCase()
    );
    const nik = selectedEmployee ? (selectedEmployee.nik || '').toString().trim() : '';

    if (!nama || !nik) {
        input.value = '';
        showPopup('warning', 'Pilih Nama Dulu', 'Pilih nama karyawan terlebih dahulu sebelum memilih tanggal OFF/Cuti.');
        return;
    }

    const period = getOffCutiTargetPeriod();
    if (selectedDate < period.min || selectedDate > period.max) {
        input.value = '';
        showPopup('warning', 'Tanggal Tidak Sesuai', 'Tanggal OFF/Cuti hanya boleh dipilih untuk bulan berikutnya.');
        return;
    }

    const sameDates = [...document.querySelectorAll('.input-tgl-off')]
        .filter(el => el !== input && normalizeMatrixDate(el.value) === selectedDate);
    if (sameDates.length > 0) {
        input.value = '';
        showPopup('warning', 'Tanggal Duplikat', 'Tanggal yang sama sudah dipilih pada kolom lain.');
        return;
    }

    input.disabled = true;
    try {
        const result = await gasJsonp('checkOffCutiDate', {
            nik: nik,
            nama: nama,
            date: selectedDate
        }, {cacheMs: 0});

        if (!result || !result.success) {
            input.value = '';
            showPopup('warning', 'Tanggal Tidak Tersedia', result && result.message ? result.message : 'Kuota tanggal ini tidak tersedia.');
            return;
        }

        // Lolos cek awal. Final check tetap dilakukan lagi saat tombol Kirim ditekan.
        input.dataset.quotaChecked = '1';
    } catch (err) {
        input.value = '';
        showPopup('error', 'Gagal Cek Kuota', 'Tidak dapat mengecek kuota tanggal. Silakan coba lagi.');
    } finally {
        input.disabled = false;
    }
}

async function submitOffCuti(e) {
    e.preventDefault();

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
            const cleanDate = normalizeMatrixDate(inp.value);
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

    const btnSubmit = document.getElementById('btn-submit-off');
    btnSubmit.disabled = true;
    btnSubmit.innerHTML = `<i class="fa-solid fa-spinner animate-spin"></i> Memproses...`;

    const payload = {
        action: 'submitOffCuti',
        nik: nik,
        nama: nama,
        dates: uniqueDates,
        keterangan: keterangan
    };

    try {
        const response = await fetch(GAS_WEB_APP_URL, {
            method: 'POST',
            headers: {'Content-Type': 'text/plain;charset=utf-8'},
            body: JSON.stringify(payload)
        });

        const result = await response.json();

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
        } else {
            showPopup('error', 'Pengajuan Ditolak', result.message);
            await loadDisabledDates();
        }
    } catch (err) {
        showPopup('error', 'Kesalahan Sistem', 'Terjadi kesalahan koneksi ke Google Sheet: ' + err.toString());
    } finally {
        btnSubmit.disabled = false;
        btnSubmit.innerHTML = `<span>Kirim Pengajuan Libur</span>`;
        configureOffCutiDateInputs();
    }
}
