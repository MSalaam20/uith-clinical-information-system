from django.urls import include, path
from rest_framework import routers

from .authentication import PortalTokenObtainPairView
from .views import ProfileViewSet, StaffViewSet

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
    path('', include(router_v1.urls)),
    path('auth/', include('djoser.urls')),
    # path('auth/', include('djoser.urls.authtoken')),
    path('auth/', include('djoser.urls.jwt')),
]
