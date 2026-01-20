import time
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.decorators import api_view, permission_classes
from django.contrib.auth.models import User
from django.core.cache import cache
from django.conf import settings
import requests
from rest_framework_simplejwt.tokens import RefreshToken

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

@api_view(["POST"])
@permission_classes([AllowAny])
def google_auth(request):
    token = request.data.get("credential") or request.data.get("id_token")
    if not token:
        return Response({"detail": "Missing Google credential"}, status=status.HTTP_400_BAD_REQUEST)
    if not settings.GOOGLE_CLIENT_ID:
        return Response({"detail": "Google client is not configured"}, status=status.HTTP_503_SERVICE_UNAVAILABLE)

    try:
        res = requests.get(
            "https://oauth2.googleapis.com/tokeninfo",
            params={"id_token": token},
            timeout=10,
        )
        res.raise_for_status()
        payload = res.json()
    except requests.RequestException:
        return Response({"detail": "Google token verification failed"}, status=status.HTTP_401_UNAUTHORIZED)

    if payload.get("aud") != settings.GOOGLE_CLIENT_ID:
        return Response({"detail": "Invalid Google audience"}, status=status.HTTP_401_UNAUTHORIZED)

    email = payload.get("email")
    if not email:
        return Response({"detail": "Google account email not available"}, status=status.HTTP_400_BAD_REQUEST)

    name = payload.get("name") or ""
    first_name = payload.get("given_name") or (name.split(" ")[0] if name else "")
    last_name = payload.get("family_name") or (" ".join(name.split(" ")[1:]) if name else "")

    user = User.objects.filter(email__iexact=email).first()
    if not user:
        base_username = email.split("@")[0]
        username = base_username
        suffix = 1
        while User.objects.filter(username__iexact=username).exists():
            username = f"{base_username}{suffix}"
            suffix += 1
        user = User.objects.create(
            username=username,
            email=email,
            first_name=first_name,
            last_name=last_name,
        )
        user.set_unusable_password()
        user.save()

    refresh = RefreshToken.for_user(user)
    return Response(
        {
            "access": str(refresh.access_token),
            "refresh": str(refresh),
            "user": {"id": user.id, "username": user.username, "email": user.email},
        }
    )

@api_view(["GET"])
@permission_classes([AllowAny])
def news(request):
    if not settings.NEWS_API_KEY:
        return Response({"detail": "NEWS_API_KEY is not configured"}, status=status.HTTP_503_SERVICE_UNAVAILABLE)
    query = request.query_params.get("q") or settings.NEWS_QUERY
    cache_key = f"news:{query}"
    cached = cache.get(cache_key)
    if cached:
        return Response(cached)

    try:
        res = requests.get(
            "https://newsapi.org/v2/everything",
            params={
                "q": query,
                "pageSize": settings.NEWS_PAGE_SIZE,
                "sortBy": "publishedAt",
                "language": "en",
                "apiKey": settings.NEWS_API_KEY,
            },
            timeout=10,
        )
        res.raise_for_status()
        data = res.json()
        articles = data.get("articles") or []
        payload = {
            "articles": [
                {
                    "title": a.get("title"),
                    "url": a.get("url"),
                    "source": (a.get("source") or {}).get("name"),
                    "publishedAt": a.get("publishedAt"),
                    "image": a.get("urlToImage"),
                }
                for a in articles
            ]
        }
        cache.set(cache_key, payload, timeout=900)
        return Response(payload)
    except requests.RequestException:
        return Response({"detail": "News request failed"}, status=status.HTTP_502_BAD_GATEWAY)

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
