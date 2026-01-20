import hashlib

def _hash(s: str) -> str:
    return hashlib.sha256(s.encode("utf-8")).hexdigest()[:16]

def weather_key(city: str) -> str:
    return f"wp:weather:{_hash(city.strip().lower())}"

def aqi_key(lat: float, lon: float, timezone: str) -> str:
    return f"wp:aqi:{lat:.4f}:{lon:.4f}:{timezone}"

def alerts_key(lat: float, lon: float, timezone: str) -> str:
    return f"wp:alerts:{lat:.4f}:{lon:.4f}:{timezone}"
