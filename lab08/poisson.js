/**
 * poisson.js - Lab 08
 * Simple Poisson event stream for server request arrivals.
 */

const POISSON_LOCALE = "tr-TR";
const POISSON_INT_FORMATTER = new Intl.NumberFormat(POISSON_LOCALE);
const POISSON_EVENT_BUDGET = 750000;

let poissonDistributionChart = null;
let poissonTimelineChart = null;
window.lastPoissonResult = null;

class MCG {
  constructor(seed = 12345) {
    this.modulus = 2147483647;
    this.multiplier = 48271;
    this.reset(seed);
  }

  reset(seed) {
    this.state = Math.floor(Math.abs(seed)) % this.modulus;
    if (this.state === 0) this.state = 1;
  }

  next() {
    this.state = (this.multiplier * this.state) % this.modulus;
    return this.state / this.modulus;
  }
}

function formatCount(value) {
  return POISSON_INT_FORMATTER.format(Math.round(value));
}

function formatFixed(value, digits = 4) {
  return Number(value).toFixed(digits);
}

function empiricalMean(samples) {
  if (samples.length === 0) return 0;
  return samples.reduce((sum, value) => sum + value, 0) / samples.length;
}

function empiricalVariance(samples) {
  if (samples.length <= 1) return 0;
  const mean = empiricalMean(samples);
  return samples.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (samples.length - 1);
}

function relativeError(theoretical, empirical) {
  if (Math.abs(theoretical) < 1e-12) return null;
  return Math.abs(theoretical - empirical) / Math.abs(theoretical) * 100;
}

function formatDeviation(theoretical, empirical) {
  const error = relativeError(theoretical, empirical);
  if (error === null) return `|delta| = ${Math.abs(theoretical - empirical).toFixed(4)}`;
  return `delta = ${error.toFixed(1)}%`;
}

function setPoissonAlert(kind = "", message = "") {
  const alert = document.getElementById("p-alert");
  if (!alert) return;

  alert.className = "alert";
  alert.textContent = "";
  if (!message) return;

  alert.classList.add(kind);
  alert.textContent = message;
}

function randomSeedPoisson() {
  const input = document.getElementById("p-seed");
  if (input) input.value = Math.floor(Math.random() * 100000000) + 1;
}

function destroyPoissonCharts() {
  if (poissonDistributionChart) {
    poissonDistributionChart.destroy();
    poissonDistributionChart = null;
  }

  if (poissonTimelineChart) {
    poissonTimelineChart.destroy();
    poissonTimelineChart = null;
  }
}

function simulatePoissonInterval(lambda, T, rng, collectEvents = false) {
  const eventTimes = [];
  let time = 0;
  let count = 0;

  while (time < T) {
    let u = rng.next();
    if (u <= 0) u = Number.MIN_VALUE;

    const tau = -Math.log(u) / lambda;
    time += tau;

    if (time <= T) {
      count++;
      if (collectEvents) eventTimes.push(time);
    }
  }

  return { count, eventTimes };
}

function simulatePoissonExperiments(lambda, T, N, seed) {
  const rng = new MCG(seed);
  const counts = new Array(N);
  let previewEvents = [];

  for (let i = 0; i < N; i++) {
    const result = simulatePoissonInterval(lambda, T, rng, i === 0);
    counts[i] = result.count;
    if (i === 0) previewEvents = result.eventTimes;
  }

  return { counts, previewEvents };
}

function getUnitMeta(unit) {
  if (unit === "hours") {
    return {
      key: "hours",
      label: "hours",
      shortLabel: "h",
      toMinutes: 60,
    };
  }

  return {
    key: "minutes",
    label: "minutes",
    shortLabel: "min",
    toMinutes: 1,
  };
}

function logGamma(z) {
  const coefficients = [
    676.5203681218851,
    -1259.1392167224028,
    771.3234287776531,
    -176.6150291621406,
    12.507343278686905,
    -0.13857109526572012,
    9.984369578019572e-6,
    1.5056327351493116e-7,
  ];

  if (z < 0.5) {
    return Math.log(Math.PI) - Math.log(Math.sin(Math.PI * z)) - logGamma(1 - z);
  }

  let x = 0.9999999999998099;
  const shifted = z - 1;

  for (let i = 0; i < coefficients.length; i++) {
    x += coefficients[i] / (shifted + i + 1);
  }

  const t = shifted + coefficients.length - 0.5;
  return 0.5 * Math.log(2 * Math.PI) + (shifted + 0.5) * Math.log(t) - t + Math.log(x);
}

function poissonProbabilityAt(k, mu) {
  if (k < 0) return 0;
  if (mu === 0) return k === 0 ? 1 : 0;
  return Math.exp(k * Math.log(mu) - mu - logGamma(k + 1));
}

function poissonRangeProbability(mu, start, end) {
  let sum = 0;
  for (let k = start; k <= end; k++) {
    sum += poissonProbabilityAt(k, mu);
  }
  return sum;
}

function createPoissonBins(counts, mu) {
  const minObserved = Math.min(...counts);
  const maxObserved = Math.max(...counts);
  const sigma = Math.sqrt(Math.max(mu, 1));
  const theoreticalMin = Math.floor(mu - 4.5 * sigma - 4);
  const theoreticalMax = Math.ceil(mu + 4.5 * sigma + 4);
  const rangeStart = Math.max(0, Math.min(minObserved, theoreticalMin));
  const rangeEnd = Math.max(maxObserved, theoreticalMax, rangeStart);
  const span = rangeEnd - rangeStart + 1;
  const targetBins = 72;
  const binWidth = Math.max(1, Math.ceil(span / targetBins));
  const bins = [];

  for (let start = rangeStart; start <= rangeEnd; start += binWidth) {
    bins.push({
      start,
      end: Math.min(start + binWidth - 1, rangeEnd),
    });
  }

  return {
    bins,
    binWidth,
    rangeStart,
    rangeEnd,
    grouped: binWidth > 1,
  };
}

function buildPoissonDistribution(counts, mu) {
  const binInfo = createPoissonBins(counts, mu);
  const observedCounts = new Array(binInfo.bins.length).fill(0);

  for (const count of counts) {
    const index = Math.min(
      binInfo.bins.length - 1,
      Math.max(0, Math.floor((count - binInfo.rangeStart) / binInfo.binWidth))
    );
    observedCounts[index]++;
  }

  const labels = binInfo.bins.map((bin) => {
    if (bin.start === bin.end) return String(bin.start);
    return `${bin.start}-${bin.end}`;
  });
  const empiricalProbs = observedCounts.map((count) => count / counts.length);
  const theoreticalProbs = binInfo.bins.map((bin) => poissonRangeProbability(mu, bin.start, bin.end));

  return {
    labels,
    observedCounts,
    empiricalProbs,
    theoreticalProbs,
    maxK: binInfo.rangeEnd,
    hasTail: false,
    grouped: binInfo.grouped,
    binWidth: binInfo.binWidth,
    rangeStart: binInfo.rangeStart,
    rangeEnd: binInfo.rangeEnd,
  };
}

function createPoissonStatTile(label, value, foot) {
  return `
    <article class="stat-tile">
      <div class="tile-label">${label}</div>
      <div class="tile-value">${value}</div>
      <div class="tile-foot">${foot}</div>
    </article>
  `;
}

function createTimelinePoints(eventTimes, T) {
  const points = [{ x: 0, y: 0 }];
  eventTimes.forEach((time, index) => {
    points.push({ x: time, y: index });
    points.push({ x: time, y: index + 1 });
  });
  points.push({ x: T, y: eventTimes.length });
  return points;
}

function renderPoissonCharts(data) {
  if (typeof Chart === "undefined") return;

  const distributionCanvas = document.getElementById("p-distribution-chart");
  const timelineCanvas = document.getElementById("p-timeline-chart");
  if (!distributionCanvas || !timelineCanvas) return;

  destroyPoissonCharts();

  poissonDistributionChart = new Chart(distributionCanvas, {
    type: "bar",
    data: {
      labels: data.distribution.labels,
      datasets: [
        {
          label: "Empirical probability",
          data: data.distribution.empiricalProbs,
          backgroundColor: "rgba(31, 111, 255, 0.62)",
          borderColor: "rgba(23, 79, 184, 1)",
          borderWidth: 1.5,
          borderRadius: 9,
        },
        {
          type: "line",
          label: "Theoretical Poisson probability",
          data: data.distribution.theoreticalProbs,
          borderColor: "rgba(47, 158, 115, 1)",
          backgroundColor: "rgba(47, 158, 115, 0.12)",
          pointRadius: 2,
          borderWidth: 2.5,
          tension: 0.25,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      plugins: {
        legend: {
          labels: {
            color: "#5f728d",
            font: { family: "'Outfit', sans-serif", size: 12, weight: 700 },
          },
        },
      },
      scales: {
        x: {
          ticks: {
            color: "#7a8ca8",
            maxRotation: 0,
            autoSkip: true,
            maxTicksLimit: 18,
          },
          grid: { display: false },
          title: {
            display: true,
            text: "Number of requests k in interval T",
            color: "#5f728d",
            font: { family: "'Outfit', sans-serif", size: 12, weight: 700 },
          },
        },
        y: {
          beginAtZero: true,
          ticks: { color: "#7a8ca8" },
          grid: { color: "rgba(219, 229, 244, 0.78)" },
          title: {
            display: true,
            text: "Probability",
            color: "#5f728d",
            font: { family: "'Outfit', sans-serif", size: 12, weight: 700 },
          },
        },
      },
    },
  });

  poissonTimelineChart = new Chart(timelineCanvas, {
    type: "line",
    data: {
      datasets: [
        {
          label: "Request count in first simulated interval",
          data: createTimelinePoints(data.previewEvents, data.T),
          borderColor: "rgba(233, 139, 40, 1)",
          backgroundColor: "rgba(233, 139, 40, 0.12)",
          pointRadius: 0,
          borderWidth: 2.5,
          stepped: true,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      plugins: {
        legend: {
          labels: {
            color: "#5f728d",
            font: { family: "'Outfit', sans-serif", size: 12, weight: 700 },
          },
        },
      },
      scales: {
        x: {
          type: "linear",
          min: 0,
          max: data.T,
          ticks: {
            color: "#7a8ca8",
            callback(value) {
              return formatFixed(value, Number.isInteger(value) ? 0 : 2);
            },
          },
          grid: { color: "rgba(219, 229, 244, 0.78)" },
          title: {
            display: true,
            text: "Time (minutes)",
            color: "#5f728d",
            font: { family: "'Outfit', sans-serif", size: 12, weight: 700 },
          },
        },
        y: {
          beginAtZero: true,
          ticks: {
            color: "#7a8ca8",
            precision: 0,
          },
          grid: { color: "rgba(219, 229, 244, 0.78)" },
          title: {
            display: true,
            text: "Cumulative requests",
            color: "#5f728d",
            font: { family: "'Outfit', sans-serif", size: 12, weight: 700 },
          },
        },
      },
    },
  });
}

function renderPoissonResults(data) {
  const container = document.getElementById("p-results");
  if (!container) return;

  const meanError = relativeError(data.theoreticalMean, data.empiricalMean);
  const varianceError = relativeError(data.theoreticalVariance, data.empiricalVariance);
  const closeMean = meanError !== null && meanError < 8;
  const closeVariance = varianceError !== null && varianceError < 12;
  const conclusion = closeMean && closeVariance
    ? "The empirical request-count distribution is close to the theoretical Poisson model for the selected interval."
    : "The empirical values still differ from the theoretical Poisson model; increasing N usually improves the agreement.";
  const groupingNote = data.distribution.grouped
    ? `For this large expected count, neighboring request counts are grouped into bins of ${data.distribution.binWidth} values so the distribution around mu remains visible.`
    : "Each bar represents one exact request count k.";

  const tableLimit = Math.min(data.distribution.labels.length, 34);
  const rows = data.distribution.labels.slice(0, tableLimit).map((label, index) => `
    <tr>
      <td>${label}</td>
      <td>${formatCount(data.distribution.observedCounts[index])}</td>
      <td>${formatFixed(data.distribution.empiricalProbs[index], 5)}</td>
      <td>${formatFixed(data.distribution.theoreticalProbs[index], 5)}</td>
    </tr>
  `).join("");

  const hiddenRows = data.distribution.labels.length - tableLimit;

  container.innerHTML = `
    <div class="result-shell">
      <section class="chart-card">
        <div class="chart-header">
          <div>
            <div class="chart-kicker">Poisson request flow</div>
            <h3 class="chart-title">Empirical distribution of request counts</h3>
            <p class="chart-caption">
              Each experiment simulates a server request stream during interval T.
              Bars show empirical probabilities, while the line shows the theoretical Poisson distribution.
              ${groupingNote}
            </p>
          </div>
          <div class="chart-meta">
            <span class="meta-pill">N = ${formatCount(data.N)}</span>
            <span class="meta-pill">lambda = ${formatFixed(data.lambda, 4)} / min</span>
            <span class="meta-pill">T = ${formatFixed(data.inputT, 4)} ${data.unitLabel}</span>
            <span class="meta-pill">T = ${formatFixed(data.T, 4)} min</span>
            <span class="meta-pill">mu = lambdaT = ${formatFixed(data.mu, 4)}</span>
            ${data.distribution.grouped ? `<span class="meta-pill">bin = ${data.distribution.binWidth} counts</span>` : ""}
          </div>
        </div>
        <canvas id="p-distribution-chart"></canvas>
      </section>

      <div class="metrics-grid">
        ${createPoissonStatTile("Theoretical mean E[N(T)]", formatFixed(data.theoreticalMean, 4), "For Poisson: E = lambdaT")}
        ${createPoissonStatTile("Empirical mean", formatFixed(data.empiricalMean, 4), formatDeviation(data.theoreticalMean, data.empiricalMean))}
        ${createPoissonStatTile("Theoretical variance Var[N(T)]", formatFixed(data.theoreticalVariance, 4), "For Poisson: Var = lambdaT")}
        ${createPoissonStatTile("Empirical variance", formatFixed(data.empiricalVariance, 4), formatDeviation(data.theoreticalVariance, data.empiricalVariance))}
      </div>

      <div class="dual-chart-grid">
        <section class="chart-card compact-chart-card">
          <div class="chart-header">
            <div>
              <div class="chart-kicker">First interval preview</div>
              <h3 class="chart-title">Cumulative requests over time</h3>
              <p class="chart-caption">
                The first simulated interval is shown as a step function. Each vertical jump is one request arrival.
              </p>
            </div>
          </div>
          <canvas id="p-timeline-chart"></canvas>
        </section>

        <section class="test-card">
          <h3>Statistical interpretation</h3>
          <p>
            In a simple Poisson flow, the number of events in an interval of length T follows
            N(T) ~ Pois(lambdaT). Therefore, the theoretical mean and variance are equal.
          </p>
          <div class="test-grid">
            <div class="test-metric">
              <span>First interval count</span>
              <strong>${formatCount(data.previewEvents.length)}</strong>
            </div>
            <div class="test-metric">
              <span>Max observed count</span>
              <strong>${formatCount(data.maxObserved)}</strong>
            </div>
            <div class="test-metric">
              <span>Zero-request intervals</span>
              <strong>${formatCount(data.zeroCount)}</strong>
            </div>
          </div>
          <p>${conclusion}</p>
        </section>
      </div>

      <aside class="status-card">
        <div>
          <span class="status-badge">Conclusion</span>
          <div class="status-headline">${conclusion}</div>
          <p>
            The lecture property is visible here: for a Poisson flow, event counts over equal-length intervals
            are Poisson-distributed with parameter mu = lambdaT.
          </p>
        </div>
        <div class="status-extra">
          Re-run with a larger number of experiments to make the empirical distribution, mean, and variance
          more stable.
        </div>
      </aside>

      <section class="table-card">
        <h3>Distribution table</h3>
        <p>
          The table compares the empirical probability of observing k requests in interval T with the theoretical Poisson probability.
          ${groupingNote}
        </p>
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>${data.distribution.grouped ? "Request-count range" : "k requests"}</th>
                <th>Observed intervals</th>
                <th>Empirical P</th>
                <th>Theoretical P</th>
              </tr>
            </thead>
            <tbody>
              ${rows}
              ${hiddenRows > 0 ? `<tr><td colspan="4">${hiddenRows} additional rows are hidden in the table to keep it readable.</td></tr>` : ""}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  `;

  renderPoissonCharts(data);
}

function runPoissonSimulation() {
  setPoissonAlert();

  const lambda = parseFloat(document.getElementById("p-lambda").value);
  const inputT = parseFloat(document.getElementById("p-interval").value);
  const N = parseInt(document.getElementById("p-sample-size").value, 10);
  const seed = parseInt(document.getElementById("p-seed").value, 10) || 42;
  const unitMeta = getUnitMeta(document.getElementById("p-unit").value);

  if (!Number.isFinite(lambda) || lambda <= 0) {
    setPoissonAlert("err", "Request intensity lambda must be a positive number.");
    return;
  }

  if (!Number.isFinite(inputT) || inputT <= 0) {
    setPoissonAlert("err", "Interval length T must be a positive number.");
    return;
  }

  if (!Number.isFinite(N) || N <= 0) {
    setPoissonAlert("err", "Number of experiments N must be a positive integer.");
    return;
  }

  const T = inputT * unitMeta.toMinutes;
  const mu = lambda * T;
  const estimatedEvents = mu * N;
  if (estimatedEvents > POISSON_EVENT_BUDGET) {
    setPoissonAlert(
      "err",
      `The selected parameters imply about ${formatCount(estimatedEvents)} generated events. Reduce lambda, T, or N for an interactive browser simulation.`
    );
    return;
  }

  const simulation = simulatePoissonExperiments(lambda, T, N, seed);
  const mean = empiricalMean(simulation.counts);
  const variance = empiricalVariance(simulation.counts);
  const distribution = buildPoissonDistribution(simulation.counts, mu);

  const result = {
    type: "poisson",
    lambda,
    inputT,
    T,
    unit: unitMeta.shortLabel,
    unitLabel: unitMeta.label,
    timeUnit: unitMeta.key,
    N,
    seed,
    mu,
    counts: simulation.counts,
    previewEvents: simulation.previewEvents,
    distribution,
    theoreticalMean: mu,
    theoreticalVariance: mu,
    empiricalMean: mean,
    empiricalVariance: variance,
    maxObserved: Math.max(...simulation.counts),
    zeroCount: simulation.counts.filter((count) => count === 0).length,
  };

  window.lastPoissonResult = result;
  renderPoissonResults(result);
}

function buildPoissonCSV(data) {
  const lines = [];
  lines.push("Lab 8,Poisson Server Request Flow");
  lines.push(`Generated at,${new Date().toLocaleString("en-US")}`);
  lines.push(`lambda,${data.lambda}`);
  lines.push("lambda unit,requests per minute");
  lines.push(`Input T,${data.inputT}`);
  lines.push(`Input time unit,${data.unitLabel}`);
  lines.push(`T in minutes,${data.T}`);
  lines.push(`N,${data.N}`);
  lines.push(`seed,${data.seed}`);
  lines.push(`mu=lambda*T,${data.mu}`);
  lines.push(`Theoretical mean,${data.theoreticalMean}`);
  lines.push(`Empirical mean,${data.empiricalMean}`);
  lines.push(`Theoretical variance,${data.theoreticalVariance}`);
  lines.push(`Empirical variance,${data.empiricalVariance}`);
  lines.push("");
  lines.push("k,Observed intervals,Empirical probability,Theoretical probability");

  data.distribution.labels.forEach((label, index) => {
    lines.push([
      label,
      data.distribution.observedCounts[index],
      data.distribution.empiricalProbs[index].toFixed(8),
      data.distribution.theoreticalProbs[index].toFixed(8),
    ].join(","));
  });

  return lines.join("\r\n");
}

function downloadPoissonCSV() {
  if (!window.lastPoissonResult) {
    window.alert("Run the Poisson server request simulation first.");
    return;
  }

  const blob = new Blob([buildPoissonCSV(window.lastPoissonResult)], {
    type: "text/csv;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "lab8_poisson_server_flow.csv";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function normalizePositiveIntegerString(value) {
  if (value === "") return "";
  const parsed = parseInt(value, 10);
  if (!Number.isFinite(parsed)) return value;
  return String(parsed);
}

function syncPoissonSampleGroup(source = "sync") {
  const group = document.querySelector('.chip-group[data-input="p-sample-size"]');
  const hiddenInput = document.getElementById("p-sample-size");
  const customInput = document.getElementById("p-sample-custom");
  if (!group || !hiddenInput) return;

  const buttons = Array.from(group.querySelectorAll(".chip-btn"));
  let matchedPreset = false;

  buttons.forEach((button) => {
    const active = button.dataset.value === hiddenInput.value;
    button.classList.toggle("active", active);
    if (active) matchedPreset = true;
  });

  if (!customInput) return;
  if (source === "preset" && matchedPreset) {
    customInput.value = "";
  } else if (source !== "custom" || document.activeElement !== customInput) {
    customInput.value = matchedPreset ? "" : hiddenInput.value;
  }
}

function initPoissonUI() {
  document.querySelectorAll('.chip-group[data-input="p-sample-size"] .chip-btn').forEach((button) => {
    button.addEventListener("click", () => {
      document.getElementById("p-sample-size").value = button.dataset.value;
      syncPoissonSampleGroup("preset");
    });
  });

  const customInput = document.getElementById("p-sample-custom");
  customInput?.addEventListener("input", () => {
    const normalized = normalizePositiveIntegerString(customInput.value.trim());
    customInput.value = normalized;
    if (normalized !== "") {
      document.getElementById("p-sample-size").value = normalized;
    }
    syncPoissonSampleGroup("custom");
  });

  document.querySelector(".control-panel")?.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && event.target.matches("input, select")) {
      runPoissonSimulation();
    }
  });

  randomSeedPoisson();
  syncPoissonSampleGroup();
  runPoissonSimulation();
}

document.addEventListener("DOMContentLoaded", initPoissonUI);
