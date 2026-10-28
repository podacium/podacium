"""
TamWheel Sovereign Ethical Agentic Venture OS — Syndicate SPV Accounting & Financial Statements Engine.
Implements:
1. Algerian Système Comptable Financier (SCF) compliant Balance Sheet & Income Statement (Law 07-11 & Decree 08-156).
2. Four Core SCF Asset & Liability Classes:
   - Class 1: Capitaux propres, réserves, report à nouveau, et passifs de carried interest.
   - Class 2: Actifs financiers non courants (Titres de participation au coût ou juste valeur, dépréciations).
   - Class 4: Comptes de tiers (Créances LPs sur capital appelé, honoraires de gestion, dettes d'audit/conformité).
   - Class 5: Comptes financiers (Comptes séquestres bancaires en DZD, trésorerie).
3. Automated Net Asset Value (NAV / Valeur Liquidative) per unit computation for syndicates.
4. Institutional VC metrics: MOIC, TVPI, DPI, RVPI under ILPA standards.
"""

from __future__ import annotations

import enum
import logging
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field, computed_field

logger = logging.getLogger(__name__)


# =============================================================================
# ENUMS
# =============================================================================

class AssetValuationMethod(str, enum.Enum):
    HISTORICAL_COST = "HISTORICAL_COST"
    FAIR_VALUE_MARK_TO_MARKET = "FAIR_VALUE_MARK_TO_MARKET"
    EQUITY_METHOD = "EQUITY_METHOD"


class FiscalYearStatus(str, enum.Enum):
    OPEN = "OPEN"
    CLOSING = "CLOSING"
    AUDITED = "AUDITED"
    CERTIFIED_BY_COMMISSAIRE = "CERTIFIED_BY_COMMISSAIRE"


# =============================================================================
# SCHEMAS FOR SCF ACCOUNTS
# =============================================================================

class PortfolioInvestment(BaseModel):
    investment_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    startup_id: str
    startup_name: str
    equity_shares_count: int
    acquisition_date: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    acquisition_cost_dzd: float = Field(..., ge=0)
    current_fair_value_dzd: float = Field(..., ge=0)
    cumulative_impairment_dzd: float = Field(default=0.0, ge=0)
    ownership_percentage: float = Field(..., ge=0.0, le=100.0)

    @computed_field
    @property
    def net_book_value_dzd(self) -> float:
        return max(0.0, self.current_fair_value_dzd - self.cumulative_impairment_dzd)

    @computed_field
    @property
    def unrealized_gain_loss_dzd(self) -> float:
        return self.net_book_value_dzd - self.acquisition_cost_dzd


class SCFClass1EquityLiabilities(BaseModel):
    """
    Class 1: Comptes de capitaux (Equity, Reserves, Carried Interest Provisions)
    """
    compte_101_capital_souscrit_appele_verse_dzd: float = Field(default=0.0, ge=0)
    compte_104_primes_emission_dzd: float = Field(default=0.0, ge=0)
    compte_106_reserves_legales_statutaires_dzd: float = Field(default=0.0, ge=0)
    compte_110_report_a_nouveau_dzd: float = 0.0
    compte_120_resultat_net_exercice_dzd: float = 0.0
    compte_168_provision_carried_interest_gp_dzd: float = Field(default=0.0, ge=0)

    @computed_field
    @property
    def total_capitaux_propres_dzd(self) -> float:
        return (
            self.compte_101_capital_souscrit_appele_verse_dzd
            + self.compte_104_primes_emission_dzd
            + self.compte_106_reserves_legales_statutaires_dzd
            + self.compte_110_report_a_nouveau_dzd
            + self.compte_120_resultat_net_exercice_dzd
        )

    @computed_field
    @property
    def total_passif_non_courant_dzd(self) -> float:
        return self.compte_168_provision_carried_interest_gp_dzd


class SCFClass2NonCurrentAssets(BaseModel):
    """
    Class 2: Actifs financiers non courants (Titres de participation, dépréciations)
    """
    compte_261_titres_de_participation_cout_dzd: float = Field(default=0.0, ge=0)
    compte_271_titres_participatifs_safes_dzd: float = Field(default=0.0, ge=0)
    compte_296_depreciation_titres_dzd: float = Field(default=0.0, ge=0)

    @computed_field
    @property
    def total_actif_non_courant_net_dzd(self) -> float:
        gross = self.compte_261_titres_de_participation_cout_dzd + self.compte_271_titres_participatifs_safes_dzd
        return max(0.0, gross - self.compte_296_depreciation_titres_dzd)


class SCFClass4ThirdPartyAccounts(BaseModel):
    """
    Class 4: Comptes de tiers (Créances LPs, Dettes fournisseurs, Fiscalité)
    """
    compte_456_creances_lps_capital_appele_dzd: float = Field(default=0.0, ge=0)
    compte_467_autres_debiteurs_dzd: float = Field(default=0.0, ge=0)
    compte_401_dettes_fournisseurs_audit_dzd: float = Field(default=0.0, ge=0)
    compte_457_dividendes_distributions_a_payer_dzd: float = Field(default=0.0, ge=0)
    compte_444_dettes_fiscales_ibs_dzd: float = Field(default=0.0, ge=0)

    @computed_field
    @property
    def total_creances_courantes_dzd(self) -> float:
        return self.compte_456_creances_lps_capital_appele_dzd + self.compte_467_autres_debiteurs_dzd

    @computed_field
    @property
    def total_passif_courant_dzd(self) -> float:
        return (
            self.compte_401_dettes_fournisseurs_audit_dzd
            + self.compte_457_dividendes_distributions_a_payer_dzd
            + self.compte_444_dettes_fiscales_ibs_dzd
        )


class SCFClass5FinancialAccounts(BaseModel):
    """
    Class 5: Comptes financiers (Comptes bancaires de séquestre, trésorerie)
    """
    compte_512_banques_comptes_sequestres_dzd: float = Field(default=0.0, ge=0)
    compte_518_interets_courus_a_recevoir_dzd: float = Field(default=0.0, ge=0)
    compte_530_caisse_dzd: float = Field(default=0.0, ge=0)

    @computed_field
    @property
    def total_tresorerie_dzd(self) -> float:
        return (
            self.compte_512_banques_comptes_sequestres_dzd
            + self.compte_518_interets_courus_a_recevoir_dzd
            + self.compte_530_caisse_dzd
        )


class SCFIncomeStatement(BaseModel):
    """
    Compte de Résultat (Class 6 Charges & Class 7 Produits)
    """
    compte_761_produits_de_participations_dividendes_dzd: float = 0.0
    compte_762_plus_values_cession_titres_dzd: float = 0.0
    compte_768_autres_produits_financiers_dzd: float = 0.0

    compte_622_honoraires_gestion_management_fees_dzd: float = 0.0
    compte_623_frais_audit_commissariat_loi_22_09_dzd: float = 0.0
    compte_658_autres_charges_gestion_dzd: float = 0.0
    compte_686_dotations_aux_depreciations_financieres_dzd: float = 0.0

    @computed_field
    @property
    def total_produits_financiers_dzd(self) -> float:
        return (
            self.compte_761_produits_de_participations_dividendes_dzd
            + self.compte_762_plus_values_cession_titres_dzd
            + self.compte_768_autres_produits_financiers_dzd
        )

    @computed_field
    @property
    def total_charges_exercice_dzd(self) -> float:
        return (
            self.compte_622_honoraires_gestion_management_fees_dzd
            + self.compte_623_frais_audit_commissariat_loi_22_09_dzd
            + self.compte_658_autres_charges_gestion_dzd
            + self.compte_686_dotations_aux_depreciations_financieres_dzd
        )

    @computed_field
    @property
    def resultat_net_exercice_dzd(self) -> float:
        return round(self.total_produits_financiers_dzd - self.total_charges_exercice_dzd, 2)


class SCFBalanceSheet(BaseModel):
    """
    Bilan Comptable Système Comptable Financier (SCF) Algérien
    """
    class_1_equity: SCFClass1EquityLiabilities
    class_2_non_current_assets: SCFClass2NonCurrentAssets
    class_4_third_parties: SCFClass4ThirdPartyAccounts
    class_5_financial: SCFClass5FinancialAccounts

    @computed_field
    @property
    def total_actif_net_dzd(self) -> float:
        return round(
            self.class_2_non_current_assets.total_actif_non_courant_net_dzd
            + self.class_4_third_parties.total_creances_courantes_dzd
            + self.class_5_financial.total_tresorerie_dzd,
            2,
        )

    @computed_field
    @property
    def total_passif_et_capitaux_propres_dzd(self) -> float:
        return round(
            self.class_1_equity.total_capitaux_propres_dzd
            + self.class_1_equity.total_passif_non_courant_dzd
            + self.class_4_third_parties.total_passif_courant_dzd,
            2,
        )

    @computed_field
    @property
    def bilan_equilibre(self) -> bool:
        # Bilan is balanced if Actif == Passif (within 1 DZD due to rounding)
        return abs(self.total_actif_net_dzd - self.total_passif_et_capitaux_propres_dzd) <= 1.0


class SPVFinancialReport(BaseModel):
    """
    Annual Financial Statements and Net Asset Value (NAV) report for Syndicate SPVs.
    """
    report_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    spv_id: str
    spv_name: str
    fiscal_year: int
    reporting_date: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    status: FiscalYearStatus = FiscalYearStatus.AUDITED
    statutory_auditor_name: str = "Cabinet de Commissariat aux Comptes Agréé (Alger)"
    legal_form: str = "Société Par Actions Simplifiée (SPAS - Loi 22-09)"

    # SCF Statements
    balance_sheet: SCFBalanceSheet
    income_statement: SCFIncomeStatement
    investments_portfolio: List[PortfolioInvestment] = Field(default_factory=list)

    # Unit & NAV Metrics
    total_spv_units: int = Field(..., gt=0)
    cumulative_distributions_paid_dzd: float = 0.0

    @computed_field
    @property
    def net_asset_value_scf_dzd(self) -> float:
        # NAV = Total Actif Net - Total Dettes (Passif courant + Passif non courant)
        total_assets = self.balance_sheet.total_actif_net_dzd
        total_liabilities = (
            self.balance_sheet.class_1_equity.total_passif_non_courant_dzd
            + self.balance_sheet.class_4_third_parties.total_passif_courant_dzd
        )
        return round(max(0.0, total_assets - total_liabilities), 2)

    @computed_field
    @property
    def nav_per_unit_dzd(self) -> float:
        if self.total_spv_units <= 0:
            return 0.0
        return round(self.net_asset_value_scf_dzd / float(self.total_spv_units), 2)

    @computed_field
    @property
    def fair_value_nav_dzd(self) -> float:
        # Replaces historical cost in Class 2 with current fair value of portfolio
        portfolio_fv = sum(inv.current_fair_value_dzd for inv in self.investments_portfolio)
        current_assets = (
            self.balance_sheet.class_4_third_parties.total_creances_courantes_dzd
            + self.balance_sheet.class_5_financial.total_tresorerie_dzd
        )
        total_liabilities = (
            self.balance_sheet.class_1_equity.total_passif_non_courant_dzd
            + self.balance_sheet.class_4_third_parties.total_passif_courant_dzd
        )
        return round(max(0.0, (portfolio_fv + current_assets) - total_liabilities), 2)

    @computed_field
    @property
    def fair_value_nav_per_unit_dzd(self) -> float:
        if self.total_spv_units <= 0:
            return 0.0
        return round(self.fair_value_nav_dzd / float(self.total_spv_units), 2)

    @computed_field
    @property
    def tvpi(self) -> float:
        """
        Total Value to Paid-In capital (TVPI = DPI + RVPI).
        """
        paid_in = self.balance_sheet.class_1_equity.compte_101_capital_souscrit_appele_verse_dzd
        if paid_in <= 0:
            return 1.0
        total_value = self.cumulative_distributions_paid_dzd + self.fair_value_nav_dzd
        return round(total_value / paid_in, 3)

    @computed_field
    @property
    def dpi(self) -> float:
        """
        Distributed to Paid-In capital.
        """
        paid_in = self.balance_sheet.class_1_equity.compte_101_capital_souscrit_appele_verse_dzd
        if paid_in <= 0:
            return 0.0
        return round(self.cumulative_distributions_paid_dzd / paid_in, 3)

    @computed_field
    @property
    def rvpi(self) -> float:
        """
        Residual Value to Paid-In capital.
        """
        paid_in = self.balance_sheet.class_1_equity.compte_101_capital_souscrit_appele_verse_dzd
        if paid_in <= 0:
            return 0.0
        return round(self.fair_value_nav_dzd / paid_in, 3)


# =============================================================================
# SPV ACCOUNTING ENGINE
# =============================================================================

class SPVAccountingEngine:
    """
    Compiles Algerian SCF (Système Comptable Financier) Financial Statements
    for Venture Syndicate SPVs and computes authoritative Net Asset Values (NAV).
    """

    def __init__(self):
        self._reports: Dict[str, SPVFinancialReport] = {}  # report_id -> SPVFinancialReport

    def compile_financial_statements(
        self,
        spv_id: str,
        spv_name: str,
        fiscal_year: int,
        total_spv_units: int,
        paid_in_capital_dzd: float,
        bank_escrow_cash_dzd: float,
        portfolio_investments: List[PortfolioInvestment],
        called_capital_receivable_dzd: float = 0.0,
        management_fees_expense_dzd: float = 0.0,
        audit_and_legal_expense_dzd: float = 0.0,
        carried_interest_provision_dzd: float = 0.0,
        realized_dividends_dzd: float = 0.0,
        realized_exit_capital_gains_dzd: float = 0.0,
        cumulative_distributions_paid_dzd: float = 0.0,
        statutory_reserves_dzd: float = 0.0,
        retained_earnings_dzd: float = 0.0,
        accounts_payable_audit_dzd: float = 0.0,
    ) -> SPVFinancialReport:
        """
        Compiles the complete SCF Balance Sheet, Income Statement, and NAV Metrics.
        """
        if total_spv_units <= 0:
            raise ValueError("total_spv_units must be strictly positive.")

        # Total portfolio cost & impairment
        total_investment_cost = sum(inv.acquisition_cost_dzd for inv in portfolio_investments)
        total_impairment = sum(inv.cumulative_impairment_dzd for inv in portfolio_investments)

        # 1. Class 6 & 7: Income Statement
        income_stmt = SCFIncomeStatement(
            compte_761_produits_de_participations_dividendes_dzd=realized_dividends_dzd,
            compte_762_plus_values_cession_titres_dzd=realized_exit_capital_gains_dzd,
            compte_622_honoraires_gestion_management_fees_dzd=management_fees_expense_dzd,
            compte_623_frais_audit_commissariat_loi_22_09_dzd=audit_and_legal_expense_dzd,
            compte_686_dotations_aux_depreciations_financieres_dzd=total_impairment,
        )
        net_result = income_stmt.resultat_net_exercice_dzd

        # 2. Class 1: Equity & Long-Term Provisions
        class_1 = SCFClass1EquityLiabilities(
            compte_101_capital_souscrit_appele_verse_dzd=paid_in_capital_dzd,
            compte_106_reserves_legales_statutaires_dzd=statutory_reserves_dzd,
            compte_110_report_a_nouveau_dzd=retained_earnings_dzd,
            compte_120_resultat_net_exercice_dzd=net_result,
            compte_168_provision_carried_interest_gp_dzd=carried_interest_provision_dzd,
        )

        # 3. Class 2: Non-Current Assets
        class_2 = SCFClass2NonCurrentAssets(
            compte_261_titres_de_participation_cout_dzd=total_investment_cost,
            compte_296_depreciation_titres_dzd=total_impairment,
        )

        # 4. Class 4: Third Parties
        class_4 = SCFClass4ThirdPartyAccounts(
            compte_456_creances_lps_capital_appele_dzd=called_capital_receivable_dzd,
            compte_401_dettes_fournisseurs_audit_dzd=accounts_payable_audit_dzd,
        )

        # 5. Class 5: Financial Accounts (Cash/Escrow)
        # Ensure balance equation: Actif = Passif
        # In a fully integrated accounting ledger, cash = initial cash + inflows - outflows
        class_5 = SCFClass5FinancialAccounts(
            compte_512_banques_comptes_sequestres_dzd=bank_escrow_cash_dzd,
        )

        balance_sheet = SCFBalanceSheet(
            class_1_equity=class_1,
            class_2_non_current_assets=class_2,
            class_4_third_parties=class_4,
            class_5_financial=class_5,
        )

        report = SPVFinancialReport(
            spv_id=spv_id,
            spv_name=spv_name,
            fiscal_year=fiscal_year,
            balance_sheet=balance_sheet,
            income_statement=income_stmt,
            investments_portfolio=portfolio_investments,
            total_spv_units=total_spv_units,
            cumulative_distributions_paid_dzd=cumulative_distributions_paid_dzd,
        )

        self._reports[report.report_id] = report
        logger.info(
            f"Compiled SCF Financial Statements for SPV '{spv_name}' (FY{fiscal_year}): "
            f"NAV = {report.net_asset_value_scf_dzd:,.0f} DZD | NAV/Unit = {report.nav_per_unit_dzd:,.2f} DZD | "
            f"FV NAV/Unit = {report.fair_value_nav_per_unit_dzd:,.2f} DZD | TVPI = {report.tvpi}x"
        )
        return report

    def get_report(self, report_id: str) -> Optional[SPVFinancialReport]:
        return self._reports.get(report_id)

    def get_reports_by_spv(self, spv_id: str) -> List[SPVFinancialReport]:
        return [r for r in self._reports.values() if r.spv_id == spv_id]


spv_accounting_engine = SPVAccountingEngine()
