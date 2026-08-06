from rest_framework import viewsets, status
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.filters import OrderingFilter, SearchFilter
from django.core.files.storage import default_storage
from django.db.models import Q
from rest_framework.decorators import action
from django.utils.dateparse import parse_datetime
from django.utils import timezone
from .models import Appointment, ClinicIntake, Patient
from .serializers import (
    AppointmentSerializer,
    AppointmentStatusSerializer,
    ClinicIntakeSerializer,
    IntakeCompletionSerializer,
    IntakeCorrectionSerializer,
    IntakeDoctorSerializer,
    IntakeReasonSerializer,
    IntakeScheduleSerializer,
    PatientSerializer,
    PortalAccountStatusSerializer,
    StudentPortalAccountSerializer,
)
from .pagination import StandardResultsSetPagination
from .filters import PatientFilter
from users.permissions import (
    CanArchiveClinicalData,
    CanCompleteConsultation,
    CanConfirmConsultation,
    CanCreateAppointmentRequest,
    CanCreateIntake,
    CanManageAppointments,
    CanManagePatients,
    CanUpdateAppointmentStatus,
    CanManageStudentAccounts,
    CanReviewNurseQueue,
    CanScheduleDoctor,
    CanStartConsultation,
    CanSubmitToNurse,
    IsAuthenticatedClinicUser,
    IsAdministrator,
)
from users.models import Profile, Role
from records.audit import log_action
from users.services import set_temporary_password
from .services import (
    archive_intake,
    cancel_intake,
    complete_consultation,
    correct_intake,
    create_intake,
    reassign_intake,
    reschedule_intake,
    schedule_intake,
    start_consultation,
    transition_intake,
)


class AppointmentViewSet(viewsets.ModelViewSet):
    queryset = Appointment.objects.select_related(
        'patient', 'intake', 'booked_by__user', 'attended_by__user',
        'assigned_doctor__user', 'scheduled_by__user',
    )
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
        elif profile and profile.role == Role.ROLE_DOCTOR:
            queryset = queryset.filter(
                Q(assigned_doctor=profile) | Q(attended_by=profile)
            )
        elif profile and profile.role == Role.ROLE_RECEPTIONIST:
            queryset = queryset.filter(
                Q(booked_by=profile) | Q(intake__created_by=profile)
            )
        elif profile and profile.role == Role.ROLE_COORDINATOR:
            queryset = queryset.none()

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
        if self.action == 'create':
            return [IsAuthenticated(), CanCreateAppointmentRequest()]
        if self.action in {'update', 'partial_update', 'destroy', 'cancel'}:
            return [IsAuthenticated(), CanScheduleDoctor()]
        if self.action == 'set_status':
            return [IsAuthenticated(), CanUpdateAppointmentStatus()]
        return super().get_permissions()

    def perform_create(self, serializer):
        profile = getattr(self.request.user, 'user', None)
        save_values = {'booked_by': profile}
        if profile and profile.role == Role.ROLE_RECEPTIONIST:
            save_values.update({
                'status': Appointment.Status.REQUESTED,
                'assigned_doctor': None,
                'scheduled_by': None,
            })
        else:
            save_values['scheduled_by'] = profile
            doctor = serializer.validated_data.get('assigned_doctor')
            if doctor:
                save_values['attended_by'] = doctor
        appointment = serializer.save(**save_values)
        log_action(
            request=self.request,
            action='appointment_created',
            resource_type='Appointment',
            resource_id=appointment.pk,
            description='Appointment created.',
        )

    def perform_update(self, serializer):
        profile = getattr(self.request.user, 'user', None)
        appointment = serializer.save(scheduled_by=profile)
        log_action(
            request=self.request,
            action='appointment_updated',
            resource_type='Appointment',
            resource_id=appointment.pk,
            description='Appointment updated.',
        )

    def destroy(self, request, *args, **kwargs):
        return Response(
            {'detail': 'Appointments are cancelled or archived, not permanently deleted.'},
            status=status.HTTP_405_METHOD_NOT_ALLOWED,
        )

    @action(detail=True, methods=['post'])
    def cancel(self, request, pk=None):
        appointment = self.get_object()
        if appointment.intake_id:
            intake = cancel_intake(
                intake=appointment.intake,
                request=request,
                reason=str(request.data.get('reason') or 'Cancelled from appointment calendar'),
            )
            return Response(self.get_serializer(intake.appointment).data)
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
        if appointment.intake_id:
            return Response(
                {'status': ['Use the intake workflow actions for linked appointments.']},
                status=status.HTTP_400_BAD_REQUEST,
            )
        serializer = AppointmentStatusSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        profile = getattr(request.user, 'user', None)
        if profile and profile.role == Role.ROLE_DOCTOR:
            if appointment.assigned_doctor_id != profile.id and appointment.attended_by_id != profile.id:
                return Response(
                    {'detail': 'Only the assigned doctor may update this appointment.'},
                    status=status.HTTP_403_FORBIDDEN,
                )
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


class ClinicIntakeViewSet(viewsets.ModelViewSet):
    queryset = ClinicIntake.objects.select_related(
        'patient__user', 'created_by__user', 'reviewed_by__user',
        'assigned_doctor__user', 'appointment__scheduled_by__user',
        'appointment__assigned_doctor__user', 'appointment__visit',
    ).prefetch_related(
        'status_history__changed_by__user',
        'appointment__visit__prescriptions__items__medication',
    )
    serializer_class = ClinicIntakeSerializer
    permission_classes = (IsAuthenticated, IsAuthenticatedClinicUser)
    pagination_class = StandardResultsSetPagination
    filter_backends = (DjangoFilterBackend, SearchFilter, OrderingFilter)
    filterset_fields = ('patient', 'status', 'assigned_doctor', 'priority', 'is_demo')
    search_fields = (
        'patient__matric_number', 'patient__first_name', 'patient__last_name',
        'reason_for_visit', 'presenting_complaint',
    )
    ordering_fields = ('created_at', 'updated_at', 'priority', 'status')
    http_method_names = ['get', 'post', 'head', 'options']

    def get_queryset(self):
        queryset = super().get_queryset()
        profile = getattr(self.request.user, 'user', None)
        if not profile:
            return queryset.none()
        if profile.role == Role.ROLE_PATIENT:
            return queryset.filter(patient__user=self.request.user)
        if profile.role == Role.ROLE_DOCTOR:
            return queryset.filter(assigned_doctor=profile)
        if profile.role == Role.ROLE_NURSE:
            return queryset.exclude(status=ClinicIntake.Status.RECEPTION_INTAKE)
        if profile.role == Role.ROLE_RECEPTIONIST:
            return queryset.filter(created_by=profile)
        if profile.role == Role.ROLE_COORDINATOR:
            return queryset.none()
        return queryset

    def get_permissions(self):
        permissions = {
            'create': CanCreateIntake,
            'submit': CanSubmitToNurse,
            'begin_review': CanReviewNurseQueue,
            'available_doctors': CanReviewNurseQueue,
            'schedule': CanScheduleDoctor,
            'reschedule': CanScheduleDoctor,
            'cancel': CanScheduleDoctor,
            'confirm': CanConfirmConsultation,
            'start': CanStartConsultation,
            'attend': CanCompleteConsultation,
            'complete': CanCompleteConsultation,
            'reassign': CanArchiveClinicalData,
            'archive': CanArchiveClinicalData,
            'correct': CanArchiveClinicalData,
        }
        permission = permissions.get(self.action)
        if permission:
            return [IsAuthenticated(), permission()]
        return super().get_permissions()

    def perform_create(self, serializer):
        create_intake(serializer=serializer, request=self.request)

    def _transition(self, request, action):
        intake = transition_intake(
            intake=self.get_object(), action=action, request=request,
            reason=str(request.data.get('reason', '')).strip(),
        )
        return Response(self.get_serializer(intake).data)

    @action(detail=True, methods=['post'])
    def submit(self, request, pk=None):
        return self._transition(request, 'submit')

    @action(detail=True, methods=['post'], url_path='begin-review')
    def begin_review(self, request, pk=None):
        return self._transition(request, 'begin_review')

    @action(detail=False, methods=['get'], url_path='available-doctors')
    def available_doctors(self, request):
        doctors = Profile.objects.select_related('user').filter(
            role__in=[Role.ROLE_DOCTOR, Role.ROLE_ADMIN], user__is_active=True
        ).order_by('user__first_name', 'user__last_name', 'user__username')
        return Response({
            'results': [
                {
                    'id': doctor.pk,
                    'name': doctor.user.get_full_name() or doctor.user.username,
                    'role': doctor.role,
                }
                for doctor in doctors
            ]
        })

    @action(detail=True, methods=['post'])
    def schedule(self, request, pk=None):
        serializer = IntakeScheduleSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        intake = schedule_intake(
            intake=self.get_object(), request=request,
            doctor=serializer.validated_data['assigned_doctor'],
            scheduled_for=serializer.validated_data['scheduled_for'],
            scheduling_note=serializer.validated_data.get('scheduling_note', ''),
        )
        return Response(self.get_serializer(intake).data)

    @action(detail=True, methods=['post'])
    def reschedule(self, request, pk=None):
        serializer = IntakeScheduleSerializer(data=request.data)
        serializer.fields['scheduling_note'].required = True
        serializer.is_valid(raise_exception=True)
        intake = reschedule_intake(
            intake=self.get_object(), request=request,
            doctor=serializer.validated_data['assigned_doctor'],
            scheduled_for=serializer.validated_data['scheduled_for'],
            reason=serializer.validated_data['scheduling_note'],
        )
        return Response(self.get_serializer(intake).data)

    @action(detail=True, methods=['post'])
    def confirm(self, request, pk=None):
        return self._transition(request, 'confirm')

    @action(detail=True, methods=['post'], url_path='start-consultation')
    def start(self, request, pk=None):
        intake, visit = start_consultation(intake=self.get_object(), request=request)
        data = self.get_serializer(intake).data
        data['visit_id'] = visit.pk
        return Response(data)

    @action(detail=True, methods=['post'])
    def attend(self, request, pk=None):
        return self._transition(request, 'attend')

    @action(detail=True, methods=['post'])
    def complete(self, request, pk=None):
        serializer = IntakeCompletionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        intake = complete_consultation(
            intake=self.get_object(), request=request,
            summary=serializer.validated_data['summary'],
            follow_up_instructions=serializer.validated_data.get(
                'follow_up_instructions', ''
            ),
        )
        return Response(self.get_serializer(intake).data)

    @action(detail=True, methods=['post'])
    def reassign(self, request, pk=None):
        serializer = IntakeDoctorSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        intake = reassign_intake(
            intake=self.get_object(), request=request,
            doctor=serializer.validated_data['assigned_doctor'],
            reason=serializer.validated_data['reason'],
        )
        return Response(self.get_serializer(intake).data)

    @action(detail=True, methods=['post'])
    def archive(self, request, pk=None):
        serializer = IntakeReasonSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        intake = archive_intake(
            intake=self.get_object(), request=request,
            reason=serializer.validated_data['reason'],
        )
        return Response(self.get_serializer(intake).data)

    @action(detail=True, methods=['post'])
    def correct(self, request, pk=None):
        serializer = IntakeCorrectionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        intake = correct_intake(
            intake=self.get_object(), request=request,
            target_status=serializer.validated_data['target_status'],
            reason=serializer.validated_data['reason'],
        )
        return Response(self.get_serializer(intake).data)

    @action(detail=True, methods=['post'])
    def cancel(self, request, pk=None):
        serializer = IntakeReasonSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        intake = cancel_intake(
            intake=self.get_object(), request=request,
            reason=serializer.validated_data['reason'],
        )
        return Response(self.get_serializer(intake).data)


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
        if profile and profile.role == Role.ROLE_DOCTOR:
            return queryset.filter(
                Q(appointments__assigned_doctor=profile)
                | Q(appointments__attended_by=profile)
                | Q(clinic_intakes__assigned_doctor=profile)
                | Q(visits__created_by=profile)
            ).distinct()
        return queryset

    def get_permissions(self):
        if self.action in {
            'portal_account', 'reset_portal_password', 'set_portal_status'
        }:
            return [IsAuthenticated(), CanManageStudentAccounts()]
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

    def destroy(self, request, *args, **kwargs):
        return Response(
            {'detail': 'Patients are archived with a reason, not permanently deleted.'},
            status=status.HTTP_405_METHOD_NOT_ALLOWED,
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

    @action(detail=True, methods=['get', 'post'], url_path='portal-account')
    def portal_account(self, request, pk=None):
        patient = self.get_object()
        if request.method == 'GET':
            return Response(self._portal_account_data(patient))

        serializer = StudentPortalAccountSerializer(
            data=request.data, context={'patient': patient}
        )
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        log_action(
            request=request,
            action='student_account_created',
            resource_type='Patient',
            resource_id=patient.pk,
            description='A student portal account was linked to the patient.',
            metadata={'user_id': user.pk},
        )
        return Response({
            'account': self._portal_account_data(patient),
            'temporary_password': serializer.temporary_password,
            'display_once': True,
        }, status=status.HTTP_201_CREATED)

    @action(
        detail=True,
        methods=['post'],
        url_path='portal-account/reset-temporary-password',
    )
    def reset_portal_password(self, request, pk=None):
        patient = self.get_object()
        if not patient.user_id:
            return Response(
                {'detail': 'This patient has no linked portal account.'},
                status=status.HTTP_404_NOT_FOUND,
            )
        password = set_temporary_password(patient.user)
        log_action(
            request=request,
            action='student_temporary_password_reset',
            resource_type='Patient',
            resource_id=patient.pk,
            description='A new temporary student portal password was issued.',
            metadata={'user_id': patient.user_id},
        )
        return Response({
            'account': self._portal_account_data(patient),
            'temporary_password': password,
            'display_once': True,
        })

    @action(
        detail=True,
        methods=['patch'],
        url_path='portal-account/status',
    )
    def set_portal_status(self, request, pk=None):
        patient = self.get_object()
        if not patient.user_id:
            return Response(
                {'detail': 'This patient has no linked portal account.'},
                status=status.HTTP_404_NOT_FOUND,
            )
        serializer = PortalAccountStatusSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        patient.user.is_active = serializer.validated_data['is_active']
        patient.user.save(update_fields=['is_active'])
        if not patient.user.is_active:
            patient.user.user.token_version += 1
            patient.user.user.save(update_fields=['token_version'])
        log_action(
            request=request,
            action='student_account_status_changed',
            resource_type='Patient',
            resource_id=patient.pk,
            description='Student portal account status changed.',
            metadata={'is_active': patient.user.is_active},
        )
        return Response(self._portal_account_data(patient))

    @staticmethod
    def _portal_account_data(patient):
        user = patient.user
        if not user:
            return {'linked': False}
        profile = getattr(user, 'user', None)
        return {
            'linked': True,
            'id': user.pk,
            'username': user.username,
            'email': user.email,
            'first_name': user.first_name,
            'last_name': user.last_name,
            'is_active': user.is_active,
            'last_login': user.last_login,
            'role': getattr(profile, 'role', None),
            'must_change_password': getattr(
                profile, 'must_change_password', False
            ),
        }
