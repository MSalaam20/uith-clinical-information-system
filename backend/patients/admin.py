from django.contrib import admin

from .models import Appointment, ClinicIntake, ClinicIntakeStatusHistory, Patient


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


@admin.register(ClinicIntake)
class ClinicIntakeAdmin(admin.ModelAdmin):
    list_display = [
        'patient', 'priority', 'status', 'assigned_doctor', 'created_at', 'updated_at'
    ]
    list_filter = ['priority', 'status', 'is_demo', 'created_at']
    search_fields = [
        'patient__matric_number', 'patient__first_name', 'patient__last_name',
        'reason_for_visit', 'presenting_complaint',
    ]
    readonly_fields = ['uuid', 'created_at', 'updated_at']


@admin.register(ClinicIntakeStatusHistory)
class ClinicIntakeStatusHistoryAdmin(admin.ModelAdmin):
    list_display = ['intake', 'from_status', 'to_status', 'changed_by', 'created_at']
    list_filter = ['to_status', 'created_at']
    readonly_fields = [
        'intake', 'from_status', 'to_status', 'changed_by', 'reason', 'metadata',
        'created_at',
    ]

    def has_add_permission(self, request):
        return False

    def has_delete_permission(self, request, obj=None):
        return False

