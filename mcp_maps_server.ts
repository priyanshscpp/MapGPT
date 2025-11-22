/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// tslint:disable
import {McpServer} from '@modelcontextprotocol/sdk/server/mcp.js';
import {Transport} from '@modelcontextprotocol/sdk/shared/transport.js';
import {z} from 'zod';
import { GoogleGenAI } from '@google/genai';

export interface MapParams {
  location?: string;
  search?: string;
  origin?: string;
  destination?: string;
}

interface WeatherData {
  temperatureC: number;
  feelsLikeC: number;
  condition: string;
  humidity: number;
  windKph: number;
  raw?: any;
}

interface Landmark {
  name: string;
  type: string;
  distance_meters: number;
}

interface ReverseGeoInsights {
  coordinates: { lat: number; lng: number };
  address: string;
  landmarks: Landmark[];
  popularity: 'high' | 'medium' | 'low';
  safety_index: 'high' | 'medium' | 'low';
  area_profile: string;
  weather?: WeatherData;
  raw_geo_data: any;
  ai_summary: string;
  share?: {
    coordinates: { lat: number; lng: number };
    shareable_link: string;
    short_label: string;
    description: string;
  };
}

interface ShareableLocation {
  coordinates: { lat: number; lng: number };
  shareable_link: string;
  short_label: string;
  description: string;
}

async function getWeatherForLocation(lat: number, lng: number): Promise<WeatherData> {
  try {
    const response = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m,apparent_temperature,weather_code,relative_humidity_2m,wind_speed_10m&timezone=auto`,
    );
    const data = await response.json();

    if (!data.current) {
      throw new Error('No weather data received');
    }

    const weatherCodeMap: { [key: number]: string } = {
      0: 'Clear',
      1: 'Mainly clear',
      2: 'Partly cloudy',
      3: 'Overcast',
      45: 'Foggy',
      48: 'Foggy',
      51: 'Light drizzle',
      53: 'Moderate drizzle',
      55: 'Heavy drizzle',
      61: 'Light rain',
      63: 'Moderate rain',
      65: 'Heavy rain',
      71: 'Light snow',
      73: 'Moderate snow',
      75: 'Heavy snow',
      80: 'Light showers',
      81: 'Moderate showers',
      82: 'Heavy showers',
      85: 'Light snow showers',
      86: 'Heavy snow showers',
      95: 'Thunderstorm',
      96: 'Thunderstorm with hail',
      99: 'Thunderstorm with hail',
    };

    const condition = weatherCodeMap[data.current.weather_code] || 'Unknown';

    return {
      temperatureC: data.current.temperature_2m,
      feelsLikeC: data.current.apparent_temperature,
      condition,
      humidity: data.current.relative_humidity_2m,
      windKph: data.current.wind_speed_10m,
      raw: data.current,
    };
  } catch (error) {
    console.error('Weather API error:', error);
    return {
      temperatureC: 0,
      feelsLikeC: 0,
      condition: 'Unknown',
      humidity: 0,
      windKph: 0,
    };
  }
}

async function getReverseGeoInsights(
  lat: number,
  lng: number,
  radiusMeters: number = 500,
): Promise<ReverseGeoInsights | { error: string }> {
  try {
    const nominatimUrl = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`;
    const nominatimResponse = await fetch(nominatimUrl);
    const geoData = await nominatimResponse.json();

    const address = geoData.address
      ? [geoData.address.tourism || geoData.address.name, geoData.address.city || geoData.address.town || geoData.address.village, geoData.address.state]
          .filter(Boolean)
          .join(', ')
      : `${lat.toFixed(4)}, ${lng.toFixed(4)}`;

    const landmarks: Landmark[] = [];
    if (geoData.address && geoData.address.tourism) {
      landmarks.push({
        name: geoData.address.name || geoData.address.tourism,
        type: 'landmark',
        distance_meters: 0,
      });
    }
    if (geoData.address && geoData.address.historic) {
      landmarks.push({
        name: geoData.address.historic,
        type: 'historical',
        distance_meters: 50,
      });
    }
    if (geoData.address && geoData.address.amenity) {
      landmarks.push({
        name: geoData.address.amenity,
        type: 'amenity',
        distance_meters: 100,
      });
    }

    const weather = await getWeatherForLocation(lat, lng);

    const popularity = landmarks.length > 2 ? 'high' : landmarks.length > 0 ? 'medium' : 'low';
    const safetyIndex = 'medium';

    const areaProfile = landmarks.length > 0
      ? `Known for ${landmarks.map((l) => l.type).join(', ')}`
      : `${geoData.address?.city || geoData.address?.town || 'Area'} region`;

    const gemini = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
    });

    const landmarkText =
      landmarks.length > 0
        ? landmarks.map((l) => `- ${l.name} (${l.type}, ${l.distance_meters}m away)`).join('\n')
        : '(No specific landmarks data available)';

    const prompt = `You are a geo-intelligence assistant. Given the following location data, generate a concise, factual summary about the area. Keep it to 2-3 sentences max.

Location: ${address}
Coordinates: ${lat.toFixed(4)}, ${lng.toFixed(4)}
Nearby Features:
${landmarkText}

Current Weather:
- Temperature: ${weather.temperatureC}°C (feels like ${weather.feelsLikeC}°C)
- Condition: ${weather.condition}
- Humidity: ${weather.humidity}%
- Wind: ${weather.windKph} kph

Generate a brief, natural summary covering:
1. What this area is known for
2. Current weather context
3. General atmosphere/character

Be factual and concise. No headers or markdown.`;

    const chat = gemini.chats.create({
      model: 'gemini-2.5-flash',
    });

    const aiResponse = await chat.sendMessage([
      {
        text: prompt,
      },
    ]);
    const aiSummary =
      aiResponse.candidates?.[0]?.content?.parts?.[0]?.text ||
      'A notable location with interesting geographical features.';

    const shareableLink = `https://www.google.com/maps?q=${lat},${lng}`;

    return {
      coordinates: { lat, lng },
      address,
      landmarks,
      popularity,
      safety_index: safetyIndex,
      area_profile: areaProfile,
      weather,
      raw_geo_data: geoData,
      ai_summary: aiSummary,
      share: {
        coordinates: { lat, lng },
        shareable_link: shareableLink,
        short_label: address.split(',')[0] || 'Location',
        description: aiSummary.split('.')[0] + '.',
      },
    };
  } catch (error) {
    console.error('Reverse geo insights error:', error);
    return { error: `Failed to get reverse geo insights: ${(error as Error).message}` };
  }
}

async function generateShareableLocation(
  lat: number,
  lng: number,
): Promise<ShareableLocation | { error: string }> {
  try {
    const nominatimUrl = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`;
    const response = await fetch(nominatimUrl);
    const geoData = await response.json();

    const address = geoData.address
      ? Object.values(geoData.address)
          .slice(0, 2)
          .join(', ')
      : 'Location';

    const shareableLink = `https://www.google.com/maps?q=${lat},${lng}`;

    return {
      coordinates: { lat, lng },
      shareable_link: shareableLink,
      short_label: address,
      description: `Location at coordinates ${lat.toFixed(4)}, ${lng.toFixed(4)}`,
    };
  } catch (error) {
    console.error('Share location error:', error);
    return { error: `Failed to generate shareable location: ${(error as Error).message}` };
  }
}

async function getCoordinatesForLocation(locationName: string): Promise<{ latitude: number; longitude: number; address: string } | { error: string }> {
  try {
    const encodedLocation = encodeURIComponent(locationName);
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodedLocation}&limit=1`;
    const response = await fetch(url);
    const data = await response.json();

    if (!data || data.length === 0) {
      return { error: `Could not find coordinates for "${locationName}"` };
    }

    return {
      latitude: parseFloat(data[0].lat),
      longitude: parseFloat(data[0].lon),
      address: data[0].display_name,
    };
  } catch (error) {
    console.error('Geocoding error:', error);
    return { error: `Failed to geocode "${locationName}": ${(error as Error).message}` };
  }
}

export async function startMcpGoogleMapServer(
  transport: Transport,
  mapQueryHandler: (params: MapParams) => void,
) {
  // Create an MCP server
  const server = new McpServer({
    name: 'AI Studio Google Map',
    version: '1.0.0',
  });

  server.tool(
    'geocode_location',
    'Convert a place name or address to latitude and longitude coordinates',
    {location: z.string()},
    async ({location}) => {
      const result = await getCoordinatesForLocation(location);
      const jsonText = JSON.stringify(result, null, 2);
      return {
        content: [{type: 'text', text: jsonText}],
      };
    },
  );

  server.tool(
    'view_location_google_maps',
    'View a specific query or geographical location and display in the embedded maps interface',
    {query: z.string()},
    async ({query}) => {
      mapQueryHandler({location: query});
      return {
        content: [{type: 'text', text: `Navigating to: ${query}`}],
      };
    },
  );

  server.tool(
    'search_google_maps',
    'Search google maps for a series of places near a location and display it in the maps interface',
    {search: z.string()},
    async ({search}) => {
      mapQueryHandler({search});
      return {
        content: [{type: 'text', text: `Searching: ${search}`}],
      };
    },
  );

  server.tool(
    'directions_on_google_maps',
    'Search google maps for directions from origin to destination.',
    {origin: z.string(), destination: z.string()},
    async ({origin, destination}) => {
      mapQueryHandler({origin, destination});
      return {
        content: [
          {type: 'text', text: `Navigating from ${origin} to ${destination}`},
        ],
      };
    },
  );

  server.tool(
    'reverse_geo_insights',
    'Get detailed reverse geocoding insights for a location including nearby landmarks, weather, and AI-generated summary.',
    {
      latitude: z.number(),
      longitude: z.number(),
      radiusMeters: z.number().default(500).optional(),
    },
    async ({latitude, longitude, radiusMeters}) => {
      const insights = await getReverseGeoInsights(
        latitude,
        longitude,
        radiusMeters || 500,
      );
      const jsonText = JSON.stringify(insights, null, 2);
      return {
        content: [{type: 'text', text: jsonText}],
      };
    },
  );

  server.tool(
    'share_location',
    'Generate a shareable location payload with a link and description for a given coordinate.',
    {
      latitude: z.number(),
      longitude: z.number(),
    },
    async ({latitude, longitude}) => {
      const shareData = await generateShareableLocation(latitude, longitude);
      const jsonText = JSON.stringify(shareData, null, 2);
      return {
        content: [{type: 'text', text: jsonText}],
      };
    },
  );

  server.tool(
    'weather_at_location',
    'Get current weather conditions for a given location.',
    {
      latitude: z.number(),
      longitude: z.number(),
    },
    async ({latitude, longitude}) => {
      const weather = await getWeatherForLocation(latitude, longitude);
      const jsonText = JSON.stringify(weather, null, 2);
      return {
        content: [{type: 'text', text: jsonText}],
      };
    },
  );

  await server.connect(transport);
  console.log('server running');
  while (true) {
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
}
