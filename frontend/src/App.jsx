import { useEffect, useMemo, useState } from "react";
import searchIcon from "./assets/search.svg";
import locationIcon from "./assets/location.svg";
import windIcon from "./assets/wind.svg";
import rainIcon from "./assets/rain.svg";
import uvIcon from "./assets/uv.svg";
import aqiIcon from "./assets/air-quality.svg";

const API_BASE = import.meta.env.VITE_API_BASE || "http://127.0.0.1:8000/api";

function getToken() {
  return localStorage.getItem("accessToken");
}
function setToken(token) {
  localStorage.setItem("accessToken", token);
}
function clearToken() {
  localStorage.removeItem("accessToken");
}

function Stat({ label, value, icon }) {
  return (
    <div className="stat-card">
      <div className="stat-label">
        {icon && <img src={icon} alt="" className="stat-icon" aria-hidden="true" />}
        {label}
      </div>
      <div className="stat-value">{value}</div>
    </div>
  );
}

function HourlyChart({ times, temps, precip, formatTemp }) {
  const [hoverIndex, setHoverIndex] = useState(0);
  const count = temps.length;
  if (!count) return null;

  const width = 640;
  const height = 180;
  const paddingX = 28;
  const paddingY = 26;
  const min = Math.min(...temps);
  const max = Math.max(...temps);
  const range = max - min || 1;

  const xFor = (i) =>
    paddingX + (i / (count - 1 || 1)) * (width - paddingX * 2);
  const yFor = (t) =>
    height - paddingY - ((t - min) / range) * (height - paddingY * 2);

  const pathD = temps
    .map((t, i) => `${i === 0 ? "M" : "L"} ${xFor(i).toFixed(2)} ${yFor(t).toFixed(2)}`)
    .join(" ");

  const areaD = `${pathD} L ${xFor(count - 1).toFixed(2)} ${height - paddingY} L ${xFor(0).toFixed(2)} ${height - paddingY} Z`;

  const onMove = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const ratio = (x - paddingX) / (width - paddingX * 2);
    const idx = Math.round(ratio * (count - 1));
    const clamped = Math.max(0, Math.min(count - 1, idx));
    setHoverIndex(clamped);
  };

  const activeTime = times[hoverIndex] || "";
  const activeTemp = temps[hoverIndex];
  const activePrecip = precip?.[hoverIndex] ?? 0;

  return (
    <div className="soft-card p-5 chart-wrap">
      <div className="section-title">Hourly Trend</div>
      <div className="chart-meta">
        <div className="chart-time">{activeTime.replace("T", " ")}</div>
        <div className="chart-temp">{formatTemp(activeTemp)}</div>
        <div className="chart-rain">Rain: {activePrecip}%</div>
      </div>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="hourly-chart"
        onMouseMove={onMove}
        onMouseLeave={() => setHoverIndex(0)}
        role="img"
        aria-label="Hourly temperature trend"
      >
        <defs>
          <linearGradient id="tempFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgba(125, 211, 252, 0.6)" />
            <stop offset="100%" stopColor="rgba(125, 211, 252, 0)" />
          </linearGradient>
        </defs>
        <path d={areaD} fill="url(#tempFill)" />
        <path d={pathD} className="chart-line" />
        {temps.map((t, i) => (
          <circle
            key={times[i] || i}
            cx={xFor(i)}
            cy={yFor(t)}
            r={i === hoverIndex ? 5 : 3}
            className={i === hoverIndex ? "chart-dot active" : "chart-dot"}
          />
        ))}
        <line
          x1={xFor(hoverIndex)}
          x2={xFor(hoverIndex)}
          y1={paddingY}
          y2={height - paddingY}
          className="chart-guide"
        />
      </svg>
    </div>
  );
}

function getFeelsLikeInsight(current) {
  if (!current) return null;
  const temp = current.temperature_2m;
  const apparent = current.apparent_temperature;
  const humidity = current.relative_humidity_2m;
  const wind = current.wind_speed_10m;
  const uv = current.uv_index;
  const precip = current.precipitation ?? 0;
  let headline = "Comfortable conditions";
  let detail = "Light winds and typical humidity.";

  if (temp >= 30 && humidity >= 60) {
    headline = "Hot and humid";
    detail = "Heat index can feel higher than the air temperature.";
  } else if (temp >= 30) {
    headline = "Hot conditions";
    detail = "Stay hydrated and take breaks in the shade.";
  } else if (temp <= 0 && wind >= 20) {
    headline = "Wind chill";
    detail = "Wind makes it feel colder than the air temperature.";
  } else if (precip > 0) {
    headline = "Wet conditions";
    detail = "Light precipitation can make surfaces slick.";
  } else if (uv !== null && uv !== undefined && uv >= 7) {
    headline = "High UV";
    detail = "Consider sunscreen and sunglasses outdoors.";
  } else if (Math.abs(apparent - temp) >= 3) {
    headline = "Feels different";
    detail = "Wind and humidity shift the perceived temperature.";
  }

  return { headline, detail };
}

function getAqiInsight(usAqi) {
  if (usAqi === null || usAqi === undefined) return null;
  if (usAqi <= 50) {
    return { label: "Good", detail: "Air quality is satisfactory for most people." };
  }
  if (usAqi <= 100) {
    return { label: "Moderate", detail: "Sensitive individuals should reduce prolonged outdoor exertion." };
  }
  if (usAqi <= 150) {
    return { label: "Unhealthy for sensitive groups", detail: "Limit outdoor activity if you are sensitive." };
  }
  if (usAqi <= 200) {
    return { label: "Unhealthy", detail: "Everyone should reduce prolonged outdoor exertion." };
  }
  if (usAqi <= 300) {
    return { label: "Very Unhealthy", detail: "Avoid outdoor activity if possible." };
  }
  return { label: "Hazardous", detail: "Remain indoors and avoid all outdoor exertion." };
}

async function apiFetch(path, { token, ...opts } = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    ...opts,
    headers: {
      "Content-Type": "application/json",
      ...(opts.headers || {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    // ignore
  }
  if (!res.ok) {
    const msg = json?.detail || json?.non_field_errors?.[0] || "Request failed";
    throw new Error(msg);
  }
  return json;
}

function cacheSet(key, value) {
  localStorage.setItem(key, JSON.stringify({ ts: Date.now(), value }));
}

function cacheGet(key) {
  const raw = localStorage.getItem(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw).value;
  } catch {
    return null;
  }
}

function cacheGetMeta(key) {
  const raw = localStorage.getItem(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function formatCacheTime(ts) {
  if (!ts) return "";
  return new Date(ts).toLocaleString();
}

async function fetchJson(url) {
  const res = await fetch(url);
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    // ignore
  }
  if (!res.ok) {
    const msg = json?.detail || "Request failed";
    const err = new Error(msg);
    err.status = res.status;
    err.body = json;
    throw err;
  }
  return json;
}

export default function App() {
  // weather
  const [city, setCity] = useState("Toronto");
  const [data, setData] = useState(null);
  const [loadingWeather, setLoadingWeather] = useState(false);
  const [weatherErr, setWeatherErr] = useState("");
  const [weatherNotice, setWeatherNotice] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [suggestLoading, setSuggestLoading] = useState(false);
  const [suggestErr, setSuggestErr] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);

  // aqi
  const [aqiData, setAqiData] = useState(null);
  const [aqiErr, setAqiErr] = useState("");
  const [aqiNotice, setAqiNotice] = useState("");

  // alerts
  const [alertsData, setAlertsData] = useState([]);
  const [alertsErr, setAlertsErr] = useState("");
  const [alertsNotice, setAlertsNotice] = useState("");

  // auth
  const [token, setTokenState] = useState(getToken());
  const [me, setMe] = useState(null);
  const [authMode, setAuthMode] = useState("login"); // login | register
  const [identifier, setIdentifier] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authErr, setAuthErr] = useState("");
  const [authLoading, setAuthLoading] = useState(false);

  // saved locations
  const [saved, setSaved] = useState([]);
  const [savedLoading, setSavedLoading] = useState(false);
  const [savedErr, setSavedErr] = useState("");
  const [compareIds, setCompareIds] = useState([]);
  const [compareData, setCompareData] = useState({});
  const [compareLoading, setCompareLoading] = useState(false);
  const [compareErr, setCompareErr] = useState("");
  const [alertSubs, setAlertSubs] = useState([]);
  const [alertSubsLoading, setAlertSubsLoading] = useState(false);
  const [alertSubsErr, setAlertSubsErr] = useState("");
  const [alertTypes, setAlertTypes] = useState(["rain", "wind", "uv", "freeze", "heat"]);
  const [alertSeverity, setAlertSeverity] = useState("info");

  // preferences (frontend)
  const [unit, setUnit] = useState(localStorage.getItem("wp_unit") || "C"); // "C" | "F"
  const [theme, setTheme] = useState(localStorage.getItem("wp_theme") || "light"); // "light" | "dark"
  const [timeFormat, setTimeFormat] = useState(localStorage.getItem("wp_time_format") || "24"); // "12" | "24"

  const current = data?.forecast?.current;
  const hourly = data?.forecast?.hourly;
  const daily = data?.forecast?.daily;
  const feelsInsight = useMemo(() => getFeelsLikeInsight(current), [current]);
  const aqiInsight = useMemo(
    () => getAqiInsight(aqiData?.aqi?.current?.us_aqi),
    [aqiData?.aqi?.current?.us_aqi]
  );

  async function fetchWeather(cityName) {
    setWeatherErr("");
    setWeatherNotice("");
    setLoadingWeather(true);
    setData(null);
    try {
      const json = await fetchJson(`${API_BASE}/weather?city=${encodeURIComponent(cityName)}`);
      setData(json);
      cacheSet(`wp_cache_weather:${cityName.toLowerCase()}`, json);
      await fetchAQIForLocation(json.location);
      await fetchAlertsForLocation(json.location);
    } catch (e) {
      const cachedMeta = cacheGetMeta(`wp_cache_weather:${cityName.toLowerCase()}`);
      const cached = cachedMeta?.value;
      if (cached) {
        setData({ ...cached, cached: true, cached_local: true });
        const when = formatCacheTime(cachedMeta?.ts);
        setWeatherNotice(
          e.status === 429
            ? `Rate limited. Showing cached weather data${when ? ` (last updated ${when})` : ""}.`
            : `Offline or unavailable. Showing cached weather data${when ? ` (last updated ${when})` : ""}.`
        );
        if (cached.location) {
          await fetchAQIForLocation(cached.location, { allowCache: true });
          await fetchAlertsForLocation(cached.location, { allowCache: true });
        }
      } else {
        setWeatherErr(e.message);
      }
    } finally {
      setLoadingWeather(false);
    }
  }

  async function fetchWeatherByCoords(lat, lon) {
    setWeatherErr("");
    setWeatherNotice("");
    setLoadingWeather(true);
    setData(null);
    const key = `wp_cache_weather:${lat}:${lon}`;
    try {
      const res = await fetch(`${API_BASE}/weather?lat=${lat}&lon=${lon}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.detail || "Request failed");
      setData(json);
      cacheSet(key, json);
      await fetchAQIForLocation(json.location);
      await fetchAlertsForLocation(json.location);
    } catch (e) {
      const cachedMeta = cacheGetMeta(key);
      const cached = cachedMeta?.value;
      if (cached) {
        setData({ ...cached, cached: true, cached_local: true });
        const when = formatCacheTime(cachedMeta?.ts);
        setWeatherNotice(
          e.status === 429
            ? `Rate limited. Showing cached weather data${when ? ` (last updated ${when})` : ""}.`
            : `Offline or unavailable. Showing cached weather data${when ? ` (last updated ${when})` : ""}.`
        );
        if (cached.location) {
          await fetchAQIForLocation(cached.location, { allowCache: true });
          await fetchAlertsForLocation(cached.location, { allowCache: true });
        }
      } else {
        setWeatherErr(e.message);
      }
    } finally {
      setLoadingWeather(false);
    }
  }

  function useMyLocation() {
    if (!navigator.geolocation) {
      setWeatherErr("Geolocation is not supported by this browser.");
      return;
    }
    setWeatherErr("");
    setWeatherNotice("");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        fetchWeatherByCoords(latitude.toFixed(4), longitude.toFixed(4));
      },
      () => {
        setWeatherErr("Unable to access your location. Check browser permissions.");
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  }
  useEffect(() => {
    const term = city.trim();
    if (term.length < 2) {
      setSuggestions([]);
      setSuggestErr("");
      return;
    }
    const controller = new AbortController();
    const id = setTimeout(async () => {
      setSuggestLoading(true);
      setSuggestErr("");
      try {
        const res = await fetch(
          `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(
            term
          )}&count=5&language=en&format=json`,
          { signal: controller.signal }
        );
        const json = await res.json();
        const results = json?.results || [];
        const enriched = await Promise.allSettled(
          results.map(async (r) => {
            const forecastRes = await fetch(
              `https://api.open-meteo.com/v1/forecast?latitude=${r.latitude}&longitude=${r.longitude}&current=temperature_2m,apparent_temperature&timezone=auto`,
              { signal: controller.signal }
            );
            const forecastJson = await forecastRes.json();
            const current = forecastJson?.current || {};
            return {
              id: `${r.latitude}:${r.longitude}`,
              name: r.name,
              country: r.country,
              admin1: r.admin1,
              temp: current.temperature_2m,
              feels: current.apparent_temperature,
            };
          })
        );
        const list = enriched
          .filter((r) => r.status === "fulfilled")
          .map((r) => r.value);
        setSuggestions(list);
      } catch (e) {
        if (e.name !== "AbortError") {
          setSuggestErr("Unable to load suggestions.");
          setSuggestions([]);
        }
      } finally {
        setSuggestLoading(false);
      }
    }, 350);

    return () => {
      controller.abort();
      clearTimeout(id);
    };
  }, [city]);

  async function fetchAlertsForLocation(loc, { allowCache } = {}) {
    setAlertsErr("");
    setAlertsNotice("");
    try {
      const json = await fetchJson(
        `${API_BASE}/alerts?lat=${loc.lat}&lon=${loc.lon}&timezone=${encodeURIComponent(loc.timezone || "auto")}`
      );
      setAlertsData(json.alerts || []);
      cacheSet(`wp_cache_alerts:${loc.lat}:${loc.lon}:${loc.timezone || "auto"}`, json);
    } catch (e) {
      const cachedMeta = cacheGetMeta(`wp_cache_alerts:${loc.lat}:${loc.lon}:${loc.timezone || "auto"}`);
      const cached = cachedMeta?.value;
      if (cached && allowCache) {
        setAlertsData(cached.alerts || []);
        const when = formatCacheTime(cachedMeta?.ts);
        setAlertsNotice(
          e.status === 429
            ? `Rate limited. Showing cached alerts${when ? ` (last updated ${when})` : ""}.`
            : `Offline or unavailable. Showing cached alerts${when ? ` (last updated ${when})` : ""}.`
        );
      } else {
        setAlertsErr(e.message);
        setAlertsData([]);
      }
    }
  }
  
  async function savePrefs(next) {
    if (!token) return;
    try {
      await apiFetch("/preferences", {
        token,
        method: "PUT",
        body: JSON.stringify(next),
      });
    } catch {
      // ignore
    }
  }
  // persist preferences
  useEffect(() => {
    localStorage.setItem("wp_unit", unit);
  }, [unit]);

  useEffect(() => {
    localStorage.setItem("wp_theme", theme);
    document.documentElement.classList.toggle("dark", theme === "dark");
  }, [theme]);

  useEffect(() => {
    localStorage.setItem("wp_time_format", timeFormat);
  }, [timeFormat]);

  function formatTemp(celsius) {
    if (celsius === null || celsius === undefined) return "-";
    if (unit === "C") return `${Math.round(celsius)}°C`;
    return `${Math.round((celsius * 9) / 5 + 32)}°F`;
  }

  function formatLocalTime(timezone) {
    if (!timezone) return "";
    try {
      return new Intl.DateTimeFormat("en-US", {
        timeZone: timezone === "auto" ? undefined : timezone,
        hour: "2-digit",
        minute: "2-digit",
        hour12: timeFormat === "12",
      }).format(new Date());
    } catch {
      return "";
    }
  }


  async function loadMeAndSaved(tkn) {
    setSavedErr("");
    setSavedLoading(true);
    setAlertSubsErr("");
    setAlertSubsLoading(true);
    let authFailed = false;
    try {
      const meJson = await apiFetch("/me", { token: tkn });
      setMe(meJson);
      const prefJson = await apiFetch("/preferences", { token: tkn });
      if (prefJson?.unit) setUnit(prefJson.unit);
      if (prefJson?.theme) setTheme(prefJson.theme);
      if (prefJson?.time_format) setTimeFormat(prefJson.time_format);


      const savedJson = await apiFetch("/saved-locations", { token: tkn });
      setSaved(savedJson);
    } catch (e) {
      const msg = String(e?.message || "");
      setSavedErr(msg);
      setAuthErr(msg);
      setMe(null);
      setSaved([]);
      authFailed = true;
      if (msg.toLowerCase().includes("token") || msg.toLowerCase().includes("credential") || msg.toLowerCase().includes("auth")) {
        clearToken();
        setTokenState(null);
      }
    } finally {
      setSavedLoading(false);
    }

    if (!authFailed) {
      try {
        const subsJson = await apiFetch("/alert-subscriptions", { token: tkn });
        setAlertSubs(subsJson);
      } catch (e) {
        setAlertSubsErr(e.message);
      } finally {
        setAlertSubsLoading(false);
      }
    } else {
      setAlertSubsLoading(false);
    }
  }

  useEffect(() => {
    // initial weather load
    fetchWeather(city);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (token) loadMeAndSaved(token);
    else {
      setMe(null);
      setSaved([]);
      setAlertSubs([]);
    }
  }, [token]);

  useEffect(() => {
    let active = true;
    if (compareIds.length === 0) {
      setCompareData({});
      setCompareErr("");
      return;
    }
    const selected = saved.filter((loc) => compareIds.includes(loc.id));
    setCompareLoading(true);
    setCompareErr("");
    Promise.all(
      selected.map(async (loc) => {
        const res = await fetch(`${API_BASE}/weather?city=${encodeURIComponent(loc.name)}`);
        const json = await res.json();
        if (!res.ok) throw new Error(json.detail || "Compare request failed");
        return [loc.id, { loc, data: json }];
      })
    )
      .then((entries) => {
        if (!active) return;
        setCompareData(Object.fromEntries(entries));
      })
      .catch((e) => {
        if (!active) return;
        setCompareErr(e.message);
      })
      .finally(() => {
        if (!active) return;
        setCompareLoading(false);
      });

    return () => {
      active = false;
    };
  }, [compareIds, saved]);

  async function onWeatherSearch(e) {
    e.preventDefault();
    fetchWeather(city);
  }

  async function onAuthSubmit(e) {
    e.preventDefault();
    setAuthErr("");
    setAuthLoading(true);

    try {
      if (authMode === "register") {
        // register
        await apiFetch("/auth/register", {
          method: "POST",
          body: JSON.stringify({ username, email, password }),
        });

        // auto-login after register
        const tok = await apiFetch("/auth/token", {
          method: "POST",
          body: JSON.stringify({ identifier: email, password }),
        });

        setToken(tok.access);
        setTokenState(tok.access);
      } else {
        // login: email OR username in identifier
        const tok = await apiFetch("/auth/token", {
          method: "POST",
          body: JSON.stringify({ identifier, password }),
        });
        setToken(tok.access);
        setTokenState(tok.access);
      }
    } catch (e2) {
      setAuthErr(e2.message);
    } finally {
      setAuthLoading(false);
    }
  }

  function logout() {
    clearToken();
    setTokenState(null);
    setIdentifier("");
    setPassword("");
    setAuthErr("");
  }

  async function saveCurrentLocation() {
    if (!token || !data?.location) return;
    setSavedErr("");
    try {
      await apiFetch("/saved-locations", {
        token,
        method: "POST",
        body: JSON.stringify({
          name: data.location.name,
          country: data.location.country || "",
          admin1: data.location.admin1 || "",
          lat: data.location.lat,
          lon: data.location.lon,
          timezone: data.location.timezone || "auto",
        }),
      });
      const savedJson = await apiFetch("/saved-locations", { token });
      setSaved(savedJson);
    } catch (e) {
      setSavedErr(e.message);
    }
  }

  async function deleteSaved(id) {
    if (!token) return;
    setSavedErr("");
    try {
      await apiFetch(`/saved-locations/${id}`, { token, method: "DELETE" });
      setSaved((prev) => prev.filter((x) => x.id !== id));
    } catch (e) {
      setSavedErr(e.message);
    }
  }

  function toggleAlertType(type) {
    setAlertTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
    );
  }

  async function createAlertSubscription() {
    if (!token || !data?.location) return;
    setAlertSubsErr("");
    try {
      const payload = {
        name: data.location.name,
        country: data.location.country || "",
        admin1: data.location.admin1 || "",
        lat: data.location.lat,
        lon: data.location.lon,
        timezone: data.location.timezone || "auto",
        min_severity: alertSeverity,
        types: alertTypes,
      };
      const sub = await apiFetch("/alert-subscriptions", {
        token,
        method: "POST",
        body: JSON.stringify(payload),
      });
      setAlertSubs((prev) => [sub, ...prev]);
    } catch (e) {
      setAlertSubsErr(e.message);
    }
  }

  async function deleteAlertSubscription(id) {
    if (!token) return;
    setAlertSubsErr("");
    try {
      await apiFetch(`/alert-subscriptions/${id}`, { token, method: "DELETE" });
      setAlertSubs((prev) => prev.filter((x) => x.id !== id));
    } catch (e) {
      setAlertSubsErr(e.message);
    }
  }

  async function loadSavedLocation(loc) {
    // Just reuse city search by using stored name; simple version
    setCity(loc.name);
    fetchWeather(loc.name);
  }

  function moveSaved(id, dir) {
    setSaved((prev) => {
      const idx = prev.findIndex((x) => x.id === id);
      if (idx < 0) return prev;
      const nextIdx = dir === "up" ? idx - 1 : idx + 1;
      if (nextIdx < 0 || nextIdx >= prev.length) return prev;
      const copy = [...prev];
      [copy[idx], copy[nextIdx]] = [copy[nextIdx], copy[idx]];
      return copy;
    });
  }

  function toggleCompare(id) {
    setCompareIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  async function fetchAQIForLocation(loc, { allowCache } = {}) {
  setAqiErr("");
  setAqiNotice("");
  setAqiData(null);
  try {
    const json = await fetchJson(
      `${API_BASE}/aqi?lat=${loc.lat}&lon=${loc.lon}&timezone=${encodeURIComponent(loc.timezone || "auto")}`
    );
    setAqiData(json);
    cacheSet(`wp_cache_aqi:${loc.lat}:${loc.lon}:${loc.timezone || "auto"}`, json);
  } catch (e) {
    const cachedMeta = cacheGetMeta(`wp_cache_aqi:${loc.lat}:${loc.lon}:${loc.timezone || "auto"}`);
    const cached = cachedMeta?.value;
    if (cached && allowCache) {
      setAqiData({ ...cached, cached: true, cached_local: true });
      const when = formatCacheTime(cachedMeta?.ts);
      setAqiNotice(
        e.status === 429
          ? `Rate limited. Showing cached AQI${when ? ` (last updated ${when})` : ""}.`
          : `Offline or unavailable. Showing cached AQI${when ? ` (last updated ${when})` : ""}.`
      );
    } else {
      setAqiErr(e.message);
    }
  }
}


  return (
    <div className="min-h-screen p-6 sm:p-8 app-bg">
      <div className="live-aurora" aria-hidden="true">
        <span className="live-orb orb-one" />
        <span className="live-orb orb-two" />
        <span className="live-orb orb-three" />
        <span className="live-sheen" />
      </div>
      <div className="max-w-6xl mx-auto space-y-6 app-shell">
        <header className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight">WeatherPulse</h1>
              <p className="text-sm sm:text-base text-subtle">
                Weather dashboard with accounts + saved locations. Login supports{" "}
                <span className="font-medium">email or username</span>.
              </p>
            </div>
            <div className="flex gap-2 items-center">
              <button
                onClick={() => {
                  setUnit((u) => {
                    const next = u === "C" ? "F" : "C";
                    savePrefs({ unit: next });
                    return next;
                  });
                }}
                className="chip"
                title="Toggle units"
              >
                Units: °{unit}
              </button>

              <button
                onClick={() => {
                  setTheme((t) => {
                    const next = t === "light" ? "dark" : "light";
                    savePrefs({ theme: next });
                    return next;
                  });
                }}
                className="chip"
                title="Toggle theme"
              >
                Theme: {theme}
              </button>
              <button
                onClick={() => {
                  setTimeFormat((t) => {
                    const next = t === "24" ? "12" : "24";
                    savePrefs({ time_format: next });
                    return next;
                  });
                }}
                className="chip"
                title="Toggle time format"
              >
                Time: {timeFormat}h
              </button>
            </div>
          </div>
          {data?.location && current && (
            <div className="hero-card float-in">
              <div>
                <div className="hero-kicker">Now</div>
                <div className="text-2xl sm:text-3xl font-semibold">
                  {data.location.name}
                  {data.location.admin1 ? `, ${data.location.admin1}` : ""}
                  {data.location.country ? ` — ${data.location.country}` : ""}
                </div>
                <div className="text-subtle text-sm">
                  Local time:{" "}
                  {formatLocalTime(
                    data.location.timezone === "auto" ? data.forecast?.timezone : data.location.timezone
                  ) || "—"}{" "}
                  • Timezone: {data.location.timezone === "auto" ? data.forecast?.timezone : data.location.timezone} •{" "}
                  {data.cached ? "cached" : "fresh"}
                </div>
              </div>
              <div className="text-right">
                <div className="temp-display">{formatTemp(current.temperature_2m)}</div>
                <div className="text-subtle">Feels {formatTemp(current.apparent_temperature)}</div>
                {feelsInsight && (
                  <div className="mt-2 text-xs text-subtle">
                    <span className="font-semibold">{feelsInsight.headline}</span> • {feelsInsight.detail}
                  </div>
                )}
              </div>
            </div>
          )}
        </header>

        {/* Auth */}
        <div className="glass-card p-5 sm:p-6 float-in" style={{ animationDelay: "40ms" }}>
          <div className="flex items-center justify-between mb-3">
            <div className="section-title">Account</div>
            {token ? (
              <button onClick={logout} className="chip chip-ghost">
                Logout
              </button>
            ) : (
              <div className="flex gap-3">
                <button
                  onClick={() => setAuthMode("login")}
                  className={`chip chip-ghost ${authMode === "login" ? "chip-active" : ""}`}
                >
                  Login
                </button>
                <button
                  onClick={() => setAuthMode("register")}
                  className={`chip chip-ghost ${authMode === "register" ? "chip-active" : ""}`}
                >
                  Register
                </button>
              </div>
            )}
          </div>

          {token && me ? (
            <div className="text-sm text-subtle">
              Logged in as <span className="font-semibold">{me.username}</span> ({me.email || "no email"})
            </div>
          ) : !token ? (
            <form onSubmit={onAuthSubmit} className="grid gap-3 md:grid-cols-2">
              {authMode === "register" ? (
                <>
                  <input
                    className="input-field"
                    placeholder="Username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required
                  />
                  <input
                    className="input-field"
                    placeholder="Email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                  <input
                    className="input-field md:col-span-2"
                    placeholder="Password (min 8 chars)"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </>
              ) : (
                <>
                  <input
                    className="input-field"
                    placeholder="Email or username"
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    required
                  />
                  <input
                    className="input-field"
                    placeholder="Password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </>
              )}

              <button
                disabled={authLoading}
                className="md:col-span-2 primary-btn disabled:opacity-60"
              >
                {authLoading ? "Please wait..." : authMode === "register" ? "Create account" : "Sign in"}
              </button>

              {authErr && (
                <div className="md:col-span-2 alert-card mt-2">
                  {authErr}
                </div>
              )}
            </form>
          ) : authErr ? (
            <div className="alert-card mt-2">{authErr}</div>
          ) : (
            <div className="text-sm text-subtle">Loading profile...</div>
          )}
        </div>

        {/* Weather */}
        <div className="glass-card p-5 sm:p-6 float-in" style={{ animationDelay: "80ms" }}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="section-title">Weather</div>
            {token && data?.location && (
              <button onClick={saveCurrentLocation} className="chip chip-ghost">
                Save location
              </button>
            )}
          </div>

          <form onSubmit={onWeatherSearch} className="mt-4 flex flex-wrap gap-2">
            <div className="relative flex-1 min-w-[220px]">
              <input
                className="w-full input-field"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="City, address, or place"
                onFocus={() => setShowSuggestions(true)}
                onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
              />
              {showSuggestions && (suggestLoading || suggestErr || suggestions.length > 0) && (
                <div className="suggestions-panel">
                  {suggestLoading && <div className="suggestion-empty">Loading suggestions...</div>}
                  {suggestErr && <div className="suggestion-empty">{suggestErr}</div>}
                  {!suggestLoading &&
                    !suggestErr &&
                    suggestions.map((s) => (
                      <button
                        type="button"
                        key={s.id}
                        className="suggestion-item"
                        onMouseDown={() => {
                          setCity(s.name);
                          setShowSuggestions(false);
                          fetchWeather(s.name);
                        }}
                      >
                        <div>
                          <div className="suggestion-main">
                            {s.name}
                            {s.admin1 ? `, ${s.admin1}` : ""} — {s.country}
                          </div>
                          <div className="suggestion-meta">
                            Feels {s.feels !== undefined && s.feels !== null ? formatTemp(s.feels) : "-"}
                          </div>
                        </div>
                        <div className="suggestion-temp">
                          {s.temp !== undefined && s.temp !== null ? formatTemp(s.temp) : "-"}
                        </div>
                      </button>
                    ))}
                </div>
              )}
            </div>
            <button className="primary-btn" aria-label="Search">
              <img src={searchIcon} alt="" className="btn-icon" aria-hidden="true" />
            </button>
            <button type="button" className="chip chip-ghost" onClick={useMyLocation}>
              <img src={locationIcon} alt="" className="btn-icon" aria-hidden="true" />
              Use my location
            </button>
          </form>

          {(loadingWeather || weatherNotice || weatherErr) && (
            <div className="mt-3 space-y-2">
              {loadingWeather && <div className="text-sm text-subtle">Loading...</div>}
              {weatherNotice && <div className="info-card">{weatherNotice}</div>}
              {weatherErr && <div className="alert-card">{weatherErr}</div>}
            </div>
          )}

          {data && (
            <div className="space-y-4 pt-4">
              {(aqiErr || aqiNotice) && (
                <div className="space-y-2">
                  {aqiErr && <div className="alert-card">{aqiErr}</div>}
                  {aqiNotice && <div className="info-card">{aqiNotice}</div>}
                </div>
              )}

              {/* aqi display */}
              {aqiData?.aqi?.current && (
                <div className="soft-card p-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="section-title">
                        <img src={aqiIcon} alt="" className="section-icon" aria-hidden="true" />
                        Air Quality
                      </div>
                      <div className="text-xs text-subtle">{aqiData.cached ? "cached" : "fresh"}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-3xl font-semibold">{aqiData.aqi.current.us_aqi ?? "-"}</div>
                      <div className="text-sm text-subtle">US AQI</div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4 text-sm">
                    <Stat label="PM2.5" value={`${aqiData.aqi.current.pm2_5 ?? "-"} µg/m³`} />
                    <Stat label="PM10" value={`${aqiData.aqi.current.pm10 ?? "-"} µg/m³`} />
                    <Stat label="Ozone" value={`${aqiData.aqi.current.ozone ?? "-"} µg/m³`} />
                    <Stat label="NO₂" value={`${aqiData.aqi.current.nitrogen_dioxide ?? "-"} µg/m³`} />
                  </div>

                  {aqiInsight && (
                    <div className="aqi-tip">
                      <div className="aqi-tip-title">{aqiInsight.label}</div>
                      <div className="aqi-tip-detail">{aqiInsight.detail}</div>
                    </div>
                  )}
                </div>
              )}

              {(alertsErr || alertsNotice) && (
                <div className="space-y-2">
                  {alertsErr && <div className="alert-card">{alertsErr}</div>}
                  {alertsNotice && <div className="info-card">{alertsNotice}</div>}
                </div>
              )}

              {alertsData.length > 0 && (
                <div className="soft-card p-5">
                  <div className="section-title">Alerts</div>
                  <div className="mt-3 space-y-2 text-sm">
                    {alertsData.map((a, idx) => (
                      <div
                        key={idx}
                        className={`alert-item ${a.severity === "warning" ? "alert-item-warn" : ""}`}
                      >
                        <div className="font-semibold">{a.title}</div>
                        <div className="text-subtle">{a.detail}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="soft-card p-5">
                <div className="section-title">Alert Subscriptions</div>
                {!token ? (
                  <div className="text-sm text-subtle">Login to manage alert subscriptions.</div>
                ) : (
                  <div className="sub-panel">
                    <div className="sub-row">
                      <div className="text-subtle text-xs">Minimum severity</div>
                      <select
                        className="input-field sub-select"
                        value={alertSeverity}
                        onChange={(e) => setAlertSeverity(e.target.value)}
                      >
                        <option value="info">Info + Warning</option>
                        <option value="warning">Warning only</option>
                      </select>
                    </div>

                    <div className="sub-types">
                      {["rain", "wind", "uv", "freeze", "heat"].map((type) => (
                        <label key={type} className="sub-option">
                          <input
                            type="checkbox"
                            checked={alertTypes.includes(type)}
                            onChange={() => toggleAlertType(type)}
                          />
                          <span>{type}</span>
                        </label>
                      ))}
                    </div>

                    <button
                      type="button"
                      className="primary-btn"
                      onClick={createAlertSubscription}
                      disabled={!data?.location || alertTypes.length === 0}
                    >
                      Subscribe to current location
                    </button>

                    {alertSubsLoading && <div className="text-sm text-subtle">Loading subscriptions...</div>}
                    {alertSubsErr && <div className="alert-card mt-2">{alertSubsErr}</div>}

                    {alertSubs.length === 0 ? (
                      <div className="text-sm text-subtle">No subscriptions yet.</div>
                    ) : (
                      <div className="sub-list">
                        {alertSubs.map((sub) => (
                          <div key={sub.id} className="sub-item">
                            <div className="font-semibold">
                              {sub.name}
                              {sub.admin1 ? `, ${sub.admin1}` : ""} — {sub.country}
                            </div>
                            <div className="text-subtle text-xs">
                              Types: {(sub.types || []).join(", ")} • Min severity: {sub.min_severity}
                            </div>
                            <button
                              type="button"
                              className="chip chip-ghost"
                              onClick={() => deleteAlertSubscription(sub.id)}
                            >
                              Delete
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {current && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                  <Stat
                    label="Wind"
                    value={`${Math.round(current.wind_speed_10m)} km/h`}
                    icon={windIcon}
                  />
                  <Stat label="Humidity" value={`${current.relative_humidity_2m}%`} />
                  <Stat label="UV" value={`${current.uv_index ?? "-"}`} icon={uvIcon} />
                  <Stat label="Precip" value={`${current.precipitation ?? 0} mm`} icon={rainIcon} />
                </div>
              )}

              {hourly?.time && (
                <div className="space-y-2">
                  <div className="section-title">Next 12 hours</div>
                  <HourlyChart
                    times={hourly.time.slice(0, 12)}
                    temps={hourly.temperature_2m.slice(0, 12)}
                    precip={hourly.precipitation_probability?.slice(0, 12)}
                    formatTemp={formatTemp}
                  />
                </div>
              )}

              {daily?.time && (
                <div className="space-y-2">
                  <div className="section-title">Next 7 days</div>
                  <div className="space-y-2 text-sm">
                    {daily.time.slice(0, 7).map((d, i) => (
                      <div key={d} className="daily-row">
                        <div className="text-subtle">{d}</div>
                        {formatTemp(daily.temperature_2m_min[i])} →{" "}
                        <span className="font-semibold">{formatTemp(daily.temperature_2m_max[i])}</span>
                        <div className="text-subtle">
                          Rain: {daily.precipitation_probability_max?.[i] ?? 0}%
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

            </div>
          )}
        </div>

        {/* Saved locations */}
        <div className="glass-card p-5 sm:p-6 float-in space-y-3" style={{ animationDelay: "120ms" }}>
          <div className="section-title">Saved Locations</div>

          {!token && <div className="text-sm text-subtle">Login to save locations.</div>}

          {token && savedLoading && <div className="text-sm text-subtle mt-2">Loading saved locations...</div>}

          {token && savedErr && (
            <div className="alert-card mt-2">{savedErr}</div>
          )}

          {token && !savedLoading && (
            <div className="space-y-2">
              {saved.length === 0 ? (
                <div className="text-sm text-subtle">No saved locations yet.</div>
              ) : (
                saved.map((loc) => (
                  <div key={loc.id} className="saved-row">
                    <button
                      onClick={() => loadSavedLocation(loc)}
                      className="text-left flex-1"
                      title="Load weather"
                    >
                      <div className="font-semibold">
                        {loc.name}
                        {loc.admin1 ? `, ${loc.admin1}` : ""} — {loc.country}
                      </div>
                      <div className="text-xs text-subtle">
                        {loc.lat.toFixed(3)}, {loc.lon.toFixed(3)} • {loc.timezone} •{" "}
                        {formatLocalTime(loc.timezone) || "—"}
                      </div>
                    </button>
                    <button
                      onClick={() => deleteSaved(loc.id)}
                      className="chip chip-ghost"
                      title="Delete"
                    >
                      Delete
                    </button>
                    <button
                      onClick={() => toggleCompare(loc.id)}
                      className={`chip chip-ghost ${compareIds.includes(loc.id) ? "chip-active" : ""}`}
                      title="Compare"
                      type="button"
                    >
                      Compare
                    </button>
                    <div className="flex gap-1">
                      <button
                        onClick={() => moveSaved(loc.id, "up")}
                        className="chip chip-ghost"
                        title="Move up"
                        type="button"
                      >
                        ↑
                      </button>
                      <button
                        onClick={() => moveSaved(loc.id, "down")}
                        className="chip chip-ghost"
                        title="Move down"
                        type="button"
                      >
                        ↓
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {compareIds.length > 0 && (
            <div className="soft-card p-5 compare-panel">
              <div className="section-title">Compare</div>
              {compareLoading && <div className="text-sm text-subtle">Loading comparison...</div>}
              {compareErr && <div className="alert-card mt-2">{compareErr}</div>}
              <div className="compare-grid">
                {compareIds.map((id) => {
                  const entry = compareData[id];
                  if (!entry) return null;
                  const current = entry.data?.forecast?.current;
                  return (
                    <div key={id} className="compare-card">
                      <div className="font-semibold">
                        {entry.loc.name}
                        {entry.loc.admin1 ? `, ${entry.loc.admin1}` : ""} — {entry.loc.country}
                      </div>
                      <div className="compare-temp">
                        {current ? formatTemp(current.temperature_2m) : "-"}
                      </div>
                      <div className="text-subtle text-sm">
                        Feels {current ? formatTemp(current.apparent_temperature) : "-"}
                      </div>
                      <div className="text-subtle text-xs">
                        Wind: {current ? `${Math.round(current.wind_speed_10m)} km/h` : "-"}
                      </div>
                      <div className="text-subtle text-xs">
                        Precip: {current ? `${current.precipitation ?? 0} mm` : "-"}
                      </div>
                      <div className="text-subtle text-xs">
                        Local time: {formatLocalTime(entry.loc.timezone) || "—"}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
