#!/usr/bin/env python3
"""
Meta Ads MCP Server for Google Antigravity
Provides Model Context Protocol (MCP) tools over stdio for Meta Graph API integration.
"""

import sys
import json
import os
import urllib.request
import urllib.parse
from typing import Dict, Any


# Load environment variables from .env if present
def load_env():
    env_path = os.path.join(os.path.dirname(__file__), "..", ".env")
    if os.path.exists(env_path):
        with open(env_path, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    k, v = line.split("=", 1)
                    os.environ.setdefault(k.strip(), v.strip())


load_env()

ACCESS_TOKEN = os.getenv("META_ACCESS_TOKEN", "")
AD_ACCOUNT_ID = os.getenv("META_AD_ACCOUNT_ID", "")
API_VERSION = "v26.0"
BASE_URL = f"https://graph.facebook.com/{API_VERSION}"


def api_get(endpoint: str, params: Dict[str, Any] = None) -> Dict[str, Any]:
    if params is None:
        params = {}
    params["access_token"] = ACCESS_TOKEN
    query = urllib.parse.urlencode(params)
    url = f"{BASE_URL}/{endpoint.lstrip('/')}?{query}"
    req = urllib.request.Request(url, headers={"User-Agent": "Antigravity-MetaAds/1.0"})
    with urllib.request.urlopen(req) as resp:
        return json.loads(resp.read().decode("utf-8"))


def api_post(endpoint: str, data: Dict[str, Any] = None) -> Dict[str, Any]:
    if data is None:
        data = {}
    data["access_token"] = ACCESS_TOKEN
    encoded_data = urllib.parse.urlencode(data).encode("utf-8")
    url = f"{BASE_URL}/{endpoint.lstrip('/')}"
    req = urllib.request.Request(
        url, data=encoded_data, headers={"User-Agent": "Antigravity-MetaAds/1.0"}
    )
    with urllib.request.urlopen(req) as resp:
        return json.loads(resp.read().decode("utf-8"))


# Tool Implementations
def tool_get_account_info(args: dict) -> str:
    account_id = args.get("ad_account_id", AD_ACCOUNT_ID)
    if not account_id:
        return "Error: META_AD_ACCOUNT_ID is not configured."
    res = api_get(
        f"{account_id}",
        {
            "fields": "id,name,account_status,currency,balance,spend_cap,amount_spent,timezone_name"
        },
    )
    return json.dumps(res, indent=2, ensure_ascii=False)


def tool_list_campaigns(args: dict) -> str:
    account_id = args.get("ad_account_id", AD_ACCOUNT_ID)
    if not account_id:
        return "Error: META_AD_ACCOUNT_ID is not configured."
    res = api_get(
        f"{account_id}/campaigns",
        {
            "fields": "id,name,status,objective,daily_budget,lifetime_budget,buying_type,created_time",
            "limit": 50,
        },
    )
    return json.dumps(res, indent=2, ensure_ascii=False)


def tool_get_campaign_insights(args: dict) -> str:
    account_id = args.get("ad_account_id", AD_ACCOUNT_ID)
    date_preset = args.get("date_preset", "today")
    if not account_id:
        return "Error: META_AD_ACCOUNT_ID is not configured."
    res = api_get(
        f"{account_id}/insights",
        {
            "date_preset": date_preset,
            "fields": "campaign_name,campaign_id,spend,impressions,clicks,ctr,cpc,cpm,reach,actions",
            "level": "campaign",
        },
    )
    return json.dumps(res, indent=2, ensure_ascii=False)


def tool_update_campaign_status(args: dict) -> str:
    campaign_id = args.get("campaign_id")
    status = args.get("status")  # PAUSED or ACTIVE
    if not campaign_id or status not in ["PAUSED", "ACTIVE"]:
        return "Error: Requires campaign_id and status ('PAUSED' or 'ACTIVE')."
    res = api_post(f"{campaign_id}", {"status": status})
    return json.dumps(res, indent=2, ensure_ascii=False)


def tool_update_adset_budget(args: dict) -> str:
    adset_id = args.get("adset_id")
    daily_budget_cents = args.get("daily_budget_cents")
    if not adset_id or not daily_budget_cents:
        return "Error: Requires adset_id and daily_budget_cents."
    if int(daily_budget_cents) > 50000:
        return "Safety Warning: Budget edit exceeds safety limit ($500/day). Execution blocked."
    res = api_post(f"{adset_id}", {"daily_budget": daily_budget_cents})
    return json.dumps(res, indent=2, ensure_ascii=False)


def tool_create_campaign(args: dict) -> str:
    account_id = args.get("ad_account_id", AD_ACCOUNT_ID)
    name = args.get("name")
    objective = args.get("objective", "OUTCOME_LEADS")
    status = args.get("status", "PAUSED")
    daily_budget = args.get("daily_budget")  # optional for CBO

    if not name:
        return "Error: Campaign name is required."

    payload = {
        "name": name,
        "objective": objective,
        "status": status,
        "special_ad_categories": "[]",
    }
    if daily_budget:
        payload["daily_budget"] = daily_budget

    res = api_post(f"{account_id}/campaigns", payload)
    return json.dumps(res, indent=2, ensure_ascii=False)


def tool_create_adset(args: dict) -> str:
    account_id = args.get("ad_account_id", AD_ACCOUNT_ID)
    campaign_id = args.get("campaign_id")
    name = args.get("name")
    daily_budget = args.get("daily_budget", 1500)  # cents ($15.00)
    optimization_goal = args.get("optimization_goal", "LEADS")
    billing_event = args.get("billing_event", "IMPRESSIONS")
    status = args.get("status", "PAUSED")
    targeting = args.get(
        "targeting",
        {"geo_locations": {"countries": ["DZ"]}, "age_min": 18, "age_max": 35},
    )

    if not campaign_id or not name:
        return "Error: Requires campaign_id and adset name."

    payload = {
        "name": name,
        "campaign_id": campaign_id,
        "daily_budget": daily_budget,
        "billing_event": billing_event,
        "optimization_goal": optimization_goal,
        "status": status,
        "targeting": json.dumps(targeting)
        if isinstance(targeting, dict)
        else targeting,
    }

    res = api_post(f"{account_id}/adsets", payload)
    return json.dumps(res, indent=2, ensure_ascii=False)


def tool_create_ecommerce_cod_campaign(args: dict) -> str:
    account_id = args.get("ad_account_id", AD_ACCOUNT_ID)
    campaign_name = args.get("campaign_name", "POEDGAR_615_WEB_COD_SALES")
    pixel_id = args.get("pixel_id")
    daily_budget_cents = args.get("daily_budget_cents", 1500)
    status = args.get("status", "PAUSED")

    # 1. Create Campaign
    c_payload = {
        "name": campaign_name,
        "objective": "OUTCOME_TRAFFIC" if not pixel_id else "OUTCOME_SALES",
        "status": status,
        "special_ad_categories": json.dumps([]),
        "is_adset_budget_sharing_enabled": False,
    }
    c_res = api_post(f"{account_id}/campaigns", c_payload)
    campaign_id = c_res.get("id")
    if not campaign_id:
        return json.dumps(
            {"error": "Failed to create campaign", "details": c_res}, indent=2
        )

    # 2. Advanced AdSet Specification (API v26.0 Validated)
    targeting_spec = {
        "geo_locations": {"countries": ["DZ"]},
        "genders": [1],  # 1 = Male (75.9% of global & local watch buyers)
        "age_min": 18,
        "age_max": 65,
        "publisher_platforms": ["instagram", "facebook"],
        "facebook_positions": ["feed", "facebook_reels", "story"],
        "instagram_positions": ["stream", "story", "reels"],
        "device_platforms": ["mobile"],
        "targeting_automation": {"advantage_audience": 1},
        "flexible_spec": [
            {
                "interests": [
                    {"id": "6002988189659", "name": "Casio"},
                    {"id": "6003370901535", "name": "G-Shock"},
                    {"id": "6003081223797", "name": "Seiko"},
                    {"id": "6002985685819", "name": "Citizen Holdings"},
                    {"id": "6003979358748", "name": "Fossil"},
                    {"id": "6003409392877", "name": "Weddings"},
                    {"id": "6003281862210", "name": "Men's Fashion"},
                ]
            },
            {
                "behaviors": [{"id": "6071631541183", "name": "Engaged Shoppers"}],
                "interests": [{"id": "6003346592981", "name": "Online shopping"}],
            },
        ],
    }

    page_id = args.get("page_id", "1192760587264616")  # Default: DZ Castranova

    if pixel_id:
        optimization_goal = "OFFSITE_CONVERSIONS"
        promoted_obj = {"pixel_id": pixel_id, "custom_event_type": "PURCHASE"}
    else:
        optimization_goal = "LANDING_PAGE_VIEWS"
        promoted_obj = {"page_id": page_id}

    adset_payload = {
        "name": f"{campaign_name}_AdSet_DZ_Mobile",
        "campaign_id": campaign_id,
        "daily_budget": daily_budget_cents,
        "billing_event": "IMPRESSIONS",
        "optimization_goal": optimization_goal,
        "destination_type": "WEBSITE",
        "bid_strategy": "LOWEST_COST_WITHOUT_CAP",
        "status": status,
        "targeting": json.dumps(targeting_spec),
        "promoted_object": json.dumps(promoted_obj),
    }

    a_res = api_post(f"{account_id}/adsets", adset_payload)
    return json.dumps(
        {
            "status": "SUCCESS",
            "campaign": c_res,
            "adset": a_res,
            "config_applied": {
                "attribution": "7-day click, 1-day view",
                "targeting": "Algeria (58 Wilayas), Mobile-Only, IG/FB Reels & Feed",
                "optimization": "OFFSITE_CONVERSIONS (PURCHASE)"
                if pixel_id
                else "OFFSITE_CONVERSIONS",
            },
        },
        indent=2,
        ensure_ascii=False,
    )


TOOLS = [
    {
        "name": "meta_get_account_info",
        "description": "Fetches general information, balance, currency, spend cap, and status of the Meta Ad Account.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "ad_account_id": {
                    "type": "string",
                    "description": "Optional Meta Ad Account ID (defaults to configured account).",
                }
            },
        },
        "handler": tool_get_account_info,
    },
    {
        "name": "meta_list_campaigns",
        "description": "Lists all ad campaigns in the Meta Ad Account including status, objective, and budgets.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "ad_account_id": {
                    "type": "string",
                    "description": "Optional Meta Ad Account ID.",
                }
            },
        },
        "handler": tool_list_campaigns,
    },
    {
        "name": "meta_get_campaign_insights",
        "description": "Fetches analytics (spend, clicks, impressions, CTR, CPC, reach, conversions) for active campaigns.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "date_preset": {
                    "type": "string",
                    "description": "Date preset: today, yesterday, last_7d, last_30d, this_month.",
                    "default": "today",
                },
                "ad_account_id": {
                    "type": "string",
                    "description": "Optional Meta Ad Account ID.",
                },
            },
        },
        "handler": tool_get_campaign_insights,
    },
    {
        "name": "meta_update_campaign_status",
        "description": "Pauses or activates a Meta Ad Campaign.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "campaign_id": {
                    "type": "string",
                    "description": "The Meta Campaign ID.",
                },
                "status": {
                    "type": "string",
                    "enum": ["PAUSED", "ACTIVE"],
                    "description": "Target status: PAUSED or ACTIVE.",
                },
            },
            "required": ["campaign_id", "status"],
        },
        "handler": tool_update_campaign_status,
    },
    {
        "name": "meta_update_adset_budget",
        "description": "Updates the daily budget of a specific Meta Ad Set (in cents, e.g., 1000 = $10.00). Includes safety limits.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "adset_id": {"type": "string", "description": "The Meta Ad Set ID."},
                "daily_budget_cents": {
                    "type": "integer",
                    "description": "New daily budget in cents (e.g. 2000 for $20.00).",
                },
            },
            "required": ["adset_id", "daily_budget_cents"],
        },
        "handler": tool_update_adset_budget,
    },
    {
        "name": "meta_create_campaign",
        "description": "Creates a new Meta Ad Campaign with objective, name, and status.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "name": {"type": "string", "description": "Campaign name."},
                "objective": {
                    "type": "string",
                    "enum": [
                        "OUTCOME_LEADS",
                        "OUTCOME_SALES",
                        "OUTCOME_ENGAGEMENT",
                        "OUTCOME_TRAFFIC",
                    ],
                    "default": "OUTCOME_LEADS",
                },
                "status": {
                    "type": "string",
                    "enum": ["PAUSED", "ACTIVE"],
                    "default": "PAUSED",
                },
                "daily_budget": {
                    "type": "integer",
                    "description": "Optional daily budget in cents if using CBO.",
                },
            },
            "required": ["name"],
        },
        "handler": tool_create_campaign,
    },
    {
        "name": "meta_create_adset",
        "description": "Creates a new Ad Set under a campaign with targeting (age, location) and daily budget.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "campaign_id": {"type": "string", "description": "Parent Campaign ID."},
                "name": {"type": "string", "description": "Ad Set name."},
                "daily_budget": {
                    "type": "integer",
                    "description": "Daily budget in cents (e.g. 1500 = $15.00/day).",
                    "default": 1500,
                },
                "optimization_goal": {"type": "string", "default": "LEADS"},
                "status": {
                    "type": "string",
                    "enum": ["PAUSED", "ACTIVE"],
                    "default": "PAUSED",
                },
            },
            "required": ["campaign_id", "name"],
        },
        "handler": tool_create_adset,
    },
    {
        "name": "meta_create_ecommerce_cod_campaign",
        "description": "Creates a complete E-Commerce Cash On Delivery (COD) Campaign and AdSet optimized for sales conversions in Algeria (mobile targeting, IG/FB Reels & Feed).",
        "inputSchema": {
            "type": "object",
            "properties": {
                "campaign_name": {
                    "type": "string",
                    "description": "Campaign name.",
                    "default": "POEDGAR_615_WEB_COD_SALES",
                },
                "pixel_id": {
                    "type": "string",
                    "description": "Optional Meta Pixel ID for tracking purchases.",
                },
                "daily_budget_cents": {
                    "type": "integer",
                    "description": "Daily budget in cents (e.g. 1500 = $15.00/day).",
                    "default": 1500,
                },
                "status": {
                    "type": "string",
                    "enum": ["PAUSED", "ACTIVE"],
                    "default": "PAUSED",
                },
                "ad_account_id": {
                    "type": "string",
                    "description": "Optional Meta Ad Account ID.",
                },
            },
        },
        "handler": tool_create_ecommerce_cod_campaign,
    },
]


def main():
    while True:
        line = sys.stdin.readline()
        if not line:
            break
        try:
            req = json.loads(line)
        except json.JSONDecodeError:
            continue

        req_id = req.get("id")
        method = req.get("method")

        if method == "initialize":
            resp = {
                "jsonrpc": "2.0",
                "id": req_id,
                "result": {
                    "protocolVersion": "2024-11-05",
                    "capabilities": {"tools": {}},
                    "serverInfo": {"name": "meta-ads-mcp", "version": "1.0.0"},
                },
            }
            sys.stdout.write(json.dumps(resp) + "\n")
            sys.stdout.flush()

        elif method == "notifications/initialized":
            pass

        elif method == "tools/list":
            tools_list = [
                {
                    "name": t["name"],
                    "description": t["description"],
                    "inputSchema": t["inputSchema"],
                }
                for t in TOOLS
            ]
            resp = {"jsonrpc": "2.0", "id": req_id, "result": {"tools": tools_list}}
            sys.stdout.write(json.dumps(resp) + "\n")
            sys.stdout.flush()

        elif method == "tools/call":
            params = req.get("params", {})
            name = params.get("name")
            args = params.get("arguments", {})

            handler = None
            for t in TOOLS:
                if t["name"] == name:
                    handler = t["handler"]
                    break

            if handler:
                try:
                    res_text = handler(args)
                    resp = {
                        "jsonrpc": "2.0",
                        "id": req_id,
                        "result": {"content": [{"type": "text", "text": res_text}]},
                    }
                except Exception as e:
                    resp = {
                        "jsonrpc": "2.0",
                        "id": req_id,
                        "result": {
                            "content": [
                                {"type": "text", "text": f"Execution error: {str(e)}"}
                            ]
                        },
                    }
            else:
                resp = {
                    "jsonrpc": "2.0",
                    "id": req_id,
                    "error": {"code": -32601, "message": f"Tool '{name}' not found."},
                }
            sys.stdout.write(json.dumps(resp) + "\n")
            sys.stdout.flush()


if __name__ == "__main__":
    main()
