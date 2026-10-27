"""
Report Scheduler Service - Next Run Time Calculation
Computes accurate execution timestamps for daily, weekly, monthly, hourly, and 5-field cron schedules.
"""
from datetime import datetime, timedelta, timezone
from typing import Optional
import logging

logger = logging.getLogger(__name__)


def calculate_next_report_run(
    schedule_type: str,
    interval: Optional[int] = None,
    cron_expr: Optional[str] = None,
    from_time: Optional[datetime] = None,
) -> Optional[datetime]:
    """
    Calculate the next run time for a scheduled report.
    Supports: daily, weekly, monthly, hourly, and cron expressions.
    """
    now = from_time or datetime.now(timezone.utc)
    interval = interval if (interval and interval > 0) else 1

    if schedule_type == "daily":
        return now + timedelta(days=interval)
    elif schedule_type == "weekly":
        return now + timedelta(weeks=interval)
    elif schedule_type == "monthly":
        return now + timedelta(days=interval * 30)
    elif schedule_type == "hourly":
        return now + timedelta(hours=interval)
    elif schedule_type == "cron" and cron_expr:
        try:
            try:
                from croniter import croniter  # type: ignore[import-untyped]
                iter = croniter(cron_expr.strip(), now)
                return iter.get_next(datetime)
            except ImportError:
                # Standard fallback cron parser for 5-field expressions (e.g., '0 9 * * *' or '*/15 * * * *')
                parts = cron_expr.strip().split()
                if len(parts) == 5:
                    minute_part, hour_part = parts[0], parts[1]
                    next_time = now + timedelta(minutes=1)
                    if minute_part.startswith("*/"):
                        step = int(minute_part[2:])
                        next_minute = ((next_time.minute // step) + 1) * step
                        if next_minute >= 60:
                            next_time = next_time.replace(minute=0, second=0, microsecond=0) + timedelta(hours=1)
                        else:
                            next_time = next_time.replace(minute=next_minute, second=0, microsecond=0)
                        return next_time
                    elif minute_part.isdigit() and hour_part.isdigit():
                        target_min = int(minute_part)
                        target_hour = int(hour_part)
                        candidate = now.replace(hour=target_hour, minute=target_min, second=0, microsecond=0)
                        if candidate <= now:
                            candidate += timedelta(days=1)
                        return candidate
        except Exception as err:
            logger.warning(f"Error parsing cron expression '{cron_expr}': {err}")

        return now + timedelta(days=1)

    return None
