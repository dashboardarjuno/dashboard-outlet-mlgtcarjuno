// ==========================================================
// KAS.JS — Kas outlet: saldo, riwayat transaksi, input transaksi
// ==========================================================

        function formatRupiah(angka) {
            return new Intl.NumberFormat('id-ID', {style: 'currency', currency: 'IDR', minimumFractionDigits: 0}).format(angka);
        }

        async function openKasModal() {
            openModal('modal-kas');
            await loadKasData();
        }

        async function loadKasData() {
            const tbody = document.getElementById('tbody-kas-history');
            tbody.innerHTML = '<tr><td colspan="3" class="text-center p-3 text-slate-400"><i class="fa-solid fa-spinner animate-spin"></i> Memuat data...</td></tr>';

            try {
                const response = await fetch(GAS_WEB_APP_URL + "?action=getKasData");
                const res = await response.json();

                if (res.success) {
                    document.getElementById('display-saldo-kas').textContent = formatRupiah(res.saldo || 0);
                    document.getElementById('display-total-masuk').textContent = formatRupiah(res.totalMasuk || 0);
                    document.getElementById('display-total-keluar').textContent = formatRupiah(res.totalKeluar || 0);

                    if (res.history && res.history.length > 0) {
                        tbody.innerHTML = res.history.map(item => {
                            const isMasuk = item.tipe === 'MASUK';
                            const colorClass = isMasuk ? 'text-emerald-600' : 'text-rose-600';
                            const badgeClass = isMasuk ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-rose-50 text-rose-700 border-rose-200';
                            const prefix = isMasuk ? '+' : '-';

                            return `
                                <tr class="hover:bg-slate-50">
                                    <td class="p-2">
                                        <span class="font-medium text-slate-500 block text-[10px]">${item.waktu}</span>
                                        <span class="px-1.5 py-0.5 rounded text-[9px] font-bold border ${badgeClass}">${item.tipe}</span>
                                    </td>
                                    <td class="p-2 font-medium text-slate-700">${item.keterangan}</td>
                                    <td class="p-2 text-right font-bold ${colorClass}">${prefix} ${formatRupiah(item.nominal)}</td>
                                </tr>
                            `;
                        }).join('');
                    } else {
                        tbody.innerHTML = '<tr><td colspan="3" class="text-center p-3 text-slate-400">Belum ada transaksi kas.</td></tr>';
                    }
                }
            } catch (err) {
                console.error("Gagal load data kas:", err);
                tbody.innerHTML = '<tr><td colspan="3" class="text-center p-3 text-red-500">Gagal memuat data kas.</td></tr>';
            }
        }

        async function submitKas(e) {
            e.preventDefault();

            const tipe = document.querySelector('input[name="tipe_kas"]:checked').value;
            const nominal = parseFloat(document.getElementById('input-nominal-kas').value);
            const keterangan = document.getElementById('input-keterangan-kas').value.trim();

            if (!nominal || nominal <= 0 || !keterangan) {
                showPopup('warning', 'Data Belum Lengkap', 'Masukkan nominal dan keterangan transaksi!');
                return;
            }

            const btnSubmit = document.getElementById("btn-submit-kas");
            btnSubmit.disabled = true;
            btnSubmit.innerHTML = `<i class="fa-solid fa-spinner animate-spin"></i> Menyimpan...`;

            const payload = {
                action: "submitKas",
                tipe: tipe,
                nominal: nominal,
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
                    showPopup('success', 'Transaksi Berhasil!', result.message, async function () {
                        document.getElementById("form-kas").reset();
                        await loadKasData();
                    });
                } else {
                    showPopup('error', 'Gagal Menyimpan', result.message);
                }
            } catch (err) {
                showPopup('error', 'Kesalahan Sistem', 'Terjadi kesalahan koneksi: ' + err.toString());
            } finally {
                btnSubmit.disabled = false;
                btnSubmit.innerHTML = `<i class="fa-solid fa-floppy-disk"></i> Simpan Transaksi Kas`;
            }
        }

