
DROP TABLE IF EXISTS fact_lca, dim_employer, dim_occupation, dim_location, dim_date CASCADE;
CREATE TABLE dim_employer (employer_id INT PRIMARY KEY, employer_key TEXT UNIQUE NOT NULL,
  employer_name TEXT, hq_state TEXT, naics2 TEXT, h1b_dependent BOOLEAN, willful_violator BOOLEAN);
CREATE TABLE dim_occupation (occupation_id INT PRIMARY KEY, soc_code TEXT UNIQUE NOT NULL,
  soc_title TEXT, soc_major TEXT);
CREATE TABLE dim_location (location_id INT PRIMARY KEY, state TEXT);
CREATE TABLE dim_date (date_id INT PRIMARY KEY, date DATE, year INT, month INT, fiscal_quarter TEXT);
CREATE TABLE fact_lca (case_number TEXT PRIMARY KEY,
  employer_id INT REFERENCES dim_employer, occupation_id INT REFERENCES dim_occupation,
  location_id INT REFERENCES dim_location, date_id INT REFERENCES dim_date,
  job_title TEXT, pw_level TEXT, full_time BOOLEAN, certified BOOLEAN, withdrawn BOOLEAN,
  denied BOOLEAN, total_positions REAL, new_hire_positions REAL, continued_positions REAL,
  wage_annual REAL, pw_annual REAL, received_date TIMESTAMP, begin_date TIMESTAMP);
CREATE INDEX ON fact_lca (employer_id); CREATE INDEX ON fact_lca (occupation_id);
CREATE INDEX ON fact_lca (date_id);
