from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import PermissionDenied, ValidationError

from records.audit import log_action
from records.models import Visit
from users.models import Role
from .models import Appointment, ClinicIntake, ClinicIntakeStatusHistory


TRANSITIONS = {
    'submit': ({ClinicIntake.Status.RECEPTION_INTAKE}, ClinicIntake.Status.SENT_TO_NURSE),
    'begin_review': ({ClinicIntake.Status.SENT_TO_NURSE}, ClinicIntake.Status.NURSE_REVIEW),
    'confirm': ({ClinicIntake.Status.WAITING_FOR_DOCTOR}, ClinicIntake.Status.DOCTOR_CONFIRMED),
    'start': ({ClinicIntake.Status.DOCTOR_CONFIRMED}, ClinicIntake.Status.IN_CONSULTATION),
    'attend': ({ClinicIntake.Status.IN_CONSULTATION}, ClinicIntake.Status.ATTENDED),
}


def _profile(request):
    return getattr(request.user, 'user', None)


def _doctor_can_act(intake, profile):
    return profile and (
        profile.role == Role.ROLE_ADMIN or intake.assigned_doctor_id == profile.id
    )


def _record_transition(intake, actor, previous, target, reason='', metadata=None):
    ClinicIntakeStatusHistory.objects.create(
        intake=intake,
        from_status=previous,
        to_status=target,
        changed_by=actor,
        reason=reason,
        metadata=metadata or {},
    )


def _audit(request, intake, action, previous, target, reason=''):
    log_action(
        request=request,
        action=f'intake_{action}',
        resource_type='ClinicIntake',
        resource_id=intake.pk,
        description=f'Clinic intake moved from {previous or "created"} to {target}.',
        metadata={'from_status': previous, 'to_status': target, 'reason': reason},
    )


@transaction.atomic
def create_intake(*, serializer, request):
    actor = _profile(request)
    patient = serializer.validated_data['patient']
    intake = serializer.save(created_by=actor, is_demo=patient.is_demo)
    _record_transition(
        intake, actor, '', ClinicIntake.Status.RECEPTION_INTAKE,
        metadata={'priority': intake.priority},
    )
    _audit(request, intake, 'created', '', intake.status)
    return intake


@transaction.atomic
def transition_intake(*, intake, action, request, reason=''):
    intake = ClinicIntake.objects.select_for_update().get(pk=intake.pk)
    actor = _profile(request)
    allowed, target = TRANSITIONS[action]
    if intake.status not in allowed:
        raise ValidationError({
            'status': f'{action.replace("_", " ").title()} is not valid from {intake.get_status_display()}.'
        })
    if action in {'confirm', 'start', 'attend'} and not _doctor_can_act(intake, actor):
        raise PermissionDenied('Only the assigned doctor or Doctor-in-Charge may perform this action.')

    previous = intake.status
    intake.status = target
    now = timezone.now()
    timestamp_fields = {
        'submit': 'submitted_at', 'begin_review': 'reviewed_at',
        'confirm': 'confirmed_at', 'start': 'consultation_started_at',
        'attend': 'attended_at',
    }
    setattr(intake, timestamp_fields[action], now)
    update_fields = ['status', timestamp_fields[action], 'updated_at']
    if action == 'begin_review':
        intake.reviewed_by = actor
        update_fields.append('reviewed_by')
    intake.save(update_fields=update_fields)
    appointment = getattr(intake, 'appointment', None)
    if appointment and action == 'confirm':
        appointment.status = Appointment.Status.CONFIRMED
        appointment.save(update_fields=['status', 'updated_at'])
    elif appointment and action == 'attend':
        appointment.status = Appointment.Status.ATTENDED
        appointment.save(update_fields=['status', 'updated_at'])
    _record_transition(intake, actor, previous, target, reason)
    _audit(request, intake, action, previous, target, reason)
    return intake


@transaction.atomic
def schedule_intake(*, intake, request, doctor, scheduled_for, scheduling_note=''):
    intake = ClinicIntake.objects.select_for_update().get(pk=intake.pk)
    actor = _profile(request)
    if intake.status != ClinicIntake.Status.NURSE_REVIEW:
        raise ValidationError({'status': 'Scheduling is available only while the nurse is reviewing the intake.'})
    if doctor.role not in {Role.ROLE_DOCTOR, Role.ROLE_ADMIN} or not doctor.user.is_active:
        raise ValidationError({'assigned_doctor': 'Select an active doctor.'})
    if scheduled_for <= timezone.now():
        raise ValidationError({'scheduled_for': 'The appointment must be scheduled in the future.'})
    if Appointment.objects.filter(
        patient=intake.patient,
        scheduled_for=scheduled_for,
    ).exclude(status=Appointment.Status.CANCELLED).exists():
        raise ValidationError({'scheduled_for': 'This patient already has an appointment at this time.'})
    if Appointment.objects.filter(
        assigned_doctor=doctor,
        scheduled_for=scheduled_for,
    ).exclude(status=Appointment.Status.CANCELLED).exists():
        raise ValidationError({'scheduled_for': 'The selected doctor already has an appointment at this time.'})

    appointment = Appointment.objects.create(
        patient=intake.patient,
        intake=intake,
        scheduled_for=scheduled_for,
        reason=intake.reason_for_visit,
        notes=scheduling_note,
        status=Appointment.Status.SCHEDULED,
        booked_by=actor,
        scheduled_by=actor,
        assigned_doctor=doctor,
        attended_by=doctor,
    )
    previous = intake.status
    intake.status = ClinicIntake.Status.WAITING_FOR_DOCTOR
    intake.assigned_doctor = doctor
    intake.scheduling_note = scheduling_note
    intake.scheduled_at = timezone.now()
    intake.save(update_fields=[
        'status', 'assigned_doctor', 'scheduling_note', 'scheduled_at', 'updated_at'
    ])
    _record_transition(
        intake, actor, previous, ClinicIntake.Status.APPOINTMENT_SCHEDULED,
        metadata={'appointment_id': appointment.pk, 'doctor_id': doctor.pk},
    )
    _record_transition(
        intake, actor, ClinicIntake.Status.APPOINTMENT_SCHEDULED,
        ClinicIntake.Status.WAITING_FOR_DOCTOR,
        metadata={'appointment_id': appointment.pk},
    )
    _audit(
        request, intake, 'scheduled', previous,
        ClinicIntake.Status.WAITING_FOR_DOCTOR,
    )
    return intake


@transaction.atomic
def start_consultation(*, intake, request):
    intake = transition_intake(intake=intake, action='start', request=request)
    appointment = intake.appointment
    appointment.status = Appointment.Status.IN_CONSULTATION
    appointment.save(update_fields=['status', 'updated_at'])
    visit, _ = Visit.objects.get_or_create(
        appointment=appointment,
        defaults={
            'patient': intake.patient,
            'visit_date': timezone.now(),
            'visit_type': 'outpatient',
            'chief_complaint': intake.presenting_complaint,
            'created_by': _profile(request),
        },
    )
    return intake, visit


@transaction.atomic
def complete_consultation(*, intake, request, summary, follow_up_instructions=''):
    intake = ClinicIntake.objects.select_for_update().get(pk=intake.pk)
    actor = _profile(request)
    if intake.status not in {
        ClinicIntake.Status.IN_CONSULTATION, ClinicIntake.Status.ATTENDED,
    }:
        raise ValidationError({'status': 'Only an active consultation can be completed.'})
    if not _doctor_can_act(intake, actor):
        raise PermissionDenied('Only the assigned doctor or Doctor-in-Charge may complete this consultation.')
    try:
        visit = intake.appointment.visit
    except (Appointment.DoesNotExist, Visit.DoesNotExist):
        raise ValidationError({'visit': 'Start the consultation before completing it.'})

    previous = intake.status
    target = (
        ClinicIntake.Status.FOLLOW_UP_REQUIRED
        if follow_up_instructions else ClinicIntake.Status.COMPLETED
    )
    visit.clinical_summary = summary
    visit.status = Visit.Status.COMPLETED
    visit.save(update_fields=['clinical_summary', 'status', 'updated_at'])
    appointment = intake.appointment
    appointment.status = Appointment.Status.COMPLETED
    appointment.save(update_fields=['status', 'updated_at'])
    intake.status = target
    intake.follow_up_instructions = follow_up_instructions
    intake.attended_at = intake.attended_at or timezone.now()
    intake.completed_at = timezone.now()
    intake.save(update_fields=[
        'status', 'follow_up_instructions', 'attended_at', 'completed_at', 'updated_at'
    ])
    if previous == ClinicIntake.Status.IN_CONSULTATION:
        _record_transition(intake, actor, previous, ClinicIntake.Status.ATTENDED)
        previous = ClinicIntake.Status.ATTENDED
    _record_transition(intake, actor, previous, target)
    _audit(request, intake, 'completed', previous, target)
    return intake


@transaction.atomic
def reassign_intake(*, intake, request, doctor, reason):
    intake = ClinicIntake.objects.select_for_update().get(pk=intake.pk)
    if intake.status in {
        ClinicIntake.Status.COMPLETED, ClinicIntake.Status.FOLLOW_UP_REQUIRED,
        ClinicIntake.Status.CANCELLED, ClinicIntake.Status.ARCHIVED,
    }:
        raise ValidationError({'status': 'A terminal intake requires an audited correction before reassignment.'})
    if doctor.role not in {Role.ROLE_DOCTOR, Role.ROLE_ADMIN} or not doctor.user.is_active:
        raise ValidationError({'assigned_doctor': 'Select an active doctor.'})
    if not reason.strip():
        raise ValidationError({'reason': 'A reassignment reason is required.'})
    previous_doctor = intake.assigned_doctor_id
    intake.assigned_doctor = doctor
    intake.save(update_fields=['assigned_doctor', 'updated_at'])
    appointment = getattr(intake, 'appointment', None)
    if appointment:
        appointment.assigned_doctor = doctor
        appointment.attended_by = doctor
        appointment.save(update_fields=['assigned_doctor', 'attended_by', 'updated_at'])
    _record_transition(
        intake, _profile(request), intake.status, intake.status, reason,
        {'previous_doctor_id': previous_doctor, 'doctor_id': doctor.pk},
    )
    _audit(request, intake, 'reassigned', intake.status, intake.status, reason)
    return intake


@transaction.atomic
def archive_intake(*, intake, request, reason):
    intake = ClinicIntake.objects.select_for_update().get(pk=intake.pk)
    if not reason.strip():
        raise ValidationError({'reason': 'An archive reason is required.'})
    if intake.status == ClinicIntake.Status.ARCHIVED:
        raise ValidationError({'status': 'This intake is already archived.'})
    previous = intake.status
    intake.status = ClinicIntake.Status.ARCHIVED
    intake.archive_reason = reason.strip()
    intake.archived_by = _profile(request)
    intake.archived_at = timezone.now()
    intake.save(update_fields=[
        'status', 'archive_reason', 'archived_by', 'archived_at', 'updated_at'
    ])
    _record_transition(intake, _profile(request), previous, intake.status, reason)
    _audit(request, intake, 'archived', previous, intake.status, reason)
    return intake


@transaction.atomic
def correct_intake(*, intake, request, target_status, reason):
    intake = ClinicIntake.objects.select_for_update().get(pk=intake.pk)
    permitted_targets = {
        ClinicIntake.Status.NURSE_REVIEW,
        ClinicIntake.Status.WAITING_FOR_DOCTOR,
        ClinicIntake.Status.DOCTOR_CONFIRMED,
    }
    if target_status not in permitted_targets:
        raise ValidationError({'target_status': 'Select an approved correction state.'})
    if not reason.strip():
        raise ValidationError({'reason': 'A correction reason is required.'})
    previous = intake.status
    intake.status = target_status
    intake.save(update_fields=['status', 'updated_at'])
    _record_transition(intake, _profile(request), previous, target_status, reason)
    _audit(request, intake, 'corrected', previous, target_status, reason)
    return intake


@transaction.atomic
def reschedule_intake(*, intake, request, doctor, scheduled_for, reason):
    intake = ClinicIntake.objects.select_for_update().get(pk=intake.pk)
    if intake.status not in {
        ClinicIntake.Status.APPOINTMENT_SCHEDULED,
        ClinicIntake.Status.WAITING_FOR_DOCTOR,
        ClinicIntake.Status.DOCTOR_CONFIRMED,
    }:
        raise ValidationError({'status': 'This intake cannot be rescheduled at its current stage.'})
    if not reason.strip():
        raise ValidationError({'reason': 'A rescheduling reason is required.'})
    if scheduled_for <= timezone.now():
        raise ValidationError({'scheduled_for': 'The appointment must be scheduled in the future.'})
    if doctor.role not in {Role.ROLE_DOCTOR, Role.ROLE_ADMIN} or not doctor.user.is_active:
        raise ValidationError({'assigned_doctor': 'Select an active doctor.'})
    try:
        appointment = intake.appointment
    except Appointment.DoesNotExist:
        raise ValidationError({'appointment': 'This intake has no appointment to reschedule.'})
    if Appointment.objects.filter(
        assigned_doctor=doctor, scheduled_for=scheduled_for,
    ).exclude(pk=appointment.pk).exclude(status=Appointment.Status.CANCELLED).exists():
        raise ValidationError({'scheduled_for': 'The selected doctor already has an appointment at this time.'})
    if Appointment.objects.filter(
        patient=intake.patient, scheduled_for=scheduled_for,
    ).exclude(pk=appointment.pk).exclude(status=Appointment.Status.CANCELLED).exists():
        raise ValidationError({'scheduled_for': 'This patient already has an appointment at this time.'})

    previous = intake.status
    appointment.scheduled_for = scheduled_for
    appointment.assigned_doctor = doctor
    appointment.attended_by = doctor
    appointment.scheduled_by = _profile(request)
    appointment.status = Appointment.Status.SCHEDULED
    appointment.notes = reason.strip()
    appointment.save(update_fields=[
        'scheduled_for', 'assigned_doctor', 'attended_by', 'scheduled_by',
        'status', 'notes', 'updated_at',
    ])
    intake.assigned_doctor = doctor
    intake.status = ClinicIntake.Status.WAITING_FOR_DOCTOR
    intake.scheduling_note = reason.strip()
    intake.scheduled_at = timezone.now()
    intake.save(update_fields=[
        'assigned_doctor', 'status', 'scheduling_note', 'scheduled_at', 'updated_at'
    ])
    _record_transition(
        intake, _profile(request), previous, intake.status, reason,
        {'appointment_id': appointment.pk, 'doctor_id': doctor.pk},
    )
    _audit(request, intake, 'rescheduled', previous, intake.status, reason)
    return intake


@transaction.atomic
def cancel_intake(*, intake, request, reason):
    intake = ClinicIntake.objects.select_for_update().get(pk=intake.pk)
    if intake.status in {
        ClinicIntake.Status.IN_CONSULTATION, ClinicIntake.Status.ATTENDED,
        ClinicIntake.Status.COMPLETED, ClinicIntake.Status.FOLLOW_UP_REQUIRED,
        ClinicIntake.Status.ARCHIVED,
    }:
        raise ValidationError({'status': 'This intake cannot be cancelled at its current stage.'})
    if not reason.strip():
        raise ValidationError({'reason': 'A cancellation reason is required.'})
    previous = intake.status
    intake.status = ClinicIntake.Status.CANCELLED
    intake.save(update_fields=['status', 'updated_at'])
    appointment = getattr(intake, 'appointment', None)
    if appointment:
        appointment.status = Appointment.Status.CANCELLED
        appointment.notes = reason.strip()
        appointment.save(update_fields=['status', 'notes', 'updated_at'])
    _record_transition(intake, _profile(request), previous, intake.status, reason)
    _audit(request, intake, 'cancelled', previous, intake.status, reason)
    return intake
