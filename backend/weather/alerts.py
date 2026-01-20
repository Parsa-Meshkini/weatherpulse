def build_alerts(forecast: dict) -> list[dict]:
    """
    Returns a list of alert objects:
      { "type": "rain"|"wind"|"uv"|"freeze"|"heat", "severity": "info"|"warning", "title": "...", "detail": "..." }
    """

    alerts = []

    current = (forecast or {}).get("current") or {}
    hourly = (forecast or {}).get("hourly") or {}
    daily = (forecast or {}).get("daily") or {}

    # ---------- RAIN ----------
    # Use daily precip probability max if available
    pmax_list = daily.get("precipitation_probability_max") or []
    if len(pmax_list) > 0:
        today_pmax = pmax_list[0]
        if today_pmax >= 80:
            alerts.append({
                "type": "rain",
                "severity": "warning",
                "title": "Rain very likely today",
                "detail": f"Chance of precipitation is {today_pmax}%."
            })
        elif today_pmax >= 60:
            alerts.append({
                "type": "rain",
                "severity": "info",
                "title": "Rain possible today",
                "detail": f"Chance of precipitation is {today_pmax}%."
            })

    # ---------- WIND ----------
    wind = current.get("wind_speed_10m")
    if wind is not None:
        if wind >= 45:
            alerts.append({
                "type": "wind",
                "severity": "warning",
                "title": "Strong winds",
                "detail": f"Current wind speed is ~{round(wind)} km/h."
            })
        elif wind >= 30:
            alerts.append({
                "type": "wind",
                "severity": "info",
                "title": "Breezy conditions",
                "detail": f"Current wind speed is ~{round(wind)} km/h."
            })

    # ---------- UV ----------
    uv = current.get("uv_index")
    if uv is not None:
        if uv >= 8:
            alerts.append({
                "type": "uv",
                "severity": "warning",
                "title": "High UV",
                "detail": f"UV index is {uv}. Consider sunscreen and shade."
            })
        elif uv >= 6:
            alerts.append({
                "type": "uv",
                "severity": "info",
                "title": "Moderate/High UV",
                "detail": f"UV index is {uv}. Protection recommended."
            })

    # ---------- FREEZE ----------
    tmin_list = daily.get("temperature_2m_min") or []
    if len(tmin_list) > 0:
        tonight_min = tmin_list[0]
        if tonight_min <= -5:
            alerts.append({
                "type": "freeze",
                "severity": "warning",
                "title": "Freezing risk overnight",
                "detail": f"Low is ~{round(tonight_min)}°C."
            })
        elif tonight_min <= 0:
            alerts.append({
                "type": "freeze",
                "severity": "info",
                "title": "Near-freezing temperatures",
                "detail": f"Low is ~{round(tonight_min)}°C."
            })

    # ---------- HEAT ----------
    tmax_list = daily.get("temperature_2m_max") or []
    if len(tmax_list) > 0:
        today_max = tmax_list[0]
        if today_max >= 32:
            alerts.append({
                "type": "heat",
                "severity": "warning",
                "title": "Heat risk",
                "detail": f"High is ~{round(today_max)}°C. Stay hydrated."
            })
        elif today_max >= 28:
            alerts.append({
                "type": "heat",
                "severity": "info",
                "title": "Warm day",
                "detail": f"High is ~{round(today_max)}°C."
            })

    # ---------- HOURLY HEAVY RAIN WINDOW ----------
    # Find any hour in next 12 with precip probability >= 70
    h_probs = hourly.get("precipitation_probability") or []
    h_times = hourly.get("time") or []
    if len(h_probs) >= 12 and len(h_times) >= 12:
        for i in range(12):
            if (h_probs[i] or 0) >= 70:
                alerts.append({
                    "type": "rain",
                    "severity": "warning",
                    "title": "Rain likely soon",
                    "detail": f"High precipitation probability around {h_times[i].replace('T',' ')} ({h_probs[i]}%)."
                })
                break

    return alerts
