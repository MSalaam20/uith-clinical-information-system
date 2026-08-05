from django.db import migrations
from django.utils import timezone
from django.utils.dateparse import parse_datetime


ICD11_TERMS = [
    ('1A00', 'Cholera', 'Certain infectious or parasitic diseases'),
    ('1A40', 'Malaria', 'Certain infectious or parasitic diseases'),
    ('5A11', 'Type 2 diabetes mellitus', 'Endocrine, nutritional or metabolic diseases'),
    ('BA00', 'Essential hypertension', 'Diseases of the circulatory system'),
    ('CA23', 'Acute upper respiratory infection', 'Diseases of the respiratory system'),
    ('MG30', 'Acute pain', 'Symptoms, signs or clinical findings'),
    ('9C83', 'Headache', 'Diseases of the nervous system'),
]


def seed_icd_and_map_legacy_records(apps, schema_editor):
    ICDCode = apps.get_model('records', 'ICDCode')
    Record = apps.get_model('records', 'Record')
    Visit = apps.get_model('records', 'Visit')
    VitalSign = apps.get_model('records', 'VitalSign')
    Diagnosis = apps.get_model('records', 'Diagnosis')
    ClinicalNote = apps.get_model('records', 'ClinicalNote')

    for code, title, chapter in ICD11_TERMS:
        ICDCode.objects.update_or_create(
            code=code,
            defaults={
                'title': title,
                'chapter': chapter,
                'terminology_version': 'ICD-11',
            },
        )

    for record in Record.objects.select_related('patient', 'specialist').iterator():
        findings = record.findings if isinstance(record.findings, dict) else {}
        complaint = findings.get('chief_complaint')
        visit_date = parse_datetime(str(findings.get('visit_date', '')))
        if not complaint or visit_date is None:
            continue
        if timezone.is_naive(visit_date):
            visit_date = timezone.make_aware(visit_date)

        visit, created = Visit.objects.get_or_create(
            patient_id=record.patient_id,
            visit_date=visit_date,
            chief_complaint=str(complaint)[:500],
            defaults={
                'status': 'completed',
                'clinical_summary': str(findings.get('notes', '')),
                'created_by_id': record.specialist_id,
            },
        )
        if not created:
            continue

        vitals = findings.get('vitals')
        if isinstance(vitals, dict):
            blood_pressure = str(vitals.get('blood_pressure', '')).split('/')
            systolic = int(blood_pressure[0]) if len(blood_pressure) == 2 and blood_pressure[0].isdigit() else None
            diastolic = int(blood_pressure[1]) if len(blood_pressure) == 2 and blood_pressure[1].isdigit() else None
            VitalSign.objects.create(
                visit_id=visit.id,
                measured_at=visit_date,
                temperature_c=vitals.get('temperature_c'),
                systolic_bp=systolic,
                diastolic_bp=diastolic,
                weight_kg=vitals.get('weight_kg'),
                recorded_by_id=record.specialist_id,
            )

        diagnosis = findings.get('diagnosis')
        if diagnosis:
            Diagnosis.objects.create(
                visit_id=visit.id,
                description=str(diagnosis)[:500],
                diagnosis_type='confirmed',
                diagnosed_by_id=record.specialist_id,
            )

        treatment = findings.get('treatment')
        if treatment:
            ClinicalNote.objects.create(
                visit_id=visit.id,
                note_type='legacy_treatment',
                note=str(treatment),
                author_id=record.specialist_id,
            )


class Migration(migrations.Migration):
    dependencies = [
        ('patients', '0003_populate_patient_uuid'),
        ('records', '0002_icdcode_medication_prescription_prescriptionitem_and_more'),
    ]

    operations = [
        migrations.RunPython(
            seed_icd_and_map_legacy_records,
            migrations.RunPython.noop,
        ),
    ]
