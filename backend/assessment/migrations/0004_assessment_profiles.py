import django.db.models.deletion
from django.db import migrations, models


BASE_PROFILE_NAME = "Базовый профиль"
BASE_PROFILE_DESCRIPTION = "Стандартные параметры оценки, используемые в базовой версии системы"
BASE_PROFILE_VERSION = 1
BASE_PROFILE_PARAMS = {
    "low_criticality_weight": 0.5,
    "medium_criticality_weight": 1.0,
    "high_criticality_weight": 1.5,
    "low_criticality_max_time_ms": 30000,
    "medium_criticality_max_time_ms": 15000,
    "high_criticality_max_time_ms": 10000,
    "sri_max_drag_count": 4,
    "min_time_ms": 2000,
}


def seed_base_profile(apps, schema_editor):
    AssessmentProfile = apps.get_model("assessment", "AssessmentProfile")
    TestConfig = apps.get_model("assessment", "TestConfig")

    base_profile, _ = AssessmentProfile.objects.get_or_create(
        name=BASE_PROFILE_NAME,
        version=BASE_PROFILE_VERSION,
        defaults={
            "description": BASE_PROFILE_DESCRIPTION,
            "is_active": True,
            "is_archived": False,
            **BASE_PROFILE_PARAMS,
        },
    )

    TestConfig.objects.filter(assessment_profile__isnull=True).update(
        assessment_profile=base_profile,
        profile_name_snapshot=base_profile.name,
        profile_version_snapshot=base_profile.version,
        low_criticality_weight_snapshot=base_profile.low_criticality_weight,
        medium_criticality_weight_snapshot=base_profile.medium_criticality_weight,
        high_criticality_weight_snapshot=base_profile.high_criticality_weight,
        low_criticality_max_time_ms_snapshot=base_profile.low_criticality_max_time_ms,
        medium_criticality_max_time_ms_snapshot=base_profile.medium_criticality_max_time_ms,
        high_criticality_max_time_ms_snapshot=base_profile.high_criticality_max_time_ms,
        sri_max_drag_count_snapshot=base_profile.sri_max_drag_count,
        min_time_ms_snapshot=base_profile.min_time_ms,
    )


class Migration(migrations.Migration):
    dependencies = [
        ("assessment", "0003_alter_hruser_managers"),
    ]

    operations = [
        migrations.CreateModel(
            name="AssessmentProfile",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("name", models.CharField(max_length=255)),
                ("description", models.TextField(blank=True)),
                ("version", models.PositiveIntegerField(default=1)),
                ("is_active", models.BooleanField(default=True)),
                ("is_archived", models.BooleanField(default=False)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("low_criticality_weight", models.FloatField(default=0.5)),
                ("medium_criticality_weight", models.FloatField(default=1.0)),
                ("high_criticality_weight", models.FloatField(default=1.5)),
                ("low_criticality_max_time_ms", models.PositiveIntegerField(default=30000)),
                ("medium_criticality_max_time_ms", models.PositiveIntegerField(default=15000)),
                ("high_criticality_max_time_ms", models.PositiveIntegerField(default=10000)),
                ("sri_max_drag_count", models.PositiveIntegerField(default=4)),
                ("min_time_ms", models.PositiveIntegerField(default=2000)),
            ],
            options={
                "ordering": ("name", "version", "id"),
            },
        ),
        migrations.AddField(
            model_name="testconfig",
            name="assessment_profile",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="test_configs",
                to="assessment.assessmentprofile",
            ),
        ),
        migrations.AddField(
            model_name="testconfig",
            name="profile_name_snapshot",
            field=models.CharField(default=BASE_PROFILE_NAME, max_length=255),
        ),
        migrations.AddField(
            model_name="testconfig",
            name="profile_version_snapshot",
            field=models.PositiveIntegerField(default=BASE_PROFILE_VERSION),
        ),
        migrations.AddField(
            model_name="testconfig",
            name="low_criticality_weight_snapshot",
            field=models.FloatField(default=BASE_PROFILE_PARAMS["low_criticality_weight"]),
        ),
        migrations.AddField(
            model_name="testconfig",
            name="medium_criticality_weight_snapshot",
            field=models.FloatField(default=BASE_PROFILE_PARAMS["medium_criticality_weight"]),
        ),
        migrations.AddField(
            model_name="testconfig",
            name="high_criticality_weight_snapshot",
            field=models.FloatField(default=BASE_PROFILE_PARAMS["high_criticality_weight"]),
        ),
        migrations.AddField(
            model_name="testconfig",
            name="low_criticality_max_time_ms_snapshot",
            field=models.PositiveIntegerField(default=BASE_PROFILE_PARAMS["low_criticality_max_time_ms"]),
        ),
        migrations.AddField(
            model_name="testconfig",
            name="medium_criticality_max_time_ms_snapshot",
            field=models.PositiveIntegerField(default=BASE_PROFILE_PARAMS["medium_criticality_max_time_ms"]),
        ),
        migrations.AddField(
            model_name="testconfig",
            name="high_criticality_max_time_ms_snapshot",
            field=models.PositiveIntegerField(default=BASE_PROFILE_PARAMS["high_criticality_max_time_ms"]),
        ),
        migrations.AddField(
            model_name="testconfig",
            name="sri_max_drag_count_snapshot",
            field=models.PositiveIntegerField(default=BASE_PROFILE_PARAMS["sri_max_drag_count"]),
        ),
        migrations.AddField(
            model_name="testconfig",
            name="min_time_ms_snapshot",
            field=models.PositiveIntegerField(default=BASE_PROFILE_PARAMS["min_time_ms"]),
        ),
        migrations.RunPython(seed_base_profile, migrations.RunPython.noop),
    ]
