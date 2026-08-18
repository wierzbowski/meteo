// Bydgoszcz coordinates, for the Open-Meteo request
const LAT = 53.1235;
const LON = 18.0084;

// meteo.pl grid cell for Bydgoszcz (fixed, provided by the user)
const METEO_ROW = 381;
const METEO_COL = 199;

function pad(n) {
  return String(n).padStart(2, "0");
}

function setPageDateTime() {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = pad(now.getMonth() + 1);
  const dd = pad(now.getDate());
  const hh = pad(now.getHours());

  document.getElementById("page-datetime").textContent = `${yyyy}-${mm}-${dd} ${hh}:00`;
}

// meteo.pl publishes a new model run at 00/06/12/18 local time, but a run isn't
// available immediately - a not-yet-published fdate returns a tiny 10x130px
// placeholder PNG (HTTP 200, no error) instead of the real ~540x780px chart. Rather
// than guess a fixed publish delay, step back one run at a time until a real chart
// (by pixel size) loads.
const METEO_RUN_HOURS = [0, 6, 12, 18];
const METEO_MAX_RUN_ATTEMPTS = 6; // up to 36h back - comfortably more than the observed delay

function meteoImageUrl(d) {
  const fdate = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}${pad(d.getHours())}`;
  return `https://www.meteo.pl/um/metco/mgram_pict.php?ntype=0u&fdate=${fdate}&row=${METEO_ROW}&col=${METEO_COL}&lang=pl`;
}

function latestMeteoRun(now) {
  const hour = METEO_RUN_HOURS.filter((h) => h <= now.getHours()).pop();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate(), hour);
}

function previousMeteoRun(runDate) {
  return new Date(runDate.getTime() - 6 * 60 * 60 * 1000);
}

function formatRunLabel(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:00`;
}

function setMeteoImage() {
  const img = document.getElementById("meteo-img");
  const runLabel = document.getElementById("meteo-run-label");
  let runDate = latestMeteoRun(new Date());
  let attempt = 0;

  const load = () => {
    runLabel.textContent = formatRunLabel(runDate);
    img.src = meteoImageUrl(runDate);
  };

  img.onload = () => {
    if (img.naturalWidth < 100 && attempt < METEO_MAX_RUN_ATTEMPTS) {
      attempt++;
      runDate = previousMeteoRun(runDate);
      load();
    }
  };

  load();
}

const WEATHER_CODES = {
  0: ["Bezchmurnie", "☀️"],
  1: ["Prawie bezchmurnie", "🌤️"],
  2: ["Czesciowe zachmurzenie", "⛅"],
  3: ["Zachmurzenie calkowite", "☁️"],
  45: ["Mgla", "🌫️"],
  48: ["Mgla z szadzia", "🌫️"],
  51: ["Mzawka slaba", "🌦️"],
  53: ["Mzawka umiarkowana", "🌦️"],
  55: ["Mzawka silna", "🌧️"],
  56: ["Marznaca mzawka", "🌧️"],
  57: ["Marznaca mzawka silna", "🌧️"],
  61: ["Deszcz slaby", "🌦️"],
  63: ["Deszcz umiarkowany", "🌧️"],
  65: ["Deszcz silny", "🌧️"],
  66: ["Marznacy deszcz", "🌨️"],
  67: ["Marznacy deszcz silny", "🌨️"],
  71: ["Snieg slaby", "🌨️"],
  73: ["Snieg umiarkowany", "❄️"],
  75: ["Snieg silny", "❄️"],
  77: ["Ziarna sniegu", "❄️"],
  80: ["Przelotny deszcz slaby", "🌦️"],
  81: ["Przelotny deszcz umiarkowany", "🌧️"],
  82: ["Przelotny deszcz silny", "⛈️"],
  85: ["Przelotny snieg slaby", "🌨️"],
  86: ["Przelotny snieg silny", "❄️"],
  95: ["Burza", "⛈️"],
  96: ["Burza z gradem", "⛈️"],
  99: ["Burza z gradem silna", "⛈️"],
};

function describeCode(code) {
  return WEATHER_CODES[code] || ["Nieznane warunki", "❓"];
}

async function loadCurrentWeather() {
  const el = document.getElementById("owm-content");
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${LAT}&longitude=${LON}` +
    `&current=temperature_2m,apparent_temperature,weather_code,wind_speed_10m` +
    `&hourly=precipitation_probability,precipitation` +
    `&daily=temperature_2m_max,temperature_2m_min,sunrise,sunset` +
    `&timezone=Europe%2FWarsaw`;

  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    const current = data.current;
    const daily = data.daily;
    const [desc, icon] = describeCode(current.weather_code);

    el.innerHTML = `
      <div class="owm-icon">${icon}</div>
      <div>
        <div class="owm-temp">${Math.round(current.temperature_2m)}&deg;C</div>
        <div class="owm-desc">${desc}</div>
        <div class="owm-meta">
          Odczuwalna ${Math.round(current.apparent_temperature)}&deg;C &middot;
          Wiatr ${Math.round(current.wind_speed_10m)} km/h<br>
          Dzis: ${Math.round(daily.temperature_2m_min[0])}&deg; / ${Math.round(daily.temperature_2m_max[0])}&deg;
        </div>
      </div>
    `;

    renderPrecipChart(data.hourly, data.daily);
  } catch (err) {
    el.innerHTML = `<div class="owm-error">Nie udalo sie pobrac pogody (${err.message})</div>`;
  }
}

function buildSunWindows(daily) {
  const windows = [];
  if (!daily || !daily.sunrise) return windows;
  for (let i = 0; i < daily.time.length; i++) {
    windows.push({
      sunrise: new Date(daily.sunrise[i]),
      sunset: new Date(daily.sunset[i]),
    });
  }
  return windows;
}

function isNight(d, sunWindows) {
  return !sunWindows.some((w) => d >= w.sunrise && d < w.sunset);
}

// Hourly precip (mm) at or above this amount gets the widest bar; anything above clamps.
const PRECIP_MM_CEILING = 2.0;
const PRECIP_BAR_MIN_PX = 3;
const PRECIP_BAR_MAX_PX = 12;

function precipBarWidthPx(mm) {
  const ratio = Math.min(mm / PRECIP_MM_CEILING, 1);
  return PRECIP_BAR_MIN_PX + (PRECIP_BAR_MAX_PX - PRECIP_BAR_MIN_PX) * ratio;
}

const DAY_ABBR = ["Nie", "Pon", "Wt", "Sr", "Czw", "Pt", "Sob"];

function renderPrecipChart(hourly, daily) {
  const days = document.getElementById("precip-days");
  const bars = document.getElementById("precip-bars");
  const labels = document.getElementById("precip-labels");
  const tableBody = document.getElementById("precip-table-body");
  const tooltip = document.getElementById("precip-tooltip");
  if (!hourly) return;

  const sunWindows = buildSunWindows(daily);

  const now = new Date();
  const startHour = Math.floor(now.getHours() / 4) * 4;
  const windowStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), startHour);

  let startIdx = hourly.time.findIndex((t) => new Date(t).getTime() === windowStart.getTime());
  if (startIdx === -1) startIdx = hourly.time.findIndex((t) => new Date(t) >= windowStart);
  if (startIdx === -1) startIdx = 0;

  const hours = hourly.time.slice(startIdx, startIdx + 48);
  const probs = hourly.precipitation_probability.slice(startIdx, startIdx + 48);
  const amounts = hourly.precipitation.slice(startIdx, startIdx + 48);

  days.innerHTML = "";
  bars.innerHTML = "";
  labels.innerHTML = "";
  tableBody.innerHTML = "";

  const showTooltip = (bar, hourLabel, prob, mm) => {
    tooltip.textContent = `${hourLabel} · ${prob}% · ${mm.toFixed(1)} mm`;
    tooltip.style.display = "block";
    tooltip.style.left = `${bar.offsetLeft + bar.offsetWidth / 2}px`;
    tooltip.style.bottom = `${bars.offsetHeight - bar.offsetTop + 6}px`;
  };
  const hideTooltip = () => {
    tooltip.style.display = "none";
  };

  hours.forEach((iso, i) => {
    const prob = probs[i];
    const mm = amounts[i];
    const d = new Date(iso);
    const hourLabel = `${pad(d.getHours())}:00`;

    const night = isNight(d, sunWindows);

    const col = document.createElement("div");
    col.className = night ? "precip-col precip-col--night" : "precip-col";

    const bar = document.createElement("div");
    bar.className = "precip-bar";
    bar.style.height = `${Math.max((prob / 100) * 100, 3)}%`;
    bar.style.width = `${precipBarWidthPx(mm)}px`;
    bar.tabIndex = 0;
    bar.setAttribute("role", "img");
    bar.setAttribute(
      "aria-label",
      `${hourLabel}: ${prob}% szansy opadow, ${mm.toFixed(1)} mm, ${night ? "noc" : "dzien"}`
    );

    bar.addEventListener("pointerenter", () => showTooltip(bar, hourLabel, prob, mm));
    bar.addEventListener("focus", () => showTooltip(bar, hourLabel, prob, mm));
    bar.addEventListener("pointerleave", hideTooltip);
    bar.addEventListener("blur", hideTooltip);

    col.appendChild(bar);
    bars.appendChild(col);

    const label = document.createElement("div");
    label.className = "precip-hour";
    label.textContent = i % 4 === 0 ? hourLabel : "";
    labels.appendChild(label);

    const dayCell = document.createElement("div");
    dayCell.className = "precip-day";
    dayCell.textContent = d.getHours() === 12 ? DAY_ABBR[d.getDay()] : "";
    days.appendChild(dayCell);

    const row = document.createElement("tr");
    const th = document.createElement("th");
    th.textContent = hourLabel;
    const tdProb = document.createElement("td");
    tdProb.textContent = `${prob}%`;
    const tdMm = document.createElement("td");
    tdMm.textContent = `${mm.toFixed(1)} mm`;
    row.appendChild(th);
    row.appendChild(tdProb);
    row.appendChild(tdMm);
    tableBody.appendChild(row);
  });
}

setPageDateTime();
setMeteoImage();
loadCurrentWeather();
