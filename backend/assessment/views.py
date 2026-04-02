from django.db import transaction
from django.db.models import Avg, F
from django.shortcuts import get_object_or_404
from rest_framework import generics, permissions, status
from rest_framework.authtoken.models import Token
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import CandidateSession, TaskCard, TestConfig
from .serializers import (
    CandidateSessionDetailSerializer,
    CandidateSessionDashboardSerializer,
    HRRegistrationSerializer,
    PublicPlaySerializer,
    SubmitTelemetrySerializer,
    TestConfigCreateSerializer,
    TestConfigListSerializer,
)

T_MIN = 2000
N_MAX = 4

CRITICALITY_RULES = {
    TaskCard.CriticalityLevel.LOW: {"weight": 0.5, "t_max": 30000},
    TaskCard.CriticalityLevel.MEDIUM: {"weight": 1.0, "t_max": 15000},
    TaskCard.CriticalityLevel.HIGH: {"weight": 1.5, "t_max": 1000},
}


class HRLoginView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        from django.contrib.auth import authenticate

        user = authenticate(
            username=request.data.get("username"),
            password=request.data.get("password"),
        )
        if not user:
            return Response(
                {
                    "detail": "\u041d\u0435\u0432\u0435\u0440\u043d\u044b\u0439 \u043b\u043e\u0433\u0438\u043d \u0438\u043b\u0438 \u043f\u0430\u0440\u043e\u043b\u044c."
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        token, _ = Token.objects.get_or_create(user=user)
        return Response({"token": token.key, "username": user.username})


class HRRegisterView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        serializer = HRRegistrationSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        token, _ = Token.objects.get_or_create(user=user)
        return Response(
            {"token": token.key, "username": user.username},
            status=status.HTTP_201_CREATED,
        )


class HRTestListCreateView(generics.ListCreateAPIView):
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return TestConfig.objects.filter(hr=self.request.user).prefetch_related("cards")

    def get_serializer_class(self):
        return TestConfigCreateSerializer if self.request.method == "POST" else TestConfigListSerializer

    def perform_create(self, serializer):
        serializer.save(hr=self.request.user)


class HRTestDestroyView(generics.DestroyAPIView):
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return TestConfig.objects.filter(hr=self.request.user)


class HRSessionListView(generics.ListAPIView):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = CandidateSessionDashboardSerializer

    def get_queryset(self):
        return (
            CandidateSession.objects.filter(test_config__hr=self.request.user)
            .select_related("test_config")
            .order_by("-id")
        )


class HRSessionDetailView(generics.RetrieveAPIView):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = CandidateSessionDetailSerializer

    def get_queryset(self):
        return (
            CandidateSession.objects.filter(test_config__hr=self.request.user)
            .select_related("test_config")
            .prefetch_related("test_config__cards")
        )


class HRStatisticsView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    @staticmethod
    def _round_or_none(value, precision=1):
        return round(value, precision) if value is not None else None

    def get(self, request):
        completed_sessions_qs = CandidateSession.objects.filter(
            is_completed=True,
            test_config__hr=request.user,
        ).order_by("id")
        completed_sessions = list(
            completed_sessions_qs.values(
                "candidate_name",
                "final_dsi",
                "final_sri",
                "final_tcei",
                test_title=F("test_config__title"),
            )
        )
        averages = completed_sessions_qs.aggregate(
            average_dsi=Avg("final_dsi"),
            average_sri=Avg("final_sri"),
            average_tcei=Avg("final_tcei"),
        )

        scatter_data = []
        session_breakdown = []
        tcei_distribution = {"high": 0, "medium": 0, "low": 0}

        for session in completed_sessions:
            final_dsi = session["final_dsi"]
            final_sri = session["final_sri"]
            final_tcei = session["final_tcei"]
            candidate_name = session["candidate_name"] or ""

            session_breakdown.append(
                {
                    "test_title": session["test_title"],
                    "candidate_name": candidate_name,
                    "final_dsi": round(final_dsi, 2) if final_dsi is not None else None,
                    "final_sri": round(final_sri, 2) if final_sri is not None else None,
                    "final_tcei": round(final_tcei, 2) if final_tcei is not None else None,
                }
            )

            if final_dsi is not None and final_sri is not None:
                scatter_data.append(
                    {
                        "candidate": session["candidate_name"] or "Без имени",
                        "dsi": round(final_dsi, 2),
                        "sri": round(final_sri, 2),
                        "tcei": round(final_tcei, 2) if final_tcei is not None else None,
                    }
                )

            if final_tcei is None:
                continue

            if final_tcei >= 75:
                tcei_distribution["high"] += 1
            elif final_tcei >= 50:
                tcei_distribution["medium"] += 1
            else:
                tcei_distribution["low"] += 1

        return Response(
            {
                "total_sessions": len(completed_sessions),
                "average_dsi": self._round_or_none(averages["average_dsi"]),
                "average_sri": self._round_or_none(averages["average_sri"]),
                "average_tcei": self._round_or_none(averages["average_tcei"]),
                "completed_sessions": session_breakdown,
                "scatter_data": scatter_data,
                "tcei_distribution": tcei_distribution,
            }
        )


class PublicPlayView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request, token):
        session = get_object_or_404(
            CandidateSession.objects.select_related("test_config").prefetch_related("test_config__cards"),
            token=token,
        )
        return Response(PublicPlaySerializer(session).data)


class PublicSubmitView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request, token):
        session = get_object_or_404(
            CandidateSession.objects.select_related("test_config").prefetch_related("test_config__cards"),
            token=token,
        )

        if session.is_completed:
            return Response(
                {
                    "detail": "\u042d\u0442\u0430 \u0441\u0435\u0441\u0441\u0438\u044f \u0443\u0436\u0435 \u0437\u0430\u0432\u0435\u0440\u0448\u0435\u043d\u0430."
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        serializer = SubmitTelemetrySerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        payload = serializer.validated_data
        logs = payload["logs"]

        card_map = {card.id: card for card in session.test_config.cards.all()}
        submitted_card_ids = {log["card_id"] for log in logs}
        if submitted_card_ids != set(card_map.keys()) or len(logs) != len(card_map):
            return Response(
                {
                    "detail": "\u0414\u043b\u044f \u043a\u0430\u0436\u0434\u043e\u0439 \u043a\u0430\u0440\u0442\u043e\u0447\u043a\u0438 \u043d\u0443\u0436\u043d\u043e \u043f\u0435\u0440\u0435\u0434\u0430\u0442\u044c \u0440\u043e\u0432\u043d\u043e \u043e\u0434\u0438\u043d \u043b\u043e\u0433."
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        ranked_logs = [log for log in logs if "final_rank" in log]
        if ranked_logs:
            if len(ranked_logs) != len(logs):
                return Response(
                    {
                        "detail": "\u0418\u0442\u043e\u0433\u043e\u0432\u0430\u044f \u043f\u043e\u0437\u0438\u0446\u0438\u044f \u0434\u043e\u043b\u0436\u043d\u0430 \u0431\u044b\u0442\u044c \u0443\u043a\u0430\u0437\u0430\u043d\u0430 \u0434\u043b\u044f \u0432\u0441\u0435\u0445 \u043a\u0430\u0440\u0442\u043e\u0447\u0435\u043a."
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )

            ranks = {log["final_rank"] for log in ranked_logs}
            expected_ranks = set(range(1, len(logs) + 1))
            if ranks != expected_ranks:
                return Response(
                    {
                        "detail": "\u0412 \u0440\u0435\u0437\u0443\u043b\u044c\u0442\u0430\u0442\u0435 \u043d\u0443\u0436\u043d\u043e \u0437\u0430\u0434\u0430\u0442\u044c \u0443\u043d\u0438\u043a\u0430\u043b\u044c\u043d\u044b\u0439 \u043f\u0440\u0438\u043e\u0440\u0438\u0442\u0435\u0442 \u0434\u043b\u044f \u043a\u0430\u0436\u0434\u043e\u0439 \u043a\u0430\u0440\u0442\u043e\u0447\u043a\u0438."
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )

        final_dsi, final_sri, final_tcei = self._calculate_scores(
            logs,
            card_map,
            session.test_config.calc_dsi,
            session.test_config.calc_sri,
            session.test_config.calc_tcei,
        )

        with transaction.atomic():
            session.candidate_name = payload["candidate_name"]
            session.telemetry_logs = logs
            session.final_dsi = final_dsi
            session.final_sri = final_sri
            session.final_tcei = final_tcei
            session.is_completed = True
            session.save()

        return Response(
            {
                "detail": "\u0420\u0435\u0437\u0443\u043b\u044c\u0442\u0430\u0442 \u0443\u0441\u043f\u0435\u0448\u043d\u043e \u0441\u043e\u0445\u0440\u0430\u043d\u0435\u043d.",
                "is_completed": True,
            }
        )

    def _calculate_scores(self, logs, card_map, calc_dsi, calc_sri, calc_tcei):
        """
        Backend-only thesis algorithm.
        The UI submits raw telemetry, and the API converts it into weighted scores.
        """

        weighted_dsi_sum = 0.0
        weighted_sri_sum = 0.0
        weight_sum = 0.0

        for log in logs:
            card = card_map[log["card_id"]]
            rules = CRITICALITY_RULES[card.criticality_level]
            weight = rules["weight"]
            t_max = rules["t_max"]
            effective_t_min = min(T_MIN, t_max)
            time_spent_ms = log["time_spent_ms"]
            drag_count = log["drag_count"]

            if time_spent_ms <= effective_t_min:
                dsi_i = 1.0
            elif time_spent_ms >= t_max:
                dsi_i = 0.0
            else:
                dsi_i = 1.0 - ((time_spent_ms - effective_t_min) / (t_max - effective_t_min))

            sri_i = max(0.0, 1.0 - (drag_count / N_MAX))

            weighted_dsi_sum += dsi_i * weight
            weighted_sri_sum += sri_i * weight
            weight_sum += weight

        raw_dsi = (weighted_dsi_sum / weight_sum) * 100 if weight_sum else None
        raw_sri = (weighted_sri_sum / weight_sum) * 100 if weight_sum else None

        final_dsi = raw_dsi if calc_dsi else None
        final_sri = raw_sri if calc_sri else None
        final_tcei = ((raw_dsi + raw_sri) / 2) if calc_tcei and raw_dsi is not None and raw_sri is not None else None
        return final_dsi, final_sri, final_tcei
