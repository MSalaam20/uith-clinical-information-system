from django.contrib.auth.models import User
from django.shortcuts import get_object_or_404
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.filters import OrderingFilter, SearchFilter
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from users.models import Profile
from users.permissions import IsAdministrator
from patients.pagination import StandardResultsSetPagination
from .serializers import (
    ProfileSerializer,
    StaffRoleSerializer,
    StaffStatusSerializer,
    StaffUserSerializer,
)


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

    def get_queryset(self):
        queryset = super().get_queryset().exclude(user__role='PT')
        role = self.request.query_params.get('role')
        return queryset.filter(user__role=role) if role else queryset

    @action(detail=True, methods=['patch'], url_path='role')
    def set_role(self, request, pk=None):
        user = get_object_or_404(self.get_queryset(), pk=pk)
        serializer = StaffRoleSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user.user.role = serializer.validated_data['role']
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
        user.is_active = is_active
        user.save(update_fields=['is_active'])

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
