from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("weather", "0003_alertsubscription"),
    ]

    operations = [
        migrations.AddField(
            model_name="alertsubscription",
            name="last_alert_hash",
            field=models.CharField(blank=True, default="", max_length=64),
        ),
        migrations.AddField(
            model_name="alertsubscription",
            name="last_sent_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
    ]
