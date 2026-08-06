import os

from django.conf import settings
from django.core.management import call_command
from django.core.management.base import BaseCommand, CommandError


class Command(BaseCommand):
    help = 'Compatibility alias for the guarded synthetic defence-data seeder.'

    def handle(self, *args, **options):
        if not (settings.DEBUG or settings.ALLOW_DEMO_ACCOUNTS):
            raise CommandError(
                'Demo account seeding is disabled outside development. '
                'Set ALLOW_DEMO_ACCOUNTS=True only in an intentional demo environment.'
            )
        if not os.environ.get('EHR_DEMO_PASSWORD'):
            raise CommandError(
                'Set EHR_DEMO_PASSWORD before seeding deterministic demo accounts.'
            )
        call_command('seed_demo_data', stdout=self.stdout)
