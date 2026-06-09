import type { Configuration, PopupRequest } from "@azure/msal-browser";

// We read configurations from localStorage if configured, otherwise fallback to placeholder values
const getSavedConfig = () => {
  const saved = localStorage.getItem('m365_graph_config');
  if (saved) {
    try {
      return JSON.parse(saved);
    } catch (e) {
      console.error("Failed to parse saved config in MSAL config", e);
    }
  }
  return {
    clientId: '72172dff-3813-4698-8b81-90dd0add052c',
    tenantId: '2044f3ba-e7ca-4c6e-bd23-bc167c032bb8',
    siteUrl: 'https://aatslanka.sharepoint.com/sites/Storekeeper',
    siteId: 'aatslanka.sharepoint.com,37d4a2a4-ba85-4d4b-afb4-3799848028a5,c30896cc-5734-4b11-89d3-1b06343e2b36',
    isEnabled: true
  };
};

const saved = getSavedConfig();

export const msalConfig: Configuration = {
  auth: {
    clientId: saved?.clientId || "00000000-0000-0000-0000-000000000000",
    authority: `https://login.microsoftonline.com/${saved?.tenantId || "common"}`,
    redirectUri: window.location.origin,
    postLogoutRedirectUri: window.location.origin,
  },
  cache: {
    cacheLocation: "localStorage" // Changed from sessionStorage to localStorage to persist sessions
  }
};

// Add here scopes for id token to be used at MSal and Microsoft Graph API
export const loginRequest: PopupRequest = {
  scopes: [
    "User.Read",
    "User.ReadBasic.All",
    "Sites.Read.All",
    "Sites.ReadWrite.All",
    "Sites.Manage.All" // Required to create and provision lists on SharePoint
  ]
};

export const graphConfig = {
  graphMeEndpoint: "https://graph.microsoft.com/v1.0/me",
  graphSiteEndpoint: (siteUrl: string) => {
    // Parse site URL to retrieve site-id or path. siteUrl looks like: company.sharepoint.com:/sites/StoreApp
    const cleanUrl = siteUrl.replace("https://", "").replace("http://", "");
    return `https://graph.microsoft.com/v1.0/sites/${cleanUrl}`;
  }
};
