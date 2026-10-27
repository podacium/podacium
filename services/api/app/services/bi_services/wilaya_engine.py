"""
Algerian 58-Wilaya Hierarchical Cascading Engine.
Provides complete canonical reference data and query acceleration for Algerian administrative geography:
- 58 Wilayas with O.N.S. codes (01 to 58)
- French and Arabic designations
- 4 Macro-Economic Regions: CENTRE, OUEST, EST, SUD
- ARPCE 4G Telco coverage index (Tier 1 Very High/High to Tier 4 Remote)
- Direct creation of dim_wilayas.parquet for dimensional star-schema joins
"""

import logging
import os
import re
from typing import Any, Dict, List, Optional, Union
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)


class WilayaRecord(BaseModel):
    code: str = Field(..., description="Two-digit O.N.S. code e.g. '16'")
    code_int: int = Field(..., description="Numeric wilaya code e.g. 16")
    name_fr: str = Field(..., description="Wilaya name in French")
    name_ar: str = Field(..., description="Wilaya name in Arabic")
    region: str = Field(..., description="Macro-region: CENTRE, OUEST, EST, SUD")
    telco_4g_tier: int = Field(..., description="ARPCE 4G tier (1: Highest, 4: Remote)")
    economic_hub: str = Field(..., description="Economic profile/specialization")


# Canonical Master Registry of all 58 Algerian Wilayas (Law 19-12)
WILAYA_MASTER_REGISTRY: List[Dict[str, Any]] = [
    {
        "code": "01",
        "name_fr": "Adrar",
        "name_ar": "أدرار",
        "region": "SUD",
        "telco_4g_tier": 3,
        "economic_hub": "Oasis & Cross-Border Logistics",
    },
    {
        "code": "02",
        "name_fr": "Chlef",
        "name_ar": "الشلف",
        "region": "OUEST",
        "telco_4g_tier": 2,
        "economic_hub": "Agri-food & Transport Corridor",
    },
    {
        "code": "03",
        "name_fr": "Laghouat",
        "name_ar": "الأغواط",
        "region": "SUD",
        "telco_4g_tier": 2,
        "economic_hub": "Hassi R'Mel Energy & Steppe",
    },
    {
        "code": "04",
        "name_fr": "Oum El Bouaghi",
        "name_ar": "أم البواقي",
        "region": "EST",
        "telco_4g_tier": 2,
        "economic_hub": "Livestock & Cereal Plains",
    },
    {
        "code": "05",
        "name_fr": "Batna",
        "name_ar": "باتنة",
        "region": "EST",
        "telco_4g_tier": 2,
        "economic_hub": "Aurès Capital & Industry",
    },
    {
        "code": "06",
        "name_fr": "Béjaïa",
        "name_ar": "بجاية",
        "region": "CENTRE",
        "telco_4g_tier": 1,
        "economic_hub": "Port Logistics & Agri-Food",
    },
    {
        "code": "07",
        "name_fr": "Biskra",
        "name_ar": "بسكرة",
        "region": "SUD",
        "telco_4g_tier": 2,
        "economic_hub": "Dates Farming & Wholesale Gateway",
    },
    {
        "code": "08",
        "name_fr": "Béchar",
        "name_ar": "بشار",
        "region": "SUD",
        "telco_4g_tier": 3,
        "economic_hub": "Saoura Regional Capital",
    },
    {
        "code": "09",
        "name_fr": "Blida",
        "name_ar": "البليدة",
        "region": "CENTRE",
        "telco_4g_tier": 1,
        "economic_hub": "Mitidja Industry & Logistics",
    },
    {
        "code": "10",
        "name_fr": "Bouira",
        "name_ar": "البويرة",
        "region": "CENTRE",
        "telco_4g_tier": 2,
        "economic_hub": "Djurdjura Transit Axis",
    },
    {
        "code": "11",
        "name_fr": "Tamanrasset",
        "name_ar": "تمنراست",
        "region": "SUD",
        "telco_4g_tier": 4,
        "economic_hub": "Hoggar Deep South Gateway",
    },
    {
        "code": "12",
        "name_fr": "Tébessa",
        "name_ar": "تبسة",
        "region": "EST",
        "telco_4g_tier": 3,
        "economic_hub": "Mining & Border Commerce",
    },
    {
        "code": "13",
        "name_fr": "Tlemcen",
        "name_ar": "تلمسان",
        "region": "OUEST",
        "telco_4g_tier": 1,
        "economic_hub": "Western Cultural & Trade Hub",
    },
    {
        "code": "14",
        "name_fr": "Tiaret",
        "name_ar": "تيارت",
        "region": "OUEST",
        "telco_4g_tier": 2,
        "economic_hub": "Cereal Plateaus & Livestock",
    },
    {
        "code": "15",
        "name_fr": "Tizi Ouzou",
        "name_ar": "تيزي وزو",
        "region": "CENTRE",
        "telco_4g_tier": 1,
        "economic_hub": "Kabylie Tech & Diaspora Remittance",
    },
    {
        "code": "16",
        "name_fr": "Alger",
        "name_ar": "الجزائر",
        "region": "CENTRE",
        "telco_4g_tier": 1,
        "economic_hub": "National Capital & Finance Hub",
    },
    {
        "code": "17",
        "name_fr": "Djelfa",
        "name_ar": "الجلفة",
        "region": "SUD",
        "telco_4g_tier": 2,
        "economic_hub": "National Livestock Capital",
    },
    {
        "code": "18",
        "name_fr": "Jijel",
        "name_ar": "جيجل",
        "region": "EST",
        "telco_4g_tier": 2,
        "economic_hub": "Djen-Djen Port & Timber",
    },
    {
        "code": "19",
        "name_fr": "Sétif",
        "name_ar": "سطيف",
        "region": "EST",
        "telco_4g_tier": 1,
        "economic_hub": "El Eulma Wholesale Epicenter",
    },
    {
        "code": "20",
        "name_fr": "Saïda",
        "name_ar": "سعيدة",
        "region": "OUEST",
        "telco_4g_tier": 3,
        "economic_hub": "Mineral Water & Wheat",
    },
    {
        "code": "21",
        "name_fr": "Skikda",
        "name_ar": "سكيكدة",
        "region": "EST",
        "telco_4g_tier": 1,
        "economic_hub": "Petrochemicals & Gas Port",
    },
    {
        "code": "22",
        "name_fr": "Sidi Bel Abbès",
        "name_ar": "سيدي بلعباس",
        "region": "OUEST",
        "telco_4g_tier": 1,
        "economic_hub": "Electronics & Western Agriculture",
    },
    {
        "code": "23",
        "name_fr": "Annaba",
        "name_ar": "عنابة",
        "region": "EST",
        "telco_4g_tier": 1,
        "economic_hub": "El Hadjar Steel & Port",
    },
    {
        "code": "24",
        "name_fr": "Guelma",
        "name_ar": "قالمة",
        "region": "EST",
        "telco_4g_tier": 2,
        "economic_hub": "Agri-Canning & Thermal Springs",
    },
    {
        "code": "25",
        "name_fr": "Constantine",
        "name_ar": "قسنطينة",
        "region": "EST",
        "telco_4g_tier": 1,
        "economic_hub": "Eastern Metropolis & Pharma",
    },
    {
        "code": "26",
        "name_fr": "Médéa",
        "name_ar": "المدية",
        "region": "CENTRE",
        "telco_4g_tier": 2,
        "economic_hub": "Titteri Orchards & Pharma",
    },
    {
        "code": "27",
        "name_fr": "Mostaganem",
        "name_ar": "مستغانم",
        "region": "OUEST",
        "telco_4g_tier": 2,
        "economic_hub": "Maritime Commerce & Agriculture",
    },
    {
        "code": "28",
        "name_fr": "M'Sila",
        "name_ar": "المسيلة",
        "region": "CENTRE",
        "telco_4g_tier": 2,
        "economic_hub": "Hodna Basin & Construction",
    },
    {
        "code": "29",
        "name_fr": "Mascara",
        "name_ar": "معسكر",
        "region": "OUEST",
        "telco_4g_tier": 2,
        "economic_hub": "Ghriss Plain Agriculture",
    },
    {
        "code": "30",
        "name_fr": "Ouargla",
        "name_ar": "ورقلة",
        "region": "SUD",
        "telco_4g_tier": 2,
        "economic_hub": "Hassi Messaoud Hydrocarbons",
    },
    {
        "code": "31",
        "name_fr": "Oran",
        "name_ar": "وهران",
        "region": "OUEST",
        "telco_4g_tier": 1,
        "economic_hub": "Western Economic Metropolis",
    },
    {
        "code": "32",
        "name_fr": "El Bayadh",
        "name_ar": "البيض",
        "region": "SUD",
        "telco_4g_tier": 3,
        "economic_hub": "High Steppe Pastoralism",
    },
    {
        "code": "33",
        "name_fr": "Illizi",
        "name_ar": "إليزي",
        "region": "SUD",
        "telco_4g_tier": 4,
        "economic_hub": "Tassili Hydrocarbons",
    },
    {
        "code": "34",
        "name_fr": "Bordj Bou Arréridj",
        "name_ar": "برج بوعريريج",
        "region": "EST",
        "telco_4g_tier": 1,
        "economic_hub": "National Electronics Capital",
    },
    {
        "code": "35",
        "name_fr": "Boumerdès",
        "name_ar": "بومرداس",
        "region": "CENTRE",
        "telco_4g_tier": 1,
        "economic_hub": "Coastal Tech & Energy Faculties",
    },
    {
        "code": "36",
        "name_fr": "El Tarf",
        "name_ar": "الطارف",
        "region": "EST",
        "telco_4g_tier": 2,
        "economic_hub": "Eastern Eco-Park & Fishing",
    },
    {
        "code": "37",
        "name_fr": "Tindouf",
        "name_ar": "تندوف",
        "region": "SUD",
        "telco_4g_tier": 4,
        "economic_hub": "Gara Djebilet Iron Mining",
    },
    {
        "code": "38",
        "name_fr": "Tissemsilt",
        "name_ar": "تيسمسيلت",
        "region": "OUEST",
        "telco_4g_tier": 3,
        "economic_hub": "Ouarsenis Massif Agriculture",
    },
    {
        "code": "39",
        "name_fr": "El Oued",
        "name_ar": "الوادي",
        "region": "SUD",
        "telco_4g_tier": 2,
        "economic_hub": "Souf Desert Agriculture & Dates",
    },
    {
        "code": "40",
        "name_fr": "Khenchela",
        "name_ar": "خنشلة",
        "region": "EST",
        "telco_4g_tier": 3,
        "economic_hub": "Aurès Timber & Cereals",
    },
    {
        "code": "41",
        "name_fr": "Souk Ahras",
        "name_ar": "سوق أهراس",
        "region": "EST",
        "telco_4g_tier": 3,
        "economic_hub": "Dairy Belt & Eastern Border",
    },
    {
        "code": "42",
        "name_fr": "Tipaza",
        "name_ar": "تيبازة",
        "region": "CENTRE",
        "telco_4g_tier": 1,
        "economic_hub": "Maritime Port & Agriculture",
    },
    {
        "code": "43",
        "name_fr": "Mila",
        "name_ar": "ميلة",
        "region": "EST",
        "telco_4g_tier": 2,
        "economic_hub": "Beni Haroun Reservoir & Wheat",
    },
    {
        "code": "44",
        "name_fr": "Aïn Defla",
        "name_ar": "عين الدفلى",
        "region": "CENTRE",
        "telco_4g_tier": 2,
        "economic_hub": "National Vegetable Breadbasket",
    },
    {
        "code": "45",
        "name_fr": "Naâma",
        "name_ar": "النعامة",
        "region": "SUD",
        "telco_4g_tier": 3,
        "economic_hub": "Western Steppe Pastoralism",
    },
    {
        "code": "46",
        "name_fr": "Aïn Témouchent",
        "name_ar": "عين تموشنت",
        "region": "OUEST",
        "telco_4g_tier": 1,
        "economic_hub": "Coastal Agriculture & Fishing",
    },
    {
        "code": "47",
        "name_fr": "Ghardaïa",
        "name_ar": "غرداية",
        "region": "SUD",
        "telco_4g_tier": 2,
        "economic_hub": "M'zab Merchant & Textile Hub",
    },
    {
        "code": "48",
        "name_fr": "Relizane",
        "name_ar": "غليزان",
        "region": "OUEST",
        "telco_4g_tier": 2,
        "economic_hub": "Mina Plain Textile Crossroads",
    },
    {
        "code": "49",
        "name_fr": "El M'Ghair",
        "name_ar": "المغير",
        "region": "SUD",
        "telco_4g_tier": 3,
        "economic_hub": "Chott Melrhir Salt & Dates",
    },
    {
        "code": "50",
        "name_fr": "El Meniaa",
        "name_ar": "المنيعة",
        "region": "SUD",
        "telco_4g_tier": 3,
        "economic_hub": "Pivot Irrigation Agriculture",
    },
    {
        "code": "51",
        "name_fr": "Ouled Djellal",
        "name_ar": "أولاد جلال",
        "region": "SUD",
        "telco_4g_tier": 3,
        "economic_hub": "Purebred Sheep & Deglet Nour",
    },
    {
        "code": "52",
        "name_fr": "Bordj Baji Mokhtar",
        "name_ar": "برج باجي مختار",
        "region": "SUD",
        "telco_4g_tier": 4,
        "economic_hub": "Southwest Border Transit",
    },
    {
        "code": "53",
        "name_fr": "Béni Abbès",
        "name_ar": "بني عباس",
        "region": "SUD",
        "telco_4g_tier": 4,
        "economic_hub": "Grand Erg Oasis & Tourism",
    },
    {
        "code": "54",
        "name_fr": "Timimoun",
        "name_ar": "تيميمون",
        "region": "SUD",
        "telco_4g_tier": 4,
        "economic_hub": "Gourara Oasis Agriculture",
    },
    {
        "code": "55",
        "name_fr": "Touggourt",
        "name_ar": "تقرت",
        "region": "SUD",
        "telco_4g_tier": 2,
        "economic_hub": "Oued Righ Dates & Hydrocarbons",
    },
    {
        "code": "56",
        "name_fr": "Djanet",
        "name_ar": "جانت",
        "region": "SUD",
        "telco_4g_tier": 4,
        "economic_hub": "Tassili Tourism & Southeast Transit",
    },
    {
        "code": "57",
        "name_fr": "In Salah",
        "name_ar": "عين صالح",
        "region": "SUD",
        "telco_4g_tier": 4,
        "economic_hub": "Tidikelt Gas & Trans-Saharan Axis",
    },
    {
        "code": "58",
        "name_fr": "In Guezzam",
        "name_ar": "عين قزام",
        "region": "SUD",
        "telco_4g_tier": 4,
        "economic_hub": "Southern Border Commercial Transit",
    },
]


class WilayaEngine:
    """
    Service for querying and resolving 58-Wilaya administrative dimensions.
    """

    _BY_CODE: Dict[str, WilayaRecord] = {}
    _BY_INT: Dict[int, WilayaRecord] = {}
    _LOOKUP: Dict[str, int] = {}

    @classmethod
    def _initialize_indices(cls):
        if cls._BY_CODE:
            return
        for item in WILAYA_MASTER_REGISTRY:
            code_str = item["code"]
            code_i = int(code_str)
            rec = WilayaRecord(
                code=code_str,
                code_int=code_i,
                name_fr=item["name_fr"],
                name_ar=item["name_ar"],
                region=item["region"],
                telco_4g_tier=item["telco_4g_tier"],
                economic_hub=item["economic_hub"],
            )
            cls._BY_CODE[code_str] = rec
            cls._BY_INT[code_i] = rec
            cls._LOOKUP[code_str] = code_i
            cls._LOOKUP[str(code_i)] = code_i
            cls._LOOKUP[item["name_fr"].lower()] = code_i
            cls._LOOKUP[item["name_ar"]] = code_i

    @classmethod
    def get_all_wilayas(cls) -> List[WilayaRecord]:
        """Returns all 58 Wilaya definitions."""
        cls._initialize_indices()
        return list(cls._BY_CODE.values())

    @classmethod
    def get_wilaya(cls, code: Union[int, str]) -> Optional[WilayaRecord]:
        """Lookup by two-digit code string or integer."""
        cls._initialize_indices()
        if isinstance(code, int):
            return cls._BY_INT.get(code)
        s = str(code).strip().zfill(2)
        return cls._BY_CODE.get(s)

    @classmethod
    def get_wilayas_by_region(cls, region: str) -> List[WilayaRecord]:
        """Filter wilayas by macro-region (CENTRE, OUEST, EST, SUD)."""
        cls._initialize_indices()
        reg = region.strip().upper()
        return [w for w in cls._BY_CODE.values() if w.region == reg]

    @classmethod
    def resolve_from_text(cls, text: str) -> Optional[WilayaRecord]:
        """Extract wilaya from text in Arabic, French, or numeric code."""
        cls._initialize_indices()
        if not text:
            return None

        clean = text.strip()
        # Direct check
        for key, code_int in cls._LOOKUP.items():
            if re.search(rf"\b{re.escape(key)}\b", clean, re.IGNORECASE):
                return cls._BY_INT.get(code_int)
        return None

    @classmethod
    def export_dim_wilayas_parquet(cls, output_path: str) -> str:
        """
        Generate pre-indexed dim_wilayas.parquet for columnar joins in DuckDB.
        """
        import pandas as pd

        cls._initialize_indices()
        records = [w.model_dump() for w in cls.get_all_wilayas()]
        df = pd.DataFrame(records)
        os.makedirs(os.path.dirname(output_path), exist_ok=True)
        df.to_parquet(output_path, index=False)
        return output_path
