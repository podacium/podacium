"use client";

import React, { useState, useMemo } from "react";
import {
  MapPin,
  TrendingUp,
  TrendingDown,
  Search,
  Filter,
  BarChart3,
  Layers,
  LayoutGrid,
  ListOrdered,
  ChevronRight,
  Info,
  DollarSign,
  ShoppingCart,
  Users,
} from "lucide-react";
import {
  PodaciumCard,
  PodaciumBadge,
  PodaciumButton,
} from "@/components/design-system";
import { cn } from "@/lib/utils";
import { useTranslations, useLocale } from "@/lib/i18n";

export type WilayaRegion = "NORTH" | "HIGH_PLATEAUS" | "SAHARA";

export interface WilayaData {
  code: string;
  nameFr: string;
  nameAr: string;
  region: WilayaRegion;
  revenueDzd: number;
  ordersCount: number;
  activeUsers: number;
  growthRatePct: number;
  coordinates: { x: number; y: number; r?: number }; // Map SVG projection coordinates
}

// 58 Official Algerian Wilayas Master Dataset
export const ALGERIAN_58_WILAYAS: WilayaData[] = [
  {
    code: "01",
    nameFr: "Adrar",
    nameAr: "أدرار",
    region: "SAHARA",
    revenueDzd: 4200000,
    ordersCount: 280,
    activeUsers: 450,
    growthRatePct: 18.5,
    coordinates: { x: 260, y: 520, r: 24 },
  },
  {
    code: "02",
    nameFr: "Chlef",
    nameAr: "الشلف",
    region: "NORTH",
    revenueDzd: 7800000,
    ordersCount: 620,
    activeUsers: 890,
    growthRatePct: 22.4,
    coordinates: { x: 300, y: 150, r: 14 },
  },
  {
    code: "03",
    nameFr: "Laghouat",
    nameAr: "الأغواط",
    region: "HIGH_PLATEAUS",
    revenueDzd: 5600000,
    ordersCount: 390,
    activeUsers: 610,
    growthRatePct: 15.2,
    coordinates: { x: 350, y: 260, r: 18 },
  },
  {
    code: "04",
    nameFr: "Oum El Bouaghi",
    nameAr: "أم البواقي",
    region: "HIGH_PLATEAUS",
    revenueDzd: 4900000,
    ordersCount: 340,
    activeUsers: 520,
    growthRatePct: 14.1,
    coordinates: { x: 580, y: 180, r: 15 },
  },
  {
    code: "05",
    nameFr: "Batna",
    nameAr: "باتنة",
    region: "HIGH_PLATEAUS",
    revenueDzd: 8900000,
    ordersCount: 710,
    activeUsers: 1150,
    growthRatePct: 25.8,
    coordinates: { x: 550, y: 200, r: 16 },
  },
  {
    code: "06",
    nameFr: "Béjaïa",
    nameAr: "بجاية",
    region: "NORTH",
    revenueDzd: 11200000,
    ordersCount: 940,
    activeUsers: 1480,
    growthRatePct: 28.2,
    coordinates: { x: 470, y: 130, r: 14 },
  },
  {
    code: "07",
    nameFr: "Biskra",
    nameAr: "بسكرة",
    region: "SAHARA",
    revenueDzd: 7400000,
    ordersCount: 580,
    activeUsers: 870,
    growthRatePct: 21.0,
    coordinates: { x: 520, y: 240, r: 18 },
  },
  {
    code: "08",
    nameFr: "Béchar",
    nameAr: "بشار",
    region: "SAHARA",
    revenueDzd: 4800000,
    ordersCount: 310,
    activeUsers: 510,
    growthRatePct: 16.4,
    coordinates: { x: 170, y: 360, r: 22 },
  },
  {
    code: "09",
    nameFr: "Blida",
    nameAr: "البليدة",
    region: "NORTH",
    revenueDzd: 14500000,
    ordersCount: 1250,
    activeUsers: 1950,
    growthRatePct: 31.5,
    coordinates: { x: 370, y: 150, r: 13 },
  },
  {
    code: "10",
    nameFr: "Bouira",
    nameAr: "البويرة",
    region: "HIGH_PLATEAUS",
    revenueDzd: 6300000,
    ordersCount: 480,
    activeUsers: 730,
    growthRatePct: 19.3,
    coordinates: { x: 420, y: 160, r: 14 },
  },
  {
    code: "11",
    nameFr: "Tamanrasset",
    nameAr: "تمنراست",
    region: "SAHARA",
    revenueDzd: 3800000,
    ordersCount: 220,
    activeUsers: 380,
    growthRatePct: 12.8,
    coordinates: { x: 490, y: 680, r: 26 },
  },
  {
    code: "12",
    nameFr: "Tébessa",
    nameAr: "تبسة",
    region: "HIGH_PLATEAUS",
    revenueDzd: 6100000,
    ordersCount: 460,
    activeUsers: 690,
    growthRatePct: 17.5,
    coordinates: { x: 630, y: 210, r: 16 },
  },
  {
    code: "13",
    nameFr: "Tlemcen",
    nameAr: "تلمسان",
    region: "NORTH",
    revenueDzd: 9800000,
    ordersCount: 820,
    activeUsers: 1320,
    growthRatePct: 24.6,
    coordinates: { x: 190, y: 190, r: 15 },
  },
  {
    code: "14",
    nameFr: "Tiaret",
    nameAr: "تيارت",
    region: "HIGH_PLATEAUS",
    revenueDzd: 6700000,
    ordersCount: 520,
    activeUsers: 790,
    growthRatePct: 18.9,
    coordinates: { x: 290, y: 210, r: 16 },
  },
  {
    code: "15",
    nameFr: "Tizi Ouzou",
    nameAr: "تيزي وزو",
    region: "NORTH",
    revenueDzd: 12400000,
    ordersCount: 1050,
    activeUsers: 1680,
    growthRatePct: 29.4,
    coordinates: { x: 430, y: 135, r: 14 },
  },
  {
    code: "16",
    nameFr: "Alger",
    nameAr: "الجزائر",
    region: "NORTH",
    revenueDzd: 34500000,
    ordersCount: 3100,
    activeUsers: 4850,
    growthRatePct: 42.0,
    coordinates: { x: 380, y: 130, r: 18 },
  },
  {
    code: "17",
    nameFr: "Djelfa",
    nameAr: "الجلفة",
    region: "HIGH_PLATEAUS",
    revenueDzd: 5900000,
    ordersCount: 430,
    activeUsers: 680,
    growthRatePct: 16.8,
    coordinates: { x: 380, y: 240, r: 18 },
  },
  {
    code: "18",
    nameFr: "Jijel",
    nameAr: "جيجل",
    region: "NORTH",
    revenueDzd: 7100000,
    ordersCount: 560,
    activeUsers: 890,
    growthRatePct: 21.7,
    coordinates: { x: 510, y: 130, r: 14 },
  },
  {
    code: "19",
    nameFr: "Sétif",
    nameAr: "سطيف",
    region: "HIGH_PLATEAUS",
    revenueDzd: 18200000,
    ordersCount: 1520,
    activeUsers: 2410,
    growthRatePct: 35.6,
    coordinates: { x: 490, y: 170, r: 17 },
  },
  {
    code: "20",
    nameFr: "Saïda",
    nameAr: "سعيدة",
    region: "HIGH_PLATEAUS",
    revenueDzd: 4100000,
    ordersCount: 310,
    activeUsers: 490,
    growthRatePct: 14.3,
    coordinates: { x: 230, y: 220, r: 15 },
  },
  {
    code: "21",
    nameFr: "Skikda",
    nameAr: "سكيكدة",
    region: "NORTH",
    revenueDzd: 8700000,
    ordersCount: 710,
    activeUsers: 1120,
    growthRatePct: 23.9,
    coordinates: { x: 560, y: 130, r: 14 },
  },
  {
    code: "22",
    nameFr: "Sidi Bel Abbès",
    nameAr: "سيدي بلعباس",
    region: "NORTH",
    revenueDzd: 8300000,
    ordersCount: 680,
    activeUsers: 1080,
    growthRatePct: 22.1,
    coordinates: { x: 220, y: 195, r: 15 },
  },
  {
    code: "23",
    nameFr: "Annaba",
    nameAr: "عنابة",
    region: "NORTH",
    revenueDzd: 15900000,
    ordersCount: 1340,
    activeUsers: 2150,
    growthRatePct: 33.8,
    coordinates: { x: 620, y: 130, r: 16 },
  },
  {
    code: "24",
    nameFr: "Guelma",
    nameAr: "قالمة",
    region: "HIGH_PLATEAUS",
    revenueDzd: 5400000,
    ordersCount: 420,
    activeUsers: 640,
    growthRatePct: 17.2,
    coordinates: { x: 600, y: 160, r: 14 },
  },
  {
    code: "25",
    nameFr: "Constantine",
    nameAr: "قسنطينة",
    region: "NORTH",
    revenueDzd: 19800000,
    ordersCount: 1720,
    activeUsers: 2790,
    growthRatePct: 36.4,
    coordinates: { x: 550, y: 155, r: 17 },
  },
  {
    code: "26",
    nameFr: "Médéa",
    nameAr: "المدية",
    region: "HIGH_PLATEAUS",
    revenueDzd: 6200000,
    ordersCount: 480,
    activeUsers: 740,
    growthRatePct: 18.0,
    coordinates: { x: 360, y: 180, r: 15 },
  },
  {
    code: "27",
    nameFr: "Mostaganem",
    nameAr: "مستغانم",
    region: "NORTH",
    revenueDzd: 8400000,
    ordersCount: 690,
    activeUsers: 1100,
    growthRatePct: 23.1,
    coordinates: { x: 270, y: 160, r: 14 },
  },
  {
    code: "28",
    nameFr: "M'Sila",
    nameAr: "المسيلة",
    region: "HIGH_PLATEAUS",
    revenueDzd: 6800000,
    ordersCount: 530,
    activeUsers: 820,
    growthRatePct: 19.5,
    coordinates: { x: 450, y: 210, r: 17 },
  },
  {
    code: "29",
    nameFr: "Mascara",
    nameAr: "معسكر",
    region: "HIGH_PLATEAUS",
    revenueDzd: 6500000,
    ordersCount: 510,
    activeUsers: 790,
    growthRatePct: 18.7,
    coordinates: { x: 250, y: 190, r: 15 },
  },
  {
    code: "30",
    nameFr: "Ouargla",
    nameAr: "ورقلة",
    region: "SAHARA",
    revenueDzd: 16400000,
    ordersCount: 1180,
    activeUsers: 1820,
    growthRatePct: 32.1,
    coordinates: { x: 480, y: 360, r: 22 },
  },
  {
    code: "31",
    nameFr: "Oran",
    nameAr: "وهران",
    region: "NORTH",
    revenueDzd: 28900000,
    ordersCount: 2550,
    activeUsers: 3980,
    growthRatePct: 39.5,
    coordinates: { x: 225, y: 160, r: 18 },
  },
  {
    code: "32",
    nameFr: "El Bayadh",
    nameAr: "البيض",
    region: "HIGH_PLATEAUS",
    revenueDzd: 3900000,
    ordersCount: 270,
    activeUsers: 430,
    growthRatePct: 13.5,
    coordinates: { x: 260, y: 290, r: 20 },
  },
  {
    code: "33",
    nameFr: "Illizi",
    nameAr: "إليزي",
    region: "SAHARA",
    revenueDzd: 4700000,
    ordersCount: 290,
    activeUsers: 480,
    growthRatePct: 16.0,
    coordinates: { x: 620, y: 480, r: 24 },
  },
  {
    code: "34",
    nameFr: "Bordj Bou Arréridj",
    nameAr: "برج بوعريريج",
    region: "HIGH_PLATEAUS",
    revenueDzd: 9100000,
    ordersCount: 760,
    activeUsers: 1210,
    growthRatePct: 26.2,
    coordinates: { x: 460, y: 170, r: 15 },
  },
  {
    code: "35",
    nameFr: "Boumerdès",
    nameAr: "بومرداس",
    region: "NORTH",
    revenueDzd: 11800000,
    ordersCount: 990,
    activeUsers: 1560,
    growthRatePct: 29.0,
    coordinates: { x: 400, y: 140, r: 14 },
  },
  {
    code: "36",
    nameFr: "El Tarf",
    nameAr: "الطارف",
    region: "NORTH",
    revenueDzd: 4600000,
    ordersCount: 360,
    activeUsers: 560,
    growthRatePct: 15.8,
    coordinates: { x: 650, y: 140, r: 14 },
  },
  {
    code: "37",
    nameFr: "Tindouf",
    nameAr: "تندوف",
    region: "SAHARA",
    revenueDzd: 3200000,
    ordersCount: 190,
    activeUsers: 320,
    growthRatePct: 11.2,
    coordinates: { x: 90, y: 490, r: 24 },
  },
  {
    code: "38",
    nameFr: "Tissemsilt",
    nameAr: "تيسمسيلت",
    region: "HIGH_PLATEAUS",
    revenueDzd: 3600000,
    ordersCount: 260,
    activeUsers: 410,
    growthRatePct: 13.0,
    coordinates: { x: 310, y: 180, r: 14 },
  },
  {
    code: "39",
    nameFr: "El Oued",
    nameAr: "الوادي",
    region: "SAHARA",
    revenueDzd: 10400000,
    ordersCount: 840,
    activeUsers: 1310,
    growthRatePct: 27.5,
    coordinates: { x: 570, y: 300, r: 20 },
  },
  {
    code: "40",
    nameFr: "Khenchela",
    nameAr: "خنشلة",
    region: "HIGH_PLATEAUS",
    revenueDzd: 4300000,
    ordersCount: 320,
    activeUsers: 510,
    growthRatePct: 14.7,
    coordinates: { x: 590, y: 220, r: 15 },
  },
  {
    code: "41",
    nameFr: "Souk Ahras",
    nameAr: "سوق أهراس",
    region: "HIGH_PLATEAUS",
    revenueDzd: 4800000,
    ordersCount: 370,
    activeUsers: 580,
    growthRatePct: 16.3,
    coordinates: { x: 630, y: 170, r: 14 },
  },
  {
    code: "42",
    nameFr: "Tipaza",
    nameAr: "تيبازة",
    region: "NORTH",
    revenueDzd: 9500000,
    ordersCount: 780,
    activeUsers: 1240,
    growthRatePct: 25.1,
    coordinates: { x: 340, y: 140, r: 14 },
  },
  {
    code: "43",
    nameFr: "Mila",
    nameAr: "ميلة",
    region: "HIGH_PLATEAUS",
    revenueDzd: 5800000,
    ordersCount: 450,
    activeUsers: 720,
    growthRatePct: 17.9,
    coordinates: { x: 520, y: 155, r: 14 },
  },
  {
    code: "44",
    nameFr: "Aïn Defla",
    nameAr: "عين الدفلى",
    region: "NORTH",
    revenueDzd: 6400000,
    ordersCount: 500,
    activeUsers: 780,
    growthRatePct: 18.4,
    coordinates: { x: 320, y: 165, r: 15 },
  },
  {
    code: "45",
    nameFr: "Naâma",
    nameAr: "النعامة",
    region: "HIGH_PLATEAUS",
    revenueDzd: 3500000,
    ordersCount: 240,
    activeUsers: 390,
    growthRatePct: 12.5,
    coordinates: { x: 180, y: 280, r: 18 },
  },
  {
    code: "46",
    nameFr: "Aïn Témouchent",
    nameAr: "عين تموشنت",
    region: "NORTH",
    revenueDzd: 6900000,
    ordersCount: 550,
    activeUsers: 870,
    growthRatePct: 20.8,
    coordinates: { x: 190, y: 170, r: 14 },
  },
  {
    code: "47",
    nameFr: "Ghardaïa",
    nameAr: "غرداية",
    region: "SAHARA",
    revenueDzd: 11500000,
    ordersCount: 890,
    activeUsers: 1420,
    growthRatePct: 28.9,
    coordinates: { x: 410, y: 330, r: 20 },
  },
  {
    code: "48",
    nameFr: "Relizane",
    nameAr: "غليزان",
    region: "HIGH_PLATEAUS",
    revenueDzd: 5700000,
    ordersCount: 440,
    activeUsers: 710,
    growthRatePct: 17.6,
    coordinates: { x: 270, y: 180, r: 15 },
  },
  {
    code: "49",
    nameFr: "Timimoun",
    nameAr: "تيميمون",
    region: "SAHARA",
    revenueDzd: 2900000,
    ordersCount: 180,
    activeUsers: 310,
    growthRatePct: 11.5,
    coordinates: { x: 310, y: 440, r: 20 },
  },
  {
    code: "50",
    nameFr: "Bordj Badji Mokhtar",
    nameAr: "برج باجي مختار",
    region: "SAHARA",
    revenueDzd: 1900000,
    ordersCount: 110,
    activeUsers: 180,
    growthRatePct: 9.8,
    coordinates: { x: 280, y: 720, r: 22 },
  },
  {
    code: "51",
    nameFr: "Ouled Djellal",
    nameAr: "أولاد جلال",
    region: "HIGH_PLATEAUS",
    revenueDzd: 3400000,
    ordersCount: 230,
    activeUsers: 390,
    growthRatePct: 13.2,
    coordinates: { x: 470, y: 260, r: 16 },
  },
  {
    code: "52",
    nameFr: "Béni Abbès",
    nameAr: "بني عباس",
    region: "SAHARA",
    revenueDzd: 2400000,
    ordersCount: 150,
    activeUsers: 250,
    growthRatePct: 10.5,
    coordinates: { x: 180, y: 440, r: 22 },
  },
  {
    code: "53",
    nameFr: "In Salah",
    nameAr: "عين صالح",
    region: "SAHARA",
    revenueDzd: 3100000,
    ordersCount: 190,
    activeUsers: 320,
    growthRatePct: 12.1,
    coordinates: { x: 390, y: 520, r: 22 },
  },
  {
    code: "54",
    nameFr: "In Guezzam",
    nameAr: "عين قزام",
    region: "SAHARA",
    revenueDzd: 1600000,
    ordersCount: 95,
    activeUsers: 150,
    growthRatePct: 8.9,
    coordinates: { x: 460, y: 780, r: 22 },
  },
  {
    code: "55",
    nameFr: "Touggourt",
    nameAr: "تقرت",
    region: "SAHARA",
    revenueDzd: 5800000,
    ordersCount: 420,
    activeUsers: 690,
    growthRatePct: 18.3,
    coordinates: { x: 530, y: 330, r: 18 },
  },
  {
    code: "56",
    nameFr: "Djanet",
    nameAr: "جانت",
    region: "SAHARA",
    revenueDzd: 2200000,
    ordersCount: 130,
    activeUsers: 220,
    growthRatePct: 10.0,
    coordinates: { x: 650, y: 640, r: 24 },
  },
  {
    code: "57",
    nameFr: "El M'Ghair",
    nameAr: "المغير",
    region: "SAHARA",
    revenueDzd: 3300000,
    ordersCount: 220,
    activeUsers: 370,
    growthRatePct: 12.9,
    coordinates: { x: 540, y: 280, r: 16 },
  },
  {
    code: "58",
    nameFr: "El Meniaa",
    nameAr: "المنيعة",
    region: "SAHARA",
    revenueDzd: 3600000,
    ordersCount: 240,
    activeUsers: 400,
    growthRatePct: 13.8,
    coordinates: { x: 380, y: 410, r: 20 },
  },
];

export type MetricType = "sales" | "orders" | "users" | "growth";
export type ViewMode = "map" | "grid" | "list";

export interface WilayaDensityMapProps {
  data?: WilayaData[];
  className?: string;
  onWilayaSelect?: (wilaya: WilayaData) => void;
  selectedWilayaCode?: string;
}

export function WilayaDensityMap({
  data = ALGERIAN_58_WILAYAS,
  className,
  onWilayaSelect,
  selectedWilayaCode,
}: WilayaDensityMapProps) {
  const { t } = useTranslations();
  const locale = useLocale();
  const [metric, setMetric] = useState<MetricType>("sales");
  const [viewMode, setViewMode] = useState<ViewMode>("map");
  const [regionFilter, setRegionFilter] = useState<WilayaRegion | "ALL">("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [hoveredWilaya, setHoveredWilaya] = useState<WilayaData | null>(null);
  const [activeWilaya, setActiveWilaya] = useState<WilayaData | null>(() => {
    return selectedWilayaCode
      ? data.find((w) => w.code === selectedWilayaCode) || data[15] // Default Algiers
      : data[15];
  });

  // Calculate National Averages and Totals
  const summary = useMemo(() => {
    const totalRev = data.reduce((acc, w) => acc + w.revenueDzd, 0);
    const totalOrders = data.reduce((acc, w) => acc + w.ordersCount, 0);
    const totalUsers = data.reduce((acc, w) => acc + w.activeUsers, 0);
    const avgRev = totalRev / data.length;
    const sorted = [...data].sort((a, b) => b.revenueDzd - a.revenueDzd);

    return {
      totalRevenueDzd: totalRev,
      totalOrders,
      totalUsers,
      avgRevenueDzd: avgRev,
      topWilaya: sorted[0],
      top3: sorted.slice(0, 3),
    };
  }, [data]);

  // Filtered dataset
  const filteredWilayas = useMemo(() => {
    return data.filter((w) => {
      const matchesRegion = regionFilter === "ALL" || w.region === regionFilter;
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        w.code.includes(q) ||
        w.nameFr.toLowerCase().includes(q) ||
        w.nameAr.includes(q);
      return matchesRegion && matchesSearch;
    });
  }, [data, regionFilter, searchQuery]);

  // Max value for density scale
  const maxMetricValue = useMemo(() => {
    if (metric === "sales") return Math.max(...data.map((w) => w.revenueDzd));
    if (metric === "orders") return Math.max(...data.map((w) => w.ordersCount));
    if (metric === "users") return Math.max(...data.map((w) => w.activeUsers));
    return Math.max(...data.map((w) => w.growthRatePct));
  }, [data, metric]);

  const getIntensityColor = (wilaya: WilayaData) => {
    let val = wilaya.revenueDzd;
    if (metric === "orders") val = wilaya.ordersCount;
    if (metric === "users") val = wilaya.activeUsers;
    if (metric === "growth") val = wilaya.growthRatePct;

    const ratio = Math.min(1, Math.max(0.12, val / maxMetricValue));

    // Gradient styling based on density ratio
    if (ratio > 0.75)
      return "fill-blue-600 dark:fill-blue-500 stroke-blue-800 text-white";
    if (ratio > 0.5)
      return "fill-blue-500/80 dark:fill-blue-600/80 stroke-blue-700 text-white";
    if (ratio > 0.3)
      return "fill-indigo-400/70 dark:fill-indigo-500/70 stroke-indigo-600 text-white";
    return "fill-slate-300/60 dark:fill-slate-700/60 stroke-slate-400 dark:stroke-slate-600 text-slate-700 dark:text-slate-300";
  };

  const getMetricDisplay = (w: WilayaData) => {
    if (metric === "sales") return `${w.revenueDzd.toLocaleString()} DZD`;
    if (metric === "orders")
      return `${w.ordersCount.toLocaleString()} ${t("component.bi.wilayaMap.metricOrders")}`;
    if (metric === "users")
      return `${w.activeUsers.toLocaleString()} ${t("component.bi.wilayaMap.metricActiveUsers")}`;
    return `+${w.growthRatePct.toFixed(1)}%`;
  };

  const handleSelect = (w: WilayaData) => {
    setActiveWilaya(w);
    onWilayaSelect?.(w);
  };

  return (
    <PodaciumCard
      className={cn(
        "p-4 sm:p-6 w-full rounded-2xl border border-border/80 bg-card/90 shadow-sm space-y-5 text-foreground overflow-hidden",
        className,
      )}
    >
      {/* Top Header & Metrics Banner */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-border/60">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600/10 text-blue-600 dark:text-blue-400">
              <MapPin className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold tracking-tight text-foreground flex items-center gap-2">
                {t("component.bi.wilayaMap.title")}
                <PodaciumBadge
                  variant="outline"
                  className="text-[10px] font-mono"
                >
                  {t("component.bi.wilayaMap.wilayasCount", { count: 58 })}
                </PodaciumBadge>
              </h3>
              <p className="text-xs text-muted-foreground">
                {t("component.bi.wilayaMap.subtitle")}
              </p>
            </div>
          </div>
        </div>

        {/* View Mode & Metric Switchers */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Metric Selector */}
          <div className="flex items-center bg-secondary/80 p-0.5 rounded-xl border border-border/60 text-xs font-medium">
            <button
              type="button"
              onClick={() => setMetric("sales")}
              className={cn(
                "px-2.5 py-1 rounded-lg transition-all flex items-center gap-1 cursor-pointer",
                metric === "sales"
                  ? "bg-primary text-primary-foreground shadow-xs font-semibold"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <DollarSign className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">
                {t("component.bi.wilayaMap.metricSales")}
              </span>
            </button>
            <button
              type="button"
              onClick={() => setMetric("orders")}
              className={cn(
                "px-2.5 py-1 rounded-lg transition-all flex items-center gap-1 cursor-pointer",
                metric === "orders"
                  ? "bg-primary text-primary-foreground shadow-xs font-semibold"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <ShoppingCart className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">
                {t("component.bi.wilayaMap.metricOrders")}
              </span>
            </button>
            <button
              type="button"
              onClick={() => setMetric("users")}
              className={cn(
                "px-2.5 py-1 rounded-lg transition-all flex items-center gap-1 cursor-pointer",
                metric === "users"
                  ? "bg-primary text-primary-foreground shadow-xs font-semibold"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Users className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">
                {t("component.bi.wilayaMap.metricActiveUsers")}
              </span>
            </button>
            <button
              type="button"
              onClick={() => setMetric("growth")}
              className={cn(
                "px-2.5 py-1 rounded-lg transition-all flex items-center gap-1 cursor-pointer",
                metric === "growth"
                  ? "bg-primary text-primary-foreground shadow-xs font-semibold"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <TrendingUp className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">
                {t("component.bi.wilayaMap.metricGrowth")}
              </span>
            </button>
          </div>

          {/* View Mode Toggle */}
          <div className="flex items-center bg-secondary/80 p-0.5 rounded-xl border border-border/60 text-xs">
            <button
              type="button"
              onClick={() => setViewMode("map")}
              className={cn(
                "p-1.5 rounded-lg transition-all cursor-pointer",
                viewMode === "map"
                  ? "bg-white dark:bg-slate-900 text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground",
              )}
              title={t("component.bi.wilayaMap.viewMap")}
            >
              <Layers className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setViewMode("grid")}
              className={cn(
                "p-1.5 rounded-lg transition-all cursor-pointer",
                viewMode === "grid"
                  ? "bg-white dark:bg-slate-900 text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground",
              )}
              title={t("component.bi.wilayaMap.viewGrid")}
            >
              <LayoutGrid className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setViewMode("list")}
              className={cn(
                "p-1.5 rounded-lg transition-all cursor-pointer",
                viewMode === "list"
                  ? "bg-white dark:bg-slate-900 text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground",
              )}
              title={t("component.bi.wilayaMap.viewList")}
            >
              <ListOrdered className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="p-3 rounded-xl bg-secondary/40 border border-border/70">
          <span className="text-[11px] text-muted-foreground font-medium">
            {t("component.bi.wilayaMap.totalRevenue")}
          </span>
          <div className="text-sm sm:text-base font-bold font-mono text-primary mt-0.5">
            {summary.totalRevenueDzd.toLocaleString()} DZD
          </div>
        </div>
        <div className="p-3 rounded-xl bg-secondary/40 border border-border/70">
          <span className="text-[11px] text-muted-foreground font-medium">
            {t("component.bi.wilayaMap.totalOrders")}
          </span>
          <div className="text-sm sm:text-base font-bold font-mono text-foreground mt-0.5">
            {summary.totalOrders.toLocaleString()}
          </div>
        </div>
        <div className="p-3 rounded-xl bg-secondary/40 border border-border/70">
          <span className="text-[11px] text-muted-foreground font-medium">
            {t("component.bi.wilayaMap.nationalAverage")}
          </span>
          <div className="text-sm sm:text-base font-bold font-mono text-foreground mt-0.5">
            {Math.round(summary.avgRevenueDzd).toLocaleString()} DZD
          </div>
        </div>
        <div className="p-3 rounded-xl bg-secondary/40 border border-border/70">
          <span className="text-[11px] text-muted-foreground font-medium">
            {t("component.bi.wilayaMap.topWilaya")}
          </span>
          <div className="text-sm sm:text-base font-bold text-foreground truncate mt-0.5">
            {summary.topWilaya.code} - {summary.topWilaya.nameFr}
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-2.5">
        <div className="relative w-full sm:w-72">
          <Search className="absolute start-3 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t("component.bi.wilayaMap.searchPlaceholder")}
            className="w-full rounded-xl border border-border/80 bg-background ps-9 pe-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground/70 focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>

        {/* Region Filter Buttons */}
        <div className="flex items-center gap-1 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
          <button
            type="button"
            onClick={() => setRegionFilter("ALL")}
            className={cn(
              "px-2.5 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer shrink-0",
              regionFilter === "ALL"
                ? "bg-primary text-primary-foreground font-semibold shadow-xs"
                : "text-muted-foreground hover:text-foreground bg-secondary/50",
            )}
          >
            {t("component.bi.wilayaMap.filterAll")}
          </button>
          <button
            type="button"
            onClick={() => setRegionFilter("NORTH")}
            className={cn(
              "px-2.5 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer shrink-0",
              regionFilter === "NORTH"
                ? "bg-primary text-primary-foreground font-semibold shadow-xs"
                : "text-muted-foreground hover:text-foreground bg-secondary/50",
            )}
          >
            {t("component.bi.wilayaMap.filterNorth")}
          </button>
          <button
            type="button"
            onClick={() => setRegionFilter("HIGH_PLATEAUS")}
            className={cn(
              "px-2.5 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer shrink-0",
              regionFilter === "HIGH_PLATEAUS"
                ? "bg-primary text-primary-foreground font-semibold shadow-xs"
                : "text-muted-foreground hover:text-foreground bg-secondary/50",
            )}
          >
            {t("component.bi.wilayaMap.filterHighPlateaus")}
          </button>
          <button
            type="button"
            onClick={() => setRegionFilter("SAHARA")}
            className={cn(
              "px-2.5 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer shrink-0",
              regionFilter === "SAHARA"
                ? "bg-primary text-primary-foreground font-semibold shadow-xs"
                : "text-muted-foreground hover:text-foreground bg-secondary/50",
            )}
          >
            {t("component.bi.wilayaMap.filterSahara")}
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      {viewMode === "map" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
          {/* SVG Map Container */}
          <div className="lg:col-span-8 rounded-2xl border border-border/80 bg-slate-950/90 dark:bg-slate-950 p-4 relative overflow-hidden shadow-inner flex flex-col items-center justify-center min-h-[440px]">
            {/* Algerian Geographic SVG Canvas */}
            <svg
              viewBox="0 0 760 840"
              className="w-full h-auto max-h-[520px] select-none"
            >
              {/* Background Geographic Mesh lines */}
              <defs>
                <pattern
                  id="geo-grid"
                  width="40"
                  height="40"
                  patternUnits="userSpaceOnUse"
                >
                  <path
                    d="M 40 0 L 0 0 0 40"
                    fill="none"
                    stroke="rgba(255, 255, 255, 0.04)"
                    strokeWidth="1"
                  />
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill="url(#geo-grid)" />

              {/* Geographic Region outlines */}
              <g className="opacity-40">
                <text
                  x="360"
                  y="110"
                  fill="#94a3b8"
                  fontSize="12"
                  fontWeight="bold"
                  textAnchor="middle"
                >
                  {t("component.bi.wilayaMap.regionNorth")}
                </text>
                <text
                  x="440"
                  y="215"
                  fill="#94a3b8"
                  fontSize="12"
                  fontWeight="bold"
                  textAnchor="middle"
                >
                  {t("component.bi.wilayaMap.regionHighPlateaus")}
                </text>
                <text
                  x="380"
                  y="580"
                  fill="#64748b"
                  fontSize="14"
                  fontWeight="bold"
                  textAnchor="middle"
                >
                  {t("component.bi.wilayaMap.regionSahara")}
                </text>
              </g>

              {/* Wilayas Interactive Nodes */}
              {filteredWilayas.map((w) => {
                const isSelected = activeWilaya?.code === w.code;
                const isHovered = hoveredWilaya?.code === w.code;
                const radius = w.coordinates.r || 16;

                return (
                  <g
                    key={w.code}
                    className="cursor-pointer transition-transform duration-150"
                    onClick={() => handleSelect(w)}
                    onMouseEnter={() => setHoveredWilaya(w)}
                    onMouseLeave={() => setHoveredWilaya(null)}
                  >
                    {/* Pulsing ring on selection */}
                    {isSelected && (
                      <circle
                        cx={w.coordinates.x}
                        cy={w.coordinates.y}
                        r={radius + 8}
                        className="fill-blue-500/20 stroke-blue-400 stroke-2 animate-pulse"
                      />
                    )}

                    {/* Wilaya Node circle */}
                    <circle
                      cx={w.coordinates.x}
                      cy={w.coordinates.y}
                      r={radius}
                      strokeWidth={isSelected ? 3 : isHovered ? 2 : 1.5}
                      className={cn(
                        "transition-all duration-200",
                        getIntensityColor(w),
                        isSelected &&
                          "stroke-white dark:stroke-white stroke-[3px] shadow-lg",
                      )}
                    />

                    {/* Wilaya Code Label */}
                    <text
                      cx={w.coordinates.x}
                      cy={w.coordinates.y}
                      x={w.coordinates.x}
                      y={w.coordinates.y + 4}
                      textAnchor="middle"
                      className="font-mono text-[10px] font-bold pointer-events-none fill-white"
                    >
                      {w.code}
                    </text>
                  </g>
                );
              })}
            </svg>

            {/* Hover Tooltip Overlay */}
            {hoveredWilaya && (
              <div className="absolute top-4 start-4 bg-slate-900/95 text-white p-3 rounded-xl border border-slate-700 shadow-xl pointer-events-none text-xs space-y-1 backdrop-blur-md animate-in fade-in-50 duration-150 z-20 max-w-[200px]">
                <div className="font-bold flex items-center justify-between gap-2">
                  <span>
                    {hoveredWilaya.code} - {hoveredWilaya.nameFr}
                  </span>
                  <span className="font-sans text-[11px] text-slate-400">
                    {hoveredWilaya.nameAr}
                  </span>
                </div>
                <div className="text-primary font-mono font-semibold">
                  {getMetricDisplay(hoveredWilaya)}
                </div>
                <div className="text-[10px] text-slate-400">
                  {hoveredWilaya.revenueDzd >= summary.avgRevenueDzd ? (
                    <span className="text-emerald-400 flex items-center gap-1">
                      <TrendingUp className="h-3 w-3" />
                      {t("component.bi.wilayaMap.aboveAverage")}
                    </span>
                  ) : (
                    <span className="text-amber-400 flex items-center gap-1">
                      <TrendingDown className="h-3 w-3" />
                      {t("component.bi.wilayaMap.belowAverage")}
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Active Wilaya Inspector Card */}
          <div className="lg:col-span-4 rounded-2xl border border-border/80 bg-secondary/20 p-4 space-y-4">
            {activeWilaya ? (
              <>
                <div className="flex items-center justify-between pb-3 border-b border-border/60">
                  <div>
                    <span className="text-[10px] font-mono font-bold uppercase text-primary">
                      {t("component.bi.wilayaMap.wilayaCode", {
                        code: activeWilaya.code,
                      })}
                    </span>
                    <h4 className="text-base font-bold text-foreground flex items-center gap-2">
                      {activeWilaya.nameFr}
                      <span className="text-xs font-normal text-muted-foreground font-sans">
                        ({activeWilaya.nameAr})
                      </span>
                    </h4>
                  </div>
                  <PodaciumBadge
                    variant={
                      activeWilaya.region === "NORTH"
                        ? "gradient"
                        : activeWilaya.region === "HIGH_PLATEAUS"
                          ? "default"
                          : "warning"
                    }
                    className="text-[10px]"
                  >
                    {activeWilaya.region}
                  </PodaciumBadge>
                </div>

                <div className="space-y-2.5 text-xs">
                  <div className="flex justify-between items-center py-1.5 border-b border-border/40">
                    <span className="text-muted-foreground">
                      {t("component.bi.wilayaMap.metricSales")}
                    </span>
                    <span className="font-mono font-bold text-foreground">
                      {activeWilaya.revenueDzd.toLocaleString()} DZD
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-1.5 border-b border-border/40">
                    <span className="text-muted-foreground">
                      {t("component.bi.wilayaMap.metricOrders")}
                    </span>
                    <span className="font-mono font-bold text-foreground">
                      {activeWilaya.ordersCount.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-1.5 border-b border-border/40">
                    <span className="text-muted-foreground">
                      {t("component.bi.wilayaMap.metricActiveUsers")}
                    </span>
                    <span className="font-mono font-bold text-foreground">
                      {activeWilaya.activeUsers.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-1.5 border-b border-border/40">
                    <span className="text-muted-foreground">
                      {t("component.bi.wilayaMap.metricGrowth")}
                    </span>
                    <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                      <TrendingUp className="h-3 w-3" />+
                      {activeWilaya.growthRatePct.toFixed(1)}%
                    </span>
                  </div>
                </div>

                {/* Benchmark Comparison Pill */}
                <div className="p-3 rounded-xl bg-background border border-border/60 text-xs space-y-1">
                  <div className="font-semibold text-foreground flex items-center gap-1.5">
                    <BarChart3 className="h-3.5 w-3.5 text-primary" />
                    <span>{t("component.bi.wilayaMap.nationalBenchmark")}</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    {activeWilaya.revenueDzd >= summary.avgRevenueDzd
                      ? `+${(((activeWilaya.revenueDzd - summary.avgRevenueDzd) / summary.avgRevenueDzd) * 100).toFixed(1)}% ${t("component.bi.wilayaMap.aboveAverage")}`
                      : `-${(((summary.avgRevenueDzd - activeWilaya.revenueDzd) / summary.avgRevenueDzd) * 100).toFixed(1)}% ${t("component.bi.wilayaMap.belowAverage")}`}
                  </p>
                </div>
              </>
            ) : (
              <div className="py-8 text-center text-xs text-muted-foreground">
                {t("component.bi.wilayaMap.noWilayaFound")}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Grid View */}
      {viewMode === "grid" && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2.5 max-h-[500px] overflow-y-auto p-1">
          {filteredWilayas.map((w) => {
            const isSelected = activeWilaya?.code === w.code;
            return (
              <button
                key={w.code}
                type="button"
                onClick={() => handleSelect(w)}
                className={cn(
                  "p-3 rounded-xl border text-start transition-all cursor-pointer flex flex-col justify-between",
                  isSelected
                    ? "border-primary bg-primary/10 shadow-sm"
                    : "border-border/70 bg-card hover:bg-secondary/40",
                )}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className="font-mono text-xs font-bold text-primary">
                    {w.code}
                  </span>
                  <span className="text-[10px] text-muted-foreground">
                    {w.region === "NORTH"
                      ? "N"
                      : w.region === "HIGH_PLATEAUS"
                        ? "HP"
                        : "S"}
                  </span>
                </div>
                <div className="font-semibold text-xs text-foreground truncate">
                  {w.nameFr}
                </div>
                <div className="font-mono text-[11px] text-muted-foreground mt-1 truncate">
                  {getMetricDisplay(w)}
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Ranked List View */}
      {viewMode === "list" && (
        <div className="rounded-xl border border-border/70 overflow-hidden max-h-[500px] overflow-y-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-secondary/60 text-muted-foreground font-medium sticky top-0 backdrop-blur-xs">
              <tr className="border-b border-border/80">
                <th className="py-2.5 px-3">#</th>
                <th className="py-2.5 px-3">
                  {t("component.bi.wilayaMap.colWilaya")}
                </th>
                <th className="py-2.5 px-3">
                  {t("component.bi.wilayaMap.colRegion")}
                </th>
                <th className="py-2.5 px-3 font-mono">
                  {t("component.bi.wilayaMap.metricSales")}
                </th>
                <th className="py-2.5 px-3 font-mono">
                  {t("component.bi.wilayaMap.metricOrders")}
                </th>
                <th className="py-2.5 px-3 font-mono">
                  {t("component.bi.wilayaMap.metricGrowth")}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {[...filteredWilayas]
                .sort((a, b) => b.revenueDzd - a.revenueDzd)
                .map((w, idx) => (
                  <tr
                    key={w.code}
                    onClick={() => handleSelect(w)}
                    className={cn(
                      "hover:bg-secondary/40 transition-colors cursor-pointer",
                      activeWilaya?.code === w.code &&
                        "bg-primary/10 font-semibold",
                    )}
                  >
                    <td className="py-2.5 px-3 font-mono text-muted-foreground">
                      {idx + 1}
                    </td>
                    <td className="py-2.5 px-3 text-foreground font-medium flex items-center gap-1.5">
                      <span className="font-mono text-primary font-bold">
                        {w.code}
                      </span>
                      <span>{w.nameFr}</span>
                      <span className="text-[10px] text-muted-foreground font-sans">
                        ({w.nameAr})
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-muted-foreground">
                      {w.region}
                    </td>
                    <td className="py-2.5 px-3 font-mono text-foreground">
                      {w.revenueDzd.toLocaleString()} DZD
                    </td>
                    <td className="py-2.5 px-3 font-mono text-muted-foreground">
                      {w.ordersCount.toLocaleString()}
                    </td>
                    <td className="py-2.5 px-3 font-mono text-emerald-600 dark:text-emerald-400">
                      +{w.growthRatePct.toFixed(1)}%
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      )}
    </PodaciumCard>
  );
}

export default WilayaDensityMap;
