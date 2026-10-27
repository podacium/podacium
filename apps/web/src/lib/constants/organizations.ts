export const COUNTRY_CITY_MAP: Record<string, string[]> = {
    ALGERIA: [
        'ADRAR', 'CHLEF', 'LAGHOUAT', 'OUM_EL_BOUAGHI', 'BATNA',
        'BEJAIA', 'BISKRA', 'BECHAR', 'BLIDA', 'BOUIRA',
        'TAMANRASSET', 'TEBESSA', 'TLEMCEN', 'TIARET', 'TIZI_OUZOU',
        'ALGIERS', 'DJELFA', 'JIJEL', 'SETIF', 'SAIDA',
        'SKIKDA', 'SIDI_BEL_ABBES', 'ANNABA', 'GUELMA', 'CONSTANTINE',
        'MEDEA', 'MOSTAGANEM', 'MSILA', 'MASCARA', 'OUARGLA',
        'ORAN', 'EL_BAYADH', 'ILLIZI', 'BORDJ_BOU_ARRERIDJ', 'BOUMERDES',
        'EL_TARF', 'TINDOUF', 'TISSEMSILT', 'EL_OUED', 'KHENCHELA',
        'SOUK_AHRAS', 'TIPAZA', 'MILA', 'AIN_DEFLA', 'NAAMA',
        'AIN_TEMOUCHENT', 'GHARDAIA', 'RELIZANE', 'TIMIMOUN', 'BORDJ_BADJI_MOKHTAR',
        'OULED_DJELLAL', 'BENI_ABBES', 'IN_SALAH', 'IN_GUEZZAM', 'TOUGGOURT',
        'DJANET', 'EL_MGHAIR', 'EL_MENIAA', 'AFLOU', 'BARIKA',
        'EL_KANTARA', 'BIR_EL_ATER', 'EL_ARICHA', 'KSAR_CHELLALA', 'AIN_OUSSERA',
        'MESSAAD', 'KSAR_EL_BOUKHARI', 'BOU_SAADA', 'EL_ABIODH_SIDI_CHEIKH'
    ],
    EGYPT: ['CAIRO', 'ALEXANDRIA', 'GIZA', 'PORT_SAID', 'SUEZ'],
    MOROCCO: ['CASABLANCA', 'RABAT', 'MARRAKESH', 'TANGIER', 'FES'],
    TUNISIA: ['TUNIS', 'SFAX', 'SOUSSE', 'ETTADHAMEN', 'KAIROUAN'],
    LIBYA: ['TRIPOLI', 'BENGHAZI', 'MISRATA', 'SIRTE', 'SABHA']
};

export const SECTORS = [
    'TECHNOLOGY_AND_SOFTWARE',
    'BANKING_AND_FINANCIAL_SERVICES',
    'HEALTHCARE_AND_PHARMACEUTICALS',
    'ENERGY_AND_OIL_AND_GAS',
    'AUTOMOTIVE_AND_MANUFACTURING',
    'RETAIL_AND_CONSUMER_GOODS',
    'TELECOMMUNICATIONS',
    'AEROSPACE_AND_DEFENSE',
    'AGRICULTURE_AND_FOOD_PRODUCTION',
    'TRANSPORTATION_AND_LOGISTICS',
    'EDUCATION_AND_EDTECH',
    'CONSTRUCTION_AND_REAL_ESTATE',
    'CONSULTING_AND_PROFESSIONAL_SERVICES',
    'MEDIA_AND_CREATIVE_INDUSTRIES',
    'TOURISM_AND_HOSPITALITY',
    'PUBLIC_SECTOR_AND_ADMINISTRATION',
    'RENEWABLE_ENERGY_AND_CLEANTECH',
    'MINING_AND_METALLURGY',
    'TEXTILES_AND_APPAREL',
    'NON_PROFIT_AND_NGO',
    'OTHER'
];

export function getEnumLabel(key: string, value: string, t: (key: string) => string): string {
    if (!value) return '—';
    const lowerKey = key.toLowerCase();

    const candidateKeys = [
        `bi.organizations.enums.${lowerKey}.${value}`,
        lowerKey === 'sector' ? `organizations.directory.sectors.${value}` : '',
        lowerKey === 'sector' ? `directory.sectors.${value}` : '',
        lowerKey === 'city' ? `profile.geo.cities.${value}` : '',
        lowerKey === 'city' ? `geo.cities.${value}` : '',
        lowerKey === 'country' ? `profile.geo.countries.${value}` : '',
        lowerKey === 'country' ? `geo.countries.${value}` : '',
    ].filter(Boolean);

    for (const candidate of candidateKeys) {
        const translated = t(candidate);
        if (translated && translated !== candidate) {
            return translated;
        }
    }

    if (!value.includes('_') && value !== value.toUpperCase()) {
        return value;
    }

    return value.split('_').map(word =>
        word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
    ).join(' ');
}

