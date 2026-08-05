from rest_framework.permissions import BasePermission

from users.models import Role


class ClinicRolePermission(BasePermission):
    allowed_roles = ()

    def has_permission(self, request, view):
        profile = getattr(request.user, 'user', None)
        if request.user.is_staff or request.user.is_superuser:
            return True
        if profile is None:
            return False
        return profile.role in self.allowed_roles


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
        Role.ROLE_USER,
        Role.ROLE_COORDINATOR,
    )