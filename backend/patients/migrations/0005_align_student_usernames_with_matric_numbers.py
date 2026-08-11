from django.db import migrations


def align_student_usernames(apps, schema_editor):
    Patient = apps.get_model('patients', 'Patient')
    User = Patient._meta.get_field('user').remote_field.model

    linked_patients = Patient.objects.exclude(user_id=None).exclude(
        matric_number__isnull=True
    )
    for patient in linked_patients.iterator():
        matric_number = patient.matric_number.strip()
        if not matric_number:
            continue
        conflict = User.objects.filter(username__iexact=matric_number).exclude(
            pk=patient.user_id
        )
        if conflict.exists():
            raise RuntimeError(
                'Cannot use matriculation number '
                f'{matric_number!r} for linked patient {patient.pk}: '
                'another login account already uses it.'
            )
        User.objects.filter(pk=patient.user_id).update(username=matric_number)


class Migration(migrations.Migration):

    dependencies = [
        ('patients', '0004_clinicintakestatushistory_and_more'),
    ]

    operations = [
        migrations.RunPython(align_student_usernames, migrations.RunPython.noop),
    ]
