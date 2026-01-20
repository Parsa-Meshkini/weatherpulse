from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView
from .views import alerts, weather_by_city, register, me, saved_locations, delete_saved_location, aqi, alerts, preferences, alert_subscriptions, delete_alert_subscription
from .auth import EmailOrUsernameTokenView


urlpatterns = [
    path("weather", weather_by_city),

    path("auth/register", register),
    path("auth/token", EmailOrUsernameTokenView.as_view(), name="token_obtain_pair"),
    path("auth/token/refresh", TokenRefreshView.as_view(), name="token_refresh"),
    path("me", me),
    path("saved-locations", saved_locations),
    path("saved-locations/<int:pk>", delete_saved_location),
    path("alert-subscriptions", alert_subscriptions),
    path("alert-subscriptions/<int:pk>", delete_alert_subscription),
    path("aqi", aqi),
    path("alerts", alerts),
    path("preferences", preferences),
]
