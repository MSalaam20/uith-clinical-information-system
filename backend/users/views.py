from django.contrib.auth.models import User
from django.shortcuts import get_object_or_404
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from users.models import Profile
from users.permissions import IsAdministrator
from .serializers import (
    ProfileSerializer,
    StaffRoleSerializer,
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

    def get_queryset(self):
        return super().get_queryset().exclude(user__role='PT')

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
