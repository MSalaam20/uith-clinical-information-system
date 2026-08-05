import uuid

from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models
import logging
from patients.models import Patient
from organization.models import Department
from users.models import Profile
# from jsonschema import validate, ValidationError
from pytils.translit import slugify
from utils.validators import compile_with_custom_formats

logger = logging.getLogger(__name__)


class Schema(models.Model):
    name = models.CharField(max_length=255)
    name_slug = models.SlugField(
        max_length=255, unique=True, null=True, blank=True
        )
    department = models.ForeignKey(
        Department, on_delete=models.CASCADE, null=True, blank=True
        )
    schema = models.JSONField(default=dict)
    ui_schema = models.JSONField(default=dict, null=True, blank=True)

    def save(self, *args, **kwargs):
        if not self.name_slug:
            self.name_slug = slugify(self.name)
        super().save(*args, **kwargs)    

    def __str__(self):
        return str(self.name)


class AbstractRecord(models.Model):
    findings = models.JSONField(default=dict)
    findings_schema = models.ForeignKey(
        Schema, on_delete=models.SET_NULL,
        null=True, blank=True, related_name='+'
        )

    class Meta:
        abstract = True

    def clean(self):
        super().clean()
        if self.findings_schema:
            try:
                validate = compile_with_custom_formats(
                    self.findings_schema.schema
                    )
                validate(self.findings)
            except Exception as e:
                logger.error(f"Validation error: {e}")
                raise ValidationError({'findings': str(e)})


class RecordTemplate(AbstractRecord):
    template_name = models.CharField(max_length=255)
    template_slug = models.SlugField(max_length=255, unique=True)
    department = models.ForeignKey(
        Department, on_delete=models.CASCADE, null=True,
        blank=True, related_name='+'
        )

    def save(self, *args, **kwargs):
        if not self.template_slug:
            self.template_slug = slugify(self.template_name)
        super().save(*args, **kwargs)

    def __str__(self):
        return str(self.template_name)


class Record(AbstractRecord):
    patient = models.ForeignKey(Patient, on_delete=models.CASCADE)
    specialist = models.ForeignKey(
        Profile, on_delete=models.CASCADE, null=True, blank=True
        )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f'Record #{self.id} - Patient: {self.patient}'

    class Meta:
        ordering = ['-created_at']


class Visit(models.Model):
    class Status(models.TextChoices):
        OPEN = 'open', 'open'
        COMPLETED = 'completed', 'completed'
        CANCELLED = 'cancelled', 'cancelled'

    uuid = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)
    patient = models.ForeignKey(
        Patient, on_delete=models.CASCADE, related_name='visits'
    )
    appointment = models.OneToOneField(
        'patients.Appointment',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='visit',
    )
    visit_date = models.DateTimeField(db_index=True)
    visit_type = models.CharField(max_length=50, default='outpatient')
    status = models.CharField(
        max_length=20, choices=Status.choices, default=Status.OPEN, db_index=True
    )
    chief_complaint = models.CharField(max_length=500)
    clinical_summary = models.TextField(blank=True)
    created_by = models.ForeignKey(
        Profile,
        on_delete=models.SET_NULL,
        null=True,
        related_name='created_visits',
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-visit_date']
        indexes = [models.Index(fields=['patient', 'visit_date'])]

    def __str__(self):
        return f'Visit {self.uuid} - {self.patient}'


class VitalSign(models.Model):
    visit = models.ForeignKey(
        Visit, on_delete=models.CASCADE, related_name='vital_signs'
    )
    measured_at = models.DateTimeField()
    temperature_c = models.DecimalField(
        max_digits=4, decimal_places=1, null=True, blank=True
    )
    systolic_bp = models.PositiveSmallIntegerField(null=True, blank=True)
    diastolic_bp = models.PositiveSmallIntegerField(null=True, blank=True)
    pulse_bpm = models.PositiveSmallIntegerField(null=True, blank=True)
    respiratory_rate = models.PositiveSmallIntegerField(null=True, blank=True)
    oxygen_saturation = models.PositiveSmallIntegerField(null=True, blank=True)
    weight_kg = models.DecimalField(
        max_digits=6, decimal_places=2, null=True, blank=True
    )
    height_cm = models.DecimalField(
        max_digits=5, decimal_places=1, null=True, blank=True
    )
    recorded_by = models.ForeignKey(
        Profile,
        on_delete=models.SET_NULL,
        null=True,
        related_name='recorded_vital_signs',
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-measured_at']
        indexes = [models.Index(fields=['visit', 'measured_at'])]


class ClinicalNote(models.Model):
    visit = models.ForeignKey(
        Visit, on_delete=models.CASCADE, related_name='clinical_notes'
    )
    note_type = models.CharField(max_length=50, default='progress')
    note = models.TextField()
    patient_visible = models.BooleanField(default=False, db_index=True)
    author = models.ForeignKey(
        Profile,
        on_delete=models.SET_NULL,
        null=True,
        related_name='clinical_notes',
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']


class ICDCode(models.Model):
    code = models.CharField(max_length=20, unique=True)
    title = models.CharField(max_length=255)
    chapter = models.CharField(max_length=255, blank=True)
    terminology_version = models.CharField(max_length=30, default='ICD-11')
    external_id = models.CharField(max_length=100, blank=True)

    def __str__(self):
        return f'{self.code} - {self.title}'


class Diagnosis(models.Model):
    class DiagnosisType(models.TextChoices):
        PROVISIONAL = 'provisional', 'provisional'
        CONFIRMED = 'confirmed', 'confirmed'
        DIFFERENTIAL = 'differential', 'differential'

    visit = models.ForeignKey(
        Visit, on_delete=models.CASCADE, related_name='diagnoses'
    )
    icd_code = models.ForeignKey(
        ICDCode,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='diagnoses',
    )
    code_snapshot = models.CharField(max_length=20, blank=True, db_index=True)
    description = models.CharField(max_length=500)
    diagnosis_type = models.CharField(
        max_length=20,
        choices=DiagnosisType.choices,
        default=DiagnosisType.CONFIRMED,
    )
    diagnosed_by = models.ForeignKey(
        Profile,
        on_delete=models.SET_NULL,
        null=True,
        related_name='diagnoses',
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']


class Medication(models.Model):
    name = models.CharField(max_length=150)
    generic_name = models.CharField(max_length=150, blank=True)
    strength = models.CharField(max_length=80, blank=True)
    form = models.CharField(max_length=80, blank=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=['name', 'strength', 'form'],
                name='unique_medication_presentation',
            )
        ]

    def __str__(self):
        return ' '.join(part for part in [self.name, self.strength, self.form] if part)


class Prescription(models.Model):
    class Status(models.TextChoices):
        ACTIVE = 'active', 'active'
        COMPLETED = 'completed', 'completed'
        CANCELLED = 'cancelled', 'cancelled'

    patient = models.ForeignKey(
        Patient, on_delete=models.CASCADE, related_name='prescriptions'
    )
    visit = models.ForeignKey(
        Visit, on_delete=models.CASCADE, related_name='prescriptions'
    )
    prescribed_by = models.ForeignKey(
        Profile,
        on_delete=models.SET_NULL,
        null=True,
        related_name='prescriptions',
    )
    prescribed_at = models.DateTimeField()
    status = models.CharField(
        max_length=20, choices=Status.choices, default=Status.ACTIVE
    )
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-prescribed_at']
        indexes = [models.Index(fields=['patient', 'prescribed_at'])]


class PrescriptionItem(models.Model):
    prescription = models.ForeignKey(
        Prescription, on_delete=models.CASCADE, related_name='items'
    )
    medication = models.ForeignKey(
        Medication, on_delete=models.PROTECT, related_name='prescription_items'
    )
    dose = models.CharField(max_length=100)
    route = models.CharField(max_length=80)
    frequency = models.CharField(max_length=100)
    duration = models.CharField(max_length=100)
    instructions = models.TextField(blank=True)


class AuditLog(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='ehr_audit_logs',
    )
    action = models.CharField(max_length=80, db_index=True)
    resource_type = models.CharField(max_length=80, db_index=True)
    resource_id = models.CharField(max_length=64, blank=True)
    description = models.CharField(max_length=500, blank=True)
    timestamp = models.DateTimeField(auto_now_add=True, db_index=True)
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    request_method = models.CharField(max_length=10, blank=True)
    request_path = models.CharField(max_length=500, blank=True)
    success = models.BooleanField(default=True)
    metadata = models.JSONField(default=dict, blank=True)

    class Meta:
        ordering = ['-timestamp']
        indexes = [models.Index(fields=['user', 'timestamp'])]

    def save(self, *args, **kwargs):
        if self.pk and type(self).objects.filter(pk=self.pk).exists():
            raise ValidationError('Audit logs are immutable.')
        return super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        raise ValidationError('Audit logs are append-only and cannot be deleted.')
