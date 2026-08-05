import re

from django.utils import timezone
from rest_framework import serializers
from .models import Appointment, Patient


class AppointmentSerializer(serializers.ModelSerializer):
    patient_matric_number = serializers.CharField(source='patient.matric_number', read_only=True)
    booked_by_name = serializers.SerializerMethodField()
    attended_by_name = serializers.SerializerMethodField()

    class Meta:
        model = Appointment
        fields = [
            'id',
            'patient',
            'patient_matric_number',
            'scheduled_for',
            'reason',
            'status',
            'booked_by',
            'booked_by_name',
            'attended_by',
            'attended_by_name',
            'notes',
            'created_at',
            'updated_at',
        ]
        read_only_fields = [
            'id', 'booked_by', 'created_at', 'updated_at',
            'patient_matric_number', 'booked_by_name', 'attended_by_name',
        ]

    def validate(self, attrs):
        scheduled_for = attrs.get('scheduled_for')
        patient = attrs.get('patient')
        status_value = attrs.get('status', Appointment.Status.SCHEDULED)
        if self.instance is None and scheduled_for and scheduled_for <= timezone.now():
            raise serializers.ValidationError({
                'scheduled_for': 'A new appointment must be scheduled in the future.'
            })

        if patient and scheduled_for and status_value != Appointment.Status.CANCELLED:
            conflicts = Appointment.objects.filter(
                patient=patient,
                scheduled_for=scheduled_for,
            ).exclude(status=Appointment.Status.CANCELLED)
            if self.instance:
                conflicts = conflicts.exclude(pk=self.instance.pk)
            if conflicts.exists():
                raise serializers.ValidationError({
                    'scheduled_for': 'This patient already has an appointment at this time.'
                })
        return attrs

    def get_booked_by_name(self, obj):
        if obj.booked_by and obj.booked_by.user:
            return f"{obj.booked_by.user.first_name} {obj.booked_by.user.last_name}".strip()
        return None

    def get_attended_by_name(self, obj):
        if obj.attended_by and obj.attended_by.user:
            return f"{obj.attended_by.user.first_name} {obj.attended_by.user.last_name}".strip()
        return None


class PatientSerializer(serializers.ModelSerializer):
    class Meta:
        model = Patient
        fields = [
            'id', 'uuid', 'user', 'matric_number', 'department',
            'first_name', 'middle_name', 'last_name',
            'date_of_birth', 'gender', 'photo', 'address',
            'phone_number', 'email', 'next_of_kin', 'emergency_contact',
            'is_active', 'archived_at', 'archive_reason',
            'created_at', 'updated_at'
            ]
        read_only_fields = [
            'id', 'uuid', 'user', 'is_active', 'archived_at',
            'archive_reason', 'created_at', 'updated_at',
        ]

    def validate_date_of_birth(self, value):
        if value > timezone.localdate():
            raise serializers.ValidationError('Date of birth cannot be in the future.')
        return value

    def validate_first_name(self, value):
        if not value or not value.strip():
            raise serializers.ValidationError('First name is required.')
        return value.strip()

    def validate_last_name(self, value):
        if not value or not value.strip():
            raise serializers.ValidationError('Last name is required.')
        return value.strip()

    def validate_phone_number(self, value):
        if value and not re.fullmatch(r'0\d{10}', value):
            raise serializers.ValidationError(
                'Enter an 11-digit Nigerian phone number beginning with 0.'
            )
        return value

    def validate_emergency_contact(self, value):
        if value and not re.fullmatch(r'0\d{10}', value):
            raise serializers.ValidationError(
                'Enter an 11-digit Nigerian phone number beginning with 0.'
            )
        return value

    def validate_photo(self, value):
        if not value:
            return value
        if value.size > 5 * 1024 * 1024:
            raise serializers.ValidationError('Patient photographs must be 5 MB or smaller.')
        allowed_types = {'image/jpeg', 'image/png', 'image/webp'}
        if getattr(value, 'content_type', None) not in allowed_types:
            raise serializers.ValidationError('Use a JPEG, PNG, or WebP photograph.')
        return value
