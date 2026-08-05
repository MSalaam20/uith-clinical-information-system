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
        SCHEDULED = 'scheduled', 'scheduled'
        COMPLETED = 'completed', 'completed'
        MISSED = 'missed', 'missed'
        CANCELLED = 'cancelled', 'cancelled'

    patient = models.ForeignKey(Patient, on_delete=models.CASCADE, related_name='appointments')
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
        ]
