/**
 * Public Greenhouse job boards. These endpoints are published by the employers
 * themselves and need no key or login, unlike LinkedIn or Indeed scraping.
 * Tokens that stop resolving are skipped at request time.
 */
export type JobBoard = {
  token: string;
  company: string;
  openingsUrl: string;
  /** Normalised legal name as it appears in DOL LCA filings (see analytics/etl.py). */
  dolEmployerKey: string;
};

export const JOB_BOARDS: JobBoard[] = [
  { token: "databricks", company: "Databricks", openingsUrl: "https://www.databricks.com/company/careers", dolEmployerKey: "DATABRICKS" },
  { token: "stripe", company: "Stripe", openingsUrl: "https://stripe.com/jobs/search", dolEmployerKey: "STRIPE" },
  { token: "anthropic", company: "Anthropic", openingsUrl: "https://www.anthropic.com/careers", dolEmployerKey: "ANTHROPIC" },
  { token: "figma", company: "Figma", openingsUrl: "https://www.figma.com/careers/", dolEmployerKey: "FIGMA" },
  { token: "reddit", company: "Reddit", openingsUrl: "https://redditinc.com/careers", dolEmployerKey: "REDDIT" },
  { token: "coinbase", company: "Coinbase", openingsUrl: "https://www.coinbase.com/careers/positions", dolEmployerKey: "COINBASE" },
  { token: "brex", company: "Brex", openingsUrl: "https://www.brex.com/careers", dolEmployerKey: "BREX" },
  { token: "gitlab", company: "GitLab", openingsUrl: "https://about.gitlab.com/jobs/", dolEmployerKey: "GITLAB" },
  { token: "samsara", company: "Samsara", openingsUrl: "https://www.samsara.com/company/careers/roles", dolEmployerKey: "SAMSARA" },
  { token: "instacart", company: "Instacart", openingsUrl: "https://instacart.careers/current-openings/", dolEmployerKey: "MAPLEBEAR" },
  { token: "robinhood", company: "Robinhood", openingsUrl: "https://careers.robinhood.com/", dolEmployerKey: "ROBINHOOD MARKETS" },
  { token: "discord", company: "Discord", openingsUrl: "https://discord.com/careers", dolEmployerKey: "DISCORD" },
  { token: "duolingo", company: "Duolingo", openingsUrl: "https://careers.duolingo.com/", dolEmployerKey: "DUOLINGO" },
  { token: "asana", company: "Asana", openingsUrl: "https://asana.com/jobs", dolEmployerKey: "ASANA" },
  { token: "airtable", company: "Airtable", openingsUrl: "https://www.airtable.com/careers", dolEmployerKey: "FORMAGRID" },
];
