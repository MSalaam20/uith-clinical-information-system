from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import include, path
from rest_framework import permissions
from drf_yasg.views import get_schema_view
from drf_yasg import openapi
from .views import dashboard_summary, health, icd11_search


schema_is_public = settings.DEBUG or settings.API_DOCS_PUBLIC
schema_permission = permissions.AllowAny if schema_is_public else permissions.IsAdminUser

schema_view = get_schema_view(
   openapi.Info(
      title="UITH School Complex Clinic EHR API",
      default_version='v1',
      description=(
          "Authenticated APIs for patients, appointments, structured clinical "
          "visits, diagnoses, prescriptions, records, and audit logs."
      ),
      contact=openapi.Contact(email="schoolclinic@example.invalid"),
   ),
   public=schema_is_public,
   permission_classes=(schema_permission,),
)

urlpatterns = [
    path('health/', health, name='health'),
    path('admin/', admin.site.urls),
    path('api/', include('users.urls', namespace='users')),
    path('api/', include('records.urls', namespace='records')),
    path('api/', include('patients.urls', namespace='patients')),
    path('api/icd-11/search/', icd11_search, name='icd11-search'),
    path('api/dashboard/summary/', dashboard_summary, name='dashboard-summary'),
    path(
        'swagger<format>/', schema_view.without_ui(cache_timeout=0),
        name='schema-json'
        ),
    path(
        'swagger/', schema_view.with_ui('swagger', cache_timeout=0),
        name='schema-swagger-ui'
        ),
    path(
        'redoc/',
        schema_view.with_ui('redoc', cache_timeout=0),
        name='schema-redoc'
        ),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL,
                          document_root=settings.MEDIA_ROOT)
