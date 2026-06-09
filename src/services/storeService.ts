import type { StoreDB } from './dbInterface';
import { GraphStoreDB } from './graphDB';
import type { M365Config } from '../types';

let currentDb: StoreDB | null = null;
let tokenProvider: (() => Promise<string>) | null = null;

const CONFIG_KEY = 'm365_graph_config';

export const getM365Config = (): M365Config => {
  const saved = localStorage.getItem(CONFIG_KEY);
  if (saved) {
    try {
      return JSON.parse(saved);
    } catch (e) {
      console.error("Failed to parse saved M365 config", e);
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

export const saveM365Config = (config: M365Config): void => {
  localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
  // Reinitialize DB based on config
  initializeDB();
};

export const registerTokenProvider = (provider: () => Promise<string>): void => {
  tokenProvider = provider;
  initializeDB();
};

export const initializeDB = (): void => {
  const config = getM365Config();
  if (config.siteId && tokenProvider) {
    currentDb = new GraphStoreDB(config.siteId, tokenProvider);
    console.log("StoreApp: Initialized Microsoft Graph SharePoint DB provider.");
  } else {
    console.warn("StoreApp: M365 Config missing siteId or tokenProvider. Database uninitialized.");
    currentDb = null;
  }
};

// Export active DB accessor
export const getDB = (): StoreDB => {
  if (!currentDb) {
    throw new Error("StoreDB not initialized. Please ensure M365 login and site configuration is completed.");
  }
  return currentDb;
};

export const isM365Mode = (): boolean => {
  return true; // Always M365 now
};

