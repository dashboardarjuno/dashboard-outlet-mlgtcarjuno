// ==========================================================
// DASHBOARD.JS — Rekap bulanan, kalender/hari libur nasional,
// dan pemuatan data awal dashboard
// ==========================================================

const nationalHolidayCache = {};

        async function loadNationalHolidays(year) {
            if (nationalHolidayCache[year]) return nationalHolidayCache[year];

            let holidayMap = {};

            // --- LAPIS 1: Ambil dari Rekap GSheet (Sheet "Hari_Libur") ---
            try {
                const baseUrl = typeof SCRIPT_URL !== 'undefined' ? SCRIPT_URL : GAS_WEB_APP_URL;
                const responseGsheet = await fetch(baseUrl + `?action=getHolidays&year=${year}`);
                const resultGsheet = await responseGsheet.json();

                if (resultGsheet && Array.isArray(resultGsheet.data)) {
                    resultGsheet.data.forEach(item => {
                        if (item.date && item.name) {
                            holidayMap[item.date] = item.name;
                        }
                    });
                }
            } catch (err) {
                // Lanjut ke lapis berikutnya jika GSheet gagal
            }

            // --- LAPIS 2: Ambil dari API Vercel (Sinkron SKB 3 Menteri) ---
            if (Object.keys(holidayMap).length === 0) {
                try {
                    const responseVercel = await fetch(`https://api-hari-libur.vercel.app/api?year=${year}`);
                    if (responseVercel.ok) {
                        const holidaysVercel = await responseVercel.json();
                        holidaysVercel.forEach(holiday => {
                            if (holiday.is_national_holiday && holiday.holiday_date) {
                                holidayMap[holiday.holiday_date] = holiday.holiday_name || 'Hari Libur Nasional';
                            }
                        });
                    }
                } catch (err) {
                    // Lanjut ke Nager.Date jika Vercel gagal
                }
            }

            // --- LAPIS 3: Ambil dari Nager.Date (Cadangan Global) ---
            if (Object.keys(holidayMap).length === 0) {
                try {
                    const responseNager = await fetch(`https://date.nager.at/api/v3/PublicHolidays/${year}/ID`);
                    if (responseNager.ok) {
                        const holidaysNager = await responseNager.json();
                        holidaysNager.forEach(holiday => {
                            if (holiday.date && (holiday.localName || holiday.name)) {
                                holidayMap[holiday.date] = holiday.localName || holiday.name;
                            }
                        });
                    }
                } catch (err) {
                    console.warn(`Semua sumber data libur untuk tahun ${year} gagal dimuat.`);
                }
            }

            // Simpan ke cache agar efisien
            nationalHolidayCache[year] = holidayMap;
            return holidayMap;
        }

        function getCalendarDateInfo(year, month, day, nationalHolidays) {
            const dateKey = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const date = new Date(Date.UTC(year, month - 1, day));
            const dayOfWeek = date.getUTCDay();
            const holidayName = nationalHolidays[dateKey] || '';

            return {
                dateKey,
                isSaturday: dayOfWeek === 6,
                isSunday: dayOfWeek === 0,
                isWeekend: dayOfWeek === 0 || dayOfWeek === 6,
                isNationalHoliday: Boolean(holidayName),
                holidayName
            };
        }

        async function loadDashboardMonthlyRekap() {
            const tbody = document.getElementById('tbody-dashboard-rekap');
            const thead = document.getElementById('thead-matriks');
            if (!tbody || !thead) return;

            let monthVal = document.getElementById("filter-bulan-matriks").value;
            if (!monthVal) {
                const now = new Date();
                monthVal = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
                document.getElementById("filter-bulan-matriks").value = monthVal;
            }

            const [yearStr, monthStr] = monthVal.split("-");
            const year = parseInt(yearStr);
            const month = parseInt(monthStr);

            const daysInMonth = new Date(year, month, 0).getDate();
            const nationalHolidays = await loadNationalHolidays(year);

            // 1. Render Header Tanggal
            let theadHTML = `
    <tr class="bg-slate-100 text-slate-700 border-b border-slate-200">
        <th class="py-1.5 px-2 font-bold sticky left-0 bg-slate-100 z-30 min-w-[150px] max-w-[150px] shadow-[2px_0_5px_rgba(0,0,0,0.05)] border-r border-slate-200 text-xs">Nama Karyawan</th>
`;
            for (let d = 1; d <= daysInMonth; d++) {
                const dateInfo = getCalendarDateInfo(year, month, d, nationalHolidays);
                const headerClass = dateInfo.isNationalHoliday
                    ? 'bg-red-100 text-red-700'
                    : dateInfo.isSunday
                        ? 'bg-red-100 text-red-700'
                        : dateInfo.isSaturday
                            ? 'bg-amber-100 text-amber-700'
                            : (d % 2 === 0 ? 'bg-slate-100' : 'bg-slate-50/70');
                const holidayTitle = dateInfo.isNationalHoliday ? ` title="${dateInfo.holidayName}"` : '';
                theadHTML += `<th${holidayTitle} class="p-1 text-center font-bold min-w-[28px] w-[28px] border-r border-slate-200 text-[11px] ${headerClass}">${d}</th>`;
            }
            theadHTML += `</tr>`;
            thead.innerHTML = theadHTML;

            tbody.innerHTML = `<tr><td colspan="${daysInMonth + 1}" class="text-center p-6 text-slate-400 font-medium"><i class="fa-solid fa-spinner animate-spin mr-2"></i> Mengambil data matriks jadwal...</td></tr>`;

            try {
                if (!employeeList || employeeList.length === 0) {
                    await loadInitialData();
                }

                const baseUrl = typeof SCRIPT_URL !== 'undefined' ? SCRIPT_URL : GAS_WEB_APP_URL;
                const response = await fetch(baseUrl + `?action=getMonthlyRekap&year=${year}&month=${month}`);
                const res = await response.json();

                let rawList = [];
                if (Array.isArray(res)) rawList = res;
                else if (res && Array.isArray(res.data)) rawList = res.data;
                else if (res && Array.isArray(res.rekap)) rawList = res.rekap;

                const employeeDatesMap = {};

                rawList.forEach(item => {
                    let nama = (item.nama || item.Nama || '').toString().trim().toUpperCase();
                    let nik = (item.nik || item.NIK || '').toString().trim().toUpperCase();
                    let rawTgl = item.tanggal || item.Tanggal || '';
                    let keterangan = item.keterangan || item.Keterangan || '';

                    if (!nama && !nik) return;

                    let matchedEmp = null;
                    if (nik) matchedEmp = employeeList.find(e => (e.nik || e.NIK || '').toString().trim().toUpperCase() === nik);
                    if (!matchedEmp && nama) matchedEmp = employeeList.find(e => (e.nama || e.Nama || '').toString().trim().toUpperCase() === nama);

                    // Tentukan key pemetaan data internal
                    const scheduleKey = matchedEmp
                        ? getEmployeeScheduleKey(matchedEmp)
                        : (nik ? `NIK:${nik}` : `NAME:${nama}`);

                    if (!employeeDatesMap[scheduleKey]) employeeDatesMap[scheduleKey] = [];

                    let arrayTgl = [];
                    if (Array.isArray(rawTgl)) arrayTgl = rawTgl;
                    else if (typeof rawTgl === 'string') arrayTgl = rawTgl.split(/[,;]+/);
                    else arrayTgl = [String(rawTgl)];

                    arrayTgl.forEach(t => {
                        let dateStr = String(t).trim();
                        if (dateStr) {
                            // Normalisasi format YYYY-MM-DD
                            if (dateStr.includes('T')) dateStr = dateStr.split('T')[0];

                            if (!employeeDatesMap[scheduleKey].some(e => e.tgl === dateStr)) {
                                employeeDatesMap[scheduleKey].push({
                                    tgl: dateStr,
                                    keterangan: keterangan
                                });
                            }
                        }
                    });
                });

                // HANYA RENDER KARYAWAN DARI employeeList (Mencegah teks NIK:WSI... muncul sebagai baris nama)
                const employeesToRender = employeeList.filter(e => e.nama || e.Nama);

                if (employeesToRender.length === 0) {
                    tbody.innerHTML = `<tr><td colspan="${daysInMonth + 1}" class="text-center p-6 text-slate-400 font-medium">Belum ada data karyawan terdaftar.</td></tr>`;
                    return;
                }

                const namaBulanIndo = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"][month - 1];
                let tbodyHTML = "";

                employeesToRender.forEach(empObj => {
                    const empNama = (empObj.nama || empObj.Nama || '').toString().trim().toUpperCase();
                    const empScheduleKey = getEmployeeScheduleKey(empObj);

                    // Ambil entri libur karyawan ini
                    let userEntries = (employeeDatesMap[empScheduleKey] || employeeDatesMap[`NAME:${empNama}`] || []).slice();

                    // FILTER KHUSUS BULAN DAN TAHUN YANG AKTIF SAJA
                    const currentMonthPrefix = `${year}-${String(month).padStart(2, '0')}`;
                    userEntries = userEntries.filter(entry => entry.tgl.startsWith(currentMonthPrefix));

                    // Urutkan berdasarkan tanggal (1 - 31)
                    userEntries.sort((a, b) => a.tgl.localeCompare(b.tgl));

                    // Petakan index libur bulan ini (Hari ke-1 s/d 4 = x, Hari ke-5+ = ct)
                    const lookupUserMonth = {};
                    let orderIndex = 1;

                    userEntries.forEach(entry => {
                        lookupUserMonth[entry.tgl] = {
                            index: orderIndex++,
                            keterangan: entry.keterangan
                        };
                    });

                    tbodyHTML += `
    <tr class="hover:bg-slate-50 transition border-b border-slate-100">
        <td class="py-1.5 px-2 font-semibold text-slate-800 text-xs sticky left-0 bg-white z-10 shadow-[2px_0_5px_rgba(0,0,0,0.05)] border-r border-slate-200 whitespace-nowrap max-w-[150px] truncate">${empNama}</td>
`;

                    for (let d = 1; d <= daysInMonth; d++) {
                        const dayPadded = String(d).padStart(2, '0');
                        const monthPadded = String(month).padStart(2, '0');
                        const fullDateKey = `${year}-${monthPadded}-${dayPadded}`;

                        const matchData = lookupUserMonth[fullDateKey];
                        const dateInfo = getCalendarDateInfo(year, month, d, nationalHolidays);

                        if (matchData) {
                            // Penentuan simbol: libur ke-1 s/d 4 = x (OFF), libur ke-5 dst = ct (CUTI)
                            const isCuti = matchData.index >= 5;
                            const symbol = isCuti ? 'ct' : 'x';
                            const labelJenis = isCuti ? 'CUTI' : 'OFF';
                            const titleTooltip = `${empNama} - ${d} ${namaBulanIndo} ${year}: ${labelJenis} (Libur Hari ke-${matchData.index}) - ${matchData.keterangan || 'Tanpa keterangan'}`;

                            if (isCuti) {
                                tbodyHTML += `<td title="${titleTooltip}" class="p-1 text-center font-extrabold text-purple-700 bg-purple-100/70 border-r border-slate-200 cursor-pointer select-none">${symbol}</td>`;
                            } else {
                                tbodyHTML += `<td title="${titleTooltip}" class="p-1 text-center font-extrabold text-blue-700 bg-blue-100/70 border-r border-slate-200 cursor-pointer select-none">${symbol}</td>`;
                            }
                        } else {
                            const calendarLabel = dateInfo.isNationalHoliday
                                ? `Tanggal Merah - ${dateInfo.holidayName}`
                                : dateInfo.isSunday
                                    ? 'Minggu'
                                    : dateInfo.isSaturday
                                        ? 'Sabtu'
                                        : 'Masuk Kerja';
                            const titleTooltip = `${empNama} - ${d} ${namaBulanIndo} ${year}: ${calendarLabel}`;
                            const cellClass = dateInfo.isNationalHoliday
                                ? 'bg-red-50 text-red-300'
                                : dateInfo.isSunday
                                    ? 'bg-red-50 text-red-300'
                                    : dateInfo.isSaturday
                                        ? 'bg-amber-50 text-amber-300'
                                        : 'text-slate-300';
                            tbodyHTML += `<td title="${titleTooltip}" class="p-1 text-center border-r border-slate-100 ${cellClass}"></td>`;
                        }
                    }

                    tbodyHTML += `</tr>`;
                });

                tbody.innerHTML = tbodyHTML;

                // Sync status Our Team
                if (typeof updateTeamScheduleStatus === 'function') updateTeamScheduleStatus(employeeDatesMap, year, month);
                if (typeof renderOurTeamSection === 'function') renderOurTeamSection();
                if (typeof updateTeamActiveCounter === 'function') updateTeamActiveCounter();

            } catch (err) {
                console.error("Gagal memuat matriks rekap:", err);
                tbody.innerHTML = `<tr><td colspan="${daysInMonth + 1}" class="text-center p-6 text-red-500 font-medium">Gagal memuat data matriks. Pastikan koneksi terhubung.</td></tr>`;
            }
        }

        async function loadInitialData() {
            const selectNama = document.getElementById("select-nama");
            const selectNamaOff = document.getElementById("select-nama-off");

            try {
                const response = await fetch(GAS_WEB_APP_URL + "?action=getInitialData");
                const res = await response.json();

                if (res.success && res.employees && res.employees.length > 0) {
                    employeeList = res.employees;

                    let optionsAbsen = '<option value="">-- Pilih Nama Karyawan --</option>';
                    let optionsOff = '<option value="">-- Pilih Nama Karyawan --</option>';

                    employeeList.forEach(emp => {
                        const namaClean = emp.nama ? emp.nama.toString().trim() : '';
                        const nikClean = emp.nik ? emp.nik.toString().trim() : '';
                        const jabatanClean = emp.jabatan ? emp.jabatan.toString().trim() : 'STAFF';

                        if (namaClean) {
                            optionsAbsen += `<option value="${namaClean}" data-nik="${nikClean}" data-jabatan="${jabatanClean}">${namaClean} (${nikClean})</option>`;
                            optionsOff += `<option value="${namaClean}">${namaClean}</option>`;
                        }
                    });

                    if (selectNama) selectNama.innerHTML = optionsAbsen;
                    if (selectNamaOff) selectNamaOff.innerHTML = optionsOff;

                    // Render awal. Status akan disinkronkan lagi setelah Matriks selesai dimuat.
                    renderOurTeamSection();
                } else {
                    if (selectNama) selectNama.innerHTML = '<option value="">⚠️ Data Karyawan Kosong!</option>';
                    if (selectNamaOff) selectNamaOff.innerHTML = '<option value="">⚠️ Data Karyawan Kosong!</option>';
                    renderOurTeamSection();
                }
            } catch (err) {
                console.error("Gagal memuat data dari Apps Script:", err);
                renderOurTeamSection();
            }
        }

        async function loadDisabledDates() {
            try {
                const response = await fetch(GAS_WEB_APP_URL + "?action=getDisabledDates");
                const res = await response.json();
                if (res.success && res.disabledDates) {
                    disabledDates = res.disabledDates;
                }
            } catch (err) {
                console.error("Gagal memuat tanggal terblokir:", err);
            }
        }

