import hashlib
import json

from django.conf import settings
from django.core.management.base import BaseCommand
from django.utils import timezone
from sendgrid import SendGridAPIClient
from sendgrid.helpers.mail import Mail

from weather.alerts import build_alerts
from weather.models import AlertSubscription
from weather.services import fetch_forecast


SEVERITY_ORDER = {"info": 1, "warning": 2}


def filter_alerts(alerts, types, min_severity):
    min_rank = SEVERITY_ORDER.get(min_severity, 1)
    filtered = []
    for alert in alerts:
        if alert.get("type") not in types:
            continue
        if SEVERITY_ORDER.get(alert.get("severity"), 1) < min_rank:
            continue
        filtered.append(alert)
    return filtered


def hash_alerts(alerts):
    payload = json.dumps(alerts, sort_keys=True).encode("utf-8")
    return hashlib.sha256(payload).hexdigest()


class Command(BaseCommand):
    help = "Send alert subscription emails."

    def handle(self, *args, **options):
        if not settings.SENDGRID_API_KEY or not settings.ALERTS_FROM_EMAIL:
            self.stdout.write("Missing SENDGRID_API_KEY or ALERTS_FROM_EMAIL. Skipping.")
            return

        sg = SendGridAPIClient(settings.SENDGRID_API_KEY)
        now = timezone.now()
        min_interval = settings.ALERTS_MIN_INTERVAL_MINUTES

        subs = AlertSubscription.objects.select_related("user").all()
        if not subs.exists():
            self.stdout.write("No alert subscriptions found.")
            return

        for sub in subs:
            if not sub.user.email:
                continue

            try:
                forecast = fetch_forecast(sub.lat, sub.lon, sub.timezone)
            except Exception as exc:
                self.stdout.write(f"Fetch failed for {sub.name}: {exc}")
                continue

            alerts = build_alerts(forecast)
            alerts = filter_alerts(alerts, sub.types or [], sub.min_severity)
            if not alerts:
                continue

            payload_hash = hash_alerts(alerts)
            if sub.last_alert_hash == payload_hash and sub.last_sent_at:
                delta = (now - sub.last_sent_at).total_seconds() / 60
                if delta < min_interval:
                    continue

            subject = f"WeatherPulse alerts for {sub.name}"
            lines = [
                f"{alert.get('title')} - {alert.get('detail')}"
                for alert in alerts
            ]
            content = "\n".join(lines)

            message = Mail(
                from_email=settings.ALERTS_FROM_EMAIL,
                to_emails=sub.user.email,
                subject=subject,
                plain_text_content=content,
            )
            try:
                sg.send(message)
                sub.last_alert_hash = payload_hash
                sub.last_sent_at = now
                sub.save(update_fields=["last_alert_hash", "last_sent_at"])
                self.stdout.write(f"Sent alerts to {sub.user.email} ({sub.name})")
            except Exception as exc:
                self.stdout.write(f"Send failed for {sub.user.email}: {exc}")
