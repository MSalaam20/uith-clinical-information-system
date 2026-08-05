from django_filters.rest_framework import FilterSet, filters
from .models import Patient


class PatientFilter(FilterSet):
    first_name = filters.CharFilter(
        field_name='first_name',
        lookup_expr='istartswith',
        )
    last_name = filters.CharFilter(
        field_name='last_name',
        lookup_expr='istartswith',
        )
    date_of_birth = filters.DateFilter(
        field_name='date_of_birth',
    )
    search = filters.CharFilter(method='filter_search')

    def filter_search(self, queryset, name, value):
        from django.db.models import Q

        return queryset.filter(
            Q(matric_number__icontains=value)
            | Q(first_name__icontains=value)
            | Q(middle_name__icontains=value)
            | Q(last_name__icontains=value)
            | Q(phone_number__icontains=value)
        )

    class Meta:
        model = Patient
        fields = ['first_name', 'last_name', 'date_of_birth', 'search']
