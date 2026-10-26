import type { SalaryRange, WorkType } from "./types";

const NUMERIC_ENTITY = /&#(\d+);/g;
const NAMED_ENTITIES: Record<string, string> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#39;": "'",
  "&apos;": "'",
  "&nbsp;": " ",
  "&mdash;": "—",
  "&ndash;": "–",
};

function decodeOnce(value: string) {
  let output = value.replace(NUMERIC_ENTITY, (_, code) => String.fromCharCode(Number(code)));
  for (const [entity, char] of Object.entries(NAMED_ENTITIES)) {
    output = output.split(entity).join(char);
  }
  return output;
}

/** Greenhouse descriptions arrive double-encoded, so decode twice before matching. */
export function descriptionToText(html: string) {
  return decodeOnce(decodeOnce(html))
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const FULL_RANGE = /\$\s*([\d,]{5,11})\s*(?:USD)?\s*(?:-|–|—|to)\s*\$?\s*([\d,]{5,11})/i;
const K_RANGE = /\$\s*(\d{2,3})\s*k\s*(?:-|–|—|to)\s*\$?\s*(\d{2,3})\s*k/i;

/** Pull an annual pay range out of a posting body. US pay-transparency roles usually publish one. */
export function parseSalary(html: string): SalaryRange | null {
  const text = descriptionToText(html);

  const full = text.match(FULL_RANGE);
  if (full) {
    const min = Number(full[1].replace(/,/g, ""));
    const max = Number(full[2].replace(/,/g, ""));
    if (isSaneAnnualRange(min, max)) return { min, max };
  }

  const abbreviated = text.match(K_RANGE);
  if (abbreviated) {
    const min = Number(abbreviated[1]) * 1000;
    const max = Number(abbreviated[2]) * 1000;
    if (isSaneAnnualRange(min, max)) return { min, max };
  }

  return null;
}

function isSaneAnnualRange(min: number, max: number) {
  return min >= 25_000 && max <= 1_500_000 && max > min;
}

export function classifyWorkType(title: string): WorkType {
  return /\b(intern|internship|co-?op)\b/i.test(title) ? "Internship" : "Full-time";
}

const US_PATTERN = new RegExp(
  [
    "United States",
    "\\bUSA?\\b",
    "\\bRemote\\b.*\\bUS\\b",
    "\\b(AL|AK|AZ|AR|CA|CO|CT|DE|FL|GA|HI|ID|IL|IN|IA|KS|KY|LA|ME|MD|MA|MI|MN|MS|MO|MT|NE|NV|NH|NJ|NM|NY|NC|ND|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VT|VA|WA|WV|WI|WY|DC)\\b",
    "California|New York|Washington|Texas|Massachusetts|Illinois|Colorado|Georgia|Florida|Oregon|Utah|Arizona|Pennsylvania|Virginia|Michigan|Minnesota|Ohio|Carolina",
  ].join("|"),
  "i",
);

export function isUnitedStates(location: string) {
  return US_PATTERN.test(location);
}

export function formatRelativeTime(iso: string) {
  const posted = new Date(iso).getTime();
  if (Number.isNaN(posted)) return "unknown";
  const hours = Math.floor((Date.now() - posted) / 3_600_000);
  if (hours < 1) return "just now";
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return months < 12 ? `${months}mo ago` : `${Math.floor(months / 12)}y ago`;
}
