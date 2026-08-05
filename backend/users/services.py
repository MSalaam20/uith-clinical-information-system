import secrets
import string

from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import transaction

from .models import Role


User = get_user_model()

PROVISIONABLE_STAFF_ROLES = (
    Role.ROLE_DOCTOR,
    Role.ROLE_NURSE,
    Role.ROLE_RECEPTIONIST,
    Role.ROLE_COORDINATOR,
)


def generate_temporary_password(length=18):
    """Return a validator-friendly password generated with OS entropy."""
    alphabet = string.ascii_letters + string.digits + "!@#$%&*?"
    while True:
        password = "".join(secrets.choice(alphabet) for _ in range(length))
        if (
            any(char.islower() for char in password)
            and any(char.isupper() for char in password)
            and any(char.isdigit() for char in password)
            and any(char in "!@#$%&*?" for char in password)
        ):
            return password


def validate_account_password(password, user):
    try:
        validate_password(password, user=user)
    except DjangoValidationError as error:
        return list(error.messages)
    return []


@transaction.atomic
def set_temporary_password(user):
    password = generate_temporary_password()
    user.set_password(password)
    user.save(update_fields=["password"])
    profile = user.user
    profile.must_change_password = True
    profile.token_version += 1
    profile.save(update_fields=["must_change_password", "token_version"])
    return password
