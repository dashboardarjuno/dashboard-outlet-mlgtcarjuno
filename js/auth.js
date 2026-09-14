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
    function finishApp(email, employee) {
        gate && gate.classList.add('auth-hidden');
        document.documentElement.classList.add('auth-ready');
        document.documentElement.dataset.authUser = email;
        if (employee && employee.nik) document.documentElement.dataset.employeeNik = employee.nik;
        document.querySelectorAll('[data-auth-email]').forEach(el => el.textContent = email);
        window.dashboardAuth.employee = employee || null;
        window.dashboardAuth.email = email;
        localStorage.setItem(AUTH_EMAIL_KEY, email);
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
