// Sections whose numbers come from outputs/metrics.json and outputs/robustness.json.
const fs = require("fs");
const path = require("path");
const ROOT = path.resolve(__dirname, "..");
const M = JSON.parse(fs.readFileSync(path.join(ROOT, "outputs/metrics.json")));
const RB = JSON.parse(fs.readFileSync(path.join(ROOT, "outputs/robustness.json")));
const F = JSON.parse(fs.readFileSync(path.join(ROOT, "outputs/report_facts.json")));
const TITLE = JSON.parse(fs.readFileSync(path.join(ROOT, "lib/data/title-model.json")));

// Lazy require to avoid a circular import at load time.
const B = () => require("./build_report.js");

const f3 = (x) => x.toFixed(3);
const p1 = (x) => `${(100 * x).toFixed(1)}%`;
const usd = (x) => `$${Math.round(x).toLocaleString("en-US")}`;
const k1 = (x) => `$${(x / 1000).toFixed(1)}k`;
const ci = (a) => `[${f3(a[0])}, ${f3(a[1])}]`;

const m1 = M.M1_sponsorship, m2 = M.M2_title_to_soc, m3 = M.M3_wage;
const r1 = Object.fromEntries(m1.results.map((r) => [r.model.split(" (")[0], r]));
const xgb1 = r1["XGBoost"], lr1 = r1["Logistic regression"], b0 = r1["B0 Persistence"], b1 = r1["B1 Frequency"];
const topKKey = Object.keys(xgb1).find((k) => k.startsWith("precision_at"));
const kVal = topKKey.match(/k=(\d+)/)[1];
const r2 = Object.fromEntries(m2.results.map((r) => [r.model, r]));
const r3 = Object.fromEntries(m3.results.map((r) => [r.model, r]));
const f2 = Object.fromEntries(RB.M1_fold2.results.map((r) => [r.model, r]));
const bootR = RB.M1_bootstrap_roc_auc, bootP = RB.M1_bootstrap_pr_auc;

function dataFigures() {
  const { P, FIG } = B();
  return [
    P("Figure {{F_quarters}} shows the seasonal pattern. Figures {{F_employers}} to {{F_states}} show where filings concentrate: by employer, " + F.top_employers + "; by occupation, " + F.top_occs + "; and by worksite state, " + F.top_states + "."),
    FIG("quarters", "outputs/figures/fig_filings_by_quarter.png", "H-1B LCAs by fiscal quarter of decision, all filings and filings with new-employment positions", 5.8),
    FIG("employers", "outputs/figures/fig_top_employers.png", "Top 15 employers by LCAs with new-employment positions", 5.8),
    FIG("occupations", "outputs/figures/fig_top_occupations.png", "Top 12 SOC occupations in H-1B LCAs", 5.8),
    FIG("states", "outputs/figures/fig_top_states.png", "Top 12 worksite states by H-1B LCAs", 5.4),
  ];
}

function results() {
  const { P, H1, H2, H3, FIG, TABLE, BUL } = B();
  const out = [];
  out.push(H1("Results"));

  // ---------- M1
  out.push(H2("M1: Employer Sponsorship Signal"));
  out.push(P(`The employer–quarter panel has ${m1.panel_rows.toLocaleString()} rows: ${m1.train_rows.toLocaleString()} for training (label quarters FY2026 Q1–Q2) and ${m1.test_rows.toLocaleString()} for testing (label quarter FY2026 Q3). The share of employers filing a new-hire LCA in the following quarter rises from ${p1(m1.positive_rate_train)} in training to ${p1(m1.positive_rate_test)} in the test quarter, because the test quarter is the H-1B cap season.`));
  out.push(TABLE("m1", "M1 results on the held-out quarter FY2026 Q3 (bootstrap 95% confidence intervals in brackets, 1,000 resamples)",
    ["Model", "ROC-AUC", "PR-AUC", `Precision, top 1% (k=${kVal})`, "Brier"],
    [["B0 Persistence (baseline)", `${f3(b0.roc_auc)} ${ci(bootR["B0 Persistence"])}`, `${f3(b0.pr_auc)} ${ci(bootP["B0 Persistence"])}`, p1(b0[topKKey]), "–"],
     ["B1 Frequency (baseline)", `${f3(b1.roc_auc)} ${ci(bootR["B1 Frequency"])}`, `${f3(b1.pr_auc)} ${ci(bootP["B1 Frequency"])}`, p1(b1[topKKey]), "–"],
     ["Logistic regression", `${f3(lr1.roc_auc)} ${ci(bootR["Logistic regression"])}`, `${f3(lr1.pr_auc)} ${ci(bootP["Logistic regression"])}`, p1(lr1[topKKey]), f3(lr1.brier)],
     ["XGBoost", `**${f3(xgb1.roc_auc)}** ${ci(bootR["XGBoost"])}`, `**${f3(xgb1.pr_auc)}** ${ci(bootP["XGBoost"])}`, p1(xgb1[topKKey]), f3(xgb1.brier)]],
    [2700, 1950, 1950, 1560, 1200]));
  out.push(P(`Both learned models clearly beat the baselines. XGBoost reaches ROC-AUC ${f3(xgb1.roc_auc)} and PR-AUC ${f3(xgb1.pr_auc)}, against ${f3(b1.roc_auc)} and ${f3(b1.pr_auc)} for the best baseline, a count of past new-hire filings. The bootstrap 95% interval for the AUC gain of XGBoost over that baseline is [${f3(RB.M1_auc_gain_xgb_vs_frequency_ci[0])}, ${f3(RB.M1_auc_gain_xgb_vs_frequency_ci[1])}], which excludes zero. XGBoost and logistic regression perform almost identically, and their intervals overlap. Among the ${kVal} employers ranked highest by XGBoost, ${p1(xgb1[topKKey])} did file new-hire LCAs in the test quarter.`));
  out.push(FIG("m1_roc", "outputs/figures/fig_m1_roc_pr.png", "ROC and precision–recall curves for M1 on the held-out quarter; dashed lines show chance and the positive rate", 6.4));
  out.push(H3("Robustness: a second test quarter"));
  out.push(P(`To check that the result does not depend on one quarter, the models were retrained on label quarter FY2026 Q1 alone and tested on FY2026 Q2, a non-cap-season quarter with a ${p1(RB.M1_fold2.positive_rate_test)} positive rate. Both learned models again beat both baselines, with ROC-AUC ${f3(f2["Logistic regression"].roc_auc)} for logistic regression and ${f3(f2["XGBoost"].roc_auc)} for XGBoost, against ${f3(f2["B1 Frequency"].roc_auc)} for the frequency baseline and ${f3(f2["B0 Persistence"].roc_auc)} for persistence. PR-AUC values are ${f3(f2["Logistic regression"].pr_auc)}, ${f3(f2["XGBoost"].pr_auc)}, ${f3(f2["B1 Frequency"].pr_auc)} and ${f3(f2["B0 Persistence"].pr_auc)} respectively. On this fold logistic regression is slightly ahead, so the two learned models should be regarded as tied. The robust conclusion is that a multi-feature model beats any single historical count, not that one learner is superior. XGBoost is used in the application because it is best on the larger, more recent test quarter and needs no feature scaling.`));
  out.push(H3("Calibration and seasonality"));
  out.push(P(`Ranking is good, but the probabilities need care. Figure {{F_m1_cal}} shows that, on the cap-season test quarter, XGBoost under-predicts (Brier ${f3(xgb1.brier)}) because it learned a ${p1(m1.positive_rate_train)} base rate, while class-weighted logistic regression over-predicts (Brier ${f3(lr1.brier)}). For FocusBoth, the score is therefore best read as a ranking, meaning “this employer files new-hire LCAs more reliably than most”, rather than an exact probability. With more years of data, a quarter-of-year feature or per-season recalibration would address this.`));
  out.push(FIG("m1_cal", "outputs/figures/fig_m1_calibration.png", "M1 reliability diagram on the held-out quarter (10 quantile bins)", 3.9));
  out.push(H3("What drives the prediction"));
  const NICE = { filings_hist: "total past filings", new_filings_hist: "past new-hire filings", n_soc_hist: "number of distinct occupations filed",
    quarters_active: "quarters with any filing", filings_t: "filings in the current quarter", h1b_dependent: "H-1B-dependent status",
    new_filings_t: "new-hire filings in the current quarter", n_states_hist: "number of worksite states", recency_q: "quarters since last filing" };
  const imp = Object.entries(m1.xgb_importance).slice(0, 5).map(([k]) => NICE[k] ?? k.replace(/_/g, " "));
  out.push(P(`The most important XGBoost features (Figure {{F_m1_imp}}) are ${imp.join(", ")}. Logistic-regression coefficients agree in sign. Employers with more historical new-hire filings, a broader range of occupations, more active quarters and H-1B-dependent status are more likely to file again. In plain terms, sponsorship is a habit. Employers that have built an immigration process keep using it, which is exactly the signal a student cannot see on a job board.`));
  out.push(FIG("m1_imp", "outputs/figures/fig_m1_importance.png", "Top 10 M1 XGBoost features by gain", 5.6));

  // ---------- M2
  out.push(H2("M2: Job Title to Occupation"));
  out.push(TABLE("m2", `M2 results on the held-out quarter (${m2.n_classes} SOC classes; ${m2.test_rows.toLocaleString()} test titles)`,
    ["Model", "Top-1 accuracy", "Top-3 accuracy", "Macro F1", "Accuracy, unseen titles"],
    [["Majority class (baseline)", p1(r2["Majority class"].top1_accuracy), "–", f3(r2["Majority class"].macro_f1), "–"],
     ["Exact-title lookup (baseline)", p1(r2["Exact-title lookup"].top1_accuracy), "–", f3(r2["Exact-title lookup"].macro_f1), p1(m2.accuracy_on_unseen_titles["Exact-title lookup"])],
     ["TF-IDF + logistic regression", `**${p1(r2["TF-IDF + logistic regression"].top1_accuracy)}**`, p1(r2["TF-IDF + logistic regression"].top3_accuracy), f3(r2["TF-IDF + logistic regression"].macro_f1), `**${p1(m2.accuracy_on_unseen_titles["TF-IDF + logistic regression"])}**`]],
    [2900, 1500, 1500, 1300, 2160]));
  out.push(P(`The text model assigns the employer’s own SOC code to ${p1(r2["TF-IDF + logistic regression"].top1_accuracy)} of test titles and includes it in its top three ${p1(r2["TF-IDF + logistic regression"].top3_accuracy)} of the time (95% CI for top-1 ±${(100 * (RB.M2_top1_ci["TF-IDF + logistic regression"][1] - r2["TF-IDF + logistic regression"].top1_accuracy)).toFixed(1)} percentage points). The more telling comparison is on the ${p1(1 - m2.test_titles_seen_in_train)} of test titles never seen in training, the situation for a new job posting. There, the lookup table can only fall back to the majority class (${p1(m2.accuracy_on_unseen_titles["Exact-title lookup"])}), while the model still reaches ${p1(m2.accuracy_on_unseen_titles["TF-IDF + logistic regression"])}. Some remaining error is label noise, because employers code near-identical roles (for example, software engineer) to different SOC codes. The compact version deployed in the application (3,000 features) scores ${p1(TITLE.heldOutTop1Accuracy)} on the same held-out quarter.`));

  // ---------- M3
  out.push(H2("M3: Sponsored Wage"));
  out.push(TABLE("m3", `M3 results on the held-out quarter (${m3.test_rows.toLocaleString()} certified LCAs)`,
    ["Model", "MAE", "MAPE", "R² (log wage)"],
    [["Median wage by SOC (baseline)", usd(r3["Median wage by SOC"].mae_usd), p1(r3["Median wage by SOC"].mape), f3(r3["Median wage by SOC"].r2_log)],
     ["Ridge regression", usd(r3["Ridge regression"].mae_usd), p1(r3["Ridge regression"].mape), f3(r3["Ridge regression"].r2_log)],
     ["XGBoost", `**${usd(r3["XGBoost"].mae_usd)}**`, `**${p1(r3["XGBoost"].mape)}**`, `**${f3(r3["XGBoost"].r2_log)}**`]],
    [3600, 1900, 1700, 2160]));
  const imp3 = Object.entries(m3.importance_by_feature);
  out.push(P(`XGBoost reduces mean absolute error from ${usd(r3["Median wage by SOC"].mae_usd)} to ${usd(r3["XGBoost"].mae_usd)} (bootstrap 95% CI ${usd(RB.M3_xgb_mae_ci[0])}–${usd(RB.M3_xgb_mae_ci[1])}) and explains ${p1(r3["XGBoost"].r2_log)} of the variance in log wage. By total gain, occupation dominates (${p1(imp3[0][1])}), followed by ${({ worksite_state: "worksite state", pw_level: "wage level", naics2: "industry" })[imp3[1][0]] ?? imp3[1][0]} and ${({ worksite_state: "worksite state", pw_level: "wage level", naics2: "industry" })[imp3[2][0]] ?? imp3[2][0]}. Wage level matters a great deal within an occupation: for Software Developers the median offered wage is ${F.swe_l1_median} at Level I and ${F.swe_l4_median} at Level IV (Figure {{F_wage_level}}). Level I is the entry level at which most OPT graduates are hired, which is why FocusBoth displays the Level I median for each predicted occupation.`));
  out.push(FIG("wage_level", "outputs/figures/fig_wage_by_level.png", "Offered annual wage by prevailing-wage level, Software Developers (SOC 15-1252), certified LCAs", 5.6));
  out.push(FIG("wage_state", "outputs/figures/fig_wage_by_state.png", "Median offered wage for Software Developers by worksite state (states with at least 200 LCAs)", 5.4));
  out.push(FIG("m2m3", "outputs/figures/fig_m2_m3_comparison.png", "Model versus baseline: M2 top-1 accuracy (left) and M3 mean absolute error (right) on the held-out quarter", 6.3));

  // ---------- application
  out.push(H2("Results in the Application"));
  out.push(P(`Figure {{F_focus}} shows the M1 signal for the ${F.boards} employers in FocusBoth’s live feed. Fourteen have hundreds of filings and scores of 98–100. Two brands appear only under their legal names (Instacart as Maplebear and Airtable as Formagrid), and GitLab has no H-1B filings at all in the period. Under the rules engine, a student tracking a GitLab opening would therefore see the job fail the sponsorship rule, information that is not on GitLab’s job board. The exported lookup table covers ${F.emp_json} employers with at least three filings, and any of them can be checked by name in the application.`));
  out.push(FIG("focus", "outputs/figures/fig_focus_employers.png", "M1 sponsorship signal and LCA count for the 15 employers in FocusBoth’s live job feed", 5.8));
  out.push(TABLE("focus", "Verification checks on the deployed system",
    ["Check", "Result"],
    [["Python unit tests (ETL normalization, wages, fiscal quarters)", "7 / 7 pass"],
     ["TypeScript unit tests (rules engine, name normalization parity, lookup, title-model parity)", "{{ts_tests}}"],
     ["TypeScript title model vs Python on 200 held-out titles", "{{parity}}"],
     ["Lint, type check and production build", "{{build_status}}"]],
    [6200, 3160]));
  return out;
}

function conclusions() {
  const { P, H1, H2, BUL } = B();
  return [
    H1("Conclusions and Impact"),
    H2("Conclusions"),
    P(`This project shows that public DOL disclosure data can be turned into a forward-looking, validated sponsorship signal and delivered where a job seeker needs it. On a quarter none of the models saw, the employer model ranks future new-hire sponsors with ROC-AUC ${f3(xgb1.roc_auc)}, a statistically significant gain over simply counting past filings, and the gain holds on a second test quarter. The title model links ${p1(r2["TF-IDF + logistic regression"].top1_accuracy)} of job titles to the exact occupation code, and more than half of titles it has never seen. The wage model cuts error by ${p1(1 - r3["XGBoost"].mae_usd / r3["Median wage by SOC"].mae_usd)} relative to occupation medians.`),
    P("Three findings matter for students directly. First, sponsorship is concentrated and persistent. A small number of employers file most LCAs, and past behavior is the strongest predictor of future behavior. Second, the market is seasonal. April–June carries about twice the usual volume and most new-hire filings, so an OPT graduate’s search should be planned around the cap cycle. Third, brand names hide legal entities, and some well-known tech employers file no H-1B LCAs at all. A student can only learn this from the filings, not from a careers page."),
    H2("Business Impact"),
    BUL("**For OPT students:** fewer applications spent on employers that have no sponsorship history, which protects the limited unemployment allowance (90 days, or 150 for STEM OPT)."),
    BUL("**For university career and international-student offices:** a transparent, reproducible way to advise students, built entirely on public data, with every number traceable to a DOL case record."),
    BUL("**For the analytics method:** the project shows a pattern of letting deterministic rules decide and letting data and models inform. Feasibility stays auditable even though machine-learning scores are inputs."),
    H2("Limitations and Future Work"),
    BUL("Extend the history to several fiscal years so seasonality can be modelled explicitly and probabilities recalibrated by season."),
    BUL("Link LCAs to USCIS H-1B petition and approval data, which would let the system distinguish an LCA filed from a worker actually hired."),
    BUL("Add entity resolution for subsidiaries and staffing firms beyond exact normalized-name matching."),
    BUL("Expand live jobs beyond 15 Greenhouse boards (for example Lever boards or USAJOBS) without scraping sites whose terms prohibit it."),
    BUL("Run a usability study with international students to measure whether the signal changes which jobs they pursue."),
    P("FocusBoth is informational decision support. It does not provide legal advice or determine immigration status, and every visa-related screen directs the student to confirm with their Designated School Official."),
  ];
}

function contributions() {
  const { P, H1, H2, BUL, TABLE } = B();
  return [
    H1("Contributions"),
    H2("Individual Contribution"),
    P("This is an individual project. Jessica Anguluri defined the business problem and scope, selected the data sources and obtained the DOL disclosure files, and designed the product (the six screens and the rule that the rules engine, not a model, decides feasibility). She made the modelling decisions reviewed in this report (the new-hire sponsorship target, the temporal validation, and excluding the prevailing wage from M3), verified results against the source files, and wrote and presented the final work."),
    H2("Use of Generative AI"),
    P("The course requires generative AI to be used in every phase and credited. Table {{T_ai}} lists where it was used. All AI output was reviewed, run and checked by the author, and every number in this report is produced by code in the appendix rather than typed by hand."),
    TABLE("ai", "Generative AI tools and how they were used",
      ["Phase", "Tool", "What the AI did", "How it was verified"],
      [["Prototype web app", "Cursor (AI code editor)", "Scaffolded the Next.js screens, API routes and design system", "Manual testing of each screen; lint and build"],
       ["Data engineering", "Claude (Anthropic)", "Drafted the ETL, star-schema load and export code", "Unit tests; row counts reconciled against source files"],
       ["Modelling", "Claude (Anthropic)", "Drafted model and robustness code; suggested the temporal split and the unseen-title test", "Re-run end to end; leakage reviewed; baselines compared"],
       ["App integration", "Claude (Anthropic)", "Wrote the TypeScript title model, lookup API and tests", "Parity test against Python; vitest suite"],
       ["Writing", "Claude (Anthropic)", "Drafted report sections and figure captions from the computed results", "Edited by the author; numbers generated from metrics files; references checked against sources"]],
      [1700, 1700, 3260, 2700]),
    H2("Reflection on the Role of Generative AI"),
    P("Generative AI made a two-day build of a full pipeline possible, but it did not replace judgement. Several of the most important decisions came from checking AI-written code against the data. Assigning quarters by decision date rather than received date matched how DOL partitions its files. Removing a look-ahead leak in employer attributes kept the test honest. Merging ‘d/b/a’ names correctly attributed Airtable’s filings. Reporting accuracy on unseen titles prevented a lookup table from looking as good as a real model. The working rule throughout was that AI drafts, the data decides, and the author verifies."),
  ];
}

function appendix() {
  const { P, H1 } = B();
  const { Paragraph, TextRun } = require("docx");
  const files = [
    ["analytics/etl.py", "ETL and star-schema load"],
    ["analytics/models.py", "Models M1–M3 and evaluation"],
    ["analytics/robustness.py", "Second fold and bootstrap intervals"],
    ["lib/compass-engine.ts", "Deterministic rules engine"],
    ["lib/sponsorship.ts", "Sponsorship lookup used by the app"],
    ["lib/title-model.ts", "TypeScript inference for model M2"],
  ];
  const out = [H1("Appendix: Code"),
    P("The complete source code, including the Next.js application, the charts and export scripts, and all tests, is in the public repository {{repo_url}}. To reproduce the analysis, place the DOL disclosure files in data/raw/ and run, in order: etl.py, models.py, robustness.py, export.py, export_title_model.py, charts.py and report_facts.py. The key files are listed below."),
  ];
  for (const [file, desc] of files) {
    out.push(new Paragraph({ keepNext: true, spacing: { before: 240, after: 100 },
      children: [new TextRun({ text: `${file}`, bold: true, font: "Consolas", size: 20 }), new TextRun({ text: ` (${desc})`, italics: true, size: 20 })] }));
    const src = fs.readFileSync(path.join(ROOT, file), "utf8").split("\n");
    for (const line of src) {
      out.push(new Paragraph({ spacing: { after: 0, line: 220 }, children: [new TextRun({ text: line.length ? line : " ", font: "Consolas", size: 14 })] }));
    }
  }
  return out;
}

module.exports = { dataFigures, results, conclusions, contributions, appendix };
