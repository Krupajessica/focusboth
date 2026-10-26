// Report text for sections that do not depend on model results.
// Numbers marked {{...}} are filled from data/etl_log.json and outputs/metrics.json at build time.
// Citations use IEEE numbering; see REFS in build_report.js.

module.exports = {
  abstract: [
    "International students on F-1 Optional Practical Training (OPT) must find an employer willing to sponsor an H-1B visa before their work authorization ends, yet the tools they use treat jobs, visa rules and personal time as separate problems. This project builds FocusBoth, a cloud-hosted decision-support web application, and grounds its sponsorship signal in {{rows_clean}} H-1B Labor Condition Applications (LCAs) published by the U.S. Department of Labor for fiscal quarters {{q_first}} to {{q_last}}. An extract-transform-load pipeline standardizes {{employers}} employer names and loads a star schema. Three predictive models are evaluated on a held-out final quarter: an employer-level classifier that predicts whether an employer will file a new-hire H-1B LCA in the next quarter, a text classifier that maps job titles to Standard Occupational Classification (SOC) codes, and a wage regression. Each model is compared with simple baselines. The resulting scores replace placeholder numbers in the application, which pulls live openings from {{boards}} public employer job boards, applies deterministic visa-date rules, and keeps weekly hours for rest and hobbies in the same view.",
  ],

  intro: {
    problem: [
      "More than 1.1 million international students were enrolled in the United States in academic year 2024/25, a count that includes students on Optional Practical Training, and OPT participation grew sharply that year [1]. OPT gives F-1 graduates 12 months of work authorization, extended by 24 months for STEM degrees, with a cap of 90 unemployment days on standard OPT and 150 days in total for STEM OPT [2]. To stay in the country after OPT, most graduates need an employer to file an H-1B petition, which begins with a Labor Condition Application (LCA) filed with the Department of Labor (DOL) [3].",
      "The practical problem is a decision under a hard deadline. A student must decide which openings to spend limited applications and interview time on, knowing that a job at an employer that does not sponsor is, for their purposes, not a job. Public job boards do not show sponsorship history. Sponsorship lookup sites show historical counts but do not connect them to today’s openings or to the student’s own Employment Authorization Document (EAD) end date. The same pressure also crowds out rest and personal time during a long search.",
    ],
    purpose: "The purpose of this project is to give an OPT student one place to answer a single business question: which current openings are realistic given my visa dates, and does my week still leave room for life outside the search? The analytics contribution is a sponsorship signal built from public DOL data and validated against later, unseen filings, instead of a guess or a static count.",
    objectives: [
      "Build a reproducible ETL pipeline and dimensional model (star schema) for DOL LCA disclosure data.",
      "Predict whether an employer will file a new-hire H-1B LCA in the next quarter, and test the prediction on a quarter the model never saw.",
      "Map free-text job titles from live postings to SOC occupation codes so each opening can be linked to DOL occupation and wage statistics.",
      "Model sponsored wages from information a student actually knows (occupation, state, wage level).",
      "Deliver the scores inside a working, cloud-hosted web application in which deterministic rules, not a language model, decide visa feasibility.",
    ],
    importance: "The decision has real costs. A student who spends weeks on employers with no sponsorship history can exhaust the unemployment allowance, and a generic chatbot may state immigration rules incorrectly. A transparent, data-grounded signal that can be checked against public filings lowers that risk, while the app’s rules engine keeps visa feasibility auditable.",
  },

  related: [
    {
      head: "Analytics on H-1B disclosure data",
      paras: [
        "Hooshmand et al. explored about 2.8 million LCA records from the DOL Office of Foreign Labor Certification (OFLC) and trained k-nearest-neighbor, random forest and multilayer perceptron classifiers to predict whether a case would be certified, reporting an F1 score near 0.98 [4]. Ke and Qiao used LCA data from 2008–2018 with LASSO regression for wages and L1-penalized logistic regression for certification, finding that occupation, state and job level drive wages [5].",
        "Both studies predict the outcome of a single application. That target is of little use to a job seeker, because over 90% of LCAs are certified (91.4% in this project’s data) and the student does not file the LCA. This project instead predicts employer behavior over time: will this employer file new-hire H-1B LCAs next quarter? It also tests on a later quarter rather than a random split, which matches how the signal would be used in practice.",
      ],
    },
    {
      head: "Sponsorship lookup tools",
      paras: [
        "Commercial sites such as MyVisaJobs [6] publish employer-level LCA counts as a searchable directory. They are valuable references, but they report history without testing whether it predicts future filings. They also are not connected to live openings or to a student’s visa dates.",
      ],
    },
    {
      head: "Occupation coding from job titles",
      paras: [
        "Assigning SOC codes to free-text titles is a known problem in labor economics and epidemiology. SOCcer scores job titles and task descriptions against SOC definitions for research coding [7], and Rony and Patman fine-tuned BERT models on hand-labelled UK job advertisements, reaching 61% accuracy at the most detailed SOC tier [8]. This project uses a lighter TF-IDF and logistic-regression model trained on about half a million employer-assigned title–SOC pairs from LCAs. The labels come for free with the public data and the model is small enough to run inside the web server.",
      ],
    },
    {
      head: "Decision support and grounded AI",
      paras: [
        "Retrieval-augmented generation restricts a language model to retrieved source passages [9], and gradient-boosted trees such as XGBoost [10] are strong baselines for tabular prediction. FocusBoth applies both ideas conservatively. Gradient boosting produces a probability that is checked for calibration [11], and any language-model text is limited to explaining outputs that the deterministic rules engine has already computed.",
      ],
    },
    {
      head: "Gap addressed",
      paras: [
        "No reviewed tool combines (a) a forward-looking sponsorship signal validated on unseen quarters, (b) live job openings linked to occupation and wage data, and (c) a student’s own EAD dates and unemployment allowance, in one application. FocusBoth integrates these pieces. Its contribution is the integration and the validation, not a new statistical method.",
      ],
    },
  ],

  data: {
    sources_intro: "The project integrates five data sources (Table {{T_sources}}). The DOL LCA disclosure files are the primary analytical dataset; the others feed the application.",
    lca_desc: [
      "The U.S. Department of Labor, Office of Foreign Labor Certification, publishes quarterly disclosure files of every LCA it decides [3]. Each row is one application, with fields for the employer, job title, SOC code, worksite, offered wage, prevailing wage and level, case status and the number of workers by employment type. Files are partitioned by decision date. This project uses the FY2025 Q4 file (decisions July–September 2025) and the cumulative FY2026 Q3 file (decisions October 2025–June 2026), giving four consecutive fiscal quarters. The FY2026 Q1 file was also downloaded, but all of its {{q1_cases}} cases are contained in the cumulative Q3 file, so it was excluded to avoid double counting.",
    ],
    characteristics: [
      "After cleaning, the dataset contains {{rows_clean}} H-1B LCAs from {{employers}} distinct employers across {{n_soc}} SOC occupations and {{n_states}} worksite states and territories. Activity is highly concentrated. The ten largest filers account for {{top10_share}} of all filings, while {{single_filers}} employers filed exactly once. Computer and mathematical occupations (SOC major group 15) make up {{computer_share}} of filings. {{newhire_share}} of filings include at least one new-employment or change-of-employer position, the type an OPT graduate would need. The median offered wage on certified cases is {{median_wage}}.",
      "The data are strongly seasonal. FY2026 Q3 (April–June 2026) has {{q3_rows}} filings, about twice the other quarters, and {{q3_newhire}} of them involve new hires, compared with roughly 37–40% in the other quarters. This reflects the annual H-1B cap cycle and matters for model evaluation (Section 5.1).",
    ],
    limitations: [
      "An LCA is a precondition for an H-1B petition, not a petition or an approval. A filed LCA does not mean a worker was hired or that a visa was granted.",
      "Employer names are self-reported. Standardization merges common spelling variants, but subsidiaries and staffing agencies may still be split or combined incorrectly. Some brands file under a different legal name (Instacart as Maplebear, Airtable as Formagrid), which the application handles with an explicit mapping.",
      "SOC codes are assigned by employers, so the title-to-SOC labels contain noise, and similar roles may be coded differently by different employers.",
      "Four quarters is a short history. The test quarter falls in the cap season, so its new-hire rate differs from the training quarters.",
      "Live job coverage is limited to the {{boards}} employers whose public Greenhouse boards are configured, not the whole U.S. labor market.",
    ],
  },

  methods: {
    arch: "Figure {{F_arch}} shows the end-to-end pipeline. Raw disclosure workbooks are extracted with only the 32 needed columns (the full workbook does not fit in memory), transformed in pandas, and loaded into a DuckDB warehouse and Parquet files. The same star schema is created in a managed cloud PostgreSQL database, from which the web application reads. Models are trained in Python with scikit-learn [12] and XGBoost [10], and their outputs are exported as compact JSON files consumed by the Next.js server.",
    etl: [
      ["Extract", "Read each quarterly workbook, keep the needed columns, and tag rows with their source file."],
      ["Deduplicate", "Keep one row per CASE_NUMBER; {{dups}} duplicate case numbers across files were removed, keeping the most recent decision."],
      ["Filter", "Keep VISA_CLASS = H-1B ({{non_h1b}} H-1B1 and E-3 rows removed)."],
      ["Standardize employers", "Upper-case, remove punctuation, drop ‘doing business as’ clauses and legal suffixes (Inc., LLC, Corp., PBC, …). The same rule is implemented in Python and TypeScript and tested for identical output."],
      ["Annualize wages", "Convert hourly, weekly, bi-weekly and monthly wages to annual (hour × 2,080, week × 52, bi-week × 26, month × 12). {{wages_nulled}} implausible wages (below $20,000 or above $1,000,000 per year) were set to missing rather than dropped, so the filing still counts."],
      ["Derive fields", "Fiscal quarter from decision date (federal fiscal year starts 1 October), SOC code to the six-digit XX-XXXX form, state names to two-letter codes, new-hire positions = new employment + change of employer."],
      ["Load", "Build dimension tables with surrogate keys and the fact table, then write to DuckDB, Parquet and PostgreSQL."],
    ],
    star: "The dimensional model (Figure {{F_star}}) follows Kimball’s star-schema design [13]. The grain of fact_lca is one LCA case. Four conformed dimensions describe who filed (dim_employer), for what occupation (dim_occupation), where (dim_location) and when (dim_date, keyed by decision date with fiscal-quarter attributes). Measures include total, new-hire and continued positions and the annualized offered and prevailing wages. Flags record certified, withdrawn and denied status. This design lets every BI figure in Section 5 be produced by a short join-and-group query.",
    m1: [
      "**Target.** For each employer that had filed at least once by the end of quarter t, the label is 1 if it files at least one LCA with new-employment or change-of-employer positions in quarter t + 1, and 0 otherwise. This is the event that matters to an OPT graduate looking for a new sponsor.",
      "**Features.** Features use only information available at the end of quarter t, so there is no look-ahead. They cover historical and current-quarter filing counts, new-hire counts, quarters active, quarters since the last filing, certification and withdrawal rates, occupational and geographic breadth, share of computer occupations and of Level I wages, median wage and wage-to-prevailing-wage ratio, H-1B-dependent status and two-digit industry (NAICS). Even the employer attributes are computed from quarters up to t only.",
      "**Models.** Two baselines: B0 persistence (did the employer file a new-hire LCA this quarter?) and B1 frequency (count of historical new-hire filings). Two learned models: L2-regularized logistic regression with class weighting on standardized features, and XGBoost (400 trees, depth 5, learning rate 0.05).",
      "**Validation.** A temporal split. Models train on employer-quarters whose label quarter is FY2026 Q1 or Q2 and are tested on label quarter FY2026 Q3. Metrics are ROC-AUC, PR-AUC (more informative when positives are a minority [14]), precision among the top 1% of ranked employers, and the Brier score for probability quality [11].",
    ],
    m2: [
      "**Target.** The employer-assigned six-digit SOC code, restricted to the 60 most frequent codes, which cover {{m2_coverage}} of filings.",
      "**Models.** A majority-class baseline; an exact-title lookup baseline (the most common SOC for an identical cleaned title in training); and TF-IDF over word unigrams and bigrams (sublinear term frequency, up to 20,000 features) feeding a multinomial logistic regression.",
      "**Validation.** A temporal split, testing on FY2026 Q3. Because a lookup table trivially succeeds on titles it has already seen, accuracy is also reported separately for test titles that never appeared in training, which is the case that matters for new job postings.",
    ],
    m3: [
      "**Target.** Log annual offered wage on certified LCAs.",
      "**Features.** Features are restricted to what a student can know before applying: SOC occupation, worksite state, prevailing-wage level (I–IV, a proxy for experience), full-time status and industry. The prevailing-wage amount itself is excluded because it nearly determines the offered wage and a student would not know it.",
      "**Models.** A baseline (median wage by SOC), ridge regression on one-hot features, and XGBoost (600 trees, depth 7). The split is temporal, with FY2026 Q3 held out. Metrics are mean absolute error in dollars, mean absolute percentage error, and R² on the log scale.",
    ],
    app: [
      "FocusBoth is a Next.js 16 / React 19 / TypeScript application with six screens: Today, Visa Clock, Job Hunt, Path Navigator, Wellbeing and Discover. A deterministic rules engine (lib/compass-engine.ts) decides feasibility. A job passes only if the sponsor signal is at least 60, the student’s own résumé-fit rating is at least 65, and the start date falls on or before the EAD end date. A career path passes only if it starts before the EAD end, involves at least 20 hours a week, uses an E-Verify employer and has a bona fide employer relationship.",
      "The models connect to the application in three places. (1) The live-openings API attaches each employer’s DOL record and model M1 probability to every posting; the sponsor signal shown and used by the rules engine is that probability × 100. (2) Each job title is classified by model M2, which is re-implemented in TypeScript from exported weights and tested for identical predictions against Python, and the predicted occupation is shown with the DOL entry-level (Level I) median H-1B wage for it. (3) A lookup endpoint returns the DOL record for any employer a student types, using the same name standardization as the ETL. If an employer has no filings, the app shows zero and says so. It never fills in a guess.",
    ],
  },
};
