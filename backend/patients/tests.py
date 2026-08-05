from datetime import timedelta

from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from patients.models import Appointment, Patient
from patients.serializers import PatientSerializer
from users.models import Role


User = get_user_model()


class PatientWorkflowTests(APITestCase):
    def setUp(self):
        self.receptionist = User.objects.create_user('reception', password='Pass123!')
        self.receptionist.user.role = Role.ROLE_RECEPTIONIST
        self.receptionist.user.save(update_fields=['role'])

        self.admin = User.objects.create_user('admin', password='Pass123!')
        self.admin.user.role = Role.ROLE_ADMIN
        self.admin.user.save(update_fields=['role'])

        self.student = User.objects.create_user('patient-user', password='Pass123!')
        self.student.user.role = Role.ROLE_PATIENT
        self.student.user.save(update_fields=['role'])
        self.patient = Patient.objects.create(
            user=self.student,
            matric_number='TEST/101',
            first_name='Amina',
            last_name='Test',
            date_of_birth='2002-01-01',
            phone_number='08012345678',
        )

    def test_future_date_of_birth_is_rejected(self):
        serializer = PatientSerializer(data={
            'first_name': 'Future',
            'last_name': 'Patient',
            'date_of_birth': timezone.localdate() + timedelta(days=1),
            'gender': 'F',
        })
        self.assertFalse(serializer.is_valid())
        self.assertIn('date_of_birth', serializer.errors)

    def test_invalid_phone_is_rejected(self):
        serializer = PatientSerializer(data={
            'first_name': 'Phone',
            'last_name': 'Patient',
            'date_of_birth': '2000-01-01',
            'gender': 'M',
            'phone_number': '1234',
        })
        self.assertFalse(serializer.is_valid())
        self.assertIn('phone_number', serializer.errors)

    def test_receptionist_can_register_patient(self):
        self.client.force_authenticate(self.receptionist)
        response = self.client.post('/api/patients/', {
            'matric_number': 'TEST/102',
            'first_name': 'New',
            'last_name': 'Patient',
            'date_of_birth': '2000-01-01',
            'gender': 'F',
            'phone_number': '08012345679',
        })
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(response.data['uuid'])

    def test_receptionist_cannot_delete_patient(self):
        self.client.force_authenticate(self.receptionist)
        response = self.client.delete(f'/api/patients/{self.patient.id}/')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_admin_can_archive_with_reason(self):
        self.client.force_authenticate(self.admin)
        response = self.client.post(
            f'/api/patients/{self.patient.id}/archive/',
            {'reason': 'Duplicate synthetic profile'},
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.patient.refresh_from_db()
        self.assertFalse(self.patient.is_active)

    def test_archive_requires_reason(self):
        self.client.force_authenticate(self.admin)
        response = self.client.post(f'/api/patients/{self.patient.id}/archive/', {})
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.patient.refresh_from_db()
        self.assertTrue(self.patient.is_active)

    def test_receptionist_cannot_archive_patient(self):
        self.client.force_authenticate(self.receptionist)
        response = self.client.post(
            f'/api/patients/{self.patient.id}/archive/', {'reason': 'Not permitted'}
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_patient_search_matches_matric_number(self):
        self.client.force_authenticate(self.receptionist)
        response = self.client.get('/api/patients/?search=TEST/101')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['count'], 1)

    def test_student_sees_only_own_appointment(self):
        own = Appointment.objects.create(
            patient=self.patient,
            scheduled_for=timezone.now() + timedelta(days=1),
            reason='Review',
        )
        other = Patient.objects.create(
            matric_number='TEST/103',
            first_name='Other',
            last_name='Patient',
            date_of_birth='2000-01-01',
        )
        Appointment.objects.create(
            patient=other,
            scheduled_for=timezone.now() + timedelta(days=2),
            reason='Other review',
        )
        self.client.force_authenticate(self.student)
        response = self.client.get('/api/appointments/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['count'], 1)
        self.assertEqual(response.data['results'][0]['id'], own.id)

        cancel_response = self.client.post(f'/api/appointments/{own.id}/cancel/')
        self.assertEqual(cancel_response.status_code, status.HTTP_403_FORBIDDEN)

    def test_receptionist_creates_and_filters_appointment(self):
        self.client.force_authenticate(self.receptionist)
        scheduled_for = timezone.now() + timedelta(days=7)
        create_response = self.client.post('/api/appointments/', {
            'patient': self.patient.id,
            'scheduled_for': scheduled_for.isoformat(),
            'reason': 'Clinical review',
        }, format='json')
        self.assertEqual(create_response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(create_response.data['patient_name'], 'Amina Test')
        range_response = self.client.get(
            '/api/appointments/', {
                'start': (scheduled_for - timedelta(hours=1)).isoformat(),
                'end': (scheduled_for + timedelta(hours=1)).isoformat(),
            }
        )
        self.assertEqual(range_response.data['count'], 1)

    def test_doctor_can_change_appointment_status_but_not_delete(self):
        doctor = User.objects.create_user('appointment-doctor', password='Pass123!')
        doctor.user.role = Role.ROLE_DOCTOR
        doctor.user.save(update_fields=['role'])
        appointment = Appointment.objects.create(
            patient=self.patient,
            scheduled_for=timezone.now() + timedelta(days=1),
            reason='Review',
        )
        self.client.force_authenticate(doctor)
        status_response = self.client.patch(
            f'/api/appointments/{appointment.id}/status/', {'status': 'completed'}
        )
        self.assertEqual(status_response.status_code, status.HTTP_200_OK)
        delete_response = self.client.delete(f'/api/appointments/{appointment.id}/')
        self.assertEqual(delete_response.status_code, status.HTTP_403_FORBIDDEN)
