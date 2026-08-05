from django.contrib.auth.models import User
from django.db import transaction
from rest_framework import serializers

from organization.models import Department
from users.models import Profile, Role
from users.services import (
    PROVISIONABLE_STAFF_ROLES,
    generate_temporary_password,
    validate_account_password,
)


class ProfileSerializer(serializers.ModelSerializer):
    first_name = serializers.CharField(
        source='user.first_name', read_only=True
        )
    last_name = serializers.CharField(
        source='user.last_name', read_only=True
        )
    username = serializers.CharField(
        source='user.username', read_only=True
        )
    email = serializers.EmailField(source='user.email', read_only=True)
    is_active = serializers.BooleanField(source='user.is_active', read_only=True)
    role_display = serializers.CharField(source='get_role_display', read_only=True)
    medical_field = serializers.StringRelatedField(
        read_only=True
        )
    position = serializers.StringRelatedField(
        read_only=True
        )

    class Meta:
        model = Profile
        fields = [
            'id',
            'user_id',
            'first_name',
            'last_name',
            'username',
            'email',
            'is_active',
            'role',
            'role_display',
            'middle_name',
            'phone_number',
            'medical_field',
            'position',
            'departments',
            'must_change_password',
            ]


class StaffUserSerializer(serializers.ModelSerializer):
    role = serializers.CharField(source='user.role', read_only=True)
    role_display = serializers.CharField(
        source='user.get_role_display', read_only=True
    )
    phone_number = serializers.CharField(source='user.phone_number', read_only=True)
    department = serializers.StringRelatedField(source='user.departments', read_only=True)
    department_id = serializers.IntegerField(
        source='user.departments_id', read_only=True
    )
    must_change_password = serializers.BooleanField(
        source='user.must_change_password', read_only=True
    )

    class Meta:
        model = User
        fields = [
            'id', 'username', 'first_name', 'last_name', 'email',
            'is_active', 'last_login', 'role', 'role_display', 'phone_number',
            'department', 'department_id', 'must_change_password',
        ]


class StaffCreateSerializer(serializers.Serializer):
    username = serializers.CharField(max_length=150)
    email = serializers.EmailField()
    first_name = serializers.CharField(max_length=150)
    last_name = serializers.CharField(max_length=150)
    phone_number = serializers.CharField(max_length=20, required=False, allow_blank=True)
    department = serializers.PrimaryKeyRelatedField(
        queryset=Department.objects.all(), required=False, allow_null=True
    )
    role = serializers.ChoiceField(
        choices=[(role, Role(role).label) for role in PROVISIONABLE_STAFF_ROLES]
    )
    is_active = serializers.BooleanField(default=True)
    temporary_password = serializers.CharField(
        write_only=True, required=False, trim_whitespace=False
    )

    def validate_username(self, value):
        value = value.strip()
        if User.objects.filter(username__iexact=value).exists():
            raise serializers.ValidationError('This username is already in use.')
        return value

    def validate_email(self, value):
        value = value.strip().lower()
        if User.objects.filter(email__iexact=value).exists():
            raise serializers.ValidationError('This email address is already in use.')
        return value

    def validate(self, attrs):
        password = attrs.get('temporary_password')
        if password:
            candidate = User(
                username=attrs.get('username', ''),
                email=attrs.get('email', ''),
                first_name=attrs.get('first_name', ''),
                last_name=attrs.get('last_name', ''),
            )
            errors = validate_account_password(password, candidate)
            if errors:
                raise serializers.ValidationError({'temporary_password': errors})
        return attrs

    @transaction.atomic
    def create(self, validated_data):
        department = validated_data.pop('department', None)
        phone_number = validated_data.pop('phone_number', '')
        role = validated_data.pop('role')
        password = validated_data.pop('temporary_password', None)
        password = password or generate_temporary_password()
        user = User(**validated_data)
        user.set_password(password)
        user.save()
        profile = user.user
        profile.role = role
        profile.phone_number = phone_number
        profile.departments = department
        profile.must_change_password = True
        profile.save(update_fields=[
            'role', 'phone_number', 'departments', 'must_change_password'
        ])
        self.temporary_password = password
        return user


class StaffRoleSerializer(serializers.Serializer):
    role = serializers.ChoiceField(choices=Role.choices)

    def validate_role(self, value):
        if value not in PROVISIONABLE_STAFF_ROLES and value != Role.ROLE_USER:
            raise serializers.ValidationError(
                'Use the protected bootstrap process for administrator accounts.'
            )
        return value


class StaffStatusSerializer(serializers.Serializer):
    is_active = serializers.BooleanField()


class ChangePasswordSerializer(serializers.Serializer):
    current_password = serializers.CharField(write_only=True, trim_whitespace=False)
    new_password = serializers.CharField(write_only=True, trim_whitespace=False)
    confirm_password = serializers.CharField(write_only=True, trim_whitespace=False)

    def validate_current_password(self, value):
        if not self.context['request'].user.check_password(value):
            raise serializers.ValidationError('The current password is incorrect.')
        return value

    def validate(self, attrs):
        if attrs['new_password'] != attrs['confirm_password']:
            raise serializers.ValidationError({
                'confirm_password': 'The new password confirmation does not match.'
            })
        user = self.context['request'].user
        if user.check_password(attrs['new_password']):
            raise serializers.ValidationError({
                'new_password': 'Choose a password different from the current password.'
            })
        errors = validate_account_password(attrs['new_password'], user)
        if errors:
            raise serializers.ValidationError({'new_password': errors})
        return attrs


class PasswordResetRequestSerializer(serializers.Serializer):
    email = serializers.EmailField()
    portal_type = serializers.ChoiceField(
        choices=('staff', 'student'), default='staff'
    )


class PasswordResetConfirmSerializer(serializers.Serializer):
    uid = serializers.CharField()
    token = serializers.CharField()
    new_password = serializers.CharField(write_only=True, trim_whitespace=False)
    confirm_password = serializers.CharField(write_only=True, trim_whitespace=False)

    def validate(self, attrs):
        if attrs['new_password'] != attrs['confirm_password']:
            raise serializers.ValidationError({
                'confirm_password': 'The password confirmation does not match.'
            })
        return attrs
