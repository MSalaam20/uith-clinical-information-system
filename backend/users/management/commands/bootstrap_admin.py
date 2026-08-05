import getpass
import os

from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from users.models import Role


User = get_user_model()


class Command(BaseCommand):
    help = 'Create or update a clinic administrator through a local CLI workflow.'

    def add_arguments(self, parser):
        parser.add_argument('--username')
        parser.add_argument('--email')
        parser.add_argument('--first-name')
        parser.add_argument('--last-name')
        parser.add_argument('--noinput', action='store_true')
        parser.add_argument(
            '--password-env',
            default='BOOTSTRAP_ADMIN_PASSWORD',
            help='Environment variable containing the password in non-interactive mode.',
        )

    def handle(self, *args, **options):
        interactive = not options['noinput']
        username = options['username'] or (
            input('Username: ').strip() if interactive else ''
        )
        email = options['email'] or (
            input('Email: ').strip() if interactive else ''
        )
        first_name = options['first_name'] or (
            input('First name: ').strip() if interactive else ''
        )
        last_name = options['last_name'] or (
            input('Last name: ').strip() if interactive else ''
        )

        if not username or not email:
            raise CommandError('Username and email are required.')

        password = self._read_password(options['password_env'], interactive)
        existing_email = User.objects.filter(email__iexact=email).exclude(
            username=username
        )
        if existing_email.exists():
            raise CommandError('That email address belongs to another account.')

        candidate = User(
            username=username,
            email=email.lower(),
            first_name=first_name,
            last_name=last_name,
        )
        if password:
            try:
                validate_password(password, user=candidate)
            except ValidationError as exc:
                raise CommandError(' '.join(exc.messages)) from exc

        with transaction.atomic():
            user, created = User.objects.get_or_create(username=username)
            user.email = email.lower()
            user.first_name = first_name
            user.last_name = last_name
            user.is_active = True
            user.is_staff = True
            if password:
                user.set_password(password)
            elif created:
                raise CommandError('A password is required for a new administrator.')
            user.save()

            profile = user.user
            profile.role = Role.ROLE_ADMIN
            profile.must_change_password = False
            profile.save(update_fields=['role', 'must_change_password'])

        verb = 'Created' if created else 'Updated'
        self.stdout.write(self.style.SUCCESS(f'{verb} administrator {username}.'))

    def _read_password(self, environment_name, interactive):
        environment_password = os.environ.get(environment_name, '')
        if environment_password:
            return environment_password
        if not interactive:
            return ''

        password = getpass.getpass('Password: ')
        confirmation = getpass.getpass('Password (again): ')
        if password != confirmation:
            raise CommandError('Passwords do not match.')
        return password
