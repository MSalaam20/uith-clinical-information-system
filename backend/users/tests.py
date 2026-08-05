from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.test import APITestCase

from patients.models import Patient
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
