"""
TamWheel Sovereign Ethical Agentic Venture OS — Fantasy Startup League (FSL) Engine.
Pillar 2: The Anti-PSP Simulation League & Fantasy Startup Tournament.

Game Design & Tournament Architecture (Sections 13.3, 14, and 20.4 of Blueprint):
1. 12-Week Tournament Cycles:
   Synchronized with televised pitch show seasons (Shark Tank / El-Charika Al-Djazairia).
   Weekly gameweeks with deadline locking, real-time KPI telemetry oracles, and playoff finals.
2. Team Roster Builder & Salary Cap Mechanics:
   - Virtual Salary Cap: Exactly 100,000 SP (Simulation Points) budget.
   - Roster Composition: Exactly 5 Startups.
   - Sector Diversification: Must span at least 3 distinct industry sectors (>= 3 sectors).
   - Anti-Monopoly Constraints: Maximum 2 startups per industry sector; maximum 2 per Wilaya.
3. Strategic Multipliers:
   - Captain (x1.5x Point Multiplier): High-conviction anchor startup.
   - Core (3 Startups, x1.0x Point Multiplier): Steady performance drivers.
   - Wildcard (x2.0x Point Multiplier if Valuation < 30M DZD, else x1.0x): Underdog moonshot.
4. Real-World KPI Scoring Triggers:
   - Verified Senior Tech Hire: +50 pts
   - MoM ARR Growth >= 20%: +100 pts
   - Official Startup Label Awarded (Executive Decree 20-254): +150 pts
   - TV Judge Pitch of the Week: +75 pts
   - Narrative Bubble Warning Triggered: -50 pts
   - INAPI Patent / PCT Filing Granted: +75 pts
   - Major B2B Contract Signed (e.g. Sonatrach/Algérie Télécom): +15 pts
   - Escrow Milestone Tranche Released: +25 pts
   - Cash Runway Warning (< 2 months): -30 pts
   - Founder Dispute / Legal Recusal: -100 pts
5. Private Mini-Leagues:
   - University derbies (ESI Algiers, USTHB, ESE Oran, Constantine)
   - Regional derbies (Oran Techies, Algiers Hub, Sétif Commercial Club, Ghardaïa)
   - Diaspora pods (Paris Diaspora Angels, London Maghreb Angels, Montreal)
   - Corporate syndicates (Sonatrach Innovation Squad, Mobilis Tech)
   - Unique invite code entry, weekly rankings, and cumulative season standings.
"""

import uuid
import hashlib
import logging
import threading
from typing import List, Dict, Any, Optional, Set
from datetime import datetime, timezone, timedelta
from pydantic import BaseModel, Field, model_validator
from fastapi import HTTPException, status

logger = logging.getLogger(__name__)

SALARY_CAP_SP: int = 100_000
ROSTER_SIZE: int = 5
MIN_DISTINCT_SECTORS: int = 3
MAX_STARTUPS_PER_SECTOR: int = 2
MAX_STARTUPS_PER_WILAYA: int = 2
WILDCARD_VALUATION_CEILING_DZD: int = 30_000_000  # 30M DZD

# Multiplier Constants
CAPTAIN_MULTIPLIER: float = 1.5
CORE_MULTIPLIER: float = 1.0
WILDCARD_BOOST_MULTIPLIER: float = 2.0
WILDCARD_BASE_MULTIPLIER: float = 1.0

# Canonical Real-World Scoring Point Schedule
KPI_SCORING_SCHEDULE: Dict[str, Dict[str, Any]] = {
    "TECH_HIRE": {
        "points": 50,
        "nameEn": "Verified Senior Tech Hire",
        "nameAr": "توظيف تقني رفيع موثق",
        "category": "TRACTION",
    },
    "ARR_GROWTH_20": {
        "points": 100,
        "nameEn": "MoM ARR Growth >= 20%",
        "nameAr": "نمو الإيراد السنوي المتكرر بأكثر من 20%",
        "category": "FINANCIAL",
    },
    "STARTUP_LABEL": {
        "points": 150,
        "nameEn": "Official Startup Label Awarded (Decree 20-254)",
        "nameAr": "الحصول على علامة مؤسسة ناشئة الرسمية",
        "category": "REGULATORY",
    },
    "TV_PITCH_WINNER": {
        "points": 75,
        "nameEn": "TV Judge Pitch of the Week",
        "nameAr": "أفضل عرض أسبوعي في البرنامج التلفزيوني",
        "category": "MEDIA",
    },
    "NARRATIVE_BUBBLE": {
        "points": -50,
        "nameEn": "Narrative Bubble Warning Triggered",
        "nameAr": "تنبيه فقاعة مضاربية أو مبالغة في التقييم",
        "category": "PENALTY",
    },
    "PATENT_GRANTED": {
        "points": 75,
        "nameEn": "Granted INAPI Patent or PCT Filing",
        "nameAr": "تسجيل براءة اختراع INAPI أو دولية",
        "category": "IP",
    },
    "B2B_CONTRACT": {
        "points": 15,
        "nameEn": "Commercial B2B Contract with Enterprise",
        "nameAr": "توقيع عقد تجاري B2B مع مؤسسة كبرى",
        "category": "COMMERCIAL",
    },
    "ESCROW_TRANCHE": {
        "points": 25,
        "nameEn": "Verified Escrow Tranche Unlocked",
        "nameAr": "تحرير شريحة تمويل من حساب الضمان",
        "category": "FINANCIAL",
    },
    "RUNWAY_WARNING": {
        "points": -30,
        "nameEn": "Cash Runway Below 2 Months Warning",
        "nameAr": "تنبيه انخفاض السيولة لأقل من شهرين",
        "category": "PENALTY",
    },
    "FOUNDER_DISPUTE": {
        "points": -100,
        "nameEn": "Founder Dispute or Legal Recusal",
        "nameAr": "نزاع مؤسسين أو إجراء قانوني مهدد",
        "category": "PENALTY",
    },
}


class StartupMetadata(BaseModel):
    """Catalog metadata for a fantasy startup draft candidate."""
    id: str
    name: str
    sector: str
    wilaya: int
    valuation_dzd: int
    fantasy_price_sp: int = 20_000
    hype_score: float = 50.0
    has_startup_label: bool = False


class RosterStartupSelection(BaseModel):
    """Assigned position and multiplier for a drafted startup."""
    startup_id: str
    startup_name: str
    sector: str
    wilaya: int
    valuation_dzd: int
    fantasy_price_sp: int
    role: str  # CAPTAIN | CORE | WILDCARD
    multiplier: float
    gameweek_points: float = 0.0


class UserGameweekRoster(BaseModel):
    """User roster for a specific gameweek."""
    roster_id: str
    user_id: int
    season_id: str
    gameweek: int
    total_sp_spent: int
    remaining_sp_budget: int
    sectors_count: int
    startups: List[RosterStartupSelection]
    gameweek_total_points: float = 0.0
    submitted_at: str


class RealWorldKpiEvent(BaseModel):
    """An authenticated real-world KPI event recorded by an oracle."""
    event_id: str
    startup_id: str
    gameweek: int
    event_type: str
    base_points: int
    description: str
    evidence_hash: str
    timestamp: str


class TournamentSeason(BaseModel):
    """12-week tournament season definition."""
    season_id: str
    name: str
    total_weeks: int = 12
    current_gameweek: int = 1
    status: str = "ACTIVE"  # UPCOMING | ACTIVE | COMPLETED
    start_date: str
    end_date: str
    gameweek_deadline: str


class MiniLeague(BaseModel):
    """Private mini-league (University, Regional, Diaspora, Corporate)."""
    league_id: str
    name: str
    category: str  # UNIVERSITY | REGIONAL | DIASPORA | CORPORATE
    description: str
    owner_user_id: int
    invite_code: str
    members: List[int] = Field(default_factory=list)
    created_at: str


class FantasyStartupLeagueEngine:
    """
    Core algorithmic engine for the TamWheel Fantasy Startup League (FSL).
    Enforces roster rules, multi-sector constraints, dynamic multipliers,
    real-world KPI scoring event propagation, and private mini-leagues.
    """

    def __init__(self):
        self._lock = threading.RLock()
        self._seasons: Dict[str, TournamentSeason] = {}
        self._startups_catalog: Dict[str, StartupMetadata] = {}
        self._rosters: Dict[str, UserGameweekRoster] = {}  # key: f"{user_id}:{season_id}:{gameweek}"
        self._events: List[RealWorldKpiEvent] = []
        self._mini_leagues: Dict[str, MiniLeague] = {}
        self._user_season_scores: Dict[str, float] = {}  # key: f"{user_id}:{season_id}"

        # Initialize Default Season & Startup Seed Catalog
        self._initialize_default_season()
        self._initialize_default_startups()

    def _initialize_default_season(self) -> None:
        """Initializes the flagship 12-week Televised Season 1."""
        now = datetime.now(timezone.utc)
        season_1 = TournamentSeason(
            season_id="season-2026-s1",
            name="TamWheel National Pitch Tournament — Season 1",
            total_weeks=12,
            current_gameweek=1,
            status="ACTIVE",
            start_date=now.isoformat(),
            end_date=(now + timedelta(weeks=12)).isoformat(),
            gameweek_deadline=(now + timedelta(days=7)).isoformat(),
        )
        self._seasons[season_1.season_id] = season_1

    def _initialize_default_startups(self) -> None:
        """Seeds catalog with diverse Algerian startups covering multiple sectors and Wilayas."""
        default_startups = [
            StartupMetadata(
                id="startup-solartech",
                name="SolarTech Oran",
                sector="CleanTech",
                wilaya=31,  # Oran
                valuation_dzd=25_000_000,
                fantasy_price_sp=20_000,
                hype_score=88.5,
                has_startup_label=True,
            ),
            StartupMetadata(
                id="startup-greenfarm",
                name="GreenFarm AI",
                sector="AgTech",
                wilaya=19,  # Sétif
                valuation_dzd=28_000_000,
                fantasy_price_sp=22_000,
                hype_score=84.0,
                has_startup_label=True,
            ),
            StartupMetadata(
                id="startup-sihatech",
                name="SihaTech Health",
                sector="HealthTech",
                wilaya=16,  # Algiers
                valuation_dzd=35_000_000,
                fantasy_price_sp=25_000,
                hype_score=91.0,
                has_startup_label=True,
            ),
            StartupMetadata(
                id="startup-finflow",
                name="FinFlow Algeria",
                sector="FinTech",
                wilaya=16,  # Algiers
                valuation_dzd=22_000_000,
                fantasy_price_sp=18_000,
                hype_score=86.0,
                has_startup_label=True,
            ),
            StartupMetadata(
                id="startup-logixpress",
                name="LogiXpress Cargo",
                sector="Logistics",
                wilaya=25,  # Constantine
                valuation_dzd=18_000_000,
                fantasy_price_sp=15_000,
                hype_score=79.0,
                has_startup_label=False,
            ),
            StartupMetadata(
                id="startup-edualgerie",
                name="EduDjazair VR",
                sector="EduTech",
                wilaya=9,   # Blida
                valuation_dzd=15_000_000,
                fantasy_price_sp=12_000,
                hype_score=75.0,
                has_startup_label=False,
            ),
            StartupMetadata(
                id="startup-saharasolar",
                name="Sahara Water IoT",
                sector="CleanTech",
                wilaya=47,  # Ghardaïa
                valuation_dzd=20_000_000,
                fantasy_price_sp=16_000,
                hype_score=82.0,
                has_startup_label=True,
            ),
        ]
        for s in default_startups:
            self._startups_catalog[s.id] = s

    def register_startup_metadata(self, startup: StartupMetadata) -> None:
        """Registers or updates a startup candidate in the draft catalog."""
        with self._lock:
            self._startups_catalog[startup.id] = startup

    def get_startup_metadata(self, startup_id: str) -> Optional[StartupMetadata]:
        """Retrieves startup metadata by ID."""
        with self._lock:
            return self._startups_catalog.get(startup_id)

    def list_catalog(self) -> List[StartupMetadata]:
        """Lists all draftable startups."""
        with self._lock:
            return list(self._startups_catalog.values())

    def get_active_season(self) -> TournamentSeason:
        """Returns the currently active tournament season."""
        with self._lock:
            for s in self._seasons.values():
                if s.status == "ACTIVE":
                    return s
            return list(self._seasons.values())[0]

    def list_seasons(self) -> List[TournamentSeason]:
        """Lists all tournament seasons."""
        with self._lock:
            return list(self._seasons.values())

    def advance_gameweek(self, season_id: str) -> TournamentSeason:
        """
        Advances the gameweek of a season up to 12.
        Transitions to COMPLETED if week exceeds 12.
        """
        with self._lock:
            season = self._seasons.get(season_id)
            if not season:
                raise HTTPException(status_code=404, detail="Season not found")

            if season.current_gameweek >= season.total_weeks:
                season.status = "COMPLETED"
            else:
                season.current_gameweek += 1
                now = datetime.now(timezone.utc)
                season.gameweek_deadline = (now + timedelta(days=7)).isoformat()

            return season

    def build_team_roster(
        self,
        user_id: int,
        season_id: str,
        gameweek: int,
        captain_startup_id: str,
        wildcard_startup_id: str,
        core_startup_ids: List[str],
    ) -> UserGameweekRoster:
        """
        Validates and commits a 5-startup roster for the gameweek.
        Enforces:
        1. Exactly 5 startups (1 Captain, 1 Wildcard, 3 Core).
        2. All 5 startup IDs must be distinct.
        3. Virtual budget cap: total fantasy price <= 100,000 SP.
        4. Sector diversification: startups must span >= 3 distinct sectors.
        5. Anti-monopoly constraints: max 2 startups per sector; max 2 per Wilaya.
        6. Dynamic Multipliers:
           - Captain: 1.5x
           - Core: 1.0x
           - Wildcard: 2.0x if valuation < 30M DZD, else 1.0x.
        """
        with self._lock:
            # 1. Total and Distinct Count Verification
            all_ids = [captain_startup_id, wildcard_startup_id] + core_startup_ids
            if len(all_ids) != ROSTER_SIZE:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Roster must contain exactly {ROSTER_SIZE} startups (1 Captain, 1 Wildcard, 3 Core).",
                )

            if len(set(all_ids)) != ROSTER_SIZE:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="All 5 startups in the roster must be distinct. Duplicate startups detected.",
                )

            if len(core_startup_ids) != 3:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Exactly 3 startups must be assigned to Core positions.",
                )

            # 2. Fetch Metadata & Check Existence
            startups_meta: Dict[str, StartupMetadata] = {}
            for sid in all_ids:
                meta = self._startups_catalog.get(sid)
                if not meta:
                    raise HTTPException(
                        status_code=status.HTTP_404_NOT_FOUND,
                        detail=f"Startup '{sid}' not found in fantasy draft catalog.",
                    )
                startups_meta[sid] = meta

            # 3. Budget Salary Cap Verification (<= 100,000 SP)
            total_price = sum(m.fantasy_price_sp for m in startups_meta.values())
            if total_price > SALARY_CAP_SP:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=(
                        f"Roster exceeds salary cap of {SALARY_CAP_SP:,} SP. "
                        f"Total requested: {total_price:,} SP (Excess: {total_price - SALARY_CAP_SP:,} SP)."
                    ),
                )

            # 4. Sector Diversification Verification (>= 3 Sectors)
            sectors = [m.sector for m in startups_meta.values()]
            distinct_sectors = set(sectors)
            if len(distinct_sectors) < MIN_DISTINCT_SECTORS:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=(
                        f"Sector diversification rule violated: Roster spans {len(distinct_sectors)} sectors "
                        f"({', '.join(distinct_sectors)}). Minimum {MIN_DISTINCT_SECTORS} distinct sectors required."
                    ),
                )

            # 5. Anti-Monopoly Checks (Max 2 per Sector, Max 2 per Wilaya)
            sector_counts: Dict[str, int] = {}
            for sec in sectors:
                sector_counts[sec] = sector_counts.get(sec, 0) + 1
                if sector_counts[sec] > MAX_STARTUPS_PER_SECTOR:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"Anti-monopoly constraint: Maximum {MAX_STARTUPS_PER_SECTOR} startups allowed from sector '{sec}'.",
                    )

            wilaya_counts: Dict[int, int] = {}
            for m in startups_meta.values():
                wilaya_counts[m.wilaya] = wilaya_counts.get(m.wilaya, 0) + 1
                if wilaya_counts[m.wilaya] > MAX_STARTUPS_PER_WILAYA:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"Anti-monopoly constraint: Maximum {MAX_STARTUPS_PER_WILAYA} startups allowed from Wilaya {m.wilaya}.",
                    )

            # 6. Build Selections & Compute Multipliers
            selections: List[RosterStartupSelection] = []

            # A. Captain Selection (1.5x)
            cap_meta = startups_meta[captain_startup_id]
            selections.append(
                RosterStartupSelection(
                    startup_id=cap_meta.id,
                    startup_name=cap_meta.name,
                    sector=cap_meta.sector,
                    wilaya=cap_meta.wilaya,
                    valuation_dzd=cap_meta.valuation_dzd,
                    fantasy_price_sp=cap_meta.fantasy_price_sp,
                    role="CAPTAIN",
                    multiplier=CAPTAIN_MULTIPLIER,
                )
            )

            # B. Wildcard Selection (2.0x if valuation < 30M DZD, else 1.0x)
            wild_meta = startups_meta[wildcard_startup_id]
            is_underdog = wild_meta.valuation_dzd < WILDCARD_VALUATION_CEILING_DZD
            wild_mult = WILDCARD_BOOST_MULTIPLIER if is_underdog else WILDCARD_BASE_MULTIPLIER
            selections.append(
                RosterStartupSelection(
                    startup_id=wild_meta.id,
                    startup_name=wild_meta.name,
                    sector=wild_meta.sector,
                    wilaya=wild_meta.wilaya,
                    valuation_dzd=wild_meta.valuation_dzd,
                    fantasy_price_sp=wild_meta.fantasy_price_sp,
                    role="WILDCARD",
                    multiplier=wild_mult,
                )
            )

            # C. Core Selections (1.0x each)
            for cid in core_startup_ids:
                core_meta = startups_meta[cid]
                selections.append(
                    RosterStartupSelection(
                        startup_id=core_meta.id,
                        startup_name=core_meta.name,
                        sector=core_meta.sector,
                        wilaya=core_meta.wilaya,
                        valuation_dzd=core_meta.valuation_dzd,
                        fantasy_price_sp=core_meta.fantasy_price_sp,
                        role="CORE",
                        multiplier=CORE_MULTIPLIER,
                    )
                )

            # Calculate any existing gameweek points from events already fired in this gameweek
            gw_points = 0.0
            for sel in selections:
                sel_pts = sum(
                    e.base_points * sel.multiplier
                    for e in self._events
                    if e.startup_id == sel.startup_id and e.gameweek == gameweek
                )
                sel.gameweek_points = round(sel_pts, 2)
                gw_points += sel.gameweek_points

            roster_id = f"roster-{user_id}-s{season_id}-gw{gameweek}"
            roster = UserGameweekRoster(
                roster_id=roster_id,
                user_id=user_id,
                season_id=season_id,
                gameweek=gameweek,
                total_sp_spent=total_price,
                remaining_sp_budget=SALARY_CAP_SP - total_price,
                sectors_count=len(distinct_sectors),
                startups=selections,
                gameweek_total_points=round(gw_points, 2),
                submitted_at=datetime.now(timezone.utc).isoformat(),
            )

            key = f"{user_id}:{season_id}:{gameweek}"
            self._rosters[key] = roster
            self._recalculate_user_season_score(user_id=user_id, season_id=season_id)
            return roster

    def get_user_roster(self, user_id: int, season_id: str, gameweek: int) -> Optional[UserGameweekRoster]:
        """Retrieves user roster for a specific gameweek."""
        with self._lock:
            key = f"{user_id}:{season_id}:{gameweek}"
            return self._rosters.get(key)

    def trigger_real_world_event(
        self,
        startup_id: str,
        event_type: str,
        gameweek: int,
        description: Optional[str] = None,
        evidence_hash: Optional[str] = None,
    ) -> RealWorldKpiEvent:
        """
        Records an authenticated real-world scoring event from company telemetry or pitch show judges.
        Updates points for all manager rosters that drafted this startup for the gameweek,
        applying their individual role multipliers (Captain 1.5x, Wildcard 2.0x, Core 1.0x).
        """
        with self._lock:
            if event_type not in KPI_SCORING_SCHEDULE:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Invalid event type '{event_type}'. Valid types: {list(KPI_SCORING_SCHEDULE.keys())}",
                )

            sched = KPI_SCORING_SCHEDULE[event_type]
            base_pts = sched["points"]
            desc = description or sched["nameEn"]

            # Generate evidence hash if omitted
            ts = datetime.now(timezone.utc).isoformat()
            ev_hash = evidence_hash or hashlib.sha256(f"{startup_id}:{event_type}:{gameweek}:{ts}".encode()).hexdigest()

            event = RealWorldKpiEvent(
                event_id=f"evt-{uuid.uuid4().hex[:10]}",
                startup_id=startup_id,
                gameweek=gameweek,
                event_type=event_type,
                base_points=base_pts,
                description=desc,
                evidence_hash=ev_hash,
                timestamp=ts,
            )
            self._events.append(event)

            # Propagate points to affected rosters
            affected_users: Set[int] = set()
            for key, roster in self._rosters.items():
                if roster.gameweek == gameweek:
                    for sel in roster.startups:
                        if sel.startup_id == startup_id:
                            earned = round(base_pts * sel.multiplier, 2)
                            sel.gameweek_points = round(sel.gameweek_points + earned, 2)
                            roster.gameweek_total_points = round(roster.gameweek_total_points + earned, 2)
                            affected_users.add(roster.user_id)

            # Update season scores for affected users
            season = self.get_active_season()
            for uid in affected_users:
                self._recalculate_user_season_score(user_id=uid, season_id=season.season_id)

            logger.info(
                f"Real-world event triggered: [{event_type}] for startup {startup_id} "
                f"(Base: {base_pts:+d} pts, Gameweek {gameweek}, Affected Users: {len(affected_users)})"
            )
            return event

    def _recalculate_user_season_score(self, user_id: int, season_id: str) -> float:
        """Sums points across all gameweeks for the user in the season."""
        total = 0.0
        for key, roster in self._rosters.items():
            if roster.user_id == user_id and roster.season_id == season_id:
                total += roster.gameweek_total_points

        season_key = f"{user_id}:{season_id}"
        self._user_season_scores[season_key] = round(total, 2)
        return total

    def get_global_leaderboard(
        self,
        season_id: Optional[str] = None,
        gameweek: Optional[int] = None,
        limit: int = 50,
    ) -> List[Dict[str, Any]]:
        """
        Returns ranked global leaderboard for the season or specific gameweek.
        """
        with self._lock:
            active_season = self.get_active_season()
            target_season_id = season_id or active_season.season_id

            results = []
            if gameweek is not None:
                # Filter by specific gameweek
                for key, roster in self._rosters.items():
                    if roster.season_id == target_season_id and roster.gameweek == gameweek:
                        results.append({
                            "userId": roster.user_id,
                            "gameweek": gameweek,
                            "points": roster.gameweek_total_points,
                            "rosterSummary": [f"{s.startup_name} ({s.role} x{s.multiplier})" for s in roster.startups],
                        })
                results.sort(key=lambda x: x["points"], reverse=True)
            else:
                # Cumulative season leaderboard
                user_ids = set()
                for key, roster in self._rosters.items():
                    if roster.season_id == target_season_id:
                        user_ids.add(roster.user_id)

                for uid in user_ids:
                    pts = self._user_season_scores.get(f"{uid}:{target_season_id}", 0.0)
                    results.append({
                        "userId": uid,
                        "seasonId": target_season_id,
                        "points": pts,
                    })
                results.sort(key=lambda x: x["points"], reverse=True)

            for idx, item in enumerate(results[:limit], start=1):
                item["rank"] = idx

            return results[:limit]

    # =========================================================================
    # PRIVATE MINI-LEAGUES (University, Regional, Diaspora, Corporate)
    # =========================================================================

    def create_mini_league(
        self,
        name: str,
        category: str,
        owner_user_id: int,
        description: Optional[str] = None,
    ) -> MiniLeague:
        """
        Creates a private mini-league and generates a unique invite code.
        Supported categories: UNIVERSITY, REGIONAL, DIASPORA, CORPORATE.
        """
        valid_cats = {"UNIVERSITY", "REGIONAL", "DIASPORA", "CORPORATE"}
        cat_upper = category.upper()
        if cat_upper not in valid_cats:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid mini-league category '{category}'. Valid: {list(valid_cats)}",
            )

        with self._lock:
            lid = f"league-{uuid.uuid4().hex[:8]}"
            code_prefix = cat_upper[:3]
            short_hash = hashlib.sha256(f"{name}:{owner_user_id}:{datetime.now()}".encode()).hexdigest()[:4].upper()
            invite_code = f"{code_prefix}-2026-{short_hash}"

            mini = MiniLeague(
                league_id=lid,
                name=name,
                category=cat_upper,
                description=description or f"Private {cat_upper.title()} League",
                owner_user_id=owner_user_id,
                invite_code=invite_code,
                members=[owner_user_id],
                created_at=datetime.now(timezone.utc).isoformat(),
            )
            self._mini_leagues[lid] = mini
            logger.info(f"Private mini-league '{name}' created by user {owner_user_id} [Code: {invite_code}]")
            return mini

    def join_mini_league(self, invite_code: str, user_id: int) -> MiniLeague:
        """Joins a private mini-league via its invite code."""
        with self._lock:
            target = None
            for league in self._mini_leagues.values():
                if league.invite_code.strip().upper() == invite_code.strip().upper():
                    target = league
                    break

            if not target:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"No mini-league found matching invite code '{invite_code}'.",
                )

            if user_id not in target.members:
                target.members.append(user_id)
                logger.info(f"User {user_id} joined mini-league '{target.name}'")

            return target

    def get_mini_league(self, league_id: str) -> MiniLeague:
        """Retrieves mini-league by ID."""
        with self._lock:
            league = self._mini_leagues.get(league_id)
            if not league:
                raise HTTPException(status_code=404, detail="Mini-league not found")
            return league

    def get_user_mini_leagues(self, user_id: int) -> List[MiniLeague]:
        """Lists all mini-leagues a user is a member of."""
        with self._lock:
            return [l for l in self._mini_leagues.values() if user_id in l.members]

    def get_mini_league_standings(
        self,
        league_id: str,
        season_id: Optional[str] = None,
        gameweek: Optional[int] = None,
    ) -> Dict[str, Any]:
        """
        Computes custom ranked standings for members of a mini-league.
        """
        with self._lock:
            league = self.get_mini_league(league_id)
            active_season = self.get_active_season()
            target_season = season_id or active_season.season_id

            standings = []
            for member_id in league.members:
                gw_key = f"{member_id}:{target_season}:{gameweek}" if gameweek else None
                gw_roster = self._rosters.get(gw_key) if gw_key else None
                gw_pts = gw_roster.gameweek_total_points if gw_roster else 0.0
                season_pts = self._user_season_scores.get(f"{member_id}:{target_season}", 0.0)

                standings.append({
                    "userId": member_id,
                    "gameweekPoints": gw_pts,
                    "seasonPoints": season_pts,
                    "rosterActive": gw_roster is not None,
                })

            # Sort by season points descending (or gameweek points if gameweek specified)
            sort_key = "gameweekPoints" if gameweek else "seasonPoints"
            standings.sort(key=lambda x: x[sort_key], reverse=True)

            for idx, entry in enumerate(standings, start=1):
                entry["rank"] = idx

            return {
                "leagueId": league.league_id,
                "leagueName": league.name,
                "category": league.category,
                "inviteCode": league.invite_code,
                "memberCount": len(league.members),
                "seasonId": target_season,
                "gameweek": gameweek,
                "standings": standings,
            }

    def list_events(self, gameweek: Optional[int] = None) -> List[RealWorldKpiEvent]:
        """Lists recorded scoring events."""
        with self._lock:
            if gameweek is not None:
                return [e for e in self._events if e.gameweek == gameweek]
            return list(self._events)


# Global Singleton Fantasy Engine Instance
fantasy_league_engine = FantasyStartupLeagueEngine()
