// ==========================================================
// CELEBRATE.JS — Kartu "Perayaan hari ini" (ulang tahun & masa kerja)
// ==========================================================
// - Tidak mengubah file lain. Kartu disisipkan dari luar, sama seperti
//   badge QSC: di Beranda mode modern, di bawah hero mode klasik, dan ikon
//   kecil di foto kartu Our Team (dengan membungkus renderOurTeamSection).
// - Privasi: server hanya mengirim nik, nama, jabatan, dan jumlah tahun
//   masa kerja. Tanggal lahir/masuk/usia tidak pernah sampai ke browser.
// - Muat file ini SETELAH team.js dan qsc.js.
// ==========================================================

(function () {
    'use strict';

    var REFRESH_MS = 30 * 60 * 1000;
    var CARD_IDS = { modern: 'celebrate-modern', classic: 'celebrate-classic' };
    var state = { birthdays: [], anniversaries: [], loadedAt: 0 };

    // ---------- util ----------
    function esc(value) {
        if (typeof escapeHtml === 'function') return escapeHtml(value);
        return String(value == null ? '' : value)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }

    function toTitle(name) {
        return String(name || '').trim().toLowerCase()
            .replace(/(^|[\s.\-'])([a-z\u00c0-\u024f])/g, function (_, sep, ch) { return sep + ch.toUpperCase(); });
    }

    function firstName(name) {
        var parts = toTitle(name).split(/\s+/).filter(Boolean);
        return parts[0] || '';
    }

    function initials(name) {
        var parts = toTitle(name).split(/\s+/).filter(Boolean);
        return ((parts[0] || '?').charAt(0) + (parts[1] ? parts[1].charAt(0) : '')).toUpperCase();
    }

    function myNik() {
        return String(document.documentElement.dataset.employeeNik || '').trim().toUpperCase();
    }

    function isMe(person) {
        var mine = myNik();
        return !!mine && String(person.nik || '').trim().toUpperCase() === mine;
    }

    function photoOf(person) {
        try {
            if (typeof customPhotoStore !== 'undefined' && customPhotoStore && customPhotoStore[person.nik]) {
                return customPhotoStore[person.nik];
            }
        } catch (_) { /* store belum siap -> pakai inisial */ }
        return '';
    }

    // ---------- gaya ----------
    function injectStyle() {
        if (document.getElementById('celebrate-style')) return;
        var css = [
            '.cel-card{background:#fff;border:1px solid #fde68a;border-radius:16px;padding:14px 16px;margin-top:14px;box-shadow:0 1px 2px rgba(15,23,42,.04)}',
            '.cel-head{display:flex;align-items:center;gap:8px;margin-bottom:10px;font-weight:700;font-size:14px;color:#0f172a}',
            '.cel-head i{color:#ea580c}',
            '.cel-row{display:flex;align-items:center;gap:10px;padding:6px 0}',
            '.cel-row + .cel-row{border-top:1px solid #f1f5f9}',
            '.cel-av{position:relative;flex:0 0 auto;width:40px;height:40px;border-radius:50%;background:#ffedd5;color:#c2410c;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:13px;overflow:hidden}',
            '.cel-av img{width:100%;height:100%;object-fit:cover}',
            '.cel-main{min-width:0;flex:1 1 auto}',
            '.cel-name{margin:0;font-size:14px;font-weight:700;color:#0f172a;line-height:1.3;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
            '.cel-sub{margin:0;font-size:12px;color:#64748b;line-height:1.35}',
            '.cel-btn{flex:0 0 auto;display:inline-flex;align-items:center;gap:6px;font-size:12px;font-weight:600;color:#c2410c;background:#fff7ed;border:1px solid #fed7aa;border-radius:999px;padding:6px 12px;cursor:pointer;min-height:32px}',
            '.cel-btn:hover{background:#ffedd5}',
            '.cel-pill{flex:0 0 auto;font-size:12px;font-weight:700;color:#166534;background:#dcfce7;border:1px solid #bbf7d0;border-radius:999px;padding:3px 10px}',
            '.cel-team-badge{position:absolute;right:-2px;bottom:-2px;z-index:2;width:22px;height:22px;border-radius:50%;background:#fff7ed;color:#ea580c;border:2px solid #fff;display:flex;align-items:center;justify-content:center;font-size:10px;box-shadow:0 1px 3px rgba(15,23,42,.25)}',
            'html[data-theme="modern"] #' + CARD_IDS.classic + '{display:none!important}'
        ].join('\n');
        var style = document.createElement('style');
        style.id = 'celebrate-style';
        style.textContent = css;
        document.head.appendChild(style);
    }

    // ---------- kartu ----------
    function rowHtml(person, kind) {
        var nama = toTitle(person.nama);
        var photo = photoOf(person);
        var avatar = photo
            ? '<img src="' + esc(photo) + '" alt="' + esc(nama) + '" loading="lazy">'
            : esc(initials(person.nama));
        var me = isMe(person);
        var sub, action;

        if (kind === 'birthday') {
            sub = me ? 'Selamat ulang tahun! Tim Arjuno mendoakan yang terbaik.' : 'Ulang tahun hari ini \u00b7 ' + esc(person.jabatan || '');
            action = me ? '' :
                '<button type="button" class="cel-btn" data-cel-wish="birthday" data-cel-name="' + esc(firstName(person.nama)) + '">' +
                '<i class="fa-brands fa-whatsapp" aria-hidden="true"></i> Ucapan</button>';
        } else {
            sub = me
                ? 'Terima kasih sudah ' + esc(person.years) + ' tahun bersama Arjuno!'
                : esc(person.years) + ' tahun bersama Arjuno \u00b7 ' + esc(person.jabatan || '');
            action = me
                ? '<span class="cel-pill">' + esc(person.years) + ' th</span>'
                : '<button type="button" class="cel-btn" data-cel-wish="anniversary" data-cel-years="' + esc(person.years) + '" data-cel-name="' + esc(firstName(person.nama)) + '">' +
                  '<i class="fa-brands fa-whatsapp" aria-hidden="true"></i> Ucapan</button>';
        }

        return '<div class="cel-row">' +
            '<div class="cel-av" aria-hidden="true">' + avatar + '</div>' +
            '<div class="cel-main"><p class="cel-name">' + esc(nama) + '</p><p class="cel-sub">' + sub + '</p></div>' +
            action +
            '</div>';
    }

    function cardHtml(id) {
        var rows = state.birthdays.map(function (p) { return rowHtml(p, 'birthday'); })
            .concat(state.anniversaries.map(function (p) { return rowHtml(p, 'anniversary'); }))
            .join('');
        return '<section id="' + id + '" class="cel-card" role="region" aria-label="Perayaan hari ini">' +
            '<div class="cel-head"><i class="fa-solid fa-cake-candles" aria-hidden="true"></i><span>Perayaan hari ini</span></div>' +
            rows + '</section>';
    }

    function removeCards() {
        Object.keys(CARD_IDS).forEach(function (key) {
            var el = document.getElementById(CARD_IDS[key]);
            if (el && el.parentNode) el.parentNode.removeChild(el);
        });
    }

    function renderCards() {
        removeCards();
        if (!state.birthdays.length && !state.anniversaries.length) return;

        var modernGrid = document.querySelector('#modern-home .modern-home-grid');
        if (modernGrid) modernGrid.insertAdjacentHTML('beforeend', cardHtml(CARD_IDS.modern));

        var classicHero = document.getElementById('classic-hero');
        if (classicHero) classicHero.insertAdjacentHTML('afterend', cardHtml(CARD_IDS.classic));
    }

    // ---------- ucapan via WhatsApp ----------
    document.addEventListener('click', function (event) {
        var btn = event.target.closest ? event.target.closest('[data-cel-wish]') : null;
        if (!btn) return;
        var name = btn.getAttribute('data-cel-name') || '';
        var text;
        if (btn.getAttribute('data-cel-wish') === 'anniversary') {
            text = 'Selamat hari jadi ' + btn.getAttribute('data-cel-years') + ' tahun bersama Arjuno, ' + name +
                '! Terima kasih atas kerja kerasnya. \ud83d\ude4c';
        } else {
            text = 'Selamat ulang tahun, ' + name +
                '! \ud83c\udf82 Semoga sehat, bahagia, dan sukses selalu. Salam dari tim Mlg Tc Arjuno.';
        }
        window.open('https://wa.me/?text=' + encodeURIComponent(text), '_blank', 'noopener');
    });

    // ---------- ikon di foto kartu Our Team ----------
    function injectTeamBadges() {
        var birthdayNiks = {};
        var anniversaryYears = {};
        state.birthdays.forEach(function (p) { birthdayNiks[String(p.nik).toUpperCase()] = true; });
        state.anniversaries.forEach(function (p) { anniversaryYears[String(p.nik).toUpperCase()] = p.years; });

        document.querySelectorAll('[id^="team-nik-"]').forEach(function (el) {
            var index = el.id.replace('team-nik-', '');
            var nik = (el.textContent || '').replace('NIK:', '').trim().toUpperCase();
            var trigger = document.getElementById('team-photo-preview-trigger-' + index);
            var holder = trigger ? trigger.parentElement : null;
            if (!holder) return;

            var old = holder.querySelector('.cel-team-badge');
            if (old) old.remove();

            var isBirthday = !!birthdayNiks[nik];
            var years = anniversaryYears[nik];
            if (!isBirthday && !years) return;

            var badge = document.createElement('span');
            badge.className = 'cel-team-badge';
            badge.setAttribute('role', 'img');
            var label = isBirthday ? 'Ulang tahun hari ini' : years + ' tahun bersama Arjuno';
            if (isBirthday && years) label += ' \u00b7 ' + years + ' tahun bersama Arjuno';
            badge.title = label;
            badge.setAttribute('aria-label', label);
            badge.innerHTML = '<i class="fa-solid ' + (isBirthday ? 'fa-cake-candles' : 'fa-award') + '" aria-hidden="true"></i>';
            holder.appendChild(badge);
        });
    }

    (function wrapTeamRender() {
        var original = window.renderOurTeamSection;
        if (typeof original !== 'function') return;
        window.renderOurTeamSection = function () {
            var out = original.apply(this, arguments);
            injectTeamBadges();
            return out;
        };
    })();

    // ---------- ambil data ----------
    async function loadCelebrations(force) {
        try {
            var res = await gasJsonp('getCelebrations', {}, { cacheMs: 10 * 60 * 1000, force: !!force });
            if (!res || !res.success || !res.data) {
                state.birthdays = [];
                state.anniversaries = [];
            } else {
                state.birthdays = Array.isArray(res.data.birthdays) ? res.data.birthdays : [];
                state.anniversaries = Array.isArray(res.data.anniversaries) ? res.data.anniversaries : [];
            }
            state.loadedAt = Date.now();
            renderCards();
            injectTeamBadges();
        } catch (err) {
            // Perayaan hanya pelengkap: gagal dimuat tidak boleh mengganggu dashboard.
            console.warn('Perayaan tidak dimuat:', err && err.message ? err.message : err);
        }
    }

    injectStyle();

    window.addEventListener('arjunohub:employee-ready', function () {
        setTimeout(function () { loadCelebrations(false); }, 1800);
        setInterval(function () { loadCelebrations(true); }, REFRESH_MS);
    }, { once: true });

    // Halaman dibiarkan terbuka semalaman -> segarkan saat kembali dilihat.
    document.addEventListener('visibilitychange', function () {
        if (document.visibilityState === 'visible' && state.loadedAt && Date.now() - state.loadedAt > 10 * 60 * 1000) {
            loadCelebrations(true);
        }
    });
})();
