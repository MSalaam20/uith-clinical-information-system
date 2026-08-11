from django.conf import settings
from django.http import JsonResponse
from django.utils import timezone
from django.db.models import Q
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from patients.models import Appointment, ClinicIntake, Patient
from records.models import AuditLog, Diagnosis, Record, Visit, VitalSign
from users.models import Profile, Role
from users.capabilities import role_configuration
from users.permissions import IsAuthenticatedClinicUser


ICD11_TERMS = [
    {
        'code': '1A00',
        'title': 'Cholera',
        'chapter': 'Certain infectious or parasitic diseases',
    },
    {
        'code': '1A40',
        'title': 'Malaria',
        'chapter': 'Certain infectious or parasitic diseases',
    },
    {
        'code': '5A11',
        'title': 'Type 2 diabetes mellitus',
        'chapter': 'Endocrine, nutritional or metabolic diseases',
    },
    {
        'code': 'BA00',
        'title': 'Essential hypertension',
        'chapter': 'Diseases of the circulatory system',
    },
    {
        'code': 'CA23',
        'title': 'Acute upper respiratory infection',
        'chapter': 'Diseases of the respiratory system',
    },
    {
        'code': 'MG30',
        'title': 'Acute pain',
        'chapter': 'Symptoms, signs or clinical findings',
    },
    {
        'code': '9C83',
        'title': 'Headache',
        'chapter': 'Diseases of the nervous system',
    },
]


def health(request):
    return JsonResponse({'status': 'ok'})


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def icd11_search(request):
    query = request.query_params.get('q', '').strip().lower()

    if not query:
        return Response({'results': []})

    results = [
        term for term in ICD11_TERMS
        if query in term['code'].lower()
        or query in term['title'].lower()
        or query in term['chapter'].lower()
    ]

    return Response({
        'terminology': 'ICD-11',
        'source': 'curated local demonstration subset',
        'results': results,
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated, IsAuthenticatedClinicUser])
def dashboard_summary(request):
    today = timezone.localdate()
    profile = getattr(request.user, 'user', None)
    is_patient = profile is not None and profile.role == Role.ROLE_PATIENT

    patients = Patient.objects.filter(is_active=True)
    appointments = Appointment.objects.all()
    intakes = ClinicIntake.objects.all()
    records = Record.objects.all()
    visits = Visit.objects.all()

    if is_patient:
        patients = patients.filter(user=request.user)
        appointments = appointments.filter(patient__user=request.user)
        intakes = intakes.filter(patient__user=request.user)
        records = records.filter(patient__user=request.user)
        visits = visits.filter(patient__user=request.user)
    elif profile and profile.role == Role.ROLE_DOCTOR:
        appointments = appointments.filter(assigned_doctor=profile)
        intakes = intakes.filter(assigned_doctor=profile)
        patients = patients.filter(clinic_intakes__assigned_doctor=profile).distinct()
        visits = visits.filter(
            Q(appointment__intake__assigned_doctor=profile)
            | Q(appointment__assigned_doctor=profile)
            | Q(created_by=profile)
        ).distinct()
    elif profile and profile.role == Role.ROLE_NURSE:
        intakes = intakes.exclude(status=ClinicIntake.Status.RECEPTION_INTAKE)
    elif profile and profile.role == Role.ROLE_RECEPTIONIST:
        intakes = intakes.filter(created_by=profile)
        appointments = appointments.filter(booked_by=profile)
    elif profile and profile.role == Role.ROLE_COORDINATOR:
        intakes = intakes.none()
        appointments = appointments.none()

    recent_visits = visits.select_related('patient').order_by('-visit_date')[:5]
    recent_appointments = appointments.select_related('patient').order_by(
        '-scheduled_for'
    )[:5]
    is_admin = (
        request.user.is_staff
        or request.user.is_superuser
        or (profile and profile.role == Role.ROLE_ADMIN)
    )

    data = {
        'patients': patients.count(),
        'appointments': appointments.count(),
        'patients_registered_today': patients.filter(
            created_at__date=today
        ).count(),
        'appointments_today': appointments.filter(
            scheduled_for__date=today
        ).count(),
        'pending_appointments': appointments.filter(
            status=Appointment.Status.SCHEDULED
        ).count(),
        'records': records.count(),
        'visits': visits.count(),
        'open_visits': visits.filter(status=Visit.Status.OPEN).count(),
        'vital_signs_today': VitalSign.objects.filter(
            visit__in=visits, measured_at__date=today
        ).count(),
        'diagnoses_today': Diagnosis.objects.filter(
            visit__in=visits, created_at__date=today
        ).count(),
        'role': role_configuration(profile.role).get(
            'display_name', profile.get_role_display()
        ) if profile else 'Doctor-in-Charge / Clinic Administrator',
        'new_intakes': intakes.filter(
            status=ClinicIntake.Status.RECEPTION_INTAKE
        ).count(),
        'waiting_for_nurse': intakes.filter(
            status=ClinicIntake.Status.SENT_TO_NURSE
        ).count(),
        'under_review': intakes.filter(
            status=ClinicIntake.Status.NURSE_REVIEW
        ).count(),
        'appointments_scheduled': intakes.filter(status__in=[
            ClinicIntake.Status.APPOINTMENT_SCHEDULED,
            ClinicIntake.Status.WAITING_FOR_DOCTOR,
            ClinicIntake.Status.DOCTOR_CONFIRMED,
        ]).count(),
        'waiting_for_doctor': intakes.filter(
            status=ClinicIntake.Status.WAITING_FOR_DOCTOR
        ).count(),
        'doctor_confirmed': intakes.filter(
            status=ClinicIntake.Status.DOCTOR_CONFIRMED
        ).count(),
        'in_consultation': intakes.filter(
            status=ClinicIntake.Status.IN_CONSULTATION
        ).count(),
        'completed_today': intakes.filter(
            completed_at__date=today
        ).count(),
        'follow_ups': intakes.filter(
            status=ClinicIntake.Status.FOLLOW_UP_REQUIRED
        ).count(),
        'unassigned_cases': intakes.filter(
            assigned_doctor__isnull=True,
        ).exclude(status__in=[
            ClinicIntake.Status.RECEPTION_INTAKE,
            ClinicIntake.Status.CANCELLED,
            ClinicIntake.Status.ARCHIVED,
        ]).count(),
        'recent_intakes': [
            {
                'id': intake.pk,
                'patient_id': intake.patient_id,
                'patient_name': str(intake.patient),
                'reason_for_visit': intake.reason_for_visit,
                'status': intake.status,
                'status_label': intake.get_status_display(),
                'updated_at': intake.updated_at,
            }
            for intake in intakes.select_related('patient')[:5]
        ],
        'recent_visits': [
            {
                'id': visit.pk,
                'patient_id': visit.patient_id,
                'patient_name': str(visit.patient),
                'visit_date': visit.visit_date,
                'status': visit.status,
                'chief_complaint': visit.chief_complaint,
            }
            for visit in recent_visits
        ],
        'recent_appointments': [
            {
                'id': appointment.pk,
                'patient_id': appointment.patient_id,
                'patient_name': str(appointment.patient),
                'scheduled_for': appointment.scheduled_for,
                'status': appointment.status,
                'reason': appointment.reason,
            }
            for appointment in recent_appointments
        ],
    }
    if is_admin:
        data['total_staff'] = Profile.objects.exclude(
            role=Role.ROLE_PATIENT
        ).exclude(role=Role.ROLE_USER).count()
        data['active_doctors'] = Profile.objects.filter(
            role=Role.ROLE_DOCTOR, user__is_active=True
        ).count()
        data['active_nurses'] = Profile.objects.filter(
            role=Role.ROLE_NURSE, user__is_active=True
        ).count()
        data['active_receptionists'] = Profile.objects.filter(
            role=Role.ROLE_RECEPTIONIST, user__is_active=True
        ).count()
        data['recent_audit_activity'] = list(
            AuditLog.objects.values(
                'id', 'action', 'resource_type', 'success', 'timestamp'
            )[:5]
        )
        if settings.DEBUG or settings.SHOW_DEMO_CREDENTIALS:
            data['demo_data'] = {
                'enabled': True,
                'profiles': Profile.objects.filter(is_demo=True).count(),
                'patients': Patient.objects.filter(is_demo=True).count(),
                'intakes': ClinicIntake.objects.filter(is_demo=True).count(),
                'seed_command': 'python manage.py seed_demo_data',
                'archive_command': 'python manage.py archive_demo_data',
                'purge_requires_confirmation': True,
            }
    return Response(data)
