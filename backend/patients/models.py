import uuid

from django.conf import settings
from django.db import models


class Patient(models.Model):
    uuid = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)

    class Gender(models.TextChoices):
        MALE = 'M', 'male'
        FEMALE = 'F', 'female'
        OTHER = 'O', 'other'

    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='patient_profile',
    )
    matric_number = models.CharField(max_length=20, unique=True, null=True, blank=True)
    department = models.CharField(max_length=150, blank=True, null=True)
    first_name = models.CharField(max_length=100, blank=True, null=True, )
    middle_name = models.CharField(max_length=100, blank=True, null=True, )
    last_name = models.CharField(max_length=100, db_index=True)
    date_of_birth = models.DateField()
    gender = models.CharField(
        max_length=1,
        choices=Gender.choices,
        default=Gender.FEMALE
    )
    photo = models.ImageField(
        upload_to='images/patients_profile/',
        blank=True,
        null=True,
        )
    address = models.CharField(max_length=200, blank=True, null=True, )
    phone_number = models.CharField(max_length=20, blank=True, null=True, )
    email = models.EmailField(blank=True, null=True, )
    next_of_kin = models.CharField(max_length=200, blank=True)
    emergency_contact = models.CharField(max_length=20, blank=True)
    is_active = models.BooleanField(default=True, db_index=True)
    is_demo = models.BooleanField(default=False, db_index=True)
    archived_at = models.DateTimeField(null=True, blank=True)
    archive_reason = models.CharField(max_length=255, blank=True)
    archived_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='archived_patients',
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='created_patients',
    )
    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='updated_patients',
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f'{self.matric_number or self.first_name} {self.last_name}'

    class Meta:
        ordering = ['-created_at']


class Appointment(models.Model):
    class Status(models.TextChoices):
        REQUESTED = 'requested', 'requested'
        SCHEDULED = 'scheduled', 'scheduled'
        CONFIRMED = 'confirmed', 'confirmed'
        IN_CONSULTATION = 'in_consultation', 'in consultation'
        ATTENDED = 'attended', 'attended'
        COMPLETED = 'completed', 'completed'
        MISSED = 'missed', 'missed'
        CANCELLED = 'cancelled', 'cancelled'

    patient = models.ForeignKey(Patient, on_delete=models.CASCADE, related_name='appointments')
    intake = models.OneToOneField(
        'ClinicIntake',
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name='appointment',
    )
    scheduled_for = models.DateTimeField(db_index=True)
    reason = models.CharField(max_length=255)
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.SCHEDULED,
    )
    booked_by = models.ForeignKey(
        'users.Profile',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='booked_appointments',
    )
    attended_by = models.ForeignKey(
        'users.Profile',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='attended_appointments',
    )
    assigned_doctor = models.ForeignKey(
        'users.Profile',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='assigned_appointments',
    )
    scheduled_by = models.ForeignKey(
        'users.Profile',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='scheduled_appointments',
    )
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f'{self.patient} - {self.scheduled_for:%Y-%m-%d %H:%M}'

    class Meta:
        ordering = ['-scheduled_for']
        indexes = [
            models.Index(fields=['patient', 'scheduled_for']),
            models.Index(fields=['status', 'scheduled_for']),
            models.Index(fields=['assigned_doctor', 'scheduled_for']),
        ]


class ClinicIntake(models.Model):
    class Status(models.TextChoices):
        RECEPTION_INTAKE = 'RECEPTION_INTAKE', 'Reception intake'
        SENT_TO_NURSE = 'SENT_TO_NURSE', 'Sent to nurse'
        NURSE_REVIEW = 'NURSE_REVIEW', 'Nurse review'
        APPOINTMENT_SCHEDULED = 'APPOINTMENT_SCHEDULED', 'Appointment scheduled'
        WAITING_FOR_DOCTOR = 'WAITING_FOR_DOCTOR', 'Waiting for doctor'
        DOCTOR_CONFIRMED = 'DOCTOR_CONFIRMED', 'Doctor confirmed'
        IN_CONSULTATION = 'IN_CONSULTATION', 'In consultation'
        ATTENDED = 'ATTENDED', 'Attended'
        COMPLETED = 'COMPLETED', 'Completed'
        FOLLOW_UP_REQUIRED = 'FOLLOW_UP_REQUIRED', 'Follow-up required'
        CANCELLED = 'CANCELLED', 'Cancelled'
        ARCHIVED = 'ARCHIVED', 'Archived'

    class Priority(models.TextChoices):
        ROUTINE = 'routine', 'Routine'
        PRIORITY = 'priority', 'Priority'
        URGENT = 'urgent', 'Urgent'

    uuid = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)
    patient = models.ForeignKey(
        Patient, on_delete=models.PROTECT, related_name='clinic_intakes'
    )
    reason_for_visit = models.CharField(max_length=255)
    presenting_complaint = models.TextField(max_length=2000)
    priority = models.CharField(
        max_length=20, choices=Priority.choices, default=Priority.ROUTINE
    )
    status = models.CharField(
        max_length=32,
        choices=Status.choices,
        default=Status.RECEPTION_INTAKE,
        db_index=True,
    )
    assigned_doctor = models.ForeignKey(
        'users.Profile',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='assigned_intakes',
    )
    created_by = models.ForeignKey(
        'users.Profile',
        on_delete=models.SET_NULL,
        null=True,
        related_name='created_intakes',
    )
    reviewed_by = models.ForeignKey(
        'users.Profile',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='reviewed_intakes',
    )
    scheduling_note = models.TextField(blank=True, max_length=2000)
    follow_up_instructions = models.TextField(blank=True, max_length=3000)
    archive_reason = models.CharField(max_length=500, blank=True)
    archived_by = models.ForeignKey(
        'users.Profile',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='archived_intakes',
    )
    submitted_at = models.DateTimeField(null=True, blank=True)
    reviewed_at = models.DateTimeField(null=True, blank=True)
    scheduled_at = models.DateTimeField(null=True, blank=True)
    confirmed_at = models.DateTimeField(null=True, blank=True)
    consultation_started_at = models.DateTimeField(null=True, blank=True)
    attended_at = models.DateTimeField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    archived_at = models.DateTimeField(null=True, blank=True)
    is_demo = models.BooleanField(default=False, db_index=True)
    demo_key = models.CharField(max_length=100, unique=True, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['patient', 'status']),
            models.Index(fields=['assigned_doctor', 'status']),
        ]

    def __str__(self):
        return f'Intake {self.uuid} - {self.patient}'


class ClinicIntakeStatusHistory(models.Model):
    intake = models.ForeignKey(
        ClinicIntake, on_delete=models.CASCADE, related_name='status_history'
    )
    from_status = models.CharField(max_length=32, blank=True)
    to_status = models.CharField(max_length=32, choices=ClinicIntake.Status.choices)
    changed_by = models.ForeignKey(
        'users.Profile',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='intake_status_changes',
    )
    reason = models.CharField(max_length=500, blank=True)
    metadata = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ['created_at', 'id']

    def __str__(self):
        return f'{self.intake_id}: {self.from_status or "created"} -> {self.to_status}'
