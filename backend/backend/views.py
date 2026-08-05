from django.utils import timezone
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from patients.models import Appointment, Patient
from records.models import Record, Visit
from users.models import Role
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
    records = Record.objects.all()
    visits = Visit.objects.all()

    if is_patient:
        patients = patients.filter(user=request.user)
        appointments = appointments.filter(patient__user=request.user)
        records = records.filter(patient__user=request.user)
        visits = visits.filter(patient__user=request.user)

    return Response({
        'patients': patients.count(),
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
        'role': profile.get_role_display() if profile else 'administrator',
    })
