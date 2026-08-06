import os

from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.utils import timezone

from patients.demo_registry import DEMO_STAFF, DEMO_STUDENTS, student_username
from patients.models import (
    Appointment, ClinicIntake, ClinicIntakeStatusHistory, Patient,
)
from records.models import (
    ClinicalNote, Diagnosis, ICDCode, Medication, Prescription,
    PrescriptionItem, Visit,
)
from users.models import Role
from users.services import generate_temporary_password


User = get_user_model()


class Command(BaseCommand):
    help = 'Create or update identified synthetic defence records without duplicates.'

    @transaction.atomic
    def handle(self, *args, **options):
        if not settings.DEBUG and not settings.ALLOW_DEMO_ACCOUNTS:
            raise CommandError('Demo seeding is disabled outside development/defence mode.')
        configured_password = os.environ.get('EHR_DEMO_PASSWORD')
        credentials = []

        profiles = {}
        for account in DEMO_STAFF:
            user, created = User.objects.get_or_create(
                username=account['username'],
                defaults={
                    'first_name': account['first_name'],
                    'last_name': account['last_name'],
                    'email': account['email'],
                    'is_active': True,
                },
            )
            password = configured_password or (generate_temporary_password() if created else None)
            if password:
                user.set_password(password)
                user.save(update_fields=['password'])
                credentials.append((user.username, password))
            profile = user.user
            profile.role = account['role']
            profile.is_demo = True
            profile.must_change_password = False
            profile.save(update_fields=['role', 'is_demo', 'must_change_password'])
            profiles[account['role']] = profile

        patients = []
        for matric, first, last, department, gender, birth_date in DEMO_STUDENTS:
            username = student_username(matric)
            user, created = User.objects.get_or_create(
                username=username,
                defaults={
                    'first_name': first,
                    'last_name': last,
                    'email': f'{username}@example.invalid',
                    'is_active': True,
                },
            )
            password = configured_password or (generate_temporary_password() if created else None)
            if password:
                user.set_password(password)
                user.save(update_fields=['password'])
                credentials.append((user.username, password))
            profile = user.user
            profile.role = Role.ROLE_PATIENT
            profile.is_demo = True
            profile.must_change_password = False
            profile.save(update_fields=['role', 'is_demo', 'must_change_password'])

            patient, _ = Patient.objects.get_or_create(
                matric_number=matric,
                defaults={
                    'user': user, 'first_name': first, 'last_name': last,
                    'department': department, 'gender': gender,
                    'date_of_birth': birth_date, 'is_demo': True,
                },
            )
            if patient.user_id not in {None, user.id}:
                raise CommandError(f'{matric} is linked to an unexpected account; refusing to mark it as demo.')
            patient.user = user
            patient.is_demo = True
            patient.save(update_fields=['user', 'is_demo', 'updated_at'])
            patients.append(patient)

        self._seed_completed_workflow(
            patient=patients[0],
            receptionist=profiles[Role.ROLE_RECEPTIONIST],
            nurse=profiles[Role.ROLE_NURSE],
            doctor=profiles[Role.ROLE_DOCTOR],
        )

        self.stdout.write(self.style.SUCCESS(
            f'Demo data ready: {len(DEMO_STAFF)} staff, {len(patients)} students, '
            'and one representative completed workflow.'
        ))
        for username, password in credentials:
            self.stdout.write(f'Created/reset {username}; one-time password: {password}')
        if not credentials:
            self.stdout.write('Existing passwords were preserved. Set EHR_DEMO_PASSWORD to reset them.')

    def _seed_completed_workflow(self, *, patient, receptionist, nurse, doctor):
        now = timezone.now()
        intake, created = ClinicIntake.objects.get_or_create(
            demo_key='defence-completed-workflow',
            defaults={
                'patient': patient,
                'reason_for_visit': 'Persistent headache and fever review',
                'presenting_complaint': 'Student reports headache and fever for two days.',
                'priority': ClinicIntake.Priority.ROUTINE,
                'status': ClinicIntake.Status.COMPLETED,
                'created_by': receptionist,
                'reviewed_by': nurse,
                'assigned_doctor': doctor,
                'submitted_at': now,
                'reviewed_at': now,
                'scheduled_at': now,
                'confirmed_at': now,
                'consultation_started_at': now,
                'attended_at': now,
                'completed_at': now,
                'is_demo': True,
            },
        )
        if not created and (not intake.is_demo or not intake.patient.is_demo):
            raise CommandError('The demo workflow key belongs to an uncertain record.')
        stages = [
            ClinicIntake.Status.RECEPTION_INTAKE,
            ClinicIntake.Status.SENT_TO_NURSE,
            ClinicIntake.Status.NURSE_REVIEW,
            ClinicIntake.Status.APPOINTMENT_SCHEDULED,
            ClinicIntake.Status.WAITING_FOR_DOCTOR,
            ClinicIntake.Status.DOCTOR_CONFIRMED,
            ClinicIntake.Status.IN_CONSULTATION,
            ClinicIntake.Status.ATTENDED,
            ClinicIntake.Status.COMPLETED,
        ]
        previous = ''
        for stage in stages:
            ClinicIntakeStatusHistory.objects.get_or_create(
                intake=intake,
                to_status=stage,
                defaults={
                    'from_status': previous,
                    'changed_by': doctor if stage not in stages[:3] else receptionist,
                },
            )
            previous = stage

        appointment, _ = Appointment.objects.get_or_create(
            intake=intake,
            defaults={
                'patient': patient,
                'scheduled_for': now,
                'reason': intake.reason_for_visit,
                'status': Appointment.Status.COMPLETED,
                'booked_by': receptionist,
                'scheduled_by': nurse,
                'assigned_doctor': doctor,
                'attended_by': doctor,
            },
        )
        visit, _ = Visit.objects.get_or_create(
            appointment=appointment,
            defaults={
                'patient': patient,
                'visit_date': now,
                'visit_type': 'outpatient',
                'status': Visit.Status.COMPLETED,
                'chief_complaint': intake.presenting_complaint,
                'clinical_summary': 'Synthetic demonstration consultation completed without complication.',
                'created_by': doctor,
            },
        )
        ClinicalNote.objects.get_or_create(
            visit=visit,
            note='Synthetic demonstration progress note.',
            defaults={'note_type': 'progress', 'patient_visible': True, 'author': doctor},
        )
        code = ICDCode.objects.filter(code='9C83').first()
        Diagnosis.objects.get_or_create(
            visit=visit,
            description='Demonstration headache assessment',
            defaults={
                'icd_code': code, 'code_snapshot': code.code if code else '9C83',
                'diagnosis_type': Diagnosis.DiagnosisType.CONFIRMED,
                'diagnosed_by': doctor,
            },
        )
        medication, _ = Medication.objects.get_or_create(
            name='Paracetamol', strength='500 mg', form='tablet',
            defaults={'generic_name': 'Paracetamol', 'is_active': True},
        )
        prescription, _ = Prescription.objects.get_or_create(
            patient=patient, visit=visit,
            defaults={
                'prescribed_by': doctor, 'prescribed_at': now,
                'status': Prescription.Status.COMPLETED,
                'notes': 'Synthetic demonstration prescription.',
            },
        )
        PrescriptionItem.objects.get_or_create(
            prescription=prescription,
            medication=medication,
            defaults={
                'dose': '500 mg', 'route': 'oral', 'frequency': 'three times daily',
                'duration': '3 days', 'instructions': 'Take after food.',
            },
        )
