from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("weather", "0004_alertsubscription_tracking"),
    ]

    operations = [
        migrations.AddField(
            model_name="userpreference",
            name="time_format",
            field=models.CharField(default="24", max_length=2),
        ),
    ]
