"""Official EUCAST v16.1 Breakpoint Table parser and S/I/R clinical decision engine.

Parses ``src/evaluation/v_16.1_Breakpoint_Tables.xlsx`` directly using the
Python standard library (``zipfile`` + ``xml.etree.ElementTree``), cross-references
drug metadata against ``configs/whonet_antibiotics.txt``, and exports synchronized
JSON / JavaScript breakpoint bundles for the DeepHalo CLI, Streamlit, and Web MVP.
"""

from __future__ import annotations

import csv
import json
import re
import sys
import xml.etree.ElementTree as ET
import zipfile
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

BASE_DIR = Path(__file__).resolve().parent.parent.parent
if str(BASE_DIR) not in sys.path:
    sys.path.insert(0, str(BASE_DIR))

from src.evaluation.cross_validation import validate_intrinsic_resistance
DEFAULT_XLSX_PATH = BASE_DIR / "src" / "evaluation" / "v_16.1_Breakpoint_Tables.xlsx"
DEFAULT_WHONET_PATH = BASE_DIR / "configs" / "whonet_antibiotics.txt"
DEFAULT_JSON_OUT = BASE_DIR / "configs" / "eucast_v16_1_breakpoints.json"
DEFAULT_JS_OUT = BASE_DIR / "mvp_web" / "breakpoints_data.js"

# Target EUCAST v16.1 sheets and normalized organism group keys
TARGET_SHEETS = (
    "Enterobacterales",
    "Staphylococcus",
    "Pseudomonas",
    "Enterococcus",
    "Acinetobacter",
    "Streptococcus A,B,C,G",
    "S.pneumoniae",
    "H.influenzae",
)

GROUP_ALIASES: Dict[str, str] = {
    "enterobacterales": "Enterobacterales",
    "escherichia coli": "Enterobacterales",
    "e. coli": "Enterobacterales",
    "klebsiella pneumoniae": "Enterobacterales",
    "klebsiella": "Enterobacterales",
    "proteus mirabilis": "Enterobacterales",
    "staphylococcus": "Staphylococcus",
    "staphylococcus aureus": "Staphylococcus",
    "s. aureus": "Staphylococcus",
    "pseudomonas": "Pseudomonas",
    "pseudomonas aeruginosa": "Pseudomonas",
    "p. aeruginosa": "Pseudomonas",
    "enterococcus": "Enterococcus",
    "enterococcus faecalis": "Enterococcus",
    "enterococcus faecium": "Enterococcus",
    "acinetobacter": "Acinetobacter",
    "acinetobacter baumannii": "Acinetobacter",
    "streptococcus a,b,c,g": "Streptococcus A,B,C,G",
    "s.pneumoniae": "S.pneumoniae",
    "streptococcus pneumoniae": "S.pneumoniae",
    "h.influenzae": "H.influenzae",
    "haemophilus influenzae": "H.influenzae",
    "aislamiento clínico": "Enterobacterales",
}

# Canonical EUCAST agent name prefix -> standard disk code & Spanish display metadata
EUCAST_AGENT_CATALOG: List[Tuple[str, str, str, str, str]] = [
    ("benzylpenicillin", "P", "Penicilina G", "J01CE01", "U"),
    ("ampicillin-sulbactam", "SAM", "Ampicilina-sulbactam", "J01CR01", "µg"),
    ("ampicillin", "AM", "Ampicilina", "J01CA01", "µg"),
    ("amoxicillin-clavulanic acid", "AMC", "Amoxicilina-ác. clavulánico", "J01CR02", "µg"),
    ("amoxicillin", "AML", "Amoxicilina", "J01CA04", "µg"),
    ("piperacillin-tazobactam", "TZP", "Piperacilina-tazobactam", "J01CR05", "µg"),
    ("piperacillin", "PRL", "Piperacilina", "J01CA12", "µg"),
    ("ticarcillin-clavulanic acid", "TIM", "Ticarcilina-clavulánico", "J01CR03", "µg"),
    ("temocillin", "TEM", "Temocilina", "J01CA17", "µg"),
    ("mecillinam", "MEL", "Mecilinam", "J01CA11", "µg"),
    ("cefadroxil", "CFR", "Cefadroxilo", "J01DB05", "µg"),
    ("cefalexin", "CNL", "Cefalexina", "J01DB01", "µg"),
    ("cefazolin", "KZ", "Cefazolina", "J01DB04", "µg"),
    ("cefepime-enmetazobactam", "FEP_ENM", "Cefepima-enmetazobactam", "J01DE51", "µg"),
    ("cefepime", "FEP", "Cefepima", "J01DE01", "µg"),
    ("cefiderocol", "FDC", "Cefiderocol", "J01DI04", "µg"),
    ("cefixime", "CFM", "Cefixima", "J01DD08", "µg"),
    ("cefotaxime", "CTX", "Cefotaxima", "J01DD01", "µg"),
    ("cefoxitin", "FOX", "Cefoxitina", "J01DC01", "µg"),
    ("cefpodoxime", "CPD", "Cefpodoxima", "J01DD13", "µg"),
    ("ceftaroline", "CPT", "Ceftarolina", "J01DI02", "µg"),
    ("ceftazidime-avibactam", "CZA", "Ceftazidima-avibactam", "J01DD52", "µg"),
    ("ceftazidime", "CAZ", "Ceftazidima", "J01DD02", "µg"),
    ("ceftibuten", "CTB", "Ceftibuteno", "J01DD14", "µg"),
    ("ceftobiprole", "BPR", "Ceftobiprol", "J01DI01", "µg"),
    ("ceftolozane-tazobactam", "CZT", "Ceftolozano-tazobactam", "J01DI54", "µg"),
    ("ceftriaxone", "CRO", "Ceftriaxona", "J01DD04", "µg"),
    ("cefuroxime", "CXM", "Cefuroxima", "J01DC02", "µg"),
    ("doripenem", "DOR", "Doripenem", "J01DH04", "µg"),
    ("ertapenem", "ETP", "Ertapenem", "J01DH03", "µg"),
    ("imipenem-relebactam", "IMR", "Imipenem-relebactam", "J01DH56", "µg"),
    ("imipenem", "IPM", "Imipenem", "J01DH51", "µg"),
    ("meropenem-vaborbactam", "MEV", "Meropenem-vaborbactam", "J01DH52", "µg"),
    ("meropenem", "MEM", "Meropenem", "J01DH02", "µg"),
    ("aztreonam-avibactam", "AZA", "Aztreonam-avibactam", "J01DF51", "µg"),
    ("aztreonam", "ATM", "Aztreonam", "J01DF01", "µg"),
    ("ciprofloxacin", "CIP", "Ciprofloxacino", "J01MA02", "µg"),
    ("pefloxacin", "PEF", "Pefloxacino (cribado)", "J01MA03", "µg"),
    ("levofloxacin", "LEV", "Levofloxacino", "J01MA12", "µg"),
    ("moxifloxacin", "MXF", "Moxifloxacino", "J01MA14", "µg"),
    ("norfloxacin", "NOR", "Norfloxacino", "J01MA06", "µg"),
    ("ofloxacin", "OFX", "Ofloxacino", "J01MA01", "µg"),
    ("amikacin", "AK", "Amikacina", "J01GB06", "µg"),
    ("gentamicin", "CN", "Gentamicina", "J01GB03", "µg"),
    ("tobramycin", "TOB", "Tobramicina", "J01GB01", "µg"),
    ("teicoplanin", "TEC", "Teicoplanina", "J01XA02", "µg"),
    ("vancomycin", "VA", "Vancomicina", "J01XA01", "µg"),
    ("erythromycin", "E", "Eritromicina", "J01FA01", "µg"),
    ("clindamycin", "DA", "Clindamicina", "J01FF01", "µg"),
    ("quinupristin-dalfopristin", "QD", "Quinupristina-dalfopristina", "J01FG02", "µg"),
    ("eravacycline", "ERV", "Eravaciclina", "J01AA13", "µg"),
    ("minocycline", "MH", "Minociclina", "J01AA08", "µg"),
    ("tetracycline", "TE", "Tetraciclina", "J01AA07", "µg"),
    ("tigecycline", "TGC", "Tigeciclina", "J01AA12", "µg"),
    ("linezolid", "LZD", "Linezolid", "J01XX08", "µg"),
    ("tedizolid", "TZD", "Tedizolid", "J01XX11", "µg"),
    ("fusidic acid", "FD", "Ácido fusídico", "J01XC01", "µg"),
    ("fosfomycin", "FOS", "Fosfomicina", "J01XX01", "µg"),
    ("lefamulin", "LEF", "Lefamulina", "J01XX12", "µg"),
    ("nitrofurantoin", "F", "Nitrofurantoína", "J01XE01", "µg"),
    ("rifampicin", "RD", "Rifampicina", "J04AB02", "µg"),
    ("trimethoprim-sulfamethoxazole", "SXT", "Trimetoprima-sulfametoxazol", "J01EE01", "µg"),
    ("trimethoprim", "W", "Trimetoprima", "J01EA01", "µg"),
    ("chloramphenicol", "C", "Cloranfenicol", "J01BA01", "µg"),
    ("mupirocin", "MUP", "Mupirocina", "D06AX09", "µg"),
]

# Synonym aliases mapping WHONET / alternative disk codes -> canonical EUCAST code
CODE_ALIASES: Dict[str, str] = {
    "AMP": "AM",
    "AMK": "AK",
    "GEN": "CN",
    "GM": "CN",
    "CLI": "DA",
    "ERY": "E",
    "NIT": "F",
    "PEN": "P",
    "VAN": "VA",
    "QDA": "QD",
    "RIF": "RD",
    "PIP": "PRL",
    "LVX": "LEV",
    "MFX": "MXF",
    "LNZ": "LZD",
    "TCY": "TE",
    "CHL": "C",
    "FOF": "FOS",
    "TPZ": "TZP",
    "TMP": "W",
    "MNO": "MH",
    "FUS": "FD",
    "S": "ST",
}

# Paired CLSI M100 reference breakpoints so interactive CLSI <-> EUCAST toggle stays accurate
CLSI_REFERENCE: Dict[str, Dict[str, Optional[Dict[str, int]]]] = {
    "AM":  {"Enterobacterales": {"s": 17, "r": 14}, "Staphylococcus": None},
    "SAM": {"Enterobacterales": {"s": 15, "r": 12}},
    "AMC": {"Enterobacterales": {"s": 18, "r": 14}},
    "PRL": {"Enterobacterales": {"s": 21, "r": 18}, "Pseudomonas": {"s": 21, "r": 15}},
    "TZP": {"Enterobacterales": {"s": 25, "r": 21}, "Pseudomonas": {"s": 22, "r": 18}},
    "CTX": {"Enterobacterales": {"s": 26, "r": 23}},
    "CRO": {"Enterobacterales": {"s": 26, "r": 23}},
    "CAZ": {"Enterobacterales": {"s": 21, "r": 18}, "Pseudomonas": {"s": 18, "r": 15}},
    "FEP": {"Enterobacterales": {"s": 25, "r": 19}, "Pseudomonas": {"s": 18, "r": 15}},
    "FOX": {"Enterobacterales": {"s": 18, "r": 15}, "Staphylococcus": {"s": 22, "r": 22}},
    "CXM": {"Enterobacterales": {"s": 18, "r": 15}},
    "ATM": {"Enterobacterales": {"s": 21, "r": 18}, "Pseudomonas": {"s": 22, "r": 16}},
    "IPM": {"Enterobacterales": {"s": 23, "r": 20}, "Pseudomonas": {"s": 19, "r": 16}, "Acinetobacter": {"s": 22, "r": 19}},
    "MEM": {"Enterobacterales": {"s": 23, "r": 20}, "Pseudomonas": {"s": 19, "r": 16}, "Acinetobacter": {"s": 18, "r": 15}},
    "ETP": {"Enterobacterales": {"s": 22, "r": 19}},
    "CIP": {"Enterobacterales": {"s": 26, "r": 22}, "Staphylococcus": {"s": 21, "r": 16}, "Pseudomonas": {"s": 25, "r": 19}},
    "LEV": {"Enterobacterales": {"s": 21, "r": 17}, "Staphylococcus": {"s": 19, "r": 16}, "Pseudomonas": {"s": 22, "r": 15}},
    "NOR": {"Enterobacterales": {"s": 17, "r": 13}, "Staphylococcus": {"s": 17, "r": 13}},
    "MXF": {"Enterobacterales": {"s": 24, "r": 21}, "Staphylococcus": {"s": 24, "r": 21}},
    "AK":  {"Enterobacterales": {"s": 17, "r": 15}, "Pseudomonas": {"s": 17, "r": 15}},
    "CN":  {"Enterobacterales": {"s": 15, "r": 13}, "Staphylococcus": {"s": 15, "r": 13}},
    "TOB": {"Enterobacterales": {"s": 15, "r": 13}, "Pseudomonas": {"s": 15, "r": 13}},
    "SXT": {"Enterobacterales": {"s": 16, "r": 11}, "Staphylococcus": {"s": 16, "r": 11}},
    "F":   {"Enterobacterales": {"s": 17, "r": 15}, "Staphylococcus": {"s": 17, "r": 15}},
    "TGC": {"Enterobacterales": {"s": 19, "r": 15}, "Staphylococcus": {"s": 19, "r": 19}},
    "P":   {"Staphylococcus": {"s": 29, "r": 29}},
    "QD":  {"Staphylococcus": {"s": 19, "r": 16}},
    "LZD": {"Staphylococcus": {"s": 21, "r": 21}, "Enterococcus": {"s": 23, "r": 21}},
    "RD":  {"Staphylococcus": {"s": 20, "r": 17}},
    "DA":  {"Staphylococcus": {"s": 21, "r": 15}},
    "E":   {"Staphylococcus": {"s": 23, "r": 14}},
    "TE":  {"Staphylococcus": {"s": 19, "r": 15}, "Enterobacterales": {"s": 15, "r": 12}},
    "MH":  {"Staphylococcus": {"s": 19, "r": 15}, "Acinetobacter": {"s": 16, "r": 13}},
    "C":   {"Enterobacterales": {"s": 18, "r": 13}, "Staphylococcus": {"s": 18, "r": 13}},
}

# Supplementary drugs not having direct EUCAST disk breakpoints on some organisms
EXTRA_DRUG_METADATA: Dict[str, Dict[str, Any]] = {
    "VA":  {"name": "Vancomicina", "atc": "J01XA01", "unit": "µg", "note": "Requiere CMI en Staphylococcus (disco 5 µg válido solo en Enterococcus EUCAST)"},
    "MUP": {"name": "Mupirocina", "atc": "D06AX09", "unit": "µg", "note": "Agente tópico (cribado nasal)"},
    "S":   {"name": "Estreptomicina", "atc": "J01GA01", "unit": "µg", "note": "Cribado de resistencia de alto nivel en Enterococcus"},
    "FD":  {"name": "Ácido fusídico", "atc": "J01XC01", "unit": "µg"},
}

CAT_LABELS = {
    "S": "Sensible",
    "I": "Intermedio",
    "R": "Resistente",
    "NA": "Sin punto de corte",
}


def canonical_code(raw_code: str) -> str:
    """Normalize a raw disk label such as ``'am_10'``, ``'AMP-10'``, ``'tpz_36'`` to canonical EUCAST code."""
    clean = re.split(r"[-_]", (raw_code or "").strip().upper())[0]
    clean = re.sub(r"\d+$", "", clean)
    return CODE_ALIASES.get(clean, clean)


def normalize_group(group_or_organism: str) -> str:
    """Map an organism or taxonomic string to a canonical EUCAST sheet name."""
    key = (group_or_organism or "Enterobacterales").strip().lower()
    if key in GROUP_ALIASES:
        return GROUP_ALIASES[key]
    for alias, target in GROUP_ALIASES.items():
        if alias in key:
            return target
    return "Enterobacterales"


def _col_idx(cell_ref: str) -> int:
    letters = "".join(ch for ch in cell_ref if ch.isalpha())
    idx = 0
    for ch in letters:
        idx = idx * 26 + (ord(ch) - ord("A") + 1)
    return idx - 1


def _parse_zone_num(raw: str) -> Optional[int]:
    """Extract leading or parenthesized integer zone diameter (e.g., '14A' -> 14, '(18)A' -> 18)."""
    txt = (raw or "").strip()
    if not txt or txt in {"-", "IE", "IP", "NA", "ND"} or txt.lower().startswith("note"):
        return None
    m = re.match(r"^\(?(\d{1,2})\)?", txt)
    return int(m.group(1)) if m else None


def _parse_atu(raw: str) -> Optional[List[int]]:
    """Extract [min, max] ATU diameter interval if present."""
    txt = (raw or "").strip()
    if not txt or txt == "-":
        return None
    nums = [int(x) for x in re.findall(r"\d{1,2}", txt)]
    if len(nums) == 1:
        return [nums[0], nums[0]]
    if len(nums) >= 2:
        return [min(nums[0], nums[1]), max(nums[0], nums[1])]
    return None


def _row_priority(agent_text: str) -> int:
    """Lower score means preferred primary systemic breakpoint row for a given agent."""
    low = agent_text.lower()
    score = 0
    if "s. aureus" in low or "indications other than meningitis" in low:
        score -= 10
    elif "meningitis" in low or "endocarditis" in low or "pneumonia" in low:
        score += 6
    if "systemic" in low or " iv" in low:
        score -= 3
    if "uncomplicated uti" in low or "oral" in low or "urinary" in low:
        score += 4
    if any(
        k in low
        for k in (
            "coagulase-negative",
            "morganellaceae",
            "other enterobacterales",
            "other staphylococci",
            "other enterococci",
            "other indications",
            "lugdunensis",
            "saprophyticus",
            "pseudintermedius",
            "epidermidis",
            "serratia spp",
            "screen only",
        )
    ):
        score += 8
    return score


def _match_agent_to_code(agent_text: str) -> Optional[Tuple[str, str, str, str]]:
    """Match an EUCAST table row label to ``(code, es_name, atc, unit)``."""
    low = re.sub(r"\s+", " ", agent_text.lower()).strip()
    for prefix, code, es_name, atc, unit in EUCAST_AGENT_CATALOG:
        if low.startswith(prefix):
            return code, es_name, atc, unit
    return None


def _load_whonet_metadata(whonet_path: Path) -> Dict[str, Dict[str, str]]:
    meta: Dict[str, Dict[str, str]] = {}
    if not whonet_path.is_file():
        return meta
    with whonet_path.open("r", encoding="utf-8", errors="ignore") as f:
        reader = csv.DictReader(f, delimiter="\t")
        for row in reader:
            if (row.get("HUMAN") or "").strip().upper() != "X":
                continue
            for col in ("EUCAST_CODE", "WHONET_ABX_CODE"):
                raw_c = (row.get(col) or "").strip().upper()
                if not raw_c:
                    continue
                code = canonical_code(raw_c)
                if code not in meta:
                    meta[code] = {
                        "whonet_name": (row.get("ANTIBIOTIC") or "").strip(),
                        "atc": (row.get("ATC_CODE") or "").strip(),
                        "loinc": (row.get("LOINCDISK") or "").strip(),
                        "potency": (row.get("POTENCY") or "").strip(),
                    }
    return meta


def parse_eucast_xlsx(
    xlsx_path: Path = DEFAULT_XLSX_PATH,
    whonet_path: Path = DEFAULT_WHONET_PATH,
) -> Dict[str, Any]:
    """Parse ``v_16.1_Breakpoint_Tables.xlsx`` into a normalized clinical knowledge base."""
    whonet_meta = _load_whonet_metadata(whonet_path)
    drugs: Dict[str, Dict[str, Any]] = {}

    def ensure_drug(code: str, es_name: str = "", atc: str = "", unit: str = "µg") -> Dict[str, Any]:
        if code not in drugs:
            w = whonet_meta.get(code, {})
            extra = EXTRA_DRUG_METADATA.get(code, {})
            drugs[code] = {
                "code": code,
                "name": es_name or extra.get("name") or w.get("whonet_name") or code,
                "atc": atc or extra.get("atc") or w.get("atc") or "",
                "loinc": w.get("loinc") or "",
                "unit": unit or extra.get("unit") or "µg",
                "potency": w.get("potency") or "",
                "note": extra.get("note") or "",
                "eucast": {},
                "clsi": dict(CLSI_REFERENCE.get(code, {})),
            }
        return drugs[code]

    for extra_code in EXTRA_DRUG_METADATA:
        ensure_drug(extra_code)

    if xlsx_path.is_file():
        ns = {"m": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}
        with zipfile.ZipFile(xlsx_path) as zf:
            sst = [
                "".join(si.itertext())
                for si in ET.fromstring(zf.read("xl/sharedStrings.xml")).findall("m:si", ns)
            ]
            wb = ET.fromstring(zf.read("xl/workbook.xml"))
            rels = {
                r.attrib["Id"]: r.attrib["Target"]
                for r in ET.fromstring(zf.read("xl/_rels/workbook.xml.rels"))
            }
            rel_attr = "{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id"
            sheet_map = {
                s.attrib["name"]: "xl/" + rels[s.attrib[rel_attr]]
                for s in wb.findall(".//m:sheet", ns)
            }

            best_priority: Dict[Tuple[str, str], int] = {}
            for sname in TARGET_SHEETS:
                if sname not in sheet_map:
                    continue
                root = ET.fromstring(zf.read(sheet_map[sname]))
                for row in root.findall(".//m:row", ns):
                    cells: Dict[int, str] = {}
                    for c in row.findall("m:c", ns):
                        v = c.find("m:v", ns)
                        if v is None or v.text is None:
                            continue
                        val = sst[int(v.text)] if c.attrib.get("t") == "s" else v.text
                        cells[_col_idx(c.attrib["r"])] = val.replace("\n", " ").strip()

                    agent_label = cells.get(0, "")
                    if not agent_label:
                        continue
                    matched = _match_agent_to_code(agent_label)
                    if not matched:
                        continue

                    s_cut = _parse_zone_num(cells.get(5, ""))
                    r_cut = _parse_zone_num(cells.get(6, ""))
                    if s_cut is None or r_cut is None:
                        continue

                    code, es_name, atc, unit = matched
                    entry = ensure_drug(code, es_name=es_name, atc=atc, unit=unit)
                    prio = _row_priority(agent_label)
                    key = (code, sname)

                    if key not in best_priority or prio < best_priority[key]:
                        best_priority[key] = prio
                        atu = _parse_atu(cells.get(7, ""))
                        bp_obj: Dict[str, Any] = {
                            "s": s_cut,
                            "r": r_cut,
                            "disk_ug": cells.get(4, "").strip(),
                            "source_row": agent_label,
                        }
                        if atu:
                            bp_obj["atu"] = atu
                        entry["eucast"][sname] = bp_obj
                        if not entry["potency"] and bp_obj["disk_ug"]:
                            entry["potency"] = bp_obj["disk_ug"]

    # Ensure every CLSI drug is also present even if it has no EUCAST zone breakpoint (e.g. VA on Staph)
    for clsi_code in CLSI_REFERENCE:
        ensure_drug(clsi_code)

    return {
        "version": "EUCAST v16.1 (2026-06-24) + CLSI M100",
        "source_file": xlsx_path.name,
        "groups": list(TARGET_SHEETS),
        "aliases": CODE_ALIASES,
        "drugs": drugs,
    }


_CACHED_DB: Optional[Dict[str, Any]] = None


def get_breakpoint_db(
    xlsx_path: Path = DEFAULT_XLSX_PATH,
    whonet_path: Path = DEFAULT_WHONET_PATH,
    force_reload: bool = False,
) -> Dict[str, Any]:
    """Return cached EUCAST v16.1 + CLSI breakpoint database."""
    global _CACHED_DB
    if _CACHED_DB is None or force_reload:
        _CACHED_DB = parse_eucast_xlsx(xlsx_path=xlsx_path, whonet_path=whonet_path)
    return _CACHED_DB


def evaluate_susceptibility(
    abx_code: str,
    diameter_mm: float,
    organism_group: str = "Enterobacterales",
    standard: str = "EUCAST",
    organism_name: str = "",
    db: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """Evaluate a disk diffusion zone diameter (mm) into S / I / R / NA with EUCAST v16.1 + intrinsic rules."""
    db = db or get_breakpoint_db()
    code = canonical_code(abx_code)
    std = (standard or "EUCAST").upper()
    if std not in {"EUCAST", "CLSI"}:
        std = "EUCAST"
    group = normalize_group(organism_group or organism_name)

    drug = db["drugs"].get(code)
    std_key = "eucast" if std == "EUCAST" else "clsi"
    bp = drug.get(std_key, {}).get(group) if drug else None

    if bp is None:
        cat = "NA"
        note = (drug or {}).get("note") or f"Sin punto de corte {std} para {group}"
        bp_text = note
    else:
        s_cut = int(bp["s"])
        r_cut = int(bp["r"])
        if diameter_mm >= s_cut:
            cat = "S"
        elif diameter_mm < r_cut:
            cat = "R"
        else:
            cat = "I"

        if s_cut >= 50:
            bp_text = f"Sin S · I ≥ {r_cut} mm · R < {r_cut} mm ({std})"
        elif s_cut == r_cut:
            bp_text = f"S ≥ {s_cut} mm · R < {r_cut} mm ({std})"
        else:
            bp_text = f"S ≥ {s_cut} mm · I {r_cut}–{s_cut - 1} mm · R < {r_cut} mm ({std})"

    atu = (bp or {}).get("atu")
    in_atu = False
    atu_message = ""
    if atu and std == "EUCAST" and atu[0] <= round(diameter_mm) <= atu[1]:
        in_atu = True
        atu_message = f"ATU EUCAST ({atu[0]}–{atu[1]} mm): incertidumbre técnica, revisar lectura."

    # Biological cross-validation (Section 4.6 intrinsic resistance engine)
    bio_check = validate_intrinsic_resistance(
        abx_code=code,
        category=cat,
        organism_name=organism_name or organism_group,
    )
    if bio_check["bio_alert"]:
        cat = bio_check["override_category"]

    return {
        "code": code,
        "name": (drug or {}).get("name") or code,
        "atc": (drug or {}).get("atc") or "",
        "loinc": (drug or {}).get("loinc") or "",
        "group": group,
        "standard": std,
        "diameter_mm": round(float(diameter_mm), 1),
        "category": cat,
        "category_label": CAT_LABELS.get(cat, "Sin punto de corte"),
        "breakpoint": bp,
        "bp_text": bp_text,
        "in_atu": in_atu,
        "atu_message": atu_message,
        "bio_alert": bio_check["bio_alert"],
        "bio_message": bio_check["bio_message"],
        "intrinsic_rule": bio_check["rule_mechanism"],
    }


def export_breakpoints_json(
    output_json_path: Path = DEFAULT_JSON_OUT,
    output_js_path: Path = DEFAULT_JS_OUT,
    xlsx_path: Path = DEFAULT_XLSX_PATH,
    whonet_path: Path = DEFAULT_WHONET_PATH,
) -> Dict[str, Any]:
    """Generate JSON and ``window.ADLMS_BREAKPOINTS`` JS assets for CLI and Web MVP."""
    db = parse_eucast_xlsx(xlsx_path=xlsx_path, whonet_path=whonet_path)
    from src.evaluation.cross_validation import export_intrinsic_rules_list

    payload = {
        "version": db["version"],
        "source_file": db["source_file"],
        "groups": db["groups"],
        "aliases": db["aliases"],
        "drugs": db["drugs"],
        "intrinsic_rules": export_intrinsic_rules_list(),
    }

    output_json_path.parent.mkdir(parents=True, exist_ok=True)
    output_json_path.write_text(json.dumps(payload, indent=2, ensure_ascii=False), encoding="utf-8")

    output_js_path.parent.mkdir(parents=True, exist_ok=True)
    js_banner = "// AUTO-GENERATED from src/evaluation/v_16.1_Breakpoint_Tables.xlsx by eucast_breakpoints.py\n"
    js_content = js_banner + "window.ADLMS_BREAKPOINTS = " + json.dumps(payload, indent=2, ensure_ascii=False) + ";\n"
    output_js_path.write_text(js_content, encoding="utf-8")
    return payload


if __name__ == "__main__":
    bundle = export_breakpoints_json()
    print(f"Parsed {len(bundle['drugs'])} antimicrobials from {bundle['source_file']} ({bundle['version']})")
    print(f"Wrote JSON -> {DEFAULT_JSON_OUT}")
    print(f"Wrote JS   -> {DEFAULT_JS_OUT}")

    # Quick clinical verification checks
    ecoli_ctx = evaluate_susceptibility("CTX", 21.0, "Enterobacterales", "EUCAST", "Escherichia coli")
    kp_amp = evaluate_susceptibility("AM", 26.0, "Enterobacterales", "EUCAST", "Klebsiella pneumoniae")
    print("Check E. coli CTX 21mm (EUCAST):", ecoli_ctx["category"], "|", ecoli_ctx["bp_text"])
    print("Check K. pneumoniae AM 26mm (Intrinsic):", kp_amp["category"], "|", kp_amp["bio_message"])
