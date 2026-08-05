import base64
import tempfile
from pathlib import Path
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError
from django.db import IntegrityError
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from organization.models import Department, Organization
from patients.models import Appointment, Patient
from records.models import (
    AuditLog,
    ClinicalNote,
    Diagnosis,
    ICDCode,
    Medication,
    Prescription,
    PrescriptionItem,
    Schema,
    Visit,
)
from records.audit import log_action
from records.serializers import PrescriptionSerializer
from users.models import Role
from utils.handle_files_in_json import _safe_path, find_and_replace_files_in_json


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
        self.nurse = User.objects.create_user('record-nurse', password='Pass123!')
        self.nurse.user.role = Role.ROLE_NURSE
        self.nurse.user.save(update_fields=['role'])
        self.receptionist = User.objects.create_user('record-reception', password='Pass123!')
        self.receptionist.user.role = Role.ROLE_RECEPTIONIST
        self.receptionist.user.save(update_fields=['role'])
        self.admin = User.objects.create_user('record-admin', password='Pass123!')
        self.admin.user.role = Role.ROLE_ADMIN
        self.admin.user.save(update_fields=['role'])
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

    def create_visit(self):
        return Visit.objects.create(
            patient=self.patient,
            visit_date=timezone.now(),
            chief_complaint='Headache',
            created_by=self.doctor.user,
        )

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

    def test_visit_rejects_appointment_for_another_patient(self):
        other = Patient.objects.create(
            matric_number='REC/OTHER', first_name='Other', last_name='Patient',
            date_of_birth='2000-01-01'
        )
        appointment = Appointment.objects.create(
            patient=other, scheduled_for=timezone.now(), reason='Other visit'
        )
        response = self.client.post('/api/visits/', {
            'patient': self.patient.id,
            'appointment': appointment.id,
            'visit_date': timezone.now().isoformat(),
            'chief_complaint': 'Headache',
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_nurse_records_valid_vital_signs_and_audit(self):
        visit = self.create_visit()
        self.client.force_authenticate(self.nurse)
        response = self.client.post('/api/vital-signs/', {
            'visit': visit.id,
            'measured_at': timezone.now().isoformat(),
            'temperature_c': '37.2',
            'systolic_bp': 120,
            'diastolic_bp': 80,
            'weight_kg': '70.00',
            'height_cm': '175.0',
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['bmi'], 22.9)
        self.assertTrue(AuditLog.objects.filter(action='vitalsign_created').exists())

    def test_invalid_vital_sign_is_rejected(self):
        visit = self.create_visit()
        self.client.force_authenticate(self.nurse)
        response = self.client.post('/api/vital-signs/', {
            'visit': visit.id,
            'measured_at': timezone.now().isoformat(),
            'systolic_bp': 70,
            'diastolic_bp': 90,
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_every_supported_vital_range_is_validated(self):
        visit = self.create_visit()
        self.client.force_authenticate(self.nurse)
        invalid_values = {
            'temperature_c': '46.0',
            'systolic_bp': 300,
            'diastolic_bp': 200,
            'pulse_bpm': 300,
            'respiratory_rate': 100,
            'oxygen_saturation': 101,
            'weight_kg': '501.00',
            'height_cm': '300.0',
        }
        for field, value in invalid_values.items():
            with self.subTest(field=field):
                response = self.client.post('/api/vital-signs/', {
                    'visit': visit.id,
                    'measured_at': timezone.now().isoformat(),
                    field: value,
                }, format='json')
                self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
                self.assertIn(field, response.data)

    def test_nurse_creates_note_but_cannot_edit_another_author_note(self):
        visit = self.create_visit()
        note = ClinicalNote.objects.create(
            visit=visit, note_type='doctor', note='Doctor-authored note',
            author=self.doctor.user,
        )
        self.client.force_authenticate(self.nurse)
        create_response = self.client.post('/api/clinical-notes/', {
            'visit': visit.id, 'note_type': 'nursing', 'note': 'Nursing observation',
            'patient_visible': True,
        }, format='json')
        self.assertEqual(create_response.status_code, status.HTTP_201_CREATED)
        update_response = self.client.patch(
            f'/api/clinical-notes/{note.id}/', {'note': 'Changed'}, format='json'
        )
        self.assertEqual(update_response.status_code, status.HTTP_403_FORBIDDEN)

    def test_note_author_can_update_own_note_and_invalid_type_is_rejected(self):
        visit = self.create_visit()
        self.client.force_authenticate(self.nurse)
        created = self.client.post('/api/clinical-notes/', {
            'visit': visit.id,
            'note_type': 'nursing',
            'note': 'Initial nursing observation',
        }, format='json')
        self.assertEqual(created.status_code, status.HTTP_201_CREATED)
        updated = self.client.patch(
            f"/api/clinical-notes/{created.data['id']}/",
            {'note': 'Corrected nursing observation'},
            format='json',
        )
        self.assertEqual(updated.status_code, status.HTTP_200_OK)
        invalid = self.client.post('/api/clinical-notes/', {
            'visit': visit.id,
            'note_type': 'unsupported-note-type',
            'note': 'Invalid type',
        }, format='json')
        self.assertEqual(invalid.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('note_type', invalid.data)

    def test_student_sees_only_patient_visible_notes_in_list_and_visit(self):
        visit = self.create_visit()
        ClinicalNote.objects.create(
            visit=visit, note='Hidden clinical note', author=self.doctor.user,
            patient_visible=False,
        )
        visible = ClinicalNote.objects.create(
            visit=visit, note='Patient summary', author=self.doctor.user,
            patient_visible=True,
        )
        self.client.force_authenticate(self.student)
        list_response = self.client.get('/api/clinical-notes/')
        self.assertEqual(list_response.data['count'], 1)
        self.assertEqual(list_response.data['results'][0]['id'], visible.id)
        visit_response = self.client.get(f'/api/visits/{visit.id}/')
        self.assertEqual(len(visit_response.data['clinical_notes']), 1)
        self.assertEqual(visit_response.data['clinical_notes'][0]['id'], visible.id)

    def test_doctor_adds_icd_linked_diagnosis_receptionist_is_denied(self):
        visit = self.create_visit()
        icd = ICDCode.objects.create(code='TEST1', title='Synthetic diagnosis')
        response = self.client.post('/api/diagnoses/', {
            'visit': visit.id,
            'icd_code': icd.id,
            'description': 'Synthetic diagnosis',
            'diagnosis_type': 'confirmed',
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['code_snapshot'], 'TEST1')
        self.client.force_authenticate(self.receptionist)
        denied = self.client.post('/api/diagnoses/', {
            'visit': visit.id, 'description': 'Not allowed'
        }, format='json')
        self.assertEqual(denied.status_code, status.HTTP_403_FORBIDDEN)
        self.assertTrue(AuditLog.objects.filter(
            user=self.receptionist,
            action='permission_denied',
            success=False,
        ).exists())

    def test_doctor_creates_unique_medication(self):
        payload = {
            'name': 'Synthetic medicine', 'generic_name': 'Test generic',
            'strength': '10 mg', 'form': 'tablet',
        }
        response = self.client.post('/api/medications/', payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        duplicate = self.client.post('/api/medications/', payload, format='json')
        self.assertEqual(duplicate.status_code, status.HTTP_400_BAD_REQUEST)

    def test_prescription_with_multiple_items_is_created(self):
        visit = self.create_visit()
        one = Medication.objects.create(name='Medicine A', strength='5 mg', form='tablet')
        two = Medication.objects.create(name='Medicine B', strength='10 mg', form='capsule')
        response = self.client.post('/api/prescriptions/', {
            'patient': self.patient.id,
            'visit': visit.id,
            'prescribed_at': timezone.now().isoformat(),
            'status': 'active',
            'items': [
                {'medication': one.id, 'dose': '5 mg', 'route': 'oral', 'frequency': 'daily', 'duration': '5 days'},
                {'medication': two.id, 'dose': '10 mg', 'route': 'oral', 'frequency': 'twice daily', 'duration': '3 days'},
            ],
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(len(response.data['items']), 2)

    def test_invalid_prescription_item_leaves_no_prescription(self):
        visit = self.create_visit()
        medication = Medication.objects.create(name='Medicine C')
        response = self.client.post('/api/prescriptions/', {
            'patient': self.patient.id,
            'visit': visit.id,
            'prescribed_at': timezone.now().isoformat(),
            'items': [{'medication': medication.id, 'route': 'oral'}],
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(Prescription.objects.count(), 0)

    def test_prescription_database_error_rolls_back_all_items(self):
        visit = self.create_visit()
        one = Medication.objects.create(name='Rollback A')
        two = Medication.objects.create(name='Rollback B')
        serializer = PrescriptionSerializer(data={
            'patient': self.patient.id,
            'visit': visit.id,
            'prescribed_at': timezone.now().isoformat(),
            'items': [
                {'medication': one.id, 'dose': '1', 'route': 'oral', 'frequency': 'daily', 'duration': '1 day'},
                {'medication': two.id, 'dose': '2', 'route': 'oral', 'frequency': 'daily', 'duration': '2 days'},
            ],
        })
        self.assertTrue(serializer.is_valid(), serializer.errors)
        original_create = PrescriptionItem.objects.create
        calls = {'count': 0}

        def fail_second_item(**kwargs):
            calls['count'] += 1
            if calls['count'] == 2:
                raise IntegrityError('synthetic item failure')
            return original_create(**kwargs)

        with patch(
            'records.serializers.PrescriptionItem.objects.create',
            side_effect=fail_second_item,
        ):
            with self.assertRaises(IntegrityError):
                serializer.save(prescribed_by=self.doctor.user)
        self.assertEqual(Prescription.objects.count(), 0)
        self.assertEqual(PrescriptionItem.objects.count(), 0)

    def test_prescription_patient_visit_mismatch_and_student_mutation_rejected(self):
        other = Patient.objects.create(
            matric_number='REC/OTHER2', first_name='Other', last_name='Patient',
            date_of_birth='2000-01-01'
        )
        visit = self.create_visit()
        medication = Medication.objects.create(name='Mismatch medicine')
        payload = {
            'patient': other.id,
            'visit': visit.id,
            'prescribed_at': timezone.now().isoformat(),
            'items': [{'medication': medication.id, 'dose': '1', 'route': 'oral', 'frequency': 'daily', 'duration': '1 day'}],
        }
        mismatch = self.client.post('/api/prescriptions/', payload, format='json')
        self.assertEqual(mismatch.status_code, status.HTTP_400_BAD_REQUEST)
        self.client.force_authenticate(self.student)
        payload['patient'] = self.patient.id
        denied = self.client.post('/api/prescriptions/', payload, format='json')
        self.assertEqual(denied.status_code, status.HTTP_403_FORBIDDEN)

    def test_receptionist_cannot_prescribe(self):
        visit = self.create_visit()
        medication = Medication.objects.create(name='Restricted medicine')
        self.client.force_authenticate(self.receptionist)
        denied = self.client.post('/api/prescriptions/', {
            'patient': self.patient.id,
            'visit': visit.id,
            'prescribed_at': timezone.now().isoformat(),
            'items': [{
                'medication': medication.id,
                'dose': '1 tablet',
                'route': 'oral',
                'frequency': 'daily',
                'duration': '2 days',
            }],
        }, format='json')
        self.assertEqual(denied.status_code, status.HTTP_403_FORBIDDEN)

    def test_completed_visit_rejects_further_clinical_mutation(self):
        visit = self.create_visit()
        visit.status = Visit.Status.COMPLETED
        visit.save(update_fields=['status'])
        icd = ICDCode.objects.create(code='CLOSED1', title='Closed visit term')
        medication = Medication.objects.create(name='Closed visit medicine')
        existing_diagnosis = Diagnosis.objects.create(
            visit=visit,
            icd_code=icd,
            code_snapshot=icd.code,
            description='Existing diagnosis',
            diagnosed_by=self.doctor.user,
        )

        self.client.force_authenticate(self.nurse)
        vital = self.client.post('/api/vital-signs/', {
            'visit': visit.id,
            'measured_at': timezone.now().isoformat(),
            'temperature_c': '37.0',
        }, format='json')
        note = self.client.post('/api/clinical-notes/', {
            'visit': visit.id,
            'note_type': 'nursing',
            'note': 'Late note',
        }, format='json')
        self.assertEqual(vital.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(note.status_code, status.HTTP_400_BAD_REQUEST)

        self.client.force_authenticate(self.doctor)
        diagnosis = self.client.post('/api/diagnoses/', {
            'visit': visit.id,
            'icd_code': icd.id,
            'description': 'Late diagnosis',
        }, format='json')
        prescription = self.client.post('/api/prescriptions/', {
            'patient': self.patient.id,
            'visit': visit.id,
            'prescribed_at': timezone.now().isoformat(),
            'items': [{
                'medication': medication.id,
                'dose': '1 tablet',
                'route': 'oral',
                'frequency': 'daily',
                'duration': '2 days',
            }],
        }, format='json')
        visit_update = self.client.patch(
            f'/api/visits/{visit.id}/', {'clinical_summary': 'Rewritten'},
            format='json',
        )
        diagnosis_delete = self.client.delete(
            f'/api/diagnoses/{existing_diagnosis.id}/'
        )
        self.assertEqual(diagnosis.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(prescription.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(visit_update.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(diagnosis_delete.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertTrue(Diagnosis.objects.filter(pk=existing_diagnosis.pk).exists())

    def test_student_cannot_retrieve_other_patient_clinical_objects(self):
        other_user = User.objects.create_user('other-student', password='Pass123!')
        other_user.user.role = Role.ROLE_PATIENT
        other_user.user.save(update_fields=['role'])
        other_patient = Patient.objects.create(
            user=other_user,
            matric_number='REC/OTHER3',
            first_name='Other',
            last_name='Student',
            date_of_birth='2001-01-01',
        )
        other_visit = Visit.objects.create(
            patient=other_patient,
            visit_date=timezone.now(),
            chief_complaint='Private complaint',
            created_by=self.doctor.user,
        )
        other_diagnosis = Diagnosis.objects.create(
            visit=other_visit,
            description='Private diagnosis',
            diagnosed_by=self.doctor.user,
        )
        self.client.force_authenticate(self.student)
        self.assertEqual(
            self.client.get(f'/api/visits/{other_visit.id}/').status_code,
            status.HTTP_404_NOT_FOUND,
        )
        self.assertEqual(
            self.client.get(f'/api/diagnoses/{other_diagnosis.id}/').status_code,
            status.HTTP_404_NOT_FOUND,
        )

    def test_sensitive_audit_metadata_is_removed_recursively(self):
        audit = log_action(
            user=self.doctor,
            action='metadata_test',
            resource_type='SecurityTest',
            metadata={
                'password': 'top-level-secret',
                'safe': 'retained',
                'nested': {
                    'refresh_token': 'nested-secret',
                    'value': 7,
                },
                'items': [{'authorization_header': 'secret', 'value': 9}],
            },
        )
        self.assertEqual(audit.metadata, {
            'safe': 'retained',
            'nested': {'value': 7},
            'items': [{'value': 9}],
        })

    def test_audit_log_is_administrator_only_and_read_only(self):
        audit = AuditLog.objects.create(
            user=self.doctor, action='test_event', resource_type='Visit'
        )
        denied = self.client.get('/api/audit-logs/')
        self.assertEqual(denied.status_code, status.HTTP_403_FORBIDDEN)
        self.client.force_authenticate(self.admin)
        allowed = self.client.get('/api/audit-logs/?action=test')
        self.assertEqual(allowed.status_code, status.HTTP_200_OK)
        update = self.client.patch(
            f'/api/audit-logs/{audit.id}/', {'description': 'Changed'}
        )
        self.assertEqual(update.status_code, status.HTTP_405_METHOD_NOT_ALLOWED)


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

    def test_invalid_image_signature_is_rejected(self):
        encoded = base64.b64encode(b'not-a-real-png').decode('ascii')
        data = {'image': f'data:image/png;base64,{encoded}'}
        with tempfile.TemporaryDirectory() as directory:
            with self.assertRaises(ValidationError):
                find_and_replace_files_in_json(
                    data, 'data:image/', 'record-file', directory
                )

    def test_path_traversal_filename_is_rejected(self):
        with tempfile.TemporaryDirectory() as directory:
            with self.assertRaises(ValidationError):
                _safe_path(directory, '../outside.png')
