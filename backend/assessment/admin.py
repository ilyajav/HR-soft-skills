from django.contrib import admin
from django.contrib.auth.admin import UserAdmin

from .models import CandidateSession, HRUser, TaskCard, TestConfig


class TaskCardInline(admin.TabularInline):
    model = TaskCard
    extra = 1


@admin.register(HRUser)
class HRUserAdmin(UserAdmin):
    pass


@admin.register(TestConfig)
class TestConfigAdmin(admin.ModelAdmin):
    list_display = ("title", "hr", "calc_dsi", "calc_sri")
    inlines = [TaskCardInline]


@admin.register(CandidateSession)
class CandidateSessionAdmin(admin.ModelAdmin):
    list_display = ("candidate_name", "test_config", "token", "is_completed", "final_tcei")
    search_fields = ("candidate_name", "token")
