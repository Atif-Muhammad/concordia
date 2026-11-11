import * as XLSX from "xlsx";
import { openManagedPrintWindow } from "@/lib/managedPrint";
import { logReportExport } from "../../../config/apis";

const esc = (v) =>
  String(v ?? "—")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

export const buildFiltersSummary = (selectedFilters = []) =>
  selectedFilters.length
    ? selectedFilters.map((f) => `${f.label}: ${f.value}`).join("; ")
    : "Default filters";

export function buildReportPrintHtml(payload) {
  const {
    meta = {},
    report = {},
    kpis = [],
    columns = [],
    rows = [],
    totalsRow = null,
    secondaryTables = [],
    insight = {},
  } = payload || {};

  const instName = meta.brandTitle || "CONCORDIA COLLEGE PESHAWAR | ERP REPORT CENTRE";
  const genDate = meta.generatedAt
    ? new Date(meta.generatedAt).toLocaleString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : new Date().toLocaleString();

  const filterRowsHtml = (report.selectedFilters || [])
    .map(
      (f) =>
        `<tr><td class="fk">${esc(f.label)}</td><td class="fv">${esc(f.value)}</td></tr>`
    )
    .join("");

  const kpiCardsHtml = (kpis || [])
    .slice(0, 4)
    .map(
      (k) => `
      <div class="kpi">
        <div class="kpi-val">${esc(k.value)}</div>
        <div class="kpi-lbl">${esc(k.label)}</div>
      </div>`
    )
    .join("");

  const renderTable = (cols, dataRows, tRow, emptyMsg = "No records found") => {
    const ths = cols
      .map(
        (c) =>
          `<th style="text-align:${c.align || "left"}">${esc(c.label)}</th>`
      )
      .join("");
    const body = dataRows.length
      ? dataRows
          .map(
            (r) =>
              `<tr>${cols
                .map(
                  (c) =>
                    `<td style="text-align:${c.align || "left"}">${esc(
                      r[c.key] ?? "—"
                    )}</td>`
                )
                .join("")}</tr>`
          )
          .join("")
      : `<tr><td colspan="${Math.max(1, cols.length)}" style="text-align:center;color:#64748b;">${esc(emptyMsg)}</td></tr>`;

    const totHtml = tRow
      ? `<tr class="total-row">${cols
          .map(
            (c) =>
              `<td style="text-align:${c.align || "left"}"><strong>${esc(
                tRow[c.key] ?? ""
              )}</strong></td>`
          )
          .join("")}</tr>`
      : "";

    return `<table><thead><tr>${ths}</tr></thead><tbody>${body}${totHtml}</tbody></table>`;
  };

  const secondaryHtml = (secondaryTables || [])
    .map(
      (st) => `
      <div class="sec-title">${esc(st.title)}</div>
      ${renderTable(st.columns || [], st.rows || [], st.totalsRow || null)}
    `
    )
    .join("");

  const signaturesHtml = Array.isArray(report.signatures) && report.signatures.length
    ? `<div class="sigs">${report.signatures
        .map(
          (sig) =>
            `<div class="sig-box"><div class="sig-line"></div><div class="sig-lbl">${esc(sig)}</div></div>`
        )
        .join("")}</div>`
    : "";

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${esc(report.title || "Concordia ERP Report")}</title>
  <style>
    @page { size: A4 landscape; margin: 12mm; }
    * { box-sizing: border-box; }
    body { font-family: Arial, Helvetica, sans-serif; color: #1e293b; margin: 0; font-size: 11px; background: #fff; }
    .banner { border-bottom: 3px solid #F7941E; padding-bottom: 10px; margin-bottom: 12px; display: flex; justify-content: space-between; align-items: flex-end; }
    .brand { font-size: 10px; font-weight: 700; letter-spacing: 0.08em; color: #F7941E; margin-bottom: 4px; }
    .title { font-size: 18px; font-weight: 700; color: #0f172a; margin: 0; }
    .subtitle { font-size: 11px; color: #475569; margin-top: 3px; }
    .purpose { margin: 8px 0 12px; padding: 8px 10px; background: #fff7ed; border-left: 3px solid #F7941E; font-size: 11px; }
    .filter-table { width: 100%; border-collapse: collapse; margin-bottom: 12px; }
    .filter-table th { background: #F7941E; color: #fff; text-align: left; padding: 5px 8px; font-size: 10px; letter-spacing: 0.05em; }
    .filter-table td { border: 1px solid #fed7aa; padding: 4px 8px; font-size: 10px; }
    .filter-table .fk { width: 28%; font-weight: 700; color: #7c2d12; background: #fffbf5; }
    .sec-title { font-size: 11px; font-weight: 700; letter-spacing: 0.06em; color: #c2410c; text-transform: uppercase; margin: 14px 0 6px; }
    .kpis { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-bottom: 12px; }
    .kpi { border: 1px solid #fed7aa; border-top: 3px solid #F7941E; border-radius: 6px; padding: 8px 10px; background: #fff; }
    .kpi-val { font-size: 15px; font-weight: 700; color: #0f172a; }
    .kpi-lbl { font-size: 10px; color: #64748b; margin-top: 2px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 10px; }
    th { background: #F7941E; color: #fff; padding: 6px 8px; font-size: 10px; font-weight: 700; border: 1px solid #ea580c; }
    td { padding: 5px 8px; border: 1px solid #e2e8f0; font-size: 10px; }
    tbody tr:nth-child(even) { background: #fffbf5; }
    .total-row td { background: #ffedd5; font-weight: 700; border-top: 2px solid #F7941E; }
    .insight { margin-top: 12px; padding: 9px 11px; border: 1px solid #fed7aa; border-left: 4px solid #F7941E; background: #fff7ed; border-radius: 4px; font-size: 10.5px; color: #7c2d12; }
    .insight-lbl { font-weight: 700; font-size: 10px; letter-spacing: 0.05em; margin-bottom: 3px; color: #c2410c; }
    .sigs { display: flex; justify-content: space-between; gap: 24px; margin-top: 28px; page-break-inside: avoid; }
    .sig-box { flex: 1; text-align: center; }
    .sig-line { border-top: 1px solid #334155; margin-bottom: 5px; height: 24px; }
    .sig-lbl { font-size: 10px; font-weight: 600; color: #334155; }
    .footer { margin-top: 14px; padding-top: 8px; border-top: 1px solid #e2e8f0; font-size: 9.5px; color: #64748b; display: flex; justify-content: space-between; }
  </style>
</head>
<body>
  <div class="banner">
    <div>
      <div class="brand">${esc(instName)}</div>
      <h1 class="title">${esc(report.title || "ERP Report")}</h1>
      <div class="subtitle">${esc(report.module || "")} &bull; ${esc(meta.sessionLabel || "Current Session")}</div>
    </div>
    <div style="text-align:right;font-size:10px;color:#64748b;">
      ${report.pageNumber ? `Report #${report.pageNumber}` : ""}
    </div>
  </div>
  ${report.purpose ? `<div class="purpose"><strong>Purpose:</strong> ${esc(report.purpose)}</div>` : ""}
  ${
    filterRowsHtml
      ? `<table class="filter-table"><thead><tr><th>FILTER</th><th>SELECTED VALUE</th></tr></thead><tbody>${filterRowsHtml}</tbody></table>`
      : ""
  }
  ${kpiCardsHtml ? `<div class="sec-title">AT-A-GLANCE SUMMARY</div><div class="kpis">${kpiCardsHtml}</div>` : ""}
  <div class="sec-title">REPORT DETAILS</div>
  ${renderTable(columns, rows, totalsRow)}
  ${secondaryHtml}
  ${
    insight?.message
      ? `<div class="insight"><div class="insight-lbl">MANAGEMENT INSIGHT / EXCEPTIONS</div>${esc(insight.message)}</div>`
      : ""
  }
  ${signaturesHtml}
  <div class="footer">
    <span>Generated on ${esc(genDate)} | Generated by: ${esc(meta.generatedBy || "Administrator")}</span>
    <span>${esc(meta.disclaimer || "Confidential — for authorized institutional use only")}</span>
  </div>
</body>
</html>`;
}

export async function printOrExportPdfReport(payload, { format = "PRINT", toast } = {}) {
  const html = buildReportPrintHtml(payload);
  const ok = await openManagedPrintWindow({
    html,
    title: payload?.report?.title || "Concordia ERP Report",
    toast,
  });
  if (payload?.report?.key) {
    logReportExport(payload.report.key, {
      format: format === "PDF" ? "PDF" : "PRINT",
      filtersSummary: buildFiltersSummary(payload.report.selectedFilters),
      recordCount: payload.rows?.length || 0,
      status: ok ? "SUCCESS" : "FAILED",
      failureReason: ok ? "" : "Print pop-up blocked",
    });
  }
  return ok;
}

export async function exportReportWorkbook(payload, { extraSheets = [], toast } = {}) {
  try {
    const wb = XLSX.utils.book_new();
    const report = payload?.report || {};
    const meta = payload?.meta || {};
    const kpis = payload?.kpis || [];
    const cols = payload?.columns || [];
    const rows = payload?.rows || [];

    // Sheet 1: Report Details (clean structured table)
    const detailHeader = cols.map((c) => c.label);
    const detailRows = rows.map((r) => cols.map((c) => r[c.key] ?? ""));
    if (payload?.totalsRow) {
      detailRows.push(cols.map((c) => payload.totalsRow[c.key] ?? ""));
    }
    const detailSheet = XLSX.utils.aoa_to_sheet([detailHeader, ...detailRows]);
    XLSX.utils.book_append_sheet(wb, detailSheet, "Report Details");

    // Sheet 2: Summary & Filters
    const summaryAoa = [
      [meta.brandTitle || "CONCORDIA COLLEGE PESHAWAR | ERP REPORT CENTRE"],
      [report.title || "Report"],
      ["Purpose", report.purpose || ""],
      ["Session", meta.sessionLabel || ""],
      ["Generated By", meta.generatedBy || ""],
      ["Generated On", meta.generatedAt || new Date().toISOString()],
      [],
      ["FILTER", "SELECTED VALUE"],
      ...(report.selectedFilters || []).map((f) => [f.label, f.value]),
      [],
      ["AT-A-GLANCE KPI", "VALUE"],
      ...kpis.map((k) => [k.label, k.value]),
      [],
      ["MANAGEMENT INSIGHT", payload?.insight?.message || ""],
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(summaryAoa), "Summary & Filters");

    // Optional secondary tables & legacy preserved sheets
    (payload?.secondaryTables || []).forEach((st, idx) => {
      const sCols = st.columns || [];
      const sRows = (st.rows || []).map((r) => sCols.map((c) => r[c.key] ?? ""));
      const ws = XLSX.utils.aoa_to_sheet([sCols.map((c) => c.label), ...sRows]);
      const safeName = String(st.title || `SubTable ${idx + 1}`).replace(/[\\/?*[\]:]/g, "").slice(0, 28);
      XLSX.utils.book_append_sheet(wb, ws, safeName || `Breakdown ${idx + 1}`);
    });

    (extraSheets || []).forEach((es) => {
      if (es?.name && Array.isArray(es.aoa)) {
        const ws = XLSX.utils.aoa_to_sheet(es.aoa);
        const safeName = String(es.name).replace(/[\\/?*[\]:]/g, "").slice(0, 28);
        XLSX.utils.book_append_sheet(wb, ws, safeName);
      }
    });

    const slug = (report.key || "concordia-report").replace(/[^a-z0-9-_]/gi, "_");
    const stamp = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(wb, `${slug}_${stamp}.xlsx`);

    if (report.key) {
      await logReportExport(report.key, {
        format: "EXCEL",
        filtersSummary: buildFiltersSummary(report.selectedFilters),
        recordCount: rows.length,
        status: "SUCCESS",
      });
    }
    return true;
  } catch (err) {
    toast?.({
      title: "Excel export failed",
      description: err?.message || "Unable to build spreadsheet",
      variant: "destructive",
    });
    if (payload?.report?.key) {
      logReportExport(payload.report.key, {
        format: "EXCEL",
        filtersSummary: buildFiltersSummary(payload.report.selectedFilters),
        recordCount: 0,
        status: "FAILED",
        failureReason: err?.message || "Export error",
      });
    }
    return false;
  }
}
