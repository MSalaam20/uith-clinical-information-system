from rest_framework import serializers
from .models import Appointment, Patient


class AppointmentSerializer(serializers.ModelSerializer):
    patient_matric_number = serializers.CharField(source='patient.matric_number', read_only=True)
    booked_by_name = serializers.SerializerMethodField()
    attended_by_name = serializers.SerializerMethodField()

    class Meta:
        model = Appointment
        fields = [
            'id',
            'patient',
            'patient_matric_number',
            'scheduled_for',
            'reason',
            'status',
            'booked_by',
            'booked_by_name',
            'attended_by',
            'attended_by_name',
            'notes',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at', 'patient_matric_number', 'booked_by_name', 'attended_by_name']

    def get_booked_by_name(self, obj):
        if obj.booked_by and obj.booked_by.user:
            return f"{obj.booked_by.user.first_name} {obj.booked_by.user.last_name}".strip()
        return None

    def get_attended_by_name(self, obj):
        if obj.attended_by and obj.attended_by.user:
            return f"{obj.attended_by.user.first_name} {obj.attended_by.user.last_name}".strip()
        return None


class PatientSerializer(serializers.ModelSerializer):
    class Meta:
        model = Patient
        fields = [
            'id', 'user', 'matric_number', 'department',
            'first_name', 'middle_name', 'last_name',
            'date_of_birth', 'gender', 'photo', 'address',
            'phone_number', 'email', 'created_at', 'updated_at'
            ]
        read_only_fields = ['id', 'user', 'created_at', 'updated_at']
