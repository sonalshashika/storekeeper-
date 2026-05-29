import type { StoreDB } from './dbInterface';
import type { 
  ItemMaster, 
  DivisionMatrix, 
  StoreRequest, 
  StoreRequestItem, 
  StockTransaction, 
  RequestStatus, 
  ItemStatus,
  AuditEntry,
  SystemAdmin
} from '../types';

const STORAGE_KEYS = {
  ITEMS: 'm365_store_items',
  DIVISIONS: 'm365_store_divisions',
  REQUESTS: 'm365_store_requests',
  REQUEST_ITEMS: 'm365_store_request_items',
  TRANSACTIONS: 'm365_store_transactions',
  ADMINS: 'm365_store_admins',
  EMAILS: 'm365_simulated_emails'
};

import { SEED_ITEMS as RAW_ITEMS, SEED_DIVISIONS as RAW_DIVISIONS } from './seedData';

const SEED_ITEMS: ItemMaster[] = RAW_ITEMS.map((item, idx) => ({
  ...item,
  id: String(idx + 1)
}));

const SEED_DIVISIONS: DivisionMatrix[] = RAW_DIVISIONS.map((div, idx) => ({
  ...div,
  id: String(idx + 1)
}));

const SEED_REQUESTS: StoreRequest[] = [
  {
    id: 'req_1',
    title: 'REQ-2026-0001',
    requesterEmail: 'alex.req@company.com',
    requesterName: 'Alex Smith',
    division: 'Engineering',
    requestDate: '2026-05-28T09:30:00Z',
    status: 'Completed',
    totalAmount: 357,
    hodApprovedDate: '2026-05-28T11:00:00Z',
    financeApprovedDate: '2026-05-28T14:30:00Z',
    storekeeperIssuedDate: '2026-05-29T08:15:00Z',
    hodComments: 'Approved. Hardware matches developer allocation guidelines.',
    financeComments: 'Approved within quarterly department budget.',
    storekeeperComments: 'Issued Logitech mouse. Reduced multiport adapters to 1 due to temporary inventory hold.',
    auditTrail: [
      { timestamp: '2026-05-28T09:30:00Z', action: 'Submitted Request', user: 'Alex Smith', role: 'Requester', comments: 'Requested workstation equipment.' },
      { timestamp: '2026-05-28T11:00:00Z', action: 'Approved HOD', user: 'Dave Head (HOD)', role: 'HOD', comments: 'Approved. Hardware matches developer allocation guidelines.' },
      { timestamp: '2026-05-28T14:30:00Z', action: 'Approved Finance', user: 'Fiona Fin (Finance Head)', role: 'Finance', comments: 'Approved within quarterly department budget.' },
      { timestamp: '2026-05-29T08:15:00Z', action: 'Fulfilled Request', user: 'Sam Keeper', role: 'Storekeeper', comments: 'Issued Logitech mouse. Reduced multiport adapters to 1 due to temporary inventory hold.' }
    ]
  },
  {
    id: 'req_2',
    title: 'REQ-2026-0002',
    requesterEmail: 'emily.req@company.com',
    requesterName: 'Emily Davis',
    division: 'Marketing',
    requestDate: '2026-05-29T04:20:00Z',
    status: 'Pending_HOD',
    totalAmount: 1999,
    auditTrail: [
      { timestamp: '2026-05-29T04:20:00Z', action: 'Submitted Request', user: 'Emily Davis', role: 'Requester', comments: 'Need MacBook Pro for video editing tasks.' }
    ]
  },
  {
    id: 'req_3',
    title: 'REQ-2026-0003',
    requesterEmail: 'john.req@company.com',
    requesterName: 'John Doe',
    division: 'Human Resources',
    requestDate: '2026-05-28T16:00:00Z',
    status: 'Pending_Finance',
    totalAmount: 849,
    hodApprovedDate: '2026-05-28T17:15:00Z',
    hodComments: 'Need desk replacement. Approved.',
    auditTrail: [
      { timestamp: '2026-05-28T16:00:00Z', action: 'Submitted Request', user: 'John Doe', role: 'Requester', comments: 'Replacing broken chair and requesting monitor.' },
      { timestamp: '2026-05-28T17:15:00Z', action: 'Approved HOD', user: 'Harry Head (HOD)', role: 'HOD', comments: 'Need desk replacement. Approved.' }
    ]
  },
  {
    id: 'req_4',
    title: 'REQ-2026-0004',
    requesterEmail: 'alex.req@company.com',
    requesterName: 'Alex Smith',
    division: 'Engineering',
    requestDate: '2026-05-29T07:10:00Z',
    status: 'Pending_Storekeeper',
    totalAmount: 1599,
    hodApprovedDate: '2026-05-29T07:45:00Z',
    financeApprovedDate: '2026-05-29T08:30:00Z',
    hodComments: 'Laptop upgrade requested.',
    financeComments: 'Approved - Capex budget matches.',
    auditTrail: [
      { timestamp: '2026-05-29T07:10:00Z', action: 'Submitted Request', user: 'Alex Smith', role: 'Requester', comments: 'Replacing failed development unit.' },
      { timestamp: '2026-05-29T07:45:00Z', action: 'Approved HOD', user: 'Dave Head (HOD)', role: 'HOD', comments: 'Laptop upgrade requested.' },
      { timestamp: '2026-05-29T08:30:00Z', action: 'Approved Finance', user: 'Fiona Fin (Finance Head)', role: 'Finance', comments: 'Approved - Capex budget matches.' }
    ]
  }
];

const SEED_REQUEST_ITEMS: StoreRequestItem[] = [
  // For req_1 (Completed)
  { id: 'ri_1', requestId: 'req_1', itemId: '2', title: 'Logitech MX Master 3S', requestedQuantity: 1, issuedQuantity: 1, itemStatus: 'Approved', unitPrice: 99, totalPrice: 99 },
  { id: 'ri_2', requestId: 'req_1', itemId: '7', title: 'USB-C Multiport Adapter', requestedQuantity: 2, issuedQuantity: 1, itemStatus: 'Approved', unitPrice: 59, totalPrice: 118 },
  { id: 'ri_3', requestId: 'req_1', itemId: '8', title: 'Premium A4 Copier Paper', requestedQuantity: 4, issuedQuantity: 4, itemStatus: 'Approved', unitPrice: 35, totalPrice: 140 },
  
  // For req_2 (Pending HOD)
  { id: 'ri_4', requestId: 'req_2', itemId: '6', title: 'Apple MacBook Pro 14"', requestedQuantity: 1, issuedQuantity: 0, itemStatus: 'Pending', unitPrice: 1999, totalPrice: 1999 },
  
  // For req_3 (Pending Finance)
  { id: 'ri_5', requestId: 'req_3', itemId: '5', title: 'Ergonomic Office Chair', requestedQuantity: 1, issuedQuantity: 0, itemStatus: 'Pending', unitPrice: 299, totalPrice: 299 },
  { id: 'ri_6', requestId: 'req_3', itemId: '4', title: 'Standing Desk Dual Motor', requestedQuantity: 1, issuedQuantity: 0, itemStatus: 'Pending', unitPrice: 550, totalPrice: 550 },

  // For req_4 (Pending Storekeeper)
  { id: 'ri_7', requestId: 'req_4', itemId: '1', title: 'ThinkPad L14 Gen 4', requestedQuantity: 1, issuedQuantity: 0, itemStatus: 'Pending', unitPrice: 1200, totalPrice: 1200 },
  { id: 'ri_8', requestId: 'req_4', itemId: '3', title: 'Dell UltraSharp 27 Monitor', requestedQuantity: 1, issuedQuantity: 0, itemStatus: 'Pending', unitPrice: 450, totalPrice: 450 }
];

const SEED_TRANSACTIONS: StockTransaction[] = [
  { id: 'tx_1', itemId: '2', itemTitle: 'Logitech MX Master 3S', transactionType: 'Stock In', quantity: 50, transactionDate: '2026-05-10T09:00:00Z', reference: 'Initial stock load', performedBy: 'Inventory Manager' },
  { id: 'tx_2', itemId: '7', transactionType: 'Stock In', itemTitle: 'USB-C Multiport Adapter', quantity: 100, transactionDate: '2026-05-10T09:00:00Z', reference: 'Initial stock load', performedBy: 'Inventory Manager' },
  { id: 'tx_3', itemId: '8', transactionType: 'Stock In', itemTitle: 'Premium A4 Copier Paper', quantity: 40, transactionDate: '2026-05-10T09:00:00Z', reference: 'Initial stock load', performedBy: 'Inventory Manager' },
  { id: 'tx_4', itemId: '2', transactionType: 'Issue', itemTitle: 'Logitech MX Master 3S', quantity: -1, transactionDate: '2026-05-29T08:15:00Z', reference: 'REQ-2026-0001', performedBy: 'Sam Keeper' },
  { id: 'tx_5', itemId: '7', transactionType: 'Issue', itemTitle: 'USB-C Multiport Adapter', quantity: -1, transactionDate: '2026-05-29T08:15:00Z', reference: 'REQ-2026-0001', performedBy: 'Sam Keeper' },
  { id: 'tx_6', itemId: '8', transactionType: 'Issue', itemTitle: 'Premium A4 Copier Paper', quantity: -4, transactionDate: '2026-05-29T08:15:00Z', reference: 'REQ-2026-0001', performedBy: 'Sam Keeper' }
];

export class LocalStoreDB implements StoreDB {
  constructor() {
    this.initDatabase();
  }

  private initDatabase() {
    if (!localStorage.getItem(STORAGE_KEYS.ITEMS)) {
      localStorage.setItem(STORAGE_KEYS.ITEMS, JSON.stringify(SEED_ITEMS));
    }
    if (!localStorage.getItem(STORAGE_KEYS.DIVISIONS)) {
      localStorage.setItem(STORAGE_KEYS.DIVISIONS, JSON.stringify(SEED_DIVISIONS));
    }
    if (!localStorage.getItem(STORAGE_KEYS.REQUESTS)) {
      localStorage.setItem(STORAGE_KEYS.REQUESTS, JSON.stringify(SEED_REQUESTS));
    }
    if (!localStorage.getItem(STORAGE_KEYS.REQUEST_ITEMS)) {
      localStorage.setItem(STORAGE_KEYS.REQUEST_ITEMS, JSON.stringify(SEED_REQUEST_ITEMS));
    }
    if (!localStorage.getItem(STORAGE_KEYS.TRANSACTIONS)) {
      localStorage.setItem(STORAGE_KEYS.TRANSACTIONS, JSON.stringify(SEED_TRANSACTIONS));
    }
    if (!localStorage.getItem(STORAGE_KEYS.ADMINS)) {
      const defaultAdmins: SystemAdmin[] = [
        { id: 'admin_1', email: 'admin@company.com', name: 'System Admin' },
        { id: 'admin_2', email: 'darshana@aatsl.lk', name: 'Darshana' }
      ];
      localStorage.setItem(STORAGE_KEYS.ADMINS, JSON.stringify(defaultAdmins));
    }
    if (!localStorage.getItem(STORAGE_KEYS.EMAILS)) {
      localStorage.setItem(STORAGE_KEYS.EMAILS, JSON.stringify([]));
    }
  }

  private getStored<T>(key: string): T[] {
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : [];
  }

  private setStored<T>(key: string, data: T[]): void {
    localStorage.setItem(key, JSON.stringify(data));
  }

  // Delay helper to simulate network request
  private async delay(): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, 200));
  }

  // Item Master
  async getItems(): Promise<ItemMaster[]> {
    await this.delay();
    return this.getStored<ItemMaster>(STORAGE_KEYS.ITEMS);
  }

  async updateItemStock(itemId: string, newStock: number): Promise<void> {
    await this.delay();
    const items = this.getStored<ItemMaster>(STORAGE_KEYS.ITEMS);
    const updated = items.map(item => item.id === itemId ? { ...item, stockOnHand: newStock } : item);
    this.setStored(STORAGE_KEYS.ITEMS, updated);
  }

  async createItem(item: Omit<ItemMaster, 'id'>): Promise<ItemMaster> {
    await this.delay();
    const items = this.getStored<ItemMaster>(STORAGE_KEYS.ITEMS);
    const newId = String(items.length > 0 ? Math.max(...items.map(i => Number(i.id))) + 1 : 1);
    const newItem: ItemMaster = { ...item, id: newId };
    items.push(newItem);
    this.setStored(STORAGE_KEYS.ITEMS, items);
    return newItem;
  }

  async updateItem(itemId: string, item: Partial<ItemMaster>): Promise<void> {
    await this.delay();
    const items = this.getStored<ItemMaster>(STORAGE_KEYS.ITEMS);
    const updated = items.map(i => i.id === itemId ? { ...i, ...item } : i);
    this.setStored(STORAGE_KEYS.ITEMS, updated);
  }

  async deleteItem(itemId: string): Promise<void> {
    await this.delay();
    const items = this.getStored<ItemMaster>(STORAGE_KEYS.ITEMS);
    this.setStored(STORAGE_KEYS.ITEMS, items.filter(i => i.id !== itemId));
  }

  // Division Approval Matrix
  async getDivisions(): Promise<DivisionMatrix[]> {
    await this.delay();
    return this.getStored<DivisionMatrix>(STORAGE_KEYS.DIVISIONS);
  }

  async createDivision(division: Omit<DivisionMatrix, 'id'>): Promise<DivisionMatrix> {
    await this.delay();
    const divisions = this.getStored<DivisionMatrix>(STORAGE_KEYS.DIVISIONS);
    const newId = String(divisions.length > 0 ? Math.max(...divisions.map(d => Number(d.id))) + 1 : 1);
    const newDiv: DivisionMatrix = { ...division, id: newId };
    divisions.push(newDiv);
    this.setStored(STORAGE_KEYS.DIVISIONS, divisions);
    return newDiv;
  }

  async updateDivision(divisionId: string, division: Partial<DivisionMatrix>): Promise<void> {
    await this.delay();
    const divisions = this.getStored<DivisionMatrix>(STORAGE_KEYS.DIVISIONS);
    const updated = divisions.map(d => d.id === divisionId ? { ...d, ...division } : d);
    this.setStored(STORAGE_KEYS.DIVISIONS, updated);
  }

  async deleteDivision(divisionId: string): Promise<void> {
    await this.delay();
    const divisions = this.getStored<DivisionMatrix>(STORAGE_KEYS.DIVISIONS);
    this.setStored(STORAGE_KEYS.DIVISIONS, divisions.filter(d => d.id !== divisionId));
  }

  // Store Requests
  async getRequests(): Promise<StoreRequest[]> {
    await this.delay();
    // Sort descending by date
    return this.getStored<StoreRequest>(STORAGE_KEYS.REQUESTS)
      .sort((a, b) => new Date(b.requestDate).getTime() - new Date(a.requestDate).getTime());
  }

  async getRequestById(requestId: string): Promise<StoreRequest | null> {
    await this.delay();
    const requests = this.getStored<StoreRequest>(STORAGE_KEYS.REQUESTS);
    return requests.find(r => r.id === requestId) || null;
  }

  async createRequest(
    request: Omit<StoreRequest, 'id' | 'title' | 'requestDate' | 'status'>, 
    items: Omit<StoreRequestItem, 'id' | 'requestId' | 'itemStatus' | 'issuedQuantity' | 'totalPrice'>[]
  ): Promise<StoreRequest> {
    await this.delay();
    const requests = this.getStored<StoreRequest>(STORAGE_KEYS.REQUESTS);
    const reqItems = this.getStored<StoreRequestItem>(STORAGE_KEYS.REQUEST_ITEMS);

    const year = new Date().getFullYear();
    const serial = String(requests.length + 1).padStart(4, '0');
    const title = `REQ-${year}-${serial}`;
    const id = `req_${Date.now()}`;
    const requestDate = new Date().toISOString();

    const auditTrail: AuditEntry[] = [
      {
        timestamp: requestDate,
        action: 'Submitted Request',
        user: request.requesterName,
        role: 'Requester',
        comments: 'Request initiated.'
      }
    ];

    const newRequest: StoreRequest = {
      ...request,
      id,
      title,
      requestDate,
      status: 'Pending_HOD',
      auditTrail
    };

    requests.push(newRequest);
    this.setStored(STORAGE_KEYS.REQUESTS, requests);

    // Save line items
    items.forEach((item, index) => {
      const lineItemId = `ri_${Date.now()}_${index}`;
      const newRequestItem: StoreRequestItem = {
        ...item,
        id: lineItemId,
        requestId: id,
        itemStatus: 'Pending',
        issuedQuantity: 0,
        totalPrice: item.requestedQuantity * item.unitPrice
      };
      reqItems.push(newRequestItem);
    });
    this.setStored(STORAGE_KEYS.REQUEST_ITEMS, reqItems);

    return newRequest;
  }

  async updateRequestStatus(
    requestId: string, 
    status: RequestStatus, 
    user: string, 
    role: string, 
    comments: string,
    action: string
  ): Promise<StoreRequest> {
    await this.delay();
    const requests = this.getStored<StoreRequest>(STORAGE_KEYS.REQUESTS);
    const index = requests.findIndex(r => r.id === requestId);
    if (index === -1) throw new Error('Request not found');

    const req = requests[index];
    const timestamp = new Date().toISOString();

    const newAudit: AuditEntry = {
      timestamp,
      action,
      user,
      role,
      comments: comments || 'No comments.'
    };

    const updatedRequest: StoreRequest = {
      ...req,
      status,
      auditTrail: [...req.auditTrail, newAudit]
    };

    if (role === 'HOD') {
      updatedRequest.hodApprovedDate = timestamp;
      updatedRequest.hodComments = comments;
    } else if (role === 'Finance') {
      updatedRequest.financeApprovedDate = timestamp;
      updatedRequest.financeComments = comments;
    } else if (role === 'Storekeeper') {
      updatedRequest.storekeeperIssuedDate = timestamp;
      updatedRequest.storekeeperComments = comments;
    }

    requests[index] = updatedRequest;
    this.setStored(STORAGE_KEYS.REQUESTS, requests);
    return updatedRequest;
  }

  // Store Request Items
  async getRequestItems(requestId: string): Promise<StoreRequestItem[]> {
    await this.delay();
    const reqItems = this.getStored<StoreRequestItem>(STORAGE_KEYS.REQUEST_ITEMS);
    return reqItems.filter(item => item.requestId === requestId);
  }

  async updateRequestItemFulfillment(
    itemId: string, 
    issuedQuantity: number, 
    status: ItemStatus
  ): Promise<void> {
    await this.delay();
    const reqItems = this.getStored<StoreRequestItem>(STORAGE_KEYS.REQUEST_ITEMS);
    const index = reqItems.findIndex(item => item.id === itemId);
    if (index !== -1) {
      reqItems[index].issuedQuantity = issuedQuantity;
      reqItems[index].itemStatus = status;
      this.setStored(STORAGE_KEYS.REQUEST_ITEMS, reqItems);
    }
  }

  async updateRequestItem(
    itemId: string,
    updates: { requestedQuantity?: number; totalPrice?: number; itemStatus?: ItemStatus }
  ): Promise<void> {
    await this.delay();
    const reqItems = this.getStored<StoreRequestItem>(STORAGE_KEYS.REQUEST_ITEMS);
    const index = reqItems.findIndex(item => item.id === itemId);
    if (index !== -1) {
      if (updates.requestedQuantity !== undefined)
        reqItems[index].requestedQuantity = updates.requestedQuantity;
      if (updates.totalPrice !== undefined)
        reqItems[index].totalPrice = updates.totalPrice;
      if (updates.itemStatus !== undefined)
        reqItems[index].itemStatus = updates.itemStatus;
      this.setStored(STORAGE_KEYS.REQUEST_ITEMS, reqItems);
    }
  }

  // Stock Transactions
  async getTransactions(): Promise<StockTransaction[]> {
    await this.delay();
    return this.getStored<StockTransaction>(STORAGE_KEYS.TRANSACTIONS)
      .sort((a, b) => new Date(b.transactionDate).getTime() - new Date(a.transactionDate).getTime());
  }

  async createTransaction(transaction: Omit<StockTransaction, 'id' | 'transactionDate'>): Promise<StockTransaction> {
    await this.delay();
    const transactions = this.getStored<StockTransaction>(STORAGE_KEYS.TRANSACTIONS);
    const newId = `tx_${Date.now()}`;
    const newTx: StockTransaction = {
      ...transaction,
      id: newId,
      transactionDate: new Date().toISOString()
    };
    transactions.push(newTx);
    this.setStored(STORAGE_KEYS.TRANSACTIONS, transactions);
    return newTx;
  }

  isConfigured(): boolean {
    return true; // LocalDB is always ready
  }

  async searchUsers(query: string): Promise<{ name: string; email: string }[]> {
    await this.delay();
    if (!query) return [];
    const lowerQuery = query.toLowerCase();
    const mockUsers = [
      { name: 'Alex Smith', email: 'alex.req@company.com' },
      { name: 'Emily Davis', email: 'emily.req@company.com' },
      { name: 'Dave Head', email: 'dave.head@company.com' },
      { name: 'Mary Head', email: 'mary.head@company.com' },
      { name: 'Harry Head', email: 'harry.head@company.com' },
      { name: 'Fiona Fin', email: 'fiona.fin@company.com' },
      { name: 'Sam Keeper', email: 'sam.keeper@company.com' },
      { name: 'Sarah Head', email: 'sarah.head@company.com' },
      { name: 'Admin User', email: 'admin@company.com' },
      { name: 'John Doe', email: 'john.req@company.com' }
    ];
    return mockUsers.filter(u => 
      u.name.toLowerCase().includes(lowerQuery) || 
      u.email.toLowerCase().includes(lowerQuery)
    );
  }

  async provision(): Promise<void> {
    // Already provisioned on constructor
    return Promise.resolve();
  }

  async seed(): Promise<void> {
    await this.resetDatabase();
  }

  async runDiagnostics(): Promise<Record<string, string[]>> {
    return {
      Store_ItemMaster: ['Title', 'SKU', 'Description', 'Category', 'Unit', 'UnitPrice', 'StockOnHand', 'ReorderLevel'],
      Store_DivisionMatrix: ['Title', 'HODEmail', 'HODName', 'FinanceEmail', 'FinanceName', 'Requesters'],
      Store_Requests: ['Title', 'RequesterEmail', 'RequesterName', 'Division', 'RequestDate', 'Status', 'TotalAmount', 'HODApprovedDate', 'FinanceApprovedDate', 'StorekeeperIssuedDate', 'HODComments', 'FinanceComments', 'StorekeeperComments', 'AuditTrail'],
      Store_RequestItems: ['Title', 'RequestID', 'ItemID', 'RequestedQuantity', 'IssuedQuantity', 'ItemStatus', 'UnitPrice', 'TotalPrice'],
      Store_StockTransactions: ['Title', 'ItemID', 'TransactionType', 'Quantity', 'TransactionDate', 'Reference', 'PerformedBy'],
      Store_SystemAdmins: ['Title', 'AdminEmail']
    };
  }

  async resolveSiteId(siteUrl: string): Promise<string> {
    await this.delay();
    const cleanUrl = siteUrl.replace("https://", "").replace("http://", "");
    return `${cleanUrl.split('/')[0]},mock-collection-id,mock-site-id`;
  }

  // System Admins
  async getAdmins(): Promise<SystemAdmin[]> {
    await this.delay();
    return this.getStored<SystemAdmin>(STORAGE_KEYS.ADMINS);
  }

  async createAdmin(admin: Omit<SystemAdmin, 'id'>): Promise<SystemAdmin> {
    await this.delay();
    const admins = this.getStored<SystemAdmin>(STORAGE_KEYS.ADMINS);
    // Clean id parse in case of seed admins
    const ids = admins.map(a => Number(a.id.replace('admin_', ''))).filter(n => !isNaN(n));
    const newId = String(ids.length > 0 ? Math.max(...ids) + 1 : 1);
    const newAdmin: SystemAdmin = { ...admin, id: `admin_${newId}` };
    admins.push(newAdmin);
    this.setStored(STORAGE_KEYS.ADMINS, admins);
    return newAdmin;
  }

  async deleteAdmin(id: string): Promise<void> {
    await this.delay();
    const admins = this.getStored<SystemAdmin>(STORAGE_KEYS.ADMINS);
    this.setStored(STORAGE_KEYS.ADMINS, admins.filter(a => a.id !== id));
  }

  // Email Notification
  async sendWorkflowEmail(to: string, subject: string, htmlContent: string): Promise<void> {
    await this.delay();
    const emails = this.getStored<any>(STORAGE_KEYS.EMAILS);
    emails.push({
      id: String(Date.now()),
      to,
      subject,
      htmlContent,
      timestamp: new Date().toISOString()
    });
    this.setStored(STORAGE_KEYS.EMAILS, emails);
    console.log(`✉️ [Simulated Email] Sent to: ${to} | Subject: ${subject}`);
  }

  async resetDatabase(): Promise<void> {
    await this.delay();
    localStorage.removeItem(STORAGE_KEYS.ITEMS);
    localStorage.removeItem(STORAGE_KEYS.DIVISIONS);
    localStorage.removeItem(STORAGE_KEYS.REQUESTS);
    localStorage.removeItem(STORAGE_KEYS.REQUEST_ITEMS);
    localStorage.removeItem(STORAGE_KEYS.TRANSACTIONS);
    localStorage.removeItem(STORAGE_KEYS.ADMINS);
    localStorage.removeItem(STORAGE_KEYS.EMAILS);
    this.initDatabase();
  }
}
