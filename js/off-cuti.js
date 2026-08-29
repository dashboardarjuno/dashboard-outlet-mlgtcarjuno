// ==========================================================
// OFF-CUTI.JS — Pengajuan izin Off & Cuti karyawan
// ==========================================================

        async function openOffCutiModal() {
            openModal('modal-off-cuti');
            if (employeeList.length === 0) await loadInitialData();
            await loadDisabledDates();
            configureOffCutiDateInputs();
        }

        function getOffCutiTargetPeriod() {
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
            document.querySelectorAll('.input-tgl-off').forEach(function(input) {
                input.min = period.min;
                input.max = period.max;
            });
        }

        function checkTanggalKuota(input) {
            const selectedDate = input.value;
            if (!selectedDate) return;

            if (disabledDates.includes(selectedDate)) {
                showPopup('warning', 'Kuota Penuh!', 'Kuota libur untuk tanggal ini sudah penuh. Silakan pilih tanggal lain.');
                input.value = "";
            }
        }

        async function submitOffCuti(e) {
            e.preventDefault();

            const currentDay = new Date().getDate();
            if (currentDay < 15 || currentDay > 25) {
                showPopup('warning', 'Periode Pengajuan Ditutup', 'Pengajuan OFF/Cuti hanya dibuka tanggal 15 sampai 25 setiap bulan.');
                return;
            }

            const nama = document.getElementById("select-nama-off").value;
            const selectedEmployee = employeeList.find(emp => (emp.nama || '').toString().trim().toUpperCase() === nama.toString().trim().toUpperCase());
            const nik = selectedEmployee ? (selectedEmployee.nik || '').toString().trim() : '';
            const inputs = document.querySelectorAll(".input-tgl-off");
            const keterangan = document.getElementById("input-keterangan-off").value.trim();

            const selectedDates = [];
            inputs.forEach(inp => {
                if (inp.value) {
                    // Memastikan format ISO YYYY-MM-DD aman di Safari
                    const cleanDate = normalizeMatrixDate(inp.value);
                    if (cleanDate) selectedDates.push(cleanDate);
                }
            });

            const period = getOffCutiTargetPeriod();
            const uniqueDates = [...new Set(selectedDates)].sort();
            const invalidPeriodDate = uniqueDates.find(date => date < period.min || date > period.max);

            if (!nama || uniqueDates.length === 0 || !keterangan) {
                showPopup('warning', 'Data Belum Lengkap', 'Pilih minimal 1 tanggal dan isi Keterangan Acara!');
                return;
            }

            if (invalidPeriodDate) {
                showPopup('warning', 'Tanggal Tidak Sesuai Periode', 'Tanggal libur hanya boleh dipilih untuk bulan berikutnya.');
                return;
            }

            const btnSubmit = document.getElementById("btn-submit-off");
            btnSubmit.disabled = true;
            btnSubmit.innerHTML = `<i class="fa-solid fa-spinner animate-spin"></i> Memproses...`;

            const payload = {
                action: "submitOffCuti",
                nik: nik,
                nama: nama,
                dates: uniqueDates,
                keterangan: keterangan
            };

            try {
                const response = await fetch(GAS_WEB_APP_URL, {
                    method: "POST",
                    headers: {"Content-Type": "text/plain;charset=utf-8"},
                    body: JSON.stringify(payload)
                });

                const result = await response.json();

                if (result.success) {
                    showPopup('success', 'Pengajuan Berhasil!', result.message, function () {
                        closeModal("modal-off-cuti");
                        document.getElementById("form-off-cuti").reset();
                        loadDisabledDates();
                        loadDashboardMonthlyRekap();
                    });
                } else {
                    showPopup('error', 'Pengajuan Ditolak', result.message);
                }
            } catch (err) {
                showPopup('error', 'Kesalahan Sistem', 'Terjadi kesalahan koneksi ke Google Sheet: ' + err.toString());
            } finally {
                btnSubmit.disabled = false;
                btnSubmit.innerHTML = `<span>Kirim Pengajuan Libur</span>`;
            }
        }

