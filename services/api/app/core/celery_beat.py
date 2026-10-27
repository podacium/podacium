"""
Celery Beat Scheduler — re-exports the shared Celery app from celery.py.

NOTE: celery.py is the SINGLE source of truth for the Celery app, including
the beat_schedule configuration. This module exists solely so the
`celery -A app.core.celery_beat beat` command has a dedicated entry point
without duplicating 86 lines of configuration.
"""
from app.core.celery import celery_app

app = celery_app
