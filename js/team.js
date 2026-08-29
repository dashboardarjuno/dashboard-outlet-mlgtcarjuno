// ==========================================================
// TEAM.JS — Data tim, status jadwal, foto, dan CRUD anggota tim
// ==========================================================

        function normalizeMatrixDate(value) {
            if (value === null || value === undefined || value === '') return '';

            const raw = String(value).trim();

            // Fix Regex: Gunakan Single Backslash (\d)
            const isoMatch = raw.match(/^(\d{4}-\d{2}-\d{2})/);
            if (isoMatch) return isoMatch[1];

            const dmyMatch = raw.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
            if (dmyMatch) {
                return `${dmyMatch[3]}-${String(dmyMatch[2]).padStart(2, '0')}-${String(dmyMatch[1]).padStart(2, '0')}`;
            }

            return raw.substring(0, 10);
        }

        function getEmployeeScheduleKey(emp) {
            const nikKey = (emp.nik || '').toString().trim().toUpperCase();
            if (nikKey) return `NIK:${nikKey}`;
            const namaKey = (emp.nama || '').toString().trim().toUpperCase();
            return namaKey ? `NAME:${namaKey}` : '';
        }

        function updateTeamScheduleStatus(employeeDatesMap, year, month) {
            teamScheduleStatus = {};

            const today = new Date();
            const todayYear = today.getFullYear();
            const todayMonth = today.getMonth() + 1;
            const todayDay = today.getDate();
            const todayKey = `${todayYear}-${String(todayMonth).padStart(2, '0')}-${String(todayDay).padStart(2, '0')}`;

            // Status Our Team SELALU dihitung dari jadwal hari ini,
            // tidak peduli filter matriks sedang menampilkan bulan apa.
            employeeList.forEach(emp => {
                const scheduleKey = getEmployeeScheduleKey(emp);
                if (!scheduleKey) return;

                const namaKey = (emp.nama || '').toString().trim().toUpperCase();
                const entries = (employeeDatesMap[scheduleKey] || employeeDatesMap[`NAME:${namaKey}`] || []).slice().sort((a, b) => {
                    return normalizeMatrixDate(a.tgl).localeCompare(normalizeMatrixDate(b.tgl));
                });

                // Urutan 1-4 = OFF, urutan 5-6 = CUTI, sesuai Matriks.
                const todayEntryIndex = entries.findIndex(entry => normalizeMatrixDate(entry.tgl) === todayKey);

                if (todayEntryIndex >= 0) {
                    const hariLiburKe = todayEntryIndex + 1;
                    teamScheduleStatus[scheduleKey] = {
                        status: hariLiburKe >= 5 ? 'CUTI' : 'OFF',
                        index: hariLiburKe
                    };
                } else {
                    teamScheduleStatus[scheduleKey] = {
                        status: 'AKTIF',
                        index: 0
                    };
                }
            });

            teamScheduleStatusReady = true;
        }

        function getTeamScheduleStatus(emp) {
            const scheduleKey = getEmployeeScheduleKey(emp);

            if (!teamScheduleStatusReady) {
                return {
                    status: 'MEMUAT',
                    index: 0,
                    className: 'bg-slate-50 text-slate-500 border-slate-200',
                    dotClass: 'bg-slate-400'
                };
            }

            // Fixed: Menggunakan scheduleKey (bukan namaKey)
            const data = teamScheduleStatus[scheduleKey] || {status: 'AKTIF', index: 0};

            if (data.status === 'OFF' || data.status === 'CUTI') {
                return {
                    status: data.status,
                    index: data.index,
                    className: 'team-status-red',
                    dotClass: 'team-status-dot-red'
                };
            }

            return {
                status: 'AKTIF',
                index: 0,
                className: 'team-status-green',
                dotClass: 'team-status-dot-green'
            };
        }

        function isDiperbantukanEmployee(emp) {
            const statusFields = [
                emp.status,
                emp.statusKaryawan,
                emp.status_karyawan,
                emp.keteranganStatus,
                emp.penempatanStatus
            ];

            return statusFields.some(value =>
                String(value || '').trim().toUpperCase().includes('DIPERBANTUKAN')
            );
        }

        function getActiveTeamCount() {
            if (!employeeList || employeeList.length === 0) return 0;

            return employeeList.filter(emp => {
                // Karyawan diperbantukan tidak masuk hitungan aktif.
                if (isDiperbantukanEmployee(emp)) return false;

                // Jika Matriks belum selesai dimuat, jangan mengarang angka.
                if (!teamScheduleStatusReady) return false;

                const scheduleKey = getEmployeeScheduleKey(emp);
                const schedule = teamScheduleStatus[scheduleKey];

                // Hanya yang benar-benar AKTIF hari ini yang dihitung.
                return !schedule || schedule.status === 'AKTIF';
            }).length;
        }

        function updateTeamActiveCounter() {
            const badge = document.getElementById('team-counter-badge');
            if (!badge) return;

            if (!employeeList || employeeList.length === 0) {
                badge.innerHTML = `<i class="fa-solid fa-users text-orange-500 mr-1"></i> 0 Karyawan`;
                return;
            }

            if (!teamScheduleStatusReady) {
                badge.innerHTML = `<i class="fa-solid fa-users text-orange-500 mr-1"></i> Menghitung...`;
                return;
            }

            const activeCount = getActiveTeamCount();
            badge.innerHTML = `<i class="fa-solid fa-users text-orange-500 mr-1"></i> ${activeCount} Tim Aktif`;
        }

        function renderOurTeamSection() {
            const container = document.getElementById('our-team-container');
            const badge = document.getElementById('team-counter-badge');
            if (!container) return;

            if (!employeeList || employeeList.length === 0) {
                container.innerHTML = `
                    <div class="text-center py-6 text-slate-400">
                        <i class="fa-solid fa-triangle-exclamation text-xl mb-1 text-amber-500"></i>
                        <p class="text-xs">Data tim belum tersedia atau gagal dimuat dari server.</p>
                    </div>`;
                if (badge) badge.innerHTML = `<i class="fa-solid fa-users text-orange-500 mr-1"></i> 0 Karyawan`;
                return;
            }

            if (badge) {
                // Jangan lagi memakai employeeList.length sebagai jumlah "Tim Aktif".
                // Counter diperbarui dari status Matriks OFF/CUTI hari ini.
                updateTeamActiveCounter();
            }

            // Grouping Berdasarkan Jabatan / Role
            const roleGroups = {
                'MO': {title: 'Manager Outlet (MO)', colorBg: 'from-red-50 to-white', border: 'border-red-500/30 hover:border-brand-red', tagBg: 'bg-brand-red', dot: 'bg-brand-red', avatarBg: 'ED1C24'},
                'WMO': {title: 'Wakil Manager Outlet (WMO)', colorBg: 'from-slate-100 to-white', border: 'border-slate-300 hover:border-slate-800', tagBg: 'bg-slate-800', dot: 'bg-slate-800', avatarBg: '1E293B'},
                'KASIR': {title: 'Tim Kasir', colorBg: 'from-blue-50 to-white', border: 'border-blue-200 hover:border-blue-600', tagBg: 'bg-blue-600', dot: 'bg-blue-600', avatarBg: '2563EB'},
                'STAFF': {title: 'Staff Operasional', colorBg: 'from-emerald-50 to-white', border: 'border-emerald-200 hover:border-emerald-600', tagBg: 'bg-emerald-600', dot: 'bg-emerald-600', avatarBg: '059669'}
            };

            const categorized = {'MO': [], 'WMO': [], 'KASIR': [], 'STAFF': []};

            employeeList.forEach((emp, index) => {
                let roleUpper = (emp.jabatan || 'STAFF').toString().trim().toUpperCase();
                let categoryKey = 'STAFF';

                if (roleUpper.includes('MO') && !roleUpper.includes('WMO')) categoryKey = 'MO';
                else if (roleUpper.includes('WMO')) categoryKey = 'WMO';
                else if (roleUpper.includes('KASIR')) categoryKey = 'KASIR';
                else categoryKey = 'STAFF';

                categorized[categoryKey].push({...emp, index});
            });

            let html = '';

            Object.keys(roleGroups).forEach(groupKey => {
                const groupConfig = roleGroups[groupKey];
                const members = categorized[groupKey];

                if (members && members.length > 0) {
                    html += `
                        <div class="space-y-3 w-full flex flex-col items-center">
                            <div class="flex items-center justify-center gap-2 text-center">
                                <span class="w-2.5 h-2.5 rounded-full ${groupConfig.dot}"></span>
                                <h4 class="font-heading font-bold text-xs text-slate-500 uppercase tracking-wider">${groupConfig.title}</h4>
                            </div>
                            
                            <!-- FLEX & GRID RESPONSIVE TERPUSAT -->
                            <div class="flex flex-wrap justify-center gap-3 sm:gap-4 w-full">
                    `;

                    members.forEach(m => {
                        const customPhoto = customPhotoStore[m.nik] || m.photoUrl;
                        const avatarSrc = customPhoto || `https://ui-avatars.com/api/?name=${encodeURIComponent(m.nama)}&background=${groupConfig.avatarBg}&color=fff&size=128`;
                        const sanitizedNama = m.nama.replace(/'/g, "\\'");
                        const teamStatus = getTeamScheduleStatus(m);
                        const statusLabel = teamStatus.status === 'OFF'
                            ? `OFF${teamStatus.index ? ` (Hari ke-${teamStatus.index})` : ''}`
                            : teamStatus.status === 'CUTI'
                                ? `CUTI${teamStatus.index ? ` (Hari ke-${teamStatus.index})` : ''}`
                                : teamStatus.status === 'MEMUAT'
                                    ? 'Memuat...'
                                    : 'Aktif';

                        html += `
                            <div class="bg-gradient-to-b ${groupConfig.colorBg} border-2 ${groupConfig.border} rounded-2xl p-2.5 sm:p-4 shadow-sm hover:shadow-md transition relative group text-center flex flex-col items-center w-[145px] sm:w-[190px] shrink-0">
                                <span class="absolute top-2 right-2 sm:top-3 sm:right-3 ${groupConfig.tagBg} text-white text-[9px] sm:text-[10px] font-bold px-1.5 sm:px-2 py-0.5 rounded-full uppercase">${m.jabatan || groupKey}</span>
                                
                                <div class="relative w-14 h-14 sm:w-20 sm:h-20 mb-2 sm:mb-3 mt-1 sm:mt-0">
                                    <img id="team-img-${m.index}" src="${avatarSrc}" alt="${m.nama}" class="w-full h-full rounded-full object-cover border-2 sm:border-4 border-white shadow-md">
                                    <button type="button" onclick="editTeamMember(${m.index}, '${sanitizedNama}', '${m.jabatan || groupKey}', '${m.nik}')" class="absolute bottom-0 right-0 bg-slate-900 text-white w-6 h-6 sm:w-7 sm:h-7 rounded-full flex items-center justify-center text-[10px] sm:text-xs opacity-0 group-hover:opacity-100 transition shadow cursor-pointer" title="Edit Foto Profil">
                                        <i class="fa-solid fa-camera"></i>
                                    </button>
                                </div>
                                
                                <h5 id="team-nama-${m.index}" class="font-heading font-bold text-xs sm:text-sm text-slate-900 line-clamp-1 w-full px-1">${m.nama}</h5>
                                
                                <!-- STATUS OTOMATIS DARI MATRIKS JADWAL OFF & CUTI -->
                                <div class="mt-1 mb-1">
                                    <span class="inline-flex items-center gap-1.5 text-[9px] sm:text-[10px] font-semibold px-2 py-0.5 rounded-full border ${teamStatus.className}">
                                        <span class="${teamStatus.dotClass}"></span>
                                        ${statusLabel}
                                    </span>
                                </div>

                                <p id="team-nik-${m.index}" class="text-[10px] sm:text-[11px] text-slate-500 font-medium truncate w-full">NIK: ${m.nik}</p>
                                
                                <button type="button" onclick="editTeamMember(${m.index}, '${sanitizedNama}', '${m.jabatan || groupKey}', '${m.nik}')" class="mt-2 sm:mt-3 text-[10px] sm:text-xs bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-lg px-2 sm:px-3 py-1 font-semibold transition w-full cursor-pointer flex items-center justify-center gap-1 shadow-xs">
                                    <i class="fa-solid fa-camera text-orange-500 text-[10px] sm:text-xs"></i> Edit Foto
                                </button>
                            </div>
                        `;
                    });

                    html += `
                            </div>
                        </div>
                    `;
                }
            });

            container.innerHTML = html;
        }

        function editTeamMember(index, currentName, role, currentNik) {
            tempEditPhotoBase64 = null;
            document.getElementById('edit-team-index').value = index;
            document.getElementById('edit-team-name').value = currentName;
            document.getElementById('edit-team-nik').value = currentNik;
            document.getElementById('edit-team-role').value = role;

            // Reset Input File & URL
            document.getElementById('edit-team-file').value = '';

            const existingPhoto = customPhotoStore[currentNik] || '';
            const urlInput = document.getElementById('edit-team-photo');

            // Jika foto existing berupa URL (bukan Base64), tampilkan di input URL
            if (existingPhoto && !existingPhoto.startsWith('data:image')) {
                urlInput.value = existingPhoto;
            } else {
                urlInput.value = '';
            }

            // Tampilkan Preview Foto
            const previewImg = document.getElementById('edit-team-preview');
            const fallbackAvatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(currentName)}&background=1E293B&color=fff&size=128`;
            previewImg.src = existingPhoto || fallbackAvatar;

            openModal('modal-edit-team');
        }

        function compressImageToBase64(file, maxWidth, maxHeight) {
            return new Promise((resolve, reject) => {
                if (!file || !file.type.startsWith('image/')) {
                    reject(new Error('File harus berupa gambar.'));
                    return;
                }

                const reader = new FileReader();

                reader.onerror = () => reject(new Error('Gagal membaca file foto.'));

                reader.onload = function (evt) {
                    const img = new Image();

                    img.onerror = () => reject(new Error('Gagal membaca gambar.'));

                    img.onload = function () {
                        let width = img.width;
                        let height = img.height;

                        const ratio = Math.min(1, maxWidth / width, maxHeight / height);
                        width = Math.max(1, Math.round(width * ratio));
                        height = Math.max(1, Math.round(height * ratio));

                        const canvas = document.createElement('canvas');
                        canvas.width = width;
                        canvas.height = height;

                        const ctx = canvas.getContext('2d', {alpha: false});
                        ctx.drawImage(img, 0, 0, width, height);

                        const qualities = [0.82, 0.74, 0.66, 0.58, 0.50];
                        const maxOutputBytes = 650 * 1024;

                        let result = '';

                        for (let i = 0; i < qualities.length; i++) {
                            result = canvas.toDataURL('image/jpeg', qualities[i]);

                            const base64Part = result.split(',')[1] || '';
                            const estimatedBytes = Math.floor(base64Part.length * 3 / 4);

                            if (estimatedBytes <= maxOutputBytes) {
                                break;
                            }
                        }

                        resolve(result);
                    };

                    img.src = evt.target.result;
                };

                reader.readAsDataURL(file);
            });
        }

        function handleFileOrUrlChange(e) {
            const previewImg = document.getElementById('edit-team-preview');
            const name = document.getElementById('edit-team-name').value;
            const fallbackAvatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=1E293B&color=fff&size=128`;

            if (e.target.id === 'edit-team-file') {
                const file = e.target.files[0];
                if (file) {
                    document.getElementById('edit-team-photo').value = '';

                    compressImageToBase64(file, 800, 800).then(function (compressed) {
                        tempEditPhotoBase64 = compressed;
                        previewImg.src = tempEditPhotoBase64;

                        const base64Part = compressed.split(',')[1] || '';
                        const estimatedKB = Math.round((base64Part.length * 3 / 4) / 1024);
                        console.log('Foto Team setelah kompresi:', estimatedKB + ' KB');
                    }).catch(function (err) {
                        tempEditPhotoBase64 = null;
                        console.error('Gagal memproses foto:', err);
                        showPopup('error', 'Foto Tidak Bisa Diproses', 'Silakan pilih foto lain.');
                    });
                } else {
                    tempEditPhotoBase64 = null;
                    previewImg.src = fallbackAvatar;
                }
            } else if (e.target.id === 'edit-team-photo') {
                const urlVal = e.target.value.trim();
                if (urlVal) {
                    document.getElementById('edit-team-file').value = '';
                    tempEditPhotoBase64 = null;
                    previewImg.src = urlVal;
                } else {
                    previewImg.src = fallbackAvatar;
                }
            }
        }

        async function deleteCurrentTeamPhoto() {
            const name = document.getElementById('edit-team-name').value.trim();
            const nik = document.getElementById('edit-team-nik').value.trim().toUpperCase();

            if (!nik) {
                showPopup('warning', 'NIK Tidak Ditemukan', 'Data karyawan tidak lengkap.');
                return;
            }

            const confirmResult = await Swal.fire({
                icon: 'warning',
                title: 'Hapus Foto?',
                html: `Foto profil <b>${name || nik}</b> akan dihapus dari Google Drive dan Google Sheet.`,
                showCancelButton: true,
                confirmButtonText: 'Ya, Hapus',
                cancelButtonText: 'Batal',
                reverseButtons: true,
                confirmButtonColor: '#dc2626'
            });

            if (!confirmResult.isConfirmed) return;

            const deleteBtn = document.querySelector('#form-edit-team button[onclick="deleteCurrentTeamPhoto()"]');
            const saveBtn = document.querySelector('#form-edit-team button[type="submit"]');

            try {
                if (deleteBtn) {
                    deleteBtn.disabled = true;
                    deleteBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Menghapus...';
                }

                if (saveBtn) saveBtn.disabled = true;

                const response = await fetch(GAS_WEB_APP_URL, {
                    method: 'POST',
                    headers: {'Content-Type': 'text/plain;charset=utf-8'},
                    body: JSON.stringify({
                        action: 'deleteTeamPhoto',
                        nik: nik
                    })
                });

                const result = await response.json();

                if (!result || !result.success) {
                    throw new Error(
                        result && result.message
                            ? result.message
                            : 'Gagal menghapus foto team.'
                    );
                }

                delete customPhotoStore[nik];

                closeModal('modal-edit-team');
                renderOurTeamSection();

                showPopup(
                    'success',
                    'Foto Berhasil Dihapus',
                    result.message || `Foto profil ${name || nik} sudah dihapus.`
                );

            } catch (err) {
                console.error('Gagal menghapus foto team:', err);

                showPopup(
                    'error',
                    'Gagal Menghapus Foto',
                    err.message || err.toString()
                );

            } finally {
                // Reset variabel temporary Base64 setelah hapus berhasil
                tempEditPhotoBase64 = '';

                if (deleteBtn) {
                    deleteBtn.disabled = false;
                    deleteBtn.innerHTML = '<i class="fa-solid fa-trash"></i> Hapus Foto';
                }

                if (saveBtn) saveBtn.disabled = false;
            }
        }

        async function saveTeamMember(e) {
            e.preventDefault();

            const name = document.getElementById('edit-team-name').value.trim();
            const nik = document.getElementById('edit-team-nik').value.trim().toUpperCase();
            const photoUrl = document.getElementById('edit-team-photo').value.trim();
            const btn = document.querySelector('#form-edit-team button[type="submit"]');

            if (!nik || !name) {
                showPopup('warning', 'Data Tidak Lengkap', 'NIK dan nama karyawan tidak boleh kosong.');
                return;
            }

            const payload = {
                action: 'saveTeamPhoto',
                nik: nik,
                nama: name,
                photoBase64: tempEditPhotoBase64 || '',
                photoUrl: photoUrl || ''
            };

            try {
                if (btn) {
                    btn.disabled = true;
                    btn.innerHTML = '<i class="fa-solid fa-spinner animate-spin"></i> Menyimpan ke Server...';
                }

                const response = await fetch(GAS_WEB_APP_URL, {
                    method: 'POST',
                    headers: {'Content-Type': 'text/plain;charset=utf-8'},
                    body: JSON.stringify(payload)
                });

                const result = await response.json();

                if (!result.success) {
                    throw new Error(result.message || 'Gagal menyimpan foto tim.');
                }

                if (result.photoUrl) {
                    customPhotoStore[nik] = result.photoUrl;
                } else {
                    delete customPhotoStore[nik];
                }

                closeModal('modal-edit-team');
                renderOurTeamSection();
                showPopup('success', 'Foto Berhasil Disimpan!', result.message || `Foto profil ${name} tersimpan di Google Drive dan dapat dilihat semua perangkat.`);
            } catch (err) {
                console.error('Gagal menyimpan foto tim:', err);
                showPopup('error', 'Gagal Menyimpan Foto', err.message || err.toString());
            } finally {
                // Reset variabel temporary Base64 setelah selesai
                tempEditPhotoBase64 = '';

                if (btn) {
                    btn.disabled = false;
                    btn.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Simpan Foto';
                }
            }
        }

        async function loadTeamPhotos() {
            try {
                const response = await fetch(GAS_WEB_APP_URL + "?action=getTeamPhotos");
                const result = await response.json();
                if (result && result.success && result.photos) {
                    customPhotoStore = {};
                    Object.keys(result.photos).forEach(function (nik) {
                        const cleanNik = nik.toString().trim().toUpperCase();
                        const url = result.photos[nik];
                        if (cleanNik && url) customPhotoStore[cleanNik] = url;
                    });
                    console.log("Foto Team dimuat:", Object.keys(customPhotoStore).length);
                } else {
                    customPhotoStore = {};
                }
            } catch (err) {
                console.error('Gagal memuat foto tim dari server:', err);
                customPhotoStore = {};
            }
        }

