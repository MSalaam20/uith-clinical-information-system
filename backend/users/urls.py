from django.urls import include, path
from rest_framework import routers

from .views import (
    ChangePasswordView,
    DemoAccessView,
    PasswordResetConfirmView,
    PasswordResetRequestView,
    PortalTokenObtainPairView,
    ProfileViewSet,
    StaffViewSet,
)

app_name = 'users'

router_v1 = routers.DefaultRouter()

router_v1.register('profile', ProfileViewSet, basename='profile')
router_v1.register('staff', StaffViewSet, basename='staff')

urlpatterns = [
    path(
        'auth/jwt/create/',
        PortalTokenObtainPairView.as_view(),
        name='portal-token-create',
    ),
    path(
        'account/change-password/',
        ChangePasswordView.as_view(),
        name='change-password',
    ),
    path(
        'account/password-reset/',
        PasswordResetRequestView.as_view(),
        name='password-reset',
    ),
    path(
        'account/password-reset/confirm/',
        PasswordResetConfirmView.as_view(),
        name='password-reset-confirm',
    ),
    path('demo-access/', DemoAccessView.as_view(), name='demo-access'),
    path('', include(router_v1.urls)),
    path('auth/', include('djoser.urls')),
    # path('auth/', include('djoser.urls.authtoken')),
    path('auth/', include('djoser.urls.jwt')),
]
