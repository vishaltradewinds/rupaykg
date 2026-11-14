import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { zipSync, strToU8 } from "fflate";
import PDFDocument from "pdfkit";
import type { ReportSnapshot } from "./reporting-engine.js";

function safeText(value: unknown): string {
  const text = (value === null || value === undefined ? "" : String(value)).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "");
  return /^[=+\-@\t\r]/.test(text) ? "'" + text : text;
}

function xmlEscape(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

function columnName(index: number): string {
  let value = index + 1;
  let name = "";
  while (value > 0) {
    const remainder = (value - 1) % 26;
    name = String.fromCharCode(65 + remainder) + name;
    value = Math.floor((value - 1) / 26);
  }
  return name;
}

type SheetOptions = { header?: boolean; title?: boolean; freeze?: boolean; filter?: boolean; widths?: number[] };

function sheetXml(rows: unknown[][], options: SheetOptions = {}): string {
  const maxColumns = Math.max(1, ...rows.map(row => row.length));
  const rowXml = rows.map((row, rowIndex) => {
    const cells = row.map((raw, columnIndex) => {
      const address = columnName(columnIndex) + (rowIndex + 1);
      const style = options.title && rowIndex === 0 ? 1 : options.header && rowIndex === 0 ? 2 : 0;
      if (raw === null || raw === undefined || raw === "") return '<c r="' + address + '"' + (style ? ' s="' + style + '"' : "") + '/>';
      if (typeof raw === "number" && Number.isFinite(raw)) return '<c r="' + address + '"' + (style ? ' s="' + style + '"' : "") + '><v>' + String(raw) + "</v></c>";
      if (typeof raw === "boolean") return '<c r="' + address + '" t="b"' + (style ? ' s="' + style + '"' : "") + '><v>' + (raw ? "1" : "0") + "</v></c>";
      const text = xmlEscape(safeText(raw));
      return '<c r="' + address + '" t="inlineStr"' + (style ? ' s="' + style + '"' : "") + '><is><t xml:space="preserve">' + text + "</t></is></c>";
    }).join("");
    return '<row r="' + (rowIndex + 1) + '">' + cells + "</row>";
  }).join("");
  const cols = options.widths?.length
    ? "<cols>" + options.widths.map((width, index) => '<col min="' + (index + 1) + '" max="' + (index + 1) + '" width="' + Math.max(8, Math.min(64, width)) + '" customWidth="1"/>').join("") + "</cols>"
    : "";
  const views = options.freeze ? '<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>' : '<sheetViews><sheetView workbookViewId="0"/></sheetViews>';
  const filter = options.filter && rows.length > 1 ? '<autoFilter ref="A1:' + columnName(maxColumns - 1) + rows.length + '"/>' : "";
  return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
    views + '<sheetFormatPr defaultRowHeight="16"/>' + cols + "<sheetData>" + rowXml + "</sheetData>" + filter +
    '<pageMargins left="0.3" right="0.3" top="0.5" bottom="0.5" header="0.2" footer="0.2"/></worksheet>';
}

function buildWorkbook(snapshot: ReportSnapshot): Buffer {
  const rowRecords: unknown[][] = [[
    "Row ID", "Stakeholder", "Stakeholder Attribution", "Row Label", "Field", "Value", "Unit", "Data Quality",
    "Source Record ID", "Evidence IDs", "Evidence Hashes", "Verification IDs", "Verification Statuses", "Notes",
  ]];
  const provenance: unknown[][] = [[
    "Row ID", "Field", "Source Record ID", "Evidence ID", "Evidence SHA-256", "Verification ID", "Verification Status",
  ]];
  for (const row of snapshot.rows) {
    for (const cell of row.cells) {
      const evidence = cell.evidence ?? [];
      rowRecords.push([
        row.id, row.stakeholder, row.stakeholderAttribution ?? "NOT_REPORTED", row.label, cell.key, cell.value,
        cell.unit ?? "", cell.quality, cell.sourceRecordId,
        evidence.map(item => item.evidenceId ?? "").join("; "),
        evidence.map(item => item.evidenceHash ?? "").join("; "),
        evidence.map(item => item.verificationId ?? "").join("; "),
        evidence.map(item => item.verificationStatus ?? "NOT_REPORTED").join("; "),
        cell.note ?? "",
      ]);
      if (evidence.length) {
        for (const item of evidence) provenance.push([
          row.id, cell.key, cell.sourceRecordId, item.evidenceId ?? "", item.evidenceHash ?? "",
          item.verificationId ?? "", item.verificationStatus ?? "NOT_REPORTED",
        ]);
      } else {
        provenance.push([row.id, cell.key, cell.sourceRecordId, "", "", "", "NO_EVIDENCE"]);
      }
    }
  }
  const qualityRows: unknown[][] = [["Type", "Code", "Row ID", "Field", "Detail"]];
  for (const issue of snapshot.issues) qualityRows.push(["ISSUE", issue.code, issue.rowId, issue.cellKey, issue.detail]);
  for (const [index, assumption] of (snapshot.assumptions ?? []).entries()) qualityRows.push(["ASSUMPTION", "A" + (index + 1), "", "", assumption]);

  const summary: unknown[][] = [
    ["RupayKg - Evidence-backed Environmental Report"],
    ["Report Type", snapshot.reportType],
    ["Title", snapshot.title],
    ["Report Status", snapshot.status],
    ["Organization ID", snapshot.organizationId],
    ["Reporting Period", snapshot.periodStart + " to " + snapshot.periodEnd],
    ["Geography Mode", snapshot.geographyMode],
    ["Geography Scope ID", snapshot.geographyScopeId ?? "Not specified"],
    ["Methodology", snapshot.methodologyCode + " v" + snapshot.methodologyVersion],
    ["Source Revision", snapshot.sourceRevision],
    ["Generated At", snapshot.generatedAt],
    ["Snapshot SHA-256", snapshot.snapshotHash],
    ["Schema Version", snapshot.schemaVersion],
    ["Source Records", snapshot.sourceRecordIds.length],
    ["Evidence Hashes", snapshot.evidenceHashes.length],
    ["Report Rows", snapshot.rows.length],
    ["Data Quality Issues", snapshot.issues.length],
    [],
    ["Assumptions"],
    ...(snapshot.assumptions ?? []).map((assumption, index) => ["A" + (index + 1), assumption]),
  ];

  const sheetNames = ["Summary", "Report Rows", "Provenance", "Data Quality"];
  const contentTypes = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
    '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
    '<Default Extension="xml" ContentType="application/xml"/>' +
    '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
    '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' +
    sheetNames.map((_, index) => '<Override PartName="/xl/worksheets/sheet' + (index + 1) + '.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>').join("") +
    '<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>' +
    '<Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>' +
    "</Types>";
  const workbook = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
    '<sheets>' + sheetNames.map((name, index) => '<sheet name="' + name + '" sheetId="' + (index + 1) + '" r:id="rId' + (index + 1) + '"/>').join("") +
    "</sheets><calcPr calcId=\"191029\"/></workbook>";
  const workbookRels = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
    sheetNames.map((_, index) => '<Relationship Id="rId' + (index + 1) + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet' + (index + 1) + '.xml"/>').join("") +
    '<Relationship Id="rId5" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>' +
    "</Relationships>";
  const packageRels = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
    '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>' +
    '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>' +
    '<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>' +
    "</Relationships>";
  const styles = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
    '<fonts count="3"><font><sz val="10"/><name val="Noto Sans"/></font><font><b/><sz val="16"/><name val="Noto Sans"/></font><font><b/><color rgb="FFFFFFFF"/><sz val="10"/><name val="Noto Sans"/></font></fonts>' +
    '<fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF1F4E78"/><bgColor indexed="64"/></patternFill></fill></fills>' +
    '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>' +
    '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
    '<cellXfs count="3"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/><xf numFmtId="0" fontId="2" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/></cellXfs>' +
    '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>';
  const core = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/">' +
    '<dc:title>' + xmlEscape(snapshot.title) + '</dc:title><dc:creator>RupayKg</dc:creator><cp:keywords>' + xmlEscape(snapshot.snapshotHash) + '</cp:keywords></cp:coreProperties>';
  const app = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">' +
    '<Application>RupayKg</Application><TitlesOfParts><vt:vector size="4" baseType="lpstr">' + sheetNames.map(name => '<vt:lpstr>' + name + '</vt:lpstr>').join("") + '</vt:vector></TitlesOfParts></Properties>';

  const files: Record<string, Uint8Array> = {
    "[Content_Types].xml": strToU8(contentTypes),
    "_rels/.rels": strToU8(packageRels),
    "xl/workbook.xml": strToU8(workbook),
    "xl/_rels/workbook.xml.rels": strToU8(workbookRels),
    "xl/styles.xml": strToU8(styles),
    "xl/worksheets/sheet1.xml": strToU8(sheetXml(summary, { title: true, widths: [28, 84] })),
    "xl/worksheets/sheet2.xml": strToU8(sheetXml(rowRecords, { header: true, freeze: true, filter: true, widths: [38, 22, 24, 42, 24, 18, 12, 16, 40, 44, 68, 44, 34, 72] })),
    "xl/worksheets/sheet3.xml": strToU8(sheetXml(provenance, { header: true, freeze: true, filter: true, widths: [38, 24, 40, 40, 68, 40, 28] })),
    "xl/worksheets/sheet4.xml": strToU8(sheetXml(qualityRows, { header: true, freeze: true, filter: true, widths: [18, 32, 38, 24, 100] })),
    "docProps/core.xml": strToU8(core),
    "docProps/app.xml": strToU8(app),
  };
  return Buffer.from(zipSync(files, { level: 6 }));
}

function findPdfFont(): string {
  const candidates = [
    fileURLToPath(new URL("../../assets/fonts/NotoSansDevanagari-Variable.ttf", import.meta.url)),
    fileURLToPath(new URL("../assets/fonts/NotoSansDevanagari-Variable.ttf", import.meta.url)),
    resolve(process.cwd(), "apps/assets/fonts/NotoSansDevanagari-Variable.ttf"),
    resolve(process.cwd(), "assets/fonts/NotoSansDevanagari-Variable.ttf"),
  ];
  const found = candidates.find(candidate => existsSync(candidate));
  if (!found) throw new Error("Bundled Noto Sans Devanagari PDF font is missing");
  return found;
}

export async function createReportPdf(snapshot: ReportSnapshot): Promise<Buffer> {
  const fontPath = findPdfFont();
  return new Promise((resolvePromise, rejectPromise) => {
    const doc = new PDFDocument({
      size: "A4",
      margins: { top: 44, right: 44, bottom: 48, left: 44 },
      bufferPages: true,
      info: { Title: snapshot.title, Author: "RupayKg", Subject: snapshot.reportType, Keywords: snapshot.snapshotHash },
    });
    const chunks: Buffer[] = [];
    doc.on("data", chunk => chunks.push(Buffer.from(chunk)));
    doc.on("error", rejectPromise);
    doc.on("end", () => resolvePromise(Buffer.concat(chunks)));
    try {
      const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
      const bottom = () => doc.page.height - doc.page.margins.bottom - 24;
      const ensureSpace = (height = 34) => { if (doc.y + height > bottom()) doc.addPage(); };
      const line = (label: string, value: unknown) => {
        ensureSpace(24);
        doc.font(fontPath).fontSize(9).fillColor("#334155").text(label + ": " + (value === null || value === undefined ? "Not reported" : String(value)), { width: pageWidth });
      };
      const section = (heading: string) => {
        ensureSpace(42);
        doc.moveDown(0.7);
        doc.font(fontPath).fontSize(13).fillColor("#1f4e78").text(heading, { width: pageWidth });
        doc.moveDown(0.2);
        doc.moveTo(doc.page.margins.left, doc.y).lineTo(doc.page.width - doc.page.margins.right, doc.y).strokeColor("#cbd5e1").stroke();
        doc.moveDown(0.4);
      };
      doc.font(fontPath).fontSize(20).fillColor("#1f4e78").text("RupayKg", { width: pageWidth });
      doc.font(fontPath).fontSize(15).fillColor("#0f172a").text(snapshot.title, { width: pageWidth });
      doc.moveDown(0.4);
      doc.font(fontPath).fontSize(10).fillColor("#334155").text("INTERNAL REPORT SNAPSHOT - NOT A STATUTORY FILING OR ASSURANCE OPINION", { width: pageWidth });
      doc.moveDown(0.8);

      section("Report Summary");
      line("Report Type", snapshot.reportType);
      line("Status", snapshot.status);
      line("Organization ID", snapshot.organizationId);
      line("Reporting Period", snapshot.periodStart + " to " + snapshot.periodEnd);
      line("Operating Context", snapshot.geographyMode);
      line("Geography Scope", snapshot.geographyScopeId ?? "Not specified");
      line("Methodology", snapshot.methodologyCode + " v" + snapshot.methodologyVersion);
      line("Source Revision", snapshot.sourceRevision);
      line("Generated At", snapshot.generatedAt);
      line("Schema Version", snapshot.schemaVersion);
      line("Source Records", snapshot.sourceRecordIds.length);
      line("Evidence Hashes", snapshot.evidenceHashes.length);
      line("Snapshot SHA-256", snapshot.snapshotHash);

      section("Report Data and Stakeholder Attribution");
      snapshot.rows.forEach((row, rowIndex) => {
        ensureSpace(54);
        doc.font(fontPath).fontSize(10).fillColor("#0f172a").text((rowIndex + 1) + ". " + row.label, { width: pageWidth });
        doc.font(fontPath).fontSize(8).fillColor("#475569").text("Stakeholder: " + row.stakeholder + " | Attribution: " + (row.stakeholderAttribution ?? "NOT_REPORTED") + " | Row ID: " + row.id, { width: pageWidth });
        for (const cell of row.cells) {
          ensureSpace(42);
          const value = cell.value === null ? "MISSING" : String(cell.value);
          doc.font(fontPath).fontSize(9).fillColor("#334155").text(
            "Field: " + cell.key + " | Value: " + value + (cell.unit ? " " + cell.unit : "") + " | Quality: " + cell.quality,
            { width: pageWidth, indent: 10 },
          );
          doc.font(fontPath).fontSize(8).fillColor("#475569").text("Source Record: " + cell.sourceRecordId, { width: pageWidth, indent: 10 });
          if (cell.note) doc.font(fontPath).fontSize(8).fillColor("#475569").text("Note: " + cell.note, { width: pageWidth, indent: 10 });
          for (const evidence of cell.evidence ?? []) {
            doc.font(fontPath).fontSize(8).fillColor("#475569").text(
              "Evidence: " + (evidence.evidenceId ?? "Not reported") + " | SHA-256: " + (evidence.evidenceHash ?? "Not reported") +
              " | Verification: " + (evidence.verificationId ?? "Not reported") + " (" + (evidence.verificationStatus ?? "NOT_REPORTED") + ")",
              { width: pageWidth, indent: 10 },
            );
          }
        }
        doc.moveDown(0.35);
      });

      section("Data Quality Issues");
      if (!snapshot.issues.length) {
        doc.font(fontPath).fontSize(9).fillColor("#334155").text("No data-quality issues were recorded in this snapshot.", { width: pageWidth });
      } else {
        snapshot.issues.forEach((issue, index) => {
          ensureSpace(38);
          doc.font(fontPath).fontSize(9).fillColor("#334155").text((index + 1) + ". " + issue.code + " | Row: " + issue.rowId + " | Field: " + issue.cellKey, { width: pageWidth });
          doc.font(fontPath).fontSize(8).fillColor("#475569").text(issue.detail, { width: pageWidth, indent: 10 });
        });
      }

      section("Methodology and Assumptions");
      for (const [index, assumption] of (snapshot.assumptions ?? []).entries()) {
        ensureSpace(30);
        doc.font(fontPath).fontSize(8).fillColor("#334155").text((index + 1) + ". " + assumption, { width: pageWidth });
      }

      section("Integrity and Use Notice");
      doc.font(fontPath).fontSize(8).fillColor("#334155").text(
        "This export reproduces the immutable saved snapshot identified by the SHA-256 hash above. It does not represent CPCB portal submission, statutory acceptance, certification, verified carbon credits, independent assurance or regulatory approval. Declared, estimated, disputed, missing and unmapped fields retain their explicit quality labels.",
        { width: pageWidth },
      );

      const pages = doc.bufferedPageRange();
      for (let page = pages.start; page < pages.start + pages.count; page++) {
        doc.switchToPage(page);
        doc.font(fontPath).fontSize(7).fillColor("#64748b").text(
          "RupayKg | Snapshot " + snapshot.snapshotHash.slice(0, 16) + " | Page " + (page + 1) + " of " + pages.count,
          doc.page.margins.left,
          doc.page.height - 28,
          { width: pageWidth, align: "center", lineBreak: false },
        );
      }
      doc.end();
    } catch (error) {
      rejectPromise(error);
    }
  });
}

export async function createReportXlsx(snapshot: ReportSnapshot): Promise<Buffer> {
  return buildWorkbook(snapshot);
}
