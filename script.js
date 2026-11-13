(function () {
    'use strict';
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const fine = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
    const $ = (s, r = document) => r.querySelector(s);
    const $$ = (s, r = document) => [...r.querySelectorAll(s)];

    /* Vecchi indirizzi del sito a pagina unica: portano alle pagine nuove */
    const oldRoutes = {
        '#about': 'chi-siamo.html', '#team': 'team.html', '#contact': 'contatti.html',
        '#treatments': 'trattamenti.html', '#treatment-prevenzione': 'trattamenti.html#prevenzione',
        '#treatment-chirurgia': 'trattamenti.html#chirurgia', '#treatment-ortodonzia': 'trattamenti.html#ortodonzia',
        '#treatment-sonno': 'trattamenti.html#sonno'
    };
    if (document.body.dataset.page === 'home' && oldRoutes[location.hash]) { location.replace(oldRoutes[location.hash]); return; }

    /* Navbar: diventa una pillola dopo i primi pixel di scroll */
    const nav = $('[data-nav]');
    const onScroll = () => nav.classList.toggle('is-scrolled', window.scrollY > 24);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });

    /* Menu mobile */
    const burger = $('.nav__burger');
    const menu = $('#menu');
    const setMenu = (open) => {
        burger.setAttribute('aria-expanded', String(open));
        burger.setAttribute('aria-label', open ? 'Chiudi il menu' : 'Apri il menu');
        if (open) { menu.hidden = false; requestAnimationFrame(() => menu.classList.add('is-open')); }
        else { menu.classList.remove('is-open'); setTimeout(() => { menu.hidden = true; }, reduce ? 0 : 250); }
        document.body.style.overflow = open ? 'hidden' : '';
    };
    burger.addEventListener('click', () => setMenu(burger.getAttribute('aria-expanded') !== 'true'));
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !menu.hidden) setMenu(false); });

    /* Hero: entra una volta, appena la foto è pronta */
    const hero = $('.hero');
    if (hero) {
        const img = $('img', hero);
        const enter = () => hero.classList.add('is-entered');
        if (img.complete) enter();
        else { img.addEventListener('load', enter, { once: true }); img.addEventListener('error', enter, { once: true }); }
        setTimeout(enter, 1200);
    }

    /* Finita l'entrata, l'animazione lascia il posto ai movimenti col puntatore */
    document.addEventListener('animationend', (e) => {
        const el = e.target;
        if (el.classList && (el.classList.contains('card') || el.classList.contains('hours-card'))) el.classList.add('is-settled');
    });

    /* Titoli: ogni riga in una maschera, così sale dal basso */
    function splitLines(el) {
        const original = el.dataset.original || el.innerHTML;
        el.dataset.original = original;
        const tmp = document.createElement('div');
        tmp.innerHTML = original;
        const words = [];
        const walk = (node, cls) => node.childNodes.forEach((n) => {
            if (n.nodeType === 3) n.textContent.split(/\s+/).forEach((w) => { if (w) words.push({ w, cls }); });
            else if (n.nodeType === 1) walk(n, n.className || cls);
        });
        walk(tmp, '');
        el.innerHTML = words.map((o) => `<span class="w${o.cls ? ' ' + o.cls : ''}">${o.w}</span>`).join(' ');
        const lines = [];
        let top = null;
        $$('.w', el).forEach((sp) => {
            if (sp.offsetTop !== top) { top = sp.offsetTop; lines.push([]); }
            lines[lines.length - 1].push(sp.outerHTML);
        });
        el.innerHTML = lines.map((l) => `<span class="line"><span>${l.join(' ')}</span></span>`).join('');
        el.dataset.split = 'done';
    }
    const splitAll = () => {
        if (reduce) return;
        $$('[data-lines]').forEach((el) => { if (!el.closest('.is-revealed')) splitLines(el); });
    };

    /* Sezioni: una sola entrata, quando arrivano in vista */
    const io = new IntersectionObserver((entries) => {
        entries.forEach((e) => {
            if (!e.isIntersecting) return;
            e.target.classList.add('is-revealed');
            io.unobserve(e.target);
        });
    }, { threshold: 0.08, rootMargin: '0px 0px -8% 0px' });
    let started = false;
    const start = () => {
        if (started) return;
        started = true;
        splitAll();
        $$('[data-reveal]').forEach((s) => io.observe(s));
    };
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(start);
    setTimeout(start, 900);
    let resizeTimer;
    window.addEventListener('resize', () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(splitAll, 150); });

    /* Orari: stato di apertura e giorno di oggi, sull'ora italiana */
    const WEEK = { 1: [[14, 0, 19, 0]], 2: [[9, 0, 13, 0]], 3: [[9, 0, 12, 0], [15, 0, 19, 0]], 4: [[9, 0, 12, 0], [15, 0, 19, 0]], 5: [[9, 0, 13, 0]], 6: [], 0: [] };
    const DAYS = ['domenica', 'lunedì', 'martedì', 'mercoledì', 'giovedì', 'venerdì', 'sabato'];
    const fmt = (h, m) => h + ':' + String(m).padStart(2, '0');
    (function hours() {
        let day, mins;
        try {
            const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Rome', weekday: 'short', hour: 'numeric', minute: 'numeric', hour12: false }).formatToParts(new Date());
            const get = (k) => parts.find((p) => p.type === k).value;
            day = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(get('weekday'));
            mins = (parseInt(get('hour'), 10) % 24) * 60 + parseInt(get('minute'), 10);
        } catch (err) { const d = new Date(); day = d.getDay(); mins = d.getHours() * 60 + d.getMinutes(); }
        $$('[data-schedule-day]').forEach((el) => el.classList.toggle('is-today', parseInt(el.dataset.scheduleDay, 10) === day));
        const state = $('[data-open-state]');
        if (!state) return;
        const slots = WEEK[day];
        $('[data-today-label]').textContent = 'Oggi, ' + DAYS[day];
        $('[data-today-hours]').textContent = slots.length ? slots.map((s) => fmt(s[0], s[1]) + ' – ' + fmt(s[2], s[3])).join(' · ') : 'chiuso';
        const detail = $('[data-open-detail]');
        const current = slots.find((s) => mins >= s[0] * 60 + s[1] && mins < s[2] * 60 + s[3]);
        const next = slots.find((s) => mins < s[0] * 60 + s[1]);
        if (current) {
            state.textContent = 'Aperto adesso';
            detail.textContent = ' · chiude alle ' + fmt(current[2], current[3]);
            state.parentElement.classList.add('is-open');
        } else if (next) {
            state.textContent = 'Chiuso ora';
            detail.textContent = ' · riapre alle ' + fmt(next[0], next[1]);
        } else {
            let d = day, found = null, n = 0;
            while (!found && n < 7) { d = (d + 1) % 7; n++; if (WEEK[d].length) found = WEEK[d][0]; }
            state.textContent = 'Chiuso ora';
            detail.textContent = found ? ' · riapre ' + (n === 1 ? 'domani' : DAYS[d]) + ' alle ' + fmt(found[0], found[1]) : '';
        }
    })();

    /* Profondità: gli strati dell'hero seguono il puntatore, ognuno con la sua velocità */
    if (hero && fine && !reduce) {
        const layers = $$('[data-depth]', hero);
        let tx = 0, ty = 0, cx = 0, cy = 0, raf = null;
        const render = () => {
            cx += (tx - cx) * 0.08; cy += (ty - cy) * 0.08;
            layers.forEach((l) => {
                const d = parseFloat(l.dataset.depth);
                const v = l.dataset.var || 'p';
                l.style.setProperty('--' + v + 'x', (cx * d * 22).toFixed(2) + 'px');
                l.style.setProperty('--' + v + 'y', (cy * d * 16).toFixed(2) + 'px');
            });
            raf = (Math.abs(tx - cx) > 0.001 || Math.abs(ty - cy) > 0.001) ? requestAnimationFrame(render) : null;
        };
        const kick = () => { if (!raf) raf = requestAnimationFrame(render); };
        hero.addEventListener('pointermove', (e) => {
            const r = hero.getBoundingClientRect();
            tx = ((e.clientX - r.left) / r.width - 0.5) * 2;
            ty = ((e.clientY - r.top) / r.height - 0.5) * 2;
            kick();
        });
        hero.addEventListener('pointerleave', () => { tx = 0; ty = 0; kick(); });
    }

    /* Card dei trattamenti: si inclinano verso il puntatore */
    const tilt = $('[data-tilt]');
    if (tilt && fine && !reduce) {
        tilt.addEventListener('pointermove', (e) => {
            const card = e.target.closest('.card');
            if (!card) return;
            const r = card.getBoundingClientRect();
            card.classList.add('is-tilting');
            card.style.setProperty('--ry', (((e.clientX - r.left) / r.width - 0.5) * 6).toFixed(2) + 'deg');
            card.style.setProperty('--rx', (-((e.clientY - r.top) / r.height - 0.5) * 6).toFixed(2) + 'deg');
        });
        tilt.addEventListener('pointerout', (e) => {
            const card = e.target.closest('.card');
            if (!card || card.contains(e.relatedTarget)) return;
            card.classList.remove('is-tilting');
            card.style.setProperty('--rx', '0deg');
            card.style.setProperty('--ry', '0deg');
        });
    }

    /* Trattamenti: schede, con l'indirizzo che ricorda quella aperta */
    const tabs = $$('.tab');
    if (tabs.length) {
        const panels = $$('.panel');
        const bar = $('.tabs__bar');
        let busy = false;
        const moveBar = (tab) => {
            if (!bar || !tab) return;
            bar.style.setProperty('--bar-y', (tab.getBoundingClientRect().top - tab.parentElement.getBoundingClientRect().top) + 'px');
            bar.style.setProperty('--bar-h', tab.offsetHeight + 'px');
        };
        const show = (name, animate) => {
            const tab = tabs.find((t) => t.dataset.tab === name);
            const next = panels.find((p) => p.dataset.panel === name);
            const current = panels.find((p) => !p.hidden);
            if (!tab || !next || next === current || busy) return;
            tabs.forEach((t) => { const on = t === tab; t.classList.toggle('is-active', on); t.setAttribute('aria-selected', String(on)); t.tabIndex = on ? 0 : -1; });
            moveBar(tab);
            /* su telefono le schede scorrono in orizzontale: porto in vista quella attiva */
            const strip = tab.parentElement;
            if (strip.scrollWidth > strip.clientWidth) strip.scrollTo({ left: tab.offsetLeft - 20, behavior: animate && !reduce ? 'smooth' : 'auto' });
            const swap = () => {
                if (current) { current.hidden = true; current.classList.remove('is-leaving'); }
                next.hidden = false;
                if (animate && !reduce) {
                    next.classList.add('is-entering');
                    setTimeout(() => next.classList.remove('is-entering'), 800);
                }
                busy = false;
            };
            if (current && animate && !reduce) { busy = true; current.classList.add('is-leaving'); setTimeout(swap, 160); }
            else swap();
        };
        tabs.forEach((t, i) => {
            t.addEventListener('click', () => { show(t.dataset.tab, true); history.replaceState(null, '', '#' + t.dataset.tab); });
            t.addEventListener('keydown', (e) => {
                const dir = (e.key === 'ArrowDown' || e.key === 'ArrowRight') ? 1 : (e.key === 'ArrowUp' || e.key === 'ArrowLeft') ? -1 : 0;
                if (!dir) return;
                e.preventDefault();
                const target = tabs[(i + dir + tabs.length) % tabs.length];
                target.focus(); target.click();
            });
        });
        const fromHash = () => { const n = location.hash.slice(1); if (tabs.some((t) => t.dataset.tab === n)) show(n, false); };
        fromHash();
        window.addEventListener('hashchange', fromHash);
        window.addEventListener('resize', () => moveBar(tabs.find((t) => t.classList.contains('is-active'))));
        moveBar(tabs.find((t) => t.classList.contains('is-active')));
        if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => moveBar(tabs.find((t) => t.classList.contains('is-active'))));
    }

    /* Anno nel footer */
    const year = $('[data-year]');
    if (year) year.textContent = String(new Date().getFullYear());

    /* Browser senza transizioni tra documenti: breve dissolvenza prima di cambiare pagina */
    if (!('CSSViewTransitionRule' in window) && !reduce) {
        document.addEventListener('click', (e) => {
            const a = e.target.closest('a[href]');
            if (!a || a.target === '_blank' || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
            const url = new URL(a.href, location.href);
            if (url.origin !== location.origin || url.pathname === location.pathname) return;
            e.preventDefault();
            document.body.classList.add('is-leaving');
            setTimeout(() => { location.href = a.href; }, 180);
        });
        window.addEventListener('pageshow', () => document.body.classList.remove('is-leaving'));
    }
})();
