from django.conf import settings
from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from django.contrib.auth.tokens import default_token_generator
from django.contrib.auth.models import User
from django.core.exceptions import ValidationError as DjangoValidationError
from django.core.mail import send_mail
from django.db import transaction
from django.shortcuts import get_object_or_404
from django.utils.encoding import force_bytes, force_str
from django.utils.http import urlsafe_base64_decode, urlsafe_base64_encode
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.filters import OrderingFilter, SearchFilter
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.views import TokenObtainPairView
from users.models import Profile, Role
from users.permissions import IsAdministrator
from users.services import set_temporary_password
from patients.pagination import StandardResultsSetPagination
from .authentication import PortalTokenObtainPairSerializer
from .serializers import (
    ProfileSerializer,
    ChangePasswordSerializer,
    PasswordResetConfirmSerializer,
    PasswordResetRequestSerializer,
    StaffCreateSerializer,
    StaffRoleSerializer,
    StaffStatusSerializer,
    StaffUserSerializer,
)


class PortalTokenObtainPairView(TokenObtainPairView):
    serializer_class = PortalTokenObtainPairSerializer
    permission_classes = (AllowAny,)


class ProfileViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Profile.objects.select_related(
        'user', 'medical_field', 'position', 'departments'
    )
    serializer_class = ProfileSerializer
    permission_classes = (IsAuthenticated, IsAdministrator)

    def get_permissions(self):
        if self.action == 'me':
            return [IsAuthenticated()]
        return super().get_permissions()

    @action(detail=False, methods=['get'], url_path='me')
    def me(self, request):
        try:
            profile = self.get_queryset().get(user=request.user)
        except Profile.DoesNotExist:
            return Response(
                {'detail': 'No clinic profile is linked to this account.'},
                status=status.HTTP_404_NOT_FOUND,
            )
        return Response(self.get_serializer(profile).data)


class StaffViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = User.objects.select_related('user').filter(user__isnull=False)
    serializer_class = StaffUserSerializer
    permission_classes = (IsAuthenticated, IsAdministrator)
    pagination_class = StandardResultsSetPagination
    filter_backends = (DjangoFilterBackend, SearchFilter, OrderingFilter)
    filterset_fields = ('is_active',)
    search_fields = (
        'username', 'first_name', 'last_name', 'email', 'user__phone_number'
    )
    ordering_fields = ('username', 'first_name', 'last_name', 'is_active')

    def create(self, request):
        serializer = StaffCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()

        from records.audit import log_action

        log_action(
            request=request,
            action='staff_account_created',
            resource_type='User',
            resource_id=user.pk,
            description=f'Staff account {user.username} was provisioned.',
            metadata={'role': user.user.role},
        )
        return Response({
            'account': self.get_serializer(user).data,
            'temporary_password': serializer.temporary_password,
            'display_once': True,
        }, status=status.HTTP_201_CREATED)

    def get_queryset(self):
        queryset = super().get_queryset().exclude(user__role='PT')
        role = self.request.query_params.get('role')
        return queryset.filter(user__role=role) if role else queryset

    @action(detail=True, methods=['patch'], url_path='role')
    def set_role(self, request, pk=None):
        user = get_object_or_404(self.get_queryset(), pk=pk)
        serializer = StaffRoleSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        next_role = serializer.validated_data['role']
        if (
            user.user.role == Role.ROLE_ADMIN
            and next_role != Role.ROLE_ADMIN
            and self._active_admins().count() <= 1
        ):
            return Response(
                {'role': ['The last active administrator cannot lose administrator access.']},
                status=status.HTTP_400_BAD_REQUEST,
            )
        user.user.role = next_role
        user.user.save(update_fields=['role'])

        from records.audit import log_action

        log_action(
            request=request,
            action='role_changed',
            resource_type='Profile',
            resource_id=user.user.pk,
            description=f'Role changed for staff account {user.username}.',
        )
        return Response(self.get_serializer(user).data)

    @action(detail=True, methods=['patch'], url_path='status')
    def set_status(self, request, pk=None):
        user = get_object_or_404(self.get_queryset(), pk=pk)
        serializer = StaffStatusSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        is_active = serializer.validated_data['is_active']
        if user == request.user and not is_active:
            return Response(
                {'is_active': ['Administrators cannot deactivate their own session.']},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if (
            not is_active
            and user.user.role == Role.ROLE_ADMIN
            and self._active_admins().count() <= 1
        ):
            return Response(
                {'is_active': ['The last active administrator cannot be deactivated.']},
                status=status.HTTP_400_BAD_REQUEST,
            )
        user.is_active = is_active
        user.save(update_fields=['is_active'])
        if not is_active:
            user.user.token_version += 1
            user.user.save(update_fields=['token_version'])

        from records.audit import log_action

        log_action(
            request=request,
            action='staff_status_changed',
            resource_type='User',
            resource_id=user.pk,
            description=(
                f'Staff account {user.username} '
                f'was {"activated" if is_active else "deactivated"}.'
            ),
        )
        return Response(self.get_serializer(user).data)

    @action(detail=True, methods=['post'], url_path='reset-temporary-password')
    def reset_temporary_password(self, request, pk=None):
        user = get_object_or_404(self.get_queryset(), pk=pk)
        password = set_temporary_password(user)

        from records.audit import log_action

        log_action(
            request=request,
            action='temporary_password_reset',
            resource_type='User',
            resource_id=user.pk,
            description=f'A temporary password was issued for {user.username}.',
        )
        return Response({
            'account': self.get_serializer(user).data,
            'temporary_password': password,
            'display_once': True,
        })

    @staticmethod
    def _active_admins():
        return User.objects.filter(is_active=True, user__role=Role.ROLE_ADMIN)


class ChangePasswordView(APIView):
    permission_classes = (IsAuthenticated,)

    @transaction.atomic
    def post(self, request):
        serializer = ChangePasswordSerializer(
            data=request.data, context={'request': request}
        )
        serializer.is_valid(raise_exception=True)
        user = request.user
        user.set_password(serializer.validated_data['new_password'])
        user.save(update_fields=['password'])
        profile = user.user
        profile.must_change_password = False
        profile.token_version += 1
        profile.save(update_fields=['must_change_password', 'token_version'])

        from records.audit import log_action

        log_action(
            request=request,
            action='password_changed',
            resource_type='User',
            resource_id=user.pk,
            description='Account password changed; existing sessions invalidated.',
        )
        return Response(status=status.HTTP_204_NO_CONTENT)


class PasswordResetRequestView(APIView):
    authentication_classes = ()
    permission_classes = (AllowAny,)

    def post(self, request):
        serializer = PasswordResetRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        email = serializer.validated_data['email'].strip().lower()
        portal_type = serializer.validated_data['portal_type']
        user = get_user_model().objects.filter(
            email__iexact=email, is_active=True
        ).first()
        if user:
            uid = urlsafe_base64_encode(force_bytes(user.pk))
            token = default_token_generator.make_token(user)
            reset_url = (
                f"{settings.FRONTEND_URL.rstrip('/')}/reset-password/"
                f"{uid}/{token}?portal={portal_type}"
            )
            send_mail(
                'Reset your School Complex Clinic portal password',
                (
                    'A password reset was requested for your clinic portal account.\n\n'
                    f'Reset it using this one-time link:\n{reset_url}\n\n'
                    'If you did not request this, you can ignore this message.'
                ),
                settings.DEFAULT_FROM_EMAIL,
                [user.email],
                fail_silently=False,
            )

            from records.audit import log_action

            log_action(
                user=user,
                action='password_reset_requested',
                resource_type='User',
                resource_id=user.pk,
                description='A password-reset message was requested.',
            )
        return Response(status=status.HTTP_204_NO_CONTENT)


class PasswordResetConfirmView(APIView):
    authentication_classes = ()
    permission_classes = (AllowAny,)

    @transaction.atomic
    def post(self, request):
        serializer = PasswordResetConfirmSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            user_id = force_str(
                urlsafe_base64_decode(serializer.validated_data['uid'])
            )
            user = get_user_model().objects.get(pk=user_id, is_active=True)
        except (ValueError, TypeError, OverflowError, User.DoesNotExist):
            return Response(
                {'uid': ['This password-reset link is invalid.']},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if not default_token_generator.check_token(
            user, serializer.validated_data['token']
        ):
            return Response(
                {'token': ['This password-reset link is invalid or expired.']},
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            validate_password(serializer.validated_data['new_password'], user)
        except DjangoValidationError as error:
            return Response(
                {'new_password': list(error.messages)},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if user.check_password(serializer.validated_data['new_password']):
            return Response(
                {'new_password': ['Choose a password different from the current password.']},
                status=status.HTTP_400_BAD_REQUEST,
            )
        user.set_password(serializer.validated_data['new_password'])
        user.save(update_fields=['password'])
        profile = user.user
        profile.must_change_password = False
        profile.token_version += 1
        profile.save(update_fields=['must_change_password', 'token_version'])

        from records.audit import log_action

        log_action(
            user=user,
            action='password_reset_completed',
            resource_type='User',
            resource_id=user.pk,
            description='Password reset completed; existing sessions invalidated.',
        )
        return Response(status=status.HTTP_204_NO_CONTENT)


class DemoAccessView(APIView):
    authentication_classes = ()
    permission_classes = (AllowAny,)

    def get(self, request):
        if not settings.SHOW_DEMO_CREDENTIALS or not (
            settings.DEBUG or settings.ALLOW_DEMO_ACCOUNTS
        ):
            return Response(status=status.HTTP_404_NOT_FOUND)
        return Response({'accounts': [
            {'role': 'Doctor', 'portal': 'staff', 'username': 'dr.jeremiah', 'password': 'Doctor@123'},
            {'role': 'Nurse', 'portal': 'staff', 'username': 'nurse.fatima', 'password': 'Nurse@123'},
            {'role': 'Receptionist', 'portal': 'staff', 'username': 'mr.ibrahim', 'password': 'Reception@123'},
            {'role': 'Student', 'portal': 'student', 'username': 'uith_2021_52HL034', 'password': 'Student@123'},
        ]})
