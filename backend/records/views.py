import copy
import os
import shutil

from django.conf import settings
from django.db import transaction
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from patients.pagination import StandardResultsSetPagination
from users.models import Role
from users.permissions import (
    CanEditClinicalRecords,
    CanRecordVitals,
    CanWriteClinicalNotes,
    IsAdministrator,
    IsAuthenticatedClinicUser,
    IsClinicalStaff,
    IsDoctorOrAdmin,
)
from utils.handle_files_in_json import (
    find_and_replace_files_in_json,
    find_and_replace_url_in_json,
)
from .audit import log_action
from .filters import RecordFilter
from .models import (
    AuditLog,
    ClinicalNote,
    Diagnosis,
    ICDCode,
    Medication,
    Prescription,
    Record,
    RecordTemplate,
    Schema,
    Visit,
    VitalSign,
)
from .serializers import (
    AuditLogSerializer,
    ClinicalNoteSerializer,
    DiagnosisSerializer,
    ICDCodeSerializer,
    MedicationSerializer,
    PrescriptionSerializer,
    RecordSerializer,
    RecordTemplateListSerializer,
    RecordTemplateSerializer,
    SchemaDetailSerializer,
    SchemaListSerializer,
    VisitSerializer,
    VitalSignSerializer,
)


DATA_FORMAT = 'data:image/'
PREFIX = 'record-file'
FILE_DIRECTORY = 'files'


def _patient_profile(request):
    return getattr(request.user, 'user', None)


def _is_patient_request(request):
    profile = _patient_profile(request)
    return profile is not None and profile.role == Role.ROLE_PATIENT


class RecordViewSet(viewsets.ModelViewSet):
    serializer_class = RecordSerializer
    pagination_class = StandardResultsSetPagination
    filter_backends = (DjangoFilterBackend,)
    filterset_class = RecordFilter
    permission_classes = (IsAuthenticated, IsAuthenticatedClinicUser)
    file_path = os.path.join(settings.MEDIA_ROOT, FILE_DIRECTORY)

    def get_queryset(self):
        queryset = Record.objects.select_related(
            'patient', 'specialist__user', 'findings_schema'
        )
        if _is_patient_request(self.request):
            queryset = queryset.filter(patient__user=self.request.user)
        patient_id = self.request.query_params.get('patient_id')
        if patient_id:
            queryset = queryset.filter(patient_id=patient_id)
        return queryset

    def get_permissions(self):
        if self.action == 'destroy':
            return [IsAuthenticated(), IsAdministrator()]
        if self.action in {'create', 'update', 'partial_update', 'update_findings'}:
            return [IsAuthenticated(), CanEditClinicalRecords()]
        return super().get_permissions()

    def _store_embedded_files(self, record, findings):
        directory_path = os.path.join(self.file_path, str(record.pk))
        return find_and_replace_files_in_json(
            copy.deepcopy(findings), DATA_FORMAT, PREFIX, directory_path
        )

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        profile = _patient_profile(request)
        directory_path = None
        try:
            with transaction.atomic():
                record = serializer.save(specialist=profile)
                directory_path = os.path.join(self.file_path, str(record.pk))
                record.findings = self._store_embedded_files(
                    record, serializer.validated_data['findings']
                )
                record.save(update_fields=['findings', 'updated_at'])
        except Exception:
            if directory_path and os.path.isdir(directory_path):
                shutil.rmtree(directory_path)
            raise

        log_action(
            request=request,
            action='record_created',
            resource_type='Record',
            resource_id=record.pk,
            description='Dynamic clinical record created.',
        )
        output = self.get_serializer(record)
        return Response(output.data, status=status.HTTP_201_CREATED)

    def perform_update(self, serializer):
        record = serializer.save()
        if 'findings' in serializer.validated_data:
            record.findings = self._store_embedded_files(
                record, serializer.validated_data['findings']
            )
            record.save(update_fields=['findings', 'updated_at'])
        log_action(
            request=self.request,
            action='record_updated',
            resource_type='Record',
            resource_id=record.pk,
            description='Dynamic clinical record updated.',
        )

    @action(detail=True, methods=['post'])
    def update_findings(self, request, pk=None):
        record = self.get_object()
        serializer = self.get_serializer(
            record, data={'findings': request.data.get('findings')}, partial=True
        )
        serializer.is_valid(raise_exception=True)
        self.perform_update(serializer)
        return Response(self.get_serializer(record).data)

    def retrieve(self, request, *args, **kwargs):
        record = self.get_object()
        data = dict(self.get_serializer(record).data)
        directory_path = os.path.join(self.file_path, str(record.pk))
        data['findings'] = find_and_replace_url_in_json(
            copy.deepcopy(data.get('findings', {})), PREFIX, directory_path
        )
        log_action(
            request=request,
            action='record_viewed',
            resource_type='Record',
            resource_id=record.pk,
            description='Clinical record viewed.',
        )
        return Response(data)

    def perform_destroy(self, instance):
        record_id = instance.pk
        directory_path = os.path.join(self.file_path, str(record_id))
        super().perform_destroy(instance)
        if os.path.isdir(directory_path):
            shutil.rmtree(directory_path)
        log_action(
            request=self.request,
            action='record_deleted',
            resource_type='Record',
            resource_id=record_id,
            description='Dynamic clinical record permanently deleted by an administrator.',
        )


class RecordTemplateViewSet(viewsets.ModelViewSet):
    queryset = RecordTemplate.objects.select_related('findings_schema', 'department')
    permission_classes = (IsAuthenticated, IsClinicalStaff)

    def get_permissions(self):
        if self.action not in {'list', 'retrieve'}:
            return [IsAuthenticated(), IsDoctorOrAdmin()]
        return super().get_permissions()

    def get_serializer_class(self):
        return (
            RecordTemplateListSerializer
            if self.action == 'list'
            else RecordTemplateSerializer
        )

    def get_queryset(self):
        queryset = super().get_queryset()
        schema_id = self.request.query_params.get('findings_schema')
        return queryset.filter(findings_schema_id=schema_id) if schema_id else queryset


class SchemaViewSet(viewsets.ModelViewSet):
    queryset = Schema.objects.select_related('department')
    permission_classes = (IsAuthenticated, IsClinicalStaff)

    def get_permissions(self):
        if self.action not in {'list', 'retrieve'}:
            return [IsAuthenticated(), IsDoctorOrAdmin()]
        return super().get_permissions()

    def get_serializer_class(self):
        return SchemaListSerializer if self.action == 'list' else SchemaDetailSerializer


class PatientOwnedClinicalViewSet(viewsets.ModelViewSet):
    permission_classes = (IsAuthenticated, IsAuthenticatedClinicUser)
    patient_lookup = 'visit__patient__user'

    def get_queryset(self):
        queryset = super().get_queryset()
        if _is_patient_request(self.request):
            queryset = queryset.filter(**{self.patient_lookup: self.request.user})
        patient_id = self.request.query_params.get('patient_id')
        if patient_id:
            lookup = self.patient_lookup.replace('__user', '')
            queryset = queryset.filter(**{f'{lookup}_id': patient_id})
        return queryset

    def audit(self, instance, verb):
        log_action(
            request=self.request,
            action=f'{instance._meta.model_name}_{verb}',
            resource_type=instance.__class__.__name__,
            resource_id=instance.pk,
            description=f'{instance.__class__.__name__} {verb}.',
        )


class VisitViewSet(PatientOwnedClinicalViewSet):
    queryset = Visit.objects.select_related(
        'patient', 'appointment', 'created_by__user'
    ).prefetch_related('vital_signs', 'diagnoses', 'clinical_notes', 'prescriptions')
    serializer_class = VisitSerializer
    patient_lookup = 'patient__user'

    def get_permissions(self):
        if self.action not in {'list', 'retrieve'}:
            return [IsAuthenticated(), CanEditClinicalRecords()]
        return super().get_permissions()

    def perform_create(self, serializer):
        visit = serializer.save(created_by=_patient_profile(self.request))
        self.audit(visit, 'created')

    def perform_update(self, serializer):
        visit = serializer.save()
        self.audit(visit, 'updated')


class VitalSignViewSet(PatientOwnedClinicalViewSet):
    queryset = VitalSign.objects.select_related('visit__patient', 'recorded_by__user')
    serializer_class = VitalSignSerializer

    def get_permissions(self):
        if self.action not in {'list', 'retrieve'}:
            return [IsAuthenticated(), CanRecordVitals()]
        return super().get_permissions()

    def perform_create(self, serializer):
        vital_sign = serializer.save(recorded_by=_patient_profile(self.request))
        self.audit(vital_sign, 'created')


class ClinicalNoteViewSet(PatientOwnedClinicalViewSet):
    queryset = ClinicalNote.objects.select_related('visit__patient', 'author__user')
    serializer_class = ClinicalNoteSerializer

    def get_permissions(self):
        if self.action not in {'list', 'retrieve'}:
            return [IsAuthenticated(), CanWriteClinicalNotes()]
        return super().get_permissions()

    def perform_create(self, serializer):
        note = serializer.save(author=_patient_profile(self.request))
        self.audit(note, 'created')


class DiagnosisViewSet(PatientOwnedClinicalViewSet):
    queryset = Diagnosis.objects.select_related(
        'visit__patient', 'icd_code', 'diagnosed_by__user'
    )
    serializer_class = DiagnosisSerializer

    def get_permissions(self):
        if self.action not in {'list', 'retrieve'}:
            return [IsAuthenticated(), CanEditClinicalRecords()]
        return super().get_permissions()

    def perform_create(self, serializer):
        diagnosis = serializer.save(diagnosed_by=_patient_profile(self.request))
        self.audit(diagnosis, 'created')


class PrescriptionViewSet(PatientOwnedClinicalViewSet):
    queryset = Prescription.objects.select_related(
        'patient', 'visit', 'prescribed_by__user'
    ).prefetch_related('items__medication')
    serializer_class = PrescriptionSerializer
    patient_lookup = 'patient__user'

    def get_permissions(self):
        if self.action not in {'list', 'retrieve'}:
            return [IsAuthenticated(), CanEditClinicalRecords()]
        return super().get_permissions()

    def perform_create(self, serializer):
        prescription = serializer.save(prescribed_by=_patient_profile(self.request))
        self.audit(prescription, 'created')


class MedicationViewSet(viewsets.ModelViewSet):
    queryset = Medication.objects.all().order_by('name', 'strength')
    serializer_class = MedicationSerializer
    permission_classes = (IsAuthenticated, IsClinicalStaff)

    def get_permissions(self):
        if self.action not in {'list', 'retrieve'}:
            return [IsAuthenticated(), IsDoctorOrAdmin()]
        return super().get_permissions()


class ICDCodeViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = ICDCode.objects.all().order_by('code')
    serializer_class = ICDCodeSerializer
    permission_classes = (IsAuthenticated,)
    search_fields = ('code', 'title', 'chapter')


class AuditLogViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = AuditLog.objects.select_related('user')
    serializer_class = AuditLogSerializer
    permission_classes = (IsAuthenticated, IsAdministrator)
    pagination_class = StandardResultsSetPagination
    filterset_fields = ('action', 'resource_type', 'success', 'user')
