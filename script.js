const WEATHER_API = "https://api.open-meteo.com/v1/forecast";
const GEOCODING_API = "https://geocoding-api.open-meteo.com/v1/search";
const NOMINATIM_API = "https://nominatim.openstreetmap.org/reverse";

let currentLocation = {
    name: "Bhubaneswar",
    district: "Khordha",
    state: "Odisha",
    postcode: "751001",
    latitude: 20.2961,
    longitude: 85.8245
};

const $ = (id) => document.getElementById(id);

function setText(id, value) {
    const el = $(id);
    if (el) el.textContent = value ?? "--";
}

function weatherInfo(code, isDay = 1) {
    const data = {
        0: ["Clear Sky", isDay ? "☀️" : "🌙"],
        1: ["Mainly Clear", isDay ? "🌤️" : "🌙"],
        2: ["Partly Cloudy", "⛅"],
        3: ["Overcast", "☁️"],
        45: ["Fog", "🌫️"],
        48: ["Fog", "🌫️"],
        51: ["Light Drizzle", "🌦️"],
        53: ["Drizzle", "🌦️"],
        55: ["Heavy Drizzle", "🌧️"],
        61: ["Light Rain", "🌦️"],
        63: ["Rain", "🌧️"],
        65: ["Heavy Rain", "🌧️"],
        71: ["Light Snow", "🌨️"],
        73: ["Snow", "🌨️"],
        75: ["Heavy Snow", "❄️"],
        80: ["Rain Showers", "🌦️"],
        81: ["Rain Showers", "🌧️"],
        82: ["Heavy Rain Showers", "⛈️"],
        95: ["Thunderstorm", "⛈️"],
        96: ["Thunderstorm", "⛈️"],
        99: ["Heavy Thunderstorm", "⛈️"]
    };

    return data[code] || ["Unknown", "🌡️"];
}

function formatTime(value) {
    if (!value) return "--";

    const date = new Date(value);

    return date.toLocaleTimeString("en-IN", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: true
    });
}

function formatDate(value) {
    if (!value) return "--";

    const date = new Date(value);

    return date.toLocaleDateString("en-IN", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric"
    });
}

function formatDay(value) {
    if (!value) return "--";

    const date = new Date(value);

    return date.toLocaleDateString("en-IN", {
        weekday: "short"
    });
}


/* =========================
   SEARCH LOCATION
========================= */

async function searchLocation(query) {
    query = query.trim();

    if (!query) {
        alert("Please enter a city, village, area, district or PIN code.");
        return;
    }

    const resultsBox = $("searchResults");

    if (resultsBox) {
        resultsBox.innerHTML = `<div class="result-item">🔎 Searching...</div>`;
        resultsBox.style.display = "block";
    }

    try {
        const url =
            `${GEOCODING_API}?name=${encodeURIComponent(query)}` +
            `&count=20&language=en&format=json`;

        const response = await fetch(url);

        if (!response.ok) {
            throw new Error("Location search failed");
        }

        const data = await response.json();

        let results = data.results || [];

        if (!results.length) {
            await searchPin(query);
            return;
        }

        results.sort((a, b) => {
            const aExact =
                String(a.name || "").toLowerCase() === query.toLowerCase();

            const bExact =
                String(b.name || "").toLowerCase() === query.toLowerCase();

            return Number(bExact) - Number(aExact);
        });

        showSearchResults(results);

    } catch (error) {
        console.error(error);

        if (resultsBox) {
            resultsBox.innerHTML =
                `<div class="result-item">❌ Location not found</div>`;
        }
    }
}

async function searchPin(pin) {
    const cleanPin = pin.replace(/\D/g, "");

    if (cleanPin.length !== 6) {
        showNoResults();
        return;
    }

    try {
        const response = await fetch(
            `https://api.postalpincode.in/pincode/${cleanPin}`
        );

        const data = await response.json();

        if (
            data &&
            data[0] &&
            data[0].Status === "Success" &&
            data[0].PostOffice &&
            data[0].PostOffice.length
        ) {
            const post = data[0].PostOffice[0];

            const location = {
                name: post.Name,
                district: post.District,
                state: post.State,
                postcode: cleanPin,
                latitude: null,
                longitude: null
            };

            /*
             * PIN API doesn't provide coordinates.
             * Search the place name through Open-Meteo.
             */
            const geoResponse = await fetch(
                `${GEOCODING_API}?name=${encodeURIComponent(post.Name)}` +
                `&count=10&language=en&format=json`
            );

            const geoData = await geoResponse.json();

            const match = (geoData.results || []).find(item =>
                String(item.name).toLowerCase() ===
                String(post.Name).toLowerCase()
            ) || (geoData.results || [])[0];

            if (match) {
                location.latitude = match.latitude;
                location.longitude = match.longitude;
            }

            loadLocation(location);
            return;
        }

        showNoResults();

    } catch (error) {
        console.error(error);
        showNoResults();
    }
}

function showSearchResults(results) {
    const box = $("searchResults");

    if (!box) return;

    box.innerHTML = "";

    results.slice(0, 10).forEach(place => {
        const div = document.createElement("div");

        div.className = "result-item";

        const postcode =
            place.postcode ||
            (Array.isArray(place.postcodes) ? place.postcodes[0] : "") ||
            "--";

        const district =
            place.admin2 ||
            place.admin3 ||
            place.admin4 ||
            "--";

        const state =
            place.admin1 ||
            "--";

        div.innerHTML = `
            <strong>📍 ${place.name}</strong>
            <small>
                ${district}, ${state}
                ${postcode !== "--" ? " • PIN " + postcode : ""}
            </small>
        `;

        div.addEventListener("click", () => {

            const location = {
                name: place.name,
                district: district,
                state: state,
                postcode: postcode,
                latitude: Number(place.latitude),
                longitude: Number(place.longitude)
            };

            box.style.display = "none";

            loadLocation(location);
        });

        box.appendChild(div);
    });

    box.style.display = "block";
}

function showNoResults() {
    const box = $("searchResults");

    if (!box) return;

    box.innerHTML =
        `<div class="result-item">❌ Location not found. Try another city, village, area or PIN code.</div>`;

    box.style.display = "block";
}


/* =========================
   LOAD LOCATION
========================= */

async function loadLocation(location) {

    if (
        !location ||
        !Number.isFinite(Number(location.latitude)) ||
        !Number.isFinite(Number(location.longitude))
    ) {
        alert("Weather coordinates are not available for this location.");
        return;
    }

    currentLocation = {
        ...currentLocation,
        ...location,
        latitude: Number(location.latitude),
        longitude: Number(location.longitude)
    };

    setText(
        "locationFullName",
        [
            currentLocation.name,
            currentLocation.district,
            currentLocation.state
        ].filter(Boolean).join(", ")
    );

    setText("cityName", currentLocation.name);
    setText("districtName", currentLocation.district || "--");
    setText("stateName", currentLocation.state || "--");
    setText("postcode", currentLocation.postcode || "--");

    await loadWeather(
        currentLocation.latitude,
        currentLocation.longitude
    );
}


/* =========================
   WEATHER
========================= */

async function loadWeather(latitude, longitude) {

    setText("temperature", "--°C");
    setText("condition", "Loading weather...");
    setText("updatedText", "Updating...");

    try {

        const url =
            `${WEATHER_API}?latitude=${latitude}` +
            `&longitude=${longitude}` +
            `&current=temperature_2m,relative_humidity_2m,apparent_temperature,` +
            `is_day,weather_code,wind_speed_10m,surface_pressure` +
            `&hourly=visibility,precipitation_probability` +
            `&daily=weather_code,temperature_2m_max,temperature_2m_min,` +
            `sunrise,sunset,precipitation_probability_max` +
            `&timezone=auto&forecast_days=5`;

        const response = await fetch(url);

        if (!response.ok) {
            throw new Error("Weather API error");
        }

        const data = await response.json();

        displayCurrentWeather(data);
        displayOverview(data);
        displayForecast(data);

    } catch (error) {

        console.error(error);

        setText("condition", "Weather unavailable");
        setText("updatedText", "Please try again");
    }
}

function displayCurrentWeather(data) {

    const current = data.current;

    if (!current) return;

    const [condition, icon] =
        weatherInfo(current.weather_code, current.is_day);

    setText("weatherIcon", icon);

    setText(
        "temperature",
        `${Math.round(current.temperature_2m)}°C`
    );

    setText("condition", condition);

    setText(
        "feelsLike",
        `${Math.round(current.apparent_temperature)}°C`
    );

    setText(
        "humidity",
        `${Math.round(current.relative_humidity_2m)}%`
    );

    setText(
        "windSpeed",
        `${Math.round(current.wind_speed_10m)} km/h`
    );

    setText(
        "pressure",
        `${Math.round(current.surface_pressure)} hPa`
    );

    setText(
        "weatherDate",
        formatDate(current.time)
    );

    setText(
        "updatedText",
        `Updated ${formatTime(current.time)}`
    );
}


/* =========================
   OVERVIEW
========================= */

function displayOverview(data) {

    if (!data.daily) return;

    const daily = data.daily;

    setText(
        "sunrise",
        formatTime(daily.sunrise?.[0])
    );

    setText(
        "sunset",
        formatTime(daily.sunset?.[0])
    );

    setText(
        "rainChance",
        `${daily.precipitation_probability_max?.[0] ?? 0}%`
    );

    let visibility = "--";

    if (
        data.hourly &&
        Array.isArray(data.hourly.visibility) &&
        data.hourly.visibility.length
    ) {
        visibility =
            `${(data.hourly.visibility[0] / 1000).toFixed(1)} km`;
    }

    setText("visibility", visibility);
}


/* =========================
   5 DAY FORECAST
========================= */

function displayForecast(data) {

    const grid = $("forecastGrid");

    if (!grid || !data.daily) return;

    const daily = data.daily;

    grid.innerHTML = "";

    for (let i = 0; i < 5; i++) {

        const [condition, icon] =
            weatherInfo(daily.weather_code[i], 1);

        const card = document.createElement("div");

        card.className = "forecast-card";

        card.innerHTML = `
            <div class="forecast-day">
                ${i === 0 ? "Today" : formatDay(daily.time[i])}
            </div>

            <div class="forecast-icon">
                ${icon}
            </div>

            <div class="forecast-condition">
                ${condition}
            </div>

            <div class="forecast-temp">
                <strong>${Math.round(daily.temperature_2m_max[i])}°</strong>
                <span>${Math.round(daily.temperature_2m_min[i])}°</span>
            </div>
        `;

        grid.appendChild(card);
    }
}


/* =========================
   GPS / USE MY LOCATION
========================= */

async function useMyLocation() {

    const button = $("locationBtn");

    if (!navigator.geolocation) {

        alert(
            "GPS is not supported by this browser."
        );

        return;
    }

    if (button) {
        button.disabled = true;
        button.textContent = "📍 Getting location...";
    }

    navigator.geolocation.getCurrentPosition(

        async (position) => {

            const latitude = position.coords.latitude;
            const longitude = position.coords.longitude;

            console.log("GPS coordinates:", latitude, longitude);

            try {

                /*
                 * Reverse geocoding:
                 * GPS coordinates → village/town/city/district/state/PIN
                 */

                const url =
                    `${NOMINATIM_API}?lat=${latitude}` +
                    `&lon=${longitude}` +
                    `&format=jsonv2` +
                    `&addressdetails=1` +
                    `&zoom=18` +
                    `&accept-language=en`;

                const response = await fetch(url, {
                    headers: {
                        "Accept": "application/json"
                    }
                });

                if (!response.ok) {
                    throw new Error("Reverse geocoding failed");
                }

                const data = await response.json();

                const address = data.address || {};

                const localName =
                    address.village ||
                    address.town ||
                    address.city ||
                    address.hamlet ||
                    address.suburb ||
                    address.neighbourhood ||
                    address.locality ||
                    address.city_district ||
                    "Your Location";

                const district =
                    address.state_district ||
                    address.district ||
                    address.county ||
                    address.municipality ||
                    "--";

                const state =
                    address.state ||
                    "--";

                const postcode =
                    address.postcode ||
                    "--";

                const location = {
                    name: localName,
                    district: district,
                    state: state,
                    postcode: postcode,
                    latitude: latitude,
                    longitude: longitude
                };

                await loadLocation(location);

            } catch (error) {

                console.warn(
                    "GPS reverse geocoding failed:",
                    error
                );

                /*
                 * Even if address lookup fails,
                 * weather still works from GPS coordinates.
                 */

                await loadLocation({
                    name: "Your Location",
                    district: "--",
                    state: "--",
                    postcode: "--",
                    latitude: latitude,
                    longitude: longitude
                });
            }

            if (button) {
                button.disabled = false;
                button.textContent = "📍 Use My Location";
            }
        },

        (error) => {

            console.error("GPS Error:", error);

            if (button) {
                button.disabled = false;
                button.textContent = "📍 Use My Location";
            }

            if (error.code === 1) {

                alert(
                    "📍 Location permission was denied.\n\n" +
                    "Chrome me address bar ke left side 🔒 icon par click karo → " +
                    "Location → Allow → page reload karo."
                );

            } else if (error.code === 2) {

                alert(
                    "📍 GPS location is unavailable.\n\n" +
                    "Please turn ON Windows Location Services and try again."
                );

            } else if (error.code === 3) {

                alert(
                    "📍 GPS request timed out.\n\n" +
                    "Please wait a few seconds and try again."
                );

            } else {

                alert(
                    "📍 Unable to get your location.\n\n" +
                    "Please check browser location permission."
                );
            }
        },

        {
            enableHighAccuracy: true,
            timeout: 20000,
            maximumAge: 60000
        }
    );
}


/* =========================
   BUTTON EVENTS
========================= */

const searchBtn = $("searchBtn");
const cityInput = $("cityInput");
const locationBtn = $("locationBtn");

if (searchBtn) {
    searchBtn.addEventListener("click", () => {

        searchLocation(cityInput.value);

    });
}

if (cityInput) {

    cityInput.addEventListener("keydown", (event) => {

        if (event.key === "Enter") {
            searchLocation(cityInput.value);
        }

    });
}

if (locationBtn) {

    locationBtn.addEventListener(
        "click",
        useMyLocation
    );
}


/* =========================
   CLOSE SEARCH DROPDOWN
========================= */

document.addEventListener("click", (event) => {

    const box = $("searchResults");

    const input = $("cityInput");
    const button = $("searchBtn");

    if (!box) return;

    if (
        event.target !== input &&
        event.target !== button &&
        !box.contains(event.target)
    ) {
        box.style.display = "none";
    }
});


/* =========================
   INITIAL WEATHER
========================= */

loadLocation(currentLocation);