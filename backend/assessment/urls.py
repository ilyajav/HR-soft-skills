from django.urls import path

from .views import (
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
    path("hr/tests/", HRTestListCreateView.as_view(), name="hr-tests"),
    path("hr/tests/<int:pk>/", HRTestDestroyView.as_view(), name="hr-test-detail"),
    path("hr/sessions/", HRSessionListView.as_view(), name="hr-sessions"),
    path("hr/sessions/<int:pk>/", HRSessionDetailView.as_view(), name="hr-session-detail"),
    path("hr/statistics/", HRStatisticsView.as_view(), name="hr-statistics"),
    path("play/<uuid:token>/", PublicPlayView.as_view(), name="play-detail"),
    path("play/<uuid:token>/submit/", PublicSubmitView.as_view(), name="play-submit"),
]
