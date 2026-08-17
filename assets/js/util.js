/* ==========================================================================
   util.js — utilitários gerais (DOM, formatação, armazenamento, aleatório)
   ========================================================================== */
(function (global) {
  'use strict';
  global.VIEWS = global.VIEWS || {};

  /* ---------- DOM ---------- */
  const $ = (sel, ctx) => (ctx || document).querySelector(sel);
  const $$ = (sel, ctx) => Array.from((ctx || document).querySelectorAll(sel));

  function el(tag, attrs, children) {
    const node = document.createElement(tag);
    if (attrs) {
      for (const k in attrs) {
        const v = attrs[k];
        if (v === null || v === undefined || v === false) continue;
        if (k === 'class') node.className = v;
        else if (k === 'html') node.innerHTML = v;
        else if (k === 'text') node.textContent = v;
        else if (k === 'style' && typeof v === 'object') Object.assign(node.style, v);
        else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2), v);
        else if (k === 'dataset') Object.assign(node.dataset, v);
        else node.setAttribute(k, v);
      }
    }
    (Array.isArray(children) ? children : children ? [children] : []).forEach((c) => {
      if (c === null || c === undefined || c === false) return;
      node.appendChild(typeof c === 'string' || typeof c === 'number' ? document.createTextNode(String(c)) : c);
    });
    return node;
  }

  const svg = (tag, attrs) => {
    const n = document.createElementNS('http://www.w3.org/2000/svg', tag);
    for (const k in attrs || {}) {
      if (attrs[k] === null || attrs[k] === undefined) continue;
      n.setAttribute(k, attrs[k]);
    }
    return n;
  };

  const esc = (s) =>
    String(s === null || s === undefined ? '' : s).replace(/[&<>"']/g, (c) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])
    );

  /* ---------- Números e datas ---------- */
  const nf = new Intl.NumberFormat('pt-BR');
  const nf1 = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const cf = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

  const num = (n) => nf.format(Math.round(n || 0));
  const dec = (n) => nf1.format(n || 0);
  const money = (n) => cf.format(n || 0);
  const moneyShort = (n) => {
    const v = Math.abs(n || 0);
    if (v >= 1e6) return 'R$ ' + dec(n / 1e6) + ' mi';
    if (v >= 1e3) return 'R$ ' + dec(n / 1e3) + ' mil';
    return money(n);
  };
  const pct = (a, b) => (!b ? 0 : Math.round((a / b) * 100));
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
  const DIAS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];

  const toDate = (d) => (d instanceof Date ? d : new Date(d + (String(d).length === 10 ? 'T12:00:00' : '')));
  const iso = (d) => toDate(d).toISOString().slice(0, 10);
  const fmtDate = (d) => {
    const x = toDate(d);
    return String(x.getDate()).padStart(2, '0') + '/' + String(x.getMonth() + 1).padStart(2, '0') + '/' + x.getFullYear();
  };
  const fmtDateShort = (d) => {
    const x = toDate(d);
    return String(x.getDate()).padStart(2, '0') + ' ' + MESES[x.getMonth()];
  };
  const fmtWeekday = (d) => DIAS[toDate(d).getDay()];
  const addDays = (d, n) => {
    const x = new Date(toDate(d).getTime());
    x.setDate(x.getDate() + n);
    return x;
  };
  const daysBetween = (a, b) => Math.round((toDate(b) - toDate(a)) / 86400000);
  const relDays = (d) => {
    const n = daysBetween(new Date(), d);
    if (n === 0) return 'hoje';
    if (n === 1) return 'amanhã';
    if (n === -1) return 'ontem';
    return n > 0 ? 'em ' + n + ' dias' : 'há ' + -n + ' dias';
  };

  /* ---------- Coleções ---------- */
  const by = (arr, key) => {
    const m = new Map();
    arr.forEach((it) => {
      const k = typeof key === 'function' ? key(it) : it[key];
      if (!m.has(k)) m.set(k, []);
      m.get(k).push(it);
    });
    return m;
  };
  const countBy = (arr, key) => {
    const m = new Map();
    arr.forEach((it) => {
      const k = typeof key === 'function' ? key(it) : it[key];
      m.set(k, (m.get(k) || 0) + 1);
    });
    return m;
  };
  const sum = (arr, f) => arr.reduce((a, b) => a + (f ? f(b) : b) || 0, 0);
  const sortBy = (arr, f, dir) => arr.slice().sort((a, b) => ((f(a) > f(b) ? 1 : f(a) < f(b) ? -1 : 0) * (dir === 'desc' ? -1 : 1)));
  const uniq = (a) => Array.from(new Set(a));
  const norm = (s) => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const initials = (nome) => {
    const p = String(nome).trim().split(/\s+/);
    return ((p[0] || '')[0] + (p.length > 1 ? p[p.length - 1][0] : '')).toUpperCase();
  };

  /* ---------- Aleatório determinístico ---------- */
  function rng(seed) {
    let a = seed >>> 0;
    return function () {
      a |= 0;
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const pick = (r, arr) => arr[Math.floor(r() * arr.length)];
  const pickW = (r, arr, weights) => {
    const total = weights.reduce((a, b) => a + b, 0);
    let x = r() * total;
    for (let i = 0; i < arr.length; i++) {
      x -= weights[i];
      if (x <= 0) return arr[i];
    }
    return arr[arr.length - 1];
  };
  const int = (r, a, b) => a + Math.floor(r() * (b - a + 1));

  /* ---------- Armazenamento ---------- */
  const store = {
    get(k, def) {
      try {
        const v = localStorage.getItem('sigc.' + k);
        return v === null ? def : JSON.parse(v);
      } catch (e) {
        return def;
      }
    },
    set(k, v) {
      try {
        localStorage.setItem('sigc.' + k, JSON.stringify(v));
      } catch (e) {}
    },
    del(k) {
      try {
        localStorage.removeItem('sigc.' + k);
      } catch (e) {}
    },
  };

  /* ---------- Feedback ---------- */
  let toastTimer;
  function toast(msg, kind) {
    let box = $('#toast');
    if (!box) {
      box = el('div', { id: 'toast', class: 'toast' });
      document.body.appendChild(box);
    }
    box.className = 'toast show ' + (kind || 'ok');
    box.innerHTML = '<span class="toast-dot"></span><span>' + esc(msg) + '</span>';
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => box.classList.remove('show'), 3200);
  }

  function modal(title, content, opts) {
    opts = opts || {};
    const back = el('div', { class: 'modal-back' });
    const box = el('div', { class: 'modal' + (opts.wide ? ' wide' : '') });
    const head = el('div', { class: 'modal-head' }, [
      el('h3', { text: title }),
      el('button', { class: 'icon-btn', html: '&times;', onclick: close, title: 'Fechar' }),
    ]);
    const body = el('div', { class: 'modal-body' });
    if (typeof content === 'string') body.innerHTML = content;
    else body.appendChild(content);
    box.appendChild(head);
    box.appendChild(body);
    if (opts.footer) box.appendChild(el('div', { class: 'modal-foot' }, opts.footer));
    back.appendChild(box);
    back.addEventListener('mousedown', (e) => {
      if (e.target === back) close();
    });
    document.body.appendChild(back);
    requestAnimationFrame(() => back.classList.add('show'));
    function close() {
      back.classList.remove('show');
      setTimeout(() => back.remove(), 200);
      document.removeEventListener('keydown', onKey);
    }
    function onKey(e) {
      if (e.key === 'Escape') close();
    }
    document.addEventListener('keydown', onKey);
    return { close, body, box };
  }

  /** copia texto com reserva para quando a API moderna falha (ex.: "Document is not focused") */
  function copiarTexto(texto) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(texto).catch(() => copiarViaTextarea(texto));
    }
    return copiarViaTextarea(texto);
  }
  function copiarViaTextarea(texto) {
    return new Promise((resolve, reject) => {
      const ta = document.createElement('textarea');
      ta.value = texto;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      try {
        const ok = document.execCommand('copy');
        ta.remove();
        ok ? resolve() : reject(new Error('execCommand falhou'));
      } catch (e) {
        ta.remove();
        reject(e);
      }
    });
  }

  const debounce = (fn, ms) => {
    let t;
    return function () {
      const args = arguments;
      clearTimeout(t);
      t = setTimeout(() => fn.apply(null, args), ms || 220);
    };
  };

  /* ---------- Escalas / cores ---------- */
  function lerpColor(a, b, t) {
    const pa = a.match(/\w\w/g).map((h) => parseInt(h, 16));
    const pb = b.match(/\w\w/g).map((h) => parseInt(h, 16));
    const p = pa.map((v, i) => Math.round(v + (pb[i] - v) * t));
    return 'rgb(' + p.join(',') + ')';
  }
  function scaleColor(t, stops) {
    t = clamp(t, 0, 1);
    const s = stops || ['#f2f7f5', '#c3e5d7', '#5cbf9c', '#0b6b52'];
    const seg = 1 / (s.length - 1);
    const i = Math.min(s.length - 2, Math.floor(t / seg));
    return lerpColor(s[i].replace('#', ''), s[i + 1].replace('#', ''), (t - i * seg) / seg);
  }

  global.U = {
    $, $$, el, svg, esc,
    num, dec, money, moneyShort, pct, clamp,
    toDate, iso, fmtDate, fmtDateShort, fmtWeekday, addDays, daysBetween, relDays, MESES, DIAS,
    by, countBy, sum, sortBy, uniq, norm, initials,
    rng, pick, pickW, int,
    store, toast, modal, debounce, lerpColor, scaleColor, copiarTexto,
  };
})(window);
