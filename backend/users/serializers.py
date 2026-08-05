from rest_framework import serializers
from django.contrib.auth.models import User

from users.models import Profile, Role


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
            'role',
            'role_display',
            'middle_name',
            'phone_number',
            'medical_field',
            'position',
            'departments',
            ]


class StaffUserSerializer(serializers.ModelSerializer):
    role = serializers.CharField(source='user.role', read_only=True)
    role_display = serializers.CharField(
        source='user.get_role_display', read_only=True
    )

    class Meta:
        model = User
        fields = [
            'id', 'username', 'first_name', 'last_name', 'email',
            'is_active', 'role', 'role_display',
        ]


class StaffRoleSerializer(serializers.Serializer):
    role = serializers.ChoiceField(choices=Role.choices)

    def validate_role(self, value):
        if value == Role.ROLE_PATIENT:
            raise serializers.ValidationError(
                'Patient accounts must be managed through the patient workflow.'
            )
        return value
