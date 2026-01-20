import requests

GEOCODE_URL = "https://geocoding-api.open-meteo.com/v1/search"
REVERSE_GEOCODE_URL = "https://geocoding-api.open-meteo.com/v1/reverse"
NOMINATIM_URL = "https://nominatim.openstreetmap.org/search"
FORECAST_URL = "https://api.open-meteo.com/v1/forecast"
AIR_QUALITY_URL = "https://air-quality-api.open-meteo.com/v1/air-quality"

def geocode_city(city: str):
    r = requests.get(
        GEOCODE_URL,
        params={"name": city, "count": 5, "language": "en", "format": "json"},
        timeout=10,
    )
    r.raise_for_status()
    data = r.json()
    results = data.get("results") or []
    if not results:
        return None

    top = results[0]
    return {
        "name": top.get("name"),
        "country": top.get("country"),
        "admin1": top.get("admin1"),
        "lat": top.get("latitude"),
        "lon": top.get("longitude"),
        "timezone": top.get("timezone") or "auto",
    }

def geocode_address(query: str):
    try:
        r = requests.get(
            NOMINATIM_URL,
            params={"q": query, "format": "json", "limit": 1, "addressdetails": 1},
            headers={"User-Agent": "WeatherPulse/1.0"},
            timeout=10,
        )
        r.raise_for_status()
        results = r.json() or []
        if not results:
            return None
        top = results[0]
        address = top.get("address") or {}
        name = address.get("attraction") or address.get("amenity") or address.get("road") or address.get("suburb")
        city = address.get("city") or address.get("town") or address.get("village")
        region = address.get("state") or address.get("province") or ""
        country = address.get("country") or ""
        return {
            "name": name or city or top.get("display_name", "").split(",")[0] or "Current location",
            "country": country,
            "admin1": region,
            "lat": float(top.get("lat")),
            "lon": float(top.get("lon")),
            "timezone": "auto",
        }
    except Exception:
        return None

def reverse_geocode(lat: float, lon: float):
    try:
        r = requests.get(
            REVERSE_GEOCODE_URL,
            params={"latitude": lat, "longitude": lon, "language": "en", "format": "json"},
            timeout=10,
        )
        r.raise_for_status()
        data = r.json()
        results = data.get("results") or []
        if not results:
            return None

        top = results[0]
        name = (
            top.get("name")
            or top.get("city")
            or top.get("town")
            or top.get("village")
            or top.get("admin2")
            or top.get("admin1")
            or "Current location"
        )
        return {
            "name": name,
            "country": top.get("country") or "",
            "admin1": top.get("admin1") or "",
            "lat": top.get("latitude") or lat,
            "lon": top.get("longitude") or lon,
            "timezone": top.get("timezone") or "auto",
        }
    except Exception:
        return None

def fetch_forecast(lat: float, lon: float, timezone: str = "auto"):
    params = {
        "latitude": lat,
        "longitude": lon,
        "timezone": timezone,
        "current": "temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m,wind_direction_10m,uv_index",
        "hourly": "temperature_2m,apparent_temperature,precipitation_probability,precipitation,weather_code,wind_speed_10m,uv_index",
        "daily": "weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,uv_index_max,sunrise,sunset",
    }
    r = requests.get(FORECAST_URL, params=params, timeout=10)
    r.raise_for_status()
    return r.json()

def fetch_aqi(lat: float, lon: float, timezone: str = "auto"):
    params = {
        "latitude": lat,
        "longitude": lon,
        "timezone": timezone,
        "current": "us_aqi,pm2_5,pm10,carbon_monoxide,nitrogen_dioxide,sulphur_dioxide,ozone",
    }
    r = requests.get(AIR_QUALITY_URL, params=params, timeout=10)
    r.raise_for_status()
    return r.json()
