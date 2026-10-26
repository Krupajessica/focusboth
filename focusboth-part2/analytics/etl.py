"""
FocusBoth analytics — ETL for U.S. DOL OFLC LCA disclosure data.

Extract : read quarterly LCA disclosure workbooks (xlsx/csv) from data/raw/
Transform: keep H-1B rows, standardise employer names, annualise wages,
           derive fiscal quarter, clean SOC codes, flag new-employment filings
Load    : write a star schema into DuckDB (data/warehouse.duckdb) and parquet
          (data/star/*.parquet) so the same tables can be pushed to cloud Postgres.

Run:  python analytics/etl.py
"""
from __future__ import annotations

import glob
import os
import re
import sys

import duckdb
import numpy as np
import pandas as pd

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RAW = os.path.join(ROOT, "data", "raw")
STAR = os.path.join(ROOT, "data", "star")
DB = os.path.join(ROOT, "data", "warehouse.duckdb")

# Columns used from the DOL record layout (FY2020+). Missing columns are tolerated.
COLS = [
    "CASE_NUMBER", "CASE_STATUS", "RECEIVED_DATE", "DECISION_DATE", "VISA_CLASS",
    "JOB_TITLE", "SOC_CODE", "SOC_TITLE", "FULL_TIME_POSITION",
    "BEGIN_DATE", "END_DATE", "TOTAL_WORKER_POSITIONS",
    "NEW_EMPLOYMENT", "CONTINUED_EMPLOYMENT", "CHANGE_PREVIOUS_EMPLOYMENT",
    "NEW_CONCURRENT_EMPLOYMENT", "CHANGE_EMPLOYER", "AMENDED_PETITION",
    "EMPLOYER_NAME", "EMPLOYER_CITY", "EMPLOYER_STATE", "NAICS_CODE",
    "WORKSITE_CITY", "WORKSITE_STATE",
    "WAGE_RATE_OF_PAY_FROM", "WAGE_RATE_OF_PAY_TO", "WAGE_UNIT_OF_PAY",
    "PREVAILING_WAGE", "PW_UNIT_OF_PAY", "PW_WAGE_LEVEL",
    "H_1B_DEPENDENT", "WILLFUL_VIOLATOR",
]

UNIT_TO_YEAR = {"YEAR": 1, "MONTH": 12, "BI-WEEKLY": 26, "WEEK": 52, "HOUR": 2080}

# Legal-form suffixes removed so "STRIPE, INC." and "Stripe Inc" become one employer.
SUFFIX = re.compile(
    r"\b(INCORPORATED|INC|LLC|L L C|LLP|LP|LTD|LIMITED|CORPORATION|CORP|CO|COMPANY|PLLC|PC|PBC|"
    r"HOLDINGS|GROUP|USA|US|AMERICA|NA)\b"
)

STATE_ABBR = {
    "ALABAMA": "AL", "ALASKA": "AK", "ARIZONA": "AZ", "ARKANSAS": "AR", "CALIFORNIA": "CA",
    "COLORADO": "CO", "CONNECTICUT": "CT", "DELAWARE": "DE", "DISTRICT OF COLUMBIA": "DC",
    "FLORIDA": "FL", "GEORGIA": "GA", "HAWAII": "HI", "IDAHO": "ID", "ILLINOIS": "IL",
    "INDIANA": "IN", "IOWA": "IA", "KANSAS": "KS", "KENTUCKY": "KY", "LOUISIANA": "LA",
    "MAINE": "ME", "MARYLAND": "MD", "MASSACHUSETTS": "MA", "MICHIGAN": "MI", "MINNESOTA": "MN",
    "MISSISSIPPI": "MS", "MISSOURI": "MO", "MONTANA": "MT", "NEBRASKA": "NE", "NEVADA": "NV",
    "NEW HAMPSHIRE": "NH", "NEW JERSEY": "NJ", "NEW MEXICO": "NM", "NEW YORK": "NY",
    "NORTH CAROLINA": "NC", "NORTH DAKOTA": "ND", "OHIO": "OH", "OKLAHOMA": "OK", "OREGON": "OR",
    "PENNSYLVANIA": "PA", "RHODE ISLAND": "RI", "SOUTH CAROLINA": "SC", "SOUTH DAKOTA": "SD",
    "TENNESSEE": "TN", "TEXAS": "TX", "UTAH": "UT", "VERMONT": "VT", "VIRGINIA": "VA",
    "WASHINGTON": "WA", "WEST VIRGINIA": "WV", "WISCONSIN": "WI", "WYOMING": "WY",
    "PUERTO RICO": "PR", "GUAM": "GU", "VIRGIN ISLANDS": "VI",
}


def normalize_employer(name: object) -> str:
    """Upper-case, strip punctuation and legal suffixes. Pure and unit-tested."""
    if not isinstance(name, str):
        return ""
    s = name.upper()
    # "Formagrid, Inc. (d/b/a Airtable)" -> legal name only, so both spellings merge.
    s = re.sub(r"[\(,]?\s*\bD\s*/?\s*B\s*/?\s*A\b.*$", "", s)
    s = s.replace("&", " AND ")
    s = re.sub(r"[^A-Z0-9 ]", " ", s)
    s = SUFFIX.sub(" ", s)
    s = re.sub(r"\s+", " ", s).strip()
    return s


def normalize_soc(code: object) -> str:
    """'15-1252.00' / '151252' -> '15-1252'. Empty string when unusable."""
    if not isinstance(code, str) and not isinstance(code, (int, float)):
        return ""
    digits = re.sub(r"\D", "", str(code))
    if len(digits) < 6:
        return ""
    return f"{digits[:2]}-{digits[2:6]}"


def normalize_state(s: object) -> str:
    if not isinstance(s, str):
        return ""
    s = s.strip().upper()
    if len(s) == 2:
        return s
    return STATE_ABBR.get(s, "")


def annualize(amount: object, unit: object) -> float:
    try:
        a = float(str(amount).replace("$", "").replace(",", ""))
    except (TypeError, ValueError):
        return np.nan
    mult = UNIT_TO_YEAR.get(str(unit).strip().upper())
    if mult is None or not np.isfinite(a):
        return np.nan
    return a * mult


def fiscal_quarter(d: pd.Series) -> pd.Series:
    """US federal fiscal year starts 1 Oct. Returns e.g. 'FY2026Q1' and a sortable int."""
    fy = d.dt.year + (d.dt.month >= 10).astype(int)
    q = ((d.dt.month - 10) % 12) // 3 + 1
    return "FY" + fy.astype("Int64").astype(str) + "Q" + q.astype("Int64").astype(str)


def yes(x: pd.Series) -> pd.Series:
    return x.astype(str).str.strip().str.upper().isin(["Y", "YES", "TRUE", "1"])


# ---------------------------------------------------------------- extract
def extract() -> pd.DataFrame:
    files = sorted(glob.glob(os.path.join(RAW, "*.xlsx")) + glob.glob(os.path.join(RAW, "*.csv")))
    if not files:
        sys.exit(f"No LCA files in {RAW}")
    frames = []
    for f in files:
        print(f"extract  {os.path.basename(f)}", flush=True)
        if f.endswith(".csv"):
            df = pd.read_csv(f, dtype=str, low_memory=False)
        else:
            # Read only the needed columns: the full workbook does not fit in 8 GB as strings.
            wanted = set(COLS)
            df = pd.read_excel(f, dtype=str, engine="calamine",
                               usecols=lambda c: str(c).strip().upper() in wanted)
        df.columns = [c.strip().upper() for c in df.columns]
        keep = [c for c in COLS if c in df.columns]
        missing = sorted(set(COLS) - set(keep))
        if missing:
            print(f"         missing columns tolerated: {missing}")
        df = df[keep].copy()
        df["SOURCE_FILE"] = os.path.basename(f)
        frames.append(df)
    raw = pd.concat(frames, ignore_index=True)
    for c in COLS:
        if c not in raw.columns:
            raw[c] = np.nan
    return raw


# ---------------------------------------------------------------- transform
def transform(raw: pd.DataFrame) -> tuple[pd.DataFrame, dict]:
    log: dict = {"rows_raw": len(raw)}
    df = raw.drop_duplicates("CASE_NUMBER", keep="last").copy()
    log["rows_after_dedup"] = len(df)

    df = df[df["VISA_CLASS"].astype(str).str.upper().str.strip() == "H-1B"]
    log["rows_h1b"] = len(df)

    for c in ["RECEIVED_DATE", "DECISION_DATE", "BEGIN_DATE", "END_DATE"]:
        df[c] = pd.to_datetime(df[c], errors="coerce")
    # DOL partitions the disclosure files by DECISION date, so quarters are assigned by it.
    df = df[df["DECISION_DATE"].notna()]
    log["rows_with_decision_date"] = len(df)

    df["employer_key"] = df["EMPLOYER_NAME"].map(normalize_employer)
    df = df[df["employer_key"] != ""]
    df["soc_code"] = df["SOC_CODE"].map(normalize_soc)
    df["worksite_state"] = df["WORKSITE_STATE"].map(normalize_state)
    df["employer_state"] = df["EMPLOYER_STATE"].map(normalize_state)

    df["wage_annual"] = [annualize(a, u) for a, u in zip(df["WAGE_RATE_OF_PAY_FROM"], df["WAGE_UNIT_OF_PAY"])]
    df["pw_annual"] = [annualize(a, u) for a, u in zip(df["PREVAILING_WAGE"], df["PW_UNIT_OF_PAY"])]
    # Implausible wages (data-entry errors) are nulled, not dropped, so the filing still counts.
    bad = (df["wage_annual"] < 20_000) | (df["wage_annual"] > 1_000_000)
    log["wages_nulled_out_of_range"] = int(bad.sum())
    df.loc[bad, "wage_annual"] = np.nan
    df.loc[(df["pw_annual"] < 15_000) | (df["pw_annual"] > 1_000_000), "pw_annual"] = np.nan

    for c in ["TOTAL_WORKER_POSITIONS", "NEW_EMPLOYMENT", "CONTINUED_EMPLOYMENT",
              "CHANGE_PREVIOUS_EMPLOYMENT", "NEW_CONCURRENT_EMPLOYMENT", "CHANGE_EMPLOYER",
              "AMENDED_PETITION"]:
        df[c] = pd.to_numeric(df[c], errors="coerce").fillna(0).clip(lower=0)

    status = df["CASE_STATUS"].astype(str).str.upper()
    df["certified"] = status.str.startswith("CERTIFIED") & ~status.str.contains("WITHDRAWN")
    df["withdrawn"] = status.str.contains("WITHDRAWN")
    df["denied"] = status.str.contains("DENIED")
    # "New employment" positions are what an OPT -> H-1B hire uses.
    df["new_hire_positions"] = df["NEW_EMPLOYMENT"] + df["CHANGE_EMPLOYER"]
    df["full_time"] = yes(df["FULL_TIME_POSITION"])
    df["h1b_dependent"] = yes(df["H_1B_DEPENDENT"])
    df["willful_violator"] = yes(df["WILLFUL_VIOLATOR"])
    df["pw_level"] = df["PW_WAGE_LEVEL"].astype(str).str.strip().str.upper().replace({"NAN": "", "NONE": ""})
    df["naics2"] = df["NAICS_CODE"].astype(str).str.extract(r"^(\d{2})")[0].fillna("")
    df["fiscal_quarter"] = fiscal_quarter(df["DECISION_DATE"])
    df["job_title"] = df["JOB_TITLE"].astype(str).str.strip()

    log["rows_clean"] = len(df)
    log["employers"] = int(df["employer_key"].nunique())
    log["quarters"] = sorted(df["fiscal_quarter"].unique().tolist())
    return df, log


# ---------------------------------------------------------------- load (star schema)
def load(df: pd.DataFrame) -> dict:
    os.makedirs(STAR, exist_ok=True)

    # dim_employer: one row per standardised employer; display name = most common raw spelling
    emp = (df.groupby("employer_key")
             .agg(employer_name=("EMPLOYER_NAME", lambda s: s.mode().iat[0]),
                  hq_state=("employer_state", lambda s: s.mode().iat[0] if len(s.mode()) else ""),
                  naics2=("naics2", lambda s: s.mode().iat[0] if len(s.mode()) else ""),
                  h1b_dependent=("h1b_dependent", "max"),
                  willful_violator=("willful_violator", "max"))
             .reset_index())
    emp.insert(0, "employer_id", np.arange(1, len(emp) + 1))

    occ = (df[df["soc_code"] != ""].groupby("soc_code")
             .agg(soc_title=("SOC_TITLE", lambda s: s.mode().iat[0] if len(s.mode()) else ""))
             .reset_index())
    occ["soc_major"] = occ["soc_code"].str[:2]
    occ.insert(0, "occupation_id", np.arange(1, len(occ) + 1))

    loc = (df[["worksite_state"]].drop_duplicates().rename(columns={"worksite_state": "state"})
             .sort_values("state").reset_index(drop=True))
    loc.insert(0, "location_id", np.arange(1, len(loc) + 1))

    dates = pd.to_datetime(df["DECISION_DATE"].dt.normalize().unique())
    dd = pd.DataFrame({"date": dates}).sort_values("date").reset_index(drop=True)
    dd["date_id"] = dd["date"].dt.strftime("%Y%m%d").astype(int)
    dd["year"] = dd["date"].dt.year
    dd["month"] = dd["date"].dt.month
    dd["fiscal_quarter"] = fiscal_quarter(dd["date"])
    dd = dd[["date_id", "date", "year", "month", "fiscal_quarter"]]

    f = df.merge(emp[["employer_id", "employer_key"]], on="employer_key", how="left")
    f = f.merge(occ[["occupation_id", "soc_code"]], on="soc_code", how="left")
    f = f.merge(loc, left_on="worksite_state", right_on="state", how="left")
    f["date_id"] = f["DECISION_DATE"].dt.strftime("%Y%m%d").astype(int)
    fact = f[["CASE_NUMBER", "employer_id", "occupation_id", "location_id", "date_id",
              "job_title", "pw_level", "full_time", "certified", "withdrawn", "denied",
              "TOTAL_WORKER_POSITIONS", "new_hire_positions", "CONTINUED_EMPLOYMENT",
              "wage_annual", "pw_annual", "RECEIVED_DATE", "BEGIN_DATE"]].rename(columns={
        "CASE_NUMBER": "case_number", "TOTAL_WORKER_POSITIONS": "total_positions",
        "CONTINUED_EMPLOYMENT": "continued_positions", "RECEIVED_DATE": "received_date",
        "BEGIN_DATE": "begin_date"})
    fact["occupation_id"] = fact["occupation_id"].astype("Int64")

    tables = {"dim_employer": emp, "dim_occupation": occ, "dim_location": loc,
              "dim_date": dd, "fact_lca": fact}
    if os.path.exists(DB):
        os.remove(DB)
    con = duckdb.connect(DB)
    for name, t in tables.items():
        t.to_parquet(os.path.join(STAR, f"{name}.parquet"), index=False)
        con.register("t", t)
        con.execute(f"CREATE TABLE {name} AS SELECT * FROM t")
        con.unregister("t")
    con.close()
    return {k: len(v) for k, v in tables.items()}


def main() -> None:
    raw = extract()
    df, log = transform(raw)
    os.makedirs(os.path.join(ROOT, "data"), exist_ok=True)
    df.to_parquet(os.path.join(ROOT, "data", "lca_clean.parquet"), index=False)
    counts = load(df)
    log["star_rows"] = counts
    import json
    with open(os.path.join(ROOT, "data", "etl_log.json"), "w") as fh:
        json.dump(log, fh, indent=2, default=str)
    print(json.dumps(log, indent=2, default=str))


if __name__ == "__main__":
    main()
