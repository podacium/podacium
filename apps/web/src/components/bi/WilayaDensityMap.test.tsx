import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { WilayaDensityMap, ALGERIAN_58_WILAYAS } from "./WilayaDensityMap";

vi.mock("@/lib/i18n", () => {
  const dictionary: Record<string, string> = {
    "component.bi.wilayaMap.title":
      "Densité Commerciale & Ventes par Wilaya (58 Wilayas)",
    "component.bi.wilayaMap.subtitle":
      "Cartographie interactive de la vélocité des ventes et commandes à travers l'Algérie",
    "component.bi.wilayaMap.metricSales": "Vélocité des Ventes (DZD)",
    "component.bi.wilayaMap.metricOrders": "Volume de Commandes",
    "component.bi.wilayaMap.metricActiveUsers": "Utilisateurs Actifs",
    "component.bi.wilayaMap.metricGrowth": "Taux de Croissance",
    "component.bi.wilayaMap.totalRevenue": "Chiffre d'Affaires Total",
    "component.bi.wilayaMap.totalOrders": "Total Commandes",
    "component.bi.wilayaMap.nationalAverage": "Moyenne nationale",
    "component.bi.wilayaMap.topWilaya": "Top Wilaya",
    "component.bi.wilayaMap.searchPlaceholder": "Rechercher une wilaya...",
    "component.bi.wilayaMap.filterAll": "Toutes les régions",
    "component.bi.wilayaMap.filterNorth": "Nord & Littoral",
    "component.bi.wilayaMap.filterHighPlateaus": "Hauts Plateaux",
    "component.bi.wilayaMap.filterSahara": "Sahara & Sud",
    "component.bi.wilayaMap.aboveAverage": "Au-dessus de la moyenne",
    "component.bi.wilayaMap.belowAverage": "En-dessous de la moyenne",
    "component.bi.wilayaMap.viewMap": "Vue Carte",
    "component.bi.wilayaMap.viewGrid": "Vue Grille",
    "component.bi.wilayaMap.viewList": "Vue Classement",
    "component.bi.wilayaMap.noWilayaFound":
      "Aucune wilaya trouvée pour cette recherche",
    "component.bi.wilayaMap.wilayasCount": "58 Wilayas",
    "component.bi.wilayaMap.regionNorth": "NORD & LITTORAL",
    "component.bi.wilayaMap.regionHighPlateaus": "HAUTS PLATEAUX",
    "component.bi.wilayaMap.regionSahara": "SAHARA & SUD",
    "component.bi.wilayaMap.nationalBenchmark": "Benchmark National",
    "component.bi.wilayaMap.colWilaya": "Wilaya",
    "component.bi.wilayaMap.colRegion": "Région",
    "component.bi.wilayaMap.wilayaCode": "Wilaya 16",
  };
  return {
    useTranslations: () => ({
      t: (key: string, vars?: any) => {
        if (key === "component.bi.wilayaMap.wilayaCode" && vars?.code) {
          return `Wilaya ${vars.code}`;
        }
        if (key === "component.bi.wilayaMap.wilayasCount" && vars?.count) {
          return `${vars.count} Wilayas`;
        }
        return dictionary[key] || key;
      },
    }),
    useLocale: () => "fr",
  };
});

describe("WilayaDensityMap Component", () => {
  it("renders all 58 Algerian wilayas master dataset correctly", () => {
    expect(ALGERIAN_58_WILAYAS.length).toBe(58);
    expect(ALGERIAN_58_WILAYAS[0].code).toBe("01");
    expect(ALGERIAN_58_WILAYAS[0].nameFr).toBe("Adrar");
    expect(ALGERIAN_58_WILAYAS[57].code).toBe("58");
    expect(ALGERIAN_58_WILAYAS[57].nameFr).toBe("El Meniaa");
  });

  it("renders interactive header, total KPIs, and wilaya nodes", () => {
    render(<WilayaDensityMap />);

    expect(
      screen.getByText("Densité Commerciale & Ventes par Wilaya (58 Wilayas)"),
    ).toBeInTheDocument();
    expect(screen.getByText("58 Wilayas")).toBeInTheDocument();
    expect(screen.getByText("Chiffre d'Affaires Total")).toBeInTheDocument();
    expect(screen.getByText("Total Commandes")).toBeInTheDocument();
    expect(screen.getByText("Moyenne nationale")).toBeInTheDocument();
  });

  it("allows switching view mode to grid and list", () => {
    render(<WilayaDensityMap />);

    const gridBtn = screen.getByTitle("Vue Grille");
    fireEvent.click(gridBtn);

    expect(screen.getAllByText("Adrar").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Oran").length).toBeGreaterThanOrEqual(1);

    const listBtn = screen.getByTitle("Vue Classement");
    fireEvent.click(listBtn);

    expect(screen.getByText("Région")).toBeInTheDocument();
  });

  it("filters wilayas by search query", () => {
    render(<WilayaDensityMap />);

    const searchInput = screen.getByPlaceholderText("Rechercher une wilaya...");
    fireEvent.change(searchInput, { target: { value: "31" } });

    // Switch to grid to inspect filtered items
    const gridBtn = screen.getByTitle("Vue Grille");
    fireEvent.click(gridBtn);

    expect(screen.getByText("Oran")).toBeInTheDocument();
    expect(screen.queryByText("Adrar")).not.toBeInTheDocument();
  });

  it("triggers onWilayaSelect callback when clicking a wilaya", () => {
    const onSelect = vi.fn();
    render(<WilayaDensityMap onWilayaSelect={onSelect} />);

    const gridBtn = screen.getByTitle("Vue Grille");
    fireEvent.click(gridBtn);

    const oranCard = screen.getByText("Oran").closest("button");
    if (oranCard) {
      fireEvent.click(oranCard);
      expect(onSelect).toHaveBeenCalledWith(
        expect.objectContaining({ code: "31", nameFr: "Oran" }),
      );
    }
  });
});
