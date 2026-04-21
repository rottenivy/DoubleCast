const CHRONOS_COLOR = "#94a3b8";
const DC_COLOR = "#62d84e";

const PLOTLY_LAYOUT = {
  margin: { t: 16, r: 140, l: 56, b: 44 },
  xaxis: {
    type: "date",
    showgrid: true,
    gridcolor: "rgba(255,255,255,0.04)",
    color: "#7a7a8a",
    tickfont: { family: "Outfit, sans-serif", size: 11, color: "#7a7a8a" },
  },
  yaxis: {
    title: { text: "value", font: { family: "Outfit, sans-serif", size: 12, color: "#7a7a8a" } },
    showgrid: true,
    gridcolor: "rgba(255,255,255,0.04)",
    zeroline: false,
    color: "#7a7a8a",
    tickfont: { family: "JetBrains Mono, monospace", size: 11, color: "#7a7a8a" },
  },
  legend: {
    orientation: "v",
    x: 1.02,
    xanchor: "left",
    y: 1,
    yanchor: "top",
    font: { family: "Outfit, sans-serif", size: 12, color: "#ededf0" },
    bgcolor: "rgba(0,0,0,0)",
  },
  hovermode: "x unified",
  hoverlabel: {
    bgcolor: "#16161f",
    bordercolor: "#2a2a38",
    font: { family: "JetBrains Mono, monospace", size: 12, color: "#ededf0" },
  },
  paper_bgcolor: "transparent",
  plot_bgcolor: "transparent",
  font: { family: "Outfit, sans-serif", color: "#ededf0" },
};

/* ── Fixed trace indices ── */
const T = { PAST: 0, TRUTH: 1, CHR_BAND: 2, CHR_MED: 3, DC_BAND: 4, DC_MED: 5 };

let INDEX = [];
let CURRENT = null;

/* ── Element accessors ── */
const $chronos  = () => document.getElementById("chk-chronos");
const $dc       = () => document.getElementById("chk-dc");
const $ctx      = () => document.getElementById("ctx-toggle");
const $shuffled = () => document.getElementById("chk-shuffled");

function dcModel() {
  if (!$ctx().checked) return "dc_noctx";
  return $shuffled().checked ? "dc_shuffled" : "dc_ctx";
}

function hexA(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

/* ── Index & Sidebar ── */
async function loadIndex() {
  INDEX = await fetch("assets/forecasts/index.json").then(r => r.json());
  renderSidebar();
  const first = filteredSorted()[0];
  if (first) selectExample(first.name);
}

function filteredSorted() {
  const tag = document.getElementById("filter-tag").value;
  const sort = document.getElementById("sort-by").value;
  let rows = INDEX.filter(r => tag === "all" || r.tag === tag);
  if (sort === "ratio_asc") rows.sort((a, b) => a.crps_ratio - b.crps_ratio);
  else if (sort === "ratio_desc") rows.sort((a, b) => b.crps_ratio - a.crps_ratio);
  else rows.sort((a, b) => a.name.localeCompare(b.name));
  return rows;
}

function renderSidebar() {
  const ol = document.getElementById("example-list");
  ol.innerHTML = "";
  filteredSorted().forEach((r, i) => {
    const li = document.createElement("li");
    li.dataset.name = r.name;
    li.style.animationDelay = `${Math.min(i * 20, 300)}ms`;
    const tagCls = r.tag.replace(/\s+/g, "-");
    li.innerHTML = `
      <div class="row-title">${r.title}</div>
      <div class="row-meta">
        <span class="tag tag-${tagCls}">${r.tag}</span>
        <span class="ratio">ctx/noctx ${r.crps_ratio.toFixed(2)}</span>
      </div>`;
    li.addEventListener("click", () => selectExample(r.name));
    ol.appendChild(li);
  });
  highlightActive();
}

function highlightActive() {
  const name = CURRENT ? CURRENT.name : null;
  document.querySelectorAll("#example-list li").forEach(li => {
    li.classList.toggle("active", li.dataset.name === name);
  });
}

async function selectExample(name) {
  CURRENT = await fetch(`assets/forecasts/${encodeURIComponent(name)}.json`).then(r => r.json());
  highlightActive();
  renderContext();
  renderPlot();
  renderMeta();
}

/* ── Plot ── */
function buildTraces() {
  const xPast = CURRENT.past_timestamp;
  const xFut = CURRENT.future_timestamp;
  const chr = CURRENT.forecasts.chronos;
  const dc = CURRENT.forecasts[dcModel()];
  const showChr = $chronos().checked;
  const showDc = $dc().checked;

  return [
    {
      x: xPast, y: CURRENT.past_target, name: "History", mode: "lines",
      line: { color: "#64748b", width: 1.5 },
      hovertemplate: "%{y:.3f}<extra>history</extra>",
    },
    {
      x: xFut, y: CURRENT.future_target, name: "Ground truth", mode: "lines",
      line: { color: "#e2e5ef", width: 1.8, dash: "dash" },
      hovertemplate: "%{y:.3f}<extra>ground truth</extra>",
    },
    {
      x: xFut.concat([...xFut].reverse()),
      y: chr.p90.concat([...chr.p10].reverse()),
      fill: "toself", fillcolor: hexA(CHRONOS_COLOR, 0.18),
      line: { width: 0, color: "transparent" }, hoverinfo: "skip",
      name: "Chronos p10\u2013p90", showlegend: false,
      visible: showChr,
    },
    {
      x: xFut, y: chr.p50, mode: "lines",
      line: { color: CHRONOS_COLOR, width: 2.5 },
      name: "Chronos",
      hovertemplate: "%{y:.3f}<extra>Chronos (p50)</extra>",
      visible: showChr,
    },
    {
      x: xFut.concat([...xFut].reverse()),
      y: dc.p90.concat([...dc.p10].reverse()),
      fill: "toself", fillcolor: hexA(DC_COLOR, 0.18),
      line: { width: 0, color: "transparent" }, hoverinfo: "skip",
      name: "DoubleCast p10\u2013p90", showlegend: false,
      visible: showDc,
    },
    {
      x: xFut, y: dc.p50, mode: "lines",
      line: { color: DC_COLOR, width: 2.5 },
      name: "DoubleCast",
      hovertemplate: "%{y:.3f}<extra>DoubleCast (p50)</extra>",
      visible: showDc,
    },
  ];
}

function renderPlot() {
  if (!CURRENT) return;
  Plotly.react("plot", buildTraces(), PLOTLY_LAYOUT, { displayModeBar: false, responsive: true });
}

function animateDc() {
  if (!CURRENT || !$dc().checked) return;
  const dc = CURRENT.forecasts[dcModel()];
  Plotly.animate("plot", {
    data: [
      { y: dc.p90.concat([...dc.p10].reverse()) },
      { y: dc.p50 },
    ],
    traces: [T.DC_BAND, T.DC_MED],
  }, {
    transition: { duration: 500, easing: "cubic-in-out" },
    frame: { duration: 500 },
  });
}

/* ── Metrics ── */
function renderMeta() {
  if (!CURRENT) return;
  const m = CURRENT.metrics;
  const el = document.getElementById("metrics");
  const rows = [];

  if ($chronos().checked) {
    rows.push(`<tr>
      <td><span class="swatch" style="background:${CHRONOS_COLOR}"></span>Chronos</td>
      <td class="num">${m.crps.chronos.toFixed(3)}</td>
    </tr>`);
  }
  if ($dc().checked) {
    const model = dcModel();
    const label = model === "dc_ctx" ? "DoubleCast (context)"
                : model === "dc_shuffled" ? "DoubleCast (shuffled)"
                : "DoubleCast (no context)";
    rows.push(`<tr>
      <td><span class="swatch" style="background:${DC_COLOR}"></span>${label}</td>
      <td class="num">${m.crps[model].toFixed(3)}</td>
    </tr>`);
  }

  if (rows.length === 0) {
    el.innerHTML = `<h3>CRPS <span class="hint">(lower is better)</span></h3>
      <div class="empty">No models selected.</div>`;
    return;
  }

  const showRatio = $dc().checked;
  const ratioHtml = showRatio ? `
    <div class="ratio-note">
      ctx / noctx ratio: <b>${m.crps_ratio.toFixed(3)}</b>
      <span class="hint">&lt;1 \u2192 context helps \u00b7 &gt;1 \u2192 context hurts</span>
    </div>` : "";

  el.innerHTML = `
    <h3>CRPS <span class="hint">(lower is better)</span></h3>
    <table>${rows.join("")}</table>
    ${ratioHtml}`;
}

/* ── Context Card ── */
function renderContext() {
  if (!CURRENT) return;
  const textEl = document.getElementById("context-text");
  const titleEl = document.getElementById("context-title");
  const card = document.getElementById("context-card");
  const labelEl = document.querySelector(".context-label");

  textEl.style.opacity = "0";

  if (!$dc().checked || !$ctx().checked) {
    /* DoubleCast off or context off → none */
    labelEl.textContent = "CONTEXT";
    labelEl.className = "context-label";
    titleEl.textContent = `${CURRENT.dataset} \u00b7 ${CURRENT.freq}`;
    textEl.textContent = "None";
    card.classList.add("ctx-none");
    card.classList.remove("ctx-irrelevant");
  } else if ($shuffled().checked) {
    /* Shuffled → mark irrelevant */
    labelEl.textContent = "IRRELEVANT CONTEXT";
    labelEl.className = "context-label ctx-label-irrelevant";
    titleEl.textContent = `${CURRENT.dataset} \u00b7 ${CURRENT.freq}`;
    textEl.textContent = "This forecast was conditioned on a shuffled context from a different time series \u2014 it is irrelevant to the actual data and serves as a sensitivity check.";
    card.classList.remove("ctx-none");
    card.classList.add("ctx-irrelevant");
  } else {
    /* Normal context */
    labelEl.textContent = "CONTEXT";
    labelEl.className = "context-label";
    titleEl.textContent = `${CURRENT.dataset} \u00b7 ${CURRENT.freq}`;
    textEl.textContent = CURRENT.context_abs;
    card.classList.remove("ctx-none", "ctx-irrelevant");
  }

  requestAnimationFrame(() => {
    requestAnimationFrame(() => { textEl.style.opacity = "1"; });
  });
}

/* ── Context switch state ── */
function updateCtxState() {
  const on = $ctx().checked;
  const stateEl = document.getElementById("ctx-state");
  stateEl.textContent = "Context";
  stateEl.classList.toggle("off", !on);
  const shuffOpt = document.getElementById("shuffled-opt");
  $shuffled().disabled = !on;
  shuffOpt.classList.toggle("disabled", !on);
  if (!on) $shuffled().checked = false;
}

/* ── Event listeners ── */
document.getElementById("filter-tag").addEventListener("change", renderSidebar);
document.getElementById("sort-by").addEventListener("change", renderSidebar);

$chronos().addEventListener("change", () => {
  Plotly.restyle("plot", { visible: $chronos().checked }, [T.CHR_BAND, T.CHR_MED]);
  renderMeta();
});

$dc().addEventListener("change", () => {
  Plotly.restyle("plot", { visible: $dc().checked }, [T.DC_BAND, T.DC_MED]);
  document.getElementById("ctx-switch").classList.toggle("disabled", !$dc().checked);
  document.getElementById("shuffled-opt").classList.toggle("disabled", !$dc().checked);
  renderContext();
  renderMeta();
});

$ctx().addEventListener("change", () => {
  updateCtxState();
  animateDc();
  renderContext();
  renderMeta();
});

$shuffled().addEventListener("change", () => {
  animateDc();
  renderContext();
  renderMeta();
});

window.addEventListener("resize", renderPlot);

/* ── Font size control ── */
const FONT_SIZES = [12, 13, 14, 15, 16, 18];
const DEFAULT_FONT = 14;
let currentFont = parseInt(localStorage.getItem("dcast-font") || DEFAULT_FONT, 10);

function applyFontSize(px) {
  currentFont = px;
  document.documentElement.style.setProperty("--base-font", px + "px");
  localStorage.setItem("dcast-font", px);
  document.getElementById("font-reset").classList.toggle("active", px !== DEFAULT_FONT);
}

document.getElementById("font-down").addEventListener("click", () => {
  const idx = FONT_SIZES.indexOf(currentFont);
  if (idx > 0) applyFontSize(FONT_SIZES[idx - 1]);
});
document.getElementById("font-up").addEventListener("click", () => {
  const idx = FONT_SIZES.indexOf(currentFont);
  if (idx < FONT_SIZES.length - 1) applyFontSize(FONT_SIZES[idx + 1]);
});
document.getElementById("font-reset").addEventListener("click", () => {
  applyFontSize(DEFAULT_FONT);
});

applyFontSize(currentFont);

/* ── Section reveal ── */
const revealObserver = new IntersectionObserver((entries) => {
  entries.forEach(e => {
    if (e.isIntersecting) e.target.classList.add('visible');
  });
}, { threshold: 0.12 });

document.querySelectorAll('.content-section').forEach(s => revealObserver.observe(s));

/* Resize Plotly when demo scrolls into view */
const demoObserver = new IntersectionObserver((entries) => {
  if (entries[0].isIntersecting) renderPlot();
}, { threshold: 0.1 });
demoObserver.observe(document.getElementById('demo-section'));

/* ── Init ── */
updateCtxState();
loadIndex();
