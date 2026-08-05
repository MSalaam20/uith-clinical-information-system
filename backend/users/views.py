from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated
from django.contrib.auth.models import User
from users.models import Profile
from users.permissions import IsAuthenticatedClinicUser
from .serializers import ProfileSerializer


class ProfileViewSet(viewsets.ModelViewSet):
    queryset = Profile.objects.all()
    serializer_class = ProfileSerializer
    permission_classes = (IsAuthenticated, IsAuthenticatedClinicUser)

    def get_permissions(self):
        if self.action in {'create', 'update', 'partial_update', 'destroy'}:
            return [IsAuthenticated()]
        return super().get_permissions()

    def get_queryset(self):
        queryset = super().get_queryset()
        profile = getattr(self.request.user, 'user', None)
        if profile and profile.role == 'PT':
            return queryset.filter(user=self.request.user)
        return queryset
