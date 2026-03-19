// API Configuration
export const API_CONFIG = {
  ML_API_URL: process.env.NEXT_PUBLIC_ML_API_URL || "http://localhost:8000",
  WEATHER_API_KEY: process.env.NEXT_PUBLIC_OPENWEATHER_API_KEY || "",
  AQICN_API_KEY: process.env.NEXT_PUBLIC_AQICN_API_KEY || "",
  TOMTOM_API_KEY: process.env.NEXT_PUBLIC_TOMTOM_API_KEY || "",
};

// Supported cities and zones
export const CITIES = [
  {
    id: "mumbai",
    name: "Mumbai",
    lat: 19.076,
    lng: 72.8777,
    zones: [
      { id: "mum-andheri", name: "Andheri West", lat: 19.1197, lng: 72.8464 },
      { id: "mum-bandra", name: "Bandra", lat: 19.0596, lng: 72.8295 },
      { id: "mum-dadar", name: "Dadar", lat: 19.0178, lng: 72.8478 },
      { id: "mum-colaba", name: "Colaba", lat: 18.9067, lng: 72.8147 },
      { id: "mum-powai", name: "Powai", lat: 19.1176, lng: 72.9060 },
    ],
  },
  {
    id: "delhi",
    name: "Delhi",
    lat: 28.6139,
    lng: 77.209,
    zones: [
      { id: "del-cp", name: "Connaught Place", lat: 28.6315, lng: 77.2167 },
      { id: "del-dwarka", name: "Dwarka", lat: 28.5921, lng: 77.0460 },
      { id: "del-rohini", name: "Rohini", lat: 28.7495, lng: 77.0565 },
      { id: "del-saket", name: "Saket", lat: 28.5244, lng: 77.2066 },
      { id: "del-karol", name: "Karol Bagh", lat: 28.6514, lng: 77.1907 },
    ],
  },
  {
    id: "bangalore",
    name: "Bangalore",
    lat: 12.9716,
    lng: 77.5946,
    zones: [
      { id: "blr-koramangala", name: "Koramangala", lat: 12.9352, lng: 77.6245 },
      { id: "blr-indiranagar", name: "Indiranagar", lat: 12.9719, lng: 77.6412 },
      { id: "blr-whitefield", name: "Whitefield", lat: 12.9698, lng: 77.7500 },
      { id: "blr-jayanagar", name: "Jayanagar", lat: 12.9250, lng: 77.5938 },
      { id: "blr-hsr", name: "HSR Layout", lat: 12.9116, lng: 77.6389 },
    ],
  },
  {
    id: "chennai",
    name: "Chennai",
    lat: 13.0827,
    lng: 80.2707,
    zones: [
      { id: "chn-tnagar", name: "T. Nagar", lat: 13.0418, lng: 80.2341 },
      { id: "chn-adyar", name: "Adyar", lat: 13.0067, lng: 80.2572 },
      { id: "chn-anna", name: "Anna Nagar", lat: 13.085, lng: 80.2101 },
      { id: "chn-mylapore", name: "Mylapore", lat: 13.0339, lng: 80.2676 },
      { id: "chn-velachery", name: "Velachery", lat: 12.9815, lng: 80.2180 },
    ],
  },
  {
    id: "hyderabad",
    name: "Hyderabad",
    lat: 17.385,
    lng: 78.4867,
    zones: [
      { id: "hyd-banjara", name: "Banjara Hills", lat: 17.4156, lng: 78.4347 },
      { id: "hyd-madhapur", name: "Madhapur", lat: 17.4486, lng: 78.3908 },
      { id: "hyd-secunderabad", name: "Secunderabad", lat: 17.4399, lng: 78.4983 },
      { id: "hyd-kukatpally", name: "Kukatpally", lat: 17.4849, lng: 78.3911 },
      { id: "hyd-gachibowli", name: "Gachibowli", lat: 17.4401, lng: 78.3489 },
    ],
  },
];

// Delivery platforms
export const PLATFORMS = [
  { id: "swiggy", name: "Swiggy", color: "#fc8019", icon: "🛵" },
  { id: "zomato", name: "Zomato", color: "#e23744", icon: "🍕" },
  { id: "amazon", name: "Amazon Delivery", color: "#ff9900", icon: "📦" },
  { id: "zepto", name: "Zepto", color: "#8b5cf6", icon: "⚡" },
  { id: "blinkit", name: "Blinkit", color: "#f7c948", icon: "🛒" },
  { id: "dunzo", name: "Dunzo", color: "#00d09c", icon: "🏃" },
];

// Insurance plan tiers
export const PLAN_TIERS = [
  {
    id: "basic",
    name: "Basic Shield",
    weeklyPremium: 15,
    coverageMultiplier: 0.5,
    maxPayout: 500,
    description: "Essential coverage for occasional disruptions",
    features: [
      "Rain & storm coverage",
      "Basic AQI alerts",
      "Manual claim submission",
      "48-hour payout",
    ],
    color: "from-blue-500 to-blue-600",
    popular: false,
  },
  {
    id: "standard",
    name: "Standard Shield",
    weeklyPremium: 25,
    coverageMultiplier: 0.75,
    maxPayout: 1500,
    description: "Comprehensive coverage with auto-triggers",
    features: [
      "All weather events covered",
      "AQI & heatwave protection",
      "Auto-triggered claims",
      "Instant payout",
      "Real-time alerts",
    ],
    color: "from-purple-500 to-purple-600",
    popular: true,
  },
  {
    id: "pro",
    name: "Pro Shield",
    weeklyPremium: 40,
    coverageMultiplier: 1.0,
    maxPayout: 3000,
    description: "Maximum protection with priority support",
    features: [
      "All Standard features",
      "Curfew & bandh coverage",
      "Traffic disruption payout",
      "Priority fraud clearance",
      "Earnings analytics",
      "Dedicated support",
    ],
    color: "from-teal-400 to-emerald-500",
    popular: false,
  },
];

// Parametric trigger thresholds
export const TRIGGER_THRESHOLDS: Record<string, {
  field: string; threshold: number; unit: string; payoutPct: number;
  value: number; description: string;
}> = {
  heavy_rain: { field: "rainfall_mm", threshold: 30, unit: "mm/hr", payoutPct: 50, value: 30, description: "Rainfall exceeds 30mm/hr" },
  flood: { field: "rainfall_mm_24h", threshold: 100, unit: "mm/24hr", payoutPct: 100, value: 100, description: "24h rainfall exceeds 100mm" },
  heatwave: { field: "temp_c", threshold: 45, unit: "°C", payoutPct: 25, value: 45, description: "Temperature exceeds 45°C" },
  aqi: { field: "aqi", threshold: 300, unit: "AQI", payoutPct: 30, value: 300, description: "Air Quality Index exceeds 300" },
  storm: { field: "wind_speed_kmh", threshold: 60, unit: "km/h", payoutPct: 40, value: 60, description: "Wind speed exceeds 60km/h" },
  curfew: { field: "manual_trigger", threshold: 1, unit: "alert", payoutPct: 100, value: 1, description: "Government curfew or lockdown order" },
};

// Average daily earnings per platform (for payout calculation)
export const AVG_DAILY_EARNINGS: Record<string, number> = {
  swiggy: 800,
  zomato: 750,
  amazon: 900,
  zepto: 700,
  blinkit: 650,
  dunzo: 600,
};

// Navigation items
export const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: "LayoutDashboard" },
  { href: "/dashboard/map", label: "Risk Map", icon: "Map" },
  { href: "/dashboard/claims", label: "Claims", icon: "FileText" },
  { href: "/dashboard/policy", label: "My Policy", icon: "Shield" },
  { href: "/dashboard/wallet", label: "Wallet", icon: "Wallet" },
];

export const ADMIN_NAV_ITEMS = [
  { href: "/admin", label: "Overview", icon: "LayoutDashboard" },
  { href: "/admin/workers", label: "Workers", icon: "Users" },
  { href: "/admin/claims", label: "Claims", icon: "FileText" },
  { href: "/admin/triggers", label: "Trigger Panel", icon: "Zap" },
  { href: "/admin/fraud", label: "Fraud Detection", icon: "ShieldAlert" },
  { href: "/admin/analytics", label: "Analytics", icon: "BarChart3" },
];
