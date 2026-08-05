from django.contrib import admin

from .models import Appointment, Patient


@admin.register(Patient)
class PatientAdmin(admin.ModelAdmin):
    list_display = [
        'matric_number',
        'first_name',
        'middle_name',
        'last_name',
        'department',
        'user',
        'date_of_birth',
    ]
    search_fields = ['matric_number', 'first_name', 'middle_name', 'last_name']


@admin.register(Appointment)
class AppointmentAdmin(admin.ModelAdmin):
    list_display = [
        'patient',
        'scheduled_for',
        'reason',
        'status',
        'booked_by',
        'attended_by',
    ]
    list_filter = ['status', 'scheduled_for']
    search_fields = ['patient__matric_number', 'patient__first_name', 'patient__last_name', 'reason']


