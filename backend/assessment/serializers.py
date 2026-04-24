from rest_framework import serializers

from .models import CandidateSession, HRUser, TaskCard, TestConfig

CRITICALITY_LEVEL_LABELS = {
    TaskCard.CriticalityLevel.LOW: "Низкая",
    TaskCard.CriticalityLevel.MEDIUM: "Средняя",
    TaskCard.CriticalityLevel.HIGH: "Высокая",
}


def normalize_test_title(value):
    return " ".join(value.split())


def build_criticality_results(session):
    telemetry_logs = session.telemetry_logs or []
    assigned_levels_by_card_id = {}

    for log in telemetry_logs:
        card_id = log.get("card_id")
        assigned_level = log.get("assigned_criticality_level")
        if not isinstance(card_id, int):
            continue

        if assigned_level in CRITICALITY_LEVEL_LABELS:
            assigned_levels_by_card_id[card_id] = assigned_level
        else:
            assigned_levels_by_card_id[card_id] = None

    results = []
    correct_count = 0
    incorrect_count = 0
    missing_count = 0

    for card in session.test_config.cards.all():
        assigned_level = assigned_levels_by_card_id.get(card.id)
        is_correct = assigned_level == card.criticality_level if assigned_level is not None else None

        if is_correct is True:
            correct_count += 1
        elif is_correct is False:
            incorrect_count += 1
        else:
            missing_count += 1

        results.append(
            {
                "card_id": card.id,
                "card_text": card.text,
                "expected_criticality_level": card.criticality_level,
                "expected_criticality_label": CRITICALITY_LEVEL_LABELS[card.criticality_level],
                "assigned_criticality_level": assigned_level,
                "assigned_criticality_label": CRITICALITY_LEVEL_LABELS.get(assigned_level),
                "is_correct": is_correct,
            }
        )

    return {
        "total_count": len(results),
        "correct_count": correct_count,
        "incorrect_count": incorrect_count,
        "missing_count": missing_count,
        "results": results,
    }


class HRRegistrationSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=8)
    confirm_password = serializers.CharField(write_only=True, min_length=8)

    class Meta:
        model = HRUser
        fields = ("username", "password", "confirm_password")

    def validate(self, attrs):
        if attrs["password"] != attrs["confirm_password"]:
            raise serializers.ValidationError(
                "\u041f\u0430\u0440\u043e\u043b\u0438 \u043d\u0435 \u0441\u043e\u0432\u043f\u0430\u0434\u0430\u044e\u0442."
            )

        if HRUser.objects.filter(username=attrs["username"]).exists():
            raise serializers.ValidationError(
                "\u0422\u0430\u043a\u043e\u0439 \u043b\u043e\u0433\u0438\u043d \u0443\u0436\u0435 \u0437\u0430\u043d\u044f\u0442."
            )

        return attrs

    def create(self, validated_data):
        validated_data.pop("confirm_password")
        return HRUser.objects.create_user(**validated_data)


class TaskCardWriteSerializer(serializers.ModelSerializer):
    class Meta:
        model = TaskCard
        fields = ("id", "text", "criticality_level")


class TaskCardPublicSerializer(serializers.ModelSerializer):
    """
    The public play endpoint hides criticality_level intentionally.
    This keeps the weighting rules server-side and avoids candidate cheating.
    """

    class Meta:
        model = TaskCard
        fields = ("id", "text")


class TestConfigListSerializer(serializers.ModelSerializer):
    cards = TaskCardWriteSerializer(many=True, read_only=True)

    class Meta:
        model = TestConfig
        fields = ("id", "title", "calc_dsi", "calc_sri", "calc_tcei", "cards")


class TestConfigCreateSerializer(serializers.ModelSerializer):
    cards = TaskCardWriteSerializer(many=True, required=False)
    session_token = serializers.UUIDField(read_only=True)
    source_test_id = serializers.PrimaryKeyRelatedField(
        queryset=TestConfig.objects.none(),
        required=False,
        write_only=True,
    )

    class Meta:
        model = TestConfig
        fields = (
            "id",
            "title",
            "calc_dsi",
            "calc_sri",
            "calc_tcei",
            "cards",
            "session_token",
            "source_test_id",
        )
        extra_kwargs = {
            "title": {"required": False},
            "calc_dsi": {"required": False},
            "calc_sri": {"required": False},
            "calc_tcei": {"required": False},
        }

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        request = self.context.get("request")
        user = getattr(request, "user", None)
        if user and user.is_authenticated:
            self.fields["source_test_id"].queryset = TestConfig.objects.filter(hr=user).prefetch_related(
                "cards"
            )

    def _build_copy_title(self, source_test):
        base_title = normalize_test_title(source_test.title) or "Копия теста"
        request = self.context.get("request")
        user = getattr(request, "user", None)

        if not user or not user.is_authenticated:
            return f"{base_title} (копия)"

        existing_titles = {
            normalize_test_title(title).casefold()
            for title in TestConfig.objects.filter(hr=user).values_list("title", flat=True)
        }
        candidate_title = f"{base_title} (копия)"
        if normalize_test_title(candidate_title).casefold() not in existing_titles:
            return candidate_title

        copy_number = 2
        while True:
            candidate_title = f"{base_title} (копия {copy_number})"
            if normalize_test_title(candidate_title).casefold() not in existing_titles:
                return candidate_title
            copy_number += 1

    def _build_source_cards_data(self, source_test):
        return [
            {
                "text": card.text,
                "criticality_level": card.criticality_level,
            }
            for card in source_test.cards.all()
        ]

    def validate_title(self, value):
        normalized_title = normalize_test_title(value)
        if not normalized_title:
            raise serializers.ValidationError(
                "\u041d\u0430\u0437\u0432\u0430\u043d\u0438\u0435 \u0442\u0435\u0441\u0442\u0430 \u043d\u0435 \u043c\u043e\u0436\u0435\u0442 \u0431\u044b\u0442\u044c \u043f\u0443\u0441\u0442\u044b\u043c."
            )

        request = self.context.get("request")
        user = getattr(request, "user", None)
        if user and user.is_authenticated:
            existing_titles = TestConfig.objects.filter(hr=user).values_list("title", flat=True)
            normalized_title_folded = normalized_title.casefold()
            if any(
                normalize_test_title(existing_title).casefold() == normalized_title_folded
                for existing_title in existing_titles
            ):
                raise serializers.ValidationError(
                    "\u0422\u0435\u0441\u0442 \u0441 \u0442\u0430\u043a\u0438\u043c \u043d\u0430\u0437\u0432\u0430\u043d\u0438\u0435\u043c \u0443\u0436\u0435 \u0441\u0443\u0449\u0435\u0441\u0442\u0432\u0443\u0435\u0442."
                )

        return normalized_title

    def validate(self, attrs):
        source_test = attrs.get("source_test_id")
        if source_test:
            attrs.setdefault("title", self._build_copy_title(source_test))
            attrs.setdefault("calc_dsi", source_test.calc_dsi)
            attrs.setdefault("calc_sri", source_test.calc_sri)
            attrs.setdefault("calc_tcei", source_test.calc_tcei)
            if not attrs.get("cards"):
                attrs["cards"] = self._build_source_cards_data(source_test)

        cards = attrs.get("cards", [])
        if not cards:
            raise serializers.ValidationError(
                "\u041d\u0443\u0436\u043d\u043e \u0434\u043e\u0431\u0430\u0432\u0438\u0442\u044c \u0445\u043e\u0442\u044f \u0431\u044b \u043e\u0434\u043d\u0443 \u043a\u0430\u0440\u0442\u043e\u0447\u043a\u0443 \u0437\u0430\u0434\u0430\u043d\u0438\u044f."
            )

        if attrs.get("calc_tcei"):
            attrs["calc_dsi"] = True
            attrs["calc_sri"] = True

        attrs["calc_tcei"] = attrs.get("calc_dsi") and attrs.get("calc_sri")

        if not any((attrs.get("calc_dsi"), attrs.get("calc_sri"), attrs.get("calc_tcei"))):
            raise serializers.ValidationError(
                "\u041d\u0443\u0436\u043d\u043e \u0432\u043a\u043b\u044e\u0447\u0438\u0442\u044c \u0445\u043e\u0442\u044f \u0431\u044b \u043e\u0434\u043d\u0443 \u043c\u0435\u0442\u0440\u0438\u043a\u0443: DSI, SRI \u0438\u043b\u0438 TCEI."
            )

        return attrs

    def create(self, validated_data):
        source_test = validated_data.pop("source_test_id", None)
        cards_data = validated_data.pop("cards", None)
        if cards_data is None and source_test is not None:
            cards_data = self._build_source_cards_data(source_test)

        test_config = TestConfig.objects.create(**validated_data)

        TaskCard.objects.bulk_create(
            [TaskCard(test_config=test_config, **card_data) for card_data in cards_data]
        )

        # The brief does not include a dedicated endpoint for creating sessions.
        # For the MVP, one candidate session is created automatically per test config.
        session = CandidateSession.objects.create(test_config=test_config)
        test_config.session_token = session.token
        return test_config

    def to_representation(self, instance):
        data = super().to_representation(instance)
        data["session_token"] = getattr(instance, "session_token", None)
        return data


class CandidateSessionDashboardSerializer(serializers.ModelSerializer):
    test_id = serializers.IntegerField(source="test_config.id", read_only=True)
    test_title = serializers.CharField(source="test_config.title", read_only=True)
    calc_dsi = serializers.BooleanField(source="test_config.calc_dsi", read_only=True)
    calc_sri = serializers.BooleanField(source="test_config.calc_sri", read_only=True)
    calc_tcei = serializers.BooleanField(source="test_config.calc_tcei", read_only=True)

    class Meta:
        model = CandidateSession
        fields = (
            "id",
            "test_id",
            "test_title",
            "token",
            "candidate_name",
            "is_completed",
            "calc_dsi",
            "calc_sri",
            "calc_tcei",
            "final_dsi",
            "final_sri",
            "final_tcei",
        )


class CandidateSessionDetailSerializer(CandidateSessionDashboardSerializer):
    criticality_total_count = serializers.SerializerMethodField()
    criticality_correct_count = serializers.SerializerMethodField()
    criticality_incorrect_count = serializers.SerializerMethodField()
    criticality_missing_count = serializers.SerializerMethodField()
    criticality_results = serializers.SerializerMethodField()

    def _get_criticality_summary(self, obj):
        if not hasattr(obj, "_criticality_summary"):
            obj._criticality_summary = build_criticality_results(obj)
        return obj._criticality_summary

    def get_criticality_total_count(self, obj):
        return self._get_criticality_summary(obj)["total_count"]

    def get_criticality_correct_count(self, obj):
        return self._get_criticality_summary(obj)["correct_count"]

    def get_criticality_incorrect_count(self, obj):
        return self._get_criticality_summary(obj)["incorrect_count"]

    def get_criticality_missing_count(self, obj):
        return self._get_criticality_summary(obj)["missing_count"]

    def get_criticality_results(self, obj):
        return self._get_criticality_summary(obj)["results"]

    class Meta(CandidateSessionDashboardSerializer.Meta):
        fields = CandidateSessionDashboardSerializer.Meta.fields + (
            "criticality_total_count",
            "criticality_correct_count",
            "criticality_incorrect_count",
            "criticality_missing_count",
            "criticality_results",
        )


class PublicPlaySerializer(serializers.ModelSerializer):
    cards = TaskCardPublicSerializer(many=True, source="test_config.cards", read_only=True)
    title = serializers.CharField(source="test_config.title", read_only=True)
    calc_sri = serializers.BooleanField(source="test_config.calc_sri", read_only=True)

    class Meta:
        model = CandidateSession
        fields = ("token", "title", "candidate_name", "is_completed", "calc_sri", "cards")


class TelemetryLogInputSerializer(serializers.Serializer):
    card_id = serializers.IntegerField()
    time_spent_ms = serializers.IntegerField(min_value=0)
    drag_count = serializers.IntegerField(min_value=0)
    assigned_criticality_level = serializers.IntegerField(
        min_value=TaskCard.CriticalityLevel.LOW,
        max_value=TaskCard.CriticalityLevel.HIGH,
    )
    final_rank = serializers.IntegerField(min_value=1, required=False)


class SubmitTelemetrySerializer(serializers.Serializer):
    candidate_name = serializers.CharField(max_length=255, allow_blank=True)
    logs = TelemetryLogInputSerializer(many=True, allow_empty=False)
