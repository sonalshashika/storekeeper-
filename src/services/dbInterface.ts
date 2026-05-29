import type { 
  ItemMaster, 
  DivisionMatrix, 
  StoreRequest, 
  StoreRequestItem, 
  StockTransaction, 
  RequestStatus, 
  ItemStatus,
  SystemAdmin
} from '../types';

export interface StoreDB {
  // Item Master
  getItems(): Promise<ItemMaster[]>;
  updateItemStock(itemId: string, newStock: number): Promise<void>;
  createItem(item: Omit<ItemMaster, 'id'>): Promise<ItemMaster>;
  updateItem(itemId: string, item: Partial<ItemMaster>): Promise<void>;
  deleteItem(itemId: string): Promise<void>;

  // Division Approval Matrix
  getDivisions(): Promise<DivisionMatrix[]>;
  createDivision(division: Omit<DivisionMatrix, 'id'>): Promise<DivisionMatrix>;
  updateDivision(divisionId: string, division: Partial<DivisionMatrix>): Promise<void>;
  deleteDivision(divisionId: string): Promise<void>;

  // Store Requests
  getRequests(): Promise<StoreRequest[]>;
  getRequestById(requestId: string): Promise<StoreRequest | null>;
  createRequest(request: Omit<StoreRequest, 'id' | 'title' | 'requestDate' | 'status'>, items: Omit<StoreRequestItem, 'id' | 'requestId' | 'itemStatus' | 'issuedQuantity' | 'totalPrice'>[]): Promise<StoreRequest>;
  updateRequestStatus(
    requestId: string, 
    status: RequestStatus, 
    user: string, 
    role: string, 
    comments: string,
    action: string
  ): Promise<StoreRequest>;

  // Store Request Items
  getRequestItems(requestId: string): Promise<StoreRequestItem[]>;
  updateRequestItemFulfillment(
    itemId: string, 
    issuedQuantity: number, 
    status: ItemStatus
  ): Promise<void>;
  updateRequestItem(
    itemId: string,
    updates: { requestedQuantity?: number; totalPrice?: number; itemStatus?: ItemStatus }
  ): Promise<void>;

  // Stock Transactions
  getTransactions(): Promise<StockTransaction[]>;
  createTransaction(transaction: Omit<StockTransaction, 'id' | 'transactionDate'>): Promise<StockTransaction>;

  // User Lookup
  searchUsers(query: string): Promise<{ name: string; email: string }[]>;

  // System Admins
  getAdmins(): Promise<SystemAdmin[]>;
  createAdmin(admin: Omit<SystemAdmin, 'id'>): Promise<SystemAdmin>;
  deleteAdmin(id: string): Promise<void>;

  // Email Notification
  sendWorkflowEmail(to: string, subject: string, htmlContent: string): Promise<void>;

  // Provisioning & Health
  isConfigured(): boolean;
  provision(): Promise<void>;
  seed(): Promise<void>;
  runDiagnostics(): Promise<Record<string, string[]>>;
  resolveSiteId(siteUrl: string): Promise<string>;
  resetDatabase(): Promise<void>;
}
