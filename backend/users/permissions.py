from rest_framework.permissions import BasePermission

from users.models import Role


class ClinicRolePermission(BasePermission):
    allowed_roles = ()

    def has_permission(self, request, view):
        profile = getattr(request.user, 'user', None)
        if request.user.is_staff or request.user.is_superuser:
            return True
        permitted = profile is not None and profile.role in self.allowed_roles
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
    pass


class CanManageAppointments(IsNurseReceptionistOrAdmin):
    pass


class CanUpdateAppointmentStatus(ClinicRolePermission):
    allowed_roles = (
        Role.ROLE_DOCTOR,
        Role.ROLE_NURSE,
        Role.ROLE_RECEPTIONIST,
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
