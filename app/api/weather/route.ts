import { NextResponse } from "next/server";

export type BoatSafetyLevel = "clear" | "caution" | "suspend";

export type LakeWeatherPayload = {
  location: string;
  coordinates: string;
  temperatureC: number;
  humidityPercent: number;
  windKmh: number;
  condition: string;
  boatSafety: BoatSafetyLevel;
  boatGuidance: string;
  observedAt: string;
  source: "open-meteo" | "fallback";
};

const NAUJAN_LAT = 13.168;
const NAUJAN_LON = 121.351;

function describeWmoCode(code: number): string {
  if (code === 0) return "Clear sky";
  if (code <= 3) return "Partly cloudy";
  if (code === 45 || code === 48) return "Morning mist / haze";
  if (code >= 51 && code <= 57) return "Light drizzle";
  if (code >= 61 && code <= 67) return "Steady rain";
  if (code >= 80 && code <= 82) return "Passing rain showers";
  if (code >= 95) return "Thunderstorm activity";
  return "Variable tropical cloud";
}

function evaluateSafety(
  code: number,
  windKmh: number,
): { level: BoatSafetyLevel; guidance: string } {
  if (code >= 95 || windKmh >= 32) {
    return {
      level: "suspend",
      guidance:
        "Small-craft caution: high winds or storm cells detected. Confirm departures with the park office before boarding.",
    };
  }
  if ((code >= 51 && code <= 82) || windKmh >= 20) {
    return {
      level: "caution",
      guidance:
        "Moderate chop or rain over the open basin. Secure gear in dry bags and follow your boatman's route briefing.",
    };
  }
  return {
    level: "clear",
    guidance:
      "Favorable lake conditions for accredited sunrise tours, birdwatching hides, and research crossings.",
  };
}

function fallbackWeather(): LakeWeatherPayload {
  return {
    location: "Naujan Lake National Park, Oriental Mindoro",
    coordinates: "13.168° N, 121.351° E",
    temperatureC: 28,
    humidityPercent: 78,
    windKmh: 11,
    condition: "Partly cloudy (offline seasonal baseline)",
    boatSafety: "clear",
    boatGuidance:
      "Seasonal baseline shown while live telemetry is unreachable. Confirm dock status at the ranger station.",
    observedAt: new Date().toISOString(),
    source: "fallback",
  };
}

export async function GET() {
  const endpoint = `https://api.open-meteo.com/v1/forecast?latitude=${NAUJAN_LAT}&longitude=${NAUJAN_LON}&current=temperature_2m,relative_humidity_2m,wind_speed_10m,weather_code&timezone=Asia%2FManila`;

  try {
    const response = await fetch(endpoint, {
      signal: AbortSignal.timeout(4500),
      next: { revalidate: 900 },
    });

    if (!response.ok) {
      return NextResponse.json(fallbackWeather(), {
        status: 200,
        headers: {
          "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120",
        },
      });
    }

    const data = (await response.json()) as {
      current?: {
        time?: string;
        temperature_2m?: number;
        relative_humidity_2m?: number;
        wind_speed_10m?: number;
        weather_code?: number;
      };
    };

    const current = data.current;
    if (!current || typeof current.temperature_2m !== "number") {
      return NextResponse.json(fallbackWeather(), {
        status: 200,
        headers: {
          "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120",
        },
      });
    }

    const code = Number(current.weather_code ?? 1);
    const windKmh = Math.round(Number(current.wind_speed_10m ?? 10));
    const safety = evaluateSafety(code, windKmh);

    const payload: LakeWeatherPayload = {
      location: "Naujan Lake National Park, Oriental Mindoro",
      coordinates: "13.168° N, 121.351° E",
      temperatureC: Math.round(current.temperature_2m),
      humidityPercent: Math.round(Number(current.relative_humidity_2m ?? 75)),
      windKmh,
      condition: describeWmoCode(code),
      boatSafety: safety.level,
      boatGuidance: safety.guidance,
      observedAt: current.time ?? new Date().toISOString(),
      source: "open-meteo",
    };

    return NextResponse.json(payload, {
      status: 200,
      headers: {
        "Cache-Control": "public, s-maxage=900, stale-while-revalidate=1800",
      },
    });
  } catch {
    return NextResponse.json(fallbackWeather(), {
      status: 200,
      headers: {
        "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120",
      },
    });
  }
}
