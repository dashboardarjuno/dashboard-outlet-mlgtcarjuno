(function () {
    'use strict';

    const firebaseConfig = {
        apiKey: "AIzaSyCcjPOlK0wdRVrdwsTyn0eWsY0Y-SUiTn4",
        authDomain: "arjunohub.firebaseapp.com",
        projectId: "arjunohub",
        storageBucket: "arjunohub.firebasestorage.app",
        messagingSenderId: "150477067410",
        appId: "1:150477067410:web:3696539c27bffc4258024b"
    };

    firebase.initializeApp(firebaseConfig);
    const auth = firebase.auth();
    auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL).catch(console.error);

    const gate = document.getElementById('auth-gate');
    const loginBtn = document.getElementById('auth-google-login');
    const gateState = document.getElementById('auth-gate-state');
    const loginContent = document.getElementById('auth-login-content');

    function setLoading(message) {
        if (gate) gate.classList.remove('auth-hidden');
        if (loginContent) loginContent.hidden = true;
        if (gateState) {
            gateState.hidden = false;
            gateState.innerHTML = '<div class="auth-loading"><span class="auth-spinner"></span><span>' + (message || 'Memeriksa sesi...') + '</span></div>';
        }
    }

    function showLogin() {
        document.documentElement.classList.remove('auth-ready');
        delete document.documentElement.dataset.authUser;
        delete document.documentElement.dataset.employeeNik;
        if (gate) gate.classList.remove('auth-hidden');
        if (gateState) gateState.hidden = true;
        if (loginContent) loginContent.hidden = false;
        if (loginBtn) loginBtn.disabled = false;
    }

    function apiUrl() {
        if (typeof GAS_WEB_APP_URL !== 'undefined' && GAS_WEB_APP_URL) return GAS_WEB_APP_URL;
        throw new Error('Endpoint Apps Script belum tersedia.');
    }

    async function postAuthAction(payload) {
        const response = await fetch(apiUrl(), {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify(payload)
        });
        if (!response.ok) throw new Error('Server tidak dapat dihubungi (' + response.status + ').');
        return response.json();
    }

    function finishApp(user, employee) {
        if (gate) gate.classList.add('auth-hidden');
        document.documentElement.classList.add('auth-ready');
        document.documentElement.dataset.authUser = user.uid;
        if (employee && employee.nik) document.documentElement.dataset.employeeNik = employee.nik;
        document.querySelectorAll('[data-auth-email]').forEach(el => el.textContent = user.email || '');
        window.dashboardAuth.employee = employee || null;
        window.dispatchEvent(new CustomEvent('arjunohub:employee-ready', { detail: employee || null }));
    }

    async function requestNikBinding(user) {
        if (!window.Swal) throw new Error('SweetAlert belum tersedia.');
        while (auth.currentUser) {
            const result = await Swal.fire({
                title: 'Verifikasi Karyawan',
                html:
                    '<div class="auth-bind-email">Akun Google<br><strong>' + escapeHtml(user.email || '') + '</strong></div>' +
                    '<div class="auth-bind-help">Masukkan NIK yang terdaftar di DATA KARYAWAN.</div>',
                input: 'text',
                inputLabel: 'NIK Karyawan',
                inputPlaceholder: 'Contoh: WSI.1009.0726',
                inputAttributes: { autocapitalize: 'characters', autocomplete: 'off' },
                showCancelButton: true,
                confirmButtonText: 'Verifikasi NIK',
                cancelButtonText: 'Keluar',
                allowOutsideClick: false,
                allowEscapeKey: false,
                inputValidator: value => !String(value || '').trim() ? 'NIK wajib diisi.' : undefined,
                preConfirm: async value => {
                    try {
                        const nik = String(value || '').trim().toUpperCase();
                        const data = await postAuthAction({ action: 'bindUser', email: user.email || '', nik: nik });
                        if (!data || data.success === false) throw new Error((data && data.message) || 'NIK tidak dapat diverifikasi.');
                        return data;
                    } catch (err) {
                        Swal.showValidationMessage(err.message || 'Gagal menghubungi server.');
                        return false;
                    }
                }
            });

            if (!result.isConfirmed) {
                await auth.signOut();
                return;
            }

            const data = result.value || {};
            const employee = data.employee || data.user || data.data || null;
            if (!employee) {
                await Swal.fire({ icon: 'error', title: 'Data Tidak Lengkap', text: 'Server belum mengembalikan data karyawan.' });
                continue;
            }

            const confirm = await Swal.fire({
                icon: 'success',
                title: 'NIK Terverifikasi',
                html: '<div class="auth-bind-confirm"><strong>' + escapeHtml(employee.nama || '-') + '</strong><br>' + escapeHtml(employee.nik || '') + ' · ' + escapeHtml(employee.jabatan || '-') + '</div>',
                confirmButtonText: 'Masuk Dashboard',
                allowOutsideClick: false,
                allowEscapeKey: false
            });
            if (confirm.isConfirmed) finishApp(user, employee);
            return;
        }
    }

    function escapeHtml(value) {
        return String(value == null ? '' : value).replace(/[&<>'"]/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[ch]));
    }

    async function verifyEmployee(user) {
        setLoading('Memeriksa data karyawan...');
        try {
            const data = await postAuthAction({ action: 'checkUser', email: user.email || '' });
            if (data && data.success && (data.bound === true || data.code === 'BOUND')) {
                finishApp(user, data.employee || data.user || data.data || null);
                return;
            }
            if (data && (data.code === 'NEED_BINDING' || data.bound === false)) {
                await requestNikBinding(user);
                return;
            }
            throw new Error((data && data.message) || 'Respons verifikasi akun tidak dikenali.');
        } catch (err) {
            console.error('Employee verification:', err);
            if (window.Swal) {
                const choice = await Swal.fire({
                    icon: 'error', title: 'Verifikasi Gagal',
                    text: err.message || 'Tidak dapat memeriksa data karyawan.',
                    showCancelButton: true, confirmButtonText: 'Coba Lagi', cancelButtonText: 'Keluar',
                    allowOutsideClick: false
                });
                if (choice.isConfirmed && auth.currentUser) return verifyEmployee(auth.currentUser);
            }
            await auth.signOut();
        }
    }

    async function signInGoogle() {
        if (!loginBtn) return;
        loginBtn.disabled = true;
        setLoading('Membuka Google Login...');
        const provider = new firebase.auth.GoogleAuthProvider();
        provider.setCustomParameters({ prompt: 'select_account' });
        try {
            await auth.signInWithPopup(provider);
        } catch (err) {
            console.error('Google sign-in:', err);
            showLogin();
            if (err.code !== 'auth/popup-closed-by-user' && window.Swal) {
                const msg = err.code === 'auth/unauthorized-domain'
                    ? 'Domain website belum diizinkan di Firebase Authentication.'
                    : (err.message || 'Google Login gagal. Silakan coba lagi.');
                Swal.fire({icon:'error',title:'Login Gagal',text:msg,confirmButtonText:'OK'});
            }
        }
    }

    async function signOutUser() {
        const result = window.Swal ? await Swal.fire({
            icon: 'question', title: 'Keluar dari Dashboard?', text: 'Sesi Google di Dashboard Arjuno akan diakhiri.',
            showCancelButton: true, confirmButtonText: 'Ya, Keluar', cancelButtonText: 'Batal', confirmButtonColor: '#dc2626'
        }) : { isConfirmed: true };
        if (!result.isConfirmed) return;
        await auth.signOut();
    }

    window.dashboardAuth = { auth, signOut: signOutUser, employee: null };
    if (loginBtn) loginBtn.addEventListener('click', signInGoogle);
    document.querySelectorAll('[data-auth-logout]').forEach(btn => btn.addEventListener('click', signOutUser));

    setLoading('Memeriksa sesi...');
    auth.onAuthStateChanged(user => user ? verifyEmployee(user) : showLogin());
})();
