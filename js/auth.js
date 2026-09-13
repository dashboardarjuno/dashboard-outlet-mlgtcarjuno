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
        if (loginContent) loginContent.hidden = true;
        if (gateState) {
            gateState.hidden = false;
            gateState.innerHTML = '<div class="auth-loading"><span class="auth-spinner"></span><span>' + (message || 'Memeriksa sesi...') + '</span></div>';
        }
    }

    function showLogin() {
        if (gate) gate.classList.remove('auth-hidden');
        if (gateState) gateState.hidden = true;
        if (loginContent) loginContent.hidden = false;
        if (loginBtn) loginBtn.disabled = false;
    }

    function showApp(user) {
        if (gate) gate.classList.add('auth-hidden');
        document.documentElement.classList.add('auth-ready');
        document.documentElement.dataset.authUser = user.uid;
        document.querySelectorAll('[data-auth-email]').forEach(el => el.textContent = user.email || '');
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
            if (err.code !== 'auth/popup-closed-by-user') {
                const msg = err.code === 'auth/unauthorized-domain'
                    ? 'Domain website belum diizinkan di Firebase Authentication.'
                    : (err.message || 'Google Login gagal. Silakan coba lagi.');
                if (window.Swal) Swal.fire({icon:'error',title:'Login Gagal',text:msg,confirmButtonText:'OK'});
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

    window.dashboardAuth = { auth, signOut: signOutUser };
    if (loginBtn) loginBtn.addEventListener('click', signInGoogle);
    document.querySelectorAll('[data-auth-logout]').forEach(btn => btn.addEventListener('click', signOutUser));

    setLoading('Memeriksa sesi...');
    auth.onAuthStateChanged(user => user ? showApp(user) : showLogin());
})();
