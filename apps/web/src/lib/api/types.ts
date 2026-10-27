/**
 * Shared types, enums, and interfaces used across all API domain modules.
 */

// =============================================================================
// GENERIC RESPONSE TYPES
// =============================================================================

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
  timestamp: string;
}

export interface BaseResponse {
  success: boolean;
  message?: string;
}

// =============================================================================
// ENUMS
// =============================================================================

export enum UserRole {
  STUDENT = "STUDENT",
  BUSINESS = "BUSINESS",
  FREELANCER = "FREELANCER",
  ADMIN = "ADMIN",
  INSTRUCTOR = "INSTRUCTOR",
}

export enum AuthProvider {
  EMAIL = "EMAIL",
  GOOGLE = "GOOGLE",
  GITHUB = "GITHUB",
  LINKEDIN = "LINKEDIN",
  PHONE = "PHONE",
}

export enum Country {
  ALGERIA = "ALGERIA",
  EGYPT = "EGYPT",
  MOROCCO = "MOROCCO",
  TUNISIA = "TUNISIA",
  LIBYA = "LIBYA",
}

export enum City {
  ADRAR = "ADRAR",
  CHLEF = "CHLEF",
  LAGHOUAT = "LAGHOUAT",
  OUM_EL_BOUAGHI = "OUM_EL_BOUAGHI",
  BATNA = "BATNA",
  BEJAIA = "BEJAIA",
  BISKRA = "BISKRA",
  BECHAR = "BECHAR",
  BLIDA = "BLIDA",
  BOUIRA = "BOUIRA",
  TAMANRASSET = "TAMANRASSET",
  TEBESSA = "TEBESSA",
  TLEMCEN = "TLEMCEN",
  TIARET = "TIARET",
  TIZI_OUZOU = "TIZI_OUZOU",
  ALGIERS = "ALGIERS",
  DJELFA = "DJELFA",
  JIJEL = "JIJEL",
  SETIF = "SETIF",
  SAIDA = "SAIDA",
  SKIKDA = "SKIKDA",
  SIDI_BEL_ABBES = "SIDI_BEL_ABBES",
  ANNABA = "ANNABA",
  GUELMA = "GUELMA",
  CONSTANTINE = "CONSTANTINE",
  MEDEA = "MEDEA",
  MOSTAGANEM = "MOSTAGANEM",
  MSILA = "MSILA",
  MASCARA = "MASCARA",
  OUARGLA = "OUARGLA",
  ORAN = "ORAN",
  EL_BAYADH = "EL_BAYADH",
  ILLIZI = "ILLIZI",
  BORDJ_BOU_ARRERIDJ = "BORDJ_BOU_ARRERIDJ",
  BOUMERDES = "BOUMERDES",
  EL_TARF = "EL_TARF",
  TINDOUF = "TINDOUF",
  TISSEMSILT = "TISSEMSILT",
  EL_OUED = "EL_OUED",
  KHENCHELA = "KHENCHELA",
  SOUK_AHRAS = "SOUK_AHRAS",
  TIPAZA = "TIPAZA",
  MILA = "MILA",
  AIN_DEFLA = "AIN_DEFLA",
  NAAMA = "NAAMA",
  AIN_TEMOUCHENT = "AIN_TEMOUCHENT",
  GHARDAIA = "GHARDAIA",
  RELIZANE = "RELIZANE",
  TIMIMOUN = "TIMIMOUN",
  BORDJ_BADJI_MOKHTAR = "BORDJ_BADJI_MOKHTAR",
  OULED_DJELLAL = "OULED_DJELLAL",
  BENI_ABBES = "BENI_ABBES",
  IN_SALAH = "IN_SALAH",
  IN_GUEZZAM = "IN_GUEZZAM",
  TOUGGOURT = "TOUGGOURT",
  DJANET = "DJANET",
  EL_MGHAIR = "EL_MGHAIR",
  EL_MENIAA = "EL_MENIAA",
  AFLOU = "AFLOU",
  BARIKA = "BARIKA",
  EL_KANTARA = "EL_KANTARA",
  BIR_EL_ATER = "BIR_EL_ATER",
  EL_ARICHA = "EL_ARICHA",
  KSAR_CHELLALA = "KSAR_CHELLALA",
  AIN_OUSSERA = "AIN_OUSSERA",
  MESSAAD = "MESSAAD",
  KSAR_EL_BOUKHARI = "KSAR_EL_BOUKHARI",
  BOU_SAADA = "BOU_SAADA",
  EL_ABIODH_SIDI_CHEIKH = "EL_ABIODH_SIDI_CHEIKH",
  CAIRO = "CAIRO",
  ALEXANDRIA = "ALEXANDRIA",
  GIZA = "GIZA",
  PORT_SAID = "PORT_SAID",
  SUEZ = "SUEZ",
  CASABLANCA = "CASABLANCA",
  RABAT = "RABAT",
  MARRAKESH = "MARRAKESH",
  TANGIER = "TANGIER",
  FES = "FES",
  TUNIS = "TUNIS",
  SFAX = "SFAX",
  SOUSSE = "SOUSSE",
  ETTADHAMEN = "ETTADHAMEN",
  KAIROUAN = "KAIROUAN",
  TRIPOLI = "TRIPOLI",
  BENGHAZI = "BENGHAZI",
  MISRATA = "MISRATA",
  SIRTE = "SIRTE",
  SABHA = "SABHA",
}

export enum OrganizationSector {
  TECHNOLOGY_AND_SOFTWARE = "TECHNOLOGY_AND_SOFTWARE",
  BANKING_AND_FINANCIAL_SERVICES = "BANKING_AND_FINANCIAL_SERVICES",
  HEALTHCARE_AND_PHARMACEUTICALS = "HEALTHCARE_AND_PHARMACEUTICALS",
  ENERGY_AND_OIL_AND_GAS = "ENERGY_AND_OIL_AND_GAS",
  AUTOMOTIVE_AND_MANUFACTURING = "AUTOMOTIVE_AND_MANUFACTURING",
  RETAIL_AND_CONSUMER_GOODS = "RETAIL_AND_CONSUMER_GOODS",
  TELECOMMUNICATIONS = "TELECOMMUNICATIONS",
  AEROSPACE_AND_DEFENSE = "AEROSPACE_AND_DEFENSE",
  AGRICULTURE_AND_FOOD_PRODUCTION = "AGRICULTURE_AND_FOOD_PRODUCTION",
  TRANSPORTATION_AND_LOGISTICS = "TRANSPORTATION_AND_LOGISTICS",
  EDUCATION_AND_EDTECH = "EDUCATION_AND_EDTECH",
  CONSTRUCTION_AND_REAL_ESTATE = "CONSTRUCTION_AND_REAL_ESTATE",
  CONSULTING_AND_PROFESSIONAL_SERVICES = "CONSULTING_AND_PROFESSIONAL_SERVICES",
  MEDIA_AND_CREATIVE_INDUSTRIES = "MEDIA_AND_CREATIVE_INDUSTRIES",
  TOURISM_AND_HOSPITALITY = "TOURISM_AND_HOSPITALITY",
  PUBLIC_SECTOR_AND_ADMINISTRATION = "PUBLIC_SECTOR_AND_ADMINISTRATION",
  RENEWABLE_ENERGY_AND_CLEANTECH = "RENEWABLE_ENERGY_AND_CLEANTECH",
  MINING_AND_METALLURGY = "MINING_AND_METALLURGY",
  TEXTILES_AND_APPAREL = "TEXTILES_AND_APPAREL",
  NON_PROFIT_AND_NGO = "NON_PROFIT_AND_NGO",
  OTHER = "OTHER",
}

export enum SubscriptionPlan {
  FREE = "FREE",
  STUDENT_STARTER = "STUDENT_STARTER",
  STUDENT_PLUS = "STUDENT_PLUS",
  STUDENT_PRO = "STUDENT_PRO",
  BI_GROWTH = "BI_GROWTH",
  BI_SCALE = "BI_SCALE",
  BI_ELITE = "BI_ELITE",
  FREELANCER_PLUS = "FREELANCER_PLUS",
  FREELANCER_PREMIUM = "FREELANCER_PREMIUM",
  BUSINESS_STARTER = "BUSINESS_STARTER",
  BUSINESS_PRO = "BUSINESS_PRO",
  BUSINESS_ENTERPRISE = "BUSINESS_ENTERPRISE",
}

export enum SubscriptionStatus {
  ACTIVE = "ACTIVE",
  CANCELLED = "CANCELLED",
  EXPIRED = "EXPIRED",
}

export enum PaymentGateway {
  CHARGILY = "CHARGILY",
  MOCK = "MOCK",
}

export enum PaymentPurpose {
  COURSE_PURCHASE = "COURSE_PURCHASE",
  PATH_PURCHASE = "PATH_PURCHASE",
  STUDENT_SUBSCRIPTION = "STUDENT_SUBSCRIPTION",
  BI_SUBSCRIPTION = "BI_SUBSCRIPTION",
  CONTRACT_PAYMENT = "CONTRACT_PAYMENT",
  REFUND = "REFUND",
  LIVE_SESSION_PURCHASE = "LIVE_SESSION_PURCHASE",
  LIVE_SESSION_REFUND = "LIVE_SESSION_REFUND",
  CERTIFICATE_PURCHASE = "CERTIFICATE_PURCHASE",
  PODAPOINT_PURCHASE = "PODAPOINT_PURCHASE",
  FEATURE_PURCHASE = "FEATURE_PURCHASE",
  FREELANCER_SUBSCRIPTION = "FREELANCER_SUBSCRIPTION",
  BUSINESS_SUBSCRIPTION = "BUSINESS_SUBSCRIPTION",
}

export enum ProjectStatus {
  OPEN = "OPEN",
  IN_PROGRESS = "IN_PROGRESS",
  COMPLETED = "COMPLETED",
  CANCELLED = "CANCELLED",
}

export enum ProposalStatus {
  PENDING = "PENDING",
  ACCEPTED = "ACCEPTED",
  REJECTED = "REJECTED",
}

export enum ContractStatus {
  ACTIVE = "ACTIVE",
  COMPLETED = "COMPLETED",
  CANCELLED = "CANCELLED",
}

export enum DisputeStatus {
  OPEN = "OPEN",
  UNDER_REVIEW = "UNDER_REVIEW",
  RESOLVED = "RESOLVED",
  CANCELLED = "CANCELLED",
}

export enum DisputeReason {
  NON_DELIVERY = "NON_DELIVERY",
  POOR_QUALITY = "POOR_QUALITY",
  INCOMPLETE_REQUIREMENTS = "INCOMPLETE_REQUIREMENTS",
  OTHER = "OTHER",
}

export enum NotificationCategory {
  SECURITY = "SECURITY",
  PROJECT = "PROJECT",
  COURSE = "COURSE",
  MARKETING = "MARKETING",
  SYSTEM = "SYSTEM",
  BILLING = "BILLING",
}

export enum NotificationPriority {
  LOW = "LOW",
  NORMAL = "NORMAL",
  HIGH = "HIGH",
  URGENT = "URGENT",
}

export interface ContactFormRequest {
  name: string;
  email: string;
  message: string;
  phone?: string;
  subject?: string;
  category?: string;
}

export interface ContractCreate {
  terms: string;
  amount?: number;
  start_date?: string;
  end_date?: string;
}

export enum CompanySizeBracket {
  MICRO_1_10 = "MICRO_1_10",
  SMALL_11_50 = "SMALL_11_50",
  MID_51_200 = "MID_51_200",
  LARGE_201_500 = "LARGE_201_500",
  ENTERPRISE_500_PLUS = "ENTERPRISE_500_PLUS",
}

export interface PublicOrganizationSummary {
  id: number;
  name: string;
  slug: string;
  city: string;
  country: string;
  sector: OrganizationSector | string;
  website?: string | null;
  tagline?: string | null;
  companySizeBracket?: string | null;
  operationalScale?: string | null;
  primaryLanguages?: string[];
  brandAccentColor?: string | null;
  coverBannerUrl?: string | null;
  logoUrl?: string | null;
  isKybVerified: boolean;
  kybStatus?: string | null;
  averageRating: number;
  reviewCount: number;
  caseStudyCount: number;
  createdAt: string;
}
