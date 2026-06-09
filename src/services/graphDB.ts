import { Client } from '@microsoft/microsoft-graph-client';
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
export class GraphStoreDB implements StoreDB {
  private graphClient: Client;
  private siteId: string;
  private tokenProvider: () => Promise<string>;

  constructor(siteId: string, tokenProvider: () => Promise<string>) {
    this.siteId = siteId;
    this.tokenProvider = tokenProvider;
    this.graphClient = Client.initWithMiddleware({
      authProvider: {
        getAccessToken: tokenProvider
      }
    });
  }

  private get listNames() {
    return {
      ITEMS: 'Store_ItemMaster',
      DIVISIONS: 'Store_DivisionMatrix',
      REQUESTS: 'Store_Requests',
      REQUEST_ITEMS: 'Store_RequestItems',
      TRANSACTIONS: 'Store_StockTransactions',
      ADMINS: 'Store_SystemAdmins'
    };
  }

  isConfigured(): boolean {
    return !!this.siteId && this.siteId !== 'placeholder';
  }

  // Helper to query Graph API for list items
  private async getListItems(listName: string, queryParams: string = ''): Promise<any[]> {
    const url = `/sites/${this.siteId}/lists/${listName}/items?expand=fields${queryParams}`;
    const response = await this.graphClient.api(url)
      .header("Prefer", "HonorNonIndexedQueriesHeader=true")
      .get();
    return response.value || [];
  }

  // Item Master
  async getItems(): Promise<ItemMaster[]> {
    const items = await this.getListItems(this.listNames.ITEMS);
    return items.map(i => {
      const f = i.fields;
      return {
        id: i.id,
        title: f.Title || '',
        sku: f.SKU || '',
        description: f.Description || '',
        category: f.Category || 'Other',
        unit: f.Unit || 'Unit',
        unitPrice: Number(f.UnitPrice || 0),
        stockOnHand: Number(f.StockOnHand || 0),
        reorderLevel: Number(f.ReorderLevel || 0)
      };
    });
  }

  async updateItemStock(itemId: string, newStock: number): Promise<void> {
    const url = `/sites/${this.siteId}/lists/${this.listNames.ITEMS}/items/${itemId}/fields`;
    await this.graphClient.api(url).patch({
      StockOnHand: newStock
    });
  }

  async createItem(item: Omit<ItemMaster, 'id'>): Promise<ItemMaster> {
    const url = `/sites/${this.siteId}/lists/${this.listNames.ITEMS}/items`;
    const response = await this.graphClient.api(url).post({
      fields: {
        Title: item.title,
        SKU: item.sku,
        Description: item.description,
        Category: item.category,
        Unit: item.unit,
        UnitPrice: item.unitPrice,
        StockOnHand: item.stockOnHand,
        ReorderLevel: item.reorderLevel
      }
    });
    return { ...item, id: response.id };
  }

  async seedDefaultData(): Promise<void> {
    // Insert Items
    const SEED_ITEMS: any[] = [];
    for (const item of SEED_ITEMS) {
      await this.graphClient.api(`/sites/${this.siteId}/lists/Store_ItemCatalog/items`)
        .post({
          fields: {
            Title: item.itemCode,
            ItemName: item.name,
            Category: item.category,
            Unit: item.unit,
            ReorderLevel: item.reorderLevel,
            StockOnHand: item.stockOnHand,
            UnitPrice: item.unitPrice,
            Status: item.status
          }
        });
    }
  }

  async updateItem(itemId: string, item: Partial<ItemMaster>): Promise<void> {
    const url = `/sites/${this.siteId}/lists/${this.listNames.ITEMS}/items/${itemId}/fields`;
    const fieldsToUpdate: any = {};
    if (item.title !== undefined) fieldsToUpdate.Title = item.title;
    if (item.sku !== undefined) fieldsToUpdate.SKU = item.sku;
    if (item.description !== undefined) fieldsToUpdate.Description = item.description;
    if (item.category !== undefined) fieldsToUpdate.Category = item.category;
    if (item.unit !== undefined) fieldsToUpdate.Unit = item.unit;
    if (item.unitPrice !== undefined) fieldsToUpdate.UnitPrice = item.unitPrice;
    if (item.stockOnHand !== undefined) fieldsToUpdate.StockOnHand = item.stockOnHand;
    if (item.reorderLevel !== undefined) fieldsToUpdate.ReorderLevel = item.reorderLevel;

    await this.graphClient.api(url).patch(fieldsToUpdate);
  }

  async deleteItem(itemId: string): Promise<void> {
    const url = `/sites/${this.siteId}/lists/${this.listNames.ITEMS}/items/${itemId}`;
    await this.graphClient.api(url).delete();
  }

  // Division Approval Matrix
  async getDivisions(): Promise<DivisionMatrix[]> {
    const items = await this.getListItems(this.listNames.DIVISIONS);
    return items.map(i => {
      const f = i.fields;
      return {
        id: i.id,
        title: f.Title || '',
        hodEmail: f.HODEmail || '',
        hodName: f.HODName || '',
        financeEmail: f.FinanceEmail || '',
        financeName: f.FinanceName || '',
        requesters: f.Requesters || ''
      };
    });
  }

  async createDivision(division: Omit<DivisionMatrix, 'id'>): Promise<DivisionMatrix> {
    const url = `/sites/${this.siteId}/lists/${this.listNames.DIVISIONS}/items`;
    const response = await this.graphClient.api(url).post({
      fields: {
        Title: division.title,
        HODEmail: division.hodEmail,
        HODName: division.hodName,
        FinanceEmail: division.financeEmail,
        FinanceName: division.financeName,
        Requesters: division.requesters || ''
      }
    });
    return { ...division, id: response.id };
  }

  async updateDivision(divisionId: string, division: Partial<DivisionMatrix>): Promise<void> {
    const url = `/sites/${this.siteId}/lists/${this.listNames.DIVISIONS}/items/${divisionId}/fields`;
    const fieldsToUpdate: any = {};
    if (division.title !== undefined) fieldsToUpdate.Title = division.title;
    if (division.hodEmail !== undefined) fieldsToUpdate.HODEmail = division.hodEmail;
    if (division.hodName !== undefined) fieldsToUpdate.HODName = division.hodName;
    if (division.financeEmail !== undefined) fieldsToUpdate.FinanceEmail = division.financeEmail;
    if (division.financeName !== undefined) fieldsToUpdate.FinanceName = division.financeName;
    if (division.requesters !== undefined) fieldsToUpdate.Requesters = division.requesters;

    await this.graphClient.api(url).patch(fieldsToUpdate);
  }

  async deleteDivision(divisionId: string): Promise<void> {
    const url = `/sites/${this.siteId}/lists/${this.listNames.DIVISIONS}/items/${divisionId}`;
    await this.graphClient.api(url).delete();
  }

  // Store Requests
  async getRequests(): Promise<StoreRequest[]> {
    const items = await this.getListItems(this.listNames.REQUESTS);
    return items.map(i => {
      const f = i.fields;
      let auditTrail: AuditEntry[] = [];
      try {
        if (f.AuditTrail) {
          auditTrail = JSON.parse(f.AuditTrail);
        }
      } catch (e) {
        console.error("Failed to parse audit trail", e);
      }
      return {
        id: i.id,
        title: f.Title || '',
        requesterEmail: f.RequesterEmail || '',
        requesterName: f.RequesterName || '',
        division: f.Division || '',
        requestDate: f.RequestDate || new Date().toISOString(),
        status: f.Status as RequestStatus || 'Draft',
        totalAmount: Number(f.TotalAmount || 0),
        hodApprovedDate: f.HODApprovedDate,
        financeApprovedDate: f.FinanceApprovedDate,
        storekeeperIssuedDate: f.StorekeeperIssuedDate,
        hodComments: f.HODComments,
        financeComments: f.FinanceComments,
        storekeeperComments: f.StorekeeperComments,
        auditTrail
      };
    }).sort((a, b) => new Date(b.requestDate).getTime() - new Date(a.requestDate).getTime());
  }

  async getRequestById(requestId: string): Promise<StoreRequest | null> {
    try {
      const url = `/sites/${this.siteId}/lists/${this.listNames.REQUESTS}/items/${requestId}?expand=fields`;
      const response = await this.graphClient.api(url).get();
      const f = response.fields;
      let auditTrail: AuditEntry[] = [];
      try {
        if (f.AuditTrail) {
          auditTrail = JSON.parse(f.AuditTrail);
        }
      } catch (e) {}

      return {
        id: response.id,
        title: f.Title || '',
        requesterEmail: f.RequesterEmail || '',
        requesterName: f.RequesterName || '',
        division: f.Division || '',
        requestDate: f.RequestDate || new Date().toISOString(),
        status: f.Status as RequestStatus || 'Draft',
        totalAmount: Number(f.TotalAmount || 0),
        hodApprovedDate: f.HODApprovedDate,
        financeApprovedDate: f.FinanceApprovedDate,
        storekeeperIssuedDate: f.StorekeeperIssuedDate,
        hodComments: f.HODComments,
        financeComments: f.FinanceComments,
        storekeeperComments: f.StorekeeperComments,
        auditTrail
      };
    } catch (e) {
      console.error(e);
      return null;
    }
  }

  async createRequest(
    request: Omit<StoreRequest, 'id' | 'title' | 'requestDate' | 'status'>, 
    items: Omit<StoreRequestItem, 'id' | 'requestId' | 'itemStatus' | 'issuedQuantity' | 'totalPrice'>[]
  ): Promise<StoreRequest> {
    const listRequestsUrl = `/sites/${this.siteId}/lists/${this.listNames.REQUESTS}/items`;
    const listItemsUrl = `/sites/${this.siteId}/lists/${this.listNames.REQUEST_ITEMS}/items`;

    // Fetch existing count to make a serial title
    const existing = await this.getListItems(this.listNames.REQUESTS);
    const year = new Date().getFullYear();
    const serial = String(existing.length + 1).padStart(4, '0');
    const title = `REQ-${year}-${serial}`;
    const requestDate = new Date().toISOString();

    const auditTrail: AuditEntry[] = [
      {
        timestamp: requestDate,
        action: 'Submitted Request',
        user: request.requesterName,
        role: 'Requester',
        comments: 'Request initiated via Microsoft Graph.'
      }
    ];

    const fields = {
      Title: title,
      RequesterEmail: request.requesterEmail,
      RequesterName: request.requesterName,
      Division: request.division,
      RequestDate: requestDate,
      Status: 'Pending_HOD',
      TotalAmount: request.totalAmount,
      AuditTrail: JSON.stringify(auditTrail)
    };

    const requestResponse = await this.graphClient.api(listRequestsUrl).post({ fields });
    const requestId = requestResponse.id;

    // Create line items sequentially (Graph batch endpoint can also be used, but sequential post is safer)
    for (const item of items) {
      await this.graphClient.api(listItemsUrl).post({
        fields: {
          Title: item.title,
          RequestID: requestId, // store lookup id
          ItemID: item.itemId,
          RequestedQuantity: item.requestedQuantity,
          IssuedQuantity: 0,
          ItemStatus: 'Pending',
          UnitPrice: item.unitPrice,
          TotalPrice: item.requestedQuantity * item.unitPrice
        }
      });
    }

    return {
      ...request,
      id: requestId,
      title,
      requestDate,
      status: 'Pending_HOD',
      auditTrail
    };
  }

  async updateRequestStatus(
    requestId: string, 
    status: RequestStatus, 
    user: string, 
    role: string, 
    comments: string,
    action: string
  ): Promise<StoreRequest> {
    const current = await this.getRequestById(requestId);
    if (!current) throw new Error('Request not found');

    const timestamp = new Date().toISOString();
    const newAudit: AuditEntry = {
      timestamp,
      action,
      user,
      role,
      comments: comments || 'No comments.'
    };

    const updatedAuditTrail = [...current.auditTrail, newAudit];
    const fieldsToUpdate: any = {
      Status: status,
      AuditTrail: JSON.stringify(updatedAuditTrail)
    };

    if (role === 'HOD') {
      fieldsToUpdate.HODApprovedDate = timestamp;
      fieldsToUpdate.HODComments = comments;
    } else if (role === 'Finance') {
      fieldsToUpdate.FinanceApprovedDate = timestamp;
      fieldsToUpdate.FinanceComments = comments;
    } else if (role === 'Storekeeper') {
      fieldsToUpdate.StorekeeperIssuedDate = timestamp;
      fieldsToUpdate.StorekeeperComments = comments;
    }

    const url = `/sites/${this.siteId}/lists/${this.listNames.REQUESTS}/items/${requestId}/fields`;
    await this.graphClient.api(url).patch(fieldsToUpdate);

    return {
      ...current,
      status,
      auditTrail: updatedAuditTrail,
      hodApprovedDate: role === 'HOD' ? timestamp : current.hodApprovedDate,
      financeApprovedDate: role === 'Finance' ? timestamp : current.financeApprovedDate,
      storekeeperIssuedDate: role === 'Storekeeper' ? timestamp : current.storekeeperIssuedDate,
      hodComments: role === 'HOD' ? comments : current.hodComments,
      financeComments: role === 'Finance' ? comments : current.financeComments,
      storekeeperComments: role === 'Storekeeper' ? comments : current.storekeeperComments
    };
  }

  // Store Request Items
  async getRequestItems(requestId: string): Promise<StoreRequestItem[]> {
    // Load all items from the list and filter client-side.
    // This avoids issues where the Graph SDK re-encodes OData query strings
    // passed directly in the URL, which breaks server-side $filter queries.
    try {
      const allItems = await this.getListItems(this.listNames.REQUEST_ITEMS);
      const filtered = allItems.filter(i => i.fields.RequestID === requestId);
      console.log(
        `getRequestItems: found ${filtered.length} items for request ${requestId} (of ${allItems.length} total)`
      );
      return filtered.map(i => {
        const f = i.fields;
        return {
          id: i.id,
          requestId: f.RequestID || '',
          itemId: f.ItemID || '',
          title: f.Title || '',
          requestedQuantity: Number(f.RequestedQuantity || 0),
          issuedQuantity: Number(f.IssuedQuantity || 0),
          itemStatus: f.ItemStatus as ItemStatus || 'Pending',
          unitPrice: Number(f.UnitPrice || 0),
          totalPrice: Number(f.TotalPrice || 0)
        };
      });
    } catch (e) {
      console.error('Error fetching request items for', requestId, e);
      return [];
    }
  }

  async updateRequestItemFulfillment(
    itemId: string, 
    issuedQuantity: number, 
    status: ItemStatus
  ): Promise<void> {
    const url = `/sites/${this.siteId}/lists/${this.listNames.REQUEST_ITEMS}/items/${itemId}/fields`;
    await this.graphClient.api(url).patch({
      IssuedQuantity: issuedQuantity,
      ItemStatus: status
    });
  }

  async updateRequestItem(
    itemId: string,
    updates: { requestedQuantity?: number; totalPrice?: number; itemStatus?: ItemStatus }
  ): Promise<void> {
    const url = `/sites/${this.siteId}/lists/${this.listNames.REQUEST_ITEMS}/items/${itemId}/fields`;
    const fields: any = {};
    if (updates.requestedQuantity !== undefined) fields.RequestedQuantity = updates.requestedQuantity;
    if (updates.totalPrice !== undefined) fields.TotalPrice = updates.totalPrice;
    if (updates.itemStatus !== undefined) fields.ItemStatus = updates.itemStatus;
    await this.graphClient.api(url).patch(fields);
  }

  // Stock Transactions
  async getTransactions(): Promise<StockTransaction[]> {
    const items = await this.getListItems(this.listNames.TRANSACTIONS);
    return items.map(i => {
      const f = i.fields;
      return {
        id: i.id,
        itemId: f.ItemID || '',
        itemTitle: f.Title || '',
        transactionType: f.TransactionType || 'Issue',
        quantity: Number(f.Quantity || 0),
        transactionDate: f.TransactionDate || new Date().toISOString(),
        reference: f.Reference || '',
        performedBy: f.PerformedBy || ''
      };
    }).sort((a, b) => new Date(b.transactionDate).getTime() - new Date(a.transactionDate).getTime());
  }

  async createTransaction(transaction: Omit<StockTransaction, 'id' | 'transactionDate'>): Promise<StockTransaction> {
    const url = `/sites/${this.siteId}/lists/${this.listNames.TRANSACTIONS}/items`;
    const transactionDate = new Date().toISOString();
    const response = await this.graphClient.api(url).post({
      fields: {
        Title: transaction.itemTitle,
        ItemID: transaction.itemId,
        TransactionType: transaction.transactionType,
        Quantity: transaction.quantity,
        TransactionDate: transactionDate,
        Reference: transaction.reference,
        PerformedBy: transaction.performedBy
      }
    });
    return {
      ...transaction,
      id: response.id,
      transactionDate
    };
  }

  // Provisioning Lists in SharePoint
  async provision(): Promise<void> {
    const listsUrl = `/sites/${this.siteId}/lists`;

    const createList = async (displayName: string, columns: any[]) => {
      try {
        await this.graphClient.api(listsUrl).post({
          displayName,
          columns
        });
        console.log(`Created list: ${displayName}`);
      } catch (e: any) {
        // If list already exists, check and add missing columns
        if (e.statusCode === 409 || (e.message && e.message.includes('already exists'))) {
          console.log(`List ${displayName} already exists. Checking for missing columns...`);
          try {
            const colUrl = `/sites/${this.siteId}/lists/${displayName}/columns`;
            const response = await this.graphClient.api(colUrl).select('name').get();
            const existingColNames = (response.value || []).map((c: any) => c.name.toLowerCase());
            
            for (const col of columns) {
              if (!existingColNames.includes(col.name.toLowerCase())) {
                console.log(`Adding missing column '${col.name}' to list '${displayName}'...`);
                await this.graphClient.api(colUrl).post(col);
                console.log(`Added column '${col.name}' successfully.`);
              }
            }
          } catch (colErr) {
            console.error(`Failed to verify/add columns for ${displayName}`, colErr);
            throw colErr;
          }
        } else {
          throw e;
        }
      }
    };

    // 1. Item Master
    await createList(this.listNames.ITEMS, [
      { name: 'SKU', text: {} },
      { name: 'Description', text: { allowMultipleLines: true } },
      { name: 'Category', choice: { choices: ['IT Equipment', 'Office Supplies', 'Furniture', 'Other'] } },
      { name: 'Unit', text: {} },
      { name: 'UnitPrice', currency: {} },
      { name: 'StockOnHand', number: {} },
      { name: 'ReorderLevel', number: {} }
    ]);

    // 2. Division Approval Matrix
    await createList(this.listNames.DIVISIONS, [
      { name: 'HODEmail', text: {} },
      { name: 'HODName', text: {} },
      { name: 'FinanceEmail', text: {} },
      { name: 'FinanceName', text: {} },
      { name: 'Requesters', text: { allowMultipleLines: true } }
    ]);

    // 3. Store Requests
    await createList(this.listNames.REQUESTS, [
      { name: 'RequesterEmail', text: {} },
      { name: 'RequesterName', text: {} },
      { name: 'Division', text: {} },
      { name: 'RequestDate', dateTime: {} },
      { name: 'Status', choice: { choices: ['Draft', 'Pending_HOD', 'Pending_Finance', 'Pending_Storekeeper', 'Completed', 'Declined'] } },
      { name: 'TotalAmount', currency: {} },
      { name: 'HODApprovedDate', dateTime: {} },
      { name: 'FinanceApprovedDate', dateTime: {} },
      { name: 'StorekeeperIssuedDate', dateTime: {} },
      { name: 'HODComments', text: { allowMultipleLines: true } },
      { name: 'FinanceComments', text: { allowMultipleLines: true } },
      { name: 'StorekeeperComments', text: { allowMultipleLines: true } },
      { name: 'AuditTrail', text: { allowMultipleLines: true } }
    ]);

    // 4. Store Request Items
    await createList(this.listNames.REQUEST_ITEMS, [
      { name: 'RequestID', text: {} }, // Lookup request id represented as text for indexing ease
      { name: 'ItemID', text: {} },
      { name: 'RequestedQuantity', number: {} },
      { name: 'IssuedQuantity', number: {} },
      { name: 'ItemStatus', choice: { choices: ['Pending', 'Approved', 'Declined'] } },
      { name: 'UnitPrice', currency: {} },
      { name: 'TotalPrice', currency: {} }
    ]);

    // 5. Stock Transactions
    await createList(this.listNames.TRANSACTIONS, [
      { name: 'ItemID', text: {} },
      { name: 'TransactionType', choice: { choices: ['Stock In', 'Issue', 'Correction'] } },
      { name: 'Quantity', number: {} },
      { name: 'TransactionDate', dateTime: {} },
      { name: 'Reference', text: {} },
      { name: 'PerformedBy', text: {} }
    ]);

    // 6. System Admins
    await createList(this.listNames.ADMINS, [
      { name: 'AdminEmail', text: {} }
    ]);
  }

  async seed(): Promise<void> {
    console.log("Seeding removed since test data is no longer needed.");
    // 3. Seed Admins if empty
    try {
      const currentAdmins = await this.getAdmins();
      if (currentAdmins.length === 0) {
        console.log("Seeding default admins to SharePoint...");
        await this.createAdmin({ name: 'System Admin', email: 'admin@company.com' });
        await this.createAdmin({ name: 'Darshana', email: 'darshana@aatsl.lk' });
      }
    } catch (e) {
      console.error("Could not seed admins", e);
    }
  }

  // System Admins
  async getAdmins(): Promise<SystemAdmin[]> {
    const items = await this.getListItems(this.listNames.ADMINS);
    return items.map(i => {
      const f = i.fields;
      return {
        id: i.id,
        name: f.Title || '',
        email: f.AdminEmail || ''
      };
    });
  }

  async createAdmin(admin: Omit<SystemAdmin, 'id'>): Promise<SystemAdmin> {
    const url = `/sites/${this.siteId}/lists/${this.listNames.ADMINS}/items`;
    const response = await this.graphClient.api(url).post({
      fields: {
        Title: admin.name,
        AdminEmail: admin.email
      }
    });
    return { ...admin, id: response.id };
  }

  async deleteAdmin(adminId: string): Promise<void> {
    const url = `/sites/${this.siteId}/lists/${this.listNames.ADMINS}/items/${adminId}`;
    await this.graphClient.api(url).delete();
  }

  // Email Notification via Microsoft Graph API sendMail
  async sendWorkflowEmail(to: string, subject: string, htmlContent: string): Promise<void> {
    const url = `/me/sendMail`;
    const emailBody = {
      message: {
        subject: subject,
        body: {
          contentType: 'HTML',
          content: htmlContent
        },
        toRecipients: [
          {
            emailAddress: {
              address: to
            }
          }
        ]
      },
      saveToSentItems: 'true'
    };

    try {
      await this.graphClient.api(url).post(emailBody);
      console.log(`GraphStoreDB: Successfully sent email to ${to} with subject "${subject}"`);
    } catch (e) {
      console.error(`GraphStoreDB: Failed to send email to ${to}`, e);
      // Do not throw error, keep workflow operational
    }
  }

  async searchUsers(query: string): Promise<{ name: string; email: string }[]> {
    if (!query || query.trim().length < 2) return [];
    try {
      const cleanQuery = query.replace(/'/g, "''");
      const url = `/users`;
      
      const response = await this.graphClient.api(url)
        .filter(`startswith(displayName,'${cleanQuery}') or startswith(userPrincipalName,'${cleanQuery}') or startswith(mail,'${cleanQuery}')`)
        .select('displayName,userPrincipalName,mail')
        .top(10)
        .get();
      
      return (response.value || []).map((u: any) => ({
        name: u.displayName || '',
        email: u.mail || u.userPrincipalName || ''
      }));
    } catch (e) {
      console.error("Graph API searchUsers failed", e);
      return [];
    }
  }

  async runDiagnostics(): Promise<Record<string, string[]>> {
    const results: Record<string, string[]> = {};
    
    // Add Token Scope Diagnostics
    try {
      const token = await this.tokenProvider();
      if (!token) {
        results['Active_Token_Diagnostics'] = ['Error: Access Token is empty.'];
      } else {
        const parts = token.split('.');
        if (parts.length >= 2) {
          // base64url decode payload
          const base64Url = parts[1];
          const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
          const payload = JSON.parse(decodeURIComponent(atob(base64).split('').map(c => {
            return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
          }).join('')));
          
          results['Active_Token_Diagnostics'] = [
            `User Principal Name: ${payload.upn || payload.unique_name || payload.email || 'Unknown'}`,
            `Audience: ${payload.aud || 'Unknown'}`,
            `Active Scopes (scp): ${payload.scp || 'None'}`,
            `Roles (roles): ${payload.roles ? (Array.isArray(payload.roles) ? payload.roles.join(', ') : payload.roles) : 'None'}`
          ];
        } else {
          results['Active_Token_Diagnostics'] = ['Error: Token is not in standard JWT format.'];
        }
      }
    } catch (e: any) {
      results['Active_Token_Diagnostics'] = [`Error reading token: ${e.message || e.toString()}`];
    }

    const lists = Object.values(this.listNames);
    
    for (const listName of lists) {
      try {
        const url = `/sites/${this.siteId}/lists/${listName}/columns`;
        const response = await this.graphClient.api(url).select('name,displayName').get();
        results[listName] = (response.value || []).map((c: any) => `${c.displayName} (Internal: ${c.name})`);
      } catch (e: any) {
        results[listName] = [`Error: ${e.message || e.toString()}`];
      }
    }
    return results;
  }

  async resolveSiteId(siteUrl: string): Promise<string> {
    const cleanUrl = siteUrl.replace("https://", "").replace("http://", "");
    const parts = cleanUrl.split('/');
    const hostname = parts[0];
    const path = '/' + parts.slice(1).join('/');
    
    const url = `/sites/${hostname}:${path}`;
    const response = await this.graphClient.api(url).select('id').get();
    return response.id;
  }

  async resetDatabase(): Promise<void> {
    const lists = Object.values(this.listNames);
    for (const listName of lists) {
      try {
        const items = await this.getListItems(listName);
        for (const item of items) {
          const url = `/sites/${this.siteId}/lists/${listName}/items/${item.id}`;
          await this.graphClient.api(url).delete();
        }
        console.log(`GraphStoreDB: Cleared all items from list: ${listName}`);
      } catch (e) {
        console.error(`GraphStoreDB: Failed to clear list ${listName}`, e);
        throw e;
      }
    }
  }
}
