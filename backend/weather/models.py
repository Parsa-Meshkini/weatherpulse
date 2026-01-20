from django.conf import settings
from django.db import models

def default_alert_types():
    return ["rain", "wind", "uv", "freeze", "heat"]

class SavedLocation(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="saved_locations")
    name = models.CharField(max_length=120)
    country = models.CharField(max_length=80, blank=True, default="")
    admin1 = models.CharField(max_length=120, blank=True, default="")
    lat = models.FloatField()
    lon = models.FloatField()
    timezone = models.CharField(max_length=64, default="auto")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("user", "lat", "lon")

    def __str__(self):
        return f"{self.name} ({self.user})"

class UserPreference(models.Model):
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="prefs")
    unit = models.CharField(max_length=1, default="C")
    theme = models.CharField(max_length=10, default="light")
    time_format = models.CharField(max_length=2, default="24")
    updated_at = models.DateTimeField(auto_now=True)

class AlertSubscription(models.Model):
    SEVERITY_CHOICES = [
        ("info", "Info"),
        ("warning", "Warning"),
    ]

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="alert_subscriptions")
    name = models.CharField(max_length=120)
    country = models.CharField(max_length=80, blank=True, default="")
    admin1 = models.CharField(max_length=120, blank=True, default="")
    lat = models.FloatField()
    lon = models.FloatField()
    timezone = models.CharField(max_length=64, default="auto")
    min_severity = models.CharField(max_length=10, choices=SEVERITY_CHOICES, default="info")
    types = models.JSONField(default=default_alert_types)
    last_sent_at = models.DateTimeField(null=True, blank=True)
    last_alert_hash = models.CharField(max_length=64, blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("user", "lat", "lon")

    def __str__(self):
        return f"{self.name} ({self.user})"
