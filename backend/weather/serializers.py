from django.contrib.auth.models import User
from rest_framework import serializers
from .models import SavedLocation, AlertSubscription

class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=8)
    email = serializers.EmailField(required=True)

    class Meta:
        model = User
        fields = ["username", "email", "password", "first_name", "last_name"]

    def validate_email(self, value):
        if User.objects.filter(email__iexact=value).exists():
            raise serializers.ValidationError("Email already in use")
        return value

    def create(self, validated_data):
        user = User(
            username=validated_data["username"],
            email=validated_data["email"],
            first_name=validated_data.get("first_name", ""),
            last_name=validated_data.get("last_name", ""),
        )
        user.set_password(validated_data["password"])
        user.save()
        return user


class SavedLocationSerializer(serializers.ModelSerializer):
    class Meta:
        model = SavedLocation
        fields = ["id", "name", "country", "admin1", "lat", "lon", "timezone", "created_at"]
        read_only_fields = ["id", "created_at"]


class AlertSubscriptionSerializer(serializers.ModelSerializer):
    class Meta:
        model = AlertSubscription
        fields = ["id", "name", "country", "admin1", "lat", "lon", "timezone", "min_severity", "types", "created_at"]
        read_only_fields = ["id", "created_at"]

    def validate_types(self, value):
        allowed = {"rain", "wind", "uv", "freeze", "heat"}
        if not isinstance(value, list):
            raise serializers.ValidationError("types must be a list")
        invalid = [t for t in value if t not in allowed]
        if invalid:
            raise serializers.ValidationError(f"Invalid types: {', '.join(invalid)}")
        if not value:
            raise serializers.ValidationError("Select at least one type")
        return value
