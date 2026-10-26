"""
FocusBoth analytics — three predictive models on the cleaned LCA data.

M1  Sponsorship signal (employer-quarter classification)
    Target : employer files >=1 H-1B LCA with new-employment positions in quarter t+1
    Features: only information available at the end of quarter t
    Models : B0 persistence baseline, B1 frequency baseline, logistic regression, XGBoost
    Split  : temporal. Train on target quarters before the last one; test on the last one.

M2  Job title -> SOC occupation (text classification)
    Lets a live Greenhouse job title be linked to DOL occupation statistics.
    Models : majority-class baseline, exact-title lookup baseline, TF-IDF + logistic regression
    Split  : temporal (last quarter held out)

M3  Sponsored wage (regression on log annual wage)
    Features a student actually knows: occupation, worksite state, wage level, full-time, sector
    Models : median-by-SOC baseline, ridge regression, XGBoost
    Split  : temporal (last quarter held out)

Run: python analytics/models.py     (after etl.py)
"""
from __future__ import annotations

import json
import os
import pickle

import numpy as np
import pandas as pd
from scipy import sparse
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression, Ridge
from sklearn.metrics import (average_precision_score, brier_score_loss, f1_score,
                             mean_absolute_error, r2_score, roc_auc_score)
from sklearn.preprocessing import OneHotEncoder, StandardScaler
import xgboost as xgb

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(ROOT, "data")
OUT = os.path.join(ROOT, "outputs")
SEED = 42


def qindex(q: pd.Series) -> pd.Series:
    """'FY2026Q1' -> 2026*4 + 0, so consecutive quarters differ by 1."""
    return q.str[2:6].astype(int) * 4 + q.str[-1].astype(int) - 1


def precision_at_k(y: np.ndarray, p: np.ndarray, k: int) -> float:
    k = min(k, len(y))
    idx = np.argsort(-p)[:k]
    return float(np.mean(y[idx]))


# ====================================================================== M1
def build_panel(df: pd.DataFrame, latest_only: bool = False) -> pd.DataFrame:
    """Employer x quarter panel. Features use quarters <= t only; label is quarter t+1.
    latest_only=True returns unlabeled features at the final quarter (for live scoring)."""
    df = df.copy()
    df["qi"] = qindex(df["fiscal_quarter"])
    df["is_new"] = df["new_hire_positions"] > 0
    df["is_computer"] = df["soc_code"].str.startswith("15-")
    df["wage_ratio"] = df["wage_annual"] / df["pw_annual"]
    g = df.groupby(["employer_key", "qi"])
    eq = g.agg(
        filings=("CASE_NUMBER", "size"),
        new_filings=("is_new", "sum"),
        positions=("TOTAL_WORKER_POSITIONS", "sum"),
        new_positions=("new_hire_positions", "sum"),
        cert_rate=("certified", "mean"),
        withdraw_rate=("withdrawn", "mean"),
        n_soc=("soc_code", "nunique"),
        n_states=("worksite_state", "nunique"),
        computer_share=("is_computer", "mean"),
        level1_share=("pw_level", lambda s: (s == "I").mean()),
        wage_ratio=("wage_ratio", "median"),
        median_wage=("wage_annual", "median"),
        h1b_dependent=("h1b_dependent", "max"),
        naics2=("naics2", "first"),
    ).reset_index()

    qs = sorted(df["qi"].unique())
    rows = []
    for t in ([qs[-1]] if latest_only else qs[:-1]):
        hist = eq[eq["qi"] <= t]
        cur = eq[eq["qi"] == t].set_index("employer_key")
        agg = hist.groupby("employer_key").agg(
            filings_hist=("filings", "sum"),
            new_filings_hist=("new_filings", "sum"),
            quarters_active=("qi", "nunique"),
            last_q=("qi", "max"),
            cert_rate_hist=("cert_rate", "mean"),
            withdraw_rate_hist=("withdraw_rate", "mean"),
            n_soc_hist=("n_soc", "max"),
            n_states_hist=("n_states", "max"),
            computer_share_hist=("computer_share", "mean"),
            level1_share_hist=("level1_share", "mean"),
            wage_ratio_hist=("wage_ratio", "median"),
            median_wage_hist=("median_wage", "median"),
            # employer attributes taken only from quarters <= t (no look-ahead)
            h1b_dependent=("h1b_dependent", "max"),
            naics2=("naics2", "last"),
        )
        agg["filings_t"] = cur["filings"].reindex(agg.index).fillna(0)
        agg["new_filings_t"] = cur["new_filings"].reindex(agg.index).fillna(0)
        prev = eq[eq["qi"] == t - 1].set_index("employer_key")
        agg["filings_tm1"] = prev["filings"].reindex(agg.index).fillna(0)
        agg["recency_q"] = t - agg["last_q"]
        agg["history_q"] = len([q for q in qs if q <= t])
        nxt = eq[eq["qi"] == t + 1].set_index("employer_key")
        if not latest_only:
            agg["y"] = (nxt["new_filings"].reindex(agg.index).fillna(0) > 0).astype(int)
        agg["t"] = t
        rows.append(agg.drop(columns=["last_q"]).reset_index())
    panel = pd.concat(rows, ignore_index=True)
    return panel


M1_NUM = ["filings_hist", "new_filings_hist", "quarters_active", "cert_rate_hist",
          "withdraw_rate_hist", "n_soc_hist", "n_states_hist", "computer_share_hist",
          "level1_share_hist", "wage_ratio_hist", "median_wage_hist", "filings_t",
          "new_filings_t", "filings_tm1", "recency_q"]


def m1_features(panel: pd.DataFrame, enc: OneHotEncoder | None = None):
    X = panel[M1_NUM].copy()
    for c in ["filings_hist", "new_filings_hist", "filings_t", "new_filings_t", "filings_tm1",
              "n_soc_hist", "n_states_hist"]:
        X[c] = np.log1p(X[c])
    X["median_wage_hist"] = np.log(X["median_wage_hist"].fillna(X["median_wage_hist"].median()))
    X = X.fillna(X.median(numeric_only=True)).fillna(0)
    X["h1b_dependent"] = panel["h1b_dependent"].astype(int).values
    cat = panel[["naics2"]].fillna("")
    if enc is None:
        enc = OneHotEncoder(handle_unknown="ignore", min_frequency=50)
        enc.fit(cat)
    C = enc.transform(cat)
    return X, C, enc


def run_m1(df: pd.DataFrame) -> dict:
    panel = build_panel(df)
    t_test = panel["t"].max()
    tr, te = panel[panel["t"] < t_test], panel[panel["t"] == t_test]
    if len(tr) == 0:
        raise SystemExit("M1 needs at least 3 quarters of data (2 labelled quarters).")
    ytr, yte = tr["y"].values, te["y"].values

    Xtr, Ctr, enc = m1_features(tr)
    Xte, Cte, _ = m1_features(te, enc)
    scaler = StandardScaler().fit(Xtr)
    Atr = sparse.hstack([sparse.csr_matrix(scaler.transform(Xtr)), Ctr]).tocsr()
    Ate = sparse.hstack([sparse.csr_matrix(scaler.transform(Xte)), Cte]).tocsr()

    preds = {
        "B0 Persistence (filed new-hire LCA this quarter)": (te["new_filings_t"].values > 0).astype(float),
        "B1 Frequency (historical new-hire filings)": te["new_filings_hist"].values.astype(float),
    }
    lr = LogisticRegression(max_iter=2000, C=1.0, class_weight="balanced", random_state=SEED)
    lr.fit(Atr, ytr)
    preds["Logistic regression"] = lr.predict_proba(Ate)[:, 1]

    Gtr = sparse.hstack([sparse.csr_matrix(Xtr.values), Ctr]).tocsr()
    Gte = sparse.hstack([sparse.csr_matrix(Xte.values), Cte]).tocsr()
    gb = xgb.XGBClassifier(n_estimators=400, max_depth=5, learning_rate=0.05, subsample=0.8,
                           colsample_bytree=0.8, eval_metric="logloss", random_state=SEED, n_jobs=2)
    gb.fit(Gtr, ytr)
    preds["XGBoost"] = gb.predict_proba(Gte)[:, 1]

    res = []
    k = max(1, int(round(0.01 * len(yte))))
    for name, p in preds.items():
        r = {"model": name,
             "roc_auc": roc_auc_score(yte, p),
             "pr_auc": average_precision_score(yte, p),
             f"precision_at_top1pct(k={k})": precision_at_k(yte, p, k)}
        if name in ("Logistic regression", "XGBoost"):
            r["brier"] = brier_score_loss(yte, p)
        res.append(r)

    feat_names = list(Xtr.columns) + [f"naics2={c}" for c in enc.get_feature_names_out()]
    imp = pd.Series(gb.feature_importances_, index=feat_names).sort_values(ascending=False)
    coef = pd.Series(lr.coef_[0][: len(Xtr.columns)], index=Xtr.columns).sort_values()

    # Score every employer on the latest quarter with the model refit on all labelled rows.
    full = panel
    Xf, Cf, enc_f = m1_features(full)
    gb_f = xgb.XGBClassifier(**gb.get_params()).fit(
        sparse.hstack([sparse.csr_matrix(Xf.values), Cf]).tocsr(), full["y"].values)
    latest = build_panel(df, latest_only=True)
    Xl, Cl, _ = m1_features(latest, enc_f)
    latest["p_sponsor_next_q"] = gb_f.predict_proba(
        sparse.hstack([sparse.csr_matrix(Xl.values), Cl]).tocsr())[:, 1]

    return {
        "panel_rows": len(panel), "train_rows": len(tr), "test_rows": len(te),
        "test_quarter_index": int(t_test), "positive_rate_train": float(ytr.mean()),
        "positive_rate_test": float(yte.mean()), "results": res,
        "xgb_importance": imp.head(15).to_dict(), "lr_coef": coef.to_dict(),
        "_scores": latest, "_test": te.assign(p_xgb=preds["XGBoost"], p_lr=preds["Logistic regression"]),
    }


# ====================================================================== M2
def clean_title(s: pd.Series) -> pd.Series:
    return (s.astype(str).str.lower().str.replace(r"[^a-z0-9 ]", " ", regex=True)
             .str.replace(r"\s+", " ", regex=True).str.strip())


def run_m2(df: pd.DataFrame, top_n: int = 60) -> dict:
    d = df[(df["soc_code"] != "") & (df["job_title"].str.len() > 1)].copy()
    d["title"] = clean_title(d["job_title"])
    d["qi"] = qindex(d["fiscal_quarter"])
    top = d["soc_code"].value_counts().head(top_n).index
    coverage = float(d["soc_code"].isin(top).mean())
    d = d[d["soc_code"].isin(top)]
    t_test = d["qi"].max()
    tr, te = d[d["qi"] < t_test], d[d["qi"] == t_test]

    maj = tr["soc_code"].mode().iat[0]
    p_maj = np.full(len(te), maj)
    lookup = tr.groupby("title")["soc_code"].agg(lambda s: s.mode().iat[0])
    p_look = te["title"].map(lookup).fillna(maj).values
    seen = float(te["title"].isin(lookup.index).mean())

    vec = TfidfVectorizer(ngram_range=(1, 2), min_df=2, max_features=20000, sublinear_tf=True)
    Xtr = vec.fit_transform(tr["title"])
    Xte = vec.transform(te["title"])
    clf = LogisticRegression(max_iter=3000, C=5.0, random_state=SEED)
    clf.fit(Xtr, tr["soc_code"])
    proba = clf.predict_proba(Xte)
    p_lr = clf.classes_[proba.argmax(1)]
    top3 = clf.classes_[np.argsort(-proba, 1)[:, :3]]
    y = te["soc_code"].values

    def row(name, p, t3=None):
        r = {"model": name, "top1_accuracy": float(np.mean(p == y)),
             "macro_f1": float(f1_score(y, p, average="macro", zero_division=0)),
             "weighted_f1": float(f1_score(y, p, average="weighted", zero_division=0))}
        r["top3_accuracy"] = float(np.mean([yy in tt for yy, tt in zip(y, t3)])) if t3 is not None else None
        return r

    unseen = ~te["title"].isin(lookup.index).values
    res = [row("Majority class", p_maj), row("Exact-title lookup", p_look),
           row("TF-IDF + logistic regression", p_lr, top3)]
    res_unseen = {"Exact-title lookup": float(np.mean(p_look[unseen] == y[unseen])) if unseen.any() else None,
                  "TF-IDF + logistic regression": float(np.mean(p_lr[unseen] == y[unseen])) if unseen.any() else None}

    soc_titles = (df[df["soc_code"].isin(top)].groupby("soc_code")["SOC_TITLE"]
                    .agg(lambda s: s.mode().iat[0]).to_dict())
    return {"n_classes": int(len(top)), "row_coverage_of_top_classes": coverage,
            "train_rows": len(tr), "test_rows": len(te), "test_titles_seen_in_train": seen,
            "results": res, "accuracy_on_unseen_titles": res_unseen,
            "_vec": vec, "_clf": clf, "_soc_titles": soc_titles}


# ====================================================================== M3
M3_CAT = ["soc_code", "worksite_state", "pw_level", "naics2", "full_time"]


def run_m3(df: pd.DataFrame) -> dict:
    d = df[df["certified"] & df["wage_annual"].notna() & (df["soc_code"] != "")
           & (df["worksite_state"] != "")].copy()
    d["full_time"] = d["full_time"].astype(str)
    d["qi"] = qindex(d["fiscal_quarter"])
    d["y"] = np.log(d["wage_annual"])
    t_test = d["qi"].max()
    tr, te = d[d["qi"] < t_test], d[d["qi"] == t_test]

    med = tr.groupby("soc_code")["y"].median()
    p0 = te["soc_code"].map(med).fillna(tr["y"].median()).values

    enc = OneHotEncoder(handle_unknown="ignore", min_frequency=20)
    Xtr = enc.fit_transform(tr[M3_CAT])
    Xte = enc.transform(te[M3_CAT])
    ridge = Ridge(alpha=1.0).fit(Xtr, tr["y"])
    p1 = ridge.predict(Xte)
    gb = xgb.XGBRegressor(n_estimators=600, max_depth=7, learning_rate=0.08, subsample=0.8,
                          colsample_bytree=0.8, random_state=SEED, n_jobs=2)
    gb.fit(Xtr, tr["y"])
    p2 = gb.predict(Xte)

    ytrue = np.exp(te["y"].values)
    res = []
    for name, p in [("Median wage by SOC", p0), ("Ridge regression", p1), ("XGBoost", p2)]:
        pe = np.exp(p)
        res.append({"model": name, "mae_usd": float(mean_absolute_error(ytrue, pe)),
                    "mape": float(np.mean(np.abs(pe - ytrue) / ytrue)),
                    "r2_log": float(r2_score(te["y"], p))})
    names = enc.get_feature_names_out(M3_CAT)
    gimp = pd.Series(gb.feature_importances_, index=names)
    group_imp = gimp.groupby(lambda n: n.split("_")[0] if not n.startswith(("soc_code", "worksite_state", "pw_level", "full_time"))
                             else ("soc_code" if n.startswith("soc_code") else
                                   "worksite_state" if n.startswith("worksite_state") else
                                   "pw_level" if n.startswith("pw_level") else "full_time")).sum()
    return {"train_rows": len(tr), "test_rows": len(te), "results": res,
            "importance_by_feature": group_imp.sort_values(ascending=False).to_dict(),
            "_test": te.assign(pred_xgb=np.exp(p2))}


# ====================================================================== main
def main() -> None:
    os.makedirs(OUT, exist_ok=True)
    df = pd.read_parquet(os.path.join(DATA, "lca_clean.parquet"))
    print(f"rows={len(df):,} quarters={sorted(df['fiscal_quarter'].unique())}", flush=True)

    m1 = run_m1(df); print("M1 done", flush=True)
    m2 = run_m2(df); print("M2 done", flush=True)
    m3 = run_m3(df); print("M3 done", flush=True)

    m1["_scores"].to_parquet(os.path.join(OUT, "employer_scores.parquet"), index=False)
    m1["_test"].to_parquet(os.path.join(OUT, "m1_test_predictions.parquet"), index=False)
    m3["_test"][["soc_code", "worksite_state", "pw_level", "wage_annual", "pred_xgb"]].to_parquet(
        os.path.join(OUT, "m3_test_predictions.parquet"), index=False)
    with open(os.path.join(OUT, "m2_title_model.pkl"), "wb") as fh:
        pickle.dump({"vec": m2["_vec"], "clf": m2["_clf"], "soc_titles": m2["_soc_titles"]}, fh)

    metrics = {k: {kk: vv for kk, vv in v.items() if not kk.startswith("_")}
               for k, v in {"M1_sponsorship": m1, "M2_title_to_soc": m2, "M3_wage": m3}.items()}
    with open(os.path.join(OUT, "metrics.json"), "w") as fh:
        json.dump(metrics, fh, indent=2, default=float)
    print(json.dumps(metrics, indent=2, default=float))


if __name__ == "__main__":
    main()
