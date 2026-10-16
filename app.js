/* Mi jardín mágico — juego para bebés (iPad iOS 12+, funciona sin internet).
   JavaScript clásico (ES5) para que funcione en el Safari de iOS 12. Sonidos muy suaves. */
(function () {
'use strict';
function R(a, b) { return a + Math.random() * (b - a); }
function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
function $(id) { return document.getElementById(id); }
function dist(ax, ay, bx, by) { var dx = ax - bx, dy = ay - by; return Math.sqrt(dx * dx + dy * dy); }
var KW = 1024, KH = 1536;           // espacio de coordenadas de los dibujos


/* ------------------------------------------------------------------ AUDIO (todo sintetizado, sin archivos) */
var AC = null, master = null, noiseBuf = null, muted = false, waterNode = null;

function initAudio() {
  if (AC) return;
  var C = window.AudioContext || window.webkitAudioContext;
  if (!C) return;
  try {
    AC = new C();
    master = AC.createGain(); master.gain.value = muted ? 0 : 0.7;
    var comp = AC.createDynamicsCompressor();
    master.connect(comp); comp.connect(AC.destination);
    var len = AC.sampleRate * 2, b = AC.createBuffer(1, len, AC.sampleRate), d = b.getChannelData(0);
    for (var i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    noiseBuf = b;
  } catch (e) { AC = null; }
}
function unlockAudio() {
  initAudio();
  if (!AC) return;
  if (AC.state !== 'running' && AC.resume) { try { AC.resume(); } catch (e) {} }
  try { var s = AC.createBufferSource(); s.buffer = AC.createBuffer(1, 1, 22050); s.connect(AC.destination); s.start(0); } catch (e) {}
}
/* nota con glide: pts = [[segundos, Hz], ...] */
function note(o) {
  if (!AC || muted) return;
  var t0 = AC.currentTime + (o.delay || 0), dur = o.dur || 0.3, vol = o.vol || 0.2;
  var osc = AC.createOscillator(), g = AC.createGain(), out = g;
  osc.type = o.type || 'sine';
  var pts = o.f;
  osc.frequency.setValueAtTime(pts[0][1], t0);
  for (var i = 1; i < pts.length; i++) osc.frequency.exponentialRampToValueAtTime(Math.max(20, pts[i][1]), t0 + pts[i][0]);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(vol, t0 + Math.min(0.03, dur * 0.25));
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g);
  if (o.lp) { var f = AC.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = o.lp; g.connect(f); out = f; }
  out.connect(master);
  if (o.vib) {
    var l = AC.createOscillator(), lg = AC.createGain();
    l.frequency.value = o.vib[0]; lg.gain.value = o.vib[1];
    l.connect(lg); lg.connect(osc.frequency); l.start(t0); l.stop(t0 + dur + 0.05);
  }
  osc.start(t0); osc.stop(t0 + dur + 0.05);
}
function noiseBurst(o) {
  if (!AC || muted || !noiseBuf) return;
  var t0 = AC.currentTime + (o.delay || 0), dur = o.dur || 0.1;
  var s = AC.createBufferSource(); s.buffer = noiseBuf; s.loop = true;
  var f = AC.createBiquadFilter(); f.type = o.type || 'bandpass'; f.frequency.setValueAtTime(o.f || 1500, t0); f.Q.value = o.q || 1;
  if (o.fEnd) f.frequency.exponentialRampToValueAtTime(o.fEnd, t0 + dur);
  var g = AC.createGain();
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(o.vol || 0.1, t0 + Math.min(0.02, dur * 0.3));
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  s.connect(f); f.connect(g); g.connect(master);
  s.start(t0, Math.random() * 1.5); s.stop(t0 + dur + 0.05);
}
function sfxPop(small) {
  var f = small ? R(1300, 2400) : R(600, 1300);
  note({ f: [[0, f], [0.07, f * 1.7]], dur: small ? 0.07 : 0.1, vol: small ? 0.07 : 0.1, type: 'sine' });
}
function sfxSelect(p) {
  note({ f: [[0, p], [0.12, p * 1.5]], dur: 0.22, vol: 0.16, type: 'sine' });
  note({ f: [[0, p * 2], [0.12, p * 3]], dur: 0.18, vol: 0.05, type: 'triangle', delay: 0.04 });
}
function sfxChime(i, vol) {
  var sc = [784, 880, 988, 1175, 1319, 1568, 1760];
  var f = sc[i % sc.length];
  note({ f: [[0, f], [0.9, f]], dur: 0.9, vol: vol || 0.12, type: 'sine' });
  note({ f: [[0, f * 2], [0.5, f * 2]], dur: 0.5, vol: (vol || 0.12) * 0.35, type: 'sine' });
}
function startWater() {
  if (!AC || muted || waterNode) return;
  var s = AC.createBufferSource(); s.buffer = noiseBuf; s.loop = true;
  var f = AC.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 3200; f.Q.value = 0.6;
  var f2 = AC.createBiquadFilter(); f2.type = 'highpass'; f2.frequency.value = 900;
  var g = AC.createGain(); g.gain.setValueAtTime(0.0001, AC.currentTime); g.gain.exponentialRampToValueAtTime(0.13, AC.currentTime + 0.12);
  s.connect(f); f.connect(f2); f2.connect(g); g.connect(master); s.start(0, Math.random());
  waterNode = { s: s, g: g };
}
function stopWater() {
  if (!waterNode) return;
  var n = waterNode; waterNode = null;
  try {
    n.g.gain.cancelScheduledValues(AC.currentTime);
    n.g.gain.setValueAtTime(Math.max(0.0001, n.g.gain.value), AC.currentTime);
    n.g.gain.exponentialRampToValueAtTime(0.0001, AC.currentTime + 0.15);
    n.s.stop(AC.currentTime + 0.2);
  } catch (e) {}
}
/* voces kawaii de cada animalito. happy=false => carita triste */
function voice(id, happy, v) {
  v = v || 1;
  if (id === 'unicornio') {
    if (happy) { [0, 1, 2, 4].forEach(function (k, i) { var f = [784, 988, 1175, 1568][i]; note({ f: [[0, f * 0.95], [0.12, f]], dur: 0.35, vol: 0.13 * v, type: 'sine', delay: i * 0.11, vib: [7, 6] }); note({ f: [[0, f * 2], [0.2, f * 2]], dur: 0.25, vol: 0.04 * v, type: 'triangle', delay: i * 0.11 }); }); }
    else { note({ f: [[0, 700], [0.5, 480]], dur: 0.55, vol: 0.13 * v, type: 'sine', vib: [6, 8] }); note({ f: [[0, 600], [0.5, 420]], dur: 0.5, vol: 0.08 * v, type: 'sine', delay: 0.25, vib: [6, 8] }); }
  } else if (id === 'pollito') {
    if (happy) { for (var i = 0; i < 3; i++) note({ f: [[0, 1900 + i * 150], [0.06, 2500 + i * 150]], dur: 0.09, vol: 0.12 * v, type: 'sine', delay: i * 0.12 }); }
    else { note({ f: [[0, 1700], [0.35, 1150]], dur: 0.4, vol: 0.12 * v, type: 'sine', vib: [9, 25] }); note({ f: [[0, 1600], [0.3, 1100]], dur: 0.35, vol: 0.09 * v, type: 'sine', delay: 0.4, vib: [9, 25] }); }
  } else if (id === 'perrito') {
    if (happy) { note({ f: [[0, 460], [0.05, 520], [0.15, 300]], dur: 0.17, vol: 0.2 * v, type: 'triangle', lp: 1000 }); note({ f: [[0, 700], [0.1, 950]], dur: 0.12, vol: 0.1 * v, type: 'sine', delay: 0.2 }); note({ f: [[0, 470], [0.15, 310]], dur: 0.17, vol: 0.16 * v, type: 'triangle', lp: 1000, delay: 0.38 }); }
    else { note({ f: [[0, 560], [0.5, 380]], dur: 0.55, vol: 0.14 * v, type: 'sine', vib: [6, 10] }); note({ f: [[0, 540], [0.4, 360]], dur: 0.45, vol: 0.1 * v, type: 'sine', delay: 0.5, vib: [6, 10] }); }
  } else if (id === 'gatito') {
    if (happy) { note({ f: [[0, 620], [0.18, 980], [0.45, 700]], dur: 0.5, vol: 0.16 * v, type: 'triangle', lp: 2200, vib: [6, 14] }); note({ f: [[0, 1240], [0.18, 1960], [0.45, 1400]], dur: 0.4, vol: 0.03 * v, type: 'sine', delay: 0.02 }); }
    else { note({ f: [[0, 900], [0.6, 520]], dur: 0.65, vol: 0.15 * v, type: 'triangle', lp: 2000, vib: [7, 16] }); }
  } else if (id === 'leon') {
    if (happy) { note({ f: [[0, 300], [0.12, 250], [0.3, 190]], dur: 0.35, vol: 0.22 * v, type: 'sawtooth', lp: 650, vib: [20, 18] }); note({ f: [[0, 520], [0.14, 700]], dur: 0.14, vol: 0.09 * v, type: 'sine', delay: 0.38 }); }
    else { note({ f: [[0, 260], [0.55, 170]], dur: 0.6, vol: 0.2 * v, type: 'triangle', lp: 700, vib: [6, 10] }); }
  } else if (id === 'elefante') {
    if (happy) { note({ f: [[0, 380], [0.1, 560]], dur: 0.14, vol: 0.17 * v, type: 'triangle', lp: 1700 }); note({ f: [[0, 520], [0.15, 720], [0.45, 560]], dur: 0.5, vol: 0.2 * v, type: 'triangle', lp: 1900, vib: [11, 10], delay: 0.16 }); }
    else { note({ f: [[0, 520], [0.55, 330]], dur: 0.6, vol: 0.18 * v, type: 'triangle', lp: 1500, vib: [8, 12] }); }
  }
}
function sfxGiggle(id) { voice(id, true, 0.55); }
function sfxCelebrate() {
  [523, 659, 784, 1047, 1319].forEach(function (f, i) { note({ f: [[0, f], [0.5, f]], dur: 0.5, vol: 0.14, type: 'sine', delay: i * 0.12 }); note({ f: [[0, f * 2], [0.4, f * 2]], dur: 0.4, vol: 0.04, type: 'triangle', delay: i * 0.12 }); });
}


/* ------------------------------------------------------------------ partículas en pantalla */
function addP(p) { if (particles.length < 260) particles.push(p); }
function spawnBubble(x, y, r, vx, vy) {
  addP({ t: 'b', x: x, y: y, vx: vx || R(-12, 12), vy: vy || R(-70, -25), r: r, life: 0, max: R(1.4, 2.6), hue: (Math.random() * 3) | 0, ph: R(0, 6) });
}
function spawnDrop(x, y, vx, vy, r) { addP({ t: 'd', x: x, y: y, vx: vx, vy: vy, r: r, life: 0, max: R(0.7, 1.2) }); }
function spawnSpark(x, y, r, color, vx, vy) {
  addP({ t: 's', x: x, y: y, vx: vx || R(-25, 25), vy: vy || R(-40, 5), r: r, life: 0, max: R(0.5, 1.0), c: color || '#fff6b0', rot: R(-0.5, 0.5) });
}
function spawnHeart(x, y, r, color) {
  addP({ t: 'h', x: x, y: y, vx: R(-30, 30), vy: R(-120, -60), r: r, life: 0, max: R(1.2, 2), c: color || '#ff8fb8', ph: R(0, 6) });
}
function toScreenX(lx) { return stageRect.left + lx / KW * stageRect.w; }
function toScreenY(ly) { return stageRect.top + ly / KH * stageRect.h; }

function updateParticles(dt) {
  for (var i = particles.length - 1; i >= 0; i--) {
    var p = particles[i];
    p.life += dt;
    if (p.life >= p.max) { if (p.t === 'b' && !p.popped) { sfxPopMaybe(); } particles.splice(i, 1); continue; }
    if (p.t === 'd') { p.vy += 1100 * dt; }
    if (p.t === 'b') { p.x += Math.sin(T * 2 + p.ph) * 14 * dt; }
    if (p.t === 'h') { p.x += Math.sin(T * 3 + p.ph) * 30 * dt; }
    if (p.t === 's') { p.vy += 30 * dt; }
    p.x += p.vx * dt; p.y += p.vy * dt;
  }
}
var lastPopSound = 0;
function sfxPopMaybe() { if (T - lastPopSound > 0.12 && Math.random() < 0.35) { lastPopSound = T; sfxPop(true); } }

function drawBubbleShape(c, x, y, r, a, hue) {
  c.globalAlpha = a;
  c.beginPath(); c.arc(x, y, r, 0, 6.2832);
  c.fillStyle = 'rgba(255,255,255,0.5)'; c.fill();
  c.lineWidth = Math.max(1.5, r * 0.09);
  c.strokeStyle = hue === 0 ? 'rgba(130,200,255,0.95)' : (hue === 1 ? 'rgba(255,170,215,0.95)' : 'rgba(190,160,255,0.95)');
  c.stroke();
  c.beginPath(); c.arc(x - r * 0.35, y - r * 0.38, r * 0.24, 0, 6.2832);
  c.fillStyle = 'rgba(255,255,255,0.95)'; c.fill();
  c.globalAlpha = 1;
}
function drawStarShape(c, x, y, r) {
  c.beginPath();
  c.moveTo(x, y - r);
  c.quadraticCurveTo(x + r * 0.16, y - r * 0.16, x + r, y);
  c.quadraticCurveTo(x + r * 0.16, y + r * 0.16, x, y + r);
  c.quadraticCurveTo(x - r * 0.16, y + r * 0.16, x - r, y);
  c.quadraticCurveTo(x - r * 0.16, y - r * 0.16, x, y - r);
  c.fill();
}
function drawHeartShape(c, x, y, r) {
  c.beginPath();
  c.moveTo(x, y + r * 0.9);
  c.bezierCurveTo(x - r * 1.5, y - r * 0.1, x - r * 0.7, y - r * 1.1, x, y - r * 0.4);
  c.bezierCurveTo(x + r * 0.7, y - r * 1.1, x + r * 1.5, y - r * 0.1, x, y + r * 0.9);
  c.fill();
}
function drawDropShape(c, x, y, r) {
  c.beginPath();
  c.moveTo(x, y - r * 1.5);
  c.quadraticCurveTo(x + r * 1.2, y, x, y + r * 0.9);
  c.quadraticCurveTo(x - r * 1.2, y, x, y - r * 1.5);
  c.fill();
}
function drawFx() {
  var c = fxX;
  c.setTransform(DPR, 0, 0, DPR, 0, 0);
  c.clearRect(0, 0, W, H);
  for (var i = 0; i < particles.length; i++) {
    var p = particles[i], k = p.life / p.max;
    if (p.t === 'b') {
      var a = k > 0.85 ? (1 - k) / 0.15 : Math.min(1, k * 6);
      var rr = p.r * (k > 0.85 ? 1 + (k - 0.85) * 3 : 1);
      drawBubbleShape(c, p.x, p.y, rr, a * 0.95, p.hue);
    } else if (p.t === 'd') {
      c.globalAlpha = Math.min(0.9, (1 - k) * 1.4);
      c.fillStyle = '#7cc9ff'; drawDropShape(c, p.x, p.y, p.r);
      c.fillStyle = 'rgba(255,255,255,.85)'; c.beginPath(); c.arc(p.x - p.r * 0.3, p.y - p.r * 0.1, p.r * 0.28, 0, 6.2832); c.fill();
      c.globalAlpha = 1;
    } else if (p.t === 's') {
      c.globalAlpha = Math.sin(k * 3.1416);
      c.fillStyle = p.c; drawStarShape(c, p.x, p.y, p.r * (0.6 + 0.6 * Math.sin(k * 3.1416)));
      c.globalAlpha = 1;
    } else if (p.t === 'h') {
      c.globalAlpha = k > 0.7 ? (1 - k) / 0.3 : 1;
      c.fillStyle = p.c; drawHeartShape(c, p.x, p.y, p.r * (0.7 + 0.3 * Math.min(1, k * 5)));
      c.globalAlpha = 1;
    }
  }
}

/* ------------------------------------------------------------------ luciérnagas (fondo) */
function makeGlow() {
  var c = document.createElement('canvas'); c.width = c.height = 64;
  var x = c.getContext('2d'), g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,220,1)'); g.addColorStop(0.18, 'rgba(235,255,150,0.85)');
  g.addColorStop(0.5, 'rgba(190,240,100,0.25)'); g.addColorStop(1, 'rgba(180,230,90,0)');
  x.fillStyle = g; x.fillRect(0, 0, 64, 64);
  return c;
}
function initFireflies() {
  fireflies = [];
  var n = Math.round(clamp(W * H / 26000, 18, 34));
  for (var i = 0; i < n; i++) {
    fireflies.push({ x: R(0, W), y: R(0, H), ax: R(20, 90), ay: R(14, 60), sx: R(0.12, 0.4), sy: R(0.1, 0.35),
      px: R(0, 6.28), py: R(0, 6.28), pp: R(0, 6.28), ps: R(0.7, 1.8), s: R(10, 24), boost: 0 });
  }
}
function fireflyPos(f) { return { x: f.x + Math.sin(T * f.sx + f.px) * f.ax, y: f.y + Math.sin(T * f.sy + f.py) * f.ay }; }
function drawBg(dt) {
  bgX.clearRect(0, 0, W, H);
  for (var i = 0; i < fireflies.length; i++) {
    var f = fireflies[i], p = fireflyPos(f);
    if (f.boost > 0) f.boost = Math.max(0, f.boost - dt * 1.4);
    var a = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(T * f.ps + f.pp));
    var s = f.s * (1 + f.boost * 2.2);
    bgX.globalAlpha = Math.min(1, a + f.boost);
    bgX.drawImage(glow, p.x - s, p.y - s, s * 2, s * 2);
  }
  bgX.globalAlpha = 1;
}
function tryFirefly(x, y) {
  for (var i = 0; i < fireflies.length; i++) {
    var f = fireflies[i], p = fireflyPos(f);
    if (dist(x, y, p.x, p.y) < 48) {
      f.boost = 1; sfxChime(i);
      for (var k = 0; k < 7; k++) spawnSpark(p.x, p.y, R(6, 12), '#f4ffb0', R(-80, 80), R(-80, 80));
      return true;
    }
  }
  return false;
}


var VOL = 0.4;   // volumen general (bajito a propósito)
var W = 800, H = 600, DPR = 1, PS = 1;
var stageRect = { left: 0, top: 0, w: 300, h: 450 };
var bgCv = $('bg'), bgX = bgCv.getContext('2d'), fxCv = $('fx'), fxX = fxCv.getContext('2d');
var menuEl = $('menu'), trackEl = $('track'), playEl = $('play'), fadeEl = $('fade'), dotsEl = $('dots');
var T = 0, last = 0, particles = [], fireflies = [], glow = null, hinting = true, menuEls = [], STEP = 100;
function stopHint() { if (hinting) { hinting = false; document.body.className = document.body.className.replace('hint', ''); } }
function touchOf(e, id) { var l = e.changedTouches; for (var i = 0; i < l.length; i++) if (l[i].identifier === id) return l[i]; return null; }
function setT(el, s) { el.style.webkitTransform = s; el.style.transform = s; }
function now() { return (window.performance && performance.now) ? performance.now() : Date.now(); }
function rgb(h) { return [parseInt(h.substr(1, 2), 16), parseInt(h.substr(3, 2), 16), parseInt(h.substr(5, 2), 16)]; }
var glowC = {};
function glowTint(col) {
  if (glowC[col]) return glowC[col];
  var c = document.createElement('canvas'); c.width = c.height = 64; var x = c.getContext('2d'), r = rgb(col), g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(' + r + ',.9)'); g.addColorStop(0.3, 'rgba(' + r + ',.4)'); g.addColorStop(1, 'rgba(' + r + ',0)');
  x.fillStyle = g; x.fillRect(0, 0, 64, 64); glowC[col] = c; return c;
}

/* ------------------------------------------------------------------ sonido MUY suave */
var SC_OFF = [0, 2, 4, 7, 9], bus = null, padUntil = 0, nextPad = 0, padI = 0, lastDrop = 0;
function noteHz(idx) { var o = Math.floor(idx / 5); return 130.8128 * Math.pow(2, (12 * o + SC_OFF[((idx % 5) + 5) % 5]) / 12); }
function ensureBus() {
  if (!AC) return false; if (bus) return true;
  var inp = AC.createGain(), conv = AC.createConvolver(), len = Math.floor(AC.sampleRate * 2), buf = AC.createBuffer(2, len, AC.sampleRate), c, i, d;
  for (c = 0; c < 2; c++) { d = buf.getChannelData(c); for (i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.8); }
  conv.buffer = buf; var wet = AC.createGain(); wet.gain.value = 0.45; conv.connect(wet); wet.connect(master);
  inp.connect(master); inp.connect(conv); bus = { in: inp }; if (master) master.gain.value = muted ? 0 : VOL; return true;
}
function tone(f, vol, dur, delay, type) {
  if (!ensureBus()) return; var t = AC.currentTime + (delay || 0), o = AC.createOscillator(), g = AC.createGain(), lp = AC.createBiquadFilter();
  o.type = type || 'sine'; o.frequency.value = f; lp.type = 'lowpass'; lp.frequency.value = 2200;
  g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + 0.03); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(lp); lp.connect(g); g.connect(bus.in); o.start(t); o.stop(t + dur + 0.05);
}
function sfxPlant() { tone(330, 0.04, 0.3); tone(247, 0.03, 0.35, 0.06); }
function sfxBloom() { var n = Math.floor(R(8, 14)); tone(noteHz(n), 0.04, 1.8); tone(noteHz(n + 2), 0.03, 1.8, 0.14); tone(noteHz(n + 3), 0.02, 1.8, 0.28); }
function sfxPip(n) { var f = noteHz(10 + (n % 8)); tone(f, 0.035, 0.4); tone(f * 2, 0.01, 0.25); }
function sfxBell(n) { var f = noteHz(12 + (n % 6)); tone(f, 0.03, 1.6); tone(f * 2.01, 0.008, 1); }
function sfxDrop() { var t = now(); if (t - lastDrop < 260) return; lastDrop = t; tone(R(650, 850), 0.012, 0.09); }
var CHORDS = [[0, 3, 6, 7], [-1, 2, 3, 5], [0, 3, 5, 6], [-1, 2, 4, 6]];
function padUpdate() {
  if (!AC || !bus) return; var n = AC.currentTime; if (!(padUntil > n && n >= nextPad)) return;
  var ch = CHORDS[padI++ % 4], lp = AC.createBiquadFilter(), g = AC.createGain(), i;
  lp.type = 'lowpass'; lp.frequency.value = 700; lp.connect(g); g.connect(bus.in); nextPad = n + 7;
  g.gain.setValueAtTime(0.0001, n); g.gain.linearRampToValueAtTime(0.014, n + 2.5); g.gain.setValueAtTime(0.014, n + 4); g.gain.linearRampToValueAtTime(0.0001, n + 8);
  for (i = 0; i < ch.length; i++) { var o = AC.createOscillator(); o.type = 'sine'; o.frequency.value = noteHz(ch[i]); o.connect(lp); o.start(n); o.stop(n + 8.2); }
}

/* ------------------------------------------------------------------ plantas (20 semillas) */
var GR = '#4f9a6a', GR2 = '#3f7f58';
function dot(c, x, y, r, col) { c.fillStyle = col; c.beginPath(); c.arc(x, y, r, 0, 6.2832); c.fill(); }
function stem(c, h, w, col, b) { c.strokeStyle = col; c.lineWidth = w; c.lineCap = 'round'; c.beginPath(); c.moveTo(0, 0); c.quadraticCurveTo(b || 0, -h * 0.5, 0, -h); c.stroke(); }
function leaf(c, x, y, len, ang, col) { c.save(); c.translate(x, y); c.rotate(ang); c.fillStyle = col; c.beginPath(); c.ellipse(len / 2, 0, len / 2, len * 0.22, 0, 0, 6.2832); c.fill(); c.restore(); }
function petals(c, x, y, n, len, wd, col, off) { for (var i = 0; i < n; i++) { c.save(); c.translate(x, y); c.rotate(i / n * 6.2832 + (off || 0)); c.fillStyle = col; c.beginPath(); c.ellipse(len * 0.6, 0, len * 0.5, wd, 0, 0, 6.2832); c.fill(); c.restore(); } }
function branch(c, x, y, a, l, d) {
  if (d <= 0) return; var x2 = x + Math.cos(a) * l, y2 = y + Math.sin(a) * l;
  c.lineWidth = d * 3 + 1; c.strokeStyle = d > 1 ? '#d9707f' : '#e8907a'; c.lineCap = 'round'; c.beginPath(); c.moveTo(x, y); c.lineTo(x2, y2); c.stroke();
  if (d === 1) dot(c, x2, y2, 5, '#f0b0a0'); branch(c, x2, y2, a - 0.5, l * 0.72, d - 1); branch(c, x2, y2, a + 0.5, l * 0.72, d - 1);
}
function glowAt(c, col, x, y, r) { c.globalAlpha = 0.55; c.drawImage(glowTint(col), x - r, y - r, r * 2, r * 2); c.globalAlpha = 1; }
var PL = {
  sol: function (c) { stem(c, 120, 7, GR, 6); leaf(c, 0, -40, 34, -0.5, GR); leaf(c, 0, -62, 30, 3.6, GR); petals(c, 0, -128, 14, 30, 8, '#dcae48'); petals(c, 0, -128, 14, 22, 6, '#c99636', 0.2); dot(c, 0, -128, 17, '#6b4423'); },
  tul: function (c) { stem(c, 90, 6, GR, 0); leaf(c, 0, -8, 50, -1.1, GR); leaf(c, 0, -8, 46, -2, GR); c.fillStyle = '#c8607e'; c.beginPath(); c.ellipse(-9, -100, 10, 20, -0.25, 0, 6.2832); c.fill(); c.beginPath(); c.ellipse(9, -100, 10, 20, 0.25, 0, 6.2832); c.fill(); c.fillStyle = '#dc7f9c'; c.beginPath(); c.ellipse(0, -102, 10, 22, 0, 0, 6.2832); c.fill(); },
  mar: function (c) { stem(c, 80, 5, GR, -5); leaf(c, 0, -30, 22, -0.6, GR); petals(c, 0, -86, 10, 22, 6, '#e2dcd0'); dot(c, 0, -86, 9, '#dcae48'); },
  ros: function (c) { stem(c, 80, 5, GR2, 4); leaf(c, 0, -28, 24, -0.5, GR); leaf(c, 0, -45, 22, 3.6, GR); dot(c, 0, -88, 22, '#a83d56'); dot(c, 0, -88, 15, '#c25670'); dot(c, 0, -88, 8, '#a83d56'); c.strokeStyle = '#8a2f43'; c.lineWidth = 2; c.beginPath(); c.arc(0, -88, 11, 0.5, 4.2); c.stroke(); },
  zan: function (c) { var i; for (i = 0; i < 3; i++) leaf(c, 0, -4, 56, -1.57 + (i - 1) * 0.5, '#5aa874'); c.fillStyle = '#d58540'; c.beginPath(); c.arc(0, 2, 15, Math.PI, 0); c.closePath(); c.fill(); c.strokeStyle = '#b36a2c'; c.lineWidth = 2; c.beginPath(); c.moveTo(-8, -5); c.lineTo(-3, -9); c.moveTo(4, -6); c.lineTo(9, -9); c.stroke(); },
  fre: function (c) { var i, p = [[-18, -22], [16, -30], [2, -12]]; for (i = 0; i < 6; i++) leaf(c, 0, -6, 38, -1.57 + (i - 2.5) * 0.5, '#4f9a6a'); for (i = 0; i < 3; i++) { c.fillStyle = '#cf4a5a'; c.beginPath(); c.ellipse(p[i][0], p[i][1], 8, 10, 0, 0, 6.2832); c.fill(); dot(c, p[i][0] - 3, p[i][1], 1.3, '#f3d27a'); dot(c, p[i][0] + 3, p[i][1] + 3, 1.3, '#f3d27a'); dot(c, p[i][0], p[i][1] - 7, 3, '#4f9a6a'); } },
  jit: function (c) { var i, p = [[-14, -45], [14, -62], [-4, -82]]; stem(c, 95, 5, GR2, 8); leaf(c, 0, -30, 26, -0.6, GR); leaf(c, 0, -70, 24, 3.7, GR); for (i = 0; i < 3; i++) { dot(c, p[i][0], p[i][1], 12, '#c94a40'); dot(c, p[i][0] - 4, p[i][1] - 4, 3, '#e88a80'); dot(c, p[i][0], p[i][1] - 11, 3, GR); } },
  cal: function (c) { var i; c.fillStyle = '#d27d33'; c.beginPath(); c.ellipse(0, -24, 36, 25, 0, 0, 6.2832); c.fill(); c.strokeStyle = '#a95c22'; c.lineWidth = 2.5; for (i = -2; i <= 2; i++) { c.beginPath(); c.ellipse(i * 12, -24, Math.abs(i) * 3 + 6, 24, 0, 0, 6.2832); c.stroke(); } c.fillStyle = GR2; c.fillRect(-4, -54, 8, 12); leaf(c, 4, -50, 26, -0.5, GR); },
  hon: function (c) { glowAt(c, '#ff9ad0', 0, -52, 62); c.fillStyle = '#efe0cc'; c.fillRect(-9, -48, 18, 48); c.fillStyle = '#b0607f'; c.beginPath(); c.ellipse(0, -48, 38, 30, 0, Math.PI, 0); c.fill(); dot(c, -14, -62, 5, '#f3e6d2'); dot(c, 10, -70, 6, '#f3e6d2'); dot(c, 20, -54, 4, '#f3e6d2'); },
  hel: function (c) { var j, k; for (j = 0; j < 5; j++) { var a = (j - 2) * 0.5, ex = Math.sin(a) * 90, ey = -Math.cos(a) * 70, cx = Math.sin(a) * 25, cy = -80; for (k = 1; k <= 9; k++) { var q = k / 9, x = (1 - q) * (1 - q) * 0 + 2 * (1 - q) * q * cx + q * q * ex, y = (1 - q) * (1 - q) * 0 + 2 * (1 - q) * q * cy + q * q * ey; leaf(c, x, y, 20 * (1 - q * 0.5), -1.57 + a * 0.6 + (k % 2 ? 1 : -1) * 1.1, '#3f8a62'); } } },
  arb: function (c) { c.fillStyle = '#6b4a32'; c.beginPath(); c.moveTo(-10, 0); c.lineTo(-5, -75); c.lineTo(5, -75); c.lineTo(10, 0); c.fill(); dot(c, -24, -88, 28, '#3a7f58'); dot(c, 24, -90, 28, '#3a7f58'); dot(c, 0, -110, 34, '#4a9a68'); dot(c, -14, -100, 5, '#dc7a8a'); dot(c, 18, -96, 5, '#dc7a8a'); dot(c, 2, -122, 5, '#dc7a8a'); },
  lun: function (c) { glowAt(c, '#cfe0ff', 0, -100, 56); stem(c, 92, 5, '#4f8f7a', 4); leaf(c, 0, -30, 26, -0.6, '#4f8f7a'); petals(c, 0, -100, 8, 28, 7, '#c8d8f4'); dot(c, 0, -100, 9, '#fff0c0'); },
  cac: function (c) { c.lineCap = 'round'; c.strokeStyle = '#4f9a68'; c.lineWidth = 30; c.beginPath(); c.moveTo(0, -8); c.lineTo(0, -100); c.stroke(); c.lineWidth = 15; c.beginPath(); c.moveTo(0, -45); c.lineTo(-26, -45); c.lineTo(-26, -72); c.moveTo(0, -62); c.lineTo(26, -62); c.lineTo(26, -86); c.stroke(); c.strokeStyle = '#3a7f52'; c.lineWidth = 2; c.beginPath(); c.moveTo(-5, -20); c.lineTo(-5, -95); c.moveTo(6, -20); c.lineTo(6, -95); c.stroke(); },
  cacf: function (c) { c.fillStyle = '#4f9a68'; c.beginPath(); c.ellipse(0, -26, 28, 26, 0, 0, 6.2832); c.fill(); c.strokeStyle = '#3a7f52'; c.lineWidth = 2; c.beginPath(); c.moveTo(-9, -8); c.quadraticCurveTo(-12, -26, -9, -48); c.moveTo(9, -8); c.quadraticCurveTo(12, -26, 9, -48); c.stroke(); petals(c, 0, -56, 6, 18, 6, '#dc7f9c'); dot(c, 0, -56, 6, '#f3d27a'); },
  alo: function (c) { var i; for (i = 0; i < 7; i++) { var a = (i - 3) * 0.36; c.save(); c.rotate(a); c.fillStyle = i % 2 ? '#6fae8a' : '#5f9e7c'; c.beginPath(); c.moveTo(-8, 0); c.quadraticCurveTo(-12, -45, 0, -88); c.quadraticCurveTo(12, -45, 8, 0); c.closePath(); c.fill(); c.restore(); } },
  pal: function (c) { var i; c.strokeStyle = '#8a6a48'; c.lineWidth = 12; c.lineCap = 'round'; c.beginPath(); c.moveTo(0, 0); c.quadraticCurveTo(-4, -60, 10, -112); c.stroke(); for (i = 0; i < 6; i++) { var a = -Math.PI + i * (Math.PI / 5); c.strokeStyle = '#4f9a68'; c.lineWidth = 7; c.beginPath(); c.moveTo(10, -112); c.quadraticCurveTo(10 + Math.cos(a) * 30, -112 + Math.sin(a) * 40 - 16, 10 + Math.cos(a) * 62, -112 + Math.sin(a) * 28 + 20); c.stroke(); } dot(c, 8, -108, 5, '#8a5a32'); dot(c, 15, -106, 5, '#8a5a32'); },
  alg: function (c, t) { var j, y; c.lineCap = 'round'; for (j = 0; j < 3; j++) { c.strokeStyle = j === 1 ? '#4fae8a' : '#3f9a86'; c.lineWidth = 9 - j; c.beginPath(); c.moveTo((j - 1) * 14, 0); for (y = 6; y <= 112; y += 6) c.lineTo((j - 1) * 14 + Math.sin(y * 0.07 + t * 1.6 + j * 2) * 9 * (y / 112), -y); c.stroke(); } },
  cor: function (c) { branch(c, -16, 0, -1.57, 36, 4); branch(c, 18, 0, -1.4, 28, 3); },
  nen: function (c) { stem(c, 130, 4, '#3f8a6a', 6); c.save(); c.translate(0, -132); c.fillStyle = '#4f9a78'; c.beginPath(); c.ellipse(0, 0, 46, 14, 0, 0, 6.2832); c.fill(); c.strokeStyle = '#3a8068'; c.lineWidth = 2; c.beginPath(); c.moveTo(0, 0); c.lineTo(40, -4); c.stroke(); petals(c, 0, -6, 6, 13, 5, '#ecb4cc'); dot(c, 0, -6, 5, '#f3d27a'); c.restore(); },
  lot: function (c) { var i; stem(c, 100, 5, '#3f8a6a', -4); c.save(); c.translate(0, -104); for (i = -3; i <= 3; i++) { c.save(); c.rotate(-1.57 + i * 0.3); c.fillStyle = '#d9809c'; c.beginPath(); c.ellipse(20, 0, 22, 10, 0, 0, 6.2832); c.fill(); c.restore(); } for (i = -2; i <= 2; i++) { c.save(); c.rotate(-1.57 + i * 0.32); c.fillStyle = '#eaa8c0'; c.beginPath(); c.ellipse(14, 0, 15, 8, 0, 0, 6.2832); c.fill(); c.restore(); } dot(c, 0, 2, 7, '#f3d27a'); c.restore(); }
};
var SEEDN = { sol: 'girasol', tul: 'tulipán', mar: 'margarita', ros: 'rosa', zan: 'zanahoria', fre: 'fresa', jit: 'jitomate', cal: 'calabaza', hon: 'hongo', hel: 'helecho', arb: 'arbolito', lun: 'flor lunar', cac: 'cactus', cacf: 'cactus con flor', alo: 'aloe', pal: 'palmera', alg: 'alga', cor: 'coral', nen: 'nenúfar', lot: 'loto' };

/* ------------------------------------------------------------------ animalitos pequeños */
function ell(c, x, y, rx, ry, col, rot) { c.fillStyle = col; c.beginPath(); c.ellipse(x, y, rx, ry, rot || 0, 0, 6.2832); c.fill(); }
var CR = {
  mar: function (c, t, k) { var f = Math.abs(Math.sin(t * 9 + k.ph)), s; for (s = -1; s <= 1; s += 2) { c.save(); c.scale(1, s); ell(c, 2, -8, 8, 4 + 9 * f, k.col, -0.3); ell(c, 0, -3, 6, 2 + 6 * f, k.col2 || k.col, 0.3); c.restore(); } ell(c, 0, 0, 7, 2.2, '#4a3a52'); },
  abe: function (c, t, k) { var f = Math.abs(Math.sin(t * 30 + k.ph)); ell(c, -2, -7, 5, 3 + 4 * f, 'rgba(230,240,255,.7)', -0.4); ell(c, 0, 0, 9, 6, '#e0b24a'); c.fillStyle = '#4a3a2a'; c.fillRect(-3, -6, 3, 12); c.fillRect(3, -5, 3, 10); dot(c, 8, -1, 1.6, '#222'); },
  cat: function (c) { c.fillStyle = '#d0463f'; c.beginPath(); c.arc(0, 2, 10, Math.PI, 0); c.closePath(); c.fill(); dot(c, -4, -3, 1.8, '#2a1a1a'); dot(c, 3, -4, 1.8, '#2a1a1a'); dot(c, 0, -7, 1.6, '#2a1a1a'); dot(c, 11, 1, 4, '#2a1a1a'); },
  car: function (c) { ell(c, 0, 4, 14, 4.5, '#c9b8a6'); dot(c, -2, -3, 10, '#a8804e'); c.strokeStyle = '#8a6438'; c.lineWidth = 1.6; c.beginPath(); c.arc(-2, -3, 5, 0, 4.5); c.stroke(); dot(c, 13, 1, 3.4, '#c9b8a6'); c.strokeStyle = '#c9b8a6'; c.beginPath(); c.moveTo(13, -2); c.lineTo(16, -9); c.moveTo(11, -2); c.lineTo(11, -9); c.stroke(); },
  ran: function (c) { ell(c, 0, 0, 13, 8, '#58a066'); ell(c, -9, 6, 7, 3.5, '#4a8a58'); dot(c, 7, -7, 4.5, '#58a066'); dot(c, 12, -6, 4, '#58a066'); dot(c, 7, -8, 2, '#fff'); dot(c, 12, -7, 2, '#fff'); dot(c, 7.5, -8, 1, '#222'); dot(c, 12.5, -7, 1, '#222'); },
  lag: function (c) { c.strokeStyle = '#b08850'; c.lineWidth = 4; c.lineCap = 'round'; c.beginPath(); c.moveTo(-14, 0); c.quadraticCurveTo(-26, 6, -34, -3); c.stroke(); ell(c, 0, 0, 16, 5, '#b8905a'); dot(c, 16, -1, 5, '#b8905a'); dot(c, 18, -2, 1.2, '#222'); c.strokeStyle = '#a07c48'; c.lineWidth = 2.5; c.beginPath(); c.moveTo(-6, 4); c.lineTo(-9, 9); c.moveTo(7, 4); c.lineTo(10, 9); c.stroke(); },
  pez: function (c, t, k) { var f = Math.sin(t * 8 + k.ph) * 4; c.fillStyle = k.col; c.beginPath(); c.moveTo(-10, 0); c.lineTo(-22, -8 + f); c.lineTo(-22, 8 + f); c.closePath(); c.fill(); ell(c, 0, 0, 14, 8.5, k.col); ell(c, 2, 3, 8, 3.5, 'rgba(255,255,255,.25)'); dot(c, 8, -2, 2.2, '#fff'); dot(c, 8.6, -2, 1.1, '#222'); },
  med: function (c, t, k) { var j; c.strokeStyle = k.col; c.lineWidth = 2; c.lineCap = 'round'; for (j = -2; j <= 2; j++) { c.beginPath(); c.moveTo(j * 4, 2); c.quadraticCurveTo(j * 4 + Math.sin(t * 3 + j) * 5, 12, j * 4, 24); c.stroke(); } c.fillStyle = k.col; c.beginPath(); c.arc(0, 2, 12, Math.PI, 0); c.closePath(); c.fill(); dot(c, -4, -2, 1.6, '#fff'); dot(c, 4, -2, 1.6, '#fff'); },
  est: function (c) { var i; c.fillStyle = '#e08a58'; c.beginPath(); for (i = 0; i < 10; i++) { var a = -1.57 + i * 0.628, r = i % 2 ? 6 : 15; c.lineTo(Math.cos(a) * r, Math.sin(a) * r); } c.closePath(); c.fill(); dot(c, 0, 0, 2, '#f3c9a0'); }
};

/* ------------------------------------------------------------------ biomas */
var BIOMES = [
  { sky: [[0, '#0b1030'], [0.6, '#1a1f4d'], [1, '#26325f']], stars: 1, moon: 1, hills: [[0.6, '#142a3c', 0.04], [0.66, '#163626', 0.03]], ground: ['#1b3a2a', '#0f2218'], gz: [0.68, 0.92],
    seeds: ['sol', 'tul', 'mar', 'ros'], mote: { kind: 'glow', col: '#f0dc8a', n: 22, vy: 0 },
    cr: [{ k: 'mar', n: 3, mode: 'air', cols: ['#d98aa0', '#8fb0e0', '#d8b86a'] }, { k: 'abe', n: 2, mode: 'air', cols: ['#e0b24a'] }, { k: 'car', n: 1, mode: 'ground', cols: ['#a8804e'] }] },
  { sky: [[0, '#14102e'], [0.65, '#3a2450'], [1, '#5a3556']], stars: 1, moon: 0, hills: [[0.62, '#2c1f3c', 0.03]], ground: ['#3a2a1f', '#22170f'], gz: [0.66, 0.93], rows: 1,
    seeds: ['zan', 'fre', 'jit', 'cal'], mote: { kind: 'glow', col: '#f0e6c8', n: 20, vy: -6, vx: 10 },
    cr: [{ k: 'cat', n: 3, mode: 'ground', cols: ['#d0463f'] }, { k: 'mar', n: 2, mode: 'air', cols: ['#e8e0b0', '#d8a0c0'] }, { k: 'abe', n: 2, mode: 'air', cols: ['#e0b24a'] }, { k: 'car', n: 1, mode: 'ground', cols: ['#a8804e'] }] },
  { sky: [[0, '#071a22'], [1, '#0f3a3a']], trunks: 1, hills: [], ground: ['#133428', '#0b1f18'], gz: [0.7, 0.93],
    seeds: ['hon', 'hel', 'arb', 'lun'], mote: { kind: 'glow', col: '#8ce0b8', n: 26, vy: -8 },
    cr: [{ k: 'mar', n: 3, mode: 'air', cols: ['#7fb4e8', '#9a8fe0'], col2: '#cfe4ff' }, { k: 'ran', n: 2, mode: 'ground', cols: ['#58a066'] }, { k: 'car', n: 1, mode: 'ground', cols: ['#a8804e'] }] },
  { sky: [[0, '#0c0e2a'], [0.55, '#3a2442'], [0.8, '#6a3a48']], stars: 1, moon: 1, hills: [[0.66, '#4a2f38', 0.05], [0.7, '#5a3a3a', 0.04]], ground: ['#6a4a3a', '#3a2820'], gz: [0.7, 0.93],
    seeds: ['cac', 'cacf', 'alo', 'pal'], mote: { kind: 'glow', col: '#e0a868', n: 20, vy: -3, vx: 14 },
    cr: [{ k: 'lag', n: 2, mode: 'ground', cols: ['#b8905a'] }, { k: 'mar', n: 2, mode: 'air', cols: ['#e8a060'], col2: '#e07a4a' }, { k: 'cat', n: 2, mode: 'ground', cols: ['#d0463f'] }] },
  { sky: [[0, '#06202c'], [1, '#0b4a58']], rays: 1, hills: [[0.78, '#0e3640', 0.03]], ground: ['#2a5a58', '#143a3c'], gz: [0.74, 0.94],
    seeds: ['alg', 'cor', 'nen', 'lot'], mote: { kind: 'bubble', col: '#a8e0ee', n: 22, vy: -26 },
    cr: [{ k: 'pez', n: 4, mode: 'swim', cols: ['#e8906a', '#d9709a', '#e8c86a', '#7aa8e8'] }, { k: 'med', n: 2, mode: 'float', cols: ['rgba(200,160,230,.8)', 'rgba(160,210,240,.8)'] }, { k: 'est', n: 2, mode: 'ground', cols: ['#e08a58'] }] }
];
function backdrop(bi) {
  var cv = document.createElement('canvas'); cv.width = W; cv.height = H; var c = cv.getContext('2d'), B = BIOMES[bi], i, g = c.createLinearGradient(0, 0, 0, H);
  for (i = 0; i < B.sky.length; i++) g.addColorStop(B.sky[i][0], B.sky[i][1]); c.fillStyle = g; c.fillRect(0, 0, W, H);
  if (B.stars) for (i = 0; i < 70; i++) { c.fillStyle = 'rgba(255,255,230,' + R(0.12, 0.45) + ')'; c.beginPath(); c.arc(R(0, W), R(0, H * 0.5), R(0.6, 1.7), 0, 6.2832); c.fill(); }
  if (B.moon) { var mg = c.createRadialGradient(W * 0.8, H * 0.16, 0, W * 0.8, H * 0.16, H * 0.1); mg.addColorStop(0, 'rgba(235,225,185,.8)'); mg.addColorStop(0.35, 'rgba(235,225,185,.5)'); mg.addColorStop(1, 'rgba(235,225,185,0)'); c.fillStyle = mg; c.fillRect(0, 0, W, H * 0.4); }
  if (B.rays) for (i = 0; i < 5; i++) { c.fillStyle = 'rgba(160,230,240,.05)'; c.beginPath(); c.moveTo(W * (0.1 + i * 0.2), 0); c.lineTo(W * (0.2 + i * 0.2), 0); c.lineTo(W * (0.1 + i * 0.2 + 0.18), H * 0.8); c.lineTo(W * (i * 0.2 - 0.02), H * 0.8); c.fill(); }
  if (B.trunks) for (i = 0; i < 8; i++) { var tx = W * (i + 0.5) / 8 + R(-20, 20), tw = R(26, 50); c.fillStyle = 'rgba(6,24,24,' + R(0.5, 0.9) + ')'; c.fillRect(tx - tw / 2, 0, tw, H * 0.8); }
  for (i = 0; i < B.hills.length; i++) { var h = B.hills[i]; c.fillStyle = h[1]; c.beginPath(); c.moveTo(0, H); for (var x = 0; x <= W; x += 20) c.lineTo(x, H * h[0] + Math.sin(x * 0.006 + i * 2) * H * h[2] + Math.sin(x * 0.015 + i) * H * h[2] * 0.4); c.lineTo(W, H); c.fill(); }
  var gg = c.createLinearGradient(0, H * B.gz[0] - 10, 0, H); gg.addColorStop(0, B.ground[0]); gg.addColorStop(1, B.ground[1]); c.fillStyle = gg; c.fillRect(0, H * B.gz[0] - 6, W, H);
  if (B.rows) { c.strokeStyle = 'rgba(10,6,4,.35)'; c.lineWidth = 3; for (i = -6; i <= 6; i++) { c.beginPath(); c.moveTo(W / 2 + i * 12, H * B.gz[0]); c.lineTo(W / 2 + i * W * 0.14, H); c.stroke(); } }
  if (B.trunks) { var mg2 = c.createLinearGradient(0, H * 0.4, 0, H * 0.75); mg2.addColorStop(0, 'rgba(140,200,190,0)'); mg2.addColorStop(1, 'rgba(140,200,190,.1)'); c.fillStyle = mg2; c.fillRect(0, H * 0.4, W, H * 0.35); }
  return cv;
}

/* ------------------------------------------------------------------ estado del jardín */
var bi = 0, backCv = null, tool = 0, busy = false, pid = 0, BS = [], plants = [], falling = [], creatures = [], motes = [], drops = [], fingers = {}, toolIcons = {};
for (var q = 0; q < 5; q++) BS.push({ plants: [] });
function gz0() { return H * BIOMES[bi].gz[0]; } function gz1() { return H * BIOMES[bi].gz[1]; }
function depthOf(y) { return 0.75 + 0.5 * clamp((y - gz0()) / (gz1() - gz0()), 0, 1); }
function sortPlants() { plants.sort(function (a, b) { return a.y - b.y; }); }
function addPlant(type, x, y) {
  if (plants.length >= 34) { var o = 0, i; for (i = 1; i < plants.length; i++) if (plants[i].id < plants[o].id) o = i; plants.splice(o, 1); }
  plants.push({ t: type, fn: PL[type], x: x, y: y, d: depthOf(y), g: 0.03, ph: R(0, 6), bt: -1, id: ++pid, bloomed: false }); sortPlants();
  sfxPlant(); for (var k = 0; k < 4; k++) spawnSpark(x, y, R(4, 7), '#9a7a5a', R(-40, 40), R(-60, -20));
}
function grow(p, amt) {
  if (p.bloomed) return; p.g += amt;
  if (p.g >= 1) { p.g = 1; p.bloomed = true; p.bt = 0; sfxBloom(); for (var k = 0; k < 8; k++) spawnSpark(p.x + R(-30, 30), p.y - R(40, 130) * p.d * PS, R(6, 11), ['#ffe9a8', '#ffc8dc', '#c8e8ff'][k % 3], R(-40, 40), R(-70, -20)); }
}
function plantSeed(x, y) {
  var type = BIOMES[bi].seeds[tool];
  if (y >= gz0() && y <= gz1()) addPlant(type, x, y); else falling.push({ x: x, y: y, ty: R(gz0() + 10, gz1() - 6), vy: 0, type: type });
}
function drawPlant(c, p) {
  var g = p.g, sc = p.d * PS; c.save(); c.translate(p.x, p.y); c.scale(sc, sc); c.rotate(Math.sin(T * 1.2 + p.ph) * 0.025 * Math.min(1, g * 2));
  c.fillStyle = 'rgba(15,8,5,.45)'; c.beginPath(); c.ellipse(0, 2, 8 + 16 * Math.min(1, g * 3), 5, 0, 0, 6.2832); c.fill();
  if (g < 0.22) { var q = g / 0.22; stem(c, 8 + 14 * q, 3, '#5aa874', 0); leaf(c, 0, -8 - 10 * q, 8 + 8 * q, -0.5, '#6ab884'); leaf(c, 0, -8 - 10 * q, 8 + 8 * q, 3.6, '#6ab884'); }
  else { var k = (g - 0.22) / 0.78, s = 0.2 + 0.8 * (k * k * (3 - 2 * k)); if (p.bt >= 0) s *= 1 + 0.1 * Math.exp(-p.bt * 3) * Math.sin(p.bt * 14); c.scale(s, s); p.fn(c, T); }
  c.restore();
}
function icon(key, fn) {
  if (toolIcons[key]) return toolIcons[key];
  var cv = document.createElement('canvas'); cv.width = cv.height = 100; var c = cv.getContext('2d'); c.translate(50, 90); c.scale(0.5, 0.5); fn(c, 0); toolIcons[key] = cv.toDataURL('image/png'); return toolIcons[key];
}
function canDraw(c) { c.save(); c.rotate(-0.3); c.fillStyle = '#7fbad0'; c.fillRect(-48, -70, 70, 56); c.strokeStyle = '#7fbad0'; c.lineWidth = 9; c.beginPath(); c.moveTo(22, -46); c.lineTo(66, -92); c.stroke(); c.fillRect(54, -104, 24, 16); c.strokeStyle = '#a8d6e6'; c.lineWidth = 8; c.beginPath(); c.arc(-48, -44, 20, 1.57, 4.7); c.stroke(); c.restore(); }
function cloudDraw(c) { dot(c, -30, -52, 28, '#c8d4e8'); dot(c, 6, -66, 36, '#d4def0'); dot(c, 40, -52, 26, '#c8d4e8'); c.fillStyle = '#c8d4e8'; c.fillRect(-30, -52, 70, 26); c.strokeStyle = '#7fbad0'; c.lineWidth = 5; c.lineCap = 'round'; c.beginPath(); c.moveTo(-20, -14); c.lineTo(-24, 6); c.moveTo(6, -14); c.lineTo(2, 6); c.moveTo(32, -14); c.lineTo(28, 6); c.stroke(); }

/* ------------------------------------------------------------------ criaturas y partículas */
function setupBiome() {
  var B = BIOMES[bi], i, j; backCv = backdrop(bi); plants = BS[bi].plants; falling = []; creatures = []; motes = []; drops = [];
  for (i = 0; i < B.cr.length; i++) for (j = 0; j < B.cr[i].n; j++) {
    var d = B.cr[i], k = { k: d.k, mode: d.mode, col: d.cols[j % d.cols.length], col2: d.col2, x: R(60, W - 60), y: R(H * 0.2, H * 0.65), a: R(0, 6.28), ph: R(0, 6), sp: R(24, 44) * PS, vx: 0, vy: 0, dir: 1, dirx: Math.random() < 0.5 ? -1 : 1, glow: 0, pulse: 0, hop: 0, note: Math.floor(R(0, 8)) };
    if (d.mode === 'ground') k.y = R(gz0() + 14, gz1() - 6); if (d.mode === 'swim') k.sp = R(18, 34) * PS; if (d.mode === 'float') k.sp = 10;
    creatures.push(k);
  }
  for (i = 0; i < B.mote.n; i++) motes.push({ x: R(0, W), y: R(0, H), s: R(5, 12) * PS, ph: R(0, 6), boost: 0, vx: (B.mote.vx || 0) + R(-6, 6), vy: (B.mote.vy || 0) + R(-5, 5), note: i });
  buildMenu(); dotsEl.innerHTML = ''; for (i = 0; i < 5; i++) { var s = document.createElement('span'); s.className = i === bi ? 'on' : ''; dotsEl.appendChild(s); }
}
function updCreature(k, dt) {
  var B = BIOMES[bi]; k.ph += dt; k.glow = Math.max(0, k.glow - dt * 1.1); k.pulse = Math.max(0, k.pulse - dt * 2); k.hop = Math.max(0, k.hop - dt * 2.2);
  if (k.mode === 'air') { k.a += Math.sin(T * 0.7 + k.ph * 1.3) * 1.3 * dt; k.vx = Math.cos(k.a) * k.sp; k.vy = Math.sin(k.a) * k.sp * 0.6; if (k.x < 40) k.a = 0; if (k.x > W - 40) k.a = Math.PI; if (k.y < H * 0.12) k.a = 1.2; if (k.y > H * 0.7) k.a = -1.2; }
  else if (k.mode === 'ground') { k.vy = 0; k.vx = k.dirx * k.sp * 0.5 * (0.5 + 0.5 * Math.sin(T * 0.8 + k.ph)); if (k.x < 30) k.dirx = 1; if (k.x > W - 30) k.dirx = -1; }
  else if (k.mode === 'swim') { k.vx = k.dirx * k.sp; k.vy = Math.sin(T * 1.1 + k.ph) * 14; if (k.x < -30) k.dirx = 1; if (k.x > W + 30) k.dirx = -1; k.y = clamp(k.y, H * 0.12, H * 0.68); }
  else { k.vx = Math.sin(T * 0.3 + k.ph) * 14; k.vy = Math.sin(T * 0.8 + k.ph) * 16; k.y = clamp(k.y, H * 0.15, H * 0.65); }
  k.x += k.vx * dt; k.y += k.vy * dt; if (Math.abs(k.vx) > 1) k.dir = k.vx > 0 ? 1 : -1;
}
function drawCreature(c, k) {
  var s = PS * 1.35 * (1 + 0.3 * k.pulse), y = k.y - Math.sin(k.hop * 3.1416) * 22 * PS;
  if (k.glow > 0.02) { c.globalAlpha = k.glow * 0.8; var r = 46 * PS * 1.5; c.drawImage(glowTint('#fff2b0'), k.x - r, y - r, r * 2, r * 2); c.globalAlpha = 1; }
  c.save(); c.translate(k.x, y); c.scale(s * k.dir, s); CR[k.k](c, T, k); c.restore();
}
function updMote(m, dt) {
  var B = BIOMES[bi].mote; m.boost = Math.max(0, m.boost - dt * 0.9); m.x += (m.vx + Math.sin(T * 0.8 + m.ph) * 10) * dt; m.y += (m.vy + Math.cos(T * 0.6 + m.ph) * 6) * dt;
  if (m.x < -20) m.x = W + 20; if (m.x > W + 20) m.x = -20; if (m.y < -20) m.y = H + 10; if (m.y > H + 20) m.y = -10;
}
function drawMote(c, m) {
  var B = BIOMES[bi].mote, a = 0.3 + 0.35 * (0.5 + 0.5 * Math.sin(T * 1.3 + m.ph)) + m.boost * 0.5, s = m.s * (1 + m.boost * 2);
  if (B.kind === 'bubble') { c.globalAlpha = Math.min(0.8, a); c.strokeStyle = B.col; c.lineWidth = 1.6; c.beginPath(); c.arc(m.x, m.y, s * 0.8, 0, 6.2832); c.stroke(); if (m.boost > 0.05) { c.globalAlpha = m.boost * 0.7; c.drawImage(glowTint('#e8fbff'), m.x - s * 3, m.y - s * 3, s * 6, s * 6); } c.globalAlpha = 1; }
  else { c.globalAlpha = Math.min(1, a); c.drawImage(glowTint(B.col), m.x - s * 2, m.y - s * 2, s * 4, s * 4); c.globalAlpha = 1; }
}
function touchThing(x, y) {
  var i, hit = false;
  for (i = 0; i < creatures.length; i++) { var k = creatures[i]; if (dist(x, y, k.x, k.y) < 48 * PS && k.glow < 0.5) { k.glow = 1; k.pulse = 1; k.hop = 1; sfxPip(k.note); for (var j = 0; j < 5; j++) spawnSpark(k.x, k.y, R(5, 9), '#fff2b0', R(-60, 60), R(-80, -20)); hit = true; } }
  for (i = 0; i < motes.length; i++) { var m = motes[i]; if (dist(x, y, m.x, m.y) < 40 * PS && m.boost < 0.3) { m.boost = 1; sfxBell(m.note); spawnSpark(m.x, m.y, 8, BIOMES[bi].mote.col, R(-30, 30), R(-40, -10)); hit = true; } }
  return hit;
}

/* ------------------------------------------------------------------ toques */
function bindTap(el, fn) {
  var sx = 0, sy = 0, ok = false;
  el.addEventListener('touchstart', function (e) { e.preventDefault(); unlockAudio(); stopHint(); var t = e.changedTouches[0]; sx = t.clientX; sy = t.clientY; ok = true; el.className += ' press'; }, false);
  el.addEventListener('touchend', function (e) { e.preventDefault(); el.className = el.className.replace(' press', ''); if (!ok) return; ok = false; var t = e.changedTouches[0]; if (dist(t.clientX, t.clientY, sx, sy) < 18) fn(); }, false);
  el.addEventListener('touchcancel', function () { ok = false; el.className = el.className.replace(' press', ''); }, false);
  el.addEventListener('click', function () { unlockAudio(); fn(); });
}

/* botones que hay que mantener presionados (papá/mamá) */
function bindHold(el, ms, fn) {
  var timer = null;
  function start(e) { if (e.cancelable) e.preventDefault(); unlockAudio(); el.className += ' holding'; clearTimeout(timer); timer = setTimeout(function () { el.className = el.className.replace(' holding', ''); fn(); }, ms); }
  function stop() { el.className = el.className.replace(' holding', ''); clearTimeout(timer); }
  el.addEventListener('touchstart', start, false); el.addEventListener('touchend', stop, false); el.addEventListener('touchcancel', stop, false);
  el.addEventListener('mousedown', start); el.addEventListener('mouseup', stop); el.addEventListener('mouseleave', stop);
}


bindHold($('muteBtn'), 900, function () {
  muted = !muted; if (master) master.gain.value = muted ? 0 : VOL;
  $('waves').style.display = muted ? 'none' : ''; $('mutex').style.display = muted ? '' : 'none';
});
bindHold($('resetBtn'), 900, function () { BS[bi].plants.length = 0; plants = BS[bi].plants; falling = []; });
function plantNear(x, y) { for (var i = plants.length - 1; i >= 0; i--) { var p = plants[i]; if (Math.abs(p.x - x) < 36 * PS * p.d && y > p.y - 150 * PS * p.d && y < p.y + 20) return p; } return null; }
function onDown(id, x, y) {
  stopHint(); unlockAudio(); ensureBus(); padUntil = AC ? AC.currentTime + 12 : 0;
  fingers[id] = { x: x, y: y, lx: x, ly: y, rain: tool >= 4 };
  if (touchThing(x, y)) return;
  if (tool < 4) { var p = plantNear(x, y); if (p) { grow(p, 0.3); sfxDrop(); for (var k = 0; k < 4; k++) spawnSpark(p.x + R(-14, 14), p.y - R(20, 80), 5, '#9fd4f0', R(-20, 20), R(10, 50)); } else plantSeed(x, y); }
}
function onMove(id, x, y) {
  var f = fingers[id]; if (!f) return; f.x = x; f.y = y; touchThing(x, y);
  if (tool < 4 && dist(x, y, f.lx, f.ly) > 110 * PS && y >= gz0() && y <= gz1()) { f.lx = x; f.ly = y; if (!plantNear(x, y)) plantSeed(x, y); }
  padUntil = AC ? AC.currentTime + 12 : 0;
}
function onUp(id) { delete fingers[id]; }
playEl.addEventListener('touchstart', function (e) { e.preventDefault(); for (var i = 0; i < e.changedTouches.length; i++) { var t = e.changedTouches[i]; onDown(t.identifier, t.clientX, t.clientY); } }, false);
playEl.addEventListener('touchmove', function (e) { e.preventDefault(); for (var i = 0; i < e.changedTouches.length; i++) { var t = e.changedTouches[i]; onMove(t.identifier, t.clientX, t.clientY); } }, false);
function tend(e) { e.preventDefault(); for (var i = 0; i < e.changedTouches.length; i++) onUp(e.changedTouches[i].identifier); }
playEl.addEventListener('touchend', tend, false); playEl.addEventListener('touchcancel', tend, false);
var mdown = false;
playEl.addEventListener('mousedown', function (e) { mdown = true; onDown('m', e.clientX, e.clientY); });
window.addEventListener('mousemove', function (e) { if (mdown) onMove('m', e.clientX, e.clientY); });
window.addEventListener('mouseup', function () { if (mdown) { mdown = false; onUp('m'); } });
document.addEventListener('touchmove', function (e) { e.preventDefault(); }, { passive: false });
document.addEventListener('gesturestart', function (e) { e.preventDefault(); });
document.addEventListener('contextmenu', function (e) { e.preventDefault(); });

/* ------------------------------------------------------------------ menú */
var mY = 0, mMin = 0, mVel = 0, mT = null, menuEls = [], STEP = 100;
function menuSet(y) { mY = y; setT(trackEl, 'translate3d(0,' + y + 'px,0)'); }
function menuTouchStart(e) {
  e.preventDefault(); unlockAudio(); stopHint();
  var t = e.changedTouches[0]; mT = { id: t.identifier, y0: t.clientY, s: mY, ly: t.clientY, lt: now(), moved: false, tg: e.target }; mVel = 0;
}
function menuTouchMove(e) {
  e.preventDefault(); if (!mT) return; var t = touchOf(e, mT.id); if (!t) return;
  var dy = t.clientY - mT.y0; if (Math.abs(dy) > 9) mT.moved = true;
  if (!mT.moved) return;
  var ny = mT.s + dy; if (ny > 0) ny *= 0.35; if (ny < mMin) ny = mMin + (ny - mMin) * 0.35;
  var tn = now(), dtm = Math.max(1, tn - mT.lt); mVel = mVel * 0.6 + ((t.clientY - mT.ly) / dtm * 1000) * 0.4; mT.ly = t.clientY; mT.lt = tn;
  menuSet(ny);
}
function menuTouchEnd(e) {
  e.preventDefault(); if (!mT) return; var t = touchOf(e, mT.id); if (!t) return;
  var tg = mT.tg, moved = mT.moved; mT = null;
  if (!moved) { mVel = 0; var n = tg; while (n && n !== trackEl) { if (n.getAttribute && n.getAttribute('data-i') !== null) { selectFood(parseInt(n.getAttribute('data-i'), 10)); break; } n = n.parentNode; } }
}
menuEl.addEventListener('touchstart', menuTouchStart, false);
menuEl.addEventListener('touchmove', menuTouchMove, false);
menuEl.addEventListener('touchend', menuTouchEnd, false);
menuEl.addEventListener('touchcancel', function () { mT = null; }, false);
menuEl.addEventListener('wheel', function (e) { e.preventDefault(); menuSet(clamp(mY - e.deltaY, mMin, 0)); }, false);
function menuInertia(dt) {
  if (mT && mT.moved) return;
  if (mY > 0 || mY < mMin) { var b = mY > 0 ? 0 : mMin; menuSet(mY + (b - mY) * Math.min(1, dt * 12)); mVel = 0; return; }
  if (Math.abs(mVel) > 8) { menuSet(clamp(mY + mVel * dt, mMin - 40, 40)); mVel *= Math.pow(0.05, dt); } else mVel = 0;
}

function selectFood(i) { tool = i; for (var k = 0; k < menuEls.length; k++) menuEls[k].className = 'tool ico g' + (k === i ? ' sel' : ''); sfxPip(i + 2); }
function buildMenu() {
  trackEl.innerHTML = ''; menuEls = []; var B = BIOMES[bi];
  for (var i = 0; i < 6; i++) {
    var b = document.createElement('div');     var url = i < 4 ? icon(B.seeds[i], PL[B.seeds[i]]) : i === 4 ? icon('can', canDraw) : icon('cloud', cloudDraw);
    b.className = 'tool ico g'; b.style.backgroundImage = 'url(' + url + ')'; b.setAttribute('data-i', i);
    b.style.width = b.style.height = menuTs + 'px'; trackEl.appendChild(b); menuEls.push(b);
    (function (n) { b.addEventListener('click', function () { unlockAudio(); selectFood(n); }); })(i);
  }
  mY = 0; menuSet(0); selectFood(0);
}
var menuTs = 90;
function changeBiome(dir) {
  if (busy) return; busy = true; unlockAudio(); ensureBus(); stopHint(); fadeEl.style.opacity = 1; sfxBell(bi + dir + 5);
  setTimeout(function () { bi = (bi + dir + 5) % 5; setupBiome(); fadeEl.style.opacity = 0; busy = false; }, 380);
}
bindTap($('prev'), function () { changeBiome(-1); });
bindTap($('next'), function () { changeBiome(1); });

/* ------------------------------------------------------------------ pantalla y bucle */
function layout() {
  W = window.innerWidth; H = window.innerHeight; DPR = Math.min(window.devicePixelRatio || 1, 1.5); PS = clamp(H / 768, 0.7, 1.25);
  bgCv.width = W; bgCv.height = H; bgCv.style.width = W + 'px'; bgCv.style.height = H + 'px';
  fxCv.width = Math.round(W * DPR); fxCv.height = Math.round(H * DPR); fxCv.style.width = W + 'px'; fxCv.style.height = H + 'px';
  var mTop = Math.round(clamp(H * 0.08, 20, 60)), avail = H - mTop - 24, ts = Math.round(clamp(avail / 4.4 - 12, 60, 108)), ml = Math.max(4, Math.round(W * 0.008));
  menuTs = ts; STEP = ts + 12; var mh = Math.min(avail, Math.round(STEP * 4.4) + 14);
  menuEl.style.left = ml + 'px'; menuEl.style.top = mTop + 'px'; menuEl.style.width = (ts + 28) + 'px'; menuEl.style.height = mh + 'px';
  for (var k = 0; k < menuEls.length; k++) menuEls[k].style.width = menuEls[k].style.height = ts + 'px';
  mMin = Math.min(0, mh - (6 * STEP + 20)); menuSet(clamp(mY, mMin, 0));
  var toolW = ml + ts + 28 + 6, arrow = Math.round(clamp(Math.min(W, H) * 0.09, 50, 84)), pv = $('prev'), nx = $('next');
  pv.style.width = pv.style.height = nx.style.width = nx.style.height = arrow + 'px'; pv.style.top = nx.style.top = Math.round(H * 0.38) + 'px';
  pv.style.left = (toolW + 6) + 'px'; nx.style.left = (W - arrow - 10) + 'px';
  backCv = backdrop(bi);
}
function drawWorld(dt) {
  var c = bgX, i; c.clearRect(0, 0, W, H); c.drawImage(backCv, 0, 0);
  for (i = 0; i < motes.length; i++) { updMote(motes[i], dt); drawMote(c, motes[i]); }
  for (i = 0; i < plants.length; i++) { var p = plants[i]; if (!p.bloomed) grow(p, dt * 0.025); if (p.bt >= 0) p.bt += dt; drawPlant(c, p); }
  for (i = 0; i < creatures.length; i++) { updCreature(creatures[i], dt); drawCreature(c, creatures[i]); }
  for (i = falling.length - 1; i >= 0; i--) { var s = falling[i]; s.vy += 500 * dt; s.y += s.vy * dt; dot(c, s.x, s.y, 4, '#8a6a42'); if (s.y >= s.ty) { addPlant(s.type, s.x, s.ty); falling.splice(i, 1); } }
  for (var id in fingers) { var f = fingers[id]; if (!f.rain) continue; var cl = tool === 5, rad = (cl ? 95 : 55) * PS;
    if (Math.random() < dt * (cl ? 40 : 28)) drops.push({ x: f.x + R(-rad, rad) * (cl ? 1 : 0.5), y: f.y - (cl ? 30 : 0) * PS, vy: 260, life: 1 });
    for (i = 0; i < plants.length; i++) if (Math.abs(plants[i].x - f.x) < rad + 20 && plants[i].y > f.y - 10) grow(plants[i], dt * 0.35);
    sfxDrop(); c.save(); c.translate(f.x, f.y - 50 * PS); c.scale(PS * 0.6, PS * 0.6); (cl ? cloudDraw : canDraw)(c); c.restore();
  }
  c.strokeStyle = 'rgba(150,210,240,.7)'; c.lineWidth = 2.4; c.lineCap = 'round';
  for (i = drops.length - 1; i >= 0; i--) { var d = drops[i]; d.y += d.vy * dt; d.life -= dt; if (d.life <= 0 || d.y > H) { drops.splice(i, 1); continue; } c.beginPath(); c.moveTo(d.x, d.y); c.lineTo(d.x, d.y + 9); c.stroke(); }
}
function frame(ts) {
  var dt = Math.min(0.05, ((ts || 0) - last) / 1000); last = ts || 0; if (dt < 0) dt = 0.016;
  T += dt; drawWorld(dt); menuInertia(dt); padUpdate(); updateParticles(dt); drawFx();
  window.requestAnimationFrame(frame);
}
document.body.className = 'hint';
layout(); setupBiome();
var l = $('loading'); l.className = 'gone'; setTimeout(function () { l.style.display = 'none'; }, 700);
window.addEventListener('resize', function () { layout(); setupBiome(); });
window.addEventListener('orientationchange', function () { setTimeout(function () { layout(); setupBiome(); }, 250); });
window.requestAnimationFrame(frame);
if ('serviceWorker' in navigator) { window.addEventListener('load', function () { navigator.serviceWorker.register('sw.js').catch(function () {}); }); }
})();
