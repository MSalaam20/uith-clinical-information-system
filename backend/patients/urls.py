from django.urls import path, include
from .views import AppointmentViewSet, ClinicIntakeViewSet, PatientViewSet
from rest_framework import routers

app_name = 'patients'

router_v1 = routers.DefaultRouter()
router_v1.register('patients', PatientViewSet, basename='patients')
router_v1.register('appointments', AppointmentViewSet, basename='appointments')
router_v1.register('clinic-intakes', ClinicIntakeViewSet, basename='clinic-intakes')

urlpatterns = [
    path('', include(router_v1.urls)),
]
