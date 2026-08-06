from users.models import Role


ROLE_CAPABILITIES = {
    Role.ROLE_ADMIN: {
        'display_name': 'Doctor-in-Charge / Clinic Administrator',
        'portal': 'staff',
        'default_route': '/clinic-overview',
        'capabilities': {
            'view_all_patients', 'create_intake', 'submit_to_nurse',
            'create_appointment_request',
            'review_nurse_queue', 'schedule_doctor', 'confirm_consultation',
            'start_consultation', 'complete_consultation', 'clinical_care',
            'manage_staff', 'view_audit_logs', 'archive_clinical_data',
            'reassign_cases', 'correct_workflow', 'view_all_queues',
        },
    },
    Role.ROLE_DOCTOR: {
        'display_name': 'Doctor',
        'portal': 'staff',
        'default_route': '/doctor-queue',
        'capabilities': {
            'view_assigned_patients', 'confirm_consultation',
            'start_consultation', 'complete_consultation', 'clinical_care',
        },
    },
    Role.ROLE_NURSE: {
        'display_name': 'Nurse',
        'portal': 'staff',
        'default_route': '/nurse-queue',
        'capabilities': {
            'review_nurse_queue', 'schedule_doctor', 'record_vitals',
            'create_appointment_request',
        },
    },
    Role.ROLE_RECEPTIONIST: {
        'display_name': 'Receptionist',
        'portal': 'staff',
        'default_route': '/reception/intake',
        'capabilities': {
            'search_patients', 'register_patients', 'create_intake',
            'submit_to_nurse', 'manage_student_accounts',
            'create_appointment_request',
        },
    },
    Role.ROLE_COORDINATOR: {
        'display_name': 'Clinical Officer',
        'portal': 'staff',
        'default_route': '/dashboard',
        'capabilities': {'view_clinic_summary'},
    },
    Role.ROLE_PATIENT: {
        'display_name': 'Student / Patient',
        'portal': 'student',
        'default_route': '/my-care',
        'capabilities': {'view_own_care_journey', 'view_own_health_record'},
    },
}


def roles_with_capability(capability):
    return tuple(
        role for role, configuration in ROLE_CAPABILITIES.items()
        if capability in configuration['capabilities']
    )


def role_configuration(role):
    return ROLE_CAPABILITIES.get(role, {})
