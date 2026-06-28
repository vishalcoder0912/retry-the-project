export type GeoKind = "country" | "state" | "city";

export type GeoResolvedLocation = {
  name: string;
  coordinates: [number, number];
  kind: GeoKind;
};

export const normalizeGeoValue = (value: unknown) =>
  String(value ?? "")
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");

export const GEO_LOCATION_INDEX: Record<string, GeoResolvedLocation> = {
  india: { name: "India", coordinates: [78.96, 20.59], kind: "country" },
  usa: { name: "United States", coordinates: [-98.58, 39.83], kind: "country" },
  us: { name: "United States", coordinates: [-98.58, 39.83], kind: "country" },
  united_states: { name: "United States", coordinates: [-98.58, 39.83], kind: "country" },
  united_states_of_america: { name: "United States", coordinates: [-98.58, 39.83], kind: "country" },
  canada: { name: "Canada", coordinates: [-106.35, 56.13], kind: "country" },
  germany: { name: "Germany", coordinates: [10.45, 51.17], kind: "country" },
  france: { name: "France", coordinates: [2.21, 46.22], kind: "country" },
  united_kingdom: { name: "United Kingdom", coordinates: [-3.43, 55.38], kind: "country" },
  uk: { name: "United Kingdom", coordinates: [-3.43, 55.38], kind: "country" },
  japan: { name: "Japan", coordinates: [138.25, 36.2], kind: "country" },
  china: { name: "China", coordinates: [104.2, 35.86], kind: "country" },
  singapore: { name: "Singapore", coordinates: [103.82, 1.35], kind: "country" },
  australia: { name: "Australia", coordinates: [133.78, -25.27], kind: "country" },
  uae: { name: "United Arab Emirates", coordinates: [53.85, 23.42], kind: "country" },
  united_arab_emirates: { name: "United Arab Emirates", coordinates: [53.85, 23.42], kind: "country" },
  brazil: { name: "Brazil", coordinates: [-51.92, -14.23], kind: "country" },
  mexico: { name: "Mexico", coordinates: [-102.55, 23.63], kind: "country" },
  south_africa: { name: "South Africa", coordinates: [22.94, -30.56], kind: "country" },
  nigeria: { name: "Nigeria", coordinates: [8.67, 9.08], kind: "country" },
  delhi: { name: "Delhi", coordinates: [77.1, 28.7], kind: "city" },
  noida: { name: "Noida", coordinates: [77.39, 28.54], kind: "city" },
  gurugram: { name: "Gurugram", coordinates: [77.03, 28.46], kind: "city" },
  gurgaon: { name: "Gurugram", coordinates: [77.03, 28.46], kind: "city" },
  mumbai: { name: "Mumbai", coordinates: [72.88, 19.08], kind: "city" },
  pune: { name: "Pune", coordinates: [73.86, 18.52], kind: "city" },
  bengaluru: { name: "Bengaluru", coordinates: [77.59, 12.97], kind: "city" },
  bangalore: { name: "Bengaluru", coordinates: [77.59, 12.97], kind: "city" },
  hyderabad: { name: "Hyderabad", coordinates: [78.49, 17.38], kind: "city" },
  chennai: { name: "Chennai", coordinates: [80.27, 13.08], kind: "city" },
  kolkata: { name: "Kolkata", coordinates: [88.36, 22.57], kind: "city" },
  ahmedabad: { name: "Ahmedabad", coordinates: [72.57, 23.02], kind: "city" },
  jaipur: { name: "Jaipur", coordinates: [75.79, 26.91], kind: "city" },
  maharashtra: { name: "Maharashtra", coordinates: [75.71, 19.75], kind: "state" },
  karnataka: { name: "Karnataka", coordinates: [75.71, 15.32], kind: "state" },
  uttar_pradesh: { name: "Uttar Pradesh", coordinates: [80.94, 26.85], kind: "state" },
  gujarat: { name: "Gujarat", coordinates: [71.19, 22.26], kind: "state" },
  rajasthan: { name: "Rajasthan", coordinates: [74.22, 27.02], kind: "state" },
  tamil_nadu: { name: "Tamil Nadu", coordinates: [78.66, 11.13], kind: "state" },
  telangana: { name: "Telangana", coordinates: [79.02, 18.11], kind: "state" },
  west_bengal: { name: "West Bengal", coordinates: [87.85, 22.99], kind: "state" },
};

export const resolveGeoLocation = (value: unknown) => GEO_LOCATION_INDEX[normalizeGeoValue(value)] || null;

export const hasResolvableGeoValue = (value: unknown) => Boolean(resolveGeoLocation(value));
