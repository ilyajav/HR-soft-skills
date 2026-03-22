from rest_framework import serializers

from .models import CandidateSession, HRUser, TaskCard, TestConfig


def normalize_test_title(value):
    return " ".join(value.split())


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
    cards = TaskCardWriteSerializer(many=True)
    session_token = serializers.UUIDField(read_only=True)

    class Meta:
        model = TestConfig
        fields = ("id", "title", "calc_dsi", "calc_sri", "calc_tcei", "cards", "session_token")

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
        cards_data = validated_data.pop("cards")
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
    final_rank = serializers.IntegerField(min_value=1, required=False)


class SubmitTelemetrySerializer(serializers.Serializer):
    candidate_name = serializers.CharField(max_length=255, allow_blank=True)
    logs = TelemetryLogInputSerializer(many=True, allow_empty=False)
