from django.contrib.auth import get_user_model
from rest_framework import serializers
from rest_framework.exceptions import AuthenticationFailed, PermissionDenied
from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

from users.models import Role


STAFF_ROLES = {
    Role.ROLE_ADMIN,
    Role.ROLE_DOCTOR,
    Role.ROLE_NURSE,
    Role.ROLE_RECEPTIONIST,
    Role.ROLE_COORDINATOR,
}
STUDENT_ROLES = {Role.ROLE_PATIENT}


def _log_login(username, success, description, user=None):
    try:
        from records.audit import log_action

        log_action(
            user=user,
            action='login_succeeded' if success else 'login_failed',
            resource_type='User',
            resource_id=getattr(user, 'pk', None),
            description=description,
            success=success,
            metadata={'username': username},
        )
    except Exception:
        return


class PortalTokenObtainPairSerializer(TokenObtainPairSerializer):
    portal_type = serializers.ChoiceField(
        choices=('staff', 'student'), write_only=True, required=False, default='staff'
    )

    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        profile = getattr(user, 'user', None)
        token['auth_version'] = getattr(profile, 'token_version', 0)
        return token

    def validate(self, attrs):
        portal_type = attrs.pop('portal_type', 'staff')
        if portal_type not in {'staff', 'student'}:
            raise AuthenticationFailed('Unknown login portal.')

        username = attrs.get(self.username_field, '')
        if '@' in username:
            email_user = get_user_model().objects.filter(
                email__iexact=username.strip()
            ).first()
            if email_user:
                attrs[self.username_field] = email_user.get_username()
        try:
            data = super().validate(attrs)
        except AuthenticationFailed:
            user = get_user_model().objects.filter(username=username).first()
            _log_login(username, False, 'Invalid login credentials.', user)
            raise

        profile = getattr(self.user, 'user', None)
        if profile is None:
            _log_login(
                username, False, 'Account has no linked clinic profile.', self.user
            )
            raise AuthenticationFailed('No clinic profile is linked to this account.')

        allowed_roles = STAFF_ROLES if portal_type == 'staff' else STUDENT_ROLES
        if profile.role not in allowed_roles:
            _log_login(
                username,
                False,
                f'Account rejected by the {portal_type} portal.',
                self.user,
            )
            if portal_type == 'student':
                raise AuthenticationFailed(
                    'This account belongs to clinical staff. '
                    'Use the Clinical Staff Portal.'
                )
            raise AuthenticationFailed(
                'This account is not authorized for the Clinical Staff Portal.'
            )

        _log_login(username, True, f'Login through the {portal_type} portal.', self.user)
        return data

class ClinicJWTAuthentication(JWTAuthentication):
    password_change_paths = {
        '/api/profile/me/',
        '/api/account/change-password/',
    }

    def authenticate(self, request):
        authenticated = super().authenticate(request)
        if authenticated is None:
            return None

        user, validated_token = authenticated
        profile = getattr(user, 'user', None)
        token_version = int(validated_token.get('auth_version', 0))
        if profile and token_version != profile.token_version:
            raise AuthenticationFailed(
                'This session is no longer valid. Sign in again.',
                code='session_invalidated',
            )
        if (
            profile
            and profile.must_change_password
            and request.path not in self.password_change_paths
        ):
            raise PermissionDenied(
                'A password change is required before using the clinic portal.',
                code='password_change_required',
            )
        return user, validated_token
