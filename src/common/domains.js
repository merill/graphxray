// Centralized domain configuration for Graph X-Ray
export const GRAPH_DOMAINS = {
  // Standard Microsoft Graph API endpoints
  STANDARD: [
    "https://graph.microsoft.com",
    "https://graph.microsoft.us",
    "https://dod-graph.microsoft.us",
    "https://microsoftgraph.chinacloudapi.cn"
  ],
  
  // Ultra X-Ray mode endpoints (undocumented/internal APIs)
  ULTRA_XRAY: [
    "https://main.iam.ad.ext.azure.com",
    "https://elm.iga.azure.com",
    "https://pds.iga.azure.com",
    "https://api.accessreviews.identitygovernance.azure.com",
    "https://management.azure.com",
    "https://admin.microsoft.com",
    "https://portal.office.com",
    "https://security.microsoft.com",
    "https://graph.windows.net",
    "https://api.azrbac.mspim.azure.com",
    "https://admin.powerplatform.microsoft.com",
    "https://admin.cloud.microsoft"
    // Additional ultra endpoints can be added here in the future
  ]
};

// Helper function to get all domains based on ultra mode setting
export const getAllowedDomains = (ultraXRayMode = false) => {
  if (ultraXRayMode) {
    return [...GRAPH_DOMAINS.STANDARD, ...GRAPH_DOMAINS.ULTRA_XRAY];
  }
  return GRAPH_DOMAINS.STANDARD;
};

// Helper function to check if a URL matches any allowed domain
export const isAllowedDomain = (url, ultraXRayMode = false) => {
  const allowedDomains = getAllowedDomains(ultraXRayMode);
  return allowedDomains.some(domain => url.includes(domain));
};

// Helper function to check if a URL is from an Ultra X-Ray domain
export const isUltraXRayDomain = (url) => {
  return GRAPH_DOMAINS.ULTRA_XRAY.some(domain => url.includes(domain));
};

// Helper function to get all domain URLs for webRequest (includes wildcards)
export const getAllDomainUrls = () => {
  const allDomains = [...GRAPH_DOMAINS.STANDARD, ...GRAPH_DOMAINS.ULTRA_XRAY];
  return allDomains.map(domain => `${domain}/*`);
};

// Helper function to parse domain from URL for host determination
export const parseGraphUrl = (url) => {
  let path = url;
  let host = "graph.microsoft.com"; // default

  // Check all known domains
  const allDomains = [...GRAPH_DOMAINS.STANDARD, ...GRAPH_DOMAINS.ULTRA_XRAY];
  
  for (const domain of allDomains) {
    if (url.includes(domain)) {
      path = url.split(domain)[1];
      host = domain.replace("https://", "");
      break;
    }
  }

  return { path, host };
};
