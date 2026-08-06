from datetime import timedelta
from io import StringIO

from django.contrib.auth import get_user_model
from django.core.management import call_command
from django.core.management.base import CommandError
from django.test import override_settings
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from patients.models import Appointment, ClinicIntake, Patient
from records.models import AuditLog
from users.models import Profile, Role


User = get_user_model()


class IntakeWorkflowTests(APITestCase):
    def setUp(self):
        self.admin = self.make_user('charge', Role.ROLE_ADMIN)
        self.doctor = self.make_user('doctor', Role.ROLE_DOCTOR)
        self.other_doctor = self.make_user('other-doctor', Role.ROLE_DOCTOR)
        self.nurse = self.make_user('nurse', Role.ROLE_NURSE)
        self.receptionist = self.make_user('reception', Role.ROLE_RECEPTIONIST)
        self.student = self.make_user('student', Role.ROLE_PATIENT)
        self.other_student = self.make_user('other-student', Role.ROLE_PATIENT)
        self.patient = Patient.objects.create(
            user=self.student,
            matric_number='FLOW/001',
            first_name='Amina',
            last_name='Flow',
            date_of_birth='2002-01-01',
            gender='F',
        )
        self.other_patient = Patient.objects.create(
            user=self.other_student,
            matric_number='FLOW/002',
            first_name='Other',
            last_name='Student',
            date_of_birth='2001-01-01',
            gender='M',
        )

    @staticmethod
    def make_user(username, role):
        user = User.objects.create_user(username, password='SyntheticTestPass123!')
        user.user.role = role
        user.user.save(update_fields=['role'])
        return user

    def create_intake(self, submit=False):
        self.client.force_authenticate(self.receptionist)
        response = self.client.post('/api/clinic-intakes/', {
            'patient': self.patient.pk,
            'reason_for_visit': 'Persistent headache',
            'presenting_complaint': 'Headache reported by student for two days.',
            'priority': 'routine',
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        if submit:
            response = self.client.post(
                f"/api/clinic-intakes/{response.data['id']}/submit/", {}, format='json'
            )
            self.assertEqual(response.status_code, status.HTTP_200_OK)
        return response.data['id']

    def schedule_intake(self, intake_id, doctor=None, when=None):
        self.client.force_authenticate(self.nurse)
        review = self.client.post(
            f'/api/clinic-intakes/{intake_id}/begin-review/', {}, format='json'
        )
        self.assertEqual(review.status_code, status.HTTP_200_OK)
        response = self.client.post(
            f'/api/clinic-intakes/{intake_id}/schedule/',
            {
                'assigned_doctor': (doctor or self.doctor).user.pk,
                'scheduled_for': (when or timezone.now() + timedelta(days=1)).isoformat(),
                'scheduling_note': 'Assigned after nursing review.',
            },
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        return response

    def test_complete_role_workflow_and_repeat_visit(self):
        intake_id = self.create_intake(submit=True)
        self.schedule_intake(intake_id)

        self.client.force_authenticate(self.doctor)
        confirmed = self.client.post(
            f'/api/clinic-intakes/{intake_id}/confirm/', {}, format='json'
        )
        self.assertEqual(confirmed.status_code, status.HTTP_200_OK)
        started = self.client.post(
            f'/api/clinic-intakes/{intake_id}/start-consultation/', {}, format='json'
        )
        self.assertEqual(started.status_code, status.HTTP_200_OK)
        visit_id = started.data['visit_id']

        diagnosis = self.client.post('/api/diagnoses/', {
            'visit': visit_id,
            'description': 'Synthetic tension headache',
            'diagnosis_type': 'confirmed',
        }, format='json')
        self.assertEqual(diagnosis.status_code, status.HTTP_201_CREATED)
        self.assertEqual(
            self.client.delete(f"/api/diagnoses/{diagnosis.data['id']}/").status_code,
            status.HTTP_405_METHOD_NOT_ALLOWED,
        )
        medication = self.client.post('/api/medications/', {
            'name': 'Paracetamol', 'strength': '500 mg', 'form': 'tablet',
        }, format='json')
        self.assertEqual(medication.status_code, status.HTTP_201_CREATED)
        prescription = self.client.post('/api/prescriptions/', {
            'patient': self.patient.pk,
            'visit': visit_id,
            'prescribed_at': timezone.now().isoformat(),
            'items': [{
                'medication': medication.data['id'], 'dose': '500 mg',
                'route': 'oral', 'frequency': 'three times daily',
                'duration': '3 days', 'instructions': 'Take after food.',
            }],
        }, format='json')
        self.assertEqual(prescription.status_code, status.HTTP_201_CREATED)
        completed = self.client.post(
            f'/api/clinic-intakes/{intake_id}/complete/',
            {'summary': 'Consultation completed and medication prescribed.'},
            format='json',
        )
        self.assertEqual(completed.status_code, status.HTTP_200_OK)
        self.assertEqual(completed.data['status'], ClinicIntake.Status.COMPLETED)

        self.client.force_authenticate(self.student)
        journey = self.client.get(f'/api/clinic-intakes/{intake_id}/')
        self.assertEqual(journey.status_code, status.HTTP_200_OK)
        self.assertEqual(journey.data['approved_summary'], 'Consultation completed and medication prescribed.')
        self.assertEqual(len(journey.data['approved_prescriptions']), 1)
        self.assertNotIn('scheduling_note', journey.data)

        second_intake_id = self.create_intake()
        self.assertNotEqual(second_intake_id, intake_id)
        self.assertEqual(Patient.objects.filter(matric_number='FLOW/001').count(), 1)
        self.assertEqual(User.objects.filter(username='student').count(), 1)
        history = ClinicIntake.objects.get(pk=intake_id).status_history.values_list(
            'to_status', flat=True
        )
        for expected in (
            ClinicIntake.Status.SENT_TO_NURSE,
            ClinicIntake.Status.NURSE_REVIEW,
            ClinicIntake.Status.APPOINTMENT_SCHEDULED,
            ClinicIntake.Status.WAITING_FOR_DOCTOR,
            ClinicIntake.Status.DOCTOR_CONFIRMED,
            ClinicIntake.Status.IN_CONSULTATION,
            ClinicIntake.Status.ATTENDED,
            ClinicIntake.Status.COMPLETED,
        ):
            self.assertIn(expected, history)
        self.assertTrue(AuditLog.objects.filter(
            action='intake_completed', resource_id=intake_id
        ).exists())

    def test_receptionist_permissions_and_active_intake_guard(self):
        intake_id = self.create_intake()
        duplicate = self.client.post('/api/clinic-intakes/', {
            'patient': self.patient.pk,
            'reason_for_visit': 'Second request',
            'presenting_complaint': 'Duplicate active request',
        }, format='json')
        self.assertEqual(duplicate.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(
            self.client.post('/api/diagnoses/', {}, format='json').status_code,
            status.HTTP_403_FORBIDDEN,
        )
        self.assertEqual(
            self.client.post('/api/prescriptions/', {}, format='json').status_code,
            status.HTTP_403_FORBIDDEN,
        )
        self.assertEqual(
            self.client.post(f'/api/clinic-intakes/{intake_id}/begin-review/').status_code,
            status.HTTP_403_FORBIDDEN,
        )
        self.assertEqual(
            self.client.delete(f'/api/patients/{self.patient.pk}/').status_code,
            status.HTTP_403_FORBIDDEN,
        )
        self.assertEqual(self.client.get('/api/staff/').status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(self.client.get('/api/audit-logs/').status_code, status.HTTP_403_FORBIDDEN)

    def test_nurse_schedules_but_cannot_provide_doctor_care(self):
        intake_id = self.create_intake(submit=True)
        doctors = self.client.get('/api/clinic-intakes/available-doctors/')
        self.assertEqual(doctors.status_code, status.HTTP_403_FORBIDDEN)
        self.client.force_authenticate(self.nurse)
        doctors = self.client.get('/api/clinic-intakes/available-doctors/')
        self.assertEqual(doctors.status_code, status.HTTP_200_OK)
        self.assertIn(self.doctor.user.pk, [item['id'] for item in doctors.data['results']])
        self.schedule_intake(intake_id)
        self.assertEqual(
            self.client.post(f'/api/clinic-intakes/{intake_id}/complete/', {
                'summary': 'Not allowed',
            }).status_code,
            status.HTTP_403_FORBIDDEN,
        )
        self.assertEqual(self.client.post('/api/diagnoses/', {}).status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(self.client.post('/api/prescriptions/', {}).status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(self.client.post('/api/medications/', {}).status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(self.client.get('/api/staff/').status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(self.client.get('/api/audit-logs/').status_code, status.HTTP_403_FORBIDDEN)

    def test_schedule_validation_rejects_past_invalid_and_conflicting_doctor(self):
        intake_id = self.create_intake(submit=True)
        self.client.force_authenticate(self.nurse)
        self.client.post(f'/api/clinic-intakes/{intake_id}/begin-review/')
        past = self.client.post(f'/api/clinic-intakes/{intake_id}/schedule/', {
            'assigned_doctor': self.doctor.user.pk,
            'scheduled_for': (timezone.now() - timedelta(hours=1)).isoformat(),
        }, format='json')
        self.assertEqual(past.status_code, status.HTTP_400_BAD_REQUEST)

        when = timezone.now() + timedelta(days=2)
        Appointment.objects.create(
            patient=self.other_patient,
            assigned_doctor=self.doctor.user,
            scheduled_for=when,
            reason='Existing doctor booking',
        )
        conflict = self.client.post(f'/api/clinic-intakes/{intake_id}/schedule/', {
            'assigned_doctor': self.doctor.user.pk,
            'scheduled_for': when.isoformat(),
        }, format='json')
        self.assertEqual(conflict.status_code, status.HTTP_400_BAD_REQUEST)

    def test_doctor_assignment_and_student_ownership_are_enforced(self):
        intake_id = self.create_intake(submit=True)
        self.schedule_intake(intake_id)
        self.client.force_authenticate(self.other_doctor)
        self.assertEqual(self.client.get('/api/clinic-intakes/').data['count'], 0)
        self.assertEqual(
            self.client.post(f'/api/clinic-intakes/{intake_id}/confirm/').status_code,
            status.HTTP_404_NOT_FOUND,
        )
        self.assertEqual(self.client.get('/api/staff/').status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(self.client.get('/api/audit-logs/').status_code, status.HTTP_403_FORBIDDEN)

        self.client.force_authenticate(self.other_student)
        self.assertEqual(
            self.client.get(f'/api/clinic-intakes/{intake_id}/').status_code,
            status.HTTP_404_NOT_FOUND,
        )
        self.assertEqual(
            self.client.post(f'/api/clinic-intakes/{intake_id}/submit/').status_code,
            status.HTTP_403_FORBIDDEN,
        )

    def test_doctor_in_charge_can_reassign_correct_and_archive_with_reason(self):
        intake_id = self.create_intake(submit=True)
        self.schedule_intake(intake_id)
        self.client.force_authenticate(self.admin)
        reassigned = self.client.post(f'/api/clinic-intakes/{intake_id}/reassign/', {
            'assigned_doctor': self.other_doctor.user.pk,
            'reason': 'Doctor unavailable',
        }, format='json')
        self.assertEqual(reassigned.status_code, status.HTTP_200_OK)
        self.assertEqual(reassigned.data['assigned_doctor'], self.other_doctor.user.pk)
        corrected = self.client.post(f'/api/clinic-intakes/{intake_id}/correct/', {
            'target_status': ClinicIntake.Status.NURSE_REVIEW,
            'reason': 'Scheduling entered in error',
        }, format='json')
        self.assertEqual(corrected.status_code, status.HTTP_200_OK)
        no_reason = self.client.post(f'/api/clinic-intakes/{intake_id}/archive/', {})
        self.assertEqual(no_reason.status_code, status.HTTP_400_BAD_REQUEST)
        archived = self.client.post(f'/api/clinic-intakes/{intake_id}/archive/', {
            'reason': 'Duplicate synthetic workflow',
        }, format='json')
        self.assertEqual(archived.status_code, status.HTTP_200_OK)
        self.assertEqual(archived.data['status'], ClinicIntake.Status.ARCHIVED)
        self.assertEqual(
            self.client.delete(f'/api/clinic-intakes/{intake_id}/').status_code,
            status.HTTP_405_METHOD_NOT_ALLOWED,
        )

    def test_unauthenticated_intake_access_returns_401(self):
        self.client.force_authenticate(user=None)
        self.assertEqual(self.client.get('/api/clinic-intakes/').status_code, status.HTTP_401_UNAUTHORIZED)


@override_settings(DEBUG=True)
class DemoPurgeSafetyTests(APITestCase):
    def test_purge_requires_confirmation_and_preserves_non_demo_rows(self):
        demo_user = User.objects.create_user('demo-purge', password='SyntheticTestPass123!')
        demo_user.user.role = Role.ROLE_PATIENT
        demo_user.user.is_demo = True
        demo_user.user.save(update_fields=['role', 'is_demo'])
        Patient.objects.create(
            user=demo_user, matric_number='DEMO/PURGE', first_name='Demo',
            last_name='Purge', date_of_birth='2000-01-01', is_demo=True,
        )
        real_patient = Patient.objects.create(
            matric_number='REAL/KEEP', first_name='Real', last_name='Keep',
            date_of_birth='2000-01-01', is_demo=False,
        )
        with self.assertRaises(CommandError):
            call_command('purge_demo_data', stdout=StringIO())
        self.assertTrue(Patient.objects.filter(pk=real_patient.pk).exists())
        call_command(
            'purge_demo_data', confirm='PURGE-DEMO-DATA', stdout=StringIO()
        )
        self.assertFalse(Patient.objects.filter(matric_number='DEMO/PURGE').exists())
        self.assertTrue(Patient.objects.filter(pk=real_patient.pk).exists())


@override_settings(
    DEBUG=True,
    PASSWORD_HASHERS=['django.contrib.auth.hashers.MD5PasswordHasher'],
)
class DemoSeedTests(APITestCase):
    def test_seed_is_idempotent_and_demo_summary_is_admin_only(self):
        call_command('seed_demo_data', stdout=StringIO())
        counts = (
            Profile.objects.filter(is_demo=True).count(),
            Patient.objects.filter(is_demo=True).count(),
            ClinicIntake.objects.filter(is_demo=True).count(),
        )
        call_command('seed_demo_data', stdout=StringIO())
        self.assertEqual(counts, (
            Profile.objects.filter(is_demo=True).count(),
            Patient.objects.filter(is_demo=True).count(),
            ClinicIntake.objects.filter(is_demo=True).count(),
        ))
        self.assertEqual(counts, (14, 10, 1))

        admin = User.objects.get(username='doctor.in.charge')
        self.client.force_authenticate(admin)
        admin_summary = self.client.get('/api/dashboard/summary/')
        self.assertEqual(admin_summary.status_code, status.HTTP_200_OK)
        self.assertEqual(admin_summary.data['demo_data']['profiles'], 14)

        doctor = User.objects.get(username='dr.jeremiah')
        self.client.force_authenticate(doctor)
        doctor_summary = self.client.get('/api/dashboard/summary/')
        self.assertEqual(doctor_summary.status_code, status.HTTP_200_OK)
        self.assertNotIn('demo_data', doctor_summary.data)
