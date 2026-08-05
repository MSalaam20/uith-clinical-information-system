import base64
import tempfile
from pathlib import Path

from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from organization.models import Department, Organization
from patients.models import Patient
from records.models import AuditLog, Schema
from users.models import Role
from utils.handle_files_in_json import find_and_replace_files_in_json


User = get_user_model()


class RecordAndClinicalApiTests(APITestCase):
    def setUp(self):
        self.doctor = User.objects.create_user('record-doctor', password='Pass123!')
        self.doctor.user.role = Role.ROLE_DOCTOR
        self.doctor.user.save(update_fields=['role'])
        self.student = User.objects.create_user('record-student', password='Pass123!')
        self.student.user.role = Role.ROLE_PATIENT
        self.student.user.save(update_fields=['role'])
        self.patient = Patient.objects.create(
            user=self.student,
            matric_number='REC/001',
            first_name='Record',
            last_name='Patient',
            date_of_birth='2000-01-01',
        )
        organization = Organization.objects.create(
            long_name='Test Clinic',
            short_name='TC',
            address='Test address',
            phone_number='08012345678',
            this_one=True,
        )
        department = Department.objects.create(
            department='Medicine', organization=organization
        )
        self.schema = Schema.objects.create(
            name='Complaint',
            department=department,
            schema={
                'type': 'object',
                'properties': {'complaint': {'type': 'string'}},
                'required': ['complaint'],
            },
        )
        self.client.force_authenticate(self.doctor)

    def test_invalid_record_json_is_rejected_by_api(self):
        response = self.client.post('/api/records/', {
            'patient_id': self.patient.id,
            'findings_schema': self.schema.id,
            'findings': {'complaint': 123},
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_valid_record_is_created_and_audited(self):
        response = self.client.post('/api/records/', {
            'patient_id': self.patient.id,
            'findings_schema': self.schema.id,
            'findings': {'complaint': 'Headache'},
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(AuditLog.objects.filter(
            action='record_created', resource_id=str(response.data['id'])
        ).exists())

    def test_doctor_can_create_visit(self):
        response = self.client.post('/api/visits/', {
            'patient': self.patient.id,
            'visit_date': timezone.now().isoformat(),
            'chief_complaint': 'Headache',
            'status': 'open',
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

    def test_student_cannot_create_visit(self):
        self.client.force_authenticate(self.student)
        response = self.client.post('/api/visits/', {
            'patient': self.patient.id,
            'visit_date': timezone.now().isoformat(),
            'chief_complaint': 'Headache',
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)


class NestedFileHandlingTests(APITestCase):
    def test_nested_base64_image_is_stored(self):
        encoded = base64.b64encode(
            b'\x89PNG\r\n\x1a\n' + b'synthetic-png-content'
        ).decode('ascii')
        data = {'section': {'images': [f'data:image/png;base64,{encoded}']}}
        with tempfile.TemporaryDirectory() as directory:
            result = find_and_replace_files_in_json(
                data, 'data:image/', 'record-file', directory
            )
            filename = result['section']['images'][0]
            self.assertTrue((Path(directory) / filename).exists())

    def test_invalid_base64_is_rejected(self):
        data = {'image': 'data:image/png;base64,not-valid***'}
        with tempfile.TemporaryDirectory() as directory:
            with self.assertRaises(ValidationError):
                find_and_replace_files_in_json(
                    data, 'data:image/', 'record-file', directory
                )
