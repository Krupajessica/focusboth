/**
 * Normalises the messy location strings that public event feeds return into a
 * single US place label, so Discover can offer a real location filter.
 * Devpost gives venue names, confs.tech gives "City, ST" plus "U.S.A.",
 * Ticketmaster gives venue plus city plus state code.
 */

export const US_STATES: Record<string, string> = {
  AL: "Alabama", AK: "Alaska", AZ: "Arizona", AR: "Arkansas", CA: "California",
  CO: "Colorado", CT: "Connecticut", DE: "Delaware", DC: "District of Columbia",
  FL: "Florida", GA: "Georgia", HI: "Hawaii", ID: "Idaho", IL: "Illinois",
  IN: "Indiana", IA: "Iowa", KS: "Kansas", KY: "Kentucky", LA: "Louisiana",
  ME: "Maine", MD: "Maryland", MA: "Massachusetts", MI: "Michigan",
  MN: "Minnesota", MS: "Mississippi", MO: "Missouri", MT: "Montana",
  NE: "Nebraska", NV: "Nevada", NH: "New Hampshire", NJ: "New Jersey",
  NM: "New Mexico", NY: "New York", NC: "North Carolina", ND: "North Dakota",
  OH: "Ohio", OK: "Oklahoma", OR: "Oregon", PA: "Pennsylvania",
  RI: "Rhode Island", SC: "South Carolina", SD: "South Dakota", TN: "Tennessee",
  TX: "Texas", UT: "Utah", VT: "Vermont", VA: "Virginia", WA: "Washington",
  WV: "West Virginia", WI: "Wisconsin", WY: "Wyoming", PR: "Puerto Rico",
};

const STATE_NAME_TO_CODE = new Map(
  Object.entries(US_STATES).map(([code, name]) => [name.toLowerCase(), code]),
);

/** Common US host cities, used when a feed supplies a venue string with no state. */
const US_CITY_TO_STATE: Record<string, string> = {
  "new york": "NY", "new york city": "NY", nyc: "NY", brooklyn: "NY", manhattan: "NY",
  queens: "NY", bronx: "NY", buffalo: "NY", rochester: "NY", albany: "NY",
  "san francisco": "CA", "sf": "CA", "los angeles": "CA", "san diego": "CA",
  "san jose": "CA", oakland: "CA", berkeley: "CA", "palo alto": "CA",
  "mountain view": "CA", sunnyvale: "CA", "santa clara": "CA", cupertino: "CA",
  sacramento: "CA", pasadena: "CA", irvine: "CA", "long beach": "CA", fresno: "CA",
  seattle: "WA", redmond: "WA", bellevue: "WA", tacoma: "WA", spokane: "WA",
  portland: "OR", eugene: "OR", boise: "ID",
  austin: "TX", dallas: "TX", houston: "TX", "san antonio": "TX",
  "fort worth": "TX", plano: "TX", "el paso": "TX",
  chicago: "IL", evanston: "IL", urbana: "IL", champaign: "IL",
  boston: "MA", cambridge: "MA", somerville: "MA", worcester: "MA",
  atlanta: "GA", savannah: "GA", athens: "GA",
  denver: "CO", boulder: "CO", "colorado springs": "CO",
  miami: "FL", orlando: "FL", tampa: "FL", jacksonville: "FL", gainesville: "FL",
  washington: "DC", "washington dc": "DC", arlington: "VA", alexandria: "VA",
  richmond: "VA", "virginia beach": "VA", blacksburg: "VA", charlottesville: "VA",
  philadelphia: "PA", pittsburgh: "PA", "state college": "PA",
  phoenix: "AZ", tempe: "AZ", tucson: "AZ", scottsdale: "AZ", mesa: "AZ",
  detroit: "MI", "ann arbor": "MI", "east lansing": "MI", "grand rapids": "MI",
  minneapolis: "MN", "st paul": "MN", "saint paul": "MN",
  "salt lake city": "UT", provo: "UT",
  "las vegas": "NV", reno: "NV",
  nashville: "TN", memphis: "TN", knoxville: "TN", chattanooga: "TN",
  charlotte: "NC", raleigh: "NC", durham: "NC", "chapel hill": "NC", asheville: "NC",
  columbus: "OH", cleveland: "OH", cincinnati: "OH", dayton: "OH", akron: "OH",
  indianapolis: "IN", "west lafayette": "IN", bloomington: "IN",
  "kansas city": "MO", "st louis": "MO", "saint louis": "MO", columbia: "MO",
  milwaukee: "WI", madison: "WI",
  "new orleans": "LA", "baton rouge": "LA",
  baltimore: "MD", "college park": "MD", bethesda: "MD", annapolis: "MD",
  "new haven": "CT", hartford: "CT", stamford: "CT",
  providence: "RI", newark: "NJ", princeton: "NJ", "jersey city": "NJ", hoboken: "NJ",
  omaha: "NE", lincoln: "NE", "des moines": "IA", "iowa city": "IA",
  "oklahoma city": "OK", tulsa: "OK", norman: "OK",
  louisville: "KY", lexington: "KY", birmingham: "AL", huntsville: "AL",
  "little rock": "AR", jackson: "MS",
  albuquerque: "NM", "santa fe": "NM", honolulu: "HI", anchorage: "AK",
  burlington: "VT", manchester: "NH", "san juan": "PR",
  "menlo park": "CA", "santa monica": "CA", "san mateo": "CA",
};

const ONLINE_PATTERN = /\b(online|virtual|remote|worldwide|anywhere)\b/i;

export type ResolvedPlace = {
  /** "Online", "Austin, TX", "California", or "" when it is not a US place. */
  label: string;
  isUs: boolean;
  online: boolean;
  state: string;
};

function normaliseToken(token: string) {
  return token
    .toLowerCase()
    .replace(/\./g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function isCountryUs(token: string) {
  const value = normaliseToken(token);
  return value === "usa" || value === "us" || value === "united states" || value === "united states of america";
}

/** Resolve a raw feed location into a normalised US place. */
export function resolvePlace(rawLocation: string, online: boolean): ResolvedPlace {
  const raw = (rawLocation ?? "").trim();

  if (online || !raw || ONLINE_PATTERN.test(raw)) {
    return { label: "Online", isUs: true, online: true, state: "" };
  }

  const tokens = raw.split(",").map((token) => token.trim()).filter(Boolean);
  const usable = tokens.filter((token) => !isCountryUs(token));
  const hasUsCountry = tokens.some(isCountryUs);

  // "Austin, TX" or "Austin TX" anywhere in the string.
  for (let index = usable.length - 1; index >= 0; index -= 1) {
    const token = usable[index];
    const inlineState = token.match(/^(.*?)[\s,]+([A-Za-z]{2})$/);
    const code = (inlineState?.[2] ?? token).toUpperCase();

    if (US_STATES[code]) {
      const city = (inlineState?.[1] ?? usable[index - 1] ?? "").trim();
      return {
        label: city ? `${city}, ${code}` : US_STATES[code],
        isUs: true,
        online: false,
        state: code,
      };
    }

    const named = STATE_NAME_TO_CODE.get(normaliseToken(token));
    if (named) {
      const city = (usable[index - 1] ?? "").trim();
      return {
        label: city ? `${city}, ${named}` : US_STATES[named],
        isUs: true,
        online: false,
        state: named,
      };
    }
  }

  // Fall back to a known US city name appearing anywhere in the string.
  for (const token of usable) {
    const state = US_CITY_TO_STATE[normaliseToken(token)];
    if (state) {
      return { label: `${token.trim()}, ${state}`, isUs: true, online: false, state };
    }
  }

  const words = normaliseToken(raw);
  for (const [city, state] of Object.entries(US_CITY_TO_STATE)) {
    if (city.length > 4 && words.includes(city)) {
      const proper = city.replace(/\b\w/g, (letter) => letter.toUpperCase());
      return { label: `${proper}, ${state}`, isUs: true, online: false, state };
    }
  }

  if (hasUsCountry) {
    const city = usable[0]?.trim();
    return { label: city || "United States", isUs: true, online: false, state: "" };
  }

  return { label: "", isUs: false, online: false, state: "" };
}
