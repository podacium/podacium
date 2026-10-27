/**
 * 69 Official Algerian Wilayas Master Dataset
 * Includes ISO / postal numeric codes, names in French, Arabic, English, and Kabyle,
 * and 1:1 mapping to Algerian City enum for Prisma compatibility.
 */

export interface AlgerianWilaya {
  code: number;
  codeStr: string;
  nameFr: string;
  nameAr: string;
  nameEn: string;
  nameKab: string;
  defaultCity: string;
}

export const ALGERIAN_WILAYAS_69: AlgerianWilaya[] = [
  { code: 1, codeStr: "01", nameFr: "Adrar", nameAr: "أدرار", nameEn: "Adrar", nameKab: "Adrar", defaultCity: "ADRAR" },
  { code: 2, codeStr: "02", nameFr: "Chlef", nameAr: "الشلف", nameEn: "Chlef", nameKab: "Clef", defaultCity: "CHLEF" },
  { code: 3, codeStr: "03", nameFr: "Laghouat", nameAr: "الأغواط", nameEn: "Laghouat", nameKab: "Leɣwaṭ", defaultCity: "LAGHOUAT" },
  { code: 4, codeStr: "04", nameFr: "Oum El Bouaghi", nameAr: "أم البواقي", nameEn: "Oum El Bouaghi", nameKab: "Um Lebwaqi", defaultCity: "OUM_EL_BOUAGHI" },
  { code: 5, codeStr: "05", nameFr: "Batna", nameAr: "باتنة", nameEn: "Batna", nameKab: "Batna", defaultCity: "BATNA" },
  { code: 6, codeStr: "06", nameFr: "Béjaïa", nameAr: "بجاية", nameEn: "Bejaia", nameKab: "Bgayet", defaultCity: "BEJAIA" },
  { code: 7, codeStr: "07", nameFr: "Biskra", nameAr: "بسكرة", nameEn: "Biskra", nameKab: "Biskra", defaultCity: "BISKRA" },
  { code: 8, codeStr: "08", nameFr: "Béchar", nameAr: "بشار", nameEn: "Bechar", nameKab: "Beccar", defaultCity: "BECHAR" },
  { code: 9, codeStr: "09", nameFr: "Blida", nameAr: "البليدة", nameEn: "Blida", nameKab: "Blida", defaultCity: "BLIDA" },
  { code: 10, codeStr: "10", nameFr: "Bouira", nameAr: "البويرة", nameEn: "Bouira", nameKab: "Tubiret", defaultCity: "BOUIRA" },
  { code: 11, codeStr: "11", nameFr: "Tamanrasset", nameAr: "تمنراست", nameEn: "Tamanrasset", nameKab: "Tamenɣest", defaultCity: "TAMANRASSET" },
  { code: 12, codeStr: "12", nameFr: "Tébessa", nameAr: "تبسة", nameEn: "Tebessa", nameKab: "Tbessa", defaultCity: "TEBESSA" },
  { code: 13, codeStr: "13", nameFr: "Tlemcen", nameAr: "تلمسان", nameEn: "Tlemcen", nameKab: "Tlemsan", defaultCity: "TLEMCEN" },
  { code: 14, codeStr: "14", nameFr: "Tiaret", nameAr: "تيارت", nameEn: "Tiaret", nameKab: "Tyaret", defaultCity: "TIARET" },
  { code: 15, codeStr: "15", nameFr: "Tizi Ouzou", nameAr: "تيزي وزو", nameEn: "Tizi Ouzou", nameKab: "Tizi Wezzu", defaultCity: "TIZI_OUZOU" },
  { code: 16, codeStr: "16", nameFr: "Alger", nameAr: "الجزائر", nameEn: "Algiers", nameKab: "Dzayer", defaultCity: "ALGIERS" },
  { code: 17, codeStr: "17", nameFr: "Djelfa", nameAr: "الجلفة", nameEn: "Djelfa", nameKab: "Ǧelfa", defaultCity: "DJELFA" },
  { code: 18, codeStr: "18", nameFr: "Jijel", nameAr: "جيجل", nameEn: "Jijel", nameKab: "Jijel", defaultCity: "JIJEL" },
  { code: 19, codeStr: "19", nameFr: "Sétif", nameAr: "سطيف", nameEn: "Setif", nameKab: "Sṭif", defaultCity: "SETIF" },
  { code: 20, codeStr: "20", nameFr: "Saïda", nameAr: "سعيدة", nameEn: "Saida", nameKab: "Sɛida", defaultCity: "SAIDA" },
  { code: 21, codeStr: "21", nameFr: "Skikda", nameAr: "سكيكدة", nameEn: "Skikda", nameKab: "Skikda", defaultCity: "SKIKDA" },
  { code: 22, codeStr: "22", nameFr: "Sidi Bel Abbès", nameAr: "سيدي بلعباس", nameEn: "Sidi Bel Abbes", nameKab: "Sidi Belɛebbas", defaultCity: "SIDI_BEL_ABBES" },
  { code: 23, codeStr: "23", nameFr: "Annaba", nameAr: "عنابة", nameEn: "Annaba", nameKab: "Ɛennaba", defaultCity: "ANNABA" },
  { code: 24, codeStr: "24", nameFr: "Guelma", nameAr: "قالمة", nameEn: "Guelma", nameKab: "Galma", defaultCity: "GUELMA" },
  { code: 25, codeStr: "25", nameFr: "Constantine", nameAr: "قسنطينة", nameEn: "Constantine", nameKab: "Qsenṭina", defaultCity: "CONSTANTINE" },
  { code: 26, codeStr: "26", nameFr: "Médéa", nameAr: "المدية", nameEn: "Medea", nameKab: "Lemdiyya", defaultCity: "MEDEA" },
  { code: 27, codeStr: "27", nameFr: "Mostaganem", nameAr: "مستغانم", nameEn: "Mostaganem", nameKab: "Mustɣanem", defaultCity: "MOSTAGANEM" },
  { code: 28, codeStr: "28", nameFr: "M'Sila", nameAr: "المسيلة", nameEn: "M'Sila", nameKab: "Msila", defaultCity: "MSILA" },
  { code: 29, codeStr: "29", nameFr: "Mascara", nameAr: "معسكر", nameEn: "Mascara", nameKab: "Mɛesker", defaultCity: "MASCARA" },
  { code: 30, codeStr: "30", nameFr: "Ouargla", nameAr: "ورقلة", nameEn: "Ouargla", nameKab: "Wargla", defaultCity: "OUARGLA" },
  { code: 31, codeStr: "31", nameFr: "Oran", nameAr: "وهران", nameEn: "Oran", nameKab: "Wehran", defaultCity: "ORAN" },
  { code: 32, codeStr: "32", nameFr: "El Bayadh", nameAr: "البيض", nameEn: "El Bayadh", nameKab: "Lebyeḍ", defaultCity: "EL_BAYADH" },
  { code: 33, codeStr: "33", nameFr: "Illizi", nameAr: "إليزي", nameEn: "Illizi", nameKab: "Illizi", defaultCity: "ILLIZI" },
  { code: 34, codeStr: "34", nameFr: "Bordj Bou Arréridj", nameAr: "برج بوعريريج", nameEn: "Bordj Bou Arreridj", nameKab: "Borǧ Bu Ɛririǧ", defaultCity: "BORDJ_BOU_ARRERIDJ" },
  { code: 35, codeStr: "35", nameFr: "Boumerdès", nameAr: "بومرداس", nameEn: "Boumerdes", nameKab: "Bumerdas", defaultCity: "BOUMERDES" },
  { code: 36, codeStr: "36", nameFr: "El Tarf", nameAr: "الطارف", nameEn: "El Tarf", nameKab: "Ṭṭaref", defaultCity: "EL_TARF" },
  { code: 37, codeStr: "37", nameFr: "Tindouf", nameAr: "تندوف", nameEn: "Tindouf", nameKab: "Tinduf", defaultCity: "TINDOUF" },
  { code: 38, codeStr: "38", nameFr: "Tissemsilt", nameAr: "تيسمسيلت", nameEn: "Tissemsilt", nameKab: "Tisemsilt", defaultCity: "TISSEMSILT" },
  { code: 39, codeStr: "39", nameFr: "El Oued", nameAr: "الوادي", nameEn: "El Oued", nameKab: "Lwad", defaultCity: "EL_OUED" },
  { code: 40, codeStr: "40", nameFr: "Khenchela", nameAr: "خنشلة", nameEn: "Khenchela", nameKab: "Xencelt", defaultCity: "KHENCHELA" },
  { code: 41, codeStr: "41", nameFr: "Souk Ahras", nameAr: "سوق أهراس", nameEn: "Souk Ahras", nameKab: "Suq Ahras", defaultCity: "SOUK_AHRAS" },
  { code: 42, codeStr: "42", nameFr: "Tipaza", nameAr: "تيبازة", nameEn: "Tipaza", nameKab: "Tipaza", defaultCity: "TIPAZA" },
  { code: 43, codeStr: "43", nameFr: "Mila", nameAr: "ميلة", nameEn: "Mila", nameKab: "Mila", defaultCity: "MILA" },
  { code: 44, codeStr: "44", nameFr: "Aïn Defla", nameAr: "عين الدفلى", nameEn: "Ain Defla", nameKab: "Ɛin Defla", defaultCity: "AIN_DEFLA" },
  { code: 45, codeStr: "45", nameFr: "Naâma", nameAr: "النعامة", nameEn: "Naama", nameKab: "Nɛama", defaultCity: "NAAMA" },
  { code: 46, codeStr: "46", nameFr: "Aïn Témouchent", nameAr: "عين تموشنت", nameEn: "Ain Temouchent", nameKab: "Ɛin Timucent", defaultCity: "AIN_TEMOUCHENT" },
  { code: 47, codeStr: "47", nameFr: "Ghardaïa", nameAr: "غرداية", nameEn: "Ghardaia", nameKab: "Ɣerdaya", defaultCity: "GHARDAIA" },
  { code: 48, codeStr: "48", nameFr: "Relizane", nameAr: "غليزان", nameEn: "Relizane", nameKab: "Ɣilizan", defaultCity: "RELIZANE" },
  { code: 49, codeStr: "49", nameFr: "Timimoun", nameAr: "تيميمون", nameEn: "Timimoun", nameKab: "Timimun", defaultCity: "TIMIMOUN" },
  { code: 50, codeStr: "50", nameFr: "Bordj Badji Mokhtar", nameAr: "برج باجي مختار", nameEn: "Bordj Badji Mokhtar", nameKab: "Borǧ Baǧi Muxtar", defaultCity: "BORDJ_BADJI_MOKHTAR" },
  { code: 51, codeStr: "51", nameFr: "Ouled Djellal", nameAr: "أولاد جلال", nameEn: "Ouled Djellal", nameKab: "Wlad Ǧellal", defaultCity: "OULED_DJELLAL" },
  { code: 52, codeStr: "52", nameFr: "Béni Abbès", nameAr: "بني عباس", nameEn: "Beni Abbes", nameKab: "Bni Ɛebbas", defaultCity: "BENI_ABBES" },
  { code: 53, codeStr: "53", nameFr: "In Salah", nameAr: "عين صالح", nameEn: "In Salah", nameKab: "Ɛin Ṣaleḥ", defaultCity: "IN_SALAH" },
  { code: 54, codeStr: "54", nameFr: "In Guezzam", nameAr: "عين قزام", nameEn: "In Guezzam", nameKab: "Ɛin Gezzam", defaultCity: "IN_GUEZZAM" },
  { code: 55, codeStr: "55", nameFr: "Touggourt", nameAr: "تقرت", nameEn: "Touggourt", nameKab: "Tuggurt", defaultCity: "TOUGGOURT" },
  { code: 56, codeStr: "56", nameFr: "Djanet", nameAr: "جانت", nameEn: "Djanet", nameKab: "Ǧanet", defaultCity: "DJANET" },
  { code: 57, codeStr: "57", nameFr: "El M'Ghair", nameAr: "المغير", nameEn: "El M'Ghair", nameKab: "Lemɣir", defaultCity: "EL_MGHAIR" },
  { code: 58, codeStr: "58", nameFr: "El Meniaa", nameAr: "المنيعة", nameEn: "El Meniaa", nameKab: "Lemniɛa", defaultCity: "EL_MENIAA" },
  { code: 59, codeStr: "59", nameFr: "Aflou", nameAr: "أفلو", nameEn: "Aflou", nameKab: "Aflu", defaultCity: "AFLOU" },
  { code: 60, codeStr: "60", nameFr: "Barika", nameAr: "بريكة", nameEn: "Barika", nameKab: "Barika", defaultCity: "BARIKA" },
  { code: 61, codeStr: "61", nameFr: "El Kantara", nameAr: "القنطرة", nameEn: "El Kantara", nameKab: "Lqenṭra", defaultCity: "EL_KANTARA" },
  { code: 62, codeStr: "62", nameFr: "Bir El Ater", nameAr: "بئر العاتر", nameEn: "Bir El Ater", nameKab: "Bir Lɛater", defaultCity: "BIR_EL_ATER" },
  { code: 63, codeStr: "63", nameFr: "El Aricha", nameAr: "العريشة", nameEn: "El Aricha", nameKab: "Lɛrica", defaultCity: "EL_ARICHA" },
  { code: 64, codeStr: "64", nameFr: "Ksar Chellala", nameAr: "قصر الشلالة", nameEn: "Ksar Chellala", nameKab: "Qṣer Cellala", defaultCity: "KSAR_CHELLALA" },
  { code: 65, codeStr: "65", nameFr: "Aïn Oussera", nameAr: "عين وسارة", nameEn: "Ain Oussera", nameKab: "Ɛin Wessara", defaultCity: "AIN_OUSSERA" },
  { code: 66, codeStr: "66", nameFr: "Messaad", nameAr: "مسعد", nameEn: "Messaad", nameKab: "Mesɛed", defaultCity: "MESSAAD" },
  { code: 67, codeStr: "67", nameFr: "Ksar El Boukhari", nameAr: "قصر البخاري", nameEn: "Ksar El Boukhari", nameKab: "Qṣer Lbuxari", defaultCity: "KSAR_EL_BOUKHARI" },
  { code: 68, codeStr: "68", nameFr: "Bou Saâda", nameAr: "بوسعادة", nameEn: "Bou Saada", nameKab: "Busɛada", defaultCity: "BOU_SAADA" },
  { code: 69, codeStr: "69", nameFr: "El Abiodh Sidi Cheikh", nameAr: "الأبيض سيدي الشيخ", nameEn: "El Abiodh Sidi Cheikh", nameKab: "Lebyeḍ Sidi Cix", defaultCity: "EL_ABIODH_SIDI_CHEIKH" },
];

export const ALGERIAN_WILAYAS_58: AlgerianWilaya[] = ALGERIAN_WILAYAS_69;
