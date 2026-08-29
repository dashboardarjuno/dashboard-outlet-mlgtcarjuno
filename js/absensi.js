// ==========================================================
// ABSENSI.JS — Kamera, lokasi GPS, dan proses absensi harian
// ==========================================================

        async function startCamera() {
            const container = document.getElementById("camera-container");
            const btnOpen = document.getElementById("btn-open-camera");
            const video = document.getElementById("webcam-video");

            try {
                if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                    throw new Error('Kamera tidak didukung browser ini.');
                }

                mediaStream = await navigator.mediaDevices.getUserMedia({
                    video: {
                        facingMode: "user",
                        width: {ideal: 640},
                        height: {ideal: 480}
                    },
                    audio: false
                });
                video.srcObject = mediaStream;
                container.classList.remove("hidden");
                btnOpen.classList.add("hidden");
            } catch (err) {
                showPopup('warning', 'Akses Kamera Ditolak / Ditiadakan', 'Kamera tidak dapat dibuka. Buka Setelan Situs di browser untuk mengizinkan kamera, atau lanjutkan absensi tanpa foto.');
            }
        }

        function stopCamera() {
            if (mediaStream) {
                mediaStream.getTracks().forEach(track => track.stop());
                mediaStream = null;
            }
            const container = document.getElementById("camera-container");
            const btnOpen = document.getElementById("btn-open-camera");
            if (container) container.classList.add("hidden");
            if (btnOpen) btnOpen.classList.remove("hidden");
            resetSnapshot();
        }

        function takeSnapshot() {
            const video = document.getElementById("webcam-video");
            const canvas = document.getElementById("photo-canvas");
            const ctx = canvas.getContext("2d");

            canvas.width = video.videoWidth || 320;
            canvas.height = video.videoHeight || 240;

            ctx.translate(canvas.width, 0);
            ctx.scale(-1, 1);
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

            photoBase64 = canvas.toDataURL("image/jpeg", 0.7);

            video.classList.add("hidden");
            canvas.classList.remove("hidden");

            document.getElementById("btn-take-photo").classList.add("hidden");
            document.getElementById("btn-retake-photo").classList.remove("hidden");
        }

        function resetSnapshot() {
            photoBase64 = null;
            const video = document.getElementById("webcam-video");
            const canvas = document.getElementById("photo-canvas");

            if (canvas && video) {
                canvas.classList.add("hidden");
                video.classList.remove("hidden");
            }

            const btnTake = document.getElementById("btn-take-photo");
            const btnRetake = document.getElementById("btn-retake-photo");
            if (btnTake) btnTake.classList.remove("hidden");
            if (btnRetake) btnRetake.classList.add("hidden");
        }

        async function loadTodayAttendance() {
            try {
                const response = await fetch(GAS_WEB_APP_URL + "?action=getTodayAttendance");
                const res = await response.json();
                if (res.success && res.data) {
                    todayAttendanceRecords = res.data;
                }
            } catch (err) {
                console.error("Gagal memuat rekap absensi harian:", err);
            }
        }

        async function openAbsensiModal() {
            openModal('modal-absensi');
            getGPSLocation();
            if (employeeList.length === 0) await loadInitialData();
            await loadTodayAttendance();
        }

        function verifyNIK() {
            // 1. Ambil elemen terlebih dahulu
            const nikVal = document.getElementById('input-nik').value.trim().toUpperCase();
            const namaInput = document.getElementById('input-nama');
            const jabatanInput = document.getElementById('input-jabatan');

            // 2. CEK KEAMANAN ELEMEN (Tambahan Baru)
            if (!namaInput || !jabatanInput) {
                console.error("Elemen form input tidak ditemukan!");
                return;
            }

            // 3. CEK KEAMANAN DATA (Tambahan Baru)
            if (!employeeList || !Array.isArray(employeeList)) {
                Swal.fire({
                    icon: 'error',
                    title: 'Data Belum Siap',
                    text: 'Data karyawan sedang dimuat, mohon tunggu sebentar...'
                });
                return;
            }

            // 4. Lanjut ke kode lama Anda...
            if (!nikVal) {
                Swal.fire({
                    icon: 'warning',
                    title: 'Perhatian',
                    text: 'Silahkan masukkan NIK karyawan terlebih dahulu!',
                    confirmButtonColor: '#e11d48'
                });
                return;
            }

            if (!employeeList || employeeList.length === 0) {
                alert("Data karyawan belum dimuat. Mohon tunggu sebentar atau refresh halaman.");
                return;
            }

            // Cari karyawan berdasarkan NIK
            const found = employeeList.find(e => {
                const eNik = (e.nik || e.NIK || '').toString().trim().toUpperCase();
                return eNik === nikVal;
            });

            if (found) {
                namaInput.value = found.nama || found.Nama || '';
                jabatanInput.value = found.jabatan || found.Jabatan || '';
            } else {
                namaInput.value = "";
                jabatanInput.value = "";
                alert("NIK tidak ditemukan di database! Pastikan NIK sudah terdaftar di sheet DATA KARYAWAN.");
            }
        }

        function getGPSLocation() {
            const box = document.getElementById("gps-status-box");
            const title = document.getElementById("gps-status-title");
            const desc = document.getElementById("gps-status-desc");
            const btnSubmit = document.getElementById("btn-submit-absen");

            if (title && desc && box) {
                title.textContent = "Mencari Lokasi GPS...";
                desc.textContent = "Mohon tunggu sebentar sedang mengunci posisi...";
                box.className = "p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 flex items-center justify-between";
            }

            if (btnSubmit) {
                btnSubmit.disabled = true;
                btnSubmit.className = "w-full bg-slate-400 cursor-not-allowed text-white font-bold p-3 rounded-xl transition mt-2 flex items-center justify-center gap-2";
            }

            if (window.location.protocol === 'file:') {
                currentGPS.valid = false;
                title.textContent = "Mode File Lokal Terdeteksi";
                desc.textContent = "GPS tidak dapat berjalan jika file dibuka langsung (file://). Gunakan Live Server atau buka via HTTPS.";
                box.className = "p-3 bg-red-50 border border-red-200 rounded-xl text-red-800 flex items-center justify-between";
                return;
            }

            if (!navigator.geolocation) {
                currentGPS.valid = false;
                title.textContent = "GPS Tidak Didukung";
                desc.textContent = "Browser Anda tidak mendukung fitur Geolocation.";
                box.className = "p-3 bg-red-50 border border-red-200 rounded-xl text-red-800 flex items-center justify-between";
                return;
            }

            const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

            navigator.geolocation.getCurrentPosition(
                (pos) => {
                    const lat = pos.coords.latitude;
                    const lng = pos.coords.longitude;

                    const distance = calculateDistanceMeter(lat, lng, OUTLET_LOCATION.lat, OUTLET_LOCATION.lng);

                    currentGPS = {
                        valid: true,
                        lat: lat,
                        lng: lng,
                        distance: Math.round(distance)
                    };

                    if (distance <= OUTLET_LOCATION.maxRadiusMeter) {
                        title.textContent = "Lokasi Valid (Sesuai Radius)";
                        desc.textContent = `Jarak Anda: ${Math.round(distance)} meter dari Outlet.`;
                        box.className = "p-3 bg-green-50 border border-green-200 rounded-xl text-green-800 flex items-center justify-between";

                        if (btnSubmit) {
                            btnSubmit.disabled = false;
                            btnSubmit.className = "w-full bg-brand-red hover:bg-brand-darkred cursor-pointer text-white font-bold p-3 rounded-xl transition mt-2 shadow-lg flex items-center justify-center gap-2";
                        }
                    } else {
                        title.textContent = "Di Luar Radius Outlet!";
                        desc.textContent = `Jarak Anda: ${Math.round(distance)} meter. Maksimal ${OUTLET_LOCATION.maxRadiusMeter}m.`;
                        box.className = "p-3 bg-yellow-50 border border-yellow-200 rounded-xl text-yellow-800 flex items-center justify-between";

                        if (btnSubmit) {
                            btnSubmit.disabled = true;
                            btnSubmit.className = "w-full bg-slate-400 cursor-not-allowed text-white font-bold p-3 rounded-xl transition mt-2 flex items-center justify-center gap-2";
                        }
                    }
                },
                (err) => {
                    currentGPS.valid = false;
                    title.textContent = "Gagal Mengambil Lokasi GPS";
                    desc.textContent = isMobile
                        ? "Pastikan GPS HP aktif & izin lokasi diberikan!"
                        : "Akses lokasi di Laptop lambat/terblokir. Cek izin lokasi browser atau gunakan HP.";
                    box.className = "p-3 bg-red-50 border border-red-200 rounded-xl text-red-800 flex items-center justify-between";

                    if (btnSubmit) {
                        btnSubmit.disabled = true;
                        btnSubmit.className = "w-full bg-slate-400 cursor-not-allowed text-white font-bold p-3 rounded-xl transition mt-2 flex items-center justify-center gap-2";
                    }

                    if (err.code === err.PERMISSION_DENIED) {
                        showPopup('warning', 'Izin Lokasi Ditolak', 'Izin lokasi di-block oleh browser. Klik icon gembok di sebelah URL browser untuk Mengizinkan Lokasi.');
                    }
                },
                {
                    enableHighAccuracy: isMobile,
                    timeout: isMobile ? 6000 : 3000,
                    maximumAge: 10000
                }
            );
        }

        async function submitAbsensi(e) {
            e.preventDefault();

            const elNik = document.getElementById("input-nik");
            const elNama = document.getElementById("input-nama");
            const elJabatan = document.getElementById("input-jabatan");

            // Validasi pencegahan jika elemen tidak ditemukan di DOM
            if (!elNik || !elNama || !elJabatan) {
                showPopup('warning', 'Kesalahan Sistem', 'Form absensi tidak lengkap. Silakan refresh halaman.');
                return;
            }

            const nik = elNik.value.trim().toUpperCase();
            const nama = elNama.value.trim();
            const jabatan = elJabatan.value.trim();

            const tipeChecked = document.querySelector('input[name="tipe_absen"]:checked');
            const tipe = tipeChecked ? tipeChecked.value : null;

            if (!nik || !nama || !jabatan) {
                showPopup('warning', 'Data Belum Lengkap', 'Harap masukkan NIK dan lakukan Cek NIK terlebih dahulu!');
                return;
            }

            if (!tipe) {
                showPopup('warning', 'Pilih Tipe Absen', 'Harap pilih salah satu Tipe Absen (Masuk/Istirahat/Pulang)!');
                return;
            }

            const chkSeragam = document.getElementById("chk-seragam").checked;
            const chkNameTag = document.getElementById("chk-nametag").checked;
            const chkAtribut = document.getElementById("chk-atribut").checked;
            const chkRapi = document.getElementById("chk-rapi").checked;

            if (!chkSeragam || !chkNameTag || !chkAtribut || !chkRapi) {
                showPopup(
                    'warning',
                    'Kelengkapan Belum Centang!',
                    'Harap centang semua checklist kelengkapan kerja sebelum kirim absensi.'
                );
                return;
            }

            if (!currentGPS.valid) {
                showPopup('warning', 'GPS Belum Terkunci', 'Lokasi GPS belum terdeteksi. Aktifkan izin GPS HP atau tekan tombol Refresh GPS!');
                return;
            }

            if (currentGPS.distance > OUTLET_LOCATION.maxRadiusMeter) {
                showPopup('error', 'Di Luar Radius Outlet!', `Jarak Anda ${currentGPS.distance} meter dari Outlet. Maksimal radius absensi adalah ${OUTLET_LOCATION.maxRadiusMeter} meter.`);
                return;
            }

            const btnSubmit = document.getElementById("btn-submit-absen");
            btnSubmit.disabled = true;
            btnSubmit.innerHTML = `<i class="fa-solid fa-spinner animate-spin"></i> Menyimpan...`;

            const payload = {
                action: "submitAbsen",
                nik: nik,
                nama: nama,
                jabatan: jabatan,
                tipe: tipe,
                chkSeragam: chkSeragam,
                chkNameTag: chkNameTag,
                chkAtribut: chkAtribut,
                chkRapi: chkRapi,
                lat: currentGPS.lat,
                lng: currentGPS.lng,
                fotoSelfie: photoBase64
            };

            try {
                const response = await fetch(GAS_WEB_APP_URL, {
                    method: "POST",
                    headers: {"Content-Type": "text/plain;charset=utf-8"},
                    body: JSON.stringify(payload)
                });

                const result = await response.json();

                if (result.success) {
                    showPopup('success', 'Absensi Berhasil!', result.message, async function () {
                        if (typeof stopCamera === 'function') stopCamera();
                        closeModal("modal-absensi");
                        document.getElementById("form-absensi").reset();
                        photoBase64 = null;
                        if (typeof loadTodayAttendance === 'function') await loadTodayAttendance();
                    });
                } else {
                    showPopup('error', 'Absensi Gagal', result.message);
                }
            } catch (err) {
                showPopup('error', 'Kesalahan Sistem', 'Terjadi kesalahan koneksi: ' + err.toString());
            } finally {
                btnSubmit.disabled = false;
                btnSubmit.innerHTML = `<span>Kirim Absensi Sekarang</span>`;
            }
        }

