// Liquid-metal background: one full-screen fragment shader, no libraries.
// Scroll position feeds both the flow's time and its position.
// Stops drawing while the tab is hidden; falls back to the static CSS stage
// when WebGL is missing or motion is reduced (a single still frame is drawn).
(function () {
  const stage = document.querySelector('.stage');
  const canvas = document.createElement('canvas');
  canvas.className = 'liquid';
  const opts = { alpha: false, antialias: false, depth: false, stencil: false, premultipliedAlpha: false, powerPreference: 'low-power' };
  let gl = canvas.getContext('webgl2', opts);
  const isGL2 = !!gl;
  if (!gl) {
    gl = canvas.getContext('webgl', opts);
    if (!gl) return; // static CSS stays
  }

  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
  const coarse = matchMedia('(pointer: coarse)').matches;

  const FRAG = `
  uniform vec2 uRes;
  uniform float uTime;
  uniform float uScroll;   // smoothed, in viewport heights
  uniform float uVel;      // smoothed scroll velocity
  uniform vec2 uLight;     // slow drifting key light

  // 2D simplex noise (Ashima / Stefan Gustavson, MIT)
  vec3 permute(vec3 x) { return mod(((x * 34.0) + 1.0) * x, 289.0); }
  float snoise(vec2 v) {
    const vec4 C = vec4(0.211324865405187, 0.366025403784439, -0.577350269189626, 0.024390243902439);
    vec2 i = floor(v + dot(v, C.yy));
    vec2 x0 = v - i + dot(i, C.xx);
    vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
    vec4 x12 = x0.xyxy + C.xxzz;
    x12.xy -= i1;
    i = mod(i, 289.0);
    vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));
    vec3 m = max(0.5 - vec3(dot(x0, x0), dot(x12.xy, x12.xy), dot(x12.zw, x12.zw)), 0.0);
    m = m * m; m = m * m;
    vec3 x = 2.0 * fract(p * C.www) - 1.0;
    vec3 h = abs(x) - 0.5;
    vec3 a0 = x - floor(x + 0.5);
    m *= 1.79284291400159 - 0.85373472095314 * (a0 * a0 + h * h);
    vec3 g;
    g.x = a0.x * x0.x + h.x * x0.y;
    g.yz = a0.yz * x12.xz + h.yz * x12.yw;
    return 130.0 * dot(m, g);
  }

  const mat2 ROT = mat2(0.8, -0.6, 0.6, 0.8);
  float fbm(vec2 p) {
    float s = 0.0, a = 0.55;
    for (int i = 0; i < 3; i++) { s += a * snoise(p); p = ROT * p * 1.85 + 11.7; a *= 0.34; }
    return s;
  }

  // Studio environment seen in the metal: long soft boxes over a dark room.
  vec3 env(vec3 r) {
    float y = r.y, x = r.x;
    vec3 c = vec3(0.012, 0.013, 0.016) + vec3(0.07, 0.072, 0.08) * smoothstep(-0.9, 0.9, y);
    // overhead strip (crisp edge = metal, soft core = liquid)
    float top = abs(y - 0.30 - uLight.y * 0.08);
    c += vec3(1.0, 0.95, 0.88) * (smoothstep(0.075, 0.035, top) * 0.9 + smoothstep(0.30, 0.0, top) * 0.25);
    // cool side bar
    float side = abs(x + 0.34 + uLight.x * 0.10);
    c += vec3(0.62, 0.70, 0.84) * (smoothstep(0.06, 0.025, side) * 0.55 + smoothstep(0.25, 0.0, side) * 0.12) * smoothstep(-0.5, 0.4, y);
    // warm floor bounce
    c += vec3(0.62, 0.46, 0.30) * smoothstep(0.35, 0.0, abs(y + 0.45)) * 0.14;
    return c;
  }

  // thick, slow, folding flow (two-step domain warp) + a faint water ripple
  float height(vec2 q, float t) {
    vec2 w1 = vec2(fbm(q + vec2(0.0, t)), fbm(q + vec2(5.2, 1.3) - t * 0.8));
    vec2 w2 = vec2(fbm(q + 1.15 * w1 + vec2(1.7, 9.2) + t * 0.5), fbm(q + 1.15 * w1 + vec2(8.3, 2.8) - t * 0.45));
    float h = fbm(q + 1.0 * w2);
    float amp = 0.0035 + min(abs(uVel), 1.5) * 0.009;
    return h + sin(dot(q, vec2(7.0, 10.0)) * 1.7 + h * 9.0 - uTime * 0.5) * amp;
  }

  void main() {
    vec2 uv = gl_FragCoord.xy / uRes;
    float aspect = uRes.x / uRes.y;
    vec2 p = (uv - 0.5) * vec2(aspect, 1.0);

    float t = uTime * 0.04 + uScroll * 0.14;
    // position: the pool drifts up with the page, slower than the text
    vec2 q = p * 0.48 + vec2(0.0, uScroll * 0.26);

    // three height samples -> smooth analytic-looking normal at any resolution
    const float E = 0.0035;
    float h  = height(q, t);
    float hx = height(q + vec2(E, 0.0), t);
    float hy = height(q + vec2(0.0, E), t);
    float sl = 0.055 / E;
    vec3 n = normalize(vec3((h - hx) * sl, (h - hy) * sl, 1.0));

    vec3 v = vec3(0.0, 0.0, 1.0);
    vec3 r = reflect(-v, n);
    float fres = pow(1.0 - max(dot(n, v), 0.0), 3.0);

    vec3 metal = vec3(0.80, 0.80, 0.82);
    vec3 col = env(r) * metal;
    // faint thin-film tint at grazing angles (keeps it from reading as plain grey)
    vec3 film = 0.5 + 0.5 * cos(6.2831 * (fres * 1.4 + h * 0.6 + vec3(0.0, 0.33, 0.67)));
    col += film * fres * 0.10;
    col += vec3(0.9, 0.86, 0.8) * fres * 0.14;

    // deep folds go dark, crests catch light: liquid body
    col *= 0.45 + 0.8 * smoothstep(-0.6, 0.6, h);

    // keep it dim and soft under the text
    col = col / (1.0 + col * 0.9);
    col *= 0.62;
    float vig = smoothstep(1.25, 0.25, length(p * vec2(0.85, 1.0)));
    col *= mix(0.55, 1.0, vig);
    col = pow(col, vec3(0.92));

    // ordered dither to avoid banding in the dark range
    float d = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453) / 255.0;
    col += d;

    FRAGCOLOR = vec4(col, 1.0);
  }`;

  const VERT = isGL2
    ? '#version 300 es\nin vec2 a;void main(){gl_Position=vec4(a,0.,1.);}'
    : 'attribute vec2 a;void main(){gl_Position=vec4(a,0.,1.);}';
  const FRAG_SRC = isGL2
    ? '#version 300 es\nprecision highp float;\nout vec4 o;\n#define FRAGCOLOR o\n' + FRAG
    : 'precision highp float;\n#define FRAGCOLOR gl_FragColor\n' + FRAG;

  function compile(type, src) {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) { console.warn(gl.getShaderInfoLog(s)); return null; }
    return s;
  }
  const vs = compile(gl.VERTEX_SHADER, VERT);
  const fs = compile(gl.FRAGMENT_SHADER, FRAG_SRC);
  if (!vs || !fs) return;
  const prog = gl.createProgram();
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.bindAttribLocation(prog, 0, 'a');
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return;
  gl.useProgram(prog);

  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

  const U = {};
  for (const n of ['uRes', 'uTime', 'uScroll', 'uVel', 'uLight']) U[n] = gl.getUniformLocation(prog, n);

  stage.appendChild(canvas);

  // Render scale: the flow is soft, so a low-res buffer upscaled looks the same.
  // Pixel budget keeps phones and 5K screens equally cheap.
  let budget = coarse ? 160000 : 560000;
  let scale = 0.65;
  function resize() {
    scale = Math.min(0.7, Math.sqrt(budget / (innerWidth * innerHeight)));
    const w = Math.max(1, Math.round(innerWidth * scale));
    const h = Math.max(1, Math.round(Math.max(innerHeight, document.documentElement.clientHeight) * scale));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w; canvas.height = h;
      gl.viewport(0, 0, w, h);
      gl.uniform2f(U.uRes, w, h);
    }
  }
  resize();
  let rT;
  addEventListener('resize', () => { clearTimeout(rT); rT = setTimeout(resize, 150); }, { passive: true });

  // Scroll: smoothed so the liquid lags behind like something heavy.
  let target = scrollY / innerHeight, cur = target, vel = 0;
  addEventListener('scroll', () => { target = scrollY / innerHeight; }, { passive: true });

  const start = performance.now();
  let raf = 0, last = 0, shown = false;
  const minDt = coarse ? 1000 / 30 : 0;
  let slow = 0, frames = 0;

  function draw(now) {
    const dt = Math.min(0.1, (now - (last || now)) / 1000);
    last = now;
    const prev = cur;
    cur += (target - cur) * (1 - Math.exp(-dt * 3.2));
    const v = dt > 0 ? (cur - prev) / dt : 0;
    vel += (v - vel) * (1 - Math.exp(-dt * 4));
    const s = (now - start) / 1000;
    gl.uniform1f(U.uTime, s);
    gl.uniform1f(U.uScroll, cur);
    gl.uniform1f(U.uVel, vel);
    gl.uniform2f(U.uLight, Math.sin(s * 0.05), Math.cos(s * 0.037));
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    if (!shown) { shown = true; canvas.classList.add('is-on'); }
  }

  let prevTick = 0;
  function loop(now) {
    raf = requestAnimationFrame(loop);
    if (minDt && now - prevTick < minDt - 2) return;
    // adaptive quality: if frames stay slow, drop the buffer resolution once or twice
    if (prevTick) {
      const ft = now - prevTick;
      frames++;
      if (ft > (minDt || 16.7) * 1.6) slow++;
      if (frames === 90) {
        if (slow > 45 && budget > 60000) { budget *= 0.6; resize(); }
        frames = slow = 0;
      }
    }
    prevTick = now;
    draw(now);
  }

  function startLoop() {
    if (raf || document.hidden || reduce.matches) return;
    last = 0; prevTick = 0;
    raf = requestAnimationFrame(loop);
  }
  function stopLoop() { cancelAnimationFrame(raf); raf = 0; }

  document.addEventListener('visibilitychange', () => (document.hidden ? stopLoop() : startLoop()));
  reduce.addEventListener?.('change', () => {
    if (reduce.matches) { stopLoop(); draw(performance.now()); } else startLoop();
  });
  canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); stopLoop(); canvas.remove(); });

  if (reduce.matches) {
    // still frame, scroll-independent
    target = cur = 0;
    draw(start + 40000);
  } else {
    draw(performance.now()); // first frame even if the tab opens in the background
    startLoop();
  }
})();
