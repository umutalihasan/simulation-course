// ─── Constants ───────────────────────────────────────────────────────────────
const COLORS = ['#00d4ff','#ff6b35','#7fff7f','#ff4fa3','#ffd700','#b06fff','#ff9999','#00ffcc'];
const MAX_TRAJ = 20;
const G = 9.81;

// ─── State ───────────────────────────────────────────────────────────────────
let trajectories = [];
let colorIdx = 0;
let computedKeys = new Set();
let animFrame = null;
let animTraj = null;
let animIdx = 0;
let isRunning = false;

// ─── Shape selector ──────────────────────────────────────────────────────────
function selectShape(btn) {
  let cdValue = btn.dataset.cd;

  // 1. Intercept the 'input' flag
  if (cdValue === 'input') {
    cdValue = prompt(`Please enter a custom Drag Coefficient (Cd) for ${btn.dataset.name}:`);

    // 2. Safety check: if cancelled, empty, or not a valid number, abort.
    if (cdValue === null || cdValue.trim() === "" || isNaN(parseFloat(cdValue))) {
      log('Action cancelled: Invalid or no Cd value entered.', 'warn');
      return; 
    }
  }

  // 3. Update the UI only if we have a valid number
  document.querySelectorAll('.shape-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  
  // Set the display to the actual number, not the word "input"
  document.getElementById('cdDisplay').textContent = cdValue;
}

// ─── Step buttons ────────────────────────────────────────────────────────────
document.querySelectorAll('.step-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.step-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('customStep').value = btn.dataset.step;
  });
});
document.getElementById('customStep').addEventListener('input', () => {
  document.querySelectorAll('.step-btn').forEach(b => b.classList.remove('active'));
});

// ─── ISA atmosphere density ──────────────────────────────────────────────────
function getAirDensity(altMeters, model) {
  if (model === 'const') return 1.225;
  if (model === 'const129') return 1.29;
  // ISA troposphere (0–11000m)
  if (altMeters < 0) altMeters = 0;
  if (altMeters <= 11000) {
    const T = 288.15 - 0.0065 * altMeters;
    return 1.225 * Math.pow(T / 288.15, 4.2561);
  } else {
    // Stratosphere approx
    return 0.3639 * Math.exp(-0.0001576 * (altMeters - 11000));
  }
}

// ─── Physics simulation ──────────────────────────────────────────────────────
function runPhysics(v0, angleDeg, mass, cd, area, dt, y0, windSpeed, windDirDeg, atmoModel) {
  const angleRad = angleDeg * Math.PI / 180;
  const windRad = windDirDeg * Math.PI / 180;
  const windX = windSpeed * Math.cos(windRad); // horizontal wind component

  let vx = v0 * Math.cos(angleRad);
  let vy = v0 * Math.sin(angleRad);
  let x = 0, y = y0;

  const pts = [{x, y}];
  let maxH = y0;
  let steps = 0;
  const maxSteps = 20_000_000;

  while (y >= 0 && steps < maxSteps) {
    const rho = getAirDensity(y, atmoModel);
    const k = 0.5 * cd * rho * area / mass;

    // Velocity relative to wind
    const vrx = vx - windX;
    const vry = vy;
    const vr = Math.sqrt(vrx * vrx + vry * vry);

    let ax = 0, ay = -G;
    if (vr > 0) {
      ax -= k * vrx * vr;
      ay -= k * vry * vr;
    }

    vx += ax * dt;
    vy += ay * dt;
    x  += vx * dt;
    y  += vy * dt;

    if (y > maxH) maxH = y;

    if (y < 0) {
      const prev = pts[pts.length - 1];
      const frac = prev.y / (prev.y - y);
      x = prev.x + frac * (x - prev.x);
      y = 0;
    }

    // Downsample for performance
    if (steps < 50000 || steps % Math.max(1, Math.floor(steps / 5000)) === 0) {
      pts.push({x, y});
    }
    steps++;
  }

  const finalV = Math.sqrt(vx * vx + vy * vy);
  return { pts, range: x, maxH, finalV, steps };
}

// ─── Simulate ────────────────────────────────────────────────────────────────
function simulate() {
  if (isRunning) { log('Simulation already running!', 'warn'); return; }

  const dt        = parseFloat(document.getElementById('customStep').value);
  const v0        = parseFloat(document.getElementById('v0').value);
  const angle     = parseFloat(document.getElementById('angle').value);
  const mass      = parseFloat(document.getElementById('mass').value);
  const area      = parseFloat(document.getElementById('area').value);
  const y0        = parseFloat(document.getElementById('y0').value) || 0;
  const windSpeed = parseFloat(document.getElementById('windSpeed').value) || 0;
  const windDir   = parseFloat(document.getElementById('windDir').value) || 0;
  const atmo      = document.getElementById('atmoModel').value;
  const cd        = parseFloat(document.getElementById('cdDisplay').textContent);
  const shapeBtn  = document.querySelector('.shape-btn.active');
  const shapeName = shapeBtn ? shapeBtn.dataset.name : 'Custom';

  if (isNaN(dt) || dt <= 0) { log('Invalid time step!', 'warn'); return; }

  const key = `${dt}_${cd}_${atmo}_${windSpeed}_${windDir}_${v0}_${angle}_${mass}_${area}_${y0}`;
  if (computedKeys.has(key)) {
    log(`Already computed for dt=${dt} with same parameters!`, 'warn');
    return;
  }
  if (trajectories.length >= MAX_TRAJ) {
    log(`Max ${MAX_TRAJ} trajectories reached. Clear to add more.`, 'warn');
    return;
  }

  log(`Starting simulation... dt=${dt}`, 'info');

  const result = runPhysics(v0, angle, mass, cd, area, dt, y0, windSpeed, windDir, atmo);
  const color = COLORS[colorIdx % COLORS.length];
  colorIdx++;
  computedKeys.add(key);

  const entry = { dt, color, shapeName, cd, atmo, windSpeed, ...result };
  trajectories.push(entry);

  // Stats
  document.getElementById('stat-range').textContent  = result.range.toFixed(1);
  document.getElementById('stat-height').textContent = result.maxH.toFixed(2);
  document.getElementById('stat-vel').textContent    = result.finalV.toFixed(2);

  log(`─────────────────────────`);
  log(`dt = ${dt}`, 'val');
  log(`Shape: ${shapeName} (Cd=${cd})`);
  log(`Atmosphere: ${atmo}`);
  log(`Wind: ${windSpeed} m/s @ ${windDir}°`);
  log(`Range = ${result.range.toFixed(4)} m`, 'val');
  log(`Max Height = ${result.maxH.toFixed(4)} m`, 'val');
  log(`Final Speed = ${result.finalV.toFixed(4)} m/s`, 'val');
  log(`Steps = ${result.steps.toLocaleString()}`);
  log(`─────────────────────────`);

  updateTable();
  updateLegend();
  drawAllTrajectories();
  animateProjectile(entry);
}

// ─── Animated projectile ─────────────────────────────────────────────────────
function animateProjectile(traj) {
  if (animFrame) cancelAnimationFrame(animFrame);
  animTraj = traj;
  animIdx = 0;
  isRunning = true;
  document.getElementById('runBtn').disabled = true;

  function step() {
    animIdx += Math.max(1, Math.floor(traj.pts.length / 300));
    if (animIdx >= traj.pts.length) {
      animIdx = traj.pts.length - 1;
      drawAllTrajectories();
      isRunning = false;
      document.getElementById('runBtn').disabled = false;
      animTraj = null;
      return;
    }
    drawAllTrajectories(traj, animIdx);
    animFrame = requestAnimationFrame(step);
  }
  animFrame = requestAnimationFrame(step);
}

// ─── Canvas drawing ──────────────────────────────────────────────────────────
function drawAllTrajectories(activeTraj, activeIdx) {
  const cvs = document.getElementById('cvs');
  const dpr = window.devicePixelRatio || 1;
  const W = cvs.clientWidth || 860;
  const H = 400;
  cvs.width = W * dpr;
  cvs.height = H * dpr;
  const ctx = cvs.getContext('2d');
  ctx.scale(dpr, dpr);

  // Background
  ctx.fillStyle = '#020810';
  ctx.fillRect(0, 0, W, H);

  if (trajectories.length === 0) { drawEmptyGrid(ctx, W, H); return; }

  // Bounds
  let maxX = 0, maxY = 0;
  for (const t of trajectories) {
    for (const p of t.pts) {
      if (p.x > maxX) maxX = p.x;
      if (p.y > maxY) maxY = p.y;
    }
  }
  maxX = maxX || 100; maxY = maxY || 50;

  const pad = { l: 58, r: 16, t: 16, b: 38 };
  const gW = W - pad.l - pad.r;
  const gH = H - pad.t - pad.b;

  const tx = x => pad.l + (x / (maxX * 1.05)) * gW;
  const ty = y => pad.t + gH - (y / (maxY * 1.12)) * gH;

  // Grid lines
  const xTicks = 6, yTicks = 5;
  ctx.strokeStyle = 'rgba(0,212,255,0.06)';
  ctx.lineWidth = 1;
  for (let i = 0; i <= xTicks; i++) {
    const px = tx(maxX * 1.05 * i / xTicks);
    ctx.beginPath(); ctx.moveTo(px, pad.t); ctx.lineTo(px, pad.t + gH); ctx.stroke();
  }
  for (let i = 0; i <= yTicks; i++) {
    const py = ty(maxY * 1.12 * i / yTicks);
    ctx.beginPath(); ctx.moveTo(pad.l, py); ctx.lineTo(pad.l + gW, py); ctx.stroke();
  }

  // Ground
  ctx.strokeStyle = 'rgba(0,212,255,0.25)';
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(pad.l, ty(0)); ctx.lineTo(W - pad.r, ty(0)); ctx.stroke();

  // Trajectories
  for (const traj of trajectories) {
    const isActive = traj === activeTraj;
    const pts = isActive ? traj.pts.slice(0, activeIdx + 1) : traj.pts;

    ctx.beginPath();
    ctx.strokeStyle = traj.color;
    ctx.lineWidth = isActive ? 2.5 : 1.8;
    ctx.shadowColor = traj.color;
    ctx.shadowBlur = isActive ? 8 : 3;
    let first = true;
    for (const p of pts) {
      const px = tx(p.x), py = ty(p.y);
      if (first) { ctx.moveTo(px, py); first = false; }
      else ctx.lineTo(px, py);
    }
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Landing dot
    if (!isActive) {
      const last = traj.pts[traj.pts.length - 1];
      ctx.beginPath();
      ctx.arc(tx(last.x), ty(0), 4, 0, Math.PI * 2);
      ctx.fillStyle = traj.color;
      ctx.shadowColor = traj.color;
      ctx.shadowBlur = 8;
      ctx.fill();
      ctx.shadowBlur = 0;
    }

    // Max height marker
    if (!isActive) {
      let peak = traj.pts[0];
      for (const p of traj.pts) if (p.y > peak.y) peak = p;
      ctx.beginPath();
      ctx.arc(tx(peak.x), ty(peak.y), 3, 0, Math.PI * 2);
      ctx.fillStyle = traj.color;
      ctx.globalAlpha = 0.6;
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    // Animated projectile dot
    if (isActive && activeIdx !== undefined) {
      const p = traj.pts[activeIdx];
      ctx.beginPath();
      ctx.arc(tx(p.x), ty(p.y), 7, 0, Math.PI * 2);
      ctx.fillStyle = traj.color;
      ctx.shadowColor = traj.color;
      ctx.shadowBlur = 18;
      ctx.fill();
      ctx.shadowBlur = 0;

      // Speed trail
      const trailLen = Math.min(activeIdx, 15);
      for (let i = trailLen; i >= 1; i--) {
        const tp = traj.pts[activeIdx - i];
        ctx.beginPath();
        ctx.arc(tx(tp.x), ty(tp.y), 2.5 * (1 - i / trailLen), 0, Math.PI * 2);
        ctx.fillStyle = traj.color;
        ctx.globalAlpha = 0.15 * (1 - i / trailLen);
        ctx.fill();
        ctx.globalAlpha = 1;
      }
    }
  }

  // Axis labels
  ctx.fillStyle = 'rgba(74,96,128,0.9)';
  ctx.font = `10px Share Tech Mono, monospace`;
  ctx.textAlign = 'center';
  for (let i = 0; i <= xTicks; i++) {
    const val = maxX * 1.05 * i / xTicks;
    ctx.fillText(val.toFixed(0), tx(val), H - pad.b + 14);
  }
  ctx.textAlign = 'right';
  for (let i = 0; i <= yTicks; i++) {
    const val = maxY * 1.12 * i / yTicks;
    ctx.fillText(val.toFixed(0), pad.l - 5, ty(val) + 4);
  }

  ctx.save();
  ctx.translate(12, pad.t + gH / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(0,212,255,0.45)';
  ctx.font = '10px Share Tech Mono, monospace';
  ctx.fillText('HEIGHT (m)', 0, 0);
  ctx.restore();

  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(0,212,255,0.45)';
  ctx.fillText('RANGE (m)', pad.l + gW / 2, H - 4);

  document.getElementById('canvasBadge').textContent = `${trajectories.length} trajectory(ies)`;
}

function drawEmptyGrid(ctx, W, H) {
  ctx.strokeStyle = 'rgba(0,212,255,0.05)';
  ctx.lineWidth = 1;
  for (let x = 0; x < W; x += 40) { ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,H); ctx.stroke(); }
  for (let y = 0; y < H; y += 40) { ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(W,y); ctx.stroke(); }
  ctx.fillStyle = 'rgba(74,96,128,0.4)';
  ctx.font = '12px Share Tech Mono, monospace';
  ctx.textAlign = 'center';
  ctx.fillText('NO SIMULATION DATA', W/2, H/2);
}

// ─── Table ───────────────────────────────────────────────────────────────────
function updateTable() {
  const tbody = document.getElementById('resultsBody');
  if (!trajectories.length) {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:var(--muted)">Run simulations to populate table</td></tr>';
    return;
  }
  tbody.innerHTML = trajectories.map(t => `
    <tr>
      <td><span style="color:${t.color}">■</span> ${t.shapeName} (Cd=${t.cd})</td>
      <td>${t.dt}</td>
      <td class="hl">${t.range.toFixed(3)}</td>
      <td class="hl">${t.maxH.toFixed(3)}</td>
      <td class="hl">${t.finalV.toFixed(4)}</td>
      <td style="color:var(--accent4)">${t.atmo}</td>
      <td>${t.windSpeed}</td>
    </tr>
  `).join('');
}

// ─── Legend ──────────────────────────────────────────────────────────────────
function updateLegend() {
  document.getElementById('legend').innerHTML = trajectories.map(t =>
    `<div class="legend-item">
      <div class="legend-line" style="background:${t.color}"></div>
      dt=${t.dt} · ${t.shapeName}
    </div>`
  ).join('');
}

// ─── Log ─────────────────────────────────────────────────────────────────────
function log(msg, type) {
  const box = document.getElementById('logBox');
  const div = document.createElement('div');
  if (type === 'val') div.className = 'log-val';
  else if (type === 'warn') div.className = 'log-warn';
  else if (type === 'info') div.className = 'log-info';
  else div.className = 'log-sep';
  div.textContent = msg;
  box.appendChild(div);
  box.scrollTop = box.scrollHeight;
}

// ─── Clear ───────────────────────────────────────────────────────────────────
function clearAll() {
  if (isRunning) { log('Wait for simulation to finish!', 'warn'); return; }
  if (animFrame) cancelAnimationFrame(animFrame);
  trajectories = [];
  colorIdx = 0;
  computedKeys.clear();
  animTraj = null;
  document.getElementById('stat-range').textContent = '—';
  document.getElementById('stat-height').textContent = '—';
  document.getElementById('stat-vel').textContent = '—';
  document.getElementById('canvasBadge').textContent = 'NO DATA';
  document.getElementById('legend').innerHTML = '<span style="color:var(--muted);font-size:10px;font-family:\'Share Tech Mono\',monospace;">Run a simulation to see trajectories</span>';
  document.getElementById('logBox').innerHTML = '';
  updateTable();
  drawAllTrajectories();
  log('Cleared. Ready for new simulations.', 'info');
}

// ─── Resize ──────────────────────────────────────────────────────────────────
window.addEventListener('resize', () => drawAllTrajectories());

// ─── Init ────────────────────────────────────────────────────────────────────
drawAllTrajectories();
log('Simulator ready. Configure parameters and click RUN.', 'info');