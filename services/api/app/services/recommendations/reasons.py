from typing import Dict, Any, List


REASON_KEYS = {
    "skill_match": "dashboard.recommendations.reason.skillMatch",
    "trending": "dashboard.recommendations.reason.trending",
    "collab_filter": "dashboard.recommendations.reason.collabFilter",
    "geo_loc": "dashboard.recommendations.reason.geoLoc",
    "price_match": "dashboard.recommendations.reason.priceMatch",
    "social": "dashboard.recommendations.reason.social",
    "popular": "dashboard.recommendations.reason.popular",
    "new": "dashboard.recommendations.reason.new",
    "career_path": "dashboard.recommendations.reason.careerPath",
}


def build_reason(key: str, params: Dict[str, Any] = None) -> Dict[str, Any]:
    return {"key": REASON_KEYS.get(key, key), "params": params or {}}


def skill_match_reason(skills: List[str]) -> Dict[str, Any]:
    return build_reason("skill_match", {"skills": skills})


def trending_reason(field: str = "") -> Dict[str, Any]:
    return build_reason("trending", {"field": field})


def collab_filter_reason(course_title: str = "") -> Dict[str, Any]:
    return build_reason("collab_filter", {"course": course_title})


def geo_loc_reason(location: str = "") -> Dict[str, Any]:
    return build_reason("geo_loc", {"location": location})


def price_match_reason() -> Dict[str, Any]:
    return build_reason("price_match")


def social_reason(name: str = "") -> Dict[str, Any]:
    return build_reason("social", {"name": name})


def popular_reason() -> Dict[str, Any]:
    return build_reason("popular")


def new_reason() -> Dict[str, Any]:
    return build_reason("new")


def career_path_reason(path: str = "") -> Dict[str, Any]:
    return build_reason("career_path", {"path": path})
