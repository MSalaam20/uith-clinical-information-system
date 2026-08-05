from django.core.management.base import BaseCommand


class Command(BaseCommand):
    help = 'Deprecated compatibility wrapper for seed_uith_data'

    def handle(self, *args, **options):
        self.stdout.write(self.style.WARNING('Use seed_uith_data instead of generate_patients_data.'))
