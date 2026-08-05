import re

from django.contrib.auth import get_user_model
from django.db import transaction
from django.utils import timezone
from rest_framework import serializers
from users.models import Role
from users.services import generate_temporary_password, validate_account_password
from .models import Appointment, Patient


User = get_user_model()


class AppointmentSerializer(serializers.ModelSerializer):
    patient_matric_number = serializers.CharField(source='patient.matric_number', read_only=True)
    patient_name = serializers.SerializerMethodField()
    booked_by_name = serializers.SerializerMethodField()
    attended_by_name = serializers.SerializerMethodField()

    class Meta:
        model = Appointment
        fields = [
            'id',
            'patient',
            'patient_matric_number',
            'patient_name',
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
            'patient_name',
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

    def get_patient_name(self, obj):
        return ' '.join(
            part for part in [
                obj.patient.first_name,
                obj.patient.middle_name,
                obj.patient.last_name,
            ] if part
        )

    def get_booked_by_name(self, obj):
        if obj.booked_by and obj.booked_by.user:
            return f"{obj.booked_by.user.first_name} {obj.booked_by.user.last_name}".strip()
        return None

    def get_attended_by_name(self, obj):
        if obj.attended_by and obj.attended_by.user:
            return f"{obj.attended_by.user.first_name} {obj.attended_by.user.last_name}".strip()
        return None


class AppointmentStatusSerializer(serializers.Serializer):
    status = serializers.ChoiceField(choices=Appointment.Status.choices)


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


class StudentPortalAccountSerializer(serializers.Serializer):
    username = serializers.CharField(max_length=150)
    email = serializers.EmailField(required=False, allow_blank=True)
    first_name = serializers.CharField(max_length=150, required=False, allow_blank=True)
    last_name = serializers.CharField(max_length=150, required=False, allow_blank=True)
    temporary_password = serializers.CharField(
        write_only=True, required=False, trim_whitespace=False
    )

    def validate_username(self, value):
        value = value.strip()
        if User.objects.filter(username__iexact=value).exists():
            raise serializers.ValidationError('This username is already in use.')
        return value

    def validate_email(self, value):
        value = value.strip().lower()
        if value and User.objects.filter(email__iexact=value).exists():
            raise serializers.ValidationError('This email address is already in use.')
        return value

    def validate(self, attrs):
        patient = self.context['patient']
        if patient.user_id:
            raise serializers.ValidationError(
                'This patient already has a linked portal account.'
            )
        password = attrs.get('temporary_password')
        if password:
            candidate = User(
                username=attrs.get('username', ''),
                email=attrs.get('email', ''),
                first_name=attrs.get('first_name') or patient.first_name or '',
                last_name=attrs.get('last_name') or patient.last_name or '',
            )
            errors = validate_account_password(password, candidate)
            if errors:
                raise serializers.ValidationError({'temporary_password': errors})
        return attrs

    @transaction.atomic
    def create(self, validated_data):
        patient = self.context['patient']
        password = validated_data.pop('temporary_password', None)
        password = password or generate_temporary_password()
        user = User(
            username=validated_data['username'],
            email=validated_data.get('email') or patient.email or '',
            first_name=(
                validated_data.get('first_name') or patient.first_name or ''
            ),
            last_name=(
                validated_data.get('last_name') or patient.last_name or ''
            ),
            is_active=True,
        )
        user.set_password(password)
        user.save()
        profile = user.user
        profile.role = Role.ROLE_PATIENT
        profile.phone_number = patient.phone_number or ''
        profile.must_change_password = True
        profile.save(update_fields=[
            'role', 'phone_number', 'must_change_password'
        ])
        patient.user = user
        patient.save(update_fields=['user', 'updated_at'])
        self.temporary_password = password
        return user


class PortalAccountStatusSerializer(serializers.Serializer):
    is_active = serializers.BooleanField()
