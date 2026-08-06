from rest_framework.permissions import BasePermission

from users.capabilities import roles_with_capability
from users.models import Role


class ClinicRolePermission(BasePermission):
    allowed_roles = ()
    required_capability = None

    def get_allowed_roles(self):
        if self.required_capability:
            return roles_with_capability(self.required_capability)
        return self.allowed_roles

    def has_permission(self, request, view):
        profile = getattr(request.user, 'user', None)
        if request.user.is_staff or request.user.is_superuser:
            return True
        permitted = profile is not None and profile.role in self.get_allowed_roles()
        if not permitted and request.user.is_authenticated:
            self._audit_denial(request, view)
        return permitted

    @staticmethod
    def _audit_denial(request, view):
        try:
            from records.audit import log_action

            log_action(
                request=request,
                action='permission_denied',
                resource_type=view.__class__.__name__,
                description='Authenticated user was denied access.',
                success=False,
            )
        except Exception:
            return


class IsDoctorOrAdmin(ClinicRolePermission):
    allowed_roles = (Role.ROLE_DOCTOR, Role.ROLE_ADMIN)


class IsNurseReceptionistOrAdmin(ClinicRolePermission):
    allowed_roles = (
        Role.ROLE_NURSE,
        Role.ROLE_RECEPTIONIST,
        Role.ROLE_ADMIN,
    )


class IsDoctorNurseReceptionistOrAdmin(ClinicRolePermission):
    allowed_roles = (
        Role.ROLE_DOCTOR,
        Role.ROLE_NURSE,
        Role.ROLE_RECEPTIONIST,
        Role.ROLE_ADMIN,
    )


class IsAuthenticatedClinicUser(ClinicRolePermission):
    allowed_roles = (
        Role.ROLE_PATIENT,
        Role.ROLE_DOCTOR,
        Role.ROLE_NURSE,
        Role.ROLE_RECEPTIONIST,
        Role.ROLE_ADMIN,
        Role.ROLE_COORDINATOR,
    )


class IsAdministrator(ClinicRolePermission):
    allowed_roles = (Role.ROLE_ADMIN,)


class IsClinicalStaff(ClinicRolePermission):
    allowed_roles = (
        Role.ROLE_DOCTOR,
        Role.ROLE_NURSE,
        Role.ROLE_RECEPTIONIST,
        Role.ROLE_COORDINATOR,
        Role.ROLE_ADMIN,
    )


class CanManagePatients(IsNurseReceptionistOrAdmin):
    allowed_roles = (Role.ROLE_RECEPTIONIST, Role.ROLE_ADMIN)


class CanManageAppointments(IsNurseReceptionistOrAdmin):
    pass


class CanUpdateAppointmentStatus(ClinicRolePermission):
    allowed_roles = (
        Role.ROLE_DOCTOR,
        Role.ROLE_NURSE,
        Role.ROLE_ADMIN,
    )


class CanEditClinicalRecords(IsDoctorOrAdmin):
    pass


class CanRecordVitals(ClinicRolePermission):
    allowed_roles = (
        Role.ROLE_DOCTOR,
        Role.ROLE_NURSE,
        Role.ROLE_ADMIN,
    )


class CanWriteClinicalNotes(CanRecordVitals):
    pass


class CanManageStudentAccounts(ClinicRolePermission):
    allowed_roles = (Role.ROLE_ADMIN, Role.ROLE_RECEPTIONIST)


class IsDoctorInCharge(ClinicRolePermission):
    allowed_roles = (Role.ROLE_ADMIN,)


class IsDoctor(ClinicRolePermission):
    allowed_roles = (Role.ROLE_DOCTOR, Role.ROLE_ADMIN)


class IsNurse(ClinicRolePermission):
    allowed_roles = (Role.ROLE_NURSE, Role.ROLE_ADMIN)


class IsReceptionist(ClinicRolePermission):
    allowed_roles = (Role.ROLE_RECEPTIONIST, Role.ROLE_ADMIN)


class IsStudent(ClinicRolePermission):
    allowed_roles = (Role.ROLE_PATIENT,)


class CanCreateIntake(ClinicRolePermission):
    required_capability = 'create_intake'


class CanCreateAppointmentRequest(ClinicRolePermission):
    required_capability = 'create_appointment_request'


class CanSubmitToNurse(ClinicRolePermission):
    required_capability = 'submit_to_nurse'


class CanReviewNurseQueue(ClinicRolePermission):
    required_capability = 'review_nurse_queue'


class CanScheduleDoctor(ClinicRolePermission):
    required_capability = 'schedule_doctor'


class CanConfirmConsultation(ClinicRolePermission):
    required_capability = 'confirm_consultation'


class CanStartConsultation(ClinicRolePermission):
    required_capability = 'start_consultation'


class CanCompleteConsultation(ClinicRolePermission):
    required_capability = 'complete_consultation'


class CanManageStaff(ClinicRolePermission):
    required_capability = 'manage_staff'


class CanViewAuditLogs(ClinicRolePermission):
    required_capability = 'view_audit_logs'


class CanArchiveClinicalData(ClinicRolePermission):
    required_capability = 'archive_clinical_data'


class CanViewOwnCareJourney(ClinicRolePermission):
    required_capability = 'view_own_care_journey'


class CanViewClinicalRecords(ClinicRolePermission):
    allowed_roles = (Role.ROLE_DOCTOR, Role.ROLE_ADMIN, Role.ROLE_PATIENT)


class CanViewVitals(ClinicRolePermission):
    allowed_roles = (
        Role.ROLE_DOCTOR, Role.ROLE_NURSE, Role.ROLE_ADMIN, Role.ROLE_PATIENT,
    )
