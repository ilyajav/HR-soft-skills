from django.contrib import admin
from django.contrib.auth.admin import UserAdmin

from .models import AssessmentProfile, CandidateSession, HRUser, TaskCard, TestConfig


class TaskCardInline(admin.TabularInline):
    model = TaskCard
    extra = 1


@admin.register(HRUser)
class HRUserAdmin(UserAdmin):
    fieldsets = (
        (None, {"fields": ("username", "password")}),
        ("Personal info", {"fields": ("first_name", "last_name")}),
        (
            "Permissions",
            {
                "fields": (
                    "is_active",
                    "is_staff",
                    "is_superuser",
                    "groups",
                    "user_permissions",
                ),
            },
        ),
        ("Important dates", {"fields": ("last_login", "date_joined")}),
    )
    add_fieldsets = (
        (
            None,
            {
                "classes": ("wide",),
                "fields": ("username", "password1", "password2"),
            },
        ),
    )
    list_display = ("username", "is_staff", "is_superuser", "is_active")
    search_fields = ("username", "first_name", "last_name")
    ordering = ("username",)


@admin.register(TestConfig)
class TestConfigAdmin(admin.ModelAdmin):
    list_display = ("title", "hr", "profile_name_snapshot", "profile_version_snapshot", "calc_dsi", "calc_sri")
    inlines = [TaskCardInline]


@admin.register(AssessmentProfile)
class AssessmentProfileAdmin(admin.ModelAdmin):
    list_display = ("name", "version", "is_active", "is_archived", "created_at", "updated_at")
    list_filter = ("is_active", "is_archived")
    search_fields = ("name", "description")


@admin.register(CandidateSession)
class CandidateSessionAdmin(admin.ModelAdmin):
    list_display = ("candidate_name", "test_config", "token", "is_completed", "final_tcei")
    search_fields = ("candidate_name", "token")
