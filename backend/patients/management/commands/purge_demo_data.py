from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.db.models import Q

from patients.models import Appointment, ClinicIntake, Patient
from records.models import (
    ClinicalNote, Diagnosis, Prescription, Record, Visit, VitalSign,
)
from users.models import Profile


User = get_user_model()


class Command(BaseCommand):
    help = 'Permanently remove only positively identified demo data after confirmation.'

    def add_arguments(self, parser):
        parser.add_argument('--confirm', default='')

    @transaction.atomic
    def handle(self, *args, **options):
        if not settings.DEBUG and not getattr(settings, 'ALLOW_DEMO_DATA_PURGE', False):
            raise CommandError('Demo purge is disabled outside development mode.')
        demo_patients = Patient.objects.filter(is_demo=True)
        demo_profiles = Profile.objects.filter(is_demo=True)
        uncertain_intakes = ClinicIntake.objects.filter(is_demo=True, patient__is_demo=False)
        non_demo_assignments = Appointment.objects.filter(patient__is_demo=False).filter(
            Q(assigned_doctor__in=demo_profiles)
            | Q(attended_by__in=demo_profiles)
            | Q(booked_by__in=demo_profiles)
            | Q(scheduled_by__in=demo_profiles)
        )
        if uncertain_intakes.exists() or non_demo_assignments.exists():
            raise CommandError('Demo identity is uncertain; no rows were removed.')

        counts = {
            'patients': demo_patients.count(),
            'profiles': demo_profiles.count(),
            'appointments': Appointment.objects.filter(patient__in=demo_patients).count(),
            'intakes': ClinicIntake.objects.filter(patient__in=demo_patients).count(),
            'visits': Visit.objects.filter(patient__in=demo_patients).count(),
            'records': Record.objects.filter(patient__in=demo_patients).count(),
        }
        self.stdout.write('Demo rows selected: ' + ', '.join(
            f'{name}={count}' for name, count in counts.items()
        ))
        if options['confirm'] != 'PURGE-DEMO-DATA':
            raise CommandError(
                'No rows removed. Re-run with --confirm PURGE-DEMO-DATA.'
            )

        visits = Visit.objects.filter(patient__in=demo_patients)
        Prescription.objects.filter(patient__in=demo_patients).delete()
        ClinicalNote.objects.filter(visit__in=visits).delete()
        Diagnosis.objects.filter(visit__in=visits).delete()
        VitalSign.objects.filter(visit__in=visits).delete()
        visits.delete()
        Record.objects.filter(patient__in=demo_patients).delete()
        Appointment.objects.filter(patient__in=demo_patients).delete()
        ClinicIntake.objects.filter(patient__in=demo_patients).delete()
        demo_patients.delete()
        User.objects.filter(user__is_demo=True).delete()
        self.stdout.write(self.style.SUCCESS('Only positively identified demo rows were removed.'))
