from django.core.exceptions import FieldDoesNotExist
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient, APITestCase

from .models import AssessmentProfile, CandidateSession, HRUser, TaskCard, TestConfig, get_default_assessment_profile


class UserModelEmailTests(APITestCase):
    def test_hr_user_does_not_define_email_field(self):
        with self.assertRaises(FieldDoesNotExist):
            HRUser._meta.get_field("email")

    def test_createsuperuser_required_fields_do_not_include_email(self):
        self.assertEqual(HRUser.USERNAME_FIELD, "username")
        self.assertEqual(HRUser.REQUIRED_FIELDS, [])


class AuthRoleTests(APITestCase):
    def test_login_returns_hr_role_for_regular_user(self):
        HRUser.objects.create_user(username="hr-user", password="testpass123")

        response = self.client.post(
            reverse("hr-login"),
            {"username": "hr-user", "password": "testpass123"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["username"], "hr-user")
        self.assertEqual(response.data["role"], "hr")
        self.assertFalse(response.data["is_superuser"])
        self.assertIn("token", response.data)

    def test_login_returns_admin_role_for_superuser(self):
        HRUser.objects.create_superuser(username="admin-user", password="testpass123")

        response = self.client.post(
            reverse("hr-login"),
            {"username": "admin-user", "password": "testpass123"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["username"], "admin-user")
        self.assertEqual(response.data["role"], "admin")
        self.assertTrue(response.data["is_superuser"])
        self.assertIn("token", response.data)

    def test_inactive_user_cannot_login(self):
        HRUser.objects.create_user(username="inactive-hr", password="testpass123", is_active=False)

        response = self.client.post(
            reverse("hr-login"),
            {"username": "inactive-hr", "password": "testpass123"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data["detail"], "Пользователь отключён.")


class AdminHRUserManagementTests(APITestCase):
    def setUp(self):
        self.admin = HRUser.objects.create_superuser(username="admin-user", password="testpass123")
        self.hr = HRUser.objects.create_user(username="hr-user", password="testpass123")
        self.client = APIClient()

    def authenticate_admin(self):
        self.client.force_authenticate(user=self.admin)

    def test_unauthenticated_user_cannot_open_hr_users_api(self):
        response = self.client.get(reverse("admin-hr-users"))

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_regular_hr_cannot_open_hr_users_api(self):
        self.client.force_authenticate(user=self.hr)

        response = self.client.get(reverse("admin-hr-users"))

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_admin_can_list_only_hr_users_with_test_count(self):
        self.authenticate_admin()
        inactive_hr = HRUser.objects.create_user(
            username="inactive-listed-hr",
            password="testpass123",
            is_active=False,
        )
        TestConfig.objects.create(hr=self.hr, title="HR test")
        TestConfig.objects.create(hr=self.admin, title="Admin test")

        response = self.client.get(reverse("admin-hr-users"))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        usernames = {item["username"] for item in response.data}
        self.assertEqual(usernames, {"hr-user", "inactive-listed-hr"})

        hr_item = next(item for item in response.data if item["username"] == "hr-user")
        inactive_item = next(item for item in response.data if item["username"] == inactive_hr.username)
        self.assertEqual(hr_item["tests_count"], 1)
        self.assertEqual(hr_item["status"], "active")
        self.assertEqual(inactive_item["status"], "disabled")

    def test_admin_can_create_hr_user_without_email(self):
        self.authenticate_admin()

        response = self.client.post(
            reverse("admin-hr-users"),
            {
                "username": "new-hr",
                "password": "newpass123",
                "confirm_password": "newpass123",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertNotIn("email", response.data)
        user = HRUser.objects.get(username="new-hr")
        self.assertTrue(user.is_active)
        self.assertFalse(user.is_staff)
        self.assertFalse(user.is_superuser)
        self.assertTrue(user.check_password("newpass123"))
        self.assertNotEqual(user.password, "newpass123")

    def test_create_hr_user_rejects_duplicate_username(self):
        self.authenticate_admin()

        response = self.client.post(
            reverse("admin-hr-users"),
            {
                "username": self.hr.username,
                "password": "newpass123",
                "confirm_password": "newpass123",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data["username"][0], "Такой логин уже занят.")

    def test_create_hr_user_rejects_password_mismatch(self):
        self.authenticate_admin()

        response = self.client.post(
            reverse("admin-hr-users"),
            {
                "username": "new-hr",
                "password": "newpass123",
                "confirm_password": "otherpass123",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data["non_field_errors"][0], "Пароли не совпадают.")

    def test_admin_deactivates_hr_without_deleting_tests(self):
        self.authenticate_admin()
        test_config = TestConfig.objects.create(hr=self.hr, title="Persistent HR test")

        response = self.client.delete(reverse("admin-hr-user-detail", kwargs={"pk": self.hr.id}))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.hr.refresh_from_db()
        self.assertFalse(self.hr.is_active)
        self.assertTrue(TestConfig.objects.filter(id=test_config.id, hr=self.hr).exists())

        login_response = self.client.post(
            reverse("hr-login"),
            {"username": self.hr.username, "password": "testpass123"},
            format="json",
        )
        self.assertEqual(login_response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(login_response.data["detail"], "Пользователь отключён.")

    def test_admin_cannot_deactivate_admin_user(self):
        self.authenticate_admin()
        other_admin = HRUser.objects.create_superuser(username="other-admin", password="testpass123")

        response = self.client.delete(reverse("admin-hr-user-detail", kwargs={"pk": other_admin.id}))

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        other_admin.refresh_from_db()
        self.assertTrue(other_admin.is_active)


class AssessmentProfileTests(APITestCase):
    def setUp(self):
        self.admin = HRUser.objects.create_superuser(username="admin-user", password="testpass123")
        self.hr = HRUser.objects.create_user(username="hr-user", password="testpass123")
        self.client = APIClient()

    def authenticate_admin(self):
        self.client.force_authenticate(user=self.admin)

    def authenticate_hr(self):
        self.client.force_authenticate(user=self.hr)

    def create_profile(self, **overrides):
        payload = {
            "name": "Быстрый профиль",
            "description": "Тестовые параметры",
            "version": 1,
            "is_active": True,
            "low_criticality_weight": 1.0,
            "medium_criticality_weight": 1.0,
            "high_criticality_weight": 1.0,
            "low_criticality_max_time_ms": 1000,
            "medium_criticality_max_time_ms": 1000,
            "high_criticality_max_time_ms": 1000,
            "sri_max_drag_count": 2,
            "min_time_ms": 100,
        }
        payload.update(overrides)
        return AssessmentProfile.objects.create(**payload)

    def test_default_profile_exists_with_current_formula_values(self):
        profile = get_default_assessment_profile()

        self.assertEqual(profile.name, "Базовый профиль")
        self.assertEqual(profile.version, 1)
        self.assertEqual(profile.low_criticality_weight, 0.5)
        self.assertEqual(profile.medium_criticality_weight, 1.0)
        self.assertEqual(profile.high_criticality_weight, 1.5)
        self.assertEqual(profile.low_criticality_max_time_ms, 30000)
        self.assertEqual(profile.medium_criticality_max_time_ms, 15000)
        self.assertEqual(profile.high_criticality_max_time_ms, 10000)
        self.assertEqual(profile.sri_max_drag_count, 4)
        self.assertEqual(profile.min_time_ms, 2000)

    def test_hr_cannot_manage_profiles(self):
        self.authenticate_hr()

        response = self.client.get(reverse("admin-assessment-profiles"))

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_admin_can_create_profile_without_email_or_registration(self):
        self.authenticate_admin()

        response = self.client.post(
            reverse("admin-assessment-profiles"),
            {
                "name": "Профиль продаж",
                "description": "Параметры для отдела продаж",
                "version": 1,
                "is_active": True,
                "low_criticality_weight": 0.7,
                "medium_criticality_weight": 1.2,
                "high_criticality_weight": 1.8,
                "low_criticality_max_time_ms": 25000,
                "medium_criticality_max_time_ms": 12000,
                "high_criticality_max_time_ms": 8000,
                "sri_max_drag_count": 5,
                "min_time_ms": 1500,
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["name"], "Профиль продаж")

    def test_used_profile_parameters_are_locked(self):
        self.authenticate_admin()
        profile = self.create_profile()
        TestConfig.objects.create(hr=self.hr, title="Used profile test", assessment_profile=profile)

        response = self.client.patch(
            reverse("admin-assessment-profile-detail", kwargs={"pk": profile.id}),
            {"low_criticality_weight": 9.0},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

        name_response = self.client.patch(
            reverse("admin-assessment-profile-detail", kwargs={"pk": profile.id}),
            {"name": "Переименованный профиль"},
            format="json",
        )

        self.assertEqual(name_response.status_code, status.HTTP_200_OK)
        profile.refresh_from_db()
        self.assertEqual(profile.name, "Переименованный профиль")

    def test_delete_used_profile_archives_it_without_deleting_tests(self):
        self.authenticate_admin()
        profile = self.create_profile()
        test_config = TestConfig.objects.create(hr=self.hr, title="Used profile test", assessment_profile=profile)

        response = self.client.delete(reverse("admin-assessment-profile-detail", kwargs={"pk": profile.id}))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        profile.refresh_from_db()
        self.assertTrue(profile.is_archived)
        self.assertFalse(profile.is_active)
        self.assertTrue(TestConfig.objects.filter(id=test_config.id).exists())

    def test_create_test_stores_profile_snapshot(self):
        self.authenticate_hr()
        profile = self.create_profile(name="Snapshot profile", version=3, high_criticality_weight=7.0)

        response = self.client.post(
            reverse("hr-tests"),
            {
                "title": "Snapshot test",
                "profile_id": profile.id,
                "calc_dsi": True,
                "calc_sri": True,
                "calc_tcei": True,
                "cards": [
                    {
                        "text": "Срочная задача",
                        "criticality_level": TaskCard.CriticalityLevel.HIGH,
                    }
                ],
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        test_config = TestConfig.objects.get(title="Snapshot test")
        self.assertEqual(test_config.assessment_profile, profile)
        self.assertEqual(test_config.profile_name_snapshot, "Snapshot profile")
        self.assertEqual(test_config.profile_version_snapshot, 3)
        self.assertEqual(test_config.high_criticality_weight_snapshot, 7.0)

        profile.high_criticality_weight = 99.0
        profile.save()
        test_config.refresh_from_db()
        self.assertEqual(test_config.high_criticality_weight_snapshot, 7.0)

    def test_hr_cannot_create_test_with_archived_profile(self):
        self.authenticate_hr()
        profile = self.create_profile(is_active=False, is_archived=True)

        response = self.client.post(
            reverse("hr-tests"),
            {
                "title": "Archived profile test",
                "profile_id": profile.id,
                "cards": [
                    {
                        "text": "Задача",
                        "criticality_level": TaskCard.CriticalityLevel.LOW,
                    }
                ],
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_session_list_and_statistics_are_filtered_by_profile(self):
        self.authenticate_hr()
        base_profile = get_default_assessment_profile()
        other_profile = self.create_profile(name="Other profile")
        base_test = TestConfig.objects.create(
            hr=self.hr,
            title="Base profile test",
            assessment_profile=base_profile,
        )
        other_test = TestConfig.objects.create(
            hr=self.hr,
            title="Other profile test",
            assessment_profile=other_profile,
        )
        base_session = CandidateSession.objects.create(
            test_config=base_test,
            candidate_name="Base Candidate",
            is_completed=True,
            final_dsi=80,
            final_sri=70,
            final_tcei=75,
        )
        CandidateSession.objects.create(
            test_config=other_test,
            candidate_name="Other Candidate",
            is_completed=True,
            final_dsi=20,
            final_sri=30,
            final_tcei=25,
        )

        sessions_response = self.client.get(
            reverse("hr-sessions"),
            {"profile_id": base_profile.id},
        )
        stats_response = self.client.get(
            reverse("hr-statistics"),
            {"profile_id": base_profile.id},
        )

        self.assertEqual(sessions_response.status_code, status.HTTP_200_OK)
        self.assertEqual([item["id"] for item in sessions_response.data], [base_session.id])
        self.assertEqual(stats_response.status_code, status.HTTP_200_OK)
        self.assertEqual(stats_response.data["total_sessions"], 1)
        self.assertEqual(stats_response.data["average_tcei"], 75)

    def test_submit_uses_profile_snapshot_parameters(self):
        profile = self.create_profile(
            low_criticality_weight=1.0,
            medium_criticality_weight=1.0,
            high_criticality_weight=1.0,
            low_criticality_max_time_ms=1000,
            medium_criticality_max_time_ms=1000,
            high_criticality_max_time_ms=1000,
            sri_max_drag_count=2,
            min_time_ms=100,
        )
        test_config = TestConfig.objects.create(
            hr=self.hr,
            title="Snapshot formula test",
            assessment_profile=profile,
            calc_dsi=True,
            calc_sri=True,
            calc_tcei=True,
        )
        card = TaskCard.objects.create(
            test_config=test_config,
            text="Карточка",
            criticality_level=TaskCard.CriticalityLevel.LOW,
        )
        session = CandidateSession.objects.create(test_config=test_config)
        profile.low_criticality_max_time_ms = 50000
        profile.sri_max_drag_count = 99
        profile.save()

        response = self.client.post(
            reverse("play-submit", kwargs={"token": session.token}),
            {
                "candidate_name": "Candidate",
                "logs": [
                    {
                        "card_id": card.id,
                        "time_spent_ms": 550,
                        "drag_count": 1,
                        "assigned_criticality_level": TaskCard.CriticalityLevel.LOW,
                    }
                ],
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        session.refresh_from_db()
        self.assertEqual(session.final_dsi, 50.0)
        self.assertEqual(session.final_sri, 50.0)
        self.assertEqual(session.final_tcei, 50.0)


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
