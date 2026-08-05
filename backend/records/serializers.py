import json
from rest_framework import serializers

from patients.models import Patient
from users.models import Profile
from utils.validators import compile_with_custom_formats
from .models import (
    AuditLog,
    ClinicalNote,
    Diagnosis,
    ICDCode,
    Medication,
    Prescription,
    PrescriptionItem,
    Record,
    RecordTemplate,
    Schema,
    Visit,
    VitalSign,
)


def validate_findings_against_schema(findings, schema):
    if schema is None:
        return
    try:
        validate = compile_with_custom_formats(schema.schema)
        validate(findings)
    except Exception as exc:
        raise serializers.ValidationError({'findings': str(exc)}) from exc


class PatientNameSerializer(serializers.ModelSerializer):
    class Meta:
        model = Patient
        fields = ['first_name', 'last_name', 'middle_name', 'matric_number']


class SpecialistNameSerializer(serializers.ModelSerializer):
    full_name = serializers.SerializerMethodField()

    class Meta:
        model = Profile
        fields = ['id', 'full_name']

    def get_full_name(self, profile):
        return ' '.join(
            part for part in [
                profile.user.first_name,
                profile.middle_name,
                profile.user.last_name,
            ] if part
        )


class FindingsValidationMixin:
    def to_internal_value(self, data):
        mutable_data = data.copy() if hasattr(data, 'copy') else dict(data)
        findings = mutable_data.get('findings')
        if isinstance(findings, str):
            try:
                mutable_data['findings'] = json.loads(findings)
            except json.JSONDecodeError as exc:
                raise serializers.ValidationError({
                    'findings': 'Findings must contain valid JSON.'
                }) from exc
        return super().to_internal_value(mutable_data)

    def validate(self, attrs):
        schema = attrs.get(
            'findings_schema', getattr(self.instance, 'findings_schema', None)
        )
        findings = attrs.get('findings', getattr(self.instance, 'findings', {}))
        validate_findings_against_schema(findings, schema)
        return attrs


class RecordSerializer(FindingsValidationMixin, serializers.ModelSerializer):
    patient_name = PatientNameSerializer(source='patient', read_only=True)
    patient_id = serializers.PrimaryKeyRelatedField(
        source='patient', queryset=Patient.objects.all(), write_only=True
    )
    specialist = SpecialistNameSerializer(read_only=True)
    findings_schema_name = serializers.StringRelatedField(
        source='findings_schema', read_only=True
    )

    class Meta:
        model = Record
        fields = [
            'id', 'patient_id', 'patient_name', 'specialist',
            'findings', 'created_at', 'updated_at',
            'findings_schema', 'findings_schema_name',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at', 'specialist']


class RecordTemplateSerializer(
    FindingsValidationMixin, serializers.ModelSerializer
):
    class Meta:
        model = RecordTemplate
        fields = '__all__'


class RecordTemplateListSerializer(serializers.ModelSerializer):
    class Meta:
        model = RecordTemplate
        fields = ['id', 'template_name']


class SchemaListSerializer(serializers.ModelSerializer):
    class Meta:
        model = Schema
        fields = ['id', 'name']


class SchemaDetailSerializer(serializers.ModelSerializer):
    class Meta:
        model = Schema
        fields = '__all__'


class VitalSignSerializer(serializers.ModelSerializer):
    class Meta:
        model = VitalSign
        fields = '__all__'
        read_only_fields = ['id', 'recorded_by', 'created_at']

    def validate(self, attrs):
        systolic = attrs.get('systolic_bp')
        diastolic = attrs.get('diastolic_bp')
        oxygen = attrs.get('oxygen_saturation')
        temperature = attrs.get('temperature_c')
        if systolic is not None and not 50 <= systolic <= 260:
            raise serializers.ValidationError({'systolic_bp': 'Expected 50-260 mmHg.'})
        if diastolic is not None and not 30 <= diastolic <= 160:
            raise serializers.ValidationError({'diastolic_bp': 'Expected 30-160 mmHg.'})
        if systolic and diastolic and systolic <= diastolic:
            raise serializers.ValidationError('Systolic pressure must exceed diastolic pressure.')
        if oxygen is not None and not 50 <= oxygen <= 100:
            raise serializers.ValidationError({'oxygen_saturation': 'Expected 50-100%.'})
        if temperature is not None and not 25 <= temperature <= 45:
            raise serializers.ValidationError({'temperature_c': 'Expected 25-45 C.'})
        return attrs


class ClinicalNoteSerializer(serializers.ModelSerializer):
    class Meta:
        model = ClinicalNote
        fields = '__all__'
        read_only_fields = ['id', 'author', 'created_at', 'updated_at']


class ICDCodeSerializer(serializers.ModelSerializer):
    class Meta:
        model = ICDCode
        fields = '__all__'


class DiagnosisSerializer(serializers.ModelSerializer):
    icd = ICDCodeSerializer(source='icd_code', read_only=True)

    class Meta:
        model = Diagnosis
        fields = '__all__'
        read_only_fields = ['id', 'code_snapshot', 'diagnosed_by', 'created_at']

    def create(self, validated_data):
        icd_code = validated_data.get('icd_code')
        if icd_code:
            validated_data['code_snapshot'] = icd_code.code
        return super().create(validated_data)

    def update(self, instance, validated_data):
        icd_code = validated_data.get('icd_code', instance.icd_code)
        validated_data['code_snapshot'] = icd_code.code if icd_code else ''
        return super().update(instance, validated_data)


class MedicationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Medication
        fields = '__all__'


class PrescriptionItemSerializer(serializers.ModelSerializer):
    medication_detail = MedicationSerializer(source='medication', read_only=True)

    class Meta:
        model = PrescriptionItem
        fields = '__all__'
        read_only_fields = ['prescription']


class PrescriptionSerializer(serializers.ModelSerializer):
    items = PrescriptionItemSerializer(many=True, required=False)

    class Meta:
        model = Prescription
        fields = '__all__'
        read_only_fields = ['id', 'prescribed_by', 'created_at']

    def validate(self, attrs):
        patient = attrs.get('patient', getattr(self.instance, 'patient', None))
        visit = attrs.get('visit', getattr(self.instance, 'visit', None))
        if patient and visit and visit.patient_id != patient.id:
            raise serializers.ValidationError(
                {'visit': 'The selected visit belongs to a different patient.'}
            )
        return attrs

    def create(self, validated_data):
        items = validated_data.pop('items', [])
        prescription = Prescription.objects.create(**validated_data)
        for item in items:
            PrescriptionItem.objects.create(prescription=prescription, **item)
        return prescription


class VisitSerializer(serializers.ModelSerializer):
    vital_signs = VitalSignSerializer(many=True, read_only=True)
    diagnoses = DiagnosisSerializer(many=True, read_only=True)
    clinical_notes = ClinicalNoteSerializer(many=True, read_only=True)
    prescriptions = PrescriptionSerializer(many=True, read_only=True)

    class Meta:
        model = Visit
        fields = '__all__'
        read_only_fields = ['id', 'uuid', 'created_by', 'created_at', 'updated_at']

    def validate(self, attrs):
        patient = attrs.get('patient', getattr(self.instance, 'patient', None))
        appointment = attrs.get(
            'appointment', getattr(self.instance, 'appointment', None)
        )
        if appointment and patient and appointment.patient_id != patient.id:
            raise serializers.ValidationError(
                {'appointment': 'The selected appointment belongs to a different patient.'}
            )
        return attrs


class AuditLogSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source='user.username', read_only=True)

    class Meta:
        model = AuditLog
        fields = [
            'id', 'username', 'action', 'resource_type', 'resource_id',
            'description', 'timestamp', 'ip_address', 'request_method',
            'request_path', 'success', 'metadata',
        ]
        read_only_fields = fields
