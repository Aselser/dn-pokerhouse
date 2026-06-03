"use strict";

const { parseDays } = window.FlyerParse;

const fileInput = document.getElementById("fileInput");
const downloadBtn = document.getElementById("downloadBtn");
const downloadAllBtn = document.getElementById("downloadAllBtn");
const statusEl = document.getElementById("status");
const daysEl = document.getElementById("days");
const flyerEl = document.getElementById("flyer");

let currentDays = [];

fileInput.addEventListener("change", handleFile);
downloadBtn.addEventListener("click", downloadImage);
downloadAllBtn.addEventListener("click", downloadAll);

function setStatus(msg) { statusEl.textContent = msg; }

async function handleFile(e) {
  const file = e.target.files[0];
  if (!file) return;
  setStatus("Leyendo Excel…");
  try {
    const data = await file.arrayBuffer();
    const wb = XLSX.read(data, { type: "array" });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: "" });
    const days = parseDays(rows);
    if (!days.length) { setStatus("No se encontraron jornadas en el Excel."); return; }
    currentDays = days;
    renderDays(days);
    downloadBtn.disabled = false;
    downloadAllBtn.disabled = false;
    setStatus(`Listo: ${days.length} jornadas. Ya podés descargar las imágenes.`);
  } catch (err) {
    console.error(err);
    setStatus("Error al leer el archivo: " + err.message);
  }
}

/* ---------- Rendering ---------- */

function el(html) {
  const t = document.createElement("template");
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
}

function escape(s) {
  return String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
}

function renderDays(days) {
  daysEl.innerHTML = "";
  for (const d of days) {
    const totalRows = 1 + d.dataRows.length + (d.note ? 1 : 0);

    let html = `<table class="day">`;
    html += `<tr class="header">`;
    html += `<td class="day-label" rowspan="${totalRows}">`;
    html += `<div class="dl-day">${escape(d.dayName)}</div>`;
    if (d.dayDate) html += `<div class="dl-date">${escape(d.dayDate)}</div>`;
    if (d.jornada) html += `<div class="dl-jornada">${escape(d.jornada.toUpperCase())}</div>`;
    html += `</td>`;
    html += `<td class="corner"></td>`;
    for (const ev of d.events) {
      html += `<td class="ev"><span class="evname">${escape(ev.name.toUpperCase())}</span><span class="evtime">${escape(ev.time)}</span></td>`;
    }
    html += `</tr>`;

    for (const r of d.dataRows) {
      html += `<tr class="data"><td class="rlabel">${escape(r.label)}</td>`;
      for (const v of r.values) html += `<td class="val">${escape(v)}</td>`;
      html += `</tr>`;
    }

    if (d.note) {
      html += `<tr class="note"><td class="rlabel"></td>`;
      for (const v of d.note) html += `<td class="note-val">${escape(v)}</td>`;
      html += `</tr>`;
    }

    html += `</table>`;
    daysEl.appendChild(el(html));
  }
}

/* ---------- Download ---------- */

function slug(s) {
  return String(s).toLowerCase()
    .normalize("NFD").replace(new RegExp("[\\u0300-\\u036f]", "g"), "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function capture() {
  return html2canvas(flyerEl, {
    scale: 2,
    backgroundColor: "#050505",
    useCORS: true,
    logging: false,
  });
}

function canvasToBlob(canvas) {
  return new Promise((res) => canvas.toBlob(res, "image/png"));
}

function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function setButtons(disabled) {
  downloadBtn.disabled = disabled;
  downloadAllBtn.disabled = disabled;
}

async function downloadImage() {
  setStatus("Generando imagen…");
  setButtons(true);
  try {
    if (document.fonts && document.fonts.ready) await document.fonts.ready;
    const canvas = await capture();
    const blob = await canvasToBlob(canvas);
    triggerDownload(blob, "programacion-semanal.png");
    setStatus("Imagen descargada.");
  } catch (err) {
    console.error(err);
    setStatus("Error al generar la imagen: " + err.message);
  } finally {
    setButtons(false);
  }
}

async function downloadAll() {
  setButtons(true);
  const tables = Array.from(daysEl.querySelectorAll("table.day"));
  const total = 1 + tables.length * 2;
  let n = 0;
  const clear = () => tables.forEach((t) => t.classList.remove("highlight", "dimmed", "day-hidden"));
  try {
    if (document.fonts && document.fonts.ready) await document.fonts.ready;
    const zip = new JSZip();

    // 1) Imagen completa, sin remarcar
    setStatus("Generando imagen " + (++n) + "/" + total + "…");
    zip.file("00-completa.png", await canvasToBlob(await capture()));

    // 2) Una por día, con el borde resaltado (resto atenuado)
    for (let i = 0; i < tables.length; i++) {
      setStatus("Generando imagen " + (++n) + "/" + total + "…");
      tables.forEach((t, j) => {
        t.classList.toggle("highlight", j === i);
        t.classList.toggle("dimmed", j !== i);
        t.classList.remove("day-hidden");
      });
      const name = String(i + 1).padStart(2, "0") + "-" + slug(currentDays[i].dayName) + ".png";
      zip.file(name, await canvasToBlob(await capture()));
    }

    // 3) Una por día, mostrando solo ese día (con header y footer)
    for (let i = 0; i < tables.length; i++) {
      setStatus("Generando imagen " + (++n) + "/" + total + "…");
      tables.forEach((t, j) => {
        t.classList.remove("highlight", "dimmed");
        t.classList.toggle("day-hidden", j !== i);
      });
      const name = "solo-" + String(i + 1).padStart(2, "0") + "-" + slug(currentDays[i].dayName) + ".png";
      zip.file(name, await canvasToBlob(await capture()));
    }

    clear();

    setStatus("Comprimiendo zip…");
    const content = await zip.generateAsync({ type: "blob" });
    triggerDownload(content, "flyers-dn-pokerhouse.zip");
    setStatus("Listo: " + total + " imágenes descargadas en el zip.");
  } catch (err) {
    console.error(err);
    clear();
    setStatus("Error al generar las imágenes: " + err.message);
  } finally {
    setButtons(false);
  }
}
