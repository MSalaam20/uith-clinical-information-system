from django.urls import include, path
from rest_framework import routers

from records.views import (
    AuditLogViewSet,
    ClinicalNoteViewSet,
    DiagnosisViewSet,
    ICDCodeViewSet,
    MedicationViewSet,
    PrescriptionViewSet,
    RecordViewSet,
    SchemaViewSet,
    RecordTemplateViewSet,
    VisitViewSet,
    VitalSignViewSet,
    )

app_name = 'records'

router_v1 = routers.DefaultRouter()

router_v1.register('records', RecordViewSet, basename='records')
router_v1.register('templates', RecordTemplateViewSet, basename='templates')
router_v1.register('schemas', SchemaViewSet, basename='schemas')
router_v1.register('visits', VisitViewSet, basename='visits')
router_v1.register('vital-signs', VitalSignViewSet, basename='vital-signs')
router_v1.register('clinical-notes', ClinicalNoteViewSet, basename='clinical-notes')
router_v1.register('diagnoses', DiagnosisViewSet, basename='diagnoses')
router_v1.register('medications', MedicationViewSet, basename='medications')
router_v1.register('prescriptions', PrescriptionViewSet, basename='prescriptions')
router_v1.register('icd-codes', ICDCodeViewSet, basename='icd-codes')
router_v1.register('audit-logs', AuditLogViewSet, basename='audit-logs')

urlpatterns = [
    path('', include(router_v1.urls)),
]
