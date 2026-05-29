export type RequestStatus = 'Draft' | 'Pending_HOD' | 'Pending_Finance' | 'Pending_Storekeeper' | 'Completed' | 'Declined';

export type TransactionType = 'Stock In' | 'Issue' | 'Correction';

export type ItemStatus = 'Pending' | 'Approved' | 'Declined';

export interface ItemMaster {
  id: string; // SharePoint uses Title/ID. We'll use string for ID
  title: string; // Item Name
  sku: string;
  description: string;
  category: string;
  unit: string;
  unitPrice: number;
  stockOnHand: number;
  reorderLevel: number;
}

export interface DivisionMatrix {
  id: string;
  title: string; // Division Name
  hodEmail: string;
  hodName: string;
  financeEmail: string;
  financeName: string;
  requesters?: string; // Semicolon-separated list of emails of assigned users
}

export interface SystemAdmin {
  id: string;
  email: string;
  name: string;
}

export interface AuditEntry {
  timestamp: string;
  action: string;
  user: string;
  role: string;
  comments: string;
}

export interface StoreRequest {
  id: string;
  title: string; // REQ-XXXX-XXXX
  requesterEmail: string;
  requesterName: string;
  division: string;
  requestDate: string;
  status: RequestStatus;
  totalAmount: number;
  hodApprovedDate?: string;
  financeApprovedDate?: string;
  storekeeperIssuedDate?: string;
  hodComments?: string;
  financeComments?: string;
  storekeeperComments?: string;
  auditTrail: AuditEntry[]; // In SharePoint, this will be saved as stringified JSON
}

export interface StoreRequestItem {
  id: string;
  requestId: string;
  itemId: string;
  title: string; // Item Name
  requestedQuantity: number;
  issuedQuantity: number;
  itemStatus: ItemStatus;
  unitPrice: number;
  totalPrice: number;
}

export interface StockTransaction {
  id: string;
  itemId: string;
  itemTitle: string; // Cache item name for quick logs
  transactionType: TransactionType;
  quantity: number; // positive for adding stock, negative for issuing stock
  transactionDate: string;
  reference: string; // e.g. Request Number REQ-XXXX
  performedBy: string;
}

export interface M365Config {
  clientId: string;
  tenantId: string;
  siteUrl: string;
  siteId?: string;
  isEnabled: boolean;
}

export type AppUserRole = 'Requester' | 'HOD' | 'Finance' | 'Storekeeper' | 'Admin';

export interface UserProfile {
  name: string;
  email: string;
  role: AppUserRole;
}
