import re

from django.contrib.auth import get_user_model
from django.core.exceptions import ObjectDoesNotExist
from django.db import transaction
from django.utils import timezone
from rest_framework import serializers
from users.models import Profile, Role
from users.services import generate_temporary_password, validate_account_password
from .models import (
    Appointment,
    ClinicIntake,
    ClinicIntakeStatusHistory,
    Patient,
)


User = get_user_model()


class AppointmentSerializer(serializers.ModelSerializer):
    patient_matric_number = serializers.CharField(source='patient.matric_number', read_only=True)
    patient_name = serializers.SerializerMethodField()
    booked_by_name = serializers.SerializerMethodField()
    attended_by_name = serializers.SerializerMethodField()
    assigned_doctor_name = serializers.SerializerMethodField()
    scheduled_by_name = serializers.SerializerMethodField()

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
            'intake',
            'booked_by',
            'booked_by_name',
            'attended_by',
            'attended_by_name',
            'assigned_doctor',
            'assigned_doctor_name',
            'scheduled_by',
            'scheduled_by_name',
            'notes',
            'created_at',
            'updated_at',
        ]
        read_only_fields = [
            'id', 'status', 'booked_by', 'attended_by', 'scheduled_by',
            'created_at', 'updated_at',
            'patient_matric_number', 'booked_by_name', 'attended_by_name',
            'patient_name', 'assigned_doctor_name', 'scheduled_by_name',
        ]

    def validate(self, attrs):
        scheduled_for = attrs.get('scheduled_for')
        patient = attrs.get('patient')
        status_value = getattr(self.instance, 'status', Appointment.Status.SCHEDULED)
        intake = attrs.get('intake', getattr(self.instance, 'intake', None))
        doctor = attrs.get(
            'assigned_doctor', getattr(self.instance, 'assigned_doctor', None)
        )
        if self.instance is None and scheduled_for and scheduled_for <= timezone.now():
            raise serializers.ValidationError({
                'scheduled_for': 'A new appointment must be scheduled in the future.'
            })

        if intake and patient and intake.patient_id != patient.id:
            raise serializers.ValidationError({
                'intake': 'The selected intake belongs to a different patient.'
            })
        if doctor and (
            doctor.role not in {Role.ROLE_DOCTOR, Role.ROLE_ADMIN}
            or not doctor.user.is_active
        ):
            raise serializers.ValidationError({
                'assigned_doctor': 'Select an active doctor.'
            })
        if intake and doctor and intake.assigned_doctor_id not in {None, doctor.id}:
            raise serializers.ValidationError({
                'assigned_doctor': 'The doctor does not match the intake assignment.'
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
        if doctor and scheduled_for and status_value != Appointment.Status.CANCELLED:
            conflicts = Appointment.objects.filter(
                assigned_doctor=doctor,
                scheduled_for=scheduled_for,
            ).exclude(status=Appointment.Status.CANCELLED)
            if self.instance:
                conflicts = conflicts.exclude(pk=self.instance.pk)
            if conflicts.exists():
                raise serializers.ValidationError({
                    'scheduled_for': 'The selected doctor already has an appointment at this time.'
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

    def get_assigned_doctor_name(self, obj):
        return self._profile_name(obj.assigned_doctor)

    def get_scheduled_by_name(self, obj):
        return self._profile_name(obj.scheduled_by)

    @staticmethod
    def _profile_name(profile):
        if not profile or not profile.user:
            return None
        return ' '.join(
            part for part in [profile.user.first_name, profile.user.last_name] if part
        ) or profile.user.username


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
            'is_active', 'is_demo', 'archived_at', 'archive_reason',
            'created_at', 'updated_at'
            ]
        read_only_fields = [
            'id', 'uuid', 'user', 'is_active', 'is_demo', 'archived_at',
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


class IntakePatientSerializer(serializers.ModelSerializer):
    class Meta:
        model = Patient
        fields = [
            'id', 'uuid', 'matric_number', 'first_name', 'middle_name',
            'last_name', 'date_of_birth', 'gender', 'department',
            'phone_number', 'next_of_kin', 'emergency_contact',
        ]


class IntakeHistorySerializer(serializers.ModelSerializer):
    changed_by_name = serializers.SerializerMethodField()
    status_label = serializers.CharField(source='get_to_status_display', read_only=True)

    class Meta:
        model = ClinicIntakeStatusHistory
        fields = [
            'id', 'from_status', 'to_status', 'status_label', 'changed_by_name',
            'reason', 'created_at',
        ]

    def get_changed_by_name(self, history):
        profile = history.changed_by
        if not profile or not profile.user:
            return None
        return profile.user.get_full_name() or profile.user.username


STUDENT_STATUS_MESSAGES = {
    ClinicIntake.Status.RECEPTION_INTAKE: 'Your clinic information is being recorded.',
    ClinicIntake.Status.SENT_TO_NURSE: 'Your information has been sent to the nurse.',
    ClinicIntake.Status.NURSE_REVIEW: 'The nurse is reviewing your clinic request.',
    ClinicIntake.Status.APPOINTMENT_SCHEDULED: 'Your doctor appointment has been scheduled.',
    ClinicIntake.Status.WAITING_FOR_DOCTOR: 'You are waiting for the assigned doctor.',
    ClinicIntake.Status.DOCTOR_CONFIRMED: 'The doctor has confirmed your appointment.',
    ClinicIntake.Status.IN_CONSULTATION: 'Your consultation is currently in progress.',
    ClinicIntake.Status.ATTENDED: 'You have been attended to.',
    ClinicIntake.Status.COMPLETED: 'This clinic visit has been completed.',
    ClinicIntake.Status.FOLLOW_UP_REQUIRED: 'A follow-up visit has been recommended.',
    ClinicIntake.Status.CANCELLED: 'This clinic request was cancelled.',
    ClinicIntake.Status.ARCHIVED: 'This clinic request has been archived.',
}


class ClinicIntakeSerializer(serializers.ModelSerializer):
    patient_detail = IntakePatientSerializer(source='patient', read_only=True)
    status_label = serializers.CharField(source='get_status_display', read_only=True)
    status_message = serializers.SerializerMethodField()
    assigned_doctor_name = serializers.SerializerMethodField()
    created_by_name = serializers.SerializerMethodField()
    reviewed_by_name = serializers.SerializerMethodField()
    history = IntakeHistorySerializer(source='status_history', many=True, read_only=True)
    appointment_detail = serializers.SerializerMethodField()
    visit_id = serializers.SerializerMethodField()
    approved_summary = serializers.SerializerMethodField()
    approved_prescriptions = serializers.SerializerMethodField()

    class Meta:
        model = ClinicIntake
        fields = [
            'id', 'uuid', 'patient', 'patient_detail', 'reason_for_visit',
            'presenting_complaint', 'priority', 'status', 'status_label',
            'status_message', 'assigned_doctor', 'assigned_doctor_name',
            'created_by_name', 'reviewed_by_name', 'scheduling_note',
            'follow_up_instructions', 'archive_reason', 'submitted_at',
            'reviewed_at', 'scheduled_at', 'confirmed_at',
            'consultation_started_at', 'attended_at', 'completed_at',
            'archived_at', 'created_at', 'updated_at', 'history',
            'appointment_detail', 'visit_id', 'approved_summary',
            'approved_prescriptions', 'is_demo',
        ]
        read_only_fields = [
            'id', 'uuid', 'status', 'assigned_doctor', 'created_by_name',
            'reviewed_by_name', 'scheduling_note', 'follow_up_instructions',
            'archive_reason', 'submitted_at', 'reviewed_at', 'scheduled_at',
            'confirmed_at', 'consultation_started_at', 'attended_at',
            'completed_at', 'archived_at', 'created_at', 'updated_at', 'is_demo',
        ]

    def validate(self, attrs):
        patient = attrs.get('patient')
        if patient and not patient.is_active:
            raise serializers.ValidationError({'patient': 'Archived patients cannot receive new intakes.'})
        if self.instance is None and patient:
            active_statuses = set(ClinicIntake.Status.values) - {
                ClinicIntake.Status.COMPLETED,
                ClinicIntake.Status.FOLLOW_UP_REQUIRED,
                ClinicIntake.Status.CANCELLED,
                ClinicIntake.Status.ARCHIVED,
            }
            if ClinicIntake.objects.filter(
                patient=patient, status__in=active_statuses
            ).exists():
                raise serializers.ValidationError({
                    'patient': 'This student already has an active clinic intake.'
                })
        return attrs

    def to_representation(self, instance):
        data = super().to_representation(instance)
        request = self.context.get('request')
        profile = getattr(getattr(request, 'user', None), 'user', None)
        if profile and profile.role == Role.ROLE_PATIENT:
            for field in ('scheduling_note', 'archive_reason', 'created_by_name', 'reviewed_by_name'):
                data.pop(field, None)
        return data

    def get_status_message(self, intake):
        return STUDENT_STATUS_MESSAGES.get(intake.status, intake.get_status_display())

    def get_assigned_doctor_name(self, intake):
        return AppointmentSerializer._profile_name(intake.assigned_doctor)

    def get_created_by_name(self, intake):
        return AppointmentSerializer._profile_name(intake.created_by)

    def get_reviewed_by_name(self, intake):
        return AppointmentSerializer._profile_name(intake.reviewed_by)

    def get_appointment_detail(self, intake):
        try:
            appointment = intake.appointment
        except Appointment.DoesNotExist:
            return None
        return AppointmentSerializer(appointment, context=self.context).data

    def _visit(self, intake):
        try:
            return intake.appointment.visit
        except (ObjectDoesNotExist, AttributeError):
            return None

    def get_visit_id(self, intake):
        visit = self._visit(intake)
        return visit.pk if visit else None

    def get_approved_summary(self, intake):
        visit = self._visit(intake)
        return visit.clinical_summary if visit and visit.status == 'completed' else ''

    def get_approved_prescriptions(self, intake):
        visit = self._visit(intake)
        if not visit or visit.status != 'completed':
            return []
        return [
            {
                'id': prescription.pk,
                'prescribed_at': prescription.prescribed_at,
                'items': [
                    {
                        'medication': str(item.medication),
                        'dose': item.dose,
                        'route': item.route,
                        'frequency': item.frequency,
                        'duration': item.duration,
                        'instructions': item.instructions,
                    }
                    for item in prescription.items.all()
                ],
            }
            for prescription in visit.prescriptions.prefetch_related('items__medication')
        ]


class IntakeScheduleSerializer(serializers.Serializer):
    assigned_doctor = serializers.PrimaryKeyRelatedField(
        queryset=Profile.objects.select_related('user').filter(user__is_active=True)
    )
    scheduled_for = serializers.DateTimeField()
    scheduling_note = serializers.CharField(
        max_length=2000, required=False, allow_blank=True
    )


class IntakeCompletionSerializer(serializers.Serializer):
    summary = serializers.CharField(max_length=5000)
    follow_up_instructions = serializers.CharField(
        max_length=3000, required=False, allow_blank=True
    )


class IntakeDoctorSerializer(serializers.Serializer):
    assigned_doctor = serializers.PrimaryKeyRelatedField(
        queryset=Profile.objects.select_related('user').filter(user__is_active=True)
    )
    reason = serializers.CharField(max_length=500)


class IntakeReasonSerializer(serializers.Serializer):
    reason = serializers.CharField(max_length=500)


class IntakeCorrectionSerializer(IntakeReasonSerializer):
    target_status = serializers.ChoiceField(choices=[
        ClinicIntake.Status.NURSE_REVIEW,
        ClinicIntake.Status.WAITING_FOR_DOCTOR,
        ClinicIntake.Status.DOCTOR_CONFIRMED,
    ])


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
