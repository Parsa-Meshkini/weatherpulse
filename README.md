<div style="display:flex; align-items:center; gap:12px;">
  <img src="frontend/src/assets/logo-weatherpulse.svg" alt="WeatherPulse Logo" width="48" />
  <h1>WeatherPulse</h1>
</div>

<img src="frontend/src/assets/banner-weatherpulse.svg" alt="WeatherPulse Banner" width="720" />

A full-stack weather dashboard with accounts, saved locations, alerts, AQI insights, and a polished UI inspired by modern weather apps.

## Highlights

- City, place, and address search with live suggestions
- Current conditions, hourly chart, and 7-day outlook
- AQI details + health tips
- Saved locations with compare view
- Alert subscriptions (with optional email sender)
- Offline fallback + rate-limit handling with cached data
- Dark mode + custom UI theming

## Tech Stack

- Frontend: React + Vite + Tailwind CSS
- Backend: Django + DRF
- Auth: JWT
- Cache: Redis (optional, configured)

## Project Structure

```
weatherpulse/
  backend/
  frontend/
  docker-compose.yml
  .env
```

## Quick Start (Local)

Backend:
```
cd weatherpulse/backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python manage.py migrate
python manage.py runserver
```

Frontend:
```
cd weatherpulse/frontend
npm install
npm run dev
```

Open `http://localhost:5173`.

## Docker (Dev)

```
docker compose -f weatherpulse/docker-compose.yml up --build
```

## Environment Variables

`weatherpulse/.env`:
```
REDIS_URL=redis://localhost:6379/0
SENDGRID_API_KEY=
ALERTS_FROM_EMAIL=
ALERTS_MIN_INTERVAL_MINUTES=30
```

## Email Alerts (SendGrid)

The app stores alert subscriptions. To send emails, run the management command:
```
cd weatherpulse/backend
python manage.py send_alerts
```

Schedule it via cron every 15–30 minutes if desired.

## Notes

- Full address search uses OpenStreetMap Nominatim for geocoding.
- "Use my location" relies on browser geolocation permissions.
- Local time display respects user time format preferences.

## License

Private project (set your license as needed).
