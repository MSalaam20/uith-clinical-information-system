from django_filters.rest_framework import FilterSet, filters
from .models import AuditLog, Record


class RecordFilter(FilterSet):
    findings_schema__name = filters.CharFilter(
        field_name='findings_schema__name',
        lookup_expr='contains',
        )
    date_of_record = filters.DateFromToRangeFilter(
        field_name='created_at',
    )

    class Meta:
        model = Record
        fields = ['findings_schema__name', 'date_of_record']


class AuditLogFilter(FilterSet):
    date = filters.DateFromToRangeFilter(field_name='timestamp')
    action = filters.CharFilter(field_name='action', lookup_expr='icontains')
    resource_type = filters.CharFilter(
        field_name='resource_type', lookup_expr='icontains'
    )

    class Meta:
        model = AuditLog
        fields = ['date', 'user', 'action', 'resource_type', 'success']
