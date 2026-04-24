from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient, APITestCase

from .models import CandidateSession, HRUser, TaskCard, TestConfig


class TestTemplateDuplicationTests(APITestCase):
    def setUp(self):
        self.user = HRUser.objects.create_user(username="hr-user", password="testpass123")
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)

        self.source_test = TestConfig.objects.create(
            hr=self.user,
            title="Исходный тест",
            calc_dsi=True,
            calc_sri=False,
            calc_tcei=False,
        )
        TaskCard.objects.create(
            test_config=self.source_test,
            text="Первая карточка",
            criticality_level=TaskCard.CriticalityLevel.LOW,
        )
        TaskCard.objects.create(
            test_config=self.source_test,
            text="Вторая карточка",
            criticality_level=TaskCard.CriticalityLevel.HIGH,
        )
        source_session = CandidateSession.objects.create(test_config=self.source_test)
        source_session.candidate_name = "Alice"
        source_session.is_completed = True
        source_session.telemetry_logs = [{"card_id": 1, "time_spent_ms": 1000, "drag_count": 1}]
        source_session.final_dsi = 91.2
        source_session.final_sri = 70.0
        source_session.final_tcei = 80.6
        source_session.save()

    def test_can_create_new_independent_test_from_template(self):
        response = self.client.post(
            reverse("hr-tests"),
            {
                "source_test_id": self.source_test.id,
                "title": "Новый тест по шаблону",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(TestConfig.objects.filter(hr=self.user).count(), 2)

        duplicated_test = TestConfig.objects.exclude(id=self.source_test.id).get()
        duplicated_cards = list(duplicated_test.cards.order_by("id").values("text", "criticality_level"))

        self.assertEqual(duplicated_test.title, "Новый тест по шаблону")
        self.assertTrue(duplicated_test.calc_dsi)
        self.assertFalse(duplicated_test.calc_sri)
        self.assertFalse(duplicated_test.calc_tcei)
        self.assertEqual(
            duplicated_cards,
            [
                {"text": "Первая карточка", "criticality_level": TaskCard.CriticalityLevel.LOW},
                {"text": "Вторая карточка", "criticality_level": TaskCard.CriticalityLevel.HIGH},
            ],
        )

        self.assertEqual(duplicated_test.candidate_sessions.count(), 1)
        duplicated_session = duplicated_test.candidate_sessions.get()
        self.assertFalse(duplicated_session.is_completed)
        self.assertEqual(duplicated_session.candidate_name, "")
        self.assertIsNone(duplicated_session.telemetry_logs)
        self.assertIsNone(duplicated_session.final_dsi)
        self.assertIsNone(duplicated_session.final_sri)
        self.assertIsNone(duplicated_session.final_tcei)

        source_session = self.source_test.candidate_sessions.get()
        self.assertTrue(source_session.is_completed)
        self.assertEqual(source_session.candidate_name, "Alice")
        self.assertIsNotNone(source_session.telemetry_logs)

    def test_template_must_belong_to_current_hr(self):
        other_user = HRUser.objects.create_user(username="other-user", password="testpass123")
        other_test = TestConfig.objects.create(
            hr=other_user,
            title="Чужой тест",
            calc_dsi=True,
            calc_sri=True,
            calc_tcei=True,
        )
        TaskCard.objects.create(
            test_config=other_test,
            text="Чужая карточка",
            criticality_level=TaskCard.CriticalityLevel.MEDIUM,
        )

        response = self.client.post(
            reverse("hr-tests"),
            {
                "source_test_id": other_test.id,
                "title": "Попытка копии",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(TestConfig.objects.filter(hr=self.user).count(), 1)
