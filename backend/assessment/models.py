import uuid

from django.contrib.auth.models import AbstractUser
from django.db import models


class HRUser(AbstractUser):
    """
    Custom HR user model.
    A custom auth model is added at project start so the thesis project can grow
    later without a painful user-model migration.
    """


class TestConfig(models.Model):
    hr = models.ForeignKey(HRUser, on_delete=models.CASCADE, related_name="test_configs")
    title = models.CharField(max_length=255)
    calc_dsi = models.BooleanField(default=True)
    calc_sri = models.BooleanField(default=True)
    calc_tcei = models.BooleanField(default=True)

    def __str__(self):
        return self.title


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
