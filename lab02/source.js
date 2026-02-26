// ═══════════════════════════════════════════════════════════════════════════
//  ADVANCED HEAT EQUATION SIMULATOR (C++ WEBASSEMBLY ENTEGRE EDİLDİ)
// ═══════════════════════════════════════════════════════════════════════════

// ── State ──────────────────────────────────────────────────────────────────
let centerHistory = [];   // [[t, T_center], ...]
let heatmapData   = [];   // [[T_profile_at_time_t], ...] for 2D map
let isRunning     = false;
let features      = { tdep: false, conv: false, src: false };

// ═══════════════════════════════════════════════════════════════════════════
// 1. C++ WEBASSEMBLY MOTORU (BLOB WORKER)
// ═══════════════════════════════════════════════════════════════════════════
// wasm dosyasının yolunu dinamik alıyoruz ki Blob içinden 404 hatası vermesin
const wasmUrl = new URL('engine.wasm', window.location.href).href;

const workerCode = `
let wasmInstance = null;

async function initWasm() {
  const response = await fetch('${wasmUrl}');
  const buffer = await response.arrayBuffer();
  const module = await WebAssembly.instantiate(buffer, { env: {} });
  wasmInstance = module.instance;
}

self.onmessage = async function(e) {
  if (!wasmInstance) await initWasm();

  const p = e.data;
  const totalSteps = Math.round(p.simTime / p.tau);
  const N = p.N;
  const BYTES_PER_DOUBLE = 8;
  const arrSize = (N + 1) * BYTES_PER_DOUBLE;

  // C++ tarafındaki fonksiyonları alıyoruz
  const { solve_chunk, malloc, free, memory } = wasmInstance.exports;

  // C++ belleğinde (RAM) yer ayırıyoruz
  const ptr_T     = malloc(arrSize);
  const ptr_alpha = malloc(arrSize);
  const ptr_beta  = malloc(arrSize);
  const ptr_Tnew  = malloc(arrSize);
  const ptr_Q     = malloc(arrSize);

  // Wasm belleğini JS dizisi olarak okumak için köprü
  const heapF64 = new Float64Array(memory.buffer);

  // Başlangıç değerlerini (T0, Sınırlar ve Q) C++'a yolluyoruz
  heapF64.set(p.T_init, ptr_T / BYTES_PER_DOUBLE);
  heapF64.set(p.Q, ptr_Q / BYTES_PER_DOUBLE);

  const centerIdx = Math.floor(N / 2);
  const centerHistory = [[0, heapF64[ptr_T / 8 + centerIdx]]];
  
  const getT = () => new Float64Array(heapF64.buffer, ptr_T, N + 1).slice();
  
  const heatmapData = [getT()];
  const frames = p.doFrames ? [{ t: 0, T: getT() }] : [];

  const frameStep = Math.max(1, Math.floor(totalSteps / 100));
  const animStep  = Math.max(1, Math.floor(totalSteps / 80));
  const histStep  = Math.max(1, Math.floor(totalSteps / 400));
  const progStep  = Math.max(1, Math.floor(totalSteps / 40));

  let currentStep = 0;
  
  while (currentStep < totalSteps) {
      let stepsToRun = Math.min(progStep, totalSteps - currentStep);
      
      // C++ fonksiyonu artık kaç adım attığını geri döndürüyor
      let actualSteps = solve_chunk(
          ptr_T, ptr_alpha, ptr_beta, ptr_Tnew, ptr_Q,
          N, p.h, p.tau, p.rho, p.c0, p.lam0, p.Tleft, p.Tright,
          p.tdep ? 1 : 0, p.dlam, p.dc,
          p.convParams.active ? 1 : 0,
          p.convParams.hL, p.convParams.TambL, p.convParams.hR, p.convParams.TambR,
          stepsToRun
      );

      currentStep += actualSteps;
      const t = currentStep * p.tau;

      if (currentStep % histStep === 0 || currentStep >= totalSteps) {
          centerHistory.push([t, heapF64[ptr_T / 8 + centerIdx]]);
      }
      if (currentStep % frameStep === 0 || currentStep >= totalSteps) {
          heatmapData.push(getT());
      }
      if (p.doFrames && (currentStep % animStep === 0 || currentStep >= totalSteps)) {
          frames.push({ t, T: getT() });
      }

      if (p.doFrames) {
          self.postMessage({ type: 'progress', percent: (currentStep / totalSteps) * 100 });
      }

      // EĞER C++ BİZE İSTEDİĞİMİZDEN DAHA AZ ADIM DÖNDÜRDÜYSE, ERKEN BİTMİŞ DEMEKTİR!
      if (actualSteps < stepsToRun) {
          currentStep = totalSteps; // Döngüyü kır ve işlemi sonlandır
      }
  }

  // İş bitince verileri toparla ve C++ belleğini temizle
  const finalT = getT();
  let maxT = finalT[0], minT = finalT[0];
  for(let i=1; i<=N; i++) {
      if(finalT[i] > maxT) maxT = finalT[i];
      if(finalT[i] < minT) minT = finalT[i];
  }

  free(ptr_T); free(ptr_alpha); free(ptr_beta); free(ptr_Tnew); free(ptr_Q);

  self.postMessage({
    type: 'done',
    result: {
      T: finalT, frames, N, h: p.h, totalSteps,
      centerTemp: finalT[centerIdx], maxT, minT,
      Tmin: Math.min(p.Tleft, p.Tright, p.T0_val),
      Tmax: Math.max(p.Tleft, p.Tright, p.T0_val),
      centerHistory, heatmapData
    }
  });
};
`;

const blob = new Blob([workerCode], { type: 'application/javascript' });
const workerUrl = URL.createObjectURL(blob);

// ── Feature toggles ────────────────────────────────────────────────────────
function toggleFeature(name) {
  features[name] = !features[name];
  const btn = document.getElementById(`ftab-${name}`);
  const sec = document.getElementById(`fs-${name}`);
  btn.textContent = features[name] ? 'ON' : 'OFF';
  btn.classList.toggle('on', features[name]);
  sec.classList.toggle('open', features[name]);
  log(`Feature "${name}" ${features[name] ? 'enabled' : 'disabled'}`, 'i');
}

// ── Material preset ────────────────────────────────────────────────────────
function setMat(btn) {
  document.querySelectorAll('.mat-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  if (btn.dataset.rho)  document.getElementById('rho').value    = btn.dataset.rho;
  if (btn.dataset.c)    document.getElementById('c_heat').value = btn.dataset.c;
  if (btn.dataset.lam)  document.getElementById('lambda').value = btn.dataset.lam;
  if (btn.dataset.dlam) document.getElementById('dlam').value   = btn.dataset.dlam;
  if (btn.dataset.dc)   document.getElementById('dc').value     = btn.dataset.dc;
  if (btn.dataset.name === 'Custom') {
    log('Custom material — edit ρ, c, λ fields directly', 'i');
  } else {
    log(`Material: ${btn.dataset.name} (ρ=${btn.dataset.rho}, c=${btn.dataset.c}, λ=${btn.dataset.lam})`, 'i');
  }
}

// ── Heat source Q(x) in W/m³ ──────────────────────────────────────────────
function buildSourceVector(N, h, L) {
  const Q = new Float64Array(N + 1);
  if (!features.src) return Q;

  const Q0      = parseFloat(document.getElementById('Q0').value)      || 0;
  const x0      = parseFloat(document.getElementById('Qx0').value)     || L / 2;
  const sigma   = parseFloat(document.getElementById('Qsigma').value)  || 0.01;
  const srcType = document.getElementById('srcType').value;

  for (let i = 1; i < N; i++) {
    const x = i * h;
    if (srcType === 'gaussian') {
      Q[i] = Q0 * Math.exp(-(Math.pow((x - x0) / sigma, 2)));
    } else if (srcType === 'uniform') {
      Q[i] = Q0;
    } else if (srcType === 'left') {
      Q[i] = x < L / 2 ? Q0 : 0;
    }
  }
  return Q;
}

// ═══════════════════════════════════════════════════════════════════════════
//  WASM ÇALIŞTIRICI (PARALEL THREAD DESTEKLİ)
// ═══════════════════════════════════════════════════════════════════════════
function runWorkerSimulation(tau, h_val, simTime, doFrames) {
  return new Promise((resolve) => {
    const L = parseFloat(document.getElementById('L').value);
    const N = Math.min(Math.round(L / h_val), 2000);
    if (N < 3) { resolve(null); return; }
    
    const actualH = L / N;
    const T0_val = parseFloat(document.getElementById('T0').value);
    const Tleft  = parseFloat(document.getElementById('Tleft').value);
    const Tright = parseFloat(document.getElementById('Tright').value);
    
    let T_init = new Float64Array(N + 1).fill(T0_val);
    T_init[0] = Tleft; T_init[N] = Tright;

    // HER SENARYO İÇİN YENİ BİR PARALEL ÇEKİRDEK (THREAD) YARAT
    const worker = new Worker(workerUrl);

    worker.onmessage = (e) => {
      if (e.data.type === 'progress') {
        if (doFrames) document.getElementById('prog').style.width = e.data.percent.toFixed(0) + '%';
      } else if (e.data.type === 'done') {
        worker.terminate(); // İŞ BİTİNCE ÇEKİRDEĞİ ÖLDÜR (RAM SIZINTISINI ÖNLER)
        resolve(e.data.result);
      }
    };

    worker.postMessage({
      tau: tau, h: actualH, N: N, simTime: simTime, doFrames: doFrames,
      rho: parseFloat(document.getElementById('rho').value),
      c0: parseFloat(document.getElementById('c_heat').value),
      lam0: parseFloat(document.getElementById('lambda').value),
      T0_val: T0_val, Tleft: Tleft, Tright: Tright,
      tdep: features.tdep,
      dlam: parseFloat(document.getElementById('dlam').value) || 0,
      dc: parseFloat(document.getElementById('dc').value) || 0,
      Q: buildSourceVector(N, actualH, L),
      T_init: T_init,
      convParams: {
        active: features.conv,
        hL: parseFloat(document.getElementById('hL').value) || 0,
        TambL: parseFloat(document.getElementById('TambL').value) || 20,
        hR: parseFloat(document.getElementById('hR').value) || 0,
        TambR: parseFloat(document.getElementById('TambR').value) || 20,
        dlam: parseFloat(document.getElementById('dlam').value) || 0,
        tdep: features.tdep
      }
    });
  });
}
// ── Run button ─────────────────────────────────────────────────────────────
async function runSimulation() {
  if (isRunning) return;
  isRunning = true;
  document.getElementById('runBtn').disabled = true;

  const tau     = parseFloat(document.getElementById('tau').value);
  const h       = parseFloat(document.getElementById('h').value);
  const simTime = parseFloat(document.getElementById('simTime').value);

  log(`τ=${tau}s  h=${h}m  t_sim=${simTime}s (Running in C++ Engine...)`, 'i');
  if (features.tdep) log('T-dependent λ(T), c(T) active', 'i');
  if (features.conv) log('Convection BCs active', 'i');
  if (features.src)  log('Heat source Q(x) active', 'i');

  const res = await runWorkerSimulation(tau, h, simTime, true);

  if (!res) {
    log('Too few nodes — try larger h or L', 'w');
    isRunning = false; document.getElementById('runBtn').disabled = false;
    return;
  }

  centerHistory = res.centerHistory;
  heatmapData   = res.heatmapData;

  document.getElementById('s-center').textContent = res.centerTemp.toFixed(2);
  document.getElementById('s-max').textContent    = res.maxT.toFixed(2);
  document.getElementById('s-min').textContent    = res.minT.toFixed(2);
  document.getElementById('s-steps').textContent  = res.totalSteps.toLocaleString();

  log(`Done! Center T = ${res.centerTemp.toFixed(4)} °C`, 'v');

  document.getElementById('prog').style.width = '100%';
  setTimeout(() => { document.getElementById('prog').style.width = '0%'; }, 700);

  drawHeatmap(res.Tmin, res.Tmax, simTime);
  drawTimePlot();
  animateProfile(res);
}

// ── Fill comparison table (MULTI-CORE PARALLEL EXECUTION) ─────────────────
async function runAllTable() {
  if (isRunning) { log('Wait for simulation to finish', 'w'); return; }
  isRunning = true;
  document.getElementById('runBtn').disabled = true;

  const simTime = parseFloat(document.getElementById('simTime').value);
  
  const tblTitle = document.getElementById('tblTitle');
  if (tblTitle) tblTitle.textContent = `Center Temperature at t=${simTime}s — Comparative Table (°C)`;
  else document.querySelector('.tbl-section .panel-title').textContent = `Center Temperature at t=${simTime}s — Comparative Table (°C)`;

  const tauList = [0.1, 0.01, 0.001, 0.0001];
  const hList   = [0.1, 0.01, 0.001, 0.0001];
  const tauIds  = ['01','001','0001','00001'];
  const hIds    = ['01','001','0001','00001'];

  log(`Spawning 16 Parallel C++ Threads for t=${simTime}s...`, 'i');
  let doneCount = 0;
  document.getElementById('prog').style.width = '2%';

  // Tüm görevleri tutacağımız havuz
  const tasks = [];

  for (let ti = 0; ti < 4; ti++) {
    for (let hi = 0; hi < 4; hi++) {
      const cell = document.getElementById(`c_${tauIds[ti]}_${hIds[hi]}`);
      cell.textContent = '...';
      cell.className = '';

      // await KULLANMADAN 16 İŞLEMİ AYNI ANDA (PARALEL) BAŞLATIYORUZ
      const task = runWorkerSimulation(tauList[ti], hList[hi], simTime, false).then(res => {
        if (res) {
          cell.textContent = res.centerTemp.toFixed(3) + '°C';
          cell.classList.add('done');
          log(`[Thread Done] τ=${tauList[ti]}, h=${hList[hi]} → ${res.centerTemp.toFixed(3)}°C`, 'v');
        } else {
          cell.textContent = 'N/A';
          cell.classList.add('bad');
        }
        doneCount++;
        document.getElementById('prog').style.width = ((doneCount/16)*100).toFixed(0)+'%';
      });
      tasks.push(task);
    }
  }

  // İşlemcinin tüm çekirdeklerinin işi bitirmesini bekle
  await Promise.all(tasks);

  document.getElementById('prog').style.width = '100%';
  setTimeout(() => { document.getElementById('prog').style.width = '0%'; }, 800);
  log('Table complete. Multi-Core Execution finished.', 'i');
  isRunning = false;
  document.getElementById('runBtn').disabled = false;
}
// ── Animate profile ────────────────────────────────────────────────────────
function animateProfile(res) {
  let idx = 0;
  function frame() {
    if (idx >= res.frames.length) {
      drawProfile(res.T, res.N, res.h, res.Tmin, res.Tmax,
                  parseFloat(document.getElementById('simTime').value));
      isRunning = false;
      document.getElementById('runBtn').disabled = false;
      return;
    }
    const f = res.frames[idx];
    drawProfile(f.T, res.N, res.h, res.Tmin, res.Tmax, f.t);
    idx++;
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

// ── Draw T(x) profile ─────────────────────────────────────────────────────
function drawProfile(T, N, h, Tmin, Tmax, t) {
  const cvs = document.getElementById('profileCvs');
  const dpr = window.devicePixelRatio || 1;
  const W = cvs.clientWidth || 900; const H = 260;
  cvs.width = W * dpr; cvs.height = H * dpr;
  const ctx = cvs.getContext('2d'); ctx.scale(dpr, dpr);

  ctx.fillStyle = '#020810'; ctx.fillRect(0, 0, W, H);

  const pad = { l: 52, r: 18, t: 28, b: 36 };
  const gW = W - pad.l - pad.r, gH = H - pad.t - pad.b;
  const Tr = Tmax - Tmin || 1;
  const L  = parseFloat(document.getElementById('L').value);

  const tx = i  => pad.l + (i / N) * gW;
  const ty = Tv => pad.t + gH - ((Tv - Tmin) / Tr) * gH;

  ctx.strokeStyle = 'rgba(0,229,255,0.05)'; ctx.lineWidth = 1;
  for (let i = 0; i <= 5; i++) {
    ctx.beginPath(); ctx.moveTo(pad.l + gW*i/5, pad.t); ctx.lineTo(pad.l + gW*i/5, pad.t+gH); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(pad.l, pad.t + gH*i/5); ctx.lineTo(pad.l+gW, pad.t + gH*i/5); ctx.stroke();
  }

  if (features.src) {
    const Q0 = parseFloat(document.getElementById('Q0').value);
    const x0 = parseFloat(document.getElementById('Qx0').value);
    const sig = parseFloat(document.getElementById('Qsigma').value);
    const srcType = document.getElementById('srcType').value;
    ctx.save();
    ctx.globalAlpha = 0.12;
    ctx.fillStyle = Q0 > 0 ? '#ff6d00' : '#2979ff';
    for (let i = 1; i < N; i++) {
      const x = i * (L / N);
      let q = 0;
      if (srcType === 'gaussian') q = Math.exp(-(Math.pow((x - x0) / sig, 2)));
      else if (srcType === 'uniform') q = 1;
      else if (srcType === 'left') q = x < L/2 ? 1 : 0;
      if (q > 0.01) ctx.fillRect(tx(i) - 1, pad.t, 2, gH * q);
    }
    ctx.restore();
  }

  const grad = ctx.createLinearGradient(pad.l, 0, pad.l + gW, 0);
  grad.addColorStop(0,   '#2979ff');
  grad.addColorStop(0.35,'#00e5ff');
  grad.addColorStop(0.65,'#ffd600');
  grad.addColorStop(1,   '#ff6d00');
  ctx.beginPath();
  ctx.moveTo(tx(0), pad.t + gH);
  for (let i = 0; i <= N; i++) ctx.lineTo(tx(i), ty(T[i]));
  ctx.lineTo(tx(N), pad.t + gH);
  ctx.closePath();
  ctx.fillStyle = grad; ctx.globalAlpha = 0.13; ctx.fill(); ctx.globalAlpha = 1;

  ctx.beginPath(); ctx.strokeStyle = '#00e5ff'; ctx.lineWidth = 2.2;
  ctx.shadowColor = '#00e5ff'; ctx.shadowBlur = 5;
  for (let i = 0; i <= N; i++) i === 0 ? ctx.moveTo(tx(i), ty(T[i])) : ctx.lineTo(tx(i), ty(T[i]));
  ctx.stroke(); ctx.shadowBlur = 0;

  const ci = Math.floor(N / 2);
  ctx.beginPath(); ctx.arc(tx(ci), ty(T[ci]), 5, 0, Math.PI*2);
  ctx.fillStyle = '#69ff47'; ctx.shadowColor = '#69ff47'; ctx.shadowBlur = 10; ctx.fill(); ctx.shadowBlur = 0;

  if (features.conv) {
    ctx.font = '9px JetBrains Mono, monospace'; ctx.fillStyle = '#ff4081'; ctx.textAlign = 'center';
    ctx.fillText('↕ CONV', tx(0), pad.t - 6);
    ctx.fillText('↕ CONV', tx(N), pad.t - 6);
  }

  ctx.fillStyle = 'rgba(74,80,128,0.9)'; ctx.font = '9px JetBrains Mono, monospace';
  ctx.textAlign = 'right';
  for (let i = 0; i <= 4; i++) {
    const v = Tmin + Tr * i / 4;
    ctx.fillText(v.toFixed(0) + '°', pad.l - 4, ty(v) + 3);
  }
  ctx.textAlign = 'center';
  for (let i = 0; i <= 5; i++) ctx.fillText((L * i / 5).toFixed(3), tx(N * i / 5), H - pad.b + 13);
  ctx.fillStyle = 'rgba(0,229,255,0.4)'; ctx.font = '9px JetBrains Mono, monospace';
  ctx.fillText('x (m)', pad.l + gW/2, H - 2);

  document.getElementById('tDisp').textContent = `t = ${t.toFixed(3)} s`;
  document.getElementById('cbMin').textContent  = Tmin.toFixed(0) + '°C';
  document.getElementById('cbMax').textContent  = Tmax.toFixed(0) + '°C';
}

// ── Draw center T vs time ──────────────────────────────────────────────────
function drawTimePlot() {
  const cvs = document.getElementById('timeCvs');
  const dpr = window.devicePixelRatio || 1;
  const W = cvs.clientWidth || 500; const H = 190;
  cvs.width = W * dpr; cvs.height = H * dpr;
  const ctx = cvs.getContext('2d'); ctx.scale(dpr, dpr);
  ctx.fillStyle = '#020810'; ctx.fillRect(0, 0, W, H);
  if (centerHistory.length < 2) return;

  const pad = { l: 50, r: 14, t: 28, b: 34 };
  const gW = W - pad.l - pad.r, gH = H - pad.t - pad.b;
  const maxT  = centerHistory[centerHistory.length - 1][0];
  const temps = centerHistory.map(p => p[1]);
  const minTv = Math.min(...temps), maxTv = Math.max(...temps);
  const Tr = maxTv - minTv || 1;

  const tx = t  => pad.l + (t / maxT) * gW;
  const ty = Tv => pad.t + gH - ((Tv - minTv) / Tr) * gH;

  ctx.strokeStyle = 'rgba(0,229,255,0.05)'; ctx.lineWidth = 1;
  for (let i = 0; i <= 4; i++) {
    ctx.beginPath(); ctx.moveTo(pad.l + gW*i/4, pad.t); ctx.lineTo(pad.l + gW*i/4, pad.t+gH); ctx.stroke();
  }

  ctx.beginPath(); ctx.strokeStyle = '#69ff47'; ctx.lineWidth = 1.8;
  ctx.shadowColor = '#69ff47'; ctx.shadowBlur = 4;
  centerHistory.forEach(([t, T], i) => i === 0 ? ctx.moveTo(tx(t),ty(T)) : ctx.lineTo(tx(t),ty(T)));
  ctx.stroke(); ctx.shadowBlur = 0;

  ctx.fillStyle = 'rgba(74,80,128,0.85)'; ctx.font = '9px JetBrains Mono, monospace';
  ctx.textAlign = 'right';
  for (let i = 0; i <= 3; i++) {
    const v = minTv + Tr*i/3; ctx.fillText(v.toFixed(1)+'°', pad.l-4, ty(v)+3);
  }
  ctx.textAlign = 'center';
  for (let i = 0; i <= 4; i++) ctx.fillText((maxT*i/4).toFixed(2)+'s', tx(maxT*i/4), H-pad.b+12);
  ctx.fillStyle = 'rgba(0,229,255,0.35)'; ctx.font = '9px JetBrains Mono, monospace';
  ctx.fillText('time (s)', pad.l + gW/2, H - 2);
}

// ── Draw 2D space–time heatmap ─────────────────────────────────────────────
function drawHeatmap(Tmin, Tmax, simTime) {
  const cvs = document.getElementById('heatmapCvs');
  const dpr = window.devicePixelRatio || 1;
  const W = cvs.clientWidth || 500; const H = 190;
  cvs.width = W * dpr; cvs.height = H * dpr;
  const ctx = cvs.getContext('2d'); ctx.scale(dpr, dpr);
  ctx.fillStyle = '#020810'; ctx.fillRect(0, 0, W, H);

  if (heatmapData.length < 2) return;

  const pad = { l: 50, r: 14, t: 28, b: 34 };
  const gW = W - pad.l - pad.r, gH = H - pad.t - pad.b;
  const Tr = Tmax - Tmin || 1;

  const rows = heatmapData.length;
  const cols = heatmapData[0].length;
  const cellW = gW / cols;
  const cellH = gH / rows;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const T = heatmapData[r][c];
      const frac = Math.max(0, Math.min(1, (T - Tmin) / Tr));
      ctx.fillStyle = tempToColor(frac);
      ctx.fillRect(
        pad.l + c * cellW,
        pad.t + (rows - 1 - r) * cellH, 
        Math.ceil(cellW) + 1,
        Math.ceil(cellH) + 1
      );
    }
  }

  const L = parseFloat(document.getElementById('L').value);
  ctx.fillStyle = 'rgba(74,80,128,0.85)'; ctx.font = '9px JetBrains Mono, monospace';
  ctx.textAlign = 'center';
  for (let i = 0; i <= 4; i++) ctx.fillText((L * i / 4).toFixed(3), pad.l + gW*i/4, H - pad.b + 12);
  
  ctx.textAlign = 'right';
  ctx.fillText(simTime.toFixed(1)+'s', pad.l - 4, pad.t + 8);
  ctx.fillText('0s', pad.l - 4, pad.t + gH);

  ctx.fillStyle = 'rgba(0,229,255,0.35)';
  ctx.textAlign = 'center';
  ctx.fillText('x (m)', pad.l + gW/2, H - 2);
  ctx.save();
  ctx.translate(10, pad.t + gH/2); ctx.rotate(-Math.PI/2);
  ctx.textAlign = 'center'; ctx.fillText('time (s)', 0, 0);
  ctx.restore();
}

// ── Temperature → RGB color ────────────────────────────────────────────────
function tempToColor(frac) {
  const stops = [
    [41, 121, 255],   // 0.0 Dark Blue
    [0, 229, 255],    // 0.25 Cyan
    [105, 255, 71],   // 0.50 Green
    [255, 214, 0],    // 0.75 Yellow
    [255, 109, 0],    // 1.00 Orange
  ];
  const n = stops.length - 1;
  const pos = Math.max(0, Math.min(1, frac)) * n; 
  const lo  = Math.floor(pos);
  const hi  = Math.min(lo + 1, n);
  const t   = pos - lo;
  
  const a = stops[lo];
  const b = stops[hi];
  
  const r    = Math.round(a[0] + t * (b[0] - a[0]));
  const g    = Math.round(a[1] + t * (b[1] - a[1]));
  const bVal = Math.round(a[2] + t * (b[2] - a[2]));
  
  return `rgb(${r},${g},${bVal})`;
}

// ── Clear ──────────────────────────────────────────────────────────────────
function clearAll() {
  centerHistory = []; heatmapData = [];
  ['s-center','s-max','s-min','s-steps'].forEach(id => document.getElementById(id).textContent = '—');
  document.getElementById('tDisp').textContent = 't = 0.000 s';
  document.getElementById('logBox').innerHTML  = '';
  document.querySelectorAll('#tblBody td:not(.rh)').forEach(td => {
    td.textContent = '—'; td.classList.remove('done','bad');
  });
  ['profileCvs','timeCvs','heatmapCvs'].forEach(id => {
    const c = document.getElementById(id);
    c.getContext('2d').clearRect(0, 0, c.width, c.height);
  });
  log('Cleared.', 'i');
}

// ── Log ────────────────────────────────────────────────────────────────────
function log(msg, type) {
  const box = document.getElementById('logBox');
  const div = document.createElement('div');
  div.className = type === 'i' ? 'li' : type === 'v' ? 'lv' : type === 'w' ? 'lw' : '';
  div.textContent = '› ' + msg;
  box.appendChild(div); box.scrollTop = box.scrollHeight;
}

// ── Expose functions to global scope ───────────────────────────────────────
window.setMat          = setMat;
window.toggleFeature   = toggleFeature;
window.runSimulation   = runSimulation;
window.runAllTable     = runAllTable;
window.clearAll        = clearAll;

['rho','c_heat','lambda'].forEach(id => {
  document.getElementById(id).addEventListener('input', () => {
    document.querySelectorAll('.mat-btn').forEach(b => b.classList.remove('active'));
    document.getElementById('mat-custom').classList.add('active');
  });
});

log('C++ WebAssembly Engine initialized! Ready for Hyper-Speed.', 'i');
window.addEventListener('resize', () => { drawTimePlot(); });