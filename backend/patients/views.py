from rest_framework import viewsets, status
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.filters import OrderingFilter, SearchFilter
from django.core.files.storage import default_storage
from rest_framework.decorators import action
from django.utils.dateparse import parse_datetime
from django.utils import timezone
from .models import Appointment, Patient
from .serializers import (
    AppointmentSerializer,
    AppointmentStatusSerializer,
    PatientSerializer,
)
from .pagination import StandardResultsSetPagination
from .filters import PatientFilter
from users.permissions import (
    CanManageAppointments,
    CanManagePatients,
    CanUpdateAppointmentStatus,
    IsAuthenticatedClinicUser,
    IsAdministrator,
)
from records.audit import log_action


class AppointmentViewSet(viewsets.ModelViewSet):
    queryset = Appointment.objects.select_related('patient', 'booked_by', 'attended_by')
    serializer_class = AppointmentSerializer
    permission_classes = (IsAuthenticated, IsAuthenticatedClinicUser)
    pagination_class = StandardResultsSetPagination
    filter_backends = (DjangoFilterBackend, SearchFilter, OrderingFilter)
    filterset_fields = ('patient', 'status', 'attended_by')
    search_fields = (
        'patient__matric_number', 'patient__first_name', 'patient__last_name',
        'reason', 'notes',
    )
    ordering_fields = ('scheduled_for', 'status', 'created_at')

    def get_queryset(self):
        queryset = super().get_queryset()
        profile = getattr(self.request.user, 'user', None)
        if profile and profile.role == 'PT':
            queryset = queryset.filter(patient__user=self.request.user)

        start = self.request.query_params.get('start')
        end = self.request.query_params.get('end')

        if start:
            start_datetime = parse_datetime(start)
            if start_datetime:
                queryset = queryset.filter(scheduled_for__gte=start_datetime)

        if end:
            end_datetime = parse_datetime(end)
            if end_datetime:
                queryset = queryset.filter(scheduled_for__lt=end_datetime)

        return queryset

    def get_permissions(self):
        if self.action in {
            'create', 'update', 'partial_update', 'destroy', 'cancel'
        }:
            return [IsAuthenticated(), CanManageAppointments()]
        if self.action == 'set_status':
            return [IsAuthenticated(), CanUpdateAppointmentStatus()]
        return super().get_permissions()

    def perform_create(self, serializer):
        profile = getattr(self.request.user, 'user', None)
        appointment = serializer.save(booked_by=profile)
        log_action(
            request=self.request,
            action='appointment_created',
            resource_type='Appointment',
            resource_id=appointment.pk,
            description='Appointment created.',
        )

    def perform_update(self, serializer):
        appointment = serializer.save()
        log_action(
            request=self.request,
            action='appointment_updated',
            resource_type='Appointment',
            resource_id=appointment.pk,
            description='Appointment updated.',
        )

    def perform_destroy(self, instance):
        appointment_id = instance.pk
        super().perform_destroy(instance)
        log_action(
            request=self.request,
            action='appointment_deleted',
            resource_type='Appointment',
            resource_id=appointment_id,
            description='Appointment permanently deleted by an authorized user.',
        )

    @action(detail=True, methods=['post'])
    def cancel(self, request, pk=None):
        appointment = self.get_object()
        appointment.status = Appointment.Status.CANCELLED
        appointment.save(update_fields=['status', 'updated_at'])
        log_action(
            request=request,
            action='appointment_cancelled',
            resource_type='Appointment',
            resource_id=appointment.pk,
            description='Appointment cancelled.',
        )
        return Response(self.get_serializer(appointment).data)

    @action(detail=True, methods=['patch'], url_path='status')
    def set_status(self, request, pk=None):
        appointment = self.get_object()
        serializer = AppointmentStatusSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        appointment.status = serializer.validated_data['status']
        appointment.save(update_fields=['status', 'updated_at'])
        log_action(
            request=request,
            action='appointment_status_changed',
            resource_type='Appointment',
            resource_id=appointment.pk,
            description='Appointment status changed.',
            metadata={'status': appointment.status},
        )
        return Response(self.get_serializer(appointment).data)


class PatientViewSet(viewsets.ModelViewSet):
    queryset = Patient.objects.all()
    serializer_class = PatientSerializer
    pagination_class = StandardResultsSetPagination
    filter_backends = (DjangoFilterBackend,)
    filterset_class = PatientFilter
    permission_classes = (IsAuthenticated, IsAuthenticatedClinicUser)

    def get_queryset(self):
        queryset = super().get_queryset()
        if self.request.query_params.get('include_archived') != 'true':
            queryset = queryset.filter(is_active=True)
        profile = getattr(self.request.user, 'user', None)
        if profile and profile.role == 'PT':
            return queryset.filter(user=self.request.user)
        return queryset

    def get_permissions(self):
        if self.action in {'create', 'update', 'partial_update', 'delete_photo'}:
            return [IsAuthenticated(), CanManagePatients()]
        if self.action in {'archive', 'destroy'}:
            return [IsAuthenticated(), IsAdministrator()]
        return super().get_permissions()

    def perform_create(self, serializer):
        patient = serializer.save(
            created_by=self.request.user,
            updated_by=self.request.user,
        )
        log_action(
            request=self.request,
            action='patient_created',
            resource_type='Patient',
            resource_id=patient.pk,
            description='Patient registered.',
        )

    def perform_update(self, serializer):
        patient = serializer.save(updated_by=self.request.user)
        log_action(
            request=self.request,
            action='patient_updated',
            resource_type='Patient',
            resource_id=patient.pk,
            description='Patient demographics updated.',
        )

    @action(detail=True, methods=['post'])
    def archive(self, request, pk=None):
        patient = self.get_object()
        reason = str(request.data.get('reason', '')).strip()
        if not reason:
            return Response(
                {'reason': ['An archive reason is required.']},
                status=status.HTTP_400_BAD_REQUEST,
            )
        patient.is_active = False
        patient.archived_at = timezone.now()
        patient.archived_by = request.user
        patient.archive_reason = reason
        patient.updated_by = request.user
        patient.save(update_fields=[
            'is_active', 'archived_at', 'archived_by', 'archive_reason',
            'updated_by', 'updated_at',
        ])
        log_action(
            request=request,
            action='patient_archived',
            resource_type='Patient',
            resource_id=patient.pk,
            description='Patient archived.',
            metadata={'reason': reason},
        )
        return Response(self.get_serializer(patient).data)

    def perform_destroy(self, instance):
        patient_id = instance.pk
        super().perform_destroy(instance)
        log_action(
            request=self.request,
            action='patient_deleted',
            resource_type='Patient',
            resource_id=patient_id,
            description='Patient permanently deleted by an administrator.',
        )

    @action(detail=True, methods=['delete'])
    def delete_photo(self, request, pk=None):
        patient = self.get_object()
        if patient.photo:
            if default_storage.exists(patient.photo.name):
                default_storage.delete(patient.photo.name)
                if default_storage.exists(patient.photo.name):
                    return Response(
                        {'detail': 'Failed to delete photo'},
                        status=status.HTTP_500_INTERNAL_SERVER_ERROR
                        )
            patient.photo = None
            patient.save()
            log_action(
                request=request,
                action='patient_photo_deleted',
                resource_type='Patient',
                resource_id=patient.pk,
                description='Patient photograph removed.',
            )
        return Response(status=status.HTTP_204_NO_CONTENT)
