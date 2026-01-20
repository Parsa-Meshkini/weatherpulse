from django.db import migrations, models
import django.db.models.deletion
import weather.models


class Migration(migrations.Migration):

    dependencies = [
        ("weather", "0002_userpreference"),
    ]

    operations = [
        migrations.CreateModel(
            name="AlertSubscription",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("name", models.CharField(max_length=120)),
                ("country", models.CharField(blank=True, default="", max_length=80)),
                ("admin1", models.CharField(blank=True, default="", max_length=120)),
                ("lat", models.FloatField()),
                ("lon", models.FloatField()),
                ("timezone", models.CharField(default="auto", max_length=64)),
                ("min_severity", models.CharField(choices=[("info", "Info"), ("warning", "Warning")], default="info", max_length=10)),
                ("types", models.JSONField(default=weather.models.default_alert_types)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("user", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="alert_subscriptions", to="auth.user")),
            ],
            options={
                "unique_together": {("user", "lat", "lon")},
            },
        ),
    ]
