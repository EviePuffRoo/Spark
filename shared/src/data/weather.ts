export interface WeatherEntry {
  condition: string;
  description: string;
}

// Keyed by the exact terrain names in TERRAIN_CATEGORIES (regions.ts). A
// region's terrainCategory is free text (DMs can edit it), so anything that
// doesn't match one of these keys falls back to WEATHER_BY_TERRAIN.default.
export const WEATHER_BY_TERRAIN: Record<string, WeatherEntry[]> = {
  Forest: [
    { condition: "Dappled Sunlight", description: "Sunlight filters through the canopy in shifting patches." },
    { condition: "Overcast", description: "A grey ceiling of cloud hangs low over the treetops." },
    { condition: "Light Rain", description: "A steady drizzle patters against the leaves overhead." },
    { condition: "Morning Fog", description: "Mist clings between the trunks, thinning by midday." },
    { condition: "Cool and Still", description: "The air is cool and unmoving beneath the branches." },
  ],
  Mountains: [
    { condition: "Clear and Crisp", description: "Thin, cold air and a sky scoured clean of cloud." },
    { condition: "High Winds", description: "Gusts howl across the exposed ridgelines." },
    { condition: "Snow Flurries", description: "Loose snow blows sideways off the peaks." },
    { condition: "Bitter Cold", description: "The cold bites through cloaks and furs alike." },
    { condition: "Thin Fog", description: "Cloud has settled into the passes, muffling sound." },
  ],
  Coastal: [
    { condition: "Salt Wind", description: "A steady onshore wind carries the smell of brine." },
    { condition: "Clear Skies", description: "Bright sun glitters off open water." },
    { condition: "Sea Fog", description: "A thick bank of fog has rolled in off the water." },
    { condition: "Squalls", description: "Sudden bursts of wind-driven rain sweep the shoreline." },
    { condition: "Warm and Humid", description: "The air is heavy and damp with sea moisture." },
  ],
  Swamp: [
    { condition: "Humid and Still", description: "Thick, wet air hangs motionless over the water." },
    { condition: "Low Mist", description: "A knee-high haze drifts between the reeds." },
    { condition: "Warm Drizzle", description: "A fine, warm rain falls without urgency." },
    { condition: "Biting Insects", description: "Clear skies, but the bugs are relentless." },
    { condition: "Sudden Downpour", description: "Rain falls in heavy sheets, churning the mud." },
  ],
  Plains: [
    { condition: "Clear and Sunny", description: "Open sky stretches unbroken to the horizon." },
    { condition: "Rolling Wind", description: "A steady wind bends the grass in long waves." },
    { condition: "Distant Storm", description: "Dark clouds build on the horizon, still far off." },
    { condition: "Light Rain", description: "A gentle, even rain soaks into the open ground." },
    { condition: "Hazy Heat", description: "Shimmering heat blurs the distant tree line." },
  ],
  Desert: [
    { condition: "Scorching Heat", description: "The sun bears down without mercy or shade." },
    { condition: "Clear and Dry", description: "A cloudless sky over cracked, dry ground." },
    { condition: "Sandstorm", description: "Blowing sand reduces visibility to a few yards." },
    { condition: "Cool Night Wind", description: "The heat has broken, and a dry chill sets in." },
    { condition: "Dust Haze", description: "A fine dust hangs in the air, dulling the light." },
  ],
  Tundra: [
    { condition: "Bitter Cold", description: "The cold is sharp enough to sting exposed skin." },
    { condition: "Whiteout", description: "Blowing snow erases the horizon entirely." },
    { condition: "Clear and Frigid", description: "A hard, cloudless cold under a pale sun." },
    { condition: "Still and Grey", description: "Flat grey light with no wind at all." },
    { condition: "Ice Fog", description: "Frozen mist hangs at ground level." },
  ],
  Hills: [
    { condition: "Clear and Mild", description: "Gentle sun over rolling, open ground." },
    { condition: "Breezy", description: "A steady wind rises and falls with the terrain." },
    { condition: "Patchy Cloud", description: "Cloud shadows drift slowly across the slopes." },
    { condition: "Light Rain", description: "A soft rain settles over the hillsides." },
    { condition: "Morning Mist", description: "Low cloud fills the hollows until the sun burns it off." },
  ],
  Underdark: [
    { condition: "Still Air", description: "The air is dead calm and faintly mineral." },
    { condition: "Damp Chill", description: "Cold moisture beads on every surface." },
    { condition: "Sulfurous Draft", description: "A faint, acrid wind drifts from some deeper vent." },
    { condition: "Dripping Quiet", description: "Distant water drips echo through the dark." },
    { condition: "Warm Vent", description: "A current of warm, stale air rises from below." },
  ],
  default: [
    { condition: "Clear", description: "The sky is clear and the weather unremarkable." },
    { condition: "Overcast", description: "Grey cloud cover, no rain in the air." },
    { condition: "Light Rain", description: "A gentle, steady rain falls." },
    { condition: "Breezy", description: "A light, steady wind moves through the area." },
    { condition: "Mild", description: "Calm, temperate conditions throughout the day." },
  ],
};
