"""Parse 8 CFR 214.2 (eCFR renderer HTML, issue 2026-10-14) into citable passages.

eCFR gives every paragraph its official id, e.g. id="p-214.2(f)(10)(ii)(E)", so labels are
taken from the source rather than inferred. Paragraphs are grouped at up to four levels
(e.g. (f)(10)(ii)(E)) and split into passages of at most 200 words. Only the F-1 provisions
relevant to OPT / STEM OPT / cap-gap are kept: (f)(5), (f)(9)-(f)(13).

Source: https://www.ecfr.gov/api/renderer/v1/content/enhanced/2026-10-14/title-8?part=214&section=214.2
"""
import html
import json
import os
import re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "data", "policy_raw", "ecfr_214_2.html")
KEEP = {"5", "9", "10", "11", "12", "13"}


def main():
    raw = open(SRC, encoding="utf-8").read()
    # each paragraph: <p class="indent-4" data-title="214.2(f)(10)(ii)(E)"> ... </p>
    paras = re.findall(r'<p[^>]*data-title="214\.2((?:\([^)]+\))+)"[^>]*>(.*?)</p>', raw, re.S)
    groups: dict[str, list[str]] = {}
    order: list[str] = []
    for label, body in paras:
        parts = re.findall(r"\(([^)]+)\)", label)
        if len(parts) < 2 or parts[0] != "f" or parts[1] not in KEEP:
            continue
        key = "".join(f"({p})" for p in parts[:4])
        text = html.unescape(re.sub(r"\s+", " ", re.sub(r"<[^>]+>", " ", body))).strip()
        if key not in groups:
            groups[key] = []
            order.append(key)
        groups[key].append(text)
    out = []
    for key in order:
        words = " ".join(groups[key]).split()
        for i in range(0, len(words), 200):
            out.append({"label": f"8 CFR 214.2{key}", "anchor": f"p-214.2{key}", "text": " ".join(words[i:i + 200])})
    json.dump(out, open(os.path.join(ROOT, "data", "policy_raw", "ecfr_passages.json"), "w"), indent=0)
    print(len(out), "eCFR passages from", len(order), "paragraph groups")


if __name__ == "__main__":
    main()
