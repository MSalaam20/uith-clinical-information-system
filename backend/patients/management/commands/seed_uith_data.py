import os
from datetime import datetime

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.utils import timezone

from organization.models import Department, Organization
from patients.models import Appointment, Patient
from records.models import Record
from users.models import MedicalField, Position, Profile, Role


User = get_user_model()


def parse_local_datetime(value):
    naive_datetime = datetime.strptime(value, '%Y-%m-%d %H:%M')
    return timezone.make_aware(naive_datetime, timezone.get_current_timezone())


class Command(BaseCommand):
    help = 'Seed thesis-ready UITH School Complex Clinic data without Faker or mixer.'

    def handle(self, *args, **options):
        self.demo_password = os.environ.get('EHR_DEMO_PASSWORD')
        if not self.demo_password:
            raise CommandError(
                'Set EHR_DEMO_PASSWORD before running this demo-data command.'
            )

        with transaction.atomic():
            organization = self.seed_organization()
            clinic_department = self.seed_department(organization, 'UITH School Complex Clinic')
            nursing_department = self.seed_department(organization, 'Nursing Unit')
            records_department = self.seed_department(organization, 'Records and Front Desk')

            doctor_position = self.seed_position('Consultant Doctor')
            nurse_position = self.seed_position('Clinic Nurse')
            receptionist_position = self.seed_position('Receptionist')
            family_medicine = self.seed_medical_field('Family Medicine')

            doctor_profile = self.seed_staff_profile(
                username='dr.jeremiah',
                password=self.demo_password,
                first_name='Jeremiah',
                last_name='Adebayo',
                middle_name='Olufemi',
                email='jeremiah.adebayo@uithclinic.example.invalid',
                phone_number='08000000101',
                role=Role.ROLE_DOCTOR,
                medical_field=family_medicine,
                position=doctor_position,
                department=clinic_department,
                bio='Consultant physician responsible for student medical reviews and diagnosis.',
            )

            nurse_profile = self.seed_staff_profile(
                username='nurse.fatima',
                password=self.demo_password,
                first_name='Fatima',
                last_name='Suleiman',
                middle_name='Bilkisu',
                email='fatima.suleiman@uithclinic.example.invalid',
                phone_number='08000000102',
                role=Role.ROLE_NURSE,
                position=nurse_position,
                department=nursing_department,
                bio='Registered nurse handling triage, vitals, and follow-up documentation.',
            )

            receptionist_profile = self.seed_staff_profile(
                username='mr.ibrahim',
                password=self.demo_password,
                first_name='Ibrahim',
                last_name='Adamu',
                middle_name='Salisu',
                email='ibrahim.adamu@uithclinic.example.invalid',
                phone_number='08000000103',
                role=Role.ROLE_RECEPTIONIST,
                position=receptionist_position,
                department=records_department,
                bio='Front desk officer managing registration and appointment scheduling.',
            )

            students = [
                {
                    'matric_number': '2021/52HL034',
                    'first_name': 'Amina',
                    'middle_name': 'Binta',
                    'last_name': 'Sulaiman',
                    'department': 'Biochemistry',
                    'gender': Patient.Gender.FEMALE,
                    'date_of_birth': '2002-04-18',
                    'phone_number': '08000000001',
                    'email': 'amina.sulaiman@students.example.invalid',
                    'address': 'Tanke, Ilorin, Kwara State',
                    'chief_complaint': 'Fever, headache, and body pains',
                    'appointment_reason': 'Malaria rapid test and clinical review',
                    'investigation': 'Malaria RDT positive',
                    'diagnosis': 'Uncomplicated malaria',
                    'treatment': 'Artemether-lumefantrine and paracetamol',
                    'notes': 'Student reported three days of fever after evening lectures.',
                    'scheduled_for': '2026-05-12 09:00',
                },
                {
                    'matric_number': '2022/10AC112',
                    'first_name': 'Abdulrahman',
                    'middle_name': 'Taiwo',
                    'last_name': 'Bello',
                    'department': 'Accounting',
                    'gender': Patient.Gender.MALE,
                    'date_of_birth': '2001-11-02',
                    'phone_number': '08000000002',
                    'email': 'abdulrahman.bello@students.example.invalid',
                    'address': 'Oke-Odo, Ilorin, Kwara State',
                    'chief_complaint': 'Routine blood pressure check and stress headache',
                    'appointment_reason': 'Vital signs review',
                    'investigation': 'Blood pressure 128/82 mmHg',
                    'diagnosis': 'Mild stress-related headache',
                    'treatment': 'Rest advice, hydration, and paracetamol as needed',
                    'notes': 'Student requested check-up after a week of examinations.',
                    'scheduled_for': '2026-05-14 10:30',
                },
                {
                    'matric_number': '2020/31CS078',
                    'first_name': 'Temitope',
                    'middle_name': 'Ayomide',
                    'last_name': 'Afolabi',
                    'department': 'Computer Science',
                    'gender': Patient.Gender.MALE,
                    'date_of_birth': '2000-08-27',
                    'phone_number': '08000000003',
                    'email': 'temitope.afolabi@students.example.invalid',
                    'address': 'Sabo Oke, Ilorin, Kwara State',
                    'chief_complaint': 'Left ankle pain after football training',
                    'appointment_reason': 'Sports injury assessment',
                    'investigation': 'Soft tissue sprain, no fracture signs',
                    'diagnosis': 'Ankle sprain',
                    'treatment': 'Compression bandage, rest, and ice therapy',
                    'notes': 'Injury occurred during inter-departmental sports practice.',
                    'scheduled_for': '2026-05-16 15:00',
                },
                {
                    'matric_number': '2023/18MC090',
                    'first_name': 'Zainab',
                    'middle_name': 'Aminat',
                    'last_name': 'Yusuf',
                    'department': 'Mass Communication',
                    'gender': Patient.Gender.FEMALE,
                    'date_of_birth': '2003-02-09',
                    'phone_number': '08000000004',
                    'email': 'zainab.yusuf@students.example.invalid',
                    'address': 'UITH Road, Ilorin, Kwara State',
                    'chief_complaint': 'Abdominal discomfort and fever',
                    'appointment_reason': 'Typhoid fever evaluation',
                    'investigation': 'Typhoid test suggestive of infection',
                    'diagnosis': 'Suspected typhoid fever',
                    'treatment': 'Antibiotics, oral rehydration, and diet advice',
                    'notes': 'Symptoms started after weekend hostel meal.',
                    'scheduled_for': '2026-05-20 11:15',
                },
                {
                    'matric_number': '2021/45LS021',
                    'first_name': 'Afeez',
                    'middle_name': 'Sodiq',
                    'last_name': 'Jimoh',
                    'department': 'Law',
                    'gender': Patient.Gender.MALE,
                    'date_of_birth': '2001-09-14',
                    'phone_number': '08000000005',
                    'email': 'afeez.jimoh@students.example.invalid',
                    'address': 'Tudun Wada, Ilorin, Kwara State',
                    'chief_complaint': 'Dizziness during lectures',
                    'appointment_reason': 'Routine check and blood pressure monitoring',
                    'investigation': 'Blood pressure 122/78 mmHg',
                    'diagnosis': 'Mild dehydration',
                    'treatment': 'Fluid intake guidance and oral rehydration solution',
                    'notes': 'No history of chronic illness reported.',
                    'scheduled_for': '2026-05-23 09:40',
                },
                {
                    'matric_number': '2022/07NS054',
                    'first_name': 'Fatimah',
                    'middle_name': 'Hadiza',
                    'last_name': 'Mohammed',
                    'department': 'Nursing Science',
                    'gender': Patient.Gender.FEMALE,
                    'date_of_birth': '2002-12-01',
                    'phone_number': '08000000006',
                    'email': 'fatimah.mohammed@students.example.invalid',
                    'address': 'Oja-Oba, Ilorin, Kwara State',
                    'chief_complaint': 'Body weakness and low-grade fever',
                    'appointment_reason': 'Malaria screening',
                    'investigation': 'Malaria RDT positive',
                    'diagnosis': 'Uncomplicated malaria',
                    'treatment': 'Artemisinin-based combination therapy',
                    'notes': 'Student came after morning practicals with persistent fever.',
                    'scheduled_for': '2026-05-27 14:10',
                },
                {
                    'matric_number': '2020/62AG015',
                    'first_name': 'Kehinde',
                    'middle_name': 'Oluwaseun',
                    'last_name': 'Adeyemi',
                    'department': 'Agriculture',
                    'gender': Patient.Gender.MALE,
                    'date_of_birth': '2000-05-30',
                    'phone_number': '08000000007',
                    'email': 'kehinde.adeyemi@students.example.invalid',
                    'address': 'Basin Road, Ilorin, Kwara State',
                    'chief_complaint': 'Knee pain after training session',
                    'appointment_reason': 'Sports injury follow-up',
                    'investigation': 'Mild knee strain',
                    'diagnosis': 'Soft tissue sports injury',
                    'treatment': 'Topical analgesic and rest advice',
                    'notes': 'Player landed awkwardly during basketball drills.',
                    'scheduled_for': '2026-05-29 13:20',
                },
                {
                    'matric_number': '2023/11PA037',
                    'first_name': 'Ibrahim',
                    'middle_name': 'Abubakar',
                    'last_name': 'Sanni',
                    'department': 'Public Administration',
                    'gender': Patient.Gender.MALE,
                    'date_of_birth': '2003-07-11',
                    'phone_number': '08000000008',
                    'email': 'ibrahim.sanni@students.example.invalid',
                    'address': 'Surulere, Ilorin, Kwara State',
                    'chief_complaint': 'Fever and nausea',
                    'appointment_reason': 'Typhoid test and treatment review',
                    'investigation': 'Typhoid rapid test reactive',
                    'diagnosis': 'Suspected typhoid fever',
                    'treatment': 'Antibiotics, ORS, and soft diet',
                    'notes': 'Reported poor appetite and abdominal cramps for two days.',
                    'scheduled_for': '2026-06-03 10:50',
                },
                {
                    'matric_number': '2022/25MB066',
                    'first_name': 'Maryam',
                    'middle_name': 'Aishat',
                    'last_name': 'Kareem',
                    'department': 'Medicine and Surgery',
                    'gender': Patient.Gender.FEMALE,
                    'date_of_birth': '2002-03-24',
                    'phone_number': '08000000009',
                    'email': 'maryam.kareem@students.example.invalid',
                    'address': 'GRA, Ilorin, Kwara State',
                    'chief_complaint': 'Routine wellness visit and menstrual cramps',
                    'appointment_reason': 'General health check',
                    'investigation': 'Vitals within normal range',
                    'diagnosis': 'Primary dysmenorrhea',
                    'treatment': 'Analgesic and warm compress advice',
                    'notes': 'Student requested a wellness review before clinical posting.',
                    'scheduled_for': '2026-06-07 09:15',
                },
                {
                    'matric_number': '2021/14EC042',
                    'first_name': 'David',
                    'middle_name': 'Oluwadarasimi',
                    'last_name': 'Oyelowo',
                    'department': 'Economics',
                    'gender': Patient.Gender.MALE,
                    'date_of_birth': '2001-10-05',
                    'phone_number': '08000000010',
                    'email': 'david.oyelowo@students.example.invalid',
                    'address': 'Challenge, Ilorin, Kwara State',
                    'chief_complaint': 'Fever, chills, and weakness',
                    'appointment_reason': 'Malaria follow-up and lab review',
                    'investigation': 'Malaria RDT positive',
                    'diagnosis': 'Uncomplicated malaria',
                    'treatment': 'Antimalarial therapy and hydration advice',
                    'notes': 'Follow-up after previous self-medication did not improve symptoms.',
                    'scheduled_for': '2026-06-11 12:05',
                },
            ]

            for student in students:
                user = self.seed_student_user(student)
                patient = self.seed_patient(user, student)
                appointment = self.seed_appointment(
                    patient=patient,
                    booked_by=receptionist_profile,
                    attended_by=doctor_profile,
                    scheduled_for=student['scheduled_for'],
                    reason=student['appointment_reason'],
                    notes=student['notes'],
                    status=Appointment.Status.COMPLETED,
                )
                if student['matric_number'] in {
                    '2021/52HL034', '2022/10AC112', '2020/31CS078', '2023/18MC090', '2021/45LS021'
                }:
                    self.seed_record(
                        patient=patient,
                        specialist=doctor_profile,
                        appointment=appointment,
                        student=student,
                    )

        self.stdout.write(self.style.SUCCESS('UITH thesis seed data created successfully.'))

    def seed_organization(self):
        organization, _ = Organization.objects.update_or_create(
            this_one=True,
            defaults={
                'long_name': 'University of Ilorin Teaching Hospital (UITH) School Complex Clinic',
                'short_name': 'UITH School Complex Clinic',
                'address': 'University of Ilorin, Ilorin, Kwara State, Nigeria',
                'phone_number': '08000000000',
                'email': 'schoolclinic@example.invalid',
            },
        )
        return organization

    def seed_department(self, organization, department_name):
        department, _ = Department.objects.update_or_create(
            organization=organization,
            department=department_name,
            defaults={},
        )
        return department

    def seed_position(self, position_name):
        position, _ = Position.objects.update_or_create(name=position_name, defaults={})
        return position

    def seed_medical_field(self, field_name):
        medical_field, _ = MedicalField.objects.update_or_create(
            name=field_name,
            role=Role.ROLE_DOCTOR,
            defaults={},
        )
        return medical_field

    def seed_staff_profile(
        self,
        username,
        password,
        first_name,
        last_name,
        middle_name,
        email,
        phone_number,
        role,
        position,
        department,
        bio='',
        medical_field=None,
    ):
        existing_profile = Profile.objects.filter(user__username=username).first()
        if existing_profile and not existing_profile.is_demo:
            raise CommandError(
                f'Refusing to overwrite non-demo staff account {username!r}.'
            )
        user, _ = User.objects.update_or_create(
            username=username,
            defaults={
                'first_name': first_name,
                'last_name': last_name,
                'email': email,
            },
        )
        user.set_password(password)
        user.save(update_fields=['password', 'first_name', 'last_name', 'email'])

        profile, _ = Profile.objects.update_or_create(
            user=user,
            defaults={
                'role': role,
                'middle_name': middle_name,
                'phone_number': phone_number,
                'bio': bio,
                'medical_field': medical_field,
                'position': position,
                'departments': department,
                'is_demo': True,
            },
        )
        return profile

    def seed_student_user(self, student):
        username = student['matric_number']
        existing_profile = Profile.objects.filter(user__username=username).first()
        if existing_profile and not existing_profile.is_demo:
            raise CommandError(
                f'Refusing to overwrite non-demo student account {username!r}.'
            )
        user, _ = User.objects.update_or_create(
            username=username,
            defaults={
                'first_name': student['first_name'],
                'last_name': student['last_name'],
                'email': student['email'],
            },
        )
        user.set_password(self.demo_password)
        user.save(update_fields=['password', 'first_name', 'last_name', 'email'])

        Profile.objects.update_or_create(
            user=user,
            defaults={
                'role': Role.ROLE_PATIENT,
                'middle_name': student['middle_name'],
                'phone_number': student['phone_number'],
                'bio': f"Student patient profile for {student['matric_number']}.",
                'is_demo': True,
            },
        )
        return user

    def seed_patient(self, user, student):
        existing_patient = Patient.objects.filter(
            matric_number=student['matric_number']
        ).first()
        if existing_patient and not existing_patient.is_demo:
            raise CommandError(
                'Refusing to overwrite non-demo patient '
                f"{student['matric_number']!r}."
            )
        patient, _ = Patient.objects.update_or_create(
            matric_number=student['matric_number'],
            defaults={
                'user': user,
                'first_name': student['first_name'],
                'middle_name': student['middle_name'],
                'last_name': student['last_name'],
                'date_of_birth': student['date_of_birth'],
                'gender': student['gender'],
                'address': student['address'],
                'phone_number': student['phone_number'],
                'email': student['email'],
                'department': student['department'],
                'is_demo': True,
            },
        )
        return patient

    def seed_appointment(
        self,
        patient,
        booked_by,
        attended_by,
        scheduled_for,
        reason,
        notes,
        status,
    ):
        appointment_datetime = parse_local_datetime(scheduled_for)
        appointment, _ = Appointment.objects.update_or_create(
            patient=patient,
            scheduled_for=appointment_datetime,
            defaults={
                'reason': reason,
                'status': status,
                'booked_by': booked_by,
                'attended_by': attended_by,
                'notes': notes,
            },
        )
        return appointment

    def seed_record(self, patient, specialist, appointment, student):
        lookup = Record.objects.filter(
            patient=patient,
            findings__patient_matric=student['matric_number'],
            findings__visit_date=appointment.scheduled_for.strftime('%Y-%m-%d %H:%M'),
        ).first()
        findings = {
            'patient_matric': student['matric_number'],
            'patient_department': student['department'],
            'visit_date': appointment.scheduled_for.strftime('%Y-%m-%d %H:%M'),
            'chief_complaint': student['chief_complaint'],
            'investigation': student['investigation'],
            'diagnosis': student['diagnosis'],
            'treatment': student['treatment'],
            'vitals': {
                'temperature_c': 37.8 if 'malaria' in student['diagnosis'].lower() else 36.9,
                'blood_pressure': '120/80',
                'weight_kg': 68,
            },
            'notes': student['notes'],
        }
        if lookup:
            lookup.specialist = specialist
            lookup.findings = findings
            lookup.save(update_fields=['specialist', 'findings'])
            return
        Record.objects.create(
            patient=patient,
            specialist=specialist,
            findings=findings,
        )
