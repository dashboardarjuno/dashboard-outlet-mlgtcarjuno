(function () {
    'use strict';
    const AUTH_EMAIL_KEY = 'arjunohub_login_email_v2';
    const gate = document.getElementById('auth-gate');
    const loginForm = document.getElementById('auth-email-form');
    const emailInput = document.getElementById('auth-email-input');
    const loginBtn = document.getElementById('auth-email-submit');
    const gateState = document.getElementById('auth-gate-state');
    const loginContent = document.getElementById('auth-login-content');

    function escapeAuthHtml(value) {
        return String(value == null ? '' : value).replace(/[&<>'"]/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[ch]));
    }
    function setLoading(message) {
        gate && gate.classList.remove('auth-hidden');
        if (loginContent) loginContent.hidden = true;
        if (gateState) {
            gateState.hidden = false;
            gateState.innerHTML = '<div class="auth-loading"><span class="auth-spinner"></span><span>' + escapeAuthHtml(message || 'Memeriksa email...') + '</span></div>';
        }
    }
    function showLogin(message) {
        document.documentElement.classList.remove('auth-ready');
        gate && gate.classList.remove('auth-hidden');
        if (gateState) {
            gateState.hidden = !message;
            gateState.innerHTML = message ? '<div class="auth-gate-error" style="font-size:12px;color:#b91c1c;text-align:center">' + escapeAuthHtml(message) + '</div>' : '';
        }
        if (loginContent) loginContent.hidden = false;
        if (loginBtn) loginBtn.disabled = false;
        if (emailInput) emailInput.focus();
    }
    function buildInitialsAvatar_(nama) {
        const clean = String(nama || '').trim();
        const parts = clean.split(/\s+/).filter(Boolean).slice(0, 2);
        const initials = (parts.map(w => w.charAt(0).toUpperCase()).join('') || '?');
        const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128">'
            + '<rect width="128" height="128" rx="64" fill="#ED1C24"/>'
            + '<text x="64" y="64" dy=".35em" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="52" font-weight="700" fill="#ffffff">' + initials + '</text>'
            + '</svg>';
        return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
    }

    function renderAuthProfile() {
        const employee = window.dashboardAuth && window.dashboardAuth.employee;
        if (!employee) return;
        const nik = (employee.nik || '').toString().trim().toUpperCase();
        const nama = employee.nama || window.dashboardAuth.email || 'Karyawan';
        const jabatan = employee.jabatan || '-';
        // customPhotoStore diisi oleh js/team.js (loadTeamPhotos), variabel
        // global dari js/core.js. Kalau belum sempat termuat, fallback ke
        // avatar inisial dulu; akan diperbarui lagi setelah foto tim selesai dimuat.
        const customPhoto = (typeof customPhotoStore !== 'undefined' && customPhotoStore[nik]) || '';
        const fallbackSrc = buildInitialsAvatar_(nama);
        const avatarSrc = customPhoto || fallbackSrc;

        document.querySelectorAll('[data-auth-avatar]').forEach(function (img) {
            img.alt = nama;
            img.onerror = function () {
                // Foto Google Drive di sheet Foto_Team gagal dimuat (link rusak/
                // dihapus/tidak publik) -> jangan biarkan ikon "gambar rusak",
                // pakai avatar inisial buatan sendiri sebagai cadangan.
                img.onerror = null;
                img.src = fallbackSrc;
            };
            img.src = avatarSrc;
        });
        document.querySelectorAll('[data-auth-name]').forEach(function (el) { el.textContent = nama; });
        document.querySelectorAll('[data-auth-jabatan]').forEach(function (el) { el.textContent = jabatan; });
    }
    window.renderAuthProfile = renderAuthProfile;

    function finishApp(email, employee) {
        gate && gate.classList.add('auth-hidden');
        document.documentElement.classList.add('auth-ready');
        document.documentElement.dataset.authUser = email;
        if (employee && employee.nik) document.documentElement.dataset.employeeNik = employee.nik;
        document.querySelectorAll('[data-auth-email]').forEach(el => el.textContent = email);
        window.dashboardAuth.employee = employee || null;
        window.dashboardAuth.email = email;
        localStorage.setItem(AUTH_EMAIL_KEY, email);
        renderAuthProfile();
        window.dispatchEvent(new CustomEvent('arjunohub:employee-ready', {detail: employee || null}));
    }
    async function verifyEmail(email) {
        const cleanEmail = String(email || '').trim().toLowerCase();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) return showLogin('Format email belum benar.');
        setLoading('Memeriksa email karyawan...');
        try {
            const data = await gasJsonp('checkUser', {email: cleanEmail}, {cacheMs: 0, timeoutMs: 10000});
            if (data && data.success && data.bound === true && data.employee) return finishApp(cleanEmail, data.employee);
            const message = data && data.code === 'NEED_BINDING'
                ? 'Email belum terdaftar. Hubungi Admin.'
                : ((data && data.message) || 'Email tidak memiliki akses.');
            showLogin(message);
        } catch (err) {
            showLogin(err.message || 'Gagal terhubung ke server.');
        }
    }
    function signOutUser() {
        localStorage.removeItem(AUTH_EMAIL_KEY);
        window.dashboardAuth.employee = null;
        window.dashboardAuth.email = '';
        showLogin();
    }

    function closeAllProfileMenus() {
        document.querySelectorAll('.auth-profile-menu').forEach(function (menu) {
            menu.style.display = 'none';
        });
    }
    document.addEventListener('click', function (e) {
        const trigger = e.target.closest('.auth-profile-trigger');
        if (trigger) {
            e.preventDefault();
            e.stopPropagation();
            const wrap = trigger.closest('.auth-profile-wrap');
            const menu = wrap && wrap.querySelector('.auth-profile-menu');
            if (!menu) return;
            const willOpen = menu.style.display !== 'block';
            closeAllProfileMenus();
            menu.style.display = willOpen ? 'block' : 'none';
            return;
        }
        if (e.target.closest('.auth-profile-menu-item')) {
            // Item menu (Profil Tim / Keluar) diklik -> tutup dropdown-nya.
            // Aksi sebenarnya (pindah view / logout) ditangani listener lain.
            closeAllProfileMenus();
            return;
        }
        if (!e.target.closest('.auth-profile-wrap')) closeAllProfileMenus();
    });
    document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') closeAllProfileMenus();
    });

    window.dashboardAuth = {employee: null, email: '', signOut: signOutUser};
    loginForm && loginForm.addEventListener('submit', event => {
        event.preventDefault();
        if (loginBtn) loginBtn.disabled = true;
        verifyEmail(emailInput ? emailInput.value : '');
    });
    document.querySelectorAll('[data-auth-logout]').forEach(btn => btn.addEventListener('click', signOutUser));
    const savedEmail = localStorage.getItem(AUTH_EMAIL_KEY);
    if (savedEmail) {
        if (emailInput) emailInput.value = savedEmail;
        verifyEmail(savedEmail);
    } else showLogin();
})();
