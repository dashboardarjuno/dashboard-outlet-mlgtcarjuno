// ==========================================================
// BANNER.JS — Info banner atas & pengaturan role Manager/MO
// ==========================================================

let currentActiveInfo = {title: "", content: ""};

        async function fetchBannerInfo() {
            try {
                const res = await fetch(`${GAS_WEB_APP_URL}?action=getBannerInfo`);
                const data = await res.json();

                const marqueeEl = document.getElementById('bannerMarquee');
                if (data.status === "success" && marqueeEl) {
                    currentActiveInfo = data;
                    marqueeEl.innerHTML = `&#128226; <strong>${escapeHtml(data.title)}</strong>: ${escapeHtml(data.content)}`;
                } else if (marqueeEl) {
                    marqueeEl.innerText = "📢 Belum ada pengumuman terbaru saat ini.";
                    currentActiveInfo = {title: "Pengumuman", content: "Belum ada informasi terbaru saat ini."};
                }
            } catch (err) {
                console.error("Gagal memuat banner info:", err);
            }
        }

        function openInfoModal() {
            if (!currentActiveInfo.title) return;
            Swal.fire({
                title: currentActiveInfo.title,
                text: currentActiveInfo.content,
                icon: 'info',
                confirmButtonText: 'Tutup',
                confirmButtonColor: '#0F172A'
            });
        }

        function checkUserRoleForBanner(userRole) {
            const allowedRoles = ["MO", "MANAGER", "MANAGER OUTLET"];
            const btnEdit = document.getElementById('btnEditBanner');
            if (btnEdit) {
                if (allowedRoles.includes((userRole || "").toUpperCase().trim())) {
                    btnEdit.classList.remove('hidden');
                } else {
                    btnEdit.classList.add('hidden');
                }
            }
        }

        async function openEditBannerModal() {
            const {value: formValues} = await Swal.fire({
                title: 'Update Info Banner',
                html:
                    '<input id="swal-title" class="swal2-input" placeholder="Judul Info Singkat">' +
                    '<textarea id="swal-content" class="swal2-textarea" placeholder="Isi Pengumuman / Pesan Berjalan..."></textarea>',
                focusConfirm: false,
                showCancelButton: true,
                confirmButtonText: 'Terbitkan',
                preConfirm: () => {
                    return {
                        title: document.getElementById('swal-title').value,
                        content: document.getElementById('swal-content').value
                    }
                }
            });

            if (formValues) {
                if (!formValues.title || !formValues.content) {
                    Swal.fire('Error', 'Judul dan Isi tidak boleh kosong!', 'error');
                    return;
                }

                const currentUserRole = window.currentUser ? window.currentUser.role : "MO";

                Swal.fire({
                    title: 'Memperbarui Banner...',
                    allowOutsideClick: false,
                    allowEscapeKey: false,
                    didOpen: () => Swal.showLoading()
                });
                try {
                    const response = await fetch(GAS_WEB_APP_URL, {
                        method: 'POST',
                        headers: {'Content-Type': 'text/plain;charset=utf-8'},
                        body: JSON.stringify({
                            action: 'updateBannerInfo',
                            title: formValues.title,
                            content: formValues.content,
                            userRole: currentUserRole
                        })
                    });

                    const result = await response.json();
                    Swal.close();

                    if (result.status === 'success') {
                        Swal.fire('Berhasil!', result.message, 'success');
                        fetchBannerInfo();
                    } else {
                        Swal.fire('Gagal!', result.message, 'error');
                    }
                } catch (err) {
                    Swal.close();
                    Swal.fire('Error', 'Gagal terhubung ke server', 'error');
                }
            }
        }

