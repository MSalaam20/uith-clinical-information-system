from datetime import date

from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from patients.models import Patient
from users.models import Role


User = get_user_model()

DEMO_ACCOUNTS = (
    {
        'username': 'dr.jeremiah',
        'password': 'Doctor@123',
        'email': 'jeremiah.adebayo@uithclinic.edu.ng',
        'first_name': 'Jeremiah',
        'last_name': 'Adebayo',
        'role': Role.ROLE_DOCTOR,
    },
    {
        'username': 'nurse.fatima',
        'password': 'Nurse@123',
        'email': 'fatima.suleiman@uithclinic.edu.ng',
        'first_name': 'Fatima',
        'last_name': 'Suleiman',
        'role': Role.ROLE_NURSE,
    },
    {
        'username': 'mr.ibrahim',
        'password': 'Reception@123',
        'email': 'ibrahim.adamu@uithclinic.edu.ng',
        'first_name': 'Ibrahim',
        'last_name': 'Adamu',
        'role': Role.ROLE_RECEPTIONIST,
    },
    {
        'username': 'uith_2021_52HL034',
        'password': 'Student@123',
        'email': 'amina.sulaiman@students.unilorin.edu.ng',
        'first_name': 'Amina',
        'last_name': 'Sulaiman',
        'role': Role.ROLE_PATIENT,
    },
)


class Command(BaseCommand):
    help = 'Create deterministic development-only clinic demo accounts.'

    def handle(self, *args, **options):
        if not (settings.DEBUG or settings.ALLOW_DEMO_ACCOUNTS):
            raise CommandError(
                'Demo account seeding is disabled outside development. '
                'Set ALLOW_DEMO_ACCOUNTS=True only in an intentional demo environment.'
            )

        with transaction.atomic():
            for account in DEMO_ACCOUNTS:
                self._seed_account(account)

        self.stdout.write(self.style.SUCCESS('Demo accounts are ready.'))

    def _seed_account(self, account):
        user, _ = User.objects.get_or_create(username=account['username'])
        user.email = account['email']
        user.first_name = account['first_name']
        user.last_name = account['last_name']
        user.is_active = True
        user.set_password(account['password'])
        user.save()

        profile = user.user
        profile.role = account['role']
        profile.must_change_password = False
        profile.token_version += 1
        profile.save(update_fields=['role', 'must_change_password', 'token_version'])

        if account['role'] == Role.ROLE_PATIENT:
            patient, _ = Patient.objects.get_or_create(
                matric_number='2021/52HL034',
                defaults={
                    'first_name': account['first_name'],
                    'last_name': account['last_name'],
                    'date_of_birth': date(2002, 4, 18),
                    'gender': Patient.Gender.FEMALE,
                    'department': 'Biochemistry',
                    'email': account['email'],
                },
            )
            if patient.user_id != user.id:
                patient.user = user
                patient.save(update_fields=['user'])
