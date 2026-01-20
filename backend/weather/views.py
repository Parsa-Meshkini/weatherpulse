import time
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.decorators import api_view, permission_classes
from django.contrib.auth.models import User
from django.core.cache import cache

from .models import SavedLocation, UserPreference, AlertSubscription
from .serializers import RegisterSerializer, SavedLocationSerializer, AlertSubscriptionSerializer
from .services import geocode_city, geocode_address, reverse_geocode, fetch_forecast, fetch_aqi
from .alerts import build_alerts
from .pref_serializers import UserPreferenceSerializer
from .cache_keys import weather_key, aqi_key, alerts_key

_CACHE = {}
CACHE_SECONDS = 600  # 10 minutes

def _cache_get(key):
    item = _CACHE.get(key)
    if not item:
        return None
    expires_at, payload = item
    if time.time() > expires_at:
        _CACHE.pop(key, None)
        return None
    return payload

def _cache_set(key, payload):
    _CACHE[key] = (time.time() + CACHE_SECONDS, payload)

@api_view(["GET"])
@permission_classes([AllowAny])
def weather_by_city(request):
    city = (request.query_params.get("city") or "").strip()
    lat = request.query_params.get("lat")
    lon = request.query_params.get("lon")
    timezone = request.query_params.get("timezone", "auto")
    if not city and (lat is None or lon is None):
        return Response({"detail": "city query param is required"}, status=status.HTTP_400_BAD_REQUEST)

    if lat is not None and lon is not None:
        try:
            lat_f = float(lat)
            lon_f = float(lon)
        except ValueError:
            return Response({"detail": "lat and lon must be numbers"}, status=status.HTTP_400_BAD_REQUEST)

        key = weather_key(f"{lat_f}:{lon_f}:{timezone}")
        cached = cache.get(key)
        if cached:
            cached["cached"] = True
            return Response(cached)

        forecast = fetch_forecast(lat_f, lon_f, timezone)
        loc = reverse_geocode(lat_f, lon_f) or {
            "name": city or "Current location",
            "country": "",
            "admin1": "",
            "lat": lat_f,
            "lon": lon_f,
            "timezone": timezone,
        }
        payload = {"location": loc, "forecast": forecast, "cached": False}
        cache.set(key, payload, timeout=600)
        return Response(payload)

    key = weather_key(city)

    cached = cache.get(key)
    if cached:
        cached["cached"] = True
        return Response(cached)
    
    loc = geocode_city(city)
    if not loc:
        loc = geocode_address(city)
    if not loc:
        return Response({"detail": "City not found"}, status=status.HTTP_404_NOT_FOUND)

    forecast = fetch_forecast(loc["lat"], loc["lon"], loc["timezone"])
    payload = {"location": loc, "forecast": forecast, "cached": False}
    cache.set(key, payload, timeout=600)

    return Response(payload)

@api_view(["POST"])
@permission_classes([AllowAny])
def register(request):
    serializer = RegisterSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    user = serializer.save()
    return Response({"id": user.id, "username": user.username})

@api_view(["GET"])
@permission_classes([IsAuthenticated])
def me(request):
    u = request.user
    return Response({"id": u.id, "username": u.username, "email": u.email})

@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated])
def saved_locations(request):
    if request.method == "GET":
        qs = SavedLocation.objects.filter(user=request.user).order_by("-created_at")
        return Response(SavedLocationSerializer(qs, many=True).data)

    serializer = SavedLocationSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    SavedLocation.objects.create(user=request.user, **serializer.validated_data)
    return Response({"status": "saved"}, status=201)

@api_view(["DELETE"])
@permission_classes([IsAuthenticated])
def delete_saved_location(request, pk: int):
    SavedLocation.objects.filter(user=request.user, pk=pk).delete()
    return Response(status=204)

@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated])
def alert_subscriptions(request):
    if request.method == "GET":
        qs = AlertSubscription.objects.filter(user=request.user).order_by("-created_at")
        return Response(AlertSubscriptionSerializer(qs, many=True).data)

    serializer = AlertSubscriptionSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    sub = AlertSubscription.objects.create(user=request.user, **serializer.validated_data)
    return Response(AlertSubscriptionSerializer(sub).data, status=201)

@api_view(["DELETE"])
@permission_classes([IsAuthenticated])
def delete_alert_subscription(request, pk: int):
    AlertSubscription.objects.filter(user=request.user, pk=pk).delete()
    return Response(status=204)

@api_view(["GET"])
@permission_classes([AllowAny])
def aqi(request):
    lat = request.query_params.get("lat")
    lon = request.query_params.get("lon")
    timezone = request.query_params.get("timezone", "auto")

    if lat is None or lon is None:
        return Response({"detail": "lat and lon are required"}, status=status.HTTP_400_BAD_REQUEST)

    lat_f = float(lat)
    lon_f = float(lon)

    key = aqi_key(lat_f, lon_f, timezone)
    cached = cache.get(key)
    if cached:
        cached["cached"] = True
        return Response(cached)

    data = fetch_aqi(lat_f, lon_f, timezone)
    payload = {"aqi": data, "cached": False}
    cache.set(key, payload, timeout=900)

    return Response(payload)

@api_view(["GET"])
@permission_classes([AllowAny])
def alerts(request):
    lat = request.query_params.get("lat")
    lon = request.query_params.get("lon")
    timezone = request.query_params.get("timezone", "auto")

    if not lat or not lon:
        return Response({"detail": "lat and lon are required"}, status=status.HTTP_400_BAD_REQUEST)

    lat_f = float(lat)
    lon_f = float(lon)

    key = alerts_key(lat_f, lon_f, timezone)
    cached = cache.get(key)
    if cached:
        cached["cached"] = True
        return Response(cached)

    forecast = fetch_forecast(lat_f, lon_f, timezone)
    payload = {"alerts": build_alerts(forecast), "cached": False}
    cache.set(key, payload, timeout=600)
    return Response(payload)

@api_view(["GET", "PUT"])
@permission_classes([IsAuthenticated])
def preferences(request):
    prefs, _ = UserPreference.objects.get_or_create(user=request.user)

    if request.method == "GET":
        return Response(UserPreferenceSerializer(prefs).data)

    ser = UserPreferenceSerializer(prefs, data=request.data, partial=True)
    ser.is_valid(raise_exception=True)
    ser.save()
    return Response(ser.data)
