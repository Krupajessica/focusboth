// Builds FocusBoth_Capstone_Report.docx from report/content_*.js, data/etl_log.json,
// outputs/metrics.json and outputs/figures/*.png.   Run: node report/build_report.js
const fs = require("fs");
const path = require("path");
const {
  Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, ImageRun, Table, TableRow,
  TableCell, WidthType, BorderStyle, ShadingType, TableOfContents, PageBreak, Footer, PageNumber,
  LevelFormat, Header, TabStopType,
} = require("docx");

const ROOT = path.resolve(__dirname, "..");
const S = require("./content_static.js");
const R = require("./content_results.js");
const etl = JSON.parse(fs.readFileSync(path.join(ROOT, "data/etl_log.json")));
const facts = {
  ...JSON.parse(fs.readFileSync(path.join(ROOT, "outputs/report_facts.json"))),
  ...JSON.parse(fs.readFileSync(path.join(ROOT, "outputs/verification.json"))),
};
const metrics = JSON.parse(fs.readFileSync(path.join(ROOT, "outputs/metrics.json")));

const FONT = "Calibri";
const INK = "1F2937";
const ACCENT = "1F4E79";

// ---------- numbering of figures / tables ----------
let figN = 0, tabN = 0;
const figIds = {}, tabIds = {};
const fig = (id) => (figIds[id] ??= ++figN);
const tab = (id) => (tabIds[id] ??= ++tabN);
// Pre-register order so in-text references resolve before the object appears.
["quarters", "employers", "occupations", "states", "arch", "star",
 "m1_roc", "m1_cal", "m1_imp", "wage_level", "wage_state", "m2m3", "focus"].forEach(fig);
["sources", "etl", "m1", "m2", "m3", "focus", "ai"].forEach(tab);

// ---------- template fill ----------
const fmtInt = (n) => Number(n).toLocaleString("en-US");
const pct = (x, d = 1) => `${(100 * x).toFixed(d)}%`;
const VARS = {
  ...Object.fromEntries(Object.entries(facts).map(([k, v]) => [k, v])),
  rows_clean: fmtInt(etl.rows_clean),
  employers: fmtInt(etl.employers),
  dups: fmtInt(etl.rows_raw - etl.rows_after_dedup),
  non_h1b: fmtInt(etl.rows_after_dedup - etl.rows_h1b),
  wages_nulled: fmtInt(etl.wages_nulled_out_of_range),
  q_first: etl.quarters[0], q_last: etl.quarters[etl.quarters.length - 1],
  m2_coverage: pct(metrics.M2_title_to_soc.row_coverage_of_top_classes),
  ...Object.fromEntries(Object.keys(figIds).map((k) => [`F_${k}`, figIds[k]])),
  ...Object.fromEntries(Object.keys(tabIds).map((k) => [`T_${k}`, tabIds[k]])),
};
function fill(s) {
  return s.replace(/\{\{(\w+)\}\}/g, (_, k) => {
    if (!(k in VARS)) throw new Error(`Missing template var ${k}`);
    return String(VARS[k]);
  });
}

// ---------- building blocks ----------
// Inline citations like [3] stay as text; **bold** segments supported.
function runs(text, opts = {}) {
  const out = [];
  fill(text).split(/(\*\*[^*]+\*\*)/).forEach((part) => {
    if (!part) return;
    const bold = part.startsWith("**");
    out.push(new TextRun({ text: bold ? part.slice(2, -2) : part, bold: bold || opts.bold, italics: opts.italics, size: opts.size, color: opts.color }));
  });
  return out;
}
const P = (text, opts = {}) =>
  new Paragraph({ children: runs(text, opts), spacing: { after: 140, line: 300 }, alignment: opts.align ?? AlignmentType.JUSTIFIED, keepNext: opts.keepNext });
const H1 = (t) => new Paragraph({ heading: HeadingLevel.HEADING_1, numbering: { reference: "heads", level: 0 }, children: [new TextRun(t)], pageBreakBefore: false });
const H2 = (t) => new Paragraph({ heading: HeadingLevel.HEADING_2, numbering: { reference: "heads", level: 1 }, children: [new TextRun(t)] });
const H3 = (t) => new Paragraph({ heading: HeadingLevel.HEADING_3, numbering: { reference: "heads", level: 2 }, children: [new TextRun(t)] });
const BUL = (t) => new Paragraph({ numbering: { reference: "bullets", level: 0 }, children: runs(t), spacing: { after: 80, line: 290 } });
const NUM = (t, ref = "nums") => new Paragraph({ numbering: { reference: ref, level: 0 }, children: runs(t), spacing: { after: 80, line: 290 } });

function caption(kind, n, text) {
  return new Paragraph({
    alignment: AlignmentType.CENTER, spacing: { before: 60, after: 220 },
    children: [new TextRun({ text: `${kind} ${n}. `, bold: true, size: 19, color: INK }), new TextRun({ text: fill(text), italics: true, size: 19, color: "4B5563" })],
  });
}

function pngSize(file) {
  const b = fs.readFileSync(file);
  return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) };
}
function FIG(id, file, text, widthIn = 6.2) {
  const f = path.join(ROOT, file);
  const { w, h } = pngSize(f);
  const W = widthIn * 96, H = Math.round((W * h) / w);
  return [
    new Paragraph({ alignment: AlignmentType.CENTER, keepNext: true, spacing: { before: 120 },
      children: [new ImageRun({ type: "png", data: fs.readFileSync(f), transformation: { width: W, height: H }, altText: { title: text, description: text, name: id } })] }),
    caption("Figure", fig(id), text),
  ];
}

const border = { style: BorderStyle.SINGLE, size: 4, color: "C9CED6" };
const borders = { top: border, bottom: border, left: border, right: border };
function TABLE(id, title, header, rows, widths) {
  const total = widths.reduce((a, b) => a + b, 0);
  const cell = (text, i, head) => new TableCell({
    borders, width: { size: widths[i], type: WidthType.DXA },
    shading: head ? { fill: "E8EEF5", type: ShadingType.CLEAR, color: "auto" } : undefined,
    margins: { top: 60, bottom: 60, left: 100, right: 100 },
    children: [new Paragraph({ alignment: i === 0 || isNaN(parseFloat(String(text).replace(/[$,%*]/g, ""))) ? AlignmentType.LEFT : AlignmentType.RIGHT,
      children: runs(String(text), { bold: head, size: 18 }) })],
  });
  return [
    new Paragraph({ alignment: AlignmentType.CENTER, keepNext: true, spacing: { before: 160, after: 80 },
      children: [new TextRun({ text: `Table ${tab(id)}. `, bold: true, size: 19 }), new TextRun({ text: fill(title), italics: true, size: 19, color: "4B5563" })] }),
    new Table({ width: { size: total, type: WidthType.DXA }, columnWidths: widths,
      rows: [new TableRow({ tableHeader: true, children: header.map((h, i) => cell(h, i, true)) }),
             ...rows.map((r) => new TableRow({ children: r.map((c, i) => cell(c, i, false)) }))] }),
    new Paragraph({ spacing: { after: 160 }, children: [] }),
  ];
}

module.exports = { P, H1, H2, H3, BUL, NUM, FIG, TABLE, fig, tab, fill, pct, fmtInt };

// ---------- references (IEEE) ----------
const REFS = require("./references.js");

// ---------- document ----------
function build() {
  const body = [];
  const push = (...xs) => xs.flat().forEach((x) => body.push(x));

  // Abstract
  push(new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun("Abstract")] }));
  S.abstract.forEach((t) => push(P(t)));
  push(new Paragraph({ children: [new PageBreak()] }));

  // 1 Introduction
  push(H1("Introduction and Business Problem"));
  push(H2("Business Problem"));
  S.intro.problem.forEach((t) => push(P(t)));
  push(H2("Statement of Purpose"));
  push(P(S.intro.purpose));
  push(H2("Research Objectives"));
  S.intro.objectives.forEach((t) => push(NUM(t, "obj")));
  push(H2("Why It Matters"));
  push(P(S.intro.importance));

  // 2 Related work
  push(H1("Related Work"));
  S.related.forEach((sec) => { push(H2(sec.head)); sec.paras.forEach((t) => push(P(t))); });

  // 3 Data
  push(H1("Data Description"));
  push(H2("Data Sources"));
  push(P(S.data.sources_intro));
  push(TABLE("sources", "Data sources integrated in FocusBoth",
    ["Source", "Access", "Refresh", "Role in project"],
    [["U.S. DOL OFLC LCA disclosure files [3]", "Public quarterly Excel files", "Quarterly (batch)", "Primary analytics dataset; star schema; models M1–M3"],
     ["Greenhouse Job Board API [15]", "Public JSON, no key", "30 minutes", "Live openings from {{boards}} employers; exact apply links"],
     ["Devpost hackathon listings", "Public JSON", "30 minutes", "Discover screen (hackathons)"],
     ["confs.tech conference data [16]", "Open GitHub JSON", "30 minutes", "Discover screen (tech conferences)"],
     ["Student-entered profile", "Typed into the app", "Live", "Visa dates, unemployment days, weekly wellbeing goals"]],
    [2600, 1900, 1300, 3560]));
  push(H2("LCA Disclosure Data"));
  S.data.lca_desc.forEach((t) => push(P(t)));
  push(H2("Features and Characteristics"));
  S.data.characteristics.forEach((t) => push(P(t)));
  R.dataFigures().forEach((x) => push(x));
  push(H2("Limitations"));
  S.data.limitations.forEach((t) => push(BUL(t)));

  // 4 Models
  push(H1("Models"));
  push(H2("System Architecture"));
  push(P(S.methods.arch));
  push(FIG("arch", "report/diagrams/arch.png", "End-to-end architecture: ETL, warehouse, models and the FocusBoth application", 6.5));
  push(H2("ETL Pipeline"));
  push(TABLE("etl", "ETL steps implemented in analytics/etl.py",
    ["Step", "What it does"], S.methods.etl, [2000, 7360]));
  push(H2("Dimensional Model"));
  push(P(S.methods.star));
  push(FIG("star", "report/diagrams/star.png", "Star schema: fact_lca with employer, occupation, location and date dimensions", 6.5));
  push(H2("M1: Employer Sponsorship Signal"));
  S.methods.m1.forEach((t) => push(P(t)));
  push(H2("M2: Job Title to Occupation (Text Classification)"));
  S.methods.m2.forEach((t) => push(P(t)));
  push(H2("M3: Sponsored Wage Regression"));
  S.methods.m3.forEach((t) => push(P(t)));
  push(H2("Application and Model Deployment"));
  S.methods.app.forEach((t) => push(P(t)));

  // 5 Results, 6 Conclusions, 7 Contributions
  R.results().forEach((x) => push(x));
  R.conclusions().forEach((x) => push(x));
  R.contributions().forEach((x) => push(x));

  // 8 References
  push(H1("References"));
  REFS.forEach((r, i) => push(new Paragraph({ spacing: { after: 100, line: 276 }, indent: { left: 560, hanging: 560 },
    children: [new TextRun({ text: `[${i + 1}]`, size: 20 }), new TextRun({ text: "\t" + r, size: 20 })],
    tabStops: [{ type: TabStopType.LEFT, position: 560 }] })));

  // 9 Appendix
  R.appendix().forEach((x) => push(x));
  return body;
}

const cover = [
  new Paragraph({ spacing: { before: 2400 }, alignment: AlignmentType.CENTER, children: [new TextRun({ text: "FocusBoth", bold: true, size: 64, color: ACCENT })] }),
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 200 }, children: [new TextRun({ text: "Predicting H-1B Sponsorship for OPT Job Seekers with DOL Labor Condition Application Data", size: 32, color: INK })] }),
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 1400 }, children: [new TextRun({ text: "An applied research project in data engineering, machine learning and decision support", italics: true, size: 24, color: "4B5563" })] }),
  new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "Jessica Anguluri", bold: true, size: 28 })] }),
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 600 }, children: [new TextRun({ text: "Individual Applied Research Project", size: 22, color: "4B5563" })] }),
  new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "BAN 693 Business Analytics Capstone Project", size: 22 })] }),
  new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "Instructor: Dr. Surendra Sarnikar", size: 22 })] }),
  new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "California State University, East Bay", size: 22 })] }),
  new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "Fall 2026", size: 22 })] }),
];

const toc = [
  new Paragraph({ children: [new TextRun({ text: "Table of Contents", bold: true, size: 32, color: ACCENT })], spacing: { after: 200 } }),
  new TableOfContents("Table of Contents", { hyperlink: true, headingStyleRange: "1-3" }),
  new Paragraph({ children: [new PageBreak()] }),
];

const doc = new Document({
  creator: "Jessica Anguluri",
  title: "FocusBoth: Predicting H-1B Sponsorship for OPT Job Seekers",
  features: { updateFields: true },
  styles: {
    default: { document: { run: { font: FONT, size: 22, color: INK } } },
    paragraphStyles: [
      { id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 32, bold: true, font: FONT, color: ACCENT }, paragraph: { spacing: { before: 360, after: 160 }, outlineLevel: 0, keepNext: true } },
      { id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 26, bold: true, font: FONT, color: ACCENT }, paragraph: { spacing: { before: 260, after: 120 }, outlineLevel: 1, keepNext: true } },
      { id: "Heading3", name: "Heading 3", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 23, bold: true, italics: true, font: FONT, color: INK }, paragraph: { spacing: { before: 200, after: 100 }, outlineLevel: 2, keepNext: true } },
    ],
  },
  numbering: {
    config: [
      { reference: "heads", levels: [
        { level: 0, format: LevelFormat.DECIMAL, text: "%1.", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 432, hanging: 432 } } } },
        { level: 1, format: LevelFormat.DECIMAL, text: "%1.%2", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 576, hanging: 576 } } } },
        { level: 2, format: LevelFormat.DECIMAL, text: "%1.%2.%3", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 720, hanging: 720 } } } } ] },
      { reference: "bullets", levels: [{ level: 0, format: LevelFormat.BULLET, text: "•", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 720, hanging: 360 } } } }] },
      { reference: "nums", levels: [{ level: 0, format: LevelFormat.DECIMAL, text: "%1.", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 720, hanging: 360 } } } }] },
      { reference: "obj", levels: [{ level: 0, format: LevelFormat.DECIMAL, text: "O%1.", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 720, hanging: 480 } } } }] },
      { reference: "contrib", levels: [{ level: 0, format: LevelFormat.DECIMAL, text: "%1.", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 720, hanging: 360 } } } }] },
    ],
  },
  sections: [
    { properties: { page: { size: { width: 12240, height: 15840 }, margin: { top: 1440, bottom: 1440, left: 1440, right: 1440 } } },
      children: cover },
    { properties: { page: { size: { width: 12240, height: 15840 }, margin: { top: 1440, bottom: 1440, left: 1440, right: 1440 } } },
      headers: { default: new Header({ children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: "FocusBoth: H-1B Sponsorship Analytics", size: 16, color: "6B7280" })] })] }) },
      footers: { default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ children: [PageNumber.CURRENT], size: 18, color: "6B7280" })] })] }) },
      children: [...toc, ...build()] },
  ],
});

Packer.toBuffer(doc).then((buf) => {
  const out = path.join(ROOT, "report", "FocusBoth_Capstone_Report.docx");
  fs.writeFileSync(out, buf);
  console.log("wrote", out, `(${figN} figures, ${tabN} tables)`);
});
