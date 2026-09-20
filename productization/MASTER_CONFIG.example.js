// Creator Private OS — reusable deployment configuration
// COPY this into a clean private master repository. Never point MASTER/DEMO at Camille production.

export const CREATOR_OS_CONFIG = {
  product: {
    name: "Creator Private OS",
    deploymentId: "DEMO-001",
    environment: "demo", // demo | staging | production
  },

  creator: {
    displayName: "Avery Vale",
    handle: "@averyvale",
    domain: "creator.example",
    tagline: "Your private world, on your terms.",
    about: "A private member destination built around one creator brand.",
    heroImage: "/assets/demo/creator-hero.webp",
  },

  access: {
    minimumAge: 18,
    requireProfilePhoto: true,
    requireOwnerApproval: true,
    membershipDurationDays: 30,
  },

  pricing: {
    currency: "USD",
    membershipPriceCents: 3000,
    messageCreditsPerMessage: 5,
    voiceCreditsPerMinute: 4,
    minimumVoiceMinutes: 5,
    creditPacks: [
      { credits: 25, priceCents: 2500 },
      { credits: 60, priceCents: 5500 },
      { credits: 120, priceCents: 10000 },
    ],
    tipAmountsCents: [500, 1000, 2500],
  },

  modules: {
    membership: true,
    messaging: true,
    voiceCalls: true,
    videoCalls: false,
    premiumDrops: true,
    tips: true,
    notifications: true,
    analytics: true,
    creatorStudio: true,
    controlRoom: true,
    aiWorkflows: true,
    socialReviewFlow: true,
  },

  social: {
    instagram: "",
    threads: "",
    tiktok: "",
    x: "",
    snapchat: "",
    facebook: "",
    youtube: "",
    pinterest: "",
    linkedin: "",
    bluesky: "",
    reddit: "",
    externalPremiumContentUrl: "",
  },

  backend: {
    // NEVER hard-code Camille production values here.
    supabaseUrl: "https://YOUR_PROJECT.supabase.co",
    supabasePublishableKey: "YOUR_PUBLISHABLE_KEY",
    checkoutFunction: "create-checkout",
    telemetryFunction: "track-site-event",
  },

  payments: {
    cardEnabled: true,
    cryptoEnabled: false,
    providerLabel: "Secure checkout",
  },

  branding: {
    theme: "luxury-dark",
    primaryWordmark: "AVERY VALE",
    accentCopy: "Private access. Direct connection.",
  },

  legal: {
    termsUrl: "/policies/",
    privacyUrl: "/policies/",
    refundUrl: "/policies/",
  }
};
