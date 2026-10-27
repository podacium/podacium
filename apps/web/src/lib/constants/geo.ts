/**
 * Geographic constants derived from Prisma schema enums.
 * Used for country/city dropdown selects with i18n.
 */

/** All Country enum keys */
export const COUNTRIES = [
    'ALGERIA',
    'EGYPT',
    'MOROCCO',
    'TUNISIA',
    'LIBYA',
] as const;

export type CountryKey = (typeof COUNTRIES)[number];

/** Cities mapped to their parent country */
export const COUNTRY_CITIES: Record<CountryKey, readonly string[]> = {
    ALGERIA: [
        'ADRAR',
        'CHLEF',
        'LAGHOUAT',
        'OUM_EL_BOUAGHI',
        'BATNA',
        'BEJAIA',
        'BISKRA',
        'BECHAR',
        'BLIDA',
        'BOUIRA',
        'TAMANRASSET',
        'TEBESSA',
        'TLEMCEN',
        'TIARET',
        'TIZI_OUZOU',
        'ALGIERS',
        'DJELFA',
        'JIJEL',
        'SETIF',
        'SAIDA',
        'SKIKDA',
        'SIDI_BEL_ABBES',
        'ANNABA',
        'GUELMA',
        'CONSTANTINE',
        'MEDEA',
        'MOSTAGANEM',
        'MSILA',
        'MASCARA',
        'OUARGLA',
        'ORAN',
        'EL_BAYADH',
        'ILLIZI',
        'BORDJ_BOU_ARRERIDJ',
        'BOUMERDES',
        'EL_TARF',
        'TINDOUF',
        'TISSEMSILT',
        'EL_OUED',
        'KHENCHELA',
        'SOUK_AHRAS',
        'TIPAZA',
        'MILA',
        'AIN_DEFLA',
        'NAAMA',
        'AIN_TEMOUCHENT',
        'GHARDAIA',
        'RELIZANE',
        'TIMIMOUN',
        'BORDJ_BADJI_MOKHTAR',
        'OULED_DJELLAL',
        'BENI_ABBES',
        'IN_SALAH',
        'IN_GUEZZAM',
        'TOUGGOURT',
        'DJANET',
        'EL_MGHAIR',
        'EL_MENIAA',
        'AFLOU',
        'BARIKA',
        'EL_KANTARA',
        'BIR_EL_ATER',
        'EL_ARICHA',
        'KSAR_CHELLALA',
        'AIN_OUSSERA',
        'MESSAAD',
        'KSAR_EL_BOUKHARI',
        'BOU_SAADA',
        'EL_ABIODH_SIDI_CHEIKH',
    ],
    EGYPT: [
        'CAIRO',
        'ALEXANDRIA',
        'GIZA',
        'PORT_SAID',
        'SUEZ',
    ],
    MOROCCO: [
        'CASABLANCA',
        'RABAT',
        'MARRAKESH',
        'TANGIER',
        'FES',
    ],
    TUNISIA: [
        'TUNIS',
        'SFAX',
        'SOUSSE',
        'ETTADHAMEN',
        'KAIROUAN',
    ],
    LIBYA: [
        'TRIPOLI',
        'BENGHAZI',
        'MISRATA',
        'SIRTE',
        'SABHA',
    ],
} as const;

/** All City enum keys (flat list) */
export const ALL_CITIES = Object.values(COUNTRY_CITIES).flat();

/** Reverse lookup: city key → country key */
export const CITY_TO_COUNTRY: Record<string, CountryKey> = {};
for (const [country, cities] of Object.entries(COUNTRY_CITIES)) {
    for (const city of cities) {
        CITY_TO_COUNTRY[city] = country as CountryKey;
    }
}
