from django.db import migrations


class Migration(migrations.Migration):
    dependencies = [
        ("assessment", "0001_initial"),
    ]

    operations = [
        migrations.RemoveField(
            model_name="hruser",
            name="email",
        ),
    ]
