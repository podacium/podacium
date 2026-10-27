#!/bin/bash
set -euo pipefail

# BetterStack Uptime Monitoring Setup for Podacium
# Usage: ./scripts/setup-monitoring.sh
# Requires: BETTERSTACK_API_TOKEN environment variable

ENV_FILE="${ENV_FILE:-/home/zuikre/podacium/.env.prod}"
BETTERSTACK_API_URL="https://uptime.betterstack.com/api/v2"

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*"
}

error() {
    log "ERROR: $*" >&2
}

# Load environment
if [[ -f "${ENV_FILE}" ]]; then
    # shellcheck source=/dev/null
    source "${ENV_FILE}"
else
    error "Environment file ${ENV_FILE} not found"
    exit 1
fi

: "${BETTERSTACK_API_TOKEN:?BETTERSTACK_API_TOKEN not set}"
: "${MONITOR_URL_BASE:?MONITOR_URL_BASE not set (e.g., https://backend-api.podacium.com)}"

# Monitor configurations
# Each monitor: name,url,expected_status,interval_seconds
MONITORS=(
    "API Health|${MONITOR_URL_BASE}/api/v1/health|200|60"
    "Education Modules Public|${MONITOR_URL_BASE}/api/v1/education/modules/public|200|60"
    "Hub Projects|${MONITOR_URL_BASE}/api/v1/hub/projects|200|60"
)

create_monitor() {
    local name="$1"
    local url="$2"
    local expected_status="$3"
    local interval="$4"

    log "Creating monitor: ${name} (${url})"

    response=$(curl -sS -X POST "${BETTERSTACK_API_URL}/monitors" \
        -H "Authorization: Bearer ${BETTERSTACK_API_TOKEN}" \
        -H "Content-Type: application/json" \
        -d "$(jq -n \
            --arg name "${name}" \
            --arg url "${url}" \
            --arg type "http" \
            --arg interval "${interval}" \
            --arg expected_status "${expected_status}" \
            --arg method "GET" \
            '{
                name: $name,
                url: $url,
                type: $type,
                period: ($interval | tonumber),
                timeout: 30,
                retry_count: 3,
                verify_ssl: true,
                request_options: {
                    method: $method,
                    headers: {}
                },
                http_check: {
                    expected_status_codes: [$expected_status | tonumber]
                }
            }')")

    if echo "${response}" | jq -e '.errors' >/dev/null 2>&1; then
        error "Failed to create monitor ${name}: $(echo "${response}" | jq -r '.errors[]')"
        return 1
    fi

    monitor_id=$(echo "${response}" | jq -r '.data.id')
    log "Created monitor ${name} with ID: ${monitor_id}"
    echo "${monitor_id}"
}

create_heartbeat() {
    local name="$1"
    local interval="$2"

    log "Creating heartbeat: ${name} (interval: ${interval}s)"

    response=$(curl -sS -X POST "${BETTERSTACK_API_URL}/heartbeats" \
        -H "Authorization: Bearer ${BETTERSTACK_API_TOKEN}" \
        -H "Content-Type: application/json" \
        -d "$(jq -n \
            --arg name "${name}" \
            --arg interval "${interval}" \
            '{
                name: $name,
                interval: ($interval | tonumber),
                grace_period: (($interval | tonumber) * 2)
            }')")

    if echo "${response}" | jq -e '.errors' >/dev/null 2>&1; then
        error "Failed to create heartbeat ${name}: $(echo "${response}" | jq -r '.errors[]')"
        return 1
    fi

    heartbeat_id=$(echo "${response}" | jq -r '.data.id')
    log "Created heartbeat ${name} with ID: ${heartbeat_id}"
    echo "${heartbeat_id}"
}

create_status_page() {
    log "Creating status page..."

    response=$(curl -sS -X POST "${BETTERSTACK_API_URL}/status-pages" \
        -H "Authorization: Bearer ${BETTERSTACK_API_TOKEN}" \
        -H "Content-Type: application/json" \
        -d "$(jq -n \
            --arg name "Podacium Status" \
            --arg subdomain "status-podacium" \
            '{
                name: $name,
                subdomain: $subdomain,
                public: true,
                show_powered_by: false
            }')")

    if echo "${response}" | jq -e '.errors' >/dev/null 2>&1; then
        error "Failed to create status page: $(echo "${response}" | jq -r '.errors[]')"
        return 1
    fi

    status_page_id=$(echo "${response}" | jq -r '.data.id')
    log "Created status page with ID: ${status_page_id}"
    echo "${status_page_id}"
}

add_monitors_to_status_page() {
    local status_page_id="$1"
    shift
    local monitor_ids=("$@")

    log "Adding ${#monitor_ids[@]} monitors to status page..."

    for monitor_id in "${monitor_ids[@]}"; do
        curl -sS -X POST "${BETTERSTACK_API_URL}/status-pages/${status_page_id}/monitors" \
            -H "Authorization: Bearer ${BETTERSTACK_API_TOKEN}" \
            -H "Content-Type: application/json" \
            -d "$(jq -n --arg monitor_id "${monitor_id}" '{monitor_id: $monitor_id}')" >/dev/null
    done

    log "All monitors added to status page"
}

main() {
    log "=== Podacium BetterStack Monitoring Setup ==="

    # Check dependencies
    for cmd in curl jq; do
        if ! command -v "${cmd}" &>/dev/null; then
            error "${cmd} is required but not installed"
            exit 1
        fi
    done

    # Create monitors
    monitor_ids=()
    for monitor_config in "${MONITORS[@]}"; do
        IFS='|' read -r name url expected_status interval <<< "${monitor_config}"
        monitor_id=$(create_monitor "${name}" "${url}" "${expected_status}" "${interval}")
        if [[ -n "${monitor_id}" ]]; then
            monitor_ids+=("${monitor_id}")
        fi
    done

    # Create heartbeat for cron jobs (e.g., backup, cleanup)
    heartbeat_id=$(create_heartbeat "podacium-cron" "86400") # 24 hours

    # Create status page
    status_page_id=$(create_status_page)

    # Add monitors to status page
    if [[ -n "${status_page_id}" ]] && [[ ${#monitor_ids[@]} -gt 0 ]]; then
        add_monitors_to_status_page "${status_page_id}" "${monitor_ids[@]}"
    fi

    log "=== Setup Complete ==="
    log "Monitors created: ${#monitor_ids[@]}"
    log "Heartbeat created: ${heartbeat_id:-none}"
    log "Status page: https://status-podacium.betteruptime.com"
    log ""
    log "Next steps:"
    log "1. Add BETTERSTACK_HEARTBEAT_URL to your cron jobs"
    log "2. Configure alerting policies in BetterStack dashboard"
    log "3. Add team members for incident notifications"
}

main "$@"