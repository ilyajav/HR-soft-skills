import assessment.models
from django.db import migrations


class Migration(migrations.Migration):
    dependencies = [
        ("assessment", "0002_remove_hruser_email"),
    ]

    operations = [
        migrations.AlterModelManagers(
            name="hruser",
            managers=[
                ("objects", assessment.models.HRUserManager()),
            ],
        ),
    ]
