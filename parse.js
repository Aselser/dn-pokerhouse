"use strict";
(function (root) {
  function cellStr(v) { return (v === null || v === undefined) ? "" : String(v).trim(); }

  function isDayHeader(row) {
    const a = cellStr(row[0]).toLowerCase();
    if (!a) return false;
    if (a.includes("jornada")) return true;
    return /^(lunes|martes|mi[eé]rcoles|jueves|viernes|s[áa]bado|domingo)\b/.test(a);
  }

  function rowType(label) {
    const l = label.toLowerCase();
    if (l.includes("buy")) return "money";
    if (l.includes("ko")) return "money";
    if (l.includes("stack")) return "plain";
    return "text";
  }

  function lastNonEmptyIndex(row) {
    let last = 0;
    for (let i = 1; i < row.length; i++) {
      if (cellStr(row[i]) !== "") last = i;
    }
    return last;
  }

  function fmtNum(n) { return Number(n).toLocaleString("de-DE"); }

  function formatValue(type, raw) {
    if (raw === "" || raw === null || raw === undefined) return "";
    if (type === "text") return cellStr(raw);
    if (typeof raw === "number") {
      return type === "money" ? "$" + fmtNum(raw) : fmtNum(raw);
    }
    let s = cellStr(raw);
    if (s === "-") return "-";
    if (type === "money") return s.replace(/\d+/g, (m) => "$" + fmtNum(m));
    if (/^\d+$/.test(s)) return fmtNum(s);
    return s;
  }

  function parseDays(rows) {
    const days = [];
    let i = 0;
    while (i < rows.length) {
      if (!isDayHeader(rows[i])) { i++; continue; }
      const header = rows[i];
      const nCols = Math.max(lastNonEmptyIndex(header), 1);

      const a = cellStr(header[0]);
      const segs = a.split(/\s*-\s*/);
      const left = segs[0] || "";
      const jornada = (segs[1] || "").trim();
      const lm = left.match(/^(\S+)\s+(.*)$/);
      const dayName = (lm ? lm[1] : left).toUpperCase();
      const dayDate = lm ? lm[2].trim() : "";

      const events = [];
      for (let c = 1; c <= nCols; c++) {
        const raw = cellStr(header[c]);
        const parts = raw.split(/\s*-\s*/);
        events.push({ name: (parts[0] || "").trim(), time: (parts[1] || "").trim() });
      }

      const dataRows = [];
      let note = null;
      let j = i + 1;
      for (; j < rows.length; j++) {
        if (isDayHeader(rows[j])) break;
        const row = rows[j];
        const label = cellStr(row[0]);
        const hasContent = row.some((v) => cellStr(v) !== "");
        if (!hasContent) continue;
        if (label) {
          const type = rowType(label);
          const values = [];
          for (let c = 1; c <= nCols; c++) values.push(formatValue(type, row[c]));
          dataRows.push({ label: label.toUpperCase(), values });
        } else {
          const values = [];
          for (let c = 1; c <= nCols; c++) values.push(cellStr(row[c]));
          if (values.some((v) => v !== "")) note = values;
        }
      }

      days.push({ dayName, dayDate, jornada, events, dataRows, note, nCols });
      i = j;
    }
    return days;
  }

  const api = { cellStr, isDayHeader, rowType, lastNonEmptyIndex, fmtNum, formatValue, parseDays };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.FlyerParse = api;
})(typeof window !== "undefined" ? window : globalThis);
