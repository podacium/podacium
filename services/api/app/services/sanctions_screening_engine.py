"""
TamWheel Sovereign Ethical Agentic Venture OS — Sanctions & Adverse Media Screening Engine.
Implements:
1. Multi-regime sanctions screening:
   - UN Security Council Consolidated List
   - US OFAC SDN (Specially Designated Nationals)
   - EU Financial Sanctions (CFSP Consolidated List)
   - Algerian National Terrorism & Financial Freeze List (Commission Nationale / CTRF under Law 05-01 / 23-01)
2. Algerian / Maghreb phonetic & transliteration fuzzy name matching:
   - Jaro-Winkler prefix-weighted metric
   - Normalized Levenshtein edit distance
   - Maghreb phonetic soundex & token-set permutation matching (e.g. Mohamed / Mouhamed / Mohamed Cherif)
3. PEP (Politically Exposed Persons) detection under Algerian Law 05-01 / 23-01:
   - National PEPs (Ministers, Walis, MPs, Generals, Senior Judges, SOE PDGs like Sonatrach/Sonelgaz)
   - Foreign PEPs & International Org Senior Officials
   - Relatives & Close Associates (RCA) with cooling-off period calculation
4. Automated Adverse Media scanner for Algerian white-collar crimes and commercial court disputes.
"""

from __future__ import annotations

import logging
import math
import re
import unicodedata
import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional, Set, Tuple

from app.schemas.diligence_sanctions import (
    SanctionRegime,
    SanctionRiskLevel,
    SanctionHit,
    PEPType,
    PEPRiskTier,
    PEPHit,
    AdverseMediaCategory,
    AdverseMediaSeverity,
    AdverseMediaArticle,
    FuzzyMatchDetail,
    FuzzyMatchResponse,
    SanctionsScreeningRequest,
    SanctionsScreeningResponse,
    PEPScreeningRequest,
    PEPScreeningResponse,
    AdverseMediaScanRequest,
    AdverseMediaScanResponse,
)

logger = logging.getLogger("tamwheel.services.sanctions_screening")


# =============================================================================
# ALGERIAN PHONETIC & TRANSLITERATION MATCHING ENGINE
# =============================================================================

class AlgerianPhoneticMatcher:
    """
    Phonetic and transliteration matching system calibrated for Algerian & Maghreb
    Arabic-to-Latin naming variations (French and Anglo-Saxon transliterations).
    """

    # Honorifics & titles to strip before phonetic matching
    TITLES_TO_STRIP = {
        "sidi", "cheikh", "chikh", "sheikh", "hadj", "elhadj", "el-hadj",
        "moulay", "maitre", "me", "dr", "docteur", "ingenieur", "si", "lalla",
        "mr", "mme", "mister", "monsieur", "madame",
    }

    # Particles and prefixes
    PREFIX_MAP = {
        r"\bel[-\s]": "",
        r"\bal[-\s]": "",
        r"\bl'": "",
        r"\ba[iy]t[-\s]": "ait ",
        r"\bben[-\s]": "ben ",
        r"\bbin[-\s]": "ben ",
        r"\bibn[-\s]": "ben ",
        r"\bbel[-\s]": "bel ",
        r"\bbou[-\s]": "bou ",
        r"\bould[-\s]": "ould ",
        r"\babd[-\s]el[-\s]": "abdel ",
        r"\babdel[-\s]": "abdel ",
        r"\babd[-\s]": "abdel ",
        r"\babdul[-\s]": "abdel ",
    }

    @classmethod
    def strip_accents(cls, text: str) -> str:
        """Strip accents and diacritics from text."""
        nfkd = unicodedata.normalize("NFKD", text)
        return "".join(c for c in nfkd if not unicodedata.combining(c))

    @classmethod
    def clean_text(cls, text: str) -> str:
        """Standardize lowercase, strip accents and punctuation."""
        if not text:
            return ""
        s = cls.strip_accents(text.lower())
        s = re.sub(r"[^\w\s-]", " ", s)
        s = re.sub(r"\s+", " ", s).strip()
        return s

    @classmethod
    def normalize_name(cls, name: str) -> str:
        """
        Produce a normalized canonical representation of a Maghreb name.
        Normalizes prefixes, collapses whitespace, strips titles.
        """
        s = cls.clean_text(name)
        tokens = s.split()

        # Remove known honorific titles
        filtered_tokens = [t for t in tokens if t not in cls.TITLES_TO_STRIP]
        reconstructed = " ".join(filtered_tokens)

        # Normalize Maghreb prefixes
        for pattern, repl in cls.PREFIX_MAP.items():
            reconstructed = re.sub(pattern, repl, reconstructed)

        return re.sub(r"\s+", " ", reconstructed).strip()

    @classmethod
    def maghreb_phonetic_key(cls, name: str) -> str:
        """
        Reduce an Algerian name to its core Maghreb phonetic skeleton:
        - Harmonizes vowels (ou -> u, o -> u, e -> i, ai -> i, etc.)
        - Harmonizes consonants (dj -> j, kh -> k, gh -> g, ch -> sh, etc.)
        - Collapses duplicate consonants
        """
        s = cls.normalize_name(name)

        # Substitute composite digraphs first
        s = s.replace("dj", "j")
        s = s.replace("kh", "k")
        s = s.replace("gh", "g")
        s = s.replace("ch", "sh")
        s = s.replace("th", "t")
        s = s.replace("dh", "d")
        s = s.replace("ou", "u")
        s = s.replace("ph", "f")
        s = s.replace("ck", "k")

        # Vowel harmonizations
        s = s.replace("o", "u")
        s = s.replace("e", "i")
        s = s.replace("y", "i")
        s = s.replace("ai", "i")
        s = s.replace("ay", "i")
        s = s.replace("ey", "i")
        s = s.replace("aa", "a")
        s = s.replace("ee", "i")
        s = s.replace("oo", "u")
        s = s.replace("q", "k")
        s = s.replace("c", "k")

        # Collapse duplicate consonants
        s = re.sub(r"(.)\1+", r"\1", s)
        return s.replace(" ", "")

    @staticmethod
    def levenshtein_distance(s1: str, s2: str) -> int:
        """Compute standard Levenshtein edit distance."""
        if s1 == s2:
            return 0
        if not s1:
            return len(s2)
        if not s2:
            return len(s1)

        v0 = list(range(len(s2) + 1))
        v1 = [0] * (len(s2) + 1)

        for i in range(len(s1)):
            v1[0] = i + 1
            for j in range(len(s2)):
                cost = 0 if s1[i] == s2[j] else 1
                v1[j + 1] = min(v1[j] + 1, v0[j + 1] + 1, v0[j] + cost)
            v0, v1 = v1, v0

        return v0[len(s2)]

    @classmethod
    def levenshtein_ratio(cls, s1: str, s2: str) -> float:
        """Normalized Levenshtein similarity ratio [0.0, 1.0]."""
        max_len = max(len(s1), len(s2))
        if max_len == 0:
            return 1.0
        dist = cls.levenshtein_distance(s1, s2)
        return max(0.0, 1.0 - (dist / max_len))

    @staticmethod
    def jaro_similarity(s1: str, s2: str) -> float:
        """Compute standard Jaro distance between two strings."""
        len1, len2 = len(s1), len(s2)
        if len1 == 0 and len2 == 0:
            return 1.0
        if len1 == 0 or len2 == 0:
            return 0.0

        match_window = max(len1, len2) // 2 - 1
        if match_window < 0:
            match_window = 0

        s1_matches = [False] * len1
        s2_matches = [False] * len2
        matches = 0

        for i in range(len1):
            start = max(0, i - match_window)
            end = min(i + match_window + 1, len2)
            for j in range(start, end):
                if s2_matches[j] or s1[i] != s2[j]:
                    continue
                s1_matches[i] = True
                s2_matches[j] = True
                matches += 1
                break

        if matches == 0:
            return 0.0

        transpositions = 0
        k = 0
        for i in range(len1):
            if not s1_matches[i]:
                continue
            while not s2_matches[k]:
                k += 1
            if s1[i] != s2[k]:
                transpositions += 1
            k += 1

        m = matches
        return ((m / len1) + (m / len2) + ((m - transpositions / 2) / m)) / 3.0

    @classmethod
    def jaro_winkler_score(cls, s1: str, s2: str, prefix_scale: float = 0.1) -> float:
        """Compute Jaro-Winkler similarity with common prefix weighting."""
        jaro = cls.jaro_similarity(s1, s2)
        prefix_len = 0
        max_prefix = min(4, len(s1), len(s2))
        for i in range(max_prefix):
            if s1[i] == s2[i]:
                prefix_len += 1
            else:
                break
        return jaro + (prefix_len * prefix_scale * (1.0 - jaro))

    @classmethod
    def token_set_ratio(cls, s1: str, s2: str) -> float:
        """
        Token set similarity invariant to name permutations
        (e.g. 'Mohamed Cherif Benali' vs 'Benali Mohamed Cherif').
        """
        tokens1 = set(cls.clean_text(s1).split())
        tokens2 = set(cls.clean_text(s2).split())
        if not tokens1 or not tokens2:
            return 0.0

        # For single token comparisons, fallback to Levenshtein ratio
        if len(tokens1) == 1 and len(tokens2) == 1:
            t1 = next(iter(tokens1))
            t2 = next(iter(tokens2))
            return cls.levenshtein_ratio(t1, t2)

        intersection = tokens1.intersection(tokens2)
        if not intersection:
            # Check pairwise token fuzzy matches
            fuzzy_hits = 0
            for t1 in tokens1:
                for t2 in tokens2:
                    if cls.levenshtein_ratio(t1, t2) >= 0.75:
                        fuzzy_hits += 1
                        break
            union_len = len(tokens1.union(tokens2))
            return min(1.0, fuzzy_hits / max(1, union_len))

        union = tokens1.union(tokens2)
        jaccard = len(intersection) / len(union)

        # Re-sort tokens
        sorted_inter = " ".join(sorted(intersection))
        sorted_t1 = " ".join(sorted(tokens1))
        sorted_t2 = " ".join(sorted(tokens2))

        score1 = cls.levenshtein_ratio(sorted_inter, sorted_t1)
        score2 = cls.levenshtein_ratio(sorted_inter, sorted_t2)
        score3 = cls.levenshtein_ratio(sorted_t1, sorted_t2)

        return max(jaccard, score1, score2, score3)

    @classmethod
    def match_names(cls, query: str, target: str) -> FuzzyMatchDetail:
        """
        Execute comprehensive multi-factor Algerian name matching.
        """
        q_norm = cls.normalize_name(query)
        t_norm = cls.normalize_name(target)

        # Exact match fast path
        if q_norm == t_norm:
            return FuzzyMatchDetail(
                tokenSimilarity=1.0,
                levenshteinRatio=1.0,
                jaroWinklerScore=1.0,
                phoneticMatch=True,
                compositeScore=1.0,
            )

        token_sim = cls.token_set_ratio(q_norm, t_norm)
        lev_ratio = cls.levenshtein_ratio(q_norm, t_norm)
        jw_score = cls.jaro_winkler_score(q_norm, t_norm)

        q_phonetic = cls.maghreb_phonetic_key(query)
        t_phonetic = cls.maghreb_phonetic_key(target)
        phonetic_match = (q_phonetic == t_phonetic) or (
            cls.levenshtein_ratio(q_phonetic, t_phonetic) >= 0.85
        )

        # Base weighted composite score
        base_composite = (
            0.35 * jw_score +
            0.35 * token_sim +
            0.20 * lev_ratio +
            (0.10 if phonetic_match else 0.0)
        )

        # If tokens are exact permutation (token_sim == 1.0), strong bonus
        if token_sim >= 0.95:
            composite = max(base_composite, 0.90 * token_sim)
        elif phonetic_match:
            composite = max(base_composite, 0.50 * jw_score + 0.35 * token_sim + 0.15)
        else:
            composite = base_composite

        composite = max(0.0, min(1.0, composite))

        return FuzzyMatchDetail(
            tokenSimilarity=round(token_sim, 4),
            levenshteinRatio=round(lev_ratio, 4),
            jaroWinklerScore=round(jw_score, 4),
            phoneticMatch=phonetic_match,
            compositeScore=round(composite, 4),
        )


# =============================================================================
# SANCTIONS REGISTRY DATABASE (INTERNATIONAL & ALGERIAN NATIONAL FREEZE LIST)
# =============================================================================

# Benchmark sanctioned entities across international and Algerian domestic regimes
SANCTIONS_REGISTRY = [
    # Algerian National Terrorism / Financial Freeze List (Commission Nationale / CTRF under Law 05-01 / 23-01)
    {
        "regime": SanctionRegime.ALGERIA_CTRF_NATIONAL,
        "listReferenceId": "DZ-CNQFT-2022-001",
        "entityName": "Mouvement Rachad",
        "aliases": ["Rachad Organization", "Rachad Movement"],
        "designationDate": "2022-02-06",
        "legalBasis": "Arrêté interministériel fixant la liste des personnes et entités terroristes (JORADP n°11)",
        "programs": ["TERRORISM_FINANCIAL_FREEZE", "CTRF_DOMESTIC_ASSET_FREEZE"],
        "country": "DZ",
    },
    {
        "regime": SanctionRegime.ALGERIA_CTRF_NATIONAL,
        "listReferenceId": "DZ-CNQFT-2022-002",
        "entityName": "Mouvement pour l'Autodetermination de la Kabylie",
        "aliases": ["MAK", "Anavad"],
        "designationDate": "2022-02-06",
        "legalBasis": "Arrêté interministériel fixant la liste des personnes et entités terroristes (JORADP n°11)",
        "programs": ["TERRORISM_FINANCIAL_FREEZE", "CTRF_DOMESTIC_ASSET_FREEZE"],
        "country": "DZ",
    },
    {
        "regime": SanctionRegime.ALGERIA_CTRF_NATIONAL,
        "listReferenceId": "DZ-CNQFT-2021-014",
        "entityName": "Mokhtar Belmokhtar",
        "aliases": ["Khaled Abou El Abass", "Belaouer", "Laaouar", "Mokhtar Belmokhtar Ben Mohamed"],
        "designationDate": "2021-12-15",
        "legalBasis": "Arrêté interministériel CTRF / Law 05-01 Art. 8 bis",
        "programs": ["CTRF_ASSET_FREEZE", "AL_QAIDA_AQMI"],
        "country": "DZ",
    },
    {
        "regime": SanctionRegime.ALGERIA_CTRF_NATIONAL,
        "listReferenceId": "DZ-CNQFT-2023-008",
        "entityName": "Al-Mourabitoun Front Holdings",
        "aliases": ["Les Enturbannes Commercial", "El Mourabitoune Syndicate"],
        "designationDate": "2023-04-10",
        "legalBasis": "Arrêté CTRF Gel des Avoirs",
        "programs": ["TERRORIST_FINANCING_FRONT", "CTRF_ASSET_FREEZE"],
        "country": "DZ",
    },
    # UN Security Council Consolidated List
    {
        "regime": SanctionRegime.UN_CONSOLIDATED,
        "listReferenceId": "UN-SC-1267-AQ-042",
        "entityName": "Al-Qaida in the Islamic Maghreb",
        "aliases": ["AQIM", "Organisation Al-Qaida au Maghreb Islamique", "GSPC"],
        "designationDate": "2001-10-06",
        "legalBasis": "UNSC Res 1267/1989/2253",
        "programs": ["ISIL_AL_QAIDA"],
        "country": "DZ",
    },
    {
        "regime": SanctionRegime.UN_CONSOLIDATED,
        "listReferenceId": "UN-SC-1267-IND-118",
        "entityName": "Abdelmalek Droukdel",
        "aliases": ["Abu Musab Abdel Wadoud", "Abdelmalek Droukdel Ben Rabah"],
        "designationDate": "2007-08-27",
        "legalBasis": "UNSC Res 1267/1989/2253",
        "programs": ["ISIL_AL_QAIDA"],
        "country": "DZ",
    },
    # US OFAC SDN
    {
        "regime": SanctionRegime.US_OFAC_SDN,
        "listReferenceId": "OFAC-SDN-9412",
        "entityName": "Al-Barakaat International Foundation",
        "aliases": ["Al Barakaat Financial Consortium", "Barakat Telecommunications"],
        "designationDate": "2001-11-07",
        "legalBasis": "Executive Order 13224",
        "programs": ["SDGT", "TERRORISM_FINANCING"],
        "country": "SO",
    },
    {
        "regime": SanctionRegime.US_OFAC_SDN,
        "listReferenceId": "OFAC-SDN-19041",
        "entityName": "Ayman al-Zawahiri Network",
        "aliases": ["Zawahiri Financial Trust"],
        "designationDate": "2002-01-25",
        "legalBasis": "Executive Order 13224",
        "programs": ["SDGT"],
        "country": "EG",
    },
    # EU Financial Sanctions (CFSP)
    {
        "regime": SanctionRegime.EU_FINANCIAL_SANCTIONS,
        "listReferenceId": "EU-CFSP-2016-892",
        "entityName": "Jund al-Khilafah in Algeria",
        "aliases": ["Soldiers of the Caliphate in Algeria", "Jund Al Khilafa fi Djazair"],
        "designationDate": "2016-09-20",
        "legalBasis": "EU Common Position 2001/931/CFSP",
        "programs": ["EU_TERRORIST_LIST"],
        "country": "DZ",
    },
]


# =============================================================================
# PEP REGISTRY (ALGERIAN LAW 05-01 / LAW 23-01)
# =============================================================================

# Representative statutory roles and high-profile public positions in Algeria
KNOWN_PEP_REPOSITORIES = [
    {
        "name": "Abdelmadjid Tebboune",
        "aliases": ["President Tebboune"],
        "type": PEPType.NATIONAL_PEP,
        "role": "President of the Republic",
        "institution": "Presidency of the Republic of Algeria",
        "riskTier": PEPRiskTier.CRITICAL,
        "currentlyInOffice": True,
        "exitYear": None,
        "eddMandatory": True,
    },
    {
        "name": "Nadir Larbaoui",
        "aliases": ["Premier Ministre Larbaoui"],
        "type": PEPType.NATIONAL_PEP,
        "role": "Prime Minister",
        "institution": "Services du Premier Ministre",
        "riskTier": PEPRiskTier.CRITICAL,
        "currentlyInOffice": True,
        "exitYear": None,
        "eddMandatory": True,
    },
    {
        "name": "Laaziz Faid",
        "aliases": ["Faïd Laaziz", "Ministre Faid"],
        "type": PEPType.NATIONAL_PEP,
        "role": "Minister of Finance",
        "institution": "Ministry of Finance Algeria",
        "riskTier": PEPRiskTier.CRITICAL,
        "currentlyInOffice": True,
        "exitYear": None,
        "eddMandatory": True,
    },
    {
        "name": "Rachid Hachichi",
        "aliases": ["PDG Hachichi"],
        "type": PEPType.NATIONAL_PEP,
        "role": "Président Directeur Général (PDG)",
        "institution": "Sonatrach SPA (State-Owned Oil & Gas)",
        "riskTier": PEPRiskTier.HIGH,
        "currentlyInOffice": True,
        "exitYear": None,
        "eddMandatory": True,
    },
    {
        "name": "Mourad Adjal",
        "aliases": ["PDG Adjal"],
        "type": PEPType.NATIONAL_PEP,
        "role": "Président Directeur Général (PDG)",
        "institution": "Sonelgaz SPA (State-Owned Electricity & Gas)",
        "riskTier": PEPRiskTier.HIGH,
        "currentlyInOffice": True,
        "exitYear": None,
        "eddMandatory": True,
    },
    {
        "name": "Salah Goudjil",
        "aliases": ["President Conseil de la Nation Goudjil"],
        "type": PEPType.NATIONAL_PEP,
        "role": "President of the Council of the Nation",
        "institution": "Conseil de la Nation (Upper House of Parliament)",
        "riskTier": PEPRiskTier.CRITICAL,
        "currentlyInOffice": True,
        "exitYear": None,
        "eddMandatory": True,
    },
    {
        "name": "Ibrahim Boughali",
        "aliases": ["President APN Boughali"],
        "type": PEPType.NATIONAL_PEP,
        "role": "President of the National People's Assembly (APN)",
        "institution": "Assemblée Populaire Nationale",
        "riskTier": PEPRiskTier.CRITICAL,
        "currentlyInOffice": True,
        "exitYear": None,
        "eddMandatory": True,
    },
    {
        "name": "Mohamed Cherif Ould Kaddour",
        "aliases": ["Abdelmoumen Ould Kaddour Associate"],
        "type": PEPType.RCA_PEP,
        "role": "First-Degree Relative / Commercial Associate of former Sonatrach PDG",
        "institution": "Sonatrach Related Commercial Entity",
        "riskTier": PEPRiskTier.HIGH,
        "currentlyInOffice": False,
        "exitYear": 2021,
        "eddMandatory": True,
    },
    {
        "name": "Kamel Haddad",
        "aliases": ["Ali Haddad ETRHB Relative"],
        "type": PEPType.RCA_PEP,
        "role": "Family Associate of convicted Oligarch",
        "institution": "ETRHB Haddad Group",
        "riskTier": PEPRiskTier.HIGH,
        "currentlyInOffice": False,
        "exitYear": 2020,
        "eddMandatory": True,
    },
]

# Statutory PEP role titles in Algeria under Law 05-01 / 23-01
STATUTORY_PEP_TITLES = [
    "ministre", "secretaire d'etat", "wali", "chef de daira", "depute",
    "senateur", "general", "colonel", "magistrat", "juge", "procureur",
    "president directeur general", "pdg sonatrach", "pdg sonelgaz", "pdg saidal",
    "gouverneur banque d'algerie", "directeur general des douanes",
    "directeur general des impots", "ambassadeur", "consul general",
]


# =============================================================================
# ADVERSE MEDIA CORPUS & SCANNER
# =============================================================================

ADVERSE_CRIME_PATTERNS = {
    AdverseMediaCategory.MONEY_LAUNDERING_FINANCIAL_CRIME: [
        r"\bblanchiment\b", r"\bblanchiment d['’]argent\b", r"\bdetournement\b",
        r"\bdetournement de fonds\b", r"\bescroquerie\b", r"\babus de biens sociaux\b",
        r"\benrichissement illicite\b", r"\babus de confiance\b",
    ],
    AdverseMediaCategory.BRIBERY_PUBLIC_CORRUPTION: [
        r"\bcorruption\b", r"\bpots-de-vin\b", r"\btrafic d['’]influence\b",
        r"\bmarches publics illicite\b", r"\bpassation illicite de marches\b",
        r"\bconcussion\b", r"\bfavoritisme\b", r"\bbribe\b",
    ],
    AdverseMediaCategory.TAX_EVASION_CUSTOMS_FRAUD: [
        r"\bfraude fiscale\b", r"\bfausses factures\b", r"\bsociete ecran\b",
        r"\bfuite de capitaux\b", r"\binfraction a la legislation des changes\b",
        r"\bsurfacturation\b", r"\bmajoration de facturation\b", r"\bcontrebande\b",
    ],
    AdverseMediaCategory.COMMERCIAL_DISPUTE_INSOLVENCY: [
        r"\bcessation de paiement\b", r"\bfaillite\b", r"\bliquidation judiciaire\b",
        r"\bcontentieux bancaire\b", r"\bcheque sans provision\b", r"\bsaisie conservatoire\b",
        r"\bprotestation de traite\b", r"\binterdiction bancaire\b",
    ],
    AdverseMediaCategory.ILLEGAL_CAPITAL_FLIGHT: [
        r"\btransfert illicite de devises\b", r"\bparadis fiscal\b",
        r"\bcomptes offshore non declares\b", r"\btrafic de devises\b",
    ],
}

DEFAULT_MEDIA_ARCHIVES = [
    {
        "title": "Enquête judiciaire sur des surfacturations à l'importation de matériels informatiques",
        "source": "Algérie Presse Service (APS) / Rubrique Judiciaire",
        "date": "2024-03-14",
        "content": "Le pôle pénal économique et financier de Sidi M'hamed a instruit un dossier de surfacturation et infraction à la législation des changes impliquant la société Al-Mourabitoun Front Holdings et plusieurs gérants associés pour fuite de capitaux.",
    },
    {
        "title": "Affaire ETRHB: Condamnations pour passation illicite de marchés publics et trafic d'influence",
        "source": "El Watan Archives Économiques",
        "date": "2023-11-20",
        "content": "La Cour d'appel d'Alger confirme les peines pour corruption, pots-de-vin et abus de biens sociaux dans les dossiers de financement et transferts de capitaux impliquant Kamel Haddad et consorts.",
    },
    {
        "title": "Suspicion de blanchiment d'argent et fausses factures dans le secteur du négoce",
        "source": "Journal Officiel des Annonces Légales (JORADP)",
        "date": "2024-06-02",
        "content": "Avis de mise en faillite et liquidation judiciaire prononcée par le tribunal de commerce à l'encontre d'entités créées sans activité réelle avec émission répétée de chèque sans provision et cessation de paiement.",
    },
    {
        "title": "Mokhtar Belmokhtar visé par un décret de gel de biens et avoirs financiers",
        "source": "Cellule de Traitement du Renseignement Financier (CTRF)",
        "date": "2023-01-18",
        "content": "La Commission nationale a ordonné le gel immédiat de tous les comptes bancaires et avoirs immobiliers attribués à Mokhtar Belmokhtar et ses réseaux logistiques affiliés pour financement du terrorisme.",
    },
]


# =============================================================================
# SANCTIONS SCREENING ENGINE CLASS
# =============================================================================

class SanctionsScreeningEngine:
    """
    Central sovereign AML/CFT sanctions screening & adverse media inspection engine.
    """

    def __init__(self):
        self.matcher = AlgerianPhoneticMatcher()

    def screen_entity(self, request: SanctionsScreeningRequest) -> SanctionsScreeningResponse:
        """
        Execute full screening pipeline:
        1. Sanctions registry fuzzy matching against UN, OFAC, EU, and Algerian National Freeze lists
        2. PEP identification under Algerian Law 05-01 / Law 23-01
        3. Adverse media investigation
        4. Calculation of composite risk score and legal directives
        """
        screening_id = str(uuid.uuid4())
        query_name = request.entityName
        names_to_test = [query_name] + [a for a in request.aliases if a]

        sanctions_hits: List[SanctionHit] = []
        algerian_freeze_hit = False

        # 1. Screen against Sanctions Registry
        for record in SANCTIONS_REGISTRY:
            regime = record["regime"]
            target_name = record["entityName"]
            target_aliases = record.get("aliases", [])
            all_target_variants = [target_name] + target_aliases

            highest_hit_score = 0.0
            best_target_match = target_name
            best_query_match = query_name

            for q in names_to_test:
                for tgt in all_target_variants:
                    match_detail = self.matcher.match_names(q, tgt)
                    if match_detail.compositeScore > highest_hit_score:
                        highest_hit_score = match_detail.compositeScore
                        best_target_match = tgt
                        best_query_match = q

            # Evaluation threshold: 0.70 fuzzy threshold
            if highest_hit_score >= 0.70:
                if highest_hit_score >= 0.90:
                    confidence = "EXACT_OR_EQUIVALENT"
                elif highest_hit_score >= 0.80:
                    confidence = "HIGH_CONFIDENCE"
                else:
                    confidence = "FUZZY_POSSIBLE"

                hit = SanctionHit(
                    regime=regime,
                    listReferenceId=record["listReferenceId"],
                    matchedEntityName=best_target_match,
                    queryName=best_query_match,
                    matchScore=highest_hit_score,
                    matchConfidence=confidence,
                    designationDate=record.get("designationDate"),
                    legalBasis=record.get("legalBasis"),
                    programs=record.get("programs", []),
                    countryOfOrigin=record.get("country"),
                )
                sanctions_hits.append(hit)

                if regime == SanctionRegime.ALGERIA_CTRF_NATIONAL and highest_hit_score >= 0.78:
                    algerian_freeze_hit = True

        # 2. PEP Assessment
        pep_assessment = self.check_pep_status(query_name, request.nationalId)

        # 3. Adverse Media Scan
        adverse_articles: List[AdverseMediaArticle] = []
        if request.includeAdverseMedia:
            media_scan = self.scan_adverse_media(AdverseMediaScanRequest(entityName=query_name))
            adverse_articles = media_scan.articlesFlagged

        # 4. Composite Risk Score Calculation [0, 100]
        # Base weights:
        # Sanctions: max 60 pts
        # PEP: max 25 pts
        # Adverse Media: max 15 pts
        sanctions_pts = 0.0
        if sanctions_hits:
            top_score = max(h.matchScore for h in sanctions_hits)
            if algerian_freeze_hit or top_score >= 0.85:
                sanctions_pts = 60.0
            else:
                sanctions_pts = 35.0 * (top_score / 0.85)

        pep_pts = 0.0
        if pep_assessment.isPep:
            if pep_assessment.riskTier == PEPRiskTier.CRITICAL:
                pep_pts = 25.0
            elif pep_assessment.riskTier == PEPRiskTier.HIGH:
                pep_pts = 20.0
            elif pep_assessment.riskTier == PEPRiskTier.MEDIUM:
                pep_pts = 12.0
            else:
                pep_pts = 5.0

        media_pts = 0.0
        if adverse_articles:
            max_sev = max(a.severity for a in adverse_articles)
            if max_sev == AdverseMediaSeverity.CRITICAL:
                media_pts = 15.0
            elif max_sev == AdverseMediaSeverity.HIGH:
                media_pts = 10.0
            elif max_sev == AdverseMediaSeverity.MEDIUM:
                media_pts = 5.0
            else:
                media_pts = 2.0

        composite_risk = min(100.0, round(sanctions_pts + pep_pts + media_pts, 2))

        # Overall Risk Level & Actions
        if algerian_freeze_hit or any(h.matchScore >= 0.88 for h in sanctions_hits):
            risk_level = SanctionRiskLevel.CONFIRMED_SANCTION
            mandatory_reporting = True
            rec_action = "BLOCK_IMMEDIATE_CTRF_FREEZE"
        elif composite_risk >= 50.0 or sanctions_hits or (pep_assessment.isPep and pep_assessment.riskTier in [PEPRiskTier.HIGH, PEPRiskTier.CRITICAL]):
            risk_level = SanctionRiskLevel.POTENTIAL_MATCH
            mandatory_reporting = pep_assessment.enhancedDueDiligenceMandatory
            rec_action = "ENHANCED_DUE_DILIGENCE_REQUIRED"
        elif composite_risk >= 20.0 or pep_assessment.isPep or adverse_articles:
            risk_level = SanctionRiskLevel.LOW_SUSPICION
            mandatory_reporting = False
            rec_action = "COMPLIANCE_CLEARANCE_STANDARD"
        else:
            risk_level = SanctionRiskLevel.CLEAN
            mandatory_reporting = False
            rec_action = "CLEAR_NO_IMPEDIMENTS"

        return SanctionsScreeningResponse(
            screeningId=screening_id,
            entityQueried=self.matcher.normalize_name(query_name),
            riskLevel=risk_level,
            compositeRiskScore=composite_risk,
            sanctionsHits=sanctions_hits,
            pepAssessment=pep_assessment,
            adverseMediaSummary=adverse_articles,
            algerianFreezeListHit=algerian_freeze_hit,
            mandatoryReportingRequired=mandatory_reporting,
            recommendedAction=rec_action,
            timestamp=datetime.utcnow().isoformat() + "Z",
        )

    def fuzzy_match(self, query: str, target: str) -> FuzzyMatchResponse:
        """Evaluate name similarity between two strings."""
        details = self.matcher.match_names(query, target)
        is_match = details.compositeScore >= 0.75 or (details.phoneticMatch and details.compositeScore >= 0.65)
        return FuzzyMatchResponse(
            queryNormalized=self.matcher.normalize_name(query),
            targetNormalized=self.matcher.normalize_name(target),
            matchDetails=details,
            isMatch=is_match,
        )

    def check_pep_status(self, candidate_name: str, national_id: Optional[str] = None) -> PEPHit:
        """
        Cross-check candidate against known PEP rosters and Algerian statutory roles
        under Law 05-01 / Law 23-01.
        """
        cand_norm = self.matcher.normalize_name(candidate_name)

        # 1. Match against known repository
        best_hit = None
        highest_score = 0.0

        for pep in KNOWN_PEP_REPOSITORIES:
            all_names = [pep["name"]] + pep.get("aliases", [])
            for n in all_names:
                match_res = self.matcher.match_names(candidate_name, n)
                if match_res.compositeScore > highest_score:
                    highest_score = match_res.compositeScore
                    best_hit = pep

        if highest_score >= 0.80 and best_hit:
            return PEPHit(
                isPep=True,
                pepType=best_hit["type"],
                pepRoleTitle=best_hit["role"],
                institutionName=best_hit["institution"],
                riskTier=best_hit["riskTier"],
                isCurrentlyInOffice=best_hit["currentlyInOffice"],
                exitYear=best_hit.get("exitYear"),
                enhancedDueDiligenceMandatory=best_hit["eddMandatory"],
                statutoryLegalCitation="Loi n° 05-01 modifiée et complétée par la Loi n° 23-01 relative à la prévention et à la lutte contre le blanchiment d'argent (Art. 2 & 8)",
            )

        # 2. Check if name contains or directly claims statutory title
        for title in STATUTORY_PEP_TITLES:
            if title in cand_norm:
                return PEPHit(
                    isPep=True,
                    pepType=PEPType.NATIONAL_PEP,
                    pepRoleTitle=title.title(),
                    institutionName="Algerian State Organ / Public Enterprise",
                    riskTier=PEPRiskTier.HIGH,
                    isCurrentlyInOffice=True,
                    enhancedDueDiligenceMandatory=True,
                    statutoryLegalCitation="Loi n° 05-01 Art. 2 (Mandat public national)",
                )

        return PEPHit(
            isPep=False,
            pepType=PEPType.NOT_PEP,
            pepRoleTitle=None,
            institutionName=None,
            riskTier=PEPRiskTier.LOW,
            isCurrentlyInOffice=False,
            enhancedDueDiligenceMandatory=False,
            statutoryLegalCitation="Loi n° 05-01 / 23-01 (Aucune fonction PEP détectée)",
        )

    def scan_adverse_media(self, request: AdverseMediaScanRequest) -> AdverseMediaScanResponse:
        """
        Scan news articles and legal publications for adverse criminal / civil findings.
        """
        entity_name = request.entityName
        entity_norm = self.matcher.normalize_name(entity_name)
        corpus = request.customCorpus if request.customCorpus is not None else DEFAULT_MEDIA_ARCHIVES

        flagged_articles: List[AdverseMediaArticle] = []
        max_severity = AdverseMediaSeverity.CLEAN

        for doc in corpus:
            content = doc.get("content", "") + " " + doc.get("title", "")
            content_norm = self.matcher.strip_accents(content.lower())

            # Check if entity is mentioned (fuzzy name or tokens)
            entity_tokens = [t for t in entity_norm.split() if len(t) > 2]
            name_mentioned = False

            if entity_norm in content_norm:
                name_mentioned = True
            elif entity_tokens and all(t in content_norm for t in entity_tokens):
                name_mentioned = True
            else:
                # Token overlap check
                overlap_count = sum(1 for t in entity_tokens if t in content_norm)
                if len(entity_tokens) >= 2 and overlap_count >= len(entity_tokens) - 1:
                    name_mentioned = True

            if not name_mentioned:
                continue

            # Check for adverse keywords
            for category, regex_list in ADVERSE_CRIME_PATTERNS.items():
                matched_kw: List[str] = []
                for pattern in regex_list:
                    found = re.findall(pattern, content_norm)
                    if found:
                        matched_kw.extend(found)

                if matched_kw:
                    # Determine severity
                    if category in [
                        AdverseMediaCategory.MONEY_LAUNDERING_FINANCIAL_CRIME,
                        AdverseMediaCategory.BRIBERY_PUBLIC_CORRUPTION,
                    ]:
                        severity = AdverseMediaSeverity.CRITICAL
                    elif category in [
                        AdverseMediaCategory.TAX_EVASION_CUSTOMS_FRAUD,
                        AdverseMediaCategory.ILLEGAL_CAPITAL_FLIGHT,
                    ]:
                        severity = AdverseMediaSeverity.HIGH
                    else:
                        severity = AdverseMediaSeverity.MEDIUM

                    # Sentiment polarity
                    sentiment = -0.75 if severity == AdverseMediaSeverity.CRITICAL else -0.50

                    snippet = content[:300] + ("..." if len(content) > 300 else "")

                    article = AdverseMediaArticle(
                        title=doc.get("title", "Adverse Report"),
                        source=doc.get("source", "Legal Publication"),
                        publicationDate=doc.get("date"),
                        category=category,
                        severity=severity,
                        snippet=snippet,
                        sentimentScore=sentiment,
                        keywordsMatched=list(set(matched_kw)),
                    )
                    flagged_articles.append(article)

        if flagged_articles:
            if any(a.severity == AdverseMediaSeverity.CRITICAL for a in flagged_articles):
                max_severity = AdverseMediaSeverity.CRITICAL
            elif any(a.severity == AdverseMediaSeverity.HIGH for a in flagged_articles):
                max_severity = AdverseMediaSeverity.HIGH
            elif any(a.severity == AdverseMediaSeverity.MEDIUM for a in flagged_articles):
                max_severity = AdverseMediaSeverity.MEDIUM
            else:
                max_severity = AdverseMediaSeverity.LOW
            summary = f"Detected {len(flagged_articles)} adverse media record(s) involving severe financial, tax, or court proceedings."
        else:
            max_severity = AdverseMediaSeverity.CLEAN
            summary = "No adverse media or financial crime records found across scanned Algerian registries and corporate press."

        return AdverseMediaScanResponse(
            entityName=entity_name,
            overallSeverity=max_severity,
            articlesFlagged=flagged_articles,
            totalArticlesAnalyzed=len(corpus),
            riskSummary=summary,
        )


sanctions_screening_engine = SanctionsScreeningEngine()
