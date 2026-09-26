/* A small software 3D renderer: etched metal, suspended capstone, and an eye.
 * No imports, storage, URL access, network, or interaction with page controls.
 * The server-rendered SVG remains visible if enhancement is unavailable. */
(() => {
  'use strict';
  const hosts = document.querySelectorAll('[data-sigil-scene]');
  if (!hosts.length || !window.requestAnimationFrame) return;
  const TAU = Math.PI * 2;
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
  const rgba = (c, a = 1) => `rgba(${c.map(x => Math.round(clamp(x, 0, 255))).join(',')},${a})`;
  const noise = n => { const v = Math.sin(n * 127.1 + 311.7) * 43758.5453; return v - Math.floor(v); };
  const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const scheme = window.matchMedia('(prefers-color-scheme: dark)');

  for (const host of hosts) {
    const canvas = host.querySelector('[data-sigil-canvas]');
    const motionButton = host.querySelector('[data-sigil-motion]');
    if (!canvas) continue;
    let ctx;
    try { ctx = canvas.getContext('2d', { alpha: true }); } catch (_) { continue; }
    if (!ctx) continue;
    const quiet = host.dataset.sigilQuiet === 'true';
    let width = 0, height = 0, scale = 1, cx = 0, cy = 0;
    let frame = 0, last = 0, time = 0, stopped = false, lost = false, visible = true;
    let yaw = -.37, pitch = .15, bob = 0;
    let pointer = 0, targetPointer = 0;
    let dark = false;
    let userPaused = false;
    let palette;
    const listeners = [];
    const listen = (target, event, handler, options) => {
      target.addEventListener(event, handler, options);
      listeners.push(() => target.removeEventListener(event, handler, options));
    };
    const triangles = [];
    const facePoint = (face, u, y) => {
      const r = (1.6 - y) * .52;
      if (face === 0) return [u * r, y, r];
      if (face === 1) return [r, y, -u * r];
      if (face === 2) return [-u * r, y, -r];
      return [-r, y, u * r];
    };
    // Persistent mesh: two triangles per metal panel, four sides, 12 courses.
    for (let face = 0; face < 4; face++) {
      for (let row = 0; row < 12; row++) {
        const y0 = -1.18 + row * 2.21 / 12, y1 = -1.18 + (row + 1) * 2.21 / 12;
        for (let col = 0; col < 8; col++) {
          const u0 = -1 + col / 4, u1 = -1 + (col + 1) / 4;
          const a = facePoint(face, u0, y0), b = facePoint(face, u1, y0);
          const c = facePoint(face, u1, y1), d = facePoint(face, u0, y1);
          for (const points of [[a, b, c], [a, c, d]]) {
            triangles.push({ points, face, value: noise(triangles.length), y: (y0 + y1) / 2, x: (u0 + u1) / 2 });
          }
        }
      }
    }
    const project = (p, floating = true) => {
      const x = p[0] * Math.cos(yaw) + p[2] * Math.sin(yaw);
      const z = -p[0] * Math.sin(yaw) + p[2] * Math.cos(yaw);
      const y = (p[1] + (floating ? bob : 0)) * Math.cos(pitch) - z * Math.sin(pitch);
      const depth = z * Math.cos(pitch) + p[1] * Math.sin(pitch);
      const perspective = 7 / (7 - depth);
      return [cx + x * scale * perspective, cy - y * scale * perspective, depth];
    };
    const path = (points, close = false) => {
      ctx.beginPath();
      points.forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]));
      if (close) ctx.closePath();
    };
    const line = (points, color, thickness = 1, close = false) => {
      path(points, close); ctx.strokeStyle = color; ctx.lineWidth = thickness; ctx.stroke();
    };
    const polygon = (points, color) => { path(points, true); ctx.fillStyle = color; ctx.fill(); };
    const circle = (x, y, radius, color) => {
      ctx.beginPath(); ctx.arc(x, y, radius, 0, TAU); ctx.fillStyle = color; ctx.fill();
    };
    const theme = () => {
      if (stopped) return;
      try {
        // Resolve CSS color spaces through a single canvas pixel, only on theme
        // changes; no images are drawn, so this cannot sample external content.
        const sample = document.createElement('canvas');
        sample.width = sample.height = 1;
        const s = sample.getContext('2d', { willReadFrequently: true });
        s.fillStyle = getComputedStyle(document.body).backgroundColor;
        s.fillRect(0, 0, 1, 1);
        const c = s.getImageData(0, 0, 1, 1).data;
        dark = c[0] * .2126 + c[1] * .7152 + c[2] * .0722 < 140;
      } catch (_) { dark = scheme.matches; }
      palette = dark ? {
        ink: [204, 215, 210], metal: [35, 51, 54], shade: [12, 21, 26],
        gold: [207, 172, 116], pale: [246, 229, 189], cool: [102, 145, 148],
        light: [231, 233, 217]
      } : {
        ink: [47, 64, 62], metal: [65, 79, 76], shade: [19, 34, 37],
        gold: [151, 117, 68], pale: [241, 221, 172], cool: [113, 145, 140],
        light: [239, 232, 208]
      };
      requestPaint();
    };
    const size = () => {
      if (stopped || lost) return;
      const rect = host.getBoundingClientRect();
      width = Math.max(1, rect.width); height = Math.max(1, rect.height);
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5, Math.sqrt(1800000 / (width * height)));
      canvas.width = Math.round(width * dpr); canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      scale = Math.min(width, height) * (quiet ? .171 : .177);
      cx = width * .5; cy = height * .505;
      requestPaint();
    };
    const chart = () => {
      const radius = scale * 2.18;
      const halo = ctx.createRadialGradient(cx, cy - scale * .35, 0, cx, cy, radius * 1.4);
      halo.addColorStop(0, rgba(palette.gold, dark ? .105 : .08));
      halo.addColorStop(.5, rgba(palette.cool, dark ? .06 : .025));
      halo.addColorStop(1, rgba(palette.gold, 0));
      ctx.fillStyle = halo; ctx.fillRect(0, 0, width, height);
      for (const [factor, alpha] of [[1, .2], [1.018, .075], [.91, .08]]) {
        ctx.beginPath(); ctx.arc(cx, cy, radius * factor, 0, TAU);
        ctx.strokeStyle = rgba(palette.ink, alpha); ctx.lineWidth = .6; ctx.stroke();
      }
      for (let i = 0; i < 120; i++) {
        const a = i / 120 * TAU;
        const inner = radius + (i % 10 === 0 ? -8 : -3);
        line([[cx + Math.cos(a) * inner, cy + Math.sin(a) * inner],
          [cx + Math.cos(a) * radius, cy + Math.sin(a) * radius]], rgba(palette.ink, i % 10 === 0 ? .36 : .16), .7);
      }
      for (const a of [0, Math.PI / 2, Math.PI, Math.PI * 1.5]) {
        const x = cx + Math.cos(a) * (radius + 13), y = cy + Math.sin(a) * (radius + 13);
        line([[x - 3, y], [x + 3, y]], rgba(palette.ink, .45), .6);
        line([[x, y - 3], [x, y + 3]], rgba(palette.ink, .45), .6);
      }
      for (let i = 0; i < (quiet ? 30 : 65); i++) {
        const a = noise(i + 400) * TAU, r = radius * (.52 + noise(i + 600) * .65);
        const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r * .91;
        circle(x, y, i % 9 === 0 ? 1.2 : .55, rgba(palette.ink, .1 + noise(i) * .22));
      }
    };
    const orbit = (front) => {
      const points = [];
      for (let i = 0; i <= 220; i++) {
        const a = i / 220 * TAU;
        const p = [Math.cos(a) * 2.35, Math.sin(a) * .65 - .04, Math.sin(a) * 1.8];
        const projected = project(p, false);
        const isFront = projected[2] > 1.36;
        if (front === isFront) points.push(projected);
        else if (points.length) { line(points, rgba(palette.gold, front ? .5 : .28), .65); points.length = 0; }
      }
      if (points.length) line(points, rgba(palette.gold, front ? .5 : .28), .65);
      if (!front) {
        const a = time * .065 + 1.2;
        const p = project([Math.cos(a) * 2.35, Math.sin(a) * .65 - .04, Math.sin(a) * 1.8], false);
        circle(p[0], p[1], 2.3, rgba(palette.gold, .9));
        circle(p[0], p[1], 5, rgba(palette.gold, .1));
      }
    };
    const floor = () => {
      const center = project([0, -1.69, 0], false);
      ctx.save(); ctx.translate(center[0], center[1]); ctx.scale(1, .23);
      const shadow = ctx.createRadialGradient(0, 0, 0, 0, 0, scale * 1.9);
      shadow.addColorStop(0, rgba(palette.shade, dark ? .52 : .25));
      shadow.addColorStop(.48, rgba(palette.shade, dark ? .19 : .1));
      shadow.addColorStop(1, rgba(palette.shade, 0));
      ctx.fillStyle = shadow; ctx.fillRect(-scale * 2, -scale * 2, scale * 4, scale * 4);
      ctx.restore();
      for (const r of [1.52, 1.62, 2.05]) {
        const points = [];
        for (let i = 0; i <= 100; i++) points.push(project([Math.cos(i / 100 * TAU) * r, -1.69, Math.sin(i / 100 * TAU) * r], false));
        line(points, rgba(palette.ink, r === 1.62 ? .14 : .06), .6);
      }
      // Faint vertical suspension line and the capstone's warm light shaft.
      const top = project([0, 1.9, 0]);
      line([[top[0], cy - scale * 2.4], [top[0], top[1] - 18]], rgba(palette.gold, .24), .65);
      const glint = ctx.createRadialGradient(top[0], top[1] + scale * .44, 0, top[0], top[1] + scale * .44, scale * .8);
      glint.addColorStop(0, rgba(palette.gold, .16)); glint.addColorStop(1, rgba(palette.gold, 0));
      ctx.fillStyle = glint; ctx.fillRect(top[0] - scale, top[1] - scale * .6, scale * 2, scale * 2);
    };
    const body = () => {
      const visibleFaces = [Math.cos(yaw), -Math.sin(yaw), -Math.cos(yaw), Math.sin(yaw)];
      const mesh = triangles.filter(t => visibleFaces[t.face] > .02).map(t => ({ ...t, projected: t.points.map(p => project(p)) }));
      mesh.sort((a, b) => a.projected.reduce((n, p) => n + p[2], 0) - b.projected.reduce((n, p) => n + p[2], 0));
      for (const triangle of mesh) {
        const { face, y, x, value, projected } = triangle;
        const light = clamp(.15 + visibleFaces[face] * .43 + y * .06 + (value - .5) * .12, 0, 1);
        let color = mix(palette.shade, palette.metal, light);
        const reflection = Math.pow(Math.max(0, 1 - Math.abs(x + .25 + Math.sin(time * .15) * .12)), 7);
        color = mix(color, face === 0 ? palette.cool : palette.gold, reflection * (face === 0 ? .46 : .23));
        color = mix(color, palette.gold, Math.max(0, y) * .06);
        polygon(projected, rgba(color));
        line(projected, rgba(mix(color, palette.pale, .18), .23), .4, true);
      }
      // Machined courses, perimeter bevels, and fine etched front-face geometry.
      for (let face = 0; face < 4; face++) {
        if (visibleFaces[face] <= .02) continue;
        for (let row = 0; row <= 12; row++) {
          const y = -1.18 + row * 2.21 / 12;
          line([project(facePoint(face, -1, y)), project(facePoint(face, 1, y))], rgba(palette.gold, row % 3 === 0 ? .23 : .11), row % 3 === 0 ? .75 : .45);
        }
        const corners = [[-1, -1.18], [1, -1.18], [1, 1.03], [-1, 1.03]].map(([u, y]) => project(facePoint(face, u, y)));
        line(corners, rgba(palette.gold, .67), 1, true);
        const p0 = facePoint(face, -.975, -1.13), p1 = facePoint(face, -.975, .99);
        line([project(p0), project(p1)], rgba(palette.pale, .25), .6);
      }
      const front = (x, y, depth = .018) => project([x, y, (1.6 - y) * .52 + depth]);
      line([[0, .88], [-.97, -.93], [.97, -.93]].map(([x, y]) => front(x, y)), rgba(palette.gold, .23), .7, true);
      line([[0, .77], [-.85, -.87], [.85, -.87]].map(([x, y]) => front(x, y)), rgba(palette.gold, .13), .5, true);
      for (let i = 0; i < 19; i++) {
        const x = -.97 + i * .108, y = -1.065;
        line([front(x, y), front(x, y + (i % 3 === 0 ? .043 : .023))], rgba(palette.pale, .43), .6);
      }
      for (let i = 0; i < 170; i++) {
        const y = -1.13 + noise(i + 33) * 2.1, r = (1.6 - y) * .49;
        const x = (noise(i + 85) * 2 - 1) * r, p = front(x, y);
        circle(p[0], p[1], .4, rgba(palette.pale, .11 + noise(i) * .15));
      }
      eye(front);
      capstone();
    };
    const eye = front => {
      const eyeY = .12;
      const almond = (factor, offset = 0) => {
        const points = [];
        for (let i = 0; i <= 48; i++) {
          const u = -1 + i / 24;
          points.push(front(u * .65 * factor, eyeY + (1 - u * u) * .27 * factor + offset, .052));
        }
        for (let i = 48; i >= 0; i--) {
          const u = -1 + i / 24;
          points.push(front(u * .65 * factor, eyeY - (1 - u * u) * .23 * factor + offset, .052));
        }
        return points;
      };
      polygon(almond(1.2, -.02), rgba(palette.shade));
      line(almond(1.18), rgba(palette.gold, .7), 1.1, true);
      line(almond(1.105), rgba(palette.pale, .33), .7, true);
      const left = front(-.7, eyeY), right = front(.7, eyeY);
      const enamel = ctx.createLinearGradient(left[0], left[1] - scale * .25, right[0], right[1] + scale * .25);
      enamel.addColorStop(0, rgba(palette.pale)); enamel.addColorStop(.45, rgba(palette.light)); enamel.addColorStop(1, rgba(mix(palette.cool, palette.gold, .3)));
      polygon(almond(1), enamel);
      line(almond(1), rgba(palette.gold), 1.7, true);
      const irisX = pointer * .022;
      const iris = (r, angle) => front(irisX + Math.cos(angle) * r, eyeY + Math.sin(angle) * r, .075);
      const disc = r => Array.from({ length: 97 }, (_, i) => iris(r, i / 96 * TAU));
      polygon(disc(.225), rgba(palette.shade));
      polygon(disc(.199), rgba(palette.gold));
      line(disc(.211), rgba(palette.pale, .8), .7, true);
      for (let i = 0; i < 112; i++) {
        const angle = i / 112 * TAU;
        line([iris(.085 + noise(i + 900) * .03, angle), iris(.19 - noise(i + 1200) * .02, angle + .08)],
          rgba(i % 3 === 0 ? palette.pale : palette.shade, .38 + noise(i) * .45), i % 4 === 0 ? 1 : .6);
      }
      line(disc(.131), rgba(palette.pale, .36), .55, true);
      polygon(disc(.091), rgba([9, 17, 20]));
      line(disc(.098), rgba(palette.pale, .6), .7, true);
      const highlight = iris(.105, 2.1);
      circle(highlight[0], highlight[1], scale * .025, rgba([255, 249, 226], .94));
      for (const side of [-1, 1]) {
        for (let i = 0; i < 3; i++) {
          line([front(side * (.75 + i * .065), eyeY - .02), front(side * (.77 + i * .065), eyeY + .04)], rgba(palette.gold, .67), .7);
        }
      }
    };
    const capstone = () => {
      const lift = .2 + Math.sin(time * .38) * .02;
      const r = (1.6 - 1.03) * .52;
      const apex = [0, 1.6 + lift, 0];
      const corners = [[-r, 1.03 + lift, r], [r, 1.03 + lift, r], [r, 1.03 + lift, -r], [-r, 1.03 + lift, -r]];
      const faces = corners.map((p, i) => [p, corners[(i + 1) % 4], apex].map(v => project(v)));
      faces.sort((a, b) => a.reduce((n, p) => n + p[2], 0) - b.reduce((n, p) => n + p[2], 0));
      faces.forEach((points, i) => {
        const grad = ctx.createLinearGradient(points[2][0], points[2][1], points[0][0], points[0][1]);
        grad.addColorStop(0, rgba(palette.pale)); grad.addColorStop(.38, rgba(mix(palette.gold, palette.pale, .23))); grad.addColorStop(1, rgba(mix(palette.shade, palette.gold, .45 + i * .12)));
        polygon(points, grad); line(points, rgba(palette.pale, .8), .8, true);
        const mid = [(points[0][0] + points[1][0]) / 2, (points[0][1] + points[1][1]) / 2];
        line([mid, points[2]], rgba(palette.shade, .18), .7);
      });
      const tip = project(apex);
      circle(tip[0], tip[1], 1.5, rgba(palette.pale, .95));
    };
    const paint = () => {
      if (stopped || lost || !width || !height || !palette) return;
      try {
        ctx.clearRect(0, 0, width, height);
        pointer += (targetPointer - pointer) * .04;
        yaw = -.37 + Math.sin(time * .19) * (quiet ? .045 : .12) + pointer * .035;
        pitch = .15 + Math.sin(time * .13) * .018;
        bob = Math.sin(time * .6) * (quiet ? .023 : .055);
        chart(); floor(); orbit(false); body(); orbit(true);
        host.setAttribute('data-sigil-ready', '');
      } catch (_) { dispose(); }
    };
    const tick = now => {
      frame = 0;
      if (stopped || lost || document.hidden || !visible) return;
      if (!last || now - last >= (quiet ? 50 : 33)) {
        if (last) time += Math.min(now - last, 100) / 1000;
        last = now; paint();
      }
      if (!motion.matches && !userPaused && !stopped) frame = requestAnimationFrame(tick);
    };
    function requestPaint() {
      if (frame || stopped || lost || document.hidden || !visible) return;
      last = 0; frame = requestAnimationFrame(tick);
    }
    const pause = () => { if (frame) cancelAnimationFrame(frame); frame = 0; last = 0; };
    let resizeObserver, intersectionObserver, themeObserver;
    function dispose() {
      if (stopped) return;
      stopped = true; pause();
      listeners.forEach(remove => remove());
      resizeObserver?.disconnect(); intersectionObserver?.disconnect(); themeObserver?.disconnect();
      host.removeAttribute('data-sigil-ready');
      if (motionButton) motionButton.hidden = true;
      canvas.width = canvas.height = 1;
    }
    listen(document, 'visibilitychange', () => document.hidden ? pause() : requestPaint());
    listen(window, 'pagehide', event => event.persisted ? pause() : dispose());
    listen(window, 'pageshow', () => requestPaint());
    const syncMotion = () => {
      if (motionButton) motionButton.hidden = motion.matches || lost;
      pause(); requestPaint();
    };
    listen(motion, 'change', syncMotion);
    if (motionButton) {
      motionButton.hidden = motion.matches;
      listen(motionButton, 'click', () => {
        userPaused = !userPaused;
        motionButton.textContent = userPaused ? 'Resume animation' : 'Pause animation';
        pause(); requestPaint();
      });
    }
    listen(scheme, 'change', theme);
    listen(document, 'themechange', theme);
    listen(canvas, 'contextlost', event => {
      event.preventDefault(); lost = true; pause(); host.removeAttribute('data-sigil-ready');
      if (motionButton) motionButton.hidden = true;
    });
    listen(canvas, 'contextrestored', () => { lost = false; size(); theme(); syncMotion(); });
    if (!quiet) listen(window, 'pointermove', event => {
      if (!motion.matches) targetPointer = clamp(event.clientX / Math.max(window.innerWidth, 1) * 2 - 1, -1, 1);
    }, { passive: true });
    if (window.ResizeObserver) {
      resizeObserver = new ResizeObserver(size); resizeObserver.observe(host);
    } else listen(window, 'resize', size, { passive: true });
    if (window.IntersectionObserver) {
      intersectionObserver = new IntersectionObserver(entries => {
        visible = entries[0]?.isIntersecting !== false;
        if (visible) requestPaint(); else pause();
      });
      intersectionObserver.observe(host);
    }
    if (window.MutationObserver) {
      themeObserver = new MutationObserver(theme);
      themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    }
    // Yield until after other deferred scripts (especially unsubscribe POST).
    size(); theme();
  }
})();
