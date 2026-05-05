import uuid

from django.contrib.auth.models import AbstractUser, UserManager
from django.db import models

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


class HRUserManager(UserManager):
    def _create_user(self, username, password, **extra_fields):
        if not username:
            raise ValueError("The username must be set")

        username = self.model.normalize_username(username)
        user = self.model(username=username, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_user(self, username, password=None, **extra_fields):
        extra_fields.setdefault("is_staff", False)
        extra_fields.setdefault("is_superuser", False)
        return self._create_user(username, password, **extra_fields)

    def create_superuser(self, username, password=None, **extra_fields):
        extra_fields.setdefault("is_staff", True)
        extra_fields.setdefault("is_superuser", True)
        extra_fields.setdefault("is_active", True)

        if extra_fields.get("is_staff") is not True:
            raise ValueError("Superuser must have is_staff=True.")
        if extra_fields.get("is_superuser") is not True:
            raise ValueError("Superuser must have is_superuser=True.")

        return self._create_user(username, password, **extra_fields)


class HRUser(AbstractUser):
    """
    Custom HR user model.
    A custom auth model is added at project start so the thesis project can grow
    later without a painful user-model migration.
    """

    email = None
    USERNAME_FIELD = "username"
    REQUIRED_FIELDS = []
    objects = HRUserManager()


class AssessmentProfile(models.Model):
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    version = models.PositiveIntegerField(default=BASE_PROFILE_VERSION)
    is_active = models.BooleanField(default=True)
    is_archived = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    low_criticality_weight = models.FloatField(default=BASE_PROFILE_PARAMS["low_criticality_weight"])
    medium_criticality_weight = models.FloatField(default=BASE_PROFILE_PARAMS["medium_criticality_weight"])
    high_criticality_weight = models.FloatField(default=BASE_PROFILE_PARAMS["high_criticality_weight"])
    low_criticality_max_time_ms = models.PositiveIntegerField(
        default=BASE_PROFILE_PARAMS["low_criticality_max_time_ms"]
    )
    medium_criticality_max_time_ms = models.PositiveIntegerField(
        default=BASE_PROFILE_PARAMS["medium_criticality_max_time_ms"]
    )
    high_criticality_max_time_ms = models.PositiveIntegerField(
        default=BASE_PROFILE_PARAMS["high_criticality_max_time_ms"]
    )
    sri_max_drag_count = models.PositiveIntegerField(default=BASE_PROFILE_PARAMS["sri_max_drag_count"])
    min_time_ms = models.PositiveIntegerField(default=BASE_PROFILE_PARAMS["min_time_ms"])

    class Meta:
        ordering = ("name", "version", "id")

    def __str__(self):
        return f"{self.name}, версия {self.version}"

    @property
    def is_base_profile(self):
        return self.name == BASE_PROFILE_NAME and self.version == BASE_PROFILE_VERSION

    def build_snapshot(self):
        return {
            "profile_name_snapshot": self.name,
            "profile_version_snapshot": self.version,
            "low_criticality_weight_snapshot": self.low_criticality_weight,
            "medium_criticality_weight_snapshot": self.medium_criticality_weight,
            "high_criticality_weight_snapshot": self.high_criticality_weight,
            "low_criticality_max_time_ms_snapshot": self.low_criticality_max_time_ms,
            "medium_criticality_max_time_ms_snapshot": self.medium_criticality_max_time_ms,
            "high_criticality_max_time_ms_snapshot": self.high_criticality_max_time_ms,
            "sri_max_drag_count_snapshot": self.sri_max_drag_count,
            "min_time_ms_snapshot": self.min_time_ms,
        }


def get_default_assessment_profile():
    profile, _ = AssessmentProfile.objects.get_or_create(
        name=BASE_PROFILE_NAME,
        version=BASE_PROFILE_VERSION,
        defaults={
            "description": BASE_PROFILE_DESCRIPTION,
            "is_active": True,
            "is_archived": False,
            **BASE_PROFILE_PARAMS,
        },
    )
    return profile


class TestConfig(models.Model):
    hr = models.ForeignKey(HRUser, on_delete=models.CASCADE, related_name="test_configs")
    assessment_profile = models.ForeignKey(
        AssessmentProfile,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="test_configs",
    )
    title = models.CharField(max_length=255)
    calc_dsi = models.BooleanField(default=True)
    calc_sri = models.BooleanField(default=True)
    calc_tcei = models.BooleanField(default=True)
    profile_name_snapshot = models.CharField(max_length=255, default=BASE_PROFILE_NAME)
    profile_version_snapshot = models.PositiveIntegerField(default=BASE_PROFILE_VERSION)
    low_criticality_weight_snapshot = models.FloatField(
        default=BASE_PROFILE_PARAMS["low_criticality_weight"]
    )
    medium_criticality_weight_snapshot = models.FloatField(
        default=BASE_PROFILE_PARAMS["medium_criticality_weight"]
    )
    high_criticality_weight_snapshot = models.FloatField(
        default=BASE_PROFILE_PARAMS["high_criticality_weight"]
    )
    low_criticality_max_time_ms_snapshot = models.PositiveIntegerField(
        default=BASE_PROFILE_PARAMS["low_criticality_max_time_ms"]
    )
    medium_criticality_max_time_ms_snapshot = models.PositiveIntegerField(
        default=BASE_PROFILE_PARAMS["medium_criticality_max_time_ms"]
    )
    high_criticality_max_time_ms_snapshot = models.PositiveIntegerField(
        default=BASE_PROFILE_PARAMS["high_criticality_max_time_ms"]
    )
    sri_max_drag_count_snapshot = models.PositiveIntegerField(
        default=BASE_PROFILE_PARAMS["sri_max_drag_count"]
    )
    min_time_ms_snapshot = models.PositiveIntegerField(default=BASE_PROFILE_PARAMS["min_time_ms"])

    def __str__(self):
        return self.title

    def save(self, *args, **kwargs):
        if self._state.adding:
            profile = self.assessment_profile or get_default_assessment_profile()
            self.apply_assessment_profile_snapshot(profile)
        elif self.assessment_profile_id is None:
            self.apply_assessment_profile_snapshot(get_default_assessment_profile())
        super().save(*args, **kwargs)

    def apply_assessment_profile_snapshot(self, profile):
        self.assessment_profile = profile
        for field_name, value in profile.build_snapshot().items():
            setattr(self, field_name, value)

    def get_profile_params_snapshot(self):
        return {
            TaskCard.CriticalityLevel.LOW: {
                "weight": self.low_criticality_weight_snapshot,
                "t_max": self.low_criticality_max_time_ms_snapshot,
            },
            TaskCard.CriticalityLevel.MEDIUM: {
                "weight": self.medium_criticality_weight_snapshot,
                "t_max": self.medium_criticality_max_time_ms_snapshot,
            },
            TaskCard.CriticalityLevel.HIGH: {
                "weight": self.high_criticality_weight_snapshot,
                "t_max": self.high_criticality_max_time_ms_snapshot,
            },
            "sri_max_drag_count": self.sri_max_drag_count_snapshot,
            "min_time_ms": self.min_time_ms_snapshot,
        }


class TaskCard(models.Model):
    class CriticalityLevel(models.IntegerChoices):
        LOW = 1, "Low"
        MEDIUM = 2, "Medium"
        HIGH = 3, "High"

    test_config = models.ForeignKey(TestConfig, on_delete=models.CASCADE, related_name="cards")
    text = models.CharField(max_length=255)
    criticality_level = models.IntegerField(choices=CriticalityLevel.choices)

    def __str__(self):
        return f"{self.test_config.title}: {self.text[:40]}"


class CandidateSession(models.Model):
    test_config = models.ForeignKey(
        TestConfig, on_delete=models.CASCADE, related_name="candidate_sessions"
    )
    token = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)
    candidate_name = models.CharField(max_length=255, blank=True)
    is_completed = models.BooleanField(default=False)
    telemetry_logs = models.JSONField(null=True, blank=True)
    final_dsi = models.FloatField(null=True, blank=True)
    final_sri = models.FloatField(null=True, blank=True)
    final_tcei = models.FloatField(null=True, blank=True)

    def __str__(self):
        return f"{self.test_config.title} / {self.candidate_name or self.token}"
