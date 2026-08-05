from rest_framework import viewsets, status
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django_filters.rest_framework import DjangoFilterBackend
from django.core.files.storage import default_storage
from rest_framework.decorators import action
from django.utils.dateparse import parse_datetime
from .models import Appointment, Patient
from .serializers import AppointmentSerializer, PatientSerializer
from .pagination import StandardResultsSetPagination
from .filters import PatientFilter
from users.permissions import (
    IsAuthenticatedClinicUser,
    IsNurseReceptionistOrAdmin,
)


class AppointmentViewSet(viewsets.ModelViewSet):
    queryset = Appointment.objects.select_related('patient', 'booked_by', 'attended_by')
    serializer_class = AppointmentSerializer
    permission_classes = (IsAuthenticated, IsAuthenticatedClinicUser)
    pagination_class = StandardResultsSetPagination
    filter_backends = (DjangoFilterBackend,)

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
                queryset = queryset.filter(scheduled_for__lte=end_datetime)

        return queryset

    def get_permissions(self):
        if self.action in {'create', 'update', 'partial_update', 'destroy'}:
            return [IsAuthenticated(), IsNurseReceptionistOrAdmin()]
        return super().get_permissions()

    def perform_create(self, serializer):
        profile = getattr(self.request.user, 'user', None)
        serializer.save(booked_by=profile)


class PatientViewSet(viewsets.ModelViewSet):
    queryset = Patient.objects.all()
    serializer_class = PatientSerializer
    pagination_class = StandardResultsSetPagination
    filter_backends = (DjangoFilterBackend,)
    filterset_class = PatientFilter
    permission_classes = (IsAuthenticated, IsAuthenticatedClinicUser)

    def get_queryset(self):
        queryset = super().get_queryset()
        profile = getattr(self.request.user, 'user', None)
        if profile and profile.role == 'PT':
            return queryset.filter(user=self.request.user)
        return queryset

    def get_permissions(self):
        if self.action in {'create', 'update', 'partial_update', 'destroy', 'delete_photo'}:
            return [IsAuthenticated(), IsNurseReceptionistOrAdmin()]
        return super().get_permissions()

    @action(detail=True, methods=['delete'])
    def delete_photo(self, request, pk=None):
        patient = self.get_object()
        print(patient.photo)
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
        return Response(status=status.HTTP_204_NO_CONTENT)
