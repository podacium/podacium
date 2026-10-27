/**
 * Official 69 Algerian Wilayas Master Dataset and Geographic Mapping.
 * Executive Order 19-336 / Law 19-12 & Law 26-06 / Presidential Decree 26-206
 * administrative territorial reorganization (Wilayas 01 through 69).
 */

export interface AlgerianWilaya {
  code: string;
  nameFr: string;
  nameAr: string;
  nameEn: string;
  nameKab: string;
  cityEnum: string;
}

export const ALGERIAN_69_WILAYAS: AlgerianWilaya[] = [
  { code: "01", nameFr: "Adrar", nameAr: "أدرار", nameEn: "Adrar", nameKab: "Adrar", cityEnum: "ADRAR" },
  { code: "02", nameFr: "Chlef", nameAr: "الشلف", nameEn: "Chlef", nameKab: "Clef", cityEnum: "CHLEF" },
  { code: "03", nameFr: "Laghouat", nameAr: "الأغواط", nameEn: "Laghouat", nameKab: "Leɣwaṭ", cityEnum: "LAGHOUAT" },
  { code: "04", nameFr: "Oum El Bouaghi", nameAr: "أم البواقي", nameEn: "Oum El Bouaghi", nameKab: "Um Lebwaqi", cityEnum: "OUM_EL_BOUAGHI" },
  { code: "05", nameFr: "Batna", nameAr: "باتنة", nameEn: "Batna", nameKab: "Batna", cityEnum: "BATNA" },
  { code: "06", nameFr: "Béjaïa", nameAr: "بجاية", nameEn: "Bejaia", nameKab: "Bgayet", cityEnum: "BEJAIA" },
  { code: "07", nameFr: "Biskra", nameAr: "بسكرة", nameEn: "Biskra", nameKab: "Biskra", cityEnum: "BISKRA" },
  { code: "08", nameFr: "Béchar", nameAr: "بشار", nameEn: "Bechar", nameKab: "Beccar", cityEnum: "BECHAR" },
  { code: "09", nameFr: "Blida", nameAr: "البليدة", nameEn: "Blida", nameKab: "Blida", cityEnum: "BLIDA" },
  { code: "10", nameFr: "Bouira", nameAr: "البويرة", nameEn: "Bouira", nameKab: "Tubiret", cityEnum: "BOUIRA" },
  { code: "11", nameFr: "Tamanrasset", nameAr: "تمنراست", nameEn: "Tamanrasset", nameKab: "Tamenɣest", cityEnum: "TAMANRASSET" },
  { code: "12", nameFr: "Tébessa", nameAr: "تبسة", nameEn: "Tebessa", nameKab: "Tbessa", cityEnum: "TEBESSA" },
  { code: "13", nameFr: "Tlemcen", nameAr: "تلمسان", nameEn: "Tlemcen", nameKab: "Tlemsan", cityEnum: "TLEMCEN" },
  { code: "14", nameFr: "Tiaret", nameAr: "تيارت", nameEn: "Tiaret", nameKab: "Tyaret", cityEnum: "TIARET" },
  { code: "15", nameFr: "Tizi Ouzou", nameAr: "تيزي وزو", nameEn: "Tizi Ouzou", nameKab: "Tizi Wezzu", cityEnum: "TIZI_OUZOU" },
  { code: "16", nameFr: "Alger", nameAr: "الجزائر", nameEn: "Algiers", nameKab: "Dzayer", cityEnum: "ALGIERS" },
  { code: "17", nameFr: "Djelfa", nameAr: "الجلفة", nameEn: "Djelfa", nameKab: "Ǧelfa", cityEnum: "DJELFA" },
  { code: "18", nameFr: "Jijel", nameAr: "جيجل", nameEn: "Jijel", nameKab: "Jijel", cityEnum: "JIJEL" },
  { code: "19", nameFr: "Sétif", nameAr: "سطيف", nameEn: "Setif", nameKab: "Sṭif", cityEnum: "SETIF" },
  { code: "20", nameFr: "Saïda", nameAr: "سعيدة", nameEn: "Saida", nameKab: "Sɛida", cityEnum: "SAIDA" },
  { code: "21", nameFr: "Skikda", nameAr: "سكيكدة", nameEn: "Skikda", nameKab: "Skikda", cityEnum: "SKIKDA" },
  { code: "22", nameFr: "Sidi Bel Abbès", nameAr: "سيدي بلعباس", nameEn: "Sidi Bel Abbes", nameKab: "Sidi Belɛebbas", cityEnum: "SIDI_BEL_ABBES" },
  { code: "23", nameFr: "Annaba", nameAr: "عنابة", nameEn: "Annaba", nameKab: "Ɛennaba", cityEnum: "ANNABA" },
  { code: "24", nameFr: "Guelma", nameAr: "قالمة", nameEn: "Guelma", nameKab: "Galma", cityEnum: "GUELMA" },
  { code: "25", nameFr: "Constantine", nameAr: "قسنطينة", nameEn: "Constantine", nameKab: "Qsenṭina", cityEnum: "CONSTANTINE" },
  { code: "26", nameFr: "Médéa", nameAr: "المدية", nameEn: "Medea", nameKab: "Lemdiyya", cityEnum: "MEDEA" },
  { code: "27", nameFr: "Mostaganem", nameAr: "مستغانم", nameEn: "Mostaganem", nameKab: "Mustɣanem", cityEnum: "MOSTAGANEM" },
  { code: "28", nameFr: "M'Sila", nameAr: "المسيلة", nameEn: "M'Sila", nameKab: "Msila", cityEnum: "MSILA" },
  { code: "29", nameFr: "Mascara", nameAr: "معسكر", nameEn: "Mascara", nameKab: "Mɛesker", cityEnum: "MASCARA" },
  { code: "30", nameFr: "Ouargla", nameAr: "ورقلة", nameEn: "Ouargla", nameKab: "Wargla", cityEnum: "OUARGLA" },
  { code: "31", nameFr: "Oran", nameAr: "وهران", nameEn: "Oran", nameKab: "Wehran", cityEnum: "ORAN" },
  { code: "32", nameFr: "El Bayadh", nameAr: "البيض", nameEn: "El Bayadh", nameKab: "Lebyeḍ", cityEnum: "EL_BAYADH" },
  { code: "33", nameFr: "Illizi", nameAr: "إليزي", nameEn: "Illizi", nameKab: "Illizi", cityEnum: "ILLIZI" },
  { code: "34", nameFr: "Bordj Bou Arréridj", nameAr: "برج بوعريريج", nameEn: "Bordj Bou Arreridj", nameKab: "Borǧ Bu Ɛririǧ", cityEnum: "BORDJ_BOU_ARRERIDJ" },
  { code: "35", nameFr: "Boumerdès", nameAr: "بومرداس", nameEn: "Boumerdes", nameKab: "Bumerdas", cityEnum: "BOUMERDES" },
  { code: "36", nameFr: "El Tarf", nameAr: "الطارف", nameEn: "El Tarf", nameKab: "Ṭṭaref", cityEnum: "EL_TARF" },
  { code: "37", nameFr: "Tindouf", nameAr: "تندوف", nameEn: "Tindouf", nameKab: "Tinduf", cityEnum: "TINDOUF" },
  { code: "38", nameFr: "Tissemsilt", nameAr: "تيسمسيلت", nameEn: "Tissemsilt", nameKab: "Tisemsilt", cityEnum: "TISSEMSILT" },
  { code: "39", nameFr: "El Oued", nameAr: "الوادي", nameEn: "El Oued", nameKab: "Lwad", cityEnum: "EL_OUED" },
  { code: "40", nameFr: "Khenchela", nameAr: "خنشلة", nameEn: "Khenchela", nameKab: "Xencelt", cityEnum: "KHENCHELA" },
  { code: "41", nameFr: "Souk Ahras", nameAr: "سوق أهراس", nameEn: "Souk Ahras", nameKab: "Suq Ahras", cityEnum: "SOUK_AHRAS" },
  { code: "42", nameFr: "Tipaza", nameAr: "تيبازة", nameEn: "Tipaza", nameKab: "Tipaza", cityEnum: "TIPAZA" },
  { code: "43", nameFr: "Mila", nameAr: "ميلة", nameEn: "Mila", nameKab: "Mila", cityEnum: "MILA" },
  { code: "44", nameFr: "Aïn Defla", nameAr: "عين الدفلى", nameEn: "Ain Defla", nameKab: "Ɛin Defla", cityEnum: "AIN_DEFLA" },
  { code: "45", nameFr: "Naâma", nameAr: "النعامة", nameEn: "Naama", nameKab: "Nɛama", cityEnum: "NAAMA" },
  { code: "46", nameFr: "Aïn Témouchent", nameAr: "عين تموشنت", nameEn: "Ain Temouchent", nameKab: "Ɛin Timucent", cityEnum: "AIN_TEMOUCHENT" },
  { code: "47", nameFr: "Ghardaïa", nameAr: "غرداية", nameEn: "Ghardaia", nameKab: "Ɣerdaya", cityEnum: "GHARDAIA" },
  { code: "48", nameFr: "Relizane", nameAr: "غليزان", nameEn: "Relizane", nameKab: "Ɣilizan", cityEnum: "RELIZANE" },
  { code: "49", nameFr: "Timimoun", nameAr: "تيميمون", nameEn: "Timimoun", nameKab: "Timimun", cityEnum: "TIMIMOUN" },
  { code: "50", nameFr: "Bordj Badji Mokhtar", nameAr: "برج باجي مختار", nameEn: "Bordj Badji Mokhtar", nameKab: "Borǧ Baǧi Muxtar", cityEnum: "BORDJ_BADJI_MOKHTAR" },
  { code: "51", nameFr: "Ouled Djellal", nameAr: "أولاد جلال", nameEn: "Ouled Djellal", nameKab: "Wlad Ǧellal", cityEnum: "OULED_DJELLAL" },
  { code: "52", nameFr: "Béni Abbès", nameAr: "بني عباس", nameEn: "Beni Abbes", nameKab: "Bni Ɛebbas", cityEnum: "BENI_ABBES" },
  { code: "53", nameFr: "In Salah", nameAr: "عين صالح", nameEn: "In Salah", nameKab: "Ɛin Ṣaleḥ", cityEnum: "IN_SALAH" },
  { code: "54", nameFr: "In Guezzam", nameAr: "عين قزام", nameEn: "In Guezzam", nameKab: "Ɛin Gezzam", cityEnum: "IN_GUEZZAM" },
  { code: "55", nameFr: "Touggourt", nameAr: "تقرت", nameEn: "Touggourt", nameKab: "Tuggurt", cityEnum: "TOUGGOURT" },
  { code: "56", nameFr: "Djanet", nameAr: "جانت", nameEn: "Djanet", nameKab: "Ǧanet", cityEnum: "DJANET" },
  { code: "57", nameFr: "El M'Ghair", nameAr: "المغير", nameEn: "El M'Ghair", nameKab: "Lemɣir", cityEnum: "EL_MGHAIR" },
  { code: "58", nameFr: "El Meniaa", nameAr: "المنيعة", nameEn: "El Meniaa", nameKab: "Lemniɛa", cityEnum: "EL_MENIAA" },
  { code: "59", nameFr: "Aflou", nameAr: "أفلو", nameEn: "Aflou", nameKab: "Aflu", cityEnum: "AFLOU" },
  { code: "60", nameFr: "Barika", nameAr: "بريكة", nameEn: "Barika", nameKab: "Barika", cityEnum: "BARIKA" },
  { code: "61", nameFr: "El Kantara", nameAr: "القنطرة", nameEn: "El Kantara", nameKab: "Lqenṭra", cityEnum: "EL_KANTARA" },
  { code: "62", nameFr: "Bir El Ater", nameAr: "بئر العاتر", nameEn: "Bir El Ater", nameKab: "Bir Lɛater", cityEnum: "BIR_EL_ATER" },
  { code: "63", nameFr: "El Aricha", nameAr: "العريشة", nameEn: "El Aricha", nameKab: "Lɛrica", cityEnum: "EL_ARICHA" },
  { code: "64", nameFr: "Ksar Chellala", nameAr: "قصر الشلالة", nameEn: "Ksar Chellala", nameKab: "Qṣer Cellala", cityEnum: "KSAR_CHELLALA" },
  { code: "65", nameFr: "Aïn Oussera", nameAr: "عين وسارة", nameEn: "Ain Oussera", nameKab: "Ɛin Wessara", cityEnum: "AIN_OUSSERA" },
  { code: "66", nameFr: "Messaad", nameAr: "مسعد", nameEn: "Messaad", nameKab: "Mesɛed", cityEnum: "MESSAAD" },
  { code: "67", nameFr: "Ksar El Boukhari", nameAr: "قصر البخاري", nameEn: "Ksar El Boukhari", nameKab: "Qṣer Lbuxari", cityEnum: "KSAR_EL_BOUKHARI" },
  { code: "68", nameFr: "Bou Saâda", nameAr: "بوسعادة", nameEn: "Bou Saada", nameKab: "Busɛada", cityEnum: "BOU_SAADA" },
  { code: "69", nameFr: "El Abiodh Sidi Cheikh", nameAr: "الأبيض سيدي الشيخ", nameEn: "El Abiodh Sidi Cheikh", nameKab: "Lebyeḍ Sidi Cix", cityEnum: "EL_ABIODH_SIDI_CHEIKH" },
];

/** Backward-compatible export including all 69 Wilayas */
export const ALGERIAN_58_WILAYAS: AlgerianWilaya[] = ALGERIAN_69_WILAYAS;

/**
 * Normalizes city or wilaya input to resolve matching wilaya.
 */
export function findWilayaByCodeOrName(
  input: string,
): AlgerianWilaya | undefined {
  if (!input) return undefined;
  const clean = input.trim().toLowerCase();
  return ALGERIAN_69_WILAYAS.find(
    (w) =>
      w.code === input.padStart(2, "0") ||
      w.cityEnum.toLowerCase() === clean ||
      w.nameFr.toLowerCase() === clean ||
      w.nameEn.toLowerCase() === clean ||
      w.nameKab.toLowerCase() === clean ||
      w.nameAr === input ||
      w.nameFr.toLowerCase().includes(clean) ||
      w.nameEn.toLowerCase().includes(clean),
  );
}

/**
 * Formats city/wilaya display string given city key and locale or RTL flag.
 */
export function formatWilayaLabel(
  cityOrWilaya: string,
  localeOrIsRTL: boolean | string = false,
): string {
  const wilaya = findWilayaByCodeOrName(cityOrWilaya);
  if (!wilaya) {
    return cityOrWilaya.replace(/_/g, " ");
  }
  if (typeof localeOrIsRTL === "string") {
    const loc = localeOrIsRTL.toLowerCase();
    if (loc === "ar") return `${wilaya.code} - ${wilaya.nameAr}`;
    if (loc === "kab") return `${wilaya.code} - ${wilaya.nameKab}`;
    if (loc === "en") return `${wilaya.code} - ${wilaya.nameEn}`;
    return `${wilaya.code} - ${wilaya.nameFr}`;
  }
  return localeOrIsRTL
    ? `${wilaya.code} - ${wilaya.nameAr}`
    : `${wilaya.code} - ${wilaya.nameFr}`;
}
