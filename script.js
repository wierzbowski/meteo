// Bydgoszcz coordinates, for the Open-Meteo request
const LAT = 53.1235;
const LON = 18.0084;

// meteo.pl grid cell for Bydgoszcz (fixed, provided by the user)
const METEO_ROW = 381;
const METEO_COL = 199;

function pad(n) {
  return String(n).padStart(2, "0");
}

function setMeteoImage() {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = pad(now.getMonth() + 1);
  const dd = pad(now.getDate());
  const fdate = `${yyyy}${mm}${dd}00`;

  const url = `https://www.meteo.pl/um/metco/mgram_pict.php?ntype=0u&fdate=${fdate}&row=${METEO_ROW}&col=${METEO_COL}&lang=pl`;
  document.getElementById("meteo-img").src = url;
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
    `&hourly=precipitation_probability` +
    `&daily=temperature_2m_max,temperature_2m_min` +
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

    renderPrecipChart(data.hourly);
  } catch (err) {
    el.innerHTML = `<div class="owm-error">Nie udalo sie pobrac pogody (${err.message})</div>`;
  }
}

function renderPrecipChart(hourly) {
  const bars = document.getElementById("precip-bars");
  const labels = document.getElementById("precip-labels");
  const tableBody = document.getElementById("precip-table-body");
  const tooltip = document.getElementById("precip-tooltip");
  if (!hourly) return;

  const now = new Date();
  let startIdx = hourly.time.findIndex((t) => new Date(t) >= now);
  if (startIdx === -1) startIdx = 0;

  const hours = hourly.time.slice(startIdx, startIdx + 24);
  const probs = hourly.precipitation_probability.slice(startIdx, startIdx + 24);

  bars.innerHTML = "";
  labels.innerHTML = "";
  tableBody.innerHTML = "";

  const showTooltip = (bar, hourLabel, prob) => {
    tooltip.textContent = `${hourLabel} · ${prob}%`;
    tooltip.style.display = "block";
    tooltip.style.left = `${bar.offsetLeft + bar.offsetWidth / 2}px`;
    tooltip.style.bottom = `${bars.offsetHeight - bar.offsetTop + 6}px`;
  };
  const hideTooltip = () => {
    tooltip.style.display = "none";
  };

  hours.forEach((iso, i) => {
    const prob = probs[i];
    const d = new Date(iso);
    const hourLabel = `${pad(d.getHours())}:00`;

    const col = document.createElement("div");
    col.className = "precip-col";

    const bar = document.createElement("div");
    bar.className = "precip-bar";
    bar.style.height = `${Math.max((prob / 100) * 100, 3)}%`;
    bar.tabIndex = 0;
    bar.setAttribute("role", "img");
    bar.setAttribute("aria-label", `${hourLabel}: ${prob}% szansy opadow`);

    bar.addEventListener("pointerenter", () => showTooltip(bar, hourLabel, prob));
    bar.addEventListener("focus", () => showTooltip(bar, hourLabel, prob));
    bar.addEventListener("pointerleave", hideTooltip);
    bar.addEventListener("blur", hideTooltip);

    col.appendChild(bar);
    bars.appendChild(col);

    const label = document.createElement("div");
    label.className = "precip-hour";
    label.textContent = i % 3 === 0 ? hourLabel : "";
    labels.appendChild(label);

    const row = document.createElement("tr");
    const th = document.createElement("th");
    th.textContent = hourLabel;
    const td = document.createElement("td");
    td.textContent = `${prob}%`;
    row.appendChild(th);
    row.appendChild(td);
    tableBody.appendChild(row);
  });
}

setMeteoImage();
loadCurrentWeather();
