(function () {
    'use strict';

    var html = document.documentElement;
    var VIEW_KEY = 'modernActiveView';
    var viewMap = {
        home: { title: 'Beranda', eyebrow: 'Dashboard Outlet', target: 'modern-home' },
        schedule: { title: 'Jadwal Tim', eyebrow: 'Manpower Planning', target: 'section-shift' },
        'off-matrix': { title: 'Matriks Libur', eyebrow: 'Off & Cuti', target: 'section-off-matrix' },
        team: { title: 'Our Team', eyebrow: 'People & Structure', target: 'section-our-team' }
    };

    function isModern() { return html.getAttribute('data-theme') === 'modern'; }
    function qs(sel, root) { return (root || document).querySelector(sel); }
    function qsa(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }

    function setView(view, options) {
        options = options || {};
        if (!viewMap[view]) view = 'home';
        html.setAttribute('data-modern-view', view);
        try { sessionStorage.setItem(VIEW_KEY, view); } catch (e) { }

        var meta = viewMap[view];
        var title = document.getElementById('modern-page-title');
        var eyebrow = document.getElementById('modern-eyebrow');
        if (title) title.textContent = meta.title;
        if (eyebrow) eyebrow.textContent = meta.eyebrow;

        qsa('[data-modern-view]').forEach(function (el) {
            var active = el.getAttribute('data-modern-view') === view;
            el.classList.toggle('active', active);
            if (el.tagName === 'BUTTON') el.setAttribute('aria-current', active ? 'page' : 'false');
        });

        closeMore();
        if (isModern() && options.scroll !== false) {
            var main = qs('main');
            if (main) main.scrollTo ? main.scrollTo({ top: 0, behavior: 'smooth' }) : window.scrollTo(0, 0);
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }

        if (view === 'schedule' && typeof window.loadSchedule === 'function' && options.autoLoad) window.loadSchedule();
        if (view === 'team' && typeof window.renderOurTeamSection === 'function') window.renderOurTeamSection();
    }

    function openMore() {
        var sheet = document.getElementById('modern-more-sheet');
        if (!sheet) return;
        sheet.classList.add('open');
        sheet.setAttribute('aria-hidden', 'false');
        document.body.classList.add('modern-sheet-open');
    }

    function closeMore() {
        var sheet = document.getElementById('modern-more-sheet');
        if (!sheet) return;
        sheet.classList.remove('open');
        sheet.setAttribute('aria-hidden', 'true');
        document.body.classList.remove('modern-sheet-open');
    }

    function showSopUnavailable() {
        closeMore();
        if (window.Swal) {
            Swal.fire({
                icon: 'info',
                title: 'SOP / SOC',
                text: 'Section SOP/SOC belum tersedia pada source code saat ini. Menu sudah disiapkan dan bisa dihubungkan saat link atau modul SOP/SOC ditambahkan.',
                confirmButtonText: 'Mengerti',
                customClass: { popup: 'modern-swal' }
            });
        } else {
            alert('SOP/SOC belum tersedia pada source code saat ini.');
        }
    }

    function switchClassic() {
        var btn = document.getElementById('btn-theme-klasik');
        if (btn) btn.click();
        else html.setAttribute('data-theme', 'klasik');
        closeMore();
    }

    function invokeAction(action) {
        switch (action) {
            case 'absensi': closeMore(); if (typeof window.openAbsensiModal === 'function') window.openAbsensiModal(); break;
            case 'off': closeMore(); if (typeof window.openOffCutiModal === 'function') window.openOffCutiModal(); break;
            case 'kas': closeMore(); if (typeof window.openKasModal === 'function') window.openKasModal(); break;
            case 'info': closeMore(); if (typeof window.openInfoModal === 'function') window.openInfoModal(); break;
            case 'sop': showSopUnavailable(); break;
            case 'classic': switchClassic(); break;
            case 'more': openMore(); break;
            case 'close-more': closeMore(); break;
        }
    }

    function syncClock() {
        var now = new Date();
        var time = document.getElementById('modern-current-time');
        var date = document.getElementById('modern-current-date');
        if (time) time.textContent = now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', hour12: false }).replace('.', ':');
        if (date) date.textContent = now.toLocaleDateString('id-ID', { weekday: 'short', day: '2-digit', month: 'short' });
    }

    function syncOutletStatus() {
        var source = document.getElementById('outlet-status-container');
        var target = document.getElementById('modern-outlet-state');
        if (!source || !target) return;
        var text = (source.textContent || '').trim() || 'Status outlet';
        target.textContent = text;
        var kicker = target.closest('.modern-kicker');
        if (kicker) kicker.classList.toggle('is-closed', /closed|tutup/i.test(text));
    }

    function syncBanner() {
        var source = document.getElementById('bannerMarquee');
        var target = document.getElementById('modern-banner-text');
        if (source && target) target.textContent = (source.textContent || '').trim() || 'Informasi outlet terbaru';
    }

    function applyThemeState() {
        var shell = document.getElementById('modern-app-shell');
        if (shell) shell.setAttribute('aria-hidden', isModern() ? 'false' : 'true');
        if (isModern()) {
            var saved = 'home';
            try { saved = sessionStorage.getItem(VIEW_KEY) || 'home'; } catch (e) { }
            setView(saved, { scroll: false });
            syncOutletStatus();
            syncBanner();
        } else {
            html.removeAttribute('data-modern-view');
            closeMore();
        }
    }

    document.addEventListener('click', function (e) {
        if (!isModern()) return;

        // Penting: <html> juga memakai data-modern-view untuk state halaman.
        // Jangan biarkan root <html> dianggap sebagai tombol navigasi, karena
        // closest() akan selalu menemukannya dan memblokir semua klik/link lain.
        var actionEl = e.target.closest('[data-modern-action]');
        if (actionEl && actionEl !== html) {
            e.preventDefault();
            invokeAction(actionEl.getAttribute('data-modern-action'));
            return;
        }

        var viewEl = e.target.closest('[data-modern-view]');
        if (viewEl && viewEl !== html) {
            e.preventDefault();
            setView(viewEl.getAttribute('data-modern-view'));
        }
    });

    document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') closeMore();
        if ((e.key === 'Enter' || e.key === ' ') && isModern()) {
            var el = e.target.closest('[data-modern-view][role="button"], [data-modern-action][role="button"]');
            if (el) el.click();
        }
    });

    document.addEventListener('DOMContentLoaded', function () {
        syncClock();
        setInterval(syncClock, 30000);
        applyThemeState();

        var observer = new MutationObserver(function () { applyThemeState(); });
        observer.observe(html, { attributes: true, attributeFilter: ['data-theme'] });

        var status = document.getElementById('outlet-status-container');
        if (status) new MutationObserver(syncOutletStatus).observe(status, { childList: true, subtree: true, characterData: true, attributes: true });
        var banner = document.getElementById('bannerMarquee');
        if (banner) new MutationObserver(syncBanner).observe(banner, { childList: true, subtree: true, characterData: true });
    });
})();


/* MOBILE_DATETIME_MIRROR */
(function () {
  function ensureModernMobileDateTime() {
    if (document.documentElement.getAttribute('data-theme') !== 'modern') return;
    if (window.innerWidth > 768) return;

    var host =
      document.querySelector('.modern-topbar-actions') ||
      document.querySelector('.modern-topbar') ||
      document.querySelector('.modern-header') ||
      document.querySelector('.app-topbar');

    if (!host) return;

    var box = document.getElementById('modernMobileDateTime');
    if (!box) {
      box = document.createElement('div');
      box.id = 'modernMobileDateTime';
      box.className = 'modern-datetime modern-mobile-datetime';
      box.innerHTML = '<div class="modern-time"></div><div class="modern-date"></div>';
      host.insertBefore(box, host.firstChild);
    }

    function update() {
      var now = new Date();
      var timeEl = box.querySelector('.modern-time');
      var dateEl = box.querySelector('.modern-date');

      if (timeEl) {
        timeEl.textContent = now.toLocaleTimeString('id-ID', {
          hour: '2-digit',
          minute: '2-digit',
          hour12: false
        }).replace('.', ':');
      }

      if (dateEl) {
        dateEl.textContent = now.toLocaleDateString('id-ID', {
          weekday: 'short',
          day: '2-digit',
          month: 'short'
        });
      }
    }

    update();
    if (!window.__modernMobileClockTimer) {
      window.__modernMobileClockTimer = setInterval(update, 30000);
    }
  }

  document.addEventListener('DOMContentLoaded', ensureModernMobileDateTime);
  window.addEventListener('resize', ensureModernMobileDateTime);

  var observer = new MutationObserver(ensureModernMobileDateTime);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['data-theme']
  });
})();
