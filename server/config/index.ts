export const config = {
  server: {
    port: parseInt(process.env.PORT || "5000", 10),
    nodeEnv: process.env.NODE_ENV || "development",
    apiVersion: "1.0.0",
  },

  app: {
    url: process.env.APP_URL || "",
    isProduction: process.env.NODE_ENV === "production",
  },

  supabase: {
    url: process.env.SUPABASE_URL || "",
    anonKey: process.env.SUPABASE_ANON_KEY || "",
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || "",
  },

  passKit: {
    apiUrl: process.env.PASSKIT_API_URL || "https://api.passkit.com",
    apiKey: process.env.PASSKIT_API_KEY || "",
    apiSecret: process.env.PASSKIT_API_SECRET || "",
  },

  postGrid: {
    apiUrl: process.env.POSTGRID_API_URL || "https://api.postgrid.com/print-mail/v1",
    apiKey: process.env.POSTGRID_API_KEY || "",
  },

  cors: {
    origins: (process.env.CORS_ORIGINS || "*").split(","),
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Request-ID"],
  },

  rateLimit: {
    windowMs: 15 * 60 * 1000,
    maxRequests: 100,
  },
};

export function validateConfig(): { isValid: boolean; missingVars: string[] } {
  const requiredVars: { key: string; envVar: string }[] = [];

  const missingVars: string[] = [];

  for (const { key, envVar } of requiredVars) {
    if (!process.env[envVar]) {
      missingVars.push(envVar);
    }
  }

  return {
    isValid: missingVars.length === 0,
    missingVars,
  };
}

export function isSupabaseConfigured(): boolean {
  return !!(config.supabase.url && (config.supabase.anonKey || config.supabase.serviceRoleKey));
}

export function isPassKitConfigured(): boolean {
  return !!(config.passKit.apiKey && config.passKit.apiSecret);
}

export function isPostGridConfigured(): boolean {
  return !!config.postGrid.apiKey;
}

export function isAppUrlConfigured(): boolean {
  return !!config.app.url;
}

export function getAppUrl(): string {
  if (!config.app.url) {
    console.warn("⚠️ APP_URL not configured - using localhost fallback for QR codes");
    return "http://localhost:5000";
  }
  return config.app.url;
}

export function validateProductionConfig(): { isValid: boolean; warnings: string[] } {
  const warnings: string[] = [];

  if (!isSupabaseConfigured()) {
    warnings.push("SUPABASE_URL and/or SUPABASE_SERVICE_ROLE_KEY not configured");
  }

  if (!isAppUrlConfigured()) {
    warnings.push("APP_URL not configured - QR codes may point to localhost");
  }

  if (!isPassKitConfigured()) {
    warnings.push("PASSKIT_API_KEY/SECRET not configured - digital wallet features disabled");
  }

  if (!isPostGridConfigured()) {
    warnings.push("POSTGRID_API_KEY not configured - physical mail features disabled");
  }

  return {
    isValid: warnings.length === 0,
    warnings,
  };
}
