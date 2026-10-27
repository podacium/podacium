"""
Podacium Financial Projection Model
====================================
Launch: September 23, 2026
Horizon: Sep 23, 2026 → December 31, 2028 (~27 months)

Calculates monthly MRR, Net Profit, and Founders' Salaries.

USAGE:
    python scripts/financial_model.py                  # Default parameters
    python scripts/financial_model.py --scenario bear  # Bear case
    python scripts/financial_model.py --scenario bull  # Bull case
    python scripts/financial_model.py --output-csv     # Export to CSV

All monetary values in Algerian Dinar (DZD) unless noted as USD.
1 USD ≈ 145 DZD (official rate used in BUSINESS_PLAN.md, Section 9.5)
"""

import argparse
import csv
import math
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from typing import Dict, List, Tuple

# ╔══════════════════════════════════════════════════════════════════════╗
# ║  SECTION 1: PARAMETERS — Extract these from your codebase/docs     ║
# ╚══════════════════════════════════════════════════════════════════════╝

# ── 1a. Pricing Tiers (from docs/PRICING_RECOMMENDATION.md §4) ────────

EDTECH_TIERS = {
    "Free":    {"price": 0,     "hub_proposals": 0,  "has_ai": False, "has_certs": False},
    "Starter": {"price": 1_900, "hub_proposals": 0,  "has_ai": False, "has_certs": False},
    "Plus":    {"price": 4_900, "hub_proposals": 10, "has_ai": True,  "has_certs": 2},
    "Pro":     {"price": 8_900, "hub_proposals": -1, "has_ai": True,  "has_certs": -1},
}

HUB_TIERS = {
    "Free":    {"price": 0,     "proposals": 0},
    "Lite":    {"price": 600,   "proposals": 1},
    "Starter": {"price": 1_900, "proposals": 5},
    "Plus":    {"price": 3_900, "proposals": 20},
    "Pro":     {"price": 7_900, "proposals": -1},
}

BI_TIERS = {
    "Basic":      {"price": 999,   "dashboards": 1,  "health_score": False},
    "Starter":    {"price": 4_900, "dashboards": 3,  "health_score": True},
    "Growth":     {"price": 9_900, "dashboards": 10, "health_score": True},
    "Enterprise": {"price": 24_900,"dashboards": -1, "health_score": True},
}

CAPTIVE_PRODUCTS = {
    "ai_toolbox":           {"price": 1_500,  "type": "monthly",  "margin": 0.90},
    "skill_passport":       {"price": 2_500,  "type": "one_time", "margin": 0.98},
    "rush_cert":            {"price": 3_500,  "type": "one_time", "margin": 0.98},
    "featured_project":     {"price": 800,    "type": "per_unit", "margin": 0.95},
    "talent_search":        {"price": 2_500,  "type": "per_unit", "margin": 0.97},
    "proposal_credit":      {"price": 500,    "type": "per_unit", "margin": 0.95},
    "verified_badge":       {"price": 1_500,  "type": "monthly",  "margin": 0.92},
    "featured_freelancer":  {"price": 1_200,  "type": "monthly",  "margin": 0.95},
    "data_export":          {"price": 500,    "type": "per_unit", "margin": 0.99},
}

DIASPORA_MONTHLY_EUR = 12.0
EUR_TO_DZD = 150  # ~1 EUR = 150 DZD (approximate)

# ── 1b. User Growth Parameters (from BUSINESS_PLAN.md §9.4, adjusted) ─

@dataclass
class ScenarioParams:
    name: str
    description: str

    # --- User acquisition ---
    initial_waitlist: int       # Pre-launch signups
    waitlist_to_registered: float  # Conversion rate
    monthly_organic_growth: float  # New registered users per month (organic)
    
    # --- Conversion & Retention ---
    free_to_paid_pct: float     # Free → paid subscription conversion
    monthly_churn_edtech: float # Monthly churn rate for EdTech
    monthly_churn_bi: float     # Monthly churn rate for BI SaaS
    monthly_churn_hub: float    # Monthly churn rate for Hub standalone

    # --- Tier Mix (of paid EdTech users) ---
    pct_starter: float
    pct_plus: float
    pct_pro: float

    # --- BI adoption (of total registered) ---
    bi_pct_registered: float    # % registered users who subscribe to BI
    bi_tier_split_starter: float  # Of BI users, % on Starter
    bi_tier_split_growth: float   # Of BI users, % on Growth
    
    # --- Hub Standalone adoption ---
    hub_pct_paid_users: float
    
    # --- Captive uptake (as % of relevant active users per month) ---
    ai_toolbox_pct: float
    skill_passport_pct: float
    featured_project_pct: float
    talent_search_pct: float
    verified_badge_pct: float
    data_export_pct: float

    # --- Costs ---
    infrastructure_usd: float    # Monthly infra (USD)
    ai_api_usd: float            # Monthly AI inference (USD)
    third_party_services_usd: float
    marketing_usd: float         # Monthly ad spend (USD)
    instructor_upfront_dzd: float
    instructor_rev_share: float
    chargily_fee_pct: float
    vat_rate: float              # 19% pre-Startup Label; 0% after
    startup_label_month: int     # Month index when Startup Label exempts VAT

    # --- Growth accelerator ---
    marketing_multiplier: float  # How much ads multiply organic growth


# ── 1c. Scenarios (calibrated from docs/PRICING_RECOMMENDATION.md §15) ─

BASE_CASE = ScenarioParams(
    name="base",
    description="Realistic: 4% conversion, 7% EdTech churn, light ads (Tier B)",
    initial_waitlist=2_500,
    waitlist_to_registered=0.25,
    monthly_organic_growth=600,
    free_to_paid_pct=0.04,
    monthly_churn_edtech=0.07,
    monthly_churn_bi=0.03,
    monthly_churn_hub=0.06,
    pct_starter=0.40,
    pct_plus=0.45,
    pct_pro=0.15,
    bi_pct_registered=0.015,
    bi_tier_split_starter=0.60,
    bi_tier_split_growth=0.30,
    hub_pct_paid_users=0.12,
    ai_toolbox_pct=0.15,
    skill_passport_pct=0.08,
    featured_project_pct=0.05,
    talent_search_pct=0.03,
    verified_badge_pct=0.04,
    data_export_pct=0.02,
    infrastructure_usd=400,
    ai_api_usd=10,
    third_party_services_usd=60,
    marketing_usd=600,   # Tier B: $600/mo TikTok minimum
    instructor_upfront_dzd=30_000,
    instructor_rev_share=0.20,
    chargily_fee_pct=0.0125,
    vat_rate=0.19,
    startup_label_month=4,  # Label approved month 4 (Dec 2026/Jan 2027)
    marketing_multiplier=2.0,
)

BEAR_CASE = ScenarioParams(
    name="bear",
    description="Conservative: 2% conversion, 10% EdTech churn, organic only",
    initial_waitlist=1_500,
    waitlist_to_registered=0.20,
    monthly_organic_growth=300,
    free_to_paid_pct=0.02,
    monthly_churn_edtech=0.10,
    monthly_churn_bi=0.05,
    monthly_churn_hub=0.08,
    pct_starter=0.50,
    pct_plus=0.35,
    pct_pro=0.15,
    bi_pct_registered=0.008,
    bi_tier_split_starter=0.70,
    bi_tier_split_growth=0.25,
    hub_pct_paid_users=0.08,
    ai_toolbox_pct=0.08,
    skill_passport_pct=0.04,
    featured_project_pct=0.02,
    talent_search_pct=0.01,
    verified_badge_pct=0.02,
    data_export_pct=0.01,
    infrastructure_usd=350,
    ai_api_usd=5,
    third_party_services_usd=40,
    marketing_usd=0,      # Organic only
    instructor_upfront_dzd=30_000,
    instructor_rev_share=0.20,
    chargily_fee_pct=0.0125,
    vat_rate=0.19,
    startup_label_month=5,
    marketing_multiplier=1.0,
)

BULL_CASE = ScenarioParams(
    name="bull",
    description="Optimistic: 6% conversion, 5% EdTech churn, moderate ads (Tier D)",
    initial_waitlist=3_500,
    waitlist_to_registered=0.30,
    monthly_organic_growth=800,
    free_to_paid_pct=0.06,
    monthly_churn_edtech=0.05,
    monthly_churn_bi=0.02,
    monthly_churn_hub=0.04,
    pct_starter=0.30,
    pct_plus=0.50,
    pct_pro=0.20,
    bi_pct_registered=0.025,
    bi_tier_split_starter=0.50,
    bi_tier_split_growth=0.35,
    hub_pct_paid_users=0.15,
    ai_toolbox_pct=0.20,
    skill_passport_pct=0.12,
    featured_project_pct=0.08,
    talent_search_pct=0.05,
    verified_badge_pct=0.06,
    data_export_pct=0.03,
    infrastructure_usd=500,
    ai_api_usd=15,
    third_party_services_usd=80,
    marketing_usd=1_200,  # Tier D: diversified ads
    instructor_upfront_dzd=30_000,
    instructor_rev_share=0.20,
    chargily_fee_pct=0.0125,
    vat_rate=0.19,
    startup_label_month=3,
    marketing_multiplier=3.0,
)

SCENARIOS = {s.name: s for s in [BASE_CASE, BEAR_CASE, BULL_CASE]}


# ╔══════════════════════════════════════════════════════════════════════╗
# ║  SECTION 2: FINANCIAL ENGINE                                      ║
# ╚══════════════════════════════════════════════════════════════════════╝

@dataclass
class MonthSnapshot:
    """One month's financial state."""
    month_index: int           # 0 = Sep 2026 (launch)
    label: str                 # "Sep 2026"

    # Users
    registered_cumulative: int
    paid_edtech: int
    paid_hub: int
    paid_bi: int
    total_paid_users: int

    # Revenue (DZD)
    mrr_edtech: float
    mrr_hub: float
    mrr_bi: float
    mrr_captives: float       # Captive/add-on MRR
    mrr_diaspora: float
    one_time_revenue: float   # Course/path purchases, certs, etc.
    total_revenue: float

    # Costs (DZD)
    cogs_instructor: float    # Revenue share paid to instructors
    cogs_chargily: float      # Payment gateway fees
    opex_infrastructure: float
    opex_ai_api: float
    opex_third_party: float
    opex_marketing: float
    opex_instructor_upfront: float
    total_cogs: float
    total_opex: float

    # Founders' salary
    founders_salary_total: float

    # Net
    vat_liability: float
    net_profit: float
    cumulative_cash: float


def month_label(index: int) -> str:
    """Map month index (0=launch) to 'Mon YYYY'."""
    launch = datetime(2026, 9, 23)
    # Move to first of launch month
    dt = launch.replace(day=1) + timedelta(days=index * 30)
    # Adjust to approximate month
    year = launch.year + (launch.month - 1 + index) // 12
    month = (launch.month - 1 + index) % 12 + 1
    return f"{datetime(year, month, 1).strftime('%b %Y')}"


def calculate_paid_users(
    registered: int,
    conversion_pct: float,
    existing_paid: int,
    churn_pct: float,
) -> Tuple[int, int]:
    """
    Returns (new_paid, ending_paid) for a single month.
    
    New_paid = newly registered users × conversion_pct.
    Churned = existing_paid × churn_pct.
    Ending = existing_paid + new_paid - churned.
    """
    new_paid = max(0, int(registered * conversion_pct) - existing_paid)
    if new_paid < 0:
        new_paid = 0
    # Simpler approach: count new_registrations * conversion
    return int(registered * conversion_pct)


def simulate(params: ScenarioParams, months: int = 28) -> List[MonthSnapshot]:
    """
    Main simulation engine.
    
    months = 28 covers Sep 2026 (launch) through Dec 2028.
    """
    usd_to_dzd = 145.0

    # --- Month 0: Launch state ---
    registered = int(params.initial_waitlist * params.waitlist_to_registered)

    paid_edtech = 0
    paid_hub = 0
    paid_bi = 0
    total_paid = 0

    cumulative_cash = 500_000.0  # Starting capital (DZD)

    # New user signups per month (ramps over time)
    base_new_users = params.monthly_organic_growth * params.marketing_multiplier

    # Track month-by-month results
    snapshots = []
    
    for m in range(months):
        label = month_label(m)

        # ── USER GROWTH ───────────────────────────────────────────
        # Organic + paid growth. Growth slows as base gets larger (s-curve via logistic cap).
        # Target max registered: ~5% of Algerian digital population
        max_registered = 315_000  
        
        if m == 0:
            new_registered = registered  # Launch converts waitlist
        else:
            # Logistic growth with organic + marketing
            growth_rate = base_new_users * (1 - registered / max_registered)
            growth_rate = max(growth_rate, 20)  # Floor
            new_registered = int(growth_rate)
        
        registered += new_registered
        
        # Cap at max
        registered = min(registered, max_registered)

        # ── PAID SUBSCRIBERS ──────────────────────────────────────
        total_target_paid = int(registered * params.free_to_paid_pct)
        
        # Gradual ramp: only a fraction of target is reached in early months
        ramp_factor = min(1.0, (m + 1) / 6)  # Full conversion by month 6
        if m == 0:
            ramp_factor = 0.3  # Launch month: 30% of target
        elif m == 1:
            ramp_factor = 0.5
        elif m == 2:
            ramp_factor = 0.7
        
        target_paid_this_month = int(total_target_paid * ramp_factor)
        
        # Apply churn to existing paid users
        churned_edtech = int(paid_edtech * params.monthly_churn_edtech)
        churned_hub = int(paid_hub * params.monthly_churn_hub)
        churned_bi = int(paid_bi * params.monthly_churn_bi)
        
        # New paid users this month
        new_paid_edtech = max(0, target_paid_this_month - paid_edtech) + churned_edtech
        if m == 0:
            new_paid_edtech = max(1, int(new_registered * params.free_to_paid_pct * 0.3))
        
        paid_edtech = max(0, paid_edtech + new_paid_edtech - churned_edtech)
        
        # Hub: % of paid EdTech users also subscribe to Hub standalone
        target_hub = int(paid_edtech * params.hub_pct_paid_users)
        diff_hub = target_hub - paid_hub
        if diff_hub > 0:
            paid_hub += min(diff_hub, max(1, int(new_paid_edtech * params.hub_pct_paid_users)))
        paid_hub = max(0, int(paid_hub * (1 - params.monthly_churn_hub)))
        
        # BI: pilots start month 4 (Jan 2027), paid from month 5
        if m >= 4:
            target_bi = int(registered * params.bi_pct_registered)
            diff_bi = target_bi - paid_bi
            if diff_bi > 0:
                paid_bi += min(diff_bi, max(1, int(new_registered * params.bi_pct_registered)))
            paid_bi = max(0, int(paid_bi * (1 - params.monthly_churn_bi)))

        total_paid = paid_edtech + paid_hub + paid_bi

        # ── REVENUE ───────────────────────────────────────────────
        # EdTech MRR
        edtech_starter = int(paid_edtech * params.pct_starter)
        edtech_plus    = int(paid_edtech * params.pct_plus)
        edtech_pro     = paid_edtech - edtech_starter - edtech_plus
        
        mrr_edtech = (
            edtech_starter * EDTECH_TIERS["Starter"]["price"]
            + edtech_plus    * EDTECH_TIERS["Plus"]["price"]
            + edtech_pro     * EDTECH_TIERS["Pro"]["price"]
        )

        # Hub MRR (Standalone only, not bundled with EdTech Plus/Pro)
        hub_starter = int(paid_hub * 0.45)
        hub_plus    = int(paid_hub * 0.35)
        hub_pro     = paid_hub - hub_starter - hub_plus
        
        mrr_hub = (
            hub_starter * HUB_TIERS["Starter"]["price"]
            + hub_plus    * HUB_TIERS["Plus"]["price"]
            + hub_pro     * HUB_TIERS["Pro"]["price"]
        )

        # BI MRR
        bi_starter   = int(paid_bi * params.bi_tier_split_starter)
        bi_growth    = int(paid_bi * params.bi_tier_split_growth)
        bi_enterprise = paid_bi - bi_starter - bi_growth
        
        mrr_bi = (
            bi_starter    * BI_TIERS["Starter"]["price"]
            + bi_growth    * BI_TIERS["Growth"]["price"]
            + bi_enterprise * BI_TIERS["Enterprise"]["price"]
        )

        # Captive / Add-on Revenue
        active_learners = paid_edtech
        active_freelancers = paid_edtech + paid_hub
        active_bi_users = paid_bi
        
        mrr_captives = (
            active_learners * params.ai_toolbox_pct * CAPTIVE_PRODUCTS["ai_toolbox"]["price"]
            + active_freelancers * params.verified_badge_pct * CAPTIVE_PRODUCTS["verified_badge"]["price"]
            + active_freelancers * params.featured_project_pct * CAPTIVE_PRODUCTS["featured_project"]["price"]
            + active_freelancers * params.talent_search_pct * CAPTIVE_PRODUCTS["talent_search"]["price"]
            + active_bi_users * params.data_export_pct * CAPTIVE_PRODUCTS["data_export"]["price"]
        )
        
        # One-time revenue: Skill Passports, course purchases, proposal credits
        new_users_this_month = new_registered if m > 0 else registered
        
        # Skill passports from course completers
        course_completers = max(1, int(paid_edtech * 0.10))  # ~10% of paid complete/month
        skill_passport_rev = course_completers * params.skill_passport_pct * CAPTIVE_PRODUCTS["skill_passport"]["price"]
        
        # Proposal credits from free users
        free_users = max(0, registered - total_paid)
        proposal_credit_rev = int(free_users * 0.02) * CAPTIVE_PRODUCTS["proposal_credit"]["price"]
        
        one_time_revenue = skill_passport_rev + proposal_credit_rev

        # Diaspora revenue (small, grows slowly)
        diaspora_users = max(1, int(m * 3 + 5))  # ~5 + 3/month
        mrr_diaspora = diaspora_users * DIASPORA_MONTHLY_EUR * EUR_TO_DZD

        total_revenue = mrr_edtech + mrr_hub + mrr_bi + mrr_captives + mrr_diaspora + one_time_revenue

        # ── COSTS ─────────────────────────────────────────────────
        # Instructor revenue share (only on one-time course sales, not subs)
        cogs_instructor = one_time_revenue * params.instructor_rev_share

        # Chargily payment gateway fee
        cogs_chargily = total_revenue * params.chargily_fee_pct

        total_cogs = cogs_instructor + cogs_chargily

        # Operating expenses (converted to DZD)
        opex_infrastructure = params.infrastructure_usd * usd_to_dzd
        opex_ai_api = params.ai_api_usd * usd_to_dzd
        opex_third_party = params.third_party_services_usd * usd_to_dzd
        opex_marketing = params.marketing_usd * usd_to_dzd

        # Instructor upfront fees (only in months where new courses are created)
        # Months 2, 3, 4, 5 (Nov/Dec/Jan/Feb) each have 1 new external course
        opex_instructor_upfront = 0
        if 2 <= m <= 5:
            opex_instructor_upfront = params.instructor_upfront_dzd

        total_opex = (
            opex_infrastructure
            + opex_ai_api
            + opex_third_party
            + opex_marketing
            + opex_instructor_upfront
        )

        # ── FOUNDERS' SALARIES (performance-based) ────────────────
        founders_salary = calc_founders_salary(m, paid_edtech, paid_bi, mrr_edtech)
        
        # ── VAT ───────────────────────────────────────────────────
        if m < params.startup_label_month:
            vat_liability = total_revenue * params.vat_rate
        else:
            vat_liability = 0.0  # Exempt after Startup Label

        # ── NET PROFIT ────────────────────────────────────────────
        net_profit = total_revenue - total_cogs - total_opex - founders_salary - vat_liability
        cumulative_cash += net_profit

        snapshots.append(MonthSnapshot(
            month_index=m,
            label=label,
            registered_cumulative=registered,
            paid_edtech=paid_edtech,
            paid_hub=paid_hub,
            paid_bi=paid_bi,
            total_paid_users=total_paid,
            mrr_edtech=mrr_edtech,
            mrr_hub=mrr_hub,
            mrr_bi=mrr_bi,
            mrr_captives=mrr_captives,
            mrr_diaspora=mrr_diaspora,
            one_time_revenue=one_time_revenue,
            total_revenue=total_revenue,
            cogs_instructor=cogs_instructor,
            cogs_chargily=cogs_chargily,
            opex_infrastructure=opex_infrastructure,
            opex_ai_api=opex_ai_api,
            opex_third_party=opex_third_party,
            opex_marketing=opex_marketing,
            opex_instructor_upfront=opex_instructor_upfront,
            total_cogs=total_cogs,
            total_opex=total_opex,
            founders_salary_total=founders_salary,
            vat_liability=vat_liability,
            net_profit=net_profit,
            cumulative_cash=cumulative_cash,
        ))

    return snapshots


# ╔══════════════════════════════════════════════════════════════════════╗
# ║  SECTION 3: FOUNDERS' SALARY LOGIC                                 ║
# ╚══════════════════════════════════════════════════════════════════════╝

def calc_founders_salary(
    month_index: int,
    paid_edtech: int,
    paid_bi: int,
    mrr_edtech: float,
) -> float:
    """
    Founders' salary uses a milestone-based tier system.
    
    - First 6 months (Sep 2026 – Feb 2027): No salary (reinvesting in company).
    - Salaries start month 6 (Mar 2027).
    
    Tier 1 (Bootstrapping, MRR < 100K):          0 DZD (deferred)
    Tier 2 (Survival,   MRR 100K–300K):     75,000 DZD total
    Tier 3 (Growth,     MRR 300K–800K):    150,000 DZD total
    Tier 4 (Scale,      MRR 800K–2M):      300,000 DZD total
    Tier 5 (High Growth, MRR 2M–5M):      600,000 DZD total
    Tier 6 (Scale-Up,    MRR 5M+):      1,200,000 DZD total
    
    Split EQUALLY among 3 founders (33.3% each).
    """
    if month_index < 6:
        return 0.0  # First 6 months: no salaries

    total_mrr = mrr_edtech
    
    if total_mrr < 100_000:
        return 0.0
    elif total_mrr < 300_000:
        return 75_000
    elif total_mrr < 800_000:
        return 150_000
    elif total_mrr < 2_000_000:
        return 300_000
    elif total_mrr < 5_000_000:
        return 600_000
    else:
        return 1_200_000


# ╔══════════════════════════════════════════════════════════════════════╗
# ║  SECTION 4: OUTPUT & REPORTING                                    ║
# ╚══════════════════════════════════════════════════════════════════════╝

FOUNDER_EQUITY = {
    "Zakarya ROUBHI (CEO/CTO)": 1/3,
    "Mohamed Redha HABIB (COO)": 1/3,
    "Ahmed MERHAB (CMO/DPO)":   1/3,
}


def print_report(snapshots: List[MonthSnapshot], params: ScenarioParams):
    """Print formatted financial projection table."""
    
    print(f"\n{'='*110}")
    print(f"  PODACIUM FINANCIAL PROJECTION")
    print(f"  Scenario: {params.name.upper()} — {params.description}")
    print(f"  Launch: September 23, 2026 → December 31, 2028")
    print(f"{'='*110}\n")

    # ── SUMMARY ───────────────────────────────────────────────────
    final = snapshots[-1]
    peak_cash = max(s.cumulative_cash for s in snapshots)
    min_cash = min(s.cumulative_cash for s in snapshots)
    
    # Month of breakeven
    breakeven_month = "Not reached"
    for s in snapshots:
        if s.net_profit >= 0:
            breakeven_month = s.label
            break
    
    print(f"  FINAL (Dec 2028):")
    print(f"    Registered Users:    {final.registered_cumulative:>10,}")
    print(f"    Total Paid Users:    {final.total_paid_users:>10,}")
    print(f"      EdTech:            {final.paid_edtech:>10,}")
    print(f"      Hub Standalone:    {final.paid_hub:>10,}")
    print(f"      BI SaaS:           {final.paid_bi:>10,}")
    print(f"    Monthly Revenue:     {final.total_revenue:>10,.0f} DZD")
    print(f"    Monthly MRR:         {final.mrr_edtech + final.mrr_hub + final.mrr_bi + final.mrr_captives + final.mrr_diaspora:>10,.0f} DZD")
    print(f"    Monthly Net Profit:  {final.net_profit:>10,.0f} DZD")
    print(f"    Cumulative Cash:     {final.cumulative_cash:>10,.0f} DZD")
    print(f"    Founders' Salary:    {final.founders_salary_total:>10,.0f} DZD")
    print(f"\n  KEY METRICS:")
    print(f"    Breakeven Month:     {breakeven_month}")
    print(f"    Peak Cash:           {peak_cash:>10,.0f} DZD")
    print(f"    Min Cash:            {min_cash:>10,.0f} DZD")
    print(f"    End ARR (MRR×12):    {final.total_revenue * 12:>10,.0f} DZD  (~${final.total_revenue * 12 / 145:>,.0f} USD)")
    print(f"    Total Revenue (all): {sum(s.total_revenue for s in snapshots):>10,.0f} DZD")
    print(f"    Total Net Profit:    {sum(s.net_profit for s in snapshots):>10,.0f} DZD")

    # ── ZAKARYA'S PERSONAL GOAL TRACKER ───────────────────────────
    ZAKARYA_SHARE = 1/3
    car_budget = 3_000_000  # DZD
    marriage_budget = 1_000_000  # DZD
    target = car_budget + marriage_budget

    cumulative_zakarya = 0.0
    goal_month = None
    print(f"\n  🎯 ZAKARYA'S PERSONAL GOAL: Car ({car_budget:,} DZD) + Marriage ({marriage_budget:,} DZD) = {target:,} DZD")
    print(f"  Salary: Equal split (1/3 each), first 6 months unpaid.\n")
    print(f"  {'Month':<10} | {'Pool Salary':>10} | {'Zakarya (33%)':>14} | {'Cumulative':>12} | {'To Goal':>10} | {'Progress':>10}")
    print(f"  {'─'*70}")
    for s in snapshots:
        zakarya_share = s.founders_salary_total * ZAKARYA_SHARE
        cumulative_zakarya += zakarya_share
        remaining = max(0, target - cumulative_zakarya)
        progress_pct = min(100, cumulative_zakarya / target * 100)
        if goal_month is None and cumulative_zakarya >= target:
            goal_month = s.label
        flag = " 🎯" if s.label == goal_month else ""
        print(f"  {s.label:<10} | {s.founders_salary_total:>10,.0f} | {zakarya_share:>14,.0f} | {cumulative_zakarya:>12,.0f} | {remaining:>10,.0f} | {progress_pct:>8.1f}%{flag}")
    if goal_month:
        print(f"\n  ✅ Zakarya hits {target:,} DZD in {goal_month} — ready for marriage!")
    else:
        print(f"\n  ❌ Target not reached within projection period.")

    # ── MONTHLY TABLE ─────────────────────────────────────────────
    print(f"\n{'─'*110}")
    header = (
        f"{'Month':<10} | {'Regist.' :>7} | {'Paid':>5} | "
        f"{'EdTech':>8} | {'Hub':>8} | {'BI':>8} | {'Captive':>8} | {'1-Time':>8} | "
        f"{'Total Rev':>9} | {'COGS':>8} | {'OpEx':>8} | {'Salary':>8} | "
        f"{'VAT':>8} | {'Net Profit':>10} | {'Cash':>10}"
    )
    print(header)
    print(f"{'─'*110}")
    
    for s in snapshots:
        line = (
            f"{s.label:<10} | {s.registered_cumulative:>7,} | {s.total_paid_users:>5} | "
            f"{s.mrr_edtech:>8,.0f} | {s.mrr_hub:>8,.0f} | {s.mrr_bi:>8,.0f} | "
            f"{s.mrr_captives:>8,.0f} | {s.one_time_revenue:>8,.0f} | "
            f"{s.total_revenue:>9,.0f} | {s.total_cogs:>8,.0f} | {s.total_opex:>8,.0f} | "
            f"{s.founders_salary_total:>8,.0f} | {s.vat_liability:>8,.0f} | "
            f"{s.net_profit:>10,.0f} | {s.cumulative_cash:>10,.0f}"
        )
        print(line)
    
    print(f"{'─'*110}")


def export_csv(snapshots: List[MonthSnapshot], params: ScenarioParams, filename: str = None):
    """Export results to CSV for further analysis."""
    if filename is None:
        filename = f"podacium_financial_{params.name}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
    
    with open(filename, 'w', newline='') as f:
        writer = csv.writer(f)
        writer.writerow([
            "Month", "Registered_Cumulative", "Paid_EdTech", "Paid_Hub", "Paid_BI",
            "Total_Paid", "MRR_EdTech_DZD", "MRR_Hub_DZD", "MRR_BI_DZD",
            "MRR_Captives_DZD", "MRR_Diaspora_DZD", "OneTime_Revenue_DZD",
            "Total_Revenue_DZD", "COGS_DZD", "OpEx_DZD", "Founders_Salary_DZD",
            "VAT_DZD", "Net_Profit_DZD", "Cumulative_Cash_DZD",
        ])
        for s in snapshots:
            writer.writerow([
                s.label, s.registered_cumulative, s.paid_edtech, s.paid_hub, s.paid_bi,
                s.total_paid_users,
                s.mrr_edtech, s.mrr_hub, s.mrr_bi, s.mrr_captives, s.mrr_diaspora,
                s.one_time_revenue, s.total_revenue,
                s.total_cogs, s.total_opex, s.founders_salary_total,
                s.vat_liability, s.net_profit, s.cumulative_cash,
            ])
    
    print(f"\n  📄 CSV exported: {filename}")


def export_founder_csv(snapshots: List[MonthSnapshot], params: ScenarioParams):
    """Export per-founder salary breakdown."""
    filename = f"podacium_founder_salaries_{params.name}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
    
    with open(filename, 'w', newline='') as f:
        writer = csv.writer(f)
        header = ["Month", "Total_Salary_DZD"]
        for founder in FOUNDER_EQUITY:
            header.append(f"{founder.split(' (')[0]}_DZD")
        writer.writerow(header)
        
        for s in snapshots:
            row = [s.label, s.founders_salary_total]
            for name, pct in FOUNDER_EQUITY.items():
                row.append(s.founders_salary_total * pct)
            writer.writerow(row)
    
    print(f"  📄 Founder salaries CSV: {filename}")


# ╔══════════════════════════════════════════════════════════════════════╗
# ║  SECTION 5: DATA EXTRACTION VALIDATION                             ║
# ╚══════════════════════════════════════════════════════════════════════╝

def run_data_audit(snapshots: List[MonthSnapshot]):
    """Validate the model output against BP/PRICING_RECOMMENDATION benchmarks."""
    print(f"\n{'='*60}")
    print("  DATA VALIDATION vs. DOCUMENT BENCHMARKS")
    print(f"{'='*60}")
    
    # Test: Year 1 (12 months from launch) should approach ~37.3M DZD
    # Note: Our launch is Sep 23 (later than BP's Aug 12), so expectations differ
    year1_revenue = sum(s.total_revenue for s in snapshots[:15])  # ~15 months to cover ~12 months post-launch
    
    # Year 1 per PRICING_RECOMMENDATION: ~37.3M DZD
    print(f"  Year 1 (15 mo projection) Revenue: {year1_revenue:>12,.0f} DZD")
    print(f"  PRICING_RECOMMENDATION benchmark:   37,284,000 DZD (Aug launch)")
    print(f"  Ratio: {year1_revenue / 37_284_000:.1%}")
    
    # Test: Breakeven should occur within 8 months per BP §9.6.1
    breakeven_found = False
    for s in snapshots:
        if s.net_profit >= 0:
            print(f"  Breakeven month: {s.label} (Month {s.month_index})")
            print(f"  BP benchmark (base): March 2027 (Month 8 from Aug launch)")
            breakeven_found = True
            break
    if not breakeven_found:
        print(f"  ⚠ Breakeven not reached within projection period")


# ╔══════════════════════════════════════════════════════════════════════╗
# ║  SECTION 6: MAIN                                                   ║
# ╚══════════════════════════════════════════════════════════════════════╝

def main():
    parser = argparse.ArgumentParser(
        description="Podacium Financial Projection Model (Sep 2026 – Dec 2028)"
    )
    parser.add_argument(
        "--scenario", "-s",
        choices=["base", "bear", "bull"],
        default="base",
        help="Scenario to run (default: base)"
    )
    parser.add_argument(
        "--months", "-m",
        type=int,
        default=28,
        help="Number of months to project (default: 28 = Sep 2026 → Dec 2028)"
    )
    parser.add_argument(
        "--output-csv", action="store_true",
        help="Export results to CSV files"
    )
    parser.add_argument(
        "--all-scenarios", action="store_true",
        help="Run all three scenarios and compare"
    )
    
    args = parser.parse_args()
    
    if args.all_scenarios:
        all_results = {}
        for name, params in SCENARIOS.items():
            snapshots = simulate(params, args.months)
            all_results[name] = snapshots
            print_report(snapshots, params)
            if args.output_csv:
                export_csv(snapshots, params)
                export_founder_csv(snapshots, params)
        
        # Comparison summary
        print(f"\n{'='*110}")
        print("  SCENARIO COMPARISON (Dec 2028)")
        print(f"{'='*110}")
        print(f"{'Metric':<30} {'BEAR':>15} {'BASE':>15} {'BULL':>15}")
        print(f"{'─'*75}")
        for metric, key in [
            ("Registered Users", "registered_cumulative"),
            ("Total Paid Users", "total_paid_users"),
            ("Monthly Revenue (DZD)", "total_revenue"),
            ("Monthly Net Profit (DZD)", "net_profit"),
            ("Cumulative Cash (DZD)", "cumulative_cash"),
            ("End ARR (DZD)", "arr"),
        ]:
            bear_val = getattr(all_results["bear"][-1], key, 0) if key != "arr" else all_results["bear"][-1].total_revenue * 12
            base_val = getattr(all_results["base"][-1], key, 0) if key != "arr" else all_results["base"][-1].total_revenue * 12
            bull_val = getattr(all_results["bull"][-1], key, 0) if key != "arr" else all_results["bull"][-1].total_revenue * 12
            print(f"{metric:<30} {bear_val:>15,.0f} {base_val:>15,.0f} {bull_val:>15,.0f}")
        
        # Breakeven comparison
        print(f"{'─'*75}")
        print(f"{'Breakeven Month':<30}", end="")
        for name in ["bear", "base", "bull"]:
            be = "Not reached"
            for s in all_results[name]:
                if s.net_profit >= 0:
                    be = s.label
                    break
            print(f"{be:>15}", end="")
        print()
        
    else:
        params = SCENARIOS[args.scenario]
        snapshots = simulate(params, args.months)
        print_report(snapshots, params)
        run_data_audit(snapshots)
        
        if args.output_csv:
            export_csv(snapshots, params)
            export_founder_csv(snapshots, params)


if __name__ == "__main__":
    main()
