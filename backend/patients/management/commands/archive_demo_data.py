from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone

from patients.models import Appointment, ClinicIntake, ClinicIntakeStatusHistory, Patient


class Command(BaseCommand):
    help = 'Archive identified demo patients and workflows without deleting rows.'

    @transaction.atomic
    def handle(self, *args, **options):
        now = timezone.now()
        patient_count = Patient.objects.filter(is_demo=True, is_active=True).update(
            is_active=False,
            archived_at=now,
            archive_reason='Demo data archived by maintenance command.',
        )
        intake_count = 0
        for intake in ClinicIntake.objects.filter(is_demo=True).exclude(
            status=ClinicIntake.Status.ARCHIVED
        ):
            previous = intake.status
            intake.status = ClinicIntake.Status.ARCHIVED
            intake.archived_at = now
            intake.archive_reason = 'Demo data archived by maintenance command.'
            intake.save(update_fields=[
                'status', 'archived_at', 'archive_reason', 'updated_at'
            ])
            ClinicIntakeStatusHistory.objects.create(
                intake=intake,
                from_status=previous,
                to_status=ClinicIntake.Status.ARCHIVED,
                reason=intake.archive_reason,
            )
            Appointment.objects.filter(intake=intake).exclude(
                status=Appointment.Status.COMPLETED
            ).update(
                status=Appointment.Status.CANCELLED,
                updated_at=now,
            )
            intake_count += 1
        self.stdout.write(self.style.SUCCESS(
            f'Archived {patient_count} demo patients and {intake_count} demo workflows.'
        ))
