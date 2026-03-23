window.AnalyticsConfig = {
  version: "1.0.0",

  // API Credentials (centralized)
  credentials: {
    mixpanel: {
      token: "e9d2d9d462a6493dfb535a71a4689f67",
      proxyUrl: null // set to proxy URL if needed, otherwise null
    },
    amplitude: {
      apiKey: "07b96a7d692335871422fe36584de08c"
    },
    clevertap: {
      accountId: "46W-6K5-R47Z",
      region: "eu1"
    }
  },

  // Default region
  region: "in",

  // Enabled platforms (uppercase)
  // MIXPANEL is enabled for identify/profile updates only (events are blocked below)
  platforms: ["MIXPANEL", "AMPLITUDE", "CLEVERTAP"],

  // Server-side fallback URL (used when all client SDKs fail to load)
  fallbackUrl: "https://asia-south1-mathai-449208.cloudfunctions.net/analyticsFallback",

  // Sentry integration
  sentry: {
    enabled: true,
    captureAnalyticsErrors: true
  },

  // Helper method with skip lists
  // NOTE: Called as shouldSendToPlatform(platform, event) from AnalyticsManager
  shouldSendToPlatform: function (platform, event) {
    // Events to skip on ALL platforms
    var skipAllPlatforms = [];

    if (platform === "MIXPANEL") {
      // Block ALL events for Mixpanel
      // Identify and profile updates still work (they don't use this check)
      return false;
    }

    if (platform === "AMPLITUDE") {
      var skipEvents = skipAllPlatforms.concat([]);
      return skipEvents.indexOf(event) === -1;
    }

    if (platform === "CLEVERTAP") {
      var skipEvents = skipAllPlatforms.concat([]);
      return skipEvents.indexOf(event) === -1;
    }

    // Default: send event
    return true;
  }
};
