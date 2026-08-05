from django.contrib import admin

from .models import (
    AuditLog,
    ClinicalNote,
    Diagnosis,
    ICDCode,
    Medication,
    Prescription,
    PrescriptionItem,
    Record,
    Schema,
    RecordTemplate,
    Visit,
    VitalSign,
)


@admin.register(Record)
class RecordAdmin(admin.ModelAdmin):
    list_display = [field.name for field in Record._meta.fields]


@admin.register(RecordTemplate)
class RecordTemplateAdmin(admin.ModelAdmin):
    list_display = [field.name for field in RecordTemplate._meta.fields]

@admin.register(Schema)
class SchemaAdmin(admin.ModelAdmin):
    list_display = [field.name for field in Schema._meta.fields]


admin.site.register(Visit)
admin.site.register(VitalSign)
admin.site.register(ClinicalNote)
admin.site.register(Diagnosis)
admin.site.register(ICDCode)
admin.site.register(Medication)
admin.site.register(Prescription)
admin.site.register(PrescriptionItem)


@admin.register(AuditLog)
class AuditLogAdmin(admin.ModelAdmin):
    list_display = [
        'timestamp', 'user', 'action', 'resource_type', 'resource_id', 'success'
    ]
    list_filter = ['success', 'action', 'resource_type']
    search_fields = ['user__username', 'resource_id', 'description']
    readonly_fields = [field.name for field in AuditLog._meta.fields]

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False
