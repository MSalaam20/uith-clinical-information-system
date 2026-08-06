import os
from io import StringIO
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.core import mail
from django.core.management import call_command
from django.core.management.base import CommandError
from django.test import override_settings
from django.utils.encoding import force_bytes
from django.utils.http import urlsafe_base64_encode
from django.contrib.auth.tokens import default_token_generator
from rest_framework import status
from rest_framework.test import APITestCase

from patients.models import Patient
from records.models import AuditLog
from users.models import Profile, Role


User = get_user_model()


class AuthenticationAndRoleTests(APITestCase):
    def setUp(self):
        self.doctor = User.objects.create_user('doctor', password='StrongPass123!')
        self.doctor.user.role = Role.ROLE_DOCTOR
        self.doctor.user.save(update_fields=['role'])

        self.student = User.objects.create_user('student', password='StrongPass123!')
        self.student.user.role = Role.ROLE_PATIENT
        self.student.user.save(update_fields=['role'])
        self.patient = Patient.objects.create(
            user=self.student,
            matric_number='TEST/001',
            first_name='Test',
            last_name='Student',
            date_of_birth='2001-01-01',
        )

    def test_role_helpers_do_not_raise(self):
        profile = Profile(role=Role.ROLE_DOCTOR)
        self.assertTrue(profile.is_doctor)
        self.assertTrue(profile.is_staff)
        self.assertFalse(profile.is_student)

    def test_profile_me_requires_authentication(self):
        response = self.client.get('/api/profile/me/')
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_profile_me_returns_authenticated_profile(self):
        self.client.force_authenticate(self.doctor)
        response = self.client.get('/api/profile/me/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['user_id'], self.doctor.id)
        self.assertEqual(response.data['role'], Role.ROLE_DOCTOR)

    def test_doctor_is_rejected_by_student_portal(self):
        response = self.client.post('/api/auth/jwt/create/', {
            'username': 'doctor',
            'password': 'StrongPass123!',
            'portal_type': 'student',
        })
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_student_is_rejected_by_staff_portal(self):
        response = self.client.post('/api/auth/jwt/create/', {
            'username': 'student',
            'password': 'StrongPass123!',
            'portal_type': 'staff',
        })
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_valid_student_login_succeeds(self):
        response = self.client.post('/api/auth/jwt/create/', {
            'username': 'student',
            'password': 'StrongPass123!',
            'portal_type': 'student',
        })
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('access', response.data)
        self.assertIn('refresh', response.data)

    def test_invalid_login_fails(self):
        response = self.client.post('/api/auth/jwt/create/', {
            'username': 'student',
            'password': 'wrong-password',
            'portal_type': 'student',
        })
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_valid_staff_login_succeeds(self):
        response = self.client.post('/api/auth/jwt/create/', {
            'username': 'doctor',
            'password': 'StrongPass123!',
            'portal_type': 'staff',
        })
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('access', response.data)

    def test_invalid_bearer_token_is_rejected(self):
        self.client.credentials(HTTP_AUTHORIZATION='Bearer invalid-token')
        response = self.client.get('/api/profile/me/')
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_student_can_only_list_linked_patient(self):
        other = Patient.objects.create(
            matric_number='TEST/002',
            first_name='Other',
            last_name='Patient',
            date_of_birth='2000-01-01',
        )
        self.client.force_authenticate(self.student)
        response = self.client.get('/api/patients/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['count'], 1)
        self.assertEqual(response.data['results'][0]['id'], self.patient.id)
        detail_response = self.client.get(f'/api/patients/{other.id}/')
        self.assertEqual(detail_response.status_code, status.HTTP_404_NOT_FOUND)

    def test_non_admin_cannot_list_staff(self):
        self.client.force_authenticate(self.doctor)
        response = self.client.get('/api/staff/')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_unassigned_profile_cannot_access_clinical_endpoints(self):
        unassigned = User.objects.create_user('unassigned', password='StrongPass123!')
        self.client.force_authenticate(unassigned)
        response = self.client.get('/api/patients/')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_administrator_can_change_staff_role_and_status(self):
        administrator = User.objects.create_user('administrator', password='StrongPass123!')
        administrator.user.role = Role.ROLE_ADMIN
        administrator.user.save(update_fields=['role'])
        self.client.force_authenticate(administrator)
        role_response = self.client.patch(
            f'/api/staff/{self.doctor.id}/role/', {'role': Role.ROLE_NURSE}
        )
        self.assertEqual(role_response.status_code, status.HTTP_200_OK)
        self.assertEqual(role_response.data['role'], Role.ROLE_NURSE)
        status_response = self.client.patch(
            f'/api/staff/{self.doctor.id}/status/', {'is_active': False}
        )
        self.assertEqual(status_response.status_code, status.HTTP_200_OK)
        self.assertFalse(status_response.data['is_active'])


class AdministratorBootstrapTests(APITestCase):
    command_options = {
        'username': 'clinic.admin',
        'email': 'admin@example.com',
        'first_name': 'Clinic',
        'last_name': 'Administrator',
        'noinput': True,
        'password_env': 'TEST_ADMIN_PASSWORD',
    }

    def run_command(self, **overrides):
        options = {**self.command_options, **overrides}
        output = StringIO()
        with patch.dict(os.environ, {'TEST_ADMIN_PASSWORD': 'AdminPass123!'}):
            call_command('bootstrap_admin', stdout=output, **options)
        return output.getvalue()

    def test_bootstrap_creates_administrator_without_duplicate_profile(self):
        output = self.run_command()
        user = User.objects.get(username='clinic.admin')
        self.assertTrue(user.is_active)
        self.assertTrue(user.is_staff)
        self.assertFalse(user.is_superuser)
        self.assertTrue(user.check_password('AdminPass123!'))
        self.assertEqual(user.user.role, Role.ROLE_ADMIN)
        self.assertEqual(Profile.objects.filter(user=user).count(), 1)
        self.assertIn('Created administrator', output)

        second_output = self.run_command(first_name='Updated')
        user.refresh_from_db()
        self.assertEqual(user.first_name, 'Updated')
        self.assertEqual(User.objects.filter(username='clinic.admin').count(), 1)
        self.assertEqual(Profile.objects.filter(user=user).count(), 1)
        self.assertIn('Updated administrator', second_output)

    def test_bootstrap_rejects_too_short_password_without_partial_user(self):
        with patch.dict(os.environ, {'TEST_ADMIN_PASSWORD': 'short'}):
            with self.assertRaises(CommandError):
                call_command('bootstrap_admin', **self.command_options)
        self.assertFalse(User.objects.filter(username='clinic.admin').exists())


class AccountLifecycleTests(APITestCase):
    def setUp(self):
        self.admin = User.objects.create_user(
            'administrator', email='admin@clinic.test', password='AdminPass123!'
        )
        self.admin.user.role = Role.ROLE_ADMIN
        self.admin.user.save(update_fields=['role'])
        self.doctor = User.objects.create_user(
            'existing.doctor', password='DoctorPass123!'
        )
        self.doctor.user.role = Role.ROLE_DOCTOR
        self.doctor.user.save(update_fields=['role'])

    def staff_payload(self, **overrides):
        return {
            'username': 'new.clinician',
            'email': 'new.clinician@clinic.test',
            'first_name': 'New',
            'last_name': 'Clinician',
            'phone_number': '08012345678',
            'role': Role.ROLE_DOCTOR,
            **overrides,
        }

    def test_admin_creates_staff_with_one_time_temporary_password_and_audit(self):
        self.client.force_authenticate(self.admin)
        response = self.client.post('/api/staff/', self.staff_payload())
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        temporary_password = response.data['temporary_password']
        user = User.objects.get(username='new.clinician')
        self.assertTrue(user.check_password(temporary_password))
        self.assertNotEqual(user.password, temporary_password)
        self.assertEqual(user.user.role, Role.ROLE_DOCTOR)
        self.assertTrue(user.user.must_change_password)
        self.assertTrue(response.data['display_once'])
        self.assertTrue(AuditLog.objects.filter(
            action='staff_account_created', resource_id=str(user.pk)
        ).exists())

    def test_admin_can_create_nurse_and_receptionist(self):
        self.client.force_authenticate(self.admin)
        for index, role in enumerate(
            (Role.ROLE_NURSE, Role.ROLE_RECEPTIONIST), start=1
        ):
            response = self.client.post('/api/staff/', self.staff_payload(
                username=f'new.staff{index}',
                email=f'new.staff{index}@clinic.test',
                role=role,
            ))
            self.assertEqual(response.status_code, status.HTTP_201_CREATED)
            self.assertEqual(response.data['account']['role'], role)

    def test_staff_creation_rejects_duplicates_invalid_role_and_short_password(self):
        self.client.force_authenticate(self.admin)
        duplicate = self.client.post('/api/staff/', self.staff_payload(
            username='unique.user', email='admin@clinic.test'
        ))
        invalid_role = self.client.post('/api/staff/', self.staff_payload(
            username='invalid.role', email='invalid@clinic.test', role=Role.ROLE_ADMIN
        ))
        weak = self.client.post('/api/staff/', self.staff_payload(
            username='weak.user',
            email='weak@clinic.test',
            temporary_password='short',
        ))
        self.assertEqual(duplicate.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(invalid_role.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(weak.status_code, status.HTTP_400_BAD_REQUEST)

    def test_non_admin_and_anonymous_cannot_create_staff(self):
        anonymous = self.client.post('/api/staff/', self.staff_payload())
        self.client.force_authenticate(self.doctor)
        doctor = self.client.post('/api/staff/', self.staff_payload())
        self.assertEqual(anonymous.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertEqual(doctor.status_code, status.HTTP_403_FORBIDDEN)

    def test_temporary_password_forces_change_and_invalidates_old_token(self):
        self.client.force_authenticate(self.admin)
        create = self.client.post('/api/staff/', self.staff_payload())
        temporary_password = create.data['temporary_password']
        self.client.force_authenticate(user=None)
        login = self.client.post('/api/auth/jwt/create/', {
            'username': 'new.clinician',
            'password': temporary_password,
            'portal_type': 'staff',
        })
        self.assertEqual(login.status_code, status.HTTP_200_OK)
        old_access = login.data['access']
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {old_access}')
        blocked = self.client.get('/api/patients/')
        profile = self.client.get('/api/profile/me/')
        self.assertEqual(blocked.status_code, status.HTTP_403_FORBIDDEN)
        self.assertTrue(profile.data['must_change_password'])

        changed = self.client.post('/api/account/change-password/', {
            'current_password': temporary_password,
            'new_password': 'ReplacementPass456!',
            'confirm_password': 'ReplacementPass456!',
        })
        self.assertEqual(changed.status_code, status.HTTP_204_NO_CONTENT)
        invalidated = self.client.get('/api/profile/me/')
        self.assertEqual(invalidated.status_code, status.HTTP_401_UNAUTHORIZED)
        relogin = self.client.post('/api/auth/jwt/create/', {
            'username': 'new.clinician',
            'password': 'ReplacementPass456!',
            'portal_type': 'staff',
        })
        self.assertEqual(relogin.status_code, status.HTTP_200_OK)
        self.assertTrue(AuditLog.objects.filter(action='password_changed').exists())

    def test_password_change_rejects_wrong_current_and_short_new_password(self):
        self.client.force_authenticate(self.doctor)
        wrong = self.client.post('/api/account/change-password/', {
            'current_password': 'wrong',
            'new_password': 'ReplacementPass456!',
            'confirm_password': 'ReplacementPass456!',
        })
        weak = self.client.post('/api/account/change-password/', {
            'current_password': 'DoctorPass123!',
            'new_password': 'short',
            'confirm_password': 'short',
        })
        self.assertEqual(wrong.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(weak.status_code, status.HTTP_400_BAD_REQUEST)

    def test_password_change_accepts_memorable_account_related_password(self):
        self.doctor.first_name = 'Olawale'
        self.doctor.save(update_fields=['first_name'])
        self.client.force_authenticate(self.doctor)
        response = self.client.post('/api/account/change-password/', {
            'current_password': 'DoctorPass123!',
            'new_password': 'OLAWALE1234',
            'confirm_password': 'OLAWALE1234',
        })
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.doctor.refresh_from_db()
        self.assertTrue(self.doctor.check_password('OLAWALE1234'))

    def test_deactivated_account_cannot_login(self):
        self.doctor.is_active = False
        self.doctor.save(update_fields=['is_active'])
        response = self.client.post('/api/auth/jwt/create/', {
            'username': 'existing.doctor',
            'password': 'DoctorPass123!',
            'portal_type': 'staff',
        })
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_staff_can_login_with_email(self):
        self.doctor.email = 'doctor@clinic.test'
        self.doctor.save(update_fields=['email'])
        response = self.client.post('/api/auth/jwt/create/', {
            'username': 'DOCTOR@CLINIC.TEST',
            'password': 'DoctorPass123!',
            'portal_type': 'staff',
        })
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    @override_settings(EMAIL_BACKEND='django.core.mail.backends.locmem.EmailBackend')
    def test_password_reset_is_generic_and_reset_token_changes_password(self):
        existing = self.client.post('/api/account/password-reset/', {
            'email': 'admin@clinic.test', 'portal_type': 'staff'
        })
        missing = self.client.post('/api/account/password-reset/', {
            'email': 'missing@clinic.test', 'portal_type': 'staff'
        })
        self.assertEqual(existing.status_code, status.HTTP_204_NO_CONTENT)
        self.assertEqual(missing.status_code, status.HTTP_204_NO_CONTENT)
        self.assertEqual(len(mail.outbox), 1)

        uid = urlsafe_base64_encode(force_bytes(self.admin.pk))
        token = default_token_generator.make_token(self.admin)
        confirmed = self.client.post('/api/account/password-reset/confirm/', {
            'uid': uid,
            'token': token,
            'new_password': 'ResetPass789!',
            'confirm_password': 'ResetPass789!',
        })
        self.assertEqual(confirmed.status_code, status.HTTP_204_NO_CONTENT)
        self.admin.refresh_from_db()
        self.assertTrue(self.admin.check_password('ResetPass789!'))

    @override_settings(SHOW_DEMO_CREDENTIALS=False)
    def test_demo_credentials_are_hidden_by_default(self):
        response = self.client.get('/api/demo-access/')
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    @override_settings(SHOW_DEMO_CREDENTIALS=True, DEBUG=True)
    @patch.dict('os.environ', {'EHR_DEMO_PASSWORD': 'ConfiguredDemoPass123!'})
    def test_demo_credentials_require_explicit_flag(self):
        response = self.client.get('/api/demo-access/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data['accounts']), 4)
        self.assertTrue(all(
            account['password'] == 'ConfiguredDemoPass123!'
            for account in response.data['accounts']
        ))

    @override_settings(SHOW_DEMO_CREDENTIALS=True, DEBUG=True)
    @patch.dict('os.environ', {}, clear=True)
    def test_demo_credentials_require_environment_password(self):
        response = self.client.get('/api/demo-access/')
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)


class StudentAccountProvisioningTests(APITestCase):
    def setUp(self):
        self.admin = User.objects.create_user('student-admin', password='AdminPass123!')
        self.admin.user.role = Role.ROLE_ADMIN
        self.admin.user.save(update_fields=['role'])
        self.receptionist = User.objects.create_user(
            'student-reception', password='ReceptionPass123!'
        )
        self.receptionist.user.role = Role.ROLE_RECEPTIONIST
        self.receptionist.user.save(update_fields=['role'])
        self.doctor = User.objects.create_user('student-doctor', password='DoctorPass123!')
        self.doctor.user.role = Role.ROLE_DOCTOR
        self.doctor.user.save(update_fields=['role'])
        self.patient = Patient.objects.create(
            matric_number='TEST/PORTAL/001',
            first_name='Portal',
            last_name='Student',
            date_of_birth='2002-01-01',
            email='portal.student@example.com',
        )

    def account_payload(self):
        return {'username': 'portal.student', 'email': 'portal.student@example.com'}

    def test_receptionist_creates_linked_student_account_and_duplicate_is_rejected(self):
        self.client.force_authenticate(self.receptionist)
        created = self.client.post(
            f'/api/patients/{self.patient.pk}/portal-account/',
            self.account_payload(),
        )
        self.assertEqual(created.status_code, status.HTTP_201_CREATED)
        self.patient.refresh_from_db()
        self.assertEqual(self.patient.user.username, 'portal.student')
        self.assertEqual(self.patient.user.user.role, Role.ROLE_PATIENT)
        self.assertTrue(self.patient.user.user.must_change_password)
        self.assertTrue(self.patient.user.check_password(
            created.data['temporary_password']
        ))
        duplicate = self.client.post(
            f'/api/patients/{self.patient.pk}/portal-account/',
            {'username': 'another.student', 'email': 'another@example.com'},
        )
        self.assertEqual(duplicate.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertTrue(AuditLog.objects.filter(action='student_account_created').exists())

    def test_doctor_and_student_are_blocked_from_student_account_admin(self):
        self.client.force_authenticate(self.doctor)
        doctor = self.client.post(
            f'/api/patients/{self.patient.pk}/portal-account/', self.account_payload()
        )
        student = User.objects.create_user('other.student', password='StudentPass123!')
        student.user.role = Role.ROLE_PATIENT
        student.user.save(update_fields=['role'])
        self.client.force_authenticate(student)
        student_response = self.client.post(
            f'/api/patients/{self.patient.pk}/portal-account/', self.account_payload()
        )
        self.assertEqual(doctor.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(student_response.status_code, status.HTTP_403_FORBIDDEN)

    def test_student_login_and_patient_ownership_are_enforced(self):
        self.client.force_authenticate(self.admin)
        created = self.client.post(
            f'/api/patients/{self.patient.pk}/portal-account/', self.account_payload()
        )
        temporary_password = created.data['temporary_password']
        self.client.force_authenticate(user=None)
        staff_login = self.client.post('/api/auth/jwt/create/', {
            'username': 'portal.student',
            'password': temporary_password,
            'portal_type': 'staff',
        })
        student_login = self.client.post('/api/auth/jwt/create/', {
            'username': 'portal.student',
            'password': temporary_password,
            'portal_type': 'student',
        })
        self.assertEqual(staff_login.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertEqual(student_login.status_code, status.HTTP_200_OK)

        self.patient.refresh_from_db()
        self.patient.user.user.must_change_password = False
        self.patient.user.user.save(update_fields=['must_change_password'])
        self.client.credentials(
            HTTP_AUTHORIZATION=f"Bearer {student_login.data['access']}"
        )
        patients = self.client.get('/api/patients/')
        self.assertEqual(patients.status_code, status.HTTP_200_OK)
        self.assertEqual(patients.data['count'], 1)
        self.assertEqual(patients.data['results'][0]['id'], self.patient.pk)


class DemoAccountCommandTests(APITestCase):
    @override_settings(DEBUG=True)
    @patch.dict('os.environ', {'EHR_DEMO_PASSWORD': 'ConfiguredDemoPass123!'})
    def test_demo_seed_is_idempotent_and_links_synthetic_student(self):
        call_command('seed_demo_accounts', stdout=StringIO())
        call_command('seed_demo_accounts', stdout=StringIO())
        self.assertEqual(
            User.objects.filter(username__in=[
                'dr.jeremiah', 'nurse.fatima', 'mr.ibrahim',
                'uith_2021_52HL034',
            ]).count(),
            4,
        )
        student = User.objects.get(username='uith_2021_52HL034')
        self.assertEqual(student.user.role, Role.ROLE_PATIENT)
        self.assertEqual(student.patient_profile.matric_number, '2021/52HL034')
        self.assertEqual(
            Patient.objects.filter(matric_number='2021/52HL034').count(), 1
        )

    @override_settings(DEBUG=False, ALLOW_DEMO_ACCOUNTS=False)
    def test_demo_seed_is_blocked_outside_explicit_demo_mode(self):
        with self.assertRaises(CommandError):
            call_command('seed_demo_accounts', stdout=StringIO())
