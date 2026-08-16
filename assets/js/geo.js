/* ==========================================================================
   geo.js — geração do mapa territorial (diagrama de Voronoi recortado)
   Produz polígonos orgânicos para os bairros do município, sem dependências.
   ========================================================================== */
(function (global) {
  'use strict';
  const { rng } = global.U;

  /* ---- geometria básica ---- */
  const area = (p) => {
    let a = 0;
    for (let i = 0, j = p.length - 1; i < p.length; j = i++) a += p[j][0] * p[i][1] - p[i][0] * p[j][1];
    return a / 2;
  };
  const centroid = (p) => {
    let x = 0, y = 0, a = 0;
    for (let i = 0, j = p.length - 1; i < p.length; j = i++) {
      const f = p[j][0] * p[i][1] - p[i][0] * p[j][1];
      a += f;
      x += (p[j][0] + p[i][0]) * f;
      y += (p[j][1] + p[i][1]) * f;
    }
    a *= 3;
    return a ? [x / a, y / a] : p[0];
  };

  /* Sutherland–Hodgman: recorta polígono pelo semiplano f(p) <= 0 */
  function clipHalf(poly, f) {
    const out = [];
    for (let i = 0; i < poly.length; i++) {
      const A = poly[i], B = poly[(i + 1) % poly.length];
      const fa = f(A), fb = f(B);
      if (fa <= 0) out.push(A);
      if ((fa < 0 && fb > 0) || (fa > 0 && fb < 0)) {
        const t = fa / (fa - fb);
        out.push([A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t]);
      }
    }
    return out;
  }

  function convexHull(pts) {
    const p = pts.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
    const lower = [];
    for (const q of p) {
      while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], q) <= 0) lower.pop();
      lower.push(q);
    }
    const upper = [];
    for (let i = p.length - 1; i >= 0; i--) {
      const q = p[i];
      while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], q) <= 0) upper.pop();
      upper.push(q);
    }
    upper.pop();
    lower.pop();
    return lower.concat(upper);
  }

  function voronoi(seeds, boundary) {
    return seeds.map((s, i) => {
      let cell = boundary;
      for (let j = 0; j < seeds.length && cell.length; j++) {
        if (i === j) continue;
        const o = seeds[j];
        const dx = o[0] - s[0], dy = o[1] - s[1];
        const mx = (o[0] + s[0]) / 2, my = (o[1] + s[1]) / 2;
        cell = clipHalf(cell, (p) => (p[0] - mx) * dx + (p[1] - my) * dy);
      }
      return cell;
    });
  }

  /* suaviza cantos do polígono (chaikin) para aparência mais natural */
  function smooth(poly, iter) {
    let p = poly;
    for (let k = 0; k < (iter || 1); k++) {
      const out = [];
      for (let i = 0; i < p.length; i++) {
        const A = p[i], B = p[(i + 1) % p.length];
        out.push([A[0] * 0.78 + B[0] * 0.22, A[1] * 0.78 + B[1] * 0.22]);
        out.push([A[0] * 0.22 + B[0] * 0.78, A[1] * 0.22 + B[1] * 0.78]);
      }
      p = out;
    }
    return p;
  }

  const path = (p) => p.map((q, i) => (i ? 'L' : 'M') + q[0].toFixed(1) + ' ' + q[1].toFixed(1)).join(' ') + ' Z';

  /**
   * Gera o desenho do município: contorno + N células (bairros).
   * @returns {{outline:Array, outlinePath:string, cells:Array<{poly,path,center,area}>, w:number, h:number}}
   */
  function buildMunicipio(n, seed) {
    const r = rng(seed || 20261);
    const W = 900, H = 620, cx = W / 2, cy = H / 2;

    // contorno convexo orgânico
    const ring = [];
    for (let i = 0; i < 26; i++) {
      const a = (i / 26) * Math.PI * 2;
      const rad = 1 + 0.1 * Math.sin(a * 3 + 1.2) + 0.07 * Math.cos(a * 5) + (r() - 0.5) * 0.05;
      ring.push([cx + Math.cos(a) * 400 * rad, cy + Math.sin(a) * 272 * rad]);
    }
    const outline = convexHull(ring);

    // sementes dentro do contorno (rejeição) + relaxação de Lloyd
    let seeds = [];
    const inside = (p) => {
      for (let i = 0; i < outline.length; i++) {
        const A = outline[i], B = outline[(i + 1) % outline.length];
        if ((B[0] - A[0]) * (p[1] - A[1]) - (B[1] - A[1]) * (p[0] - A[0]) < 6) return false;
      }
      return true;
    };
    let guard = 0;
    while (seeds.length < n && guard++ < 20000) {
      const p = [40 + r() * (W - 80), 30 + r() * (H - 60)];
      if (inside(p) && seeds.every((s) => Math.hypot(s[0] - p[0], s[1] - p[1]) > 78)) seeds.push(p);
    }
    for (let k = 0; k < 3; k++) {
      seeds = voronoi(seeds, outline).map((c, i) => (c.length > 2 ? centroid(c) : seeds[i]));
    }

    const cells = voronoi(seeds, outline).map((c) => ({
      poly: c, path: path(c), center: centroid(c), area: Math.abs(area(c)),
    }));

    return { outline, outlinePath: path(outline), cells, w: W, h: H, seeds };
  }

  global.GEO = { buildMunicipio, centroid, path, voronoi, convexHull, smooth };
})(window);
