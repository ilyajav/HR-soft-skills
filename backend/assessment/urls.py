from django.urls import path

from .views import (
    AdminAssessmentProfileDetailView,
    AdminAssessmentProfileListCreateView,
    AdminHRUserDeactivateView,
    AdminHRUserListCreateView,
    HRAssessmentProfileListView,
    HRLoginView,
    HRRegisterView,
    HRSessionDetailView,
    HRSessionListView,
    HRStatisticsView,
    HRTestDestroyView,
    HRTestListCreateView,
    PublicPlayView,
    PublicSubmitView,
)


urlpatterns = [
    path("auth/login/", HRLoginView.as_view(), name="hr-login"),
    path("auth/register/", HRRegisterView.as_view(), name="hr-register"),
    path("admin/hr-users/", AdminHRUserListCreateView.as_view(), name="admin-hr-users"),
    path("admin/hr-users/<int:pk>/", AdminHRUserDeactivateView.as_view(), name="admin-hr-user-detail"),
    path(
        "admin/assessment-profiles/",
        AdminAssessmentProfileListCreateView.as_view(),
        name="admin-assessment-profiles",
    ),
    path(
        "admin/assessment-profiles/<int:pk>/",
        AdminAssessmentProfileDetailView.as_view(),
        name="admin-assessment-profile-detail",
    ),
    path("hr/assessment-profiles/", HRAssessmentProfileListView.as_view(), name="hr-assessment-profiles"),
    path("hr/tests/", HRTestListCreateView.as_view(), name="hr-tests"),
    path("hr/tests/<int:pk>/", HRTestDestroyView.as_view(), name="hr-test-detail"),
    path("hr/sessions/", HRSessionListView.as_view(), name="hr-sessions"),
    path("hr/sessions/<int:pk>/", HRSessionDetailView.as_view(), name="hr-session-detail"),
    path("hr/statistics/", HRStatisticsView.as_view(), name="hr-statistics"),
    path("play/<uuid:token>/", PublicPlayView.as_view(), name="play-detail"),
    path("play/<uuid:token>/submit/", PublicSubmitView.as_view(), name="play-submit"),
]
