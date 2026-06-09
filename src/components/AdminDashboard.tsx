import React, { useState, useEffect } from 'react';
import type { StoreDB } from '../services/dbInterface';
import type { 
  ItemMaster, 
  DivisionMatrix, 
  StockTransaction, 
  M365Config,
  SystemAdmin
} from '../types';
import { 
  getM365Config, 
  saveM365Config
} from '../services/storeService';
import { 
  Settings, 
  Package, 
  Layers, 
  Activity, 
  Edit2, 
  Trash2, 
  Save, 
  RefreshCw, 
  CloudLightning,
  Database,
  UserPlus
} from 'lucide-react';

interface AdminDashboardProps {
  db: StoreDB;
  onConfigChange: () => void;
}

type AdminTab = 'catalog' | 'divisions' | 'transactions' | 'config';

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ db, onConfigChange }) => {
  const [activeTab, setActiveTab] = useState<AdminTab>('catalog');
  
  // Data States
  const [catalog, setCatalog] = useState<ItemMaster[]>([]);
  const [divisions, setDivisions] = useState<DivisionMatrix[]>([]);
  const [transactions, setTransactions] = useState<StockTransaction[]>([]);
  const [admins, setAdmins] = useState<SystemAdmin[]>([]);
  const [loading, setLoading] = useState(true);

  // Form States - Item Master
  const [itemForm, setItemForm] = useState<Omit<ItemMaster, 'id'>>({
    title: '', sku: '', description: '', category: 'IT Equipment', unit: 'Unit', unitPrice: 0, stockOnHand: 0, reorderLevel: 0
  });
  const [editingItemId, setEditingItemId] = useState<string | null>(null);

  // Form States - Division Matrix
  const [divisionForm, setDivisionForm] = useState<Omit<DivisionMatrix, 'id'>>({
    title: '', hodEmail: '', hodName: '', financeEmail: '', financeName: '', requesters: ''
  });
  const [editingDivisionId, setEditingDivisionId] = useState<string | null>(null);

  // Form States - Appoint Admins
  const [adminForm, setAdminForm] = useState({ name: '', email: '' });
  const [adminResults, setAdminResults] = useState<{ name: string; email: string }[]>([]);
  const [showAdminDropdown, setShowAdminDropdown] = useState(false);

  // Autocomplete States for M365 User Search
  const [hodResults, setHodResults] = useState<{ name: string; email: string }[]>([]);
  const [showHodDropdown, setShowHodDropdown] = useState(false);
  const [financeResults, setFinanceResults] = useState<{ name: string; email: string }[]>([]);
  const [showFinanceDropdown, setShowFinanceDropdown] = useState(false);

  // Config States
  const [config, setConfig] = useState<M365Config>({
    clientId: '', tenantId: '', siteUrl: '', siteId: '', isEnabled: false
  });
  const [provisioning, setProvisioning] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [runningDiagnostics, setRunningDiagnostics] = useState(false);
  const [configStatus, setConfigStatus] = useState<{ type: 'success' | 'error' | ''; text: string }>({ type: '', text: '' });

  useEffect(() => {
    loadData();
    setConfig(getM365Config());
  }, [db, activeTab]);

  const loadData = async () => {
    setLoading(true);
    try {
      if (activeTab === 'catalog') {
        const items = await db.getItems();
        setCatalog(items);
      } else if (activeTab === 'divisions') {
        const divs = await db.getDivisions();
        setDivisions(divs);
      } else if (activeTab === 'transactions') {
        const txs = await db.getTransactions();
        setTransactions(txs);
      }
      
      const adminsList = await db.getAdmins();
      setAdmins(adminsList);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  // ADMIN APPOINT CRUD handlers
  const handleAdminSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminForm.email || !adminForm.name) return;
    try {
      await db.createAdmin(adminForm);
      setAdminForm({ name: '', email: '' });
      await loadData();
    } catch (err: any) {
      alert(`Error appointing admin: ${err.message || err.toString()}`);
    }
  };

  const handleDeleteAdmin = async (id: string) => {
    if (confirm('Are you sure you want to revoke admin privileges for this user?')) {
      try {
        await db.deleteAdmin(id);
        await loadData();
      } catch (err: any) {
        alert(`Error revoking admin: ${err.message || err.toString()}`);
      }
    }
  };

  const handleAdminSearchChange = async (val: string) => {
    setAdminForm(prev => ({ ...prev, name: val }));
    if (val.trim().length >= 2) {
      try {
        const results = await db.searchUsers(val);
        setAdminResults(results);
        setShowAdminDropdown(results.length > 0);
      } catch (err) {
        console.error(err);
      }
    } else {
      setAdminResults([]);
      setShowAdminDropdown(false);
    }
  };

  const handleSelectAdminUser = (user: { name: string; email: string }) => {
    setAdminForm({
      name: user.name,
      email: user.email
    });
    setShowAdminDropdown(false);
  };

  // ITEM MASTER CRUD
  const handleItemSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingItemId) {
        // Adjust stock transaction if editing stock manually
        const oldItem = catalog.find(i => i.id === editingItemId);
        if (oldItem && oldItem.stockOnHand !== itemForm.stockOnHand) {
          const diff = itemForm.stockOnHand - oldItem.stockOnHand;
          await db.createTransaction({
            itemId: editingItemId,
            itemTitle: itemForm.title,
            transactionType: 'Correction',
            quantity: diff,
            reference: 'Admin Manual Adjustment',
            performedBy: 'System Admin'
          });
        }

        await db.updateItem(editingItemId, itemForm);
        setEditingItemId(null);
      } else {
        const newItem = await db.createItem(itemForm);
        // Create initial stock in transaction
        if (itemForm.stockOnHand > 0) {
          await db.createTransaction({
            itemId: newItem.id,
            itemTitle: itemForm.title,
            transactionType: 'Stock In',
            quantity: itemForm.stockOnHand,
            reference: 'Initial Inventory Load',
            performedBy: 'System Admin'
          });
        }
      }
      setItemForm({ title: '', sku: '', description: '', category: 'IT Equipment', unit: 'Unit', unitPrice: 0, stockOnHand: 0, reorderLevel: 0 });
      await loadData();
    } catch (e: any) {
      console.error(e);
      alert(`Error saving catalog item: ${e.message || e.toString()}\n\nIf you created this list manually, check that 'Store_ItemMaster' has columns with the EXACT internal names: 'SKU', 'Description', 'Category', 'Unit', 'UnitPrice', 'StockOnHand', 'ReorderLevel'.`);
    }
  };

  const handleEditItem = (item: ItemMaster) => {
    setEditingItemId(item.id);
    setItemForm({
      title: item.title,
      sku: item.sku,
      description: item.description,
      category: item.category,
      unit: item.unit,
      unitPrice: item.unitPrice,
      stockOnHand: item.stockOnHand,
      reorderLevel: item.reorderLevel
    });
  };

  const handleDeleteItem = async (id: string) => {
    if (confirm('Are you sure you want to delete this item from catalog?')) {
      await db.deleteItem(id);
      await loadData();
    }
  };

  // DIVISION MATRIX CRUD
  const handleDivisionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingDivisionId) {
        await db.updateDivision(editingDivisionId, divisionForm);
        setEditingDivisionId(null);
      } else {
        await db.createDivision(divisionForm);
      }
      setDivisionForm({ title: '', hodEmail: '', hodName: '', financeEmail: '', financeName: '', requesters: '' });
      await loadData();
    } catch (e: any) {
      console.error(e);
      alert(`Error saving division routing: ${e.message || e.toString()}\n\nIf you created this list manually, check that 'Store_DivisionMatrix' has columns with the EXACT internal names: 'HODEmail', 'HODName', 'FinanceEmail', 'FinanceName'.`);
    }
  };

  const handleHodSearchChange = async (val: string) => {
    setDivisionForm(prev => ({ ...prev, hodName: val }));
    if (val.trim().length >= 2) {
      try {
        const results = await db.searchUsers(val);
        setHodResults(results);
        setShowHodDropdown(results.length > 0);
      } catch (err) {
        console.error(err);
      }
    } else {
      setHodResults([]);
      setShowHodDropdown(false);
    }
  };

  const handleSelectHodUser = (user: { name: string; email: string }) => {
    setDivisionForm(prev => ({
      ...prev,
      hodName: user.name,
      hodEmail: user.email
    }));
    setShowHodDropdown(false);
  };

  const handleFinanceSearchChange = async (val: string) => {
    setDivisionForm(prev => ({ ...prev, financeName: val }));
    if (val.trim().length >= 2) {
      try {
        const results = await db.searchUsers(val);
        setFinanceResults(results);
        setShowFinanceDropdown(results.length > 0);
      } catch (err) {
        console.error(err);
      }
    } else {
      setFinanceResults([]);
      setShowFinanceDropdown(false);
    }
  };

  const handleSelectFinanceUser = (user: { name: string; email: string }) => {
    setDivisionForm(prev => ({
      ...prev,
      financeName: user.name,
      financeEmail: user.email
    }));
    setShowFinanceDropdown(false);
  };

  const handleEditDivision = (div: DivisionMatrix) => {
    setEditingDivisionId(div.id);
    setDivisionForm({
      title: div.title,
      hodEmail: div.hodEmail,
      hodName: div.hodName,
      financeEmail: div.financeEmail,
      financeName: div.financeName,
      requesters: div.requesters || ''
    });
  };

  const handleDeleteDivision = async (id: string) => {
    if (confirm('Are you sure you want to delete this division mapping?')) {
      await db.deleteDivision(id);
      await loadData();
    }
  };

  // CONFIG / INTEGRATION
  const handleConfigSave = (e: React.FormEvent) => {
    e.preventDefault();
    setConfigStatus({ type: '', text: '' });
    try {
      saveM365Config(config);
      onConfigChange();
      setConfigStatus({ type: 'success', text: 'M365 Configuration saved successfully.' });
    } catch (e: any) {
      setConfigStatus({ type: 'error', text: e.message || 'Failed to save configuration.' });
    }
  };

  const handleLookupSiteId = async () => {
    if (!config.siteUrl) {
      setConfigStatus({ type: 'error', text: 'Please input site URL first (e.g. company.sharepoint.com:/sites/StoreApp)' });
      return;
    }
    setConfigStatus({ type: 'success', text: 'Resolving Site ID via MS Graph...' });
    try {
      const resolvedId = await db.resolveSiteId(config.siteUrl);
      setConfig({ ...config, siteId: resolvedId });
      setConfigStatus({ type: 'success', text: `Resolved Site ID: ${resolvedId}` });
    } catch (e: any) {
      console.error(e);
      setConfigStatus({ type: 'error', text: `Failed to resolve Site ID: ${e.message || e.toString()}\n\nMake sure you are logged in to Microsoft 365 and the site URL is correct.` });
    }
  };

  const handleProvisionLists = async () => {
    if (!config.siteId) {
      setConfigStatus({ type: 'error', text: 'Site ID must be resolved before provisioning lists.' });
      return;
    }
    setProvisioning(true);
    setConfigStatus({ type: 'success', text: 'Provisioning Lists Store_ItemMaster, Store_DivisionMatrix, Store_Requests, Store_RequestItems, and Store_StockTransactions in SharePoint...' });
    try {
      await db.provision();
      setConfigStatus({ type: 'success', text: 'All 5 lists and columns provisioned successfully! You can toggle M365 connection.' });
    } catch (e: any) {
      setConfigStatus({ type: 'error', text: `Provision error: ${e.message || 'Verify Site permissions.'}` });
    } finally {
      setProvisioning(false);
    }
  };

  const handleSeedM365Data = async () => {
    setSeeding(true);
    setConfigStatus({ type: 'success', text: 'Seeding mock catalog and division matrix to your SharePoint Lists...' });
    try {
      await db.seed();
      setConfigStatus({ type: 'success', text: 'Successfully seeded default items and division approval matrix to SharePoint!' });
      onConfigChange(); // Refresh data
    } catch (e: any) {
      setConfigStatus({ type: 'error', text: `Seeding error: ${e.message || 'Check site write permissions.'}` });
    } finally {
      setSeeding(false);
    }
  };

  const handleRunDiagnostics = async () => {
    setRunningDiagnostics(true);
    setConfigStatus({ type: 'success', text: 'Running SharePoint list schema diagnostics...' });
    try {
      const results = await db.runDiagnostics();
      let msg = 'SharePoint List Diagnostics Report:\n\n';
      for (const [listName, cols] of Object.entries(results)) {
        msg += `[List: ${listName}]\n`;
        cols.forEach(c => {
          msg += `  - ${c}\n`;
        });
        msg += '\n';
      }
      alert(msg);
      setConfigStatus({ type: 'success', text: 'Diagnostics completed. Check the alert box for details.' });
    } catch (e: any) {
      setConfigStatus({ type: 'error', text: `Diagnostics failed: ${e.message || e.toString()}` });
    } finally {
      setRunningDiagnostics(false);
    }
  };

  const handleResetDB = async () => {
    const confirmMsg = 'WARNING: This will delete ALL items in your live SharePoint lists (requests, catalog, transactions, divisions). This cannot be undone. Continue?';
      
    if (confirm(confirmMsg)) {
      setLoading(true);
      setConfigStatus({ type: 'success', text: 'Clearing SharePoint list items...' });
      try {
        await db.resetDatabase();
        alert('SharePoint lists cleared successfully.');
        await loadData();
      } catch (e: any) {
        alert(`Reset failed: ${e.message || e.toString()}`);
      } finally {
        setLoading(false);
        setConfigStatus({ type: '', text: '' });
      }
    }
  };

  return (
    <div className="flex-column gap-md">
      {/* Title */}
      <div className="flex justify-between align-center">
        <div>
          <h2 className="gradient-text shadow-text-glow flex align-center gap-sm" style={{ fontSize: '26px' }}>
            <Settings size={28} />
            Administrator Control Center
          </h2>
          <p className="text-secondary" style={{ fontSize: '14px' }}>
            Maintain catalogs, adjust approval matrices, audit transactions, and manage M365 integrations.
          </p>
        </div>

        {/* Tab Selection */}
        <div className="tabs-navigation">
          <button className={`tab-btn ${activeTab === 'catalog' ? 'active' : ''}`} onClick={() => setActiveTab('catalog')}>
            <Package size={14} /> Catalog
          </button>
          <button className={`tab-btn ${activeTab === 'divisions' ? 'active' : ''}`} onClick={() => setActiveTab('divisions')}>
            <Layers size={14} /> Divisions Matrix
          </button>
          <button className={`tab-btn ${activeTab === 'transactions' ? 'active' : ''}`} onClick={() => setActiveTab('transactions')}>
            <Activity size={14} /> Transactions Log
          </button>
          <button className={`tab-btn ${activeTab === 'config' ? 'active' : ''}`} onClick={() => setActiveTab('config')}>
            <CloudLightning size={14} /> M365 Setup
          </button>
        </div>
      </div>

      {activeTab === 'catalog' && (
        /* CATALOG TAB */
        <div className="dashboard-layout">
          {/* Item Catalog List */}
          <div className="glass-panel flex-column gap-sm">
            <h3 style={{ fontSize: '18px', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
              Item Master Catalog ({catalog.length} items)
            </h3>
            {loading ? (
              <div style={{ padding: '30px', textAlign: 'center' }} className="text-muted">Loading items...</div>
            ) : catalog.length === 0 ? (
              <div className="text-muted" style={{ padding: '30px', textAlign: 'center' }}>No items in catalog. Create one on the right.</div>
            ) : (
              <div className="table-container" style={{ maxHeight: '500px', overflowY: 'auto' }}>
                <table className="custom-table" style={{ fontSize: '13px' }}>
                  <thead>
                    <tr>
                      <th>SKU</th>
                      <th>Item Name</th>
                      <th>Category</th>
                      <th className="text-right">Price</th>
                      <th className="text-right">Stock</th>
                      <th className="text-right">Reorder</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {catalog.map(item => (
                      <tr key={item.id} style={{ opacity: item.stockOnHand <= item.reorderLevel ? 0.95 : 1 }}>
                        <td><code>{item.sku}</code></td>
                        <td>
                          <span style={{ fontWeight: 600 }}>{item.title}</span>
                          <span className="text-muted" style={{ fontSize: '11px', display: 'block', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {item.description}
                          </span>
                        </td>
                        <td>{item.category}</td>
                        <td className="text-right">LKR {item.unitPrice.toLocaleString()}</td>
                        <td className="text-right">
                          <span style={{ 
                            fontWeight: 700, 
                            color: item.stockOnHand <= item.reorderLevel ? 'var(--color-declined)' : 'var(--text-primary)' 
                          }}>
                            {item.stockOnHand} {item.unit}
                          </span>
                        </td>
                        <td className="text-right text-muted">{item.reorderLevel}</td>
                        <td>
                          <div className="flex gap-sm">
                            <button className="btn btn-secondary" style={{ padding: '4px 6px' }} onClick={() => handleEditItem(item)}>
                              <Edit2 size={12} />
                            </button>
                            <button className="btn btn-danger" style={{ padding: '4px 6px' }} onClick={() => handleDeleteItem(item.id)}>
                              <Trash2 size={12} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Catalog Item Editor Form */}
          <div className="glass-panel">
            <h3 style={{ fontSize: '18px', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }} className="margin-bottom-md">
              {editingItemId ? 'Edit Catalog Item' : 'Create New Catalog Item'}
            </h3>
            <form onSubmit={handleItemSubmit} className="flex-column gap-sm">
              <div className="form-group">
                <label>Item Name *</label>
                <input 
                  type="text" 
                  className="form-control" 
                  value={itemForm.title} 
                  onChange={(e) => setItemForm({ ...itemForm, title: e.target.value })} 
                  required
                />
              </div>

              <div className="grid-cols-2">
                <div className="form-group">
                  <label>SKU (Unique Identifier) *</label>
                  <input 
                    type="text" 
                    className="form-control" 
                    value={itemForm.sku} 
                    onChange={(e) => setItemForm({ ...itemForm, sku: e.target.value })} 
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Category</label>
                  <select 
                    className="form-control"
                    value={itemForm.category}
                    onChange={(e) => setItemForm({ ...itemForm, category: e.target.value })}
                  >
                    <option value="IT Equipment">IT Equipment</option>
                    <option value="Office Supplies">Office Supplies</option>
                    <option value="Furniture">Furniture</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label>Description</label>
                <textarea 
                  className="form-control" 
                  value={itemForm.description} 
                  onChange={(e) => setItemForm({ ...itemForm, description: e.target.value })}
                  rows={2}
                />
              </div>

              <div className="grid-cols-2">
                <div className="form-group">
                  <label>Unit (e.g. Unit, Box, Pack)</label>
                  <input 
                    type="text" 
                    className="form-control" 
                    value={itemForm.unit} 
                    onChange={(e) => setItemForm({ ...itemForm, unit: e.target.value })} 
                  />
                </div>
                <div className="form-group">
                  <label>Unit Price (LKR) *</label>
                  <input 
                    type="number" 
                    className="form-control" 
                    value={itemForm.unitPrice} 
                    min={0}
                    onChange={(e) => setItemForm({ ...itemForm, unitPrice: Number(e.target.value) })} 
                    required
                  />
                </div>
              </div>

              <div className="grid-cols-2">
                <div className="form-group">
                  <label>Physical Stock On Hand *</label>
                  <input 
                    type="number" 
                    className="form-control" 
                    value={itemForm.stockOnHand} 
                    min={0}
                    onChange={(e) => setItemForm({ ...itemForm, stockOnHand: Number(e.target.value) })} 
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Reorder Warning Level *</label>
                  <input 
                    type="number" 
                    className="form-control" 
                    value={itemForm.reorderLevel} 
                    min={0}
                    onChange={(e) => setItemForm({ ...itemForm, reorderLevel: Number(e.target.value) })} 
                    required
                  />
                </div>
              </div>

              <div className="flex gap-sm justify-end margin-top-md">
                {editingItemId && (
                  <button 
                    type="button" 
                    className="btn btn-secondary" 
                    onClick={() => {
                      setEditingItemId(null);
                      setItemForm({ title: '', sku: '', description: '', category: 'IT Equipment', unit: 'Unit', unitPrice: 0, stockOnHand: 0, reorderLevel: 0 });
                    }}
                  >
                    Cancel
                  </button>
                )}
                <button type="submit" className="btn btn-primary">
                  <Save size={14} /> {editingItemId ? 'Update Item' : 'Add Item'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {activeTab === 'divisions' && (
        /* DIVISIONS TAB */
        <div className="dashboard-layout">
          {/* List of Divisions Matrix */}
          <div className="glass-panel flex-column gap-sm">
            <h3 style={{ fontSize: '18px', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
              Division Approvers Matrix ({divisions.length} divisions)
            </h3>
            {loading ? (
              <div style={{ padding: '30px', textAlign: 'center' }} className="text-muted">Loading matrices...</div>
            ) : divisions.length === 0 ? (
              <div className="text-muted" style={{ padding: '30px', textAlign: 'center' }}>No matrices defined. Create one on the right.</div>
            ) : (
              <div className="table-container">
                <table className="custom-table" style={{ fontSize: '13px' }}>
                  <thead>
                    <tr>
                      <th>Division</th>
                      <th>Head of Division (HOD)</th>
                      <th>Finance Head</th>
                      <th>Assigned Requesters</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {divisions.map(div => (
                      <tr key={div.id}>
                        <td><strong style={{ color: 'var(--secondary)' }}>{div.title}</strong></td>
                        <td>
                          <div className="flex-column">
                            <span>{div.hodName}</span>
                            <code style={{ fontSize: '11px' }} className="text-muted">{div.hodEmail}</code>
                          </div>
                        </td>
                        <td>
                          <div className="flex-column">
                            <span>{div.financeName}</span>
                            <code style={{ fontSize: '11px' }} className="text-muted">{div.financeEmail}</code>
                          </div>
                        </td>
                        <td>
                          <div style={{ maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={div.requesters || 'All Users'}>
                            {div.requesters ? div.requesters.split(';').join(', ') : 'All Users (Any)'}
                          </div>
                        </td>
                        <td>
                          <div className="flex gap-sm">
                            <button className="btn btn-secondary" style={{ padding: '4px 6px' }} onClick={() => handleEditDivision(div)}>
                              <Edit2 size={12} />
                            </button>
                            <button className="btn btn-danger" style={{ padding: '4px 6px' }} onClick={() => handleDeleteDivision(div.id)}>
                              <Trash2 size={12} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Division Editor Form */}
          <div className="glass-panel">
            <h3 style={{ fontSize: '18px', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }} className="margin-bottom-md">
              {editingDivisionId ? 'Edit Division Routing' : 'Create New Division Routing'}
            </h3>
            <form onSubmit={handleDivisionSubmit} className="flex-column gap-sm">
              <div className="form-group">
                <label>Division Name *</label>
                <input 
                  type="text" 
                  className="form-control" 
                  placeholder="e.g. Operations, IT, Finance"
                  value={divisionForm.title} 
                  onChange={(e) => setDivisionForm({ ...divisionForm, title: e.target.value })} 
                  required
                />
              </div>

              <div className="form-group" style={{ position: 'relative' }}>
                <label>Head of Division (HOD) Name *</label>
                <input 
                  type="text" 
                  className="form-control" 
                  placeholder="Type to search M365 tenant users..."
                  value={divisionForm.hodName} 
                  onChange={(e) => handleHodSearchChange(e.target.value)} 
                  onFocus={() => { if (hodResults.length > 0) setShowHodDropdown(true); }}
                  onBlur={() => { setTimeout(() => setShowHodDropdown(false), 250); }}
                  required
                  autoComplete="off"
                />
                {showHodDropdown && hodResults.length > 0 && (
                  <ul className="autocomplete-dropdown" style={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    right: 0,
                    background: 'var(--bg-secondary)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '8px',
                    listStyle: 'none',
                    margin: '4px 0 0',
                    padding: 0,
                    maxHeight: '180px',
                    overflowY: 'auto',
                    zIndex: 100,
                    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.5)'
                  }}>
                    {hodResults.map((user, idx) => (
                      <li 
                        key={idx} 
                        style={{
                          padding: '8px 12px',
                          cursor: 'pointer',
                          borderBottom: '1px solid rgba(255,255,255,0.05)',
                          fontSize: '12px'
                        }}
                        onMouseDown={() => handleSelectHodUser(user)}
                        className="autocomplete-item"
                      >
                        <div style={{ fontWeight: 600, color: '#fff' }}>{user.name}</div>
                        <div className="text-muted" style={{ fontSize: '10px', marginTop: '2px' }}>{user.email}</div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="form-group">
                <label>HOD Microsoft Account Email *</label>
                <input 
                  type="email" 
                  className="form-control" 
                  placeholder="e.g. dave.head@company.com"
                  value={divisionForm.hodEmail} 
                  onChange={(e) => setDivisionForm({ ...divisionForm, hodEmail: e.target.value })} 
                  required
                />
              </div>

              <div className="form-group" style={{ position: 'relative' }}>
                <label>Finance Head Name *</label>
                <input 
                  type="text" 
                  className="form-control" 
                  placeholder="Type to search M365 tenant users..."
                  value={divisionForm.financeName} 
                  onChange={(e) => handleFinanceSearchChange(e.target.value)} 
                  onFocus={() => { if (financeResults.length > 0) setShowFinanceDropdown(true); }}
                  onBlur={() => { setTimeout(() => setShowFinanceDropdown(false), 250); }}
                  required
                  autoComplete="off"
                />
                {showFinanceDropdown && financeResults.length > 0 && (
                  <ul className="autocomplete-dropdown" style={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    right: 0,
                    background: 'var(--bg-secondary)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '8px',
                    listStyle: 'none',
                    margin: '4px 0 0',
                    padding: 0,
                    maxHeight: '180px',
                    overflowY: 'auto',
                    zIndex: 100,
                    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.5)'
                  }}>
                    {financeResults.map((user, idx) => (
                      <li 
                        key={idx} 
                        style={{
                          padding: '8px 12px',
                          cursor: 'pointer',
                          borderBottom: '1px solid rgba(255,255,255,0.05)',
                          fontSize: '12px'
                        }}
                        onMouseDown={() => handleSelectFinanceUser(user)}
                        className="autocomplete-item"
                      >
                        <div style={{ fontWeight: 600, color: '#fff' }}>{user.name}</div>
                        <div className="text-muted" style={{ fontSize: '10px', marginTop: '2px' }}>{user.email}</div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="form-group">
                <label>Finance Microsoft Account Email *</label>
                <input 
                  type="email" 
                  className="form-control" 
                  placeholder="e.g. fiona.fin@company.com"
                  value={divisionForm.financeEmail} 
                  onChange={(e) => setDivisionForm({ ...divisionForm, financeEmail: e.target.value })} 
                  required
                />
              </div>

              <div className="form-group">
                <label>Assigned Users / Requesters (Semicolon-separated Emails)</label>
                <textarea 
                  className="form-control" 
                  placeholder="e.g. alex.req@company.com;emily.req@company.com"
                  value={divisionForm.requesters || ''} 
                  onChange={(e) => setDivisionForm({ ...divisionForm, requesters: e.target.value })} 
                  rows={3}
                />
                <span className="text-muted" style={{ fontSize: '11px' }}>
                  Provide emails of users allowed to request items under this division, separated by semicolons. Leave blank to allow any user to submit requests for this division.
                </span>
              </div>

              <div className="flex gap-sm justify-end margin-top-md">
                {editingDivisionId && (
                  <button 
                    type="button" 
                    className="btn btn-secondary" 
                    onClick={() => {
                      setEditingDivisionId(null);
                      setDivisionForm({ title: '', hodEmail: '', hodName: '', financeEmail: '', financeName: '', requesters: '' });
                    }}
                  >
                    Cancel
                  </button>
                )}
                <button type="submit" className="btn btn-primary">
                  <Save size={14} /> {editingDivisionId ? 'Update Routing' : 'Add Routing'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {activeTab === 'transactions' && (
        /* TRANSACTIONS TAB */
        <div className="glass-panel flex-column gap-sm">
          <div className="flex justify-between align-center border-bottom pb-sm">
            <h3 style={{ fontSize: '18px' }} className="flex align-center gap-sm">
              <Activity size={18} />
              Stock Transaction Audit Ledger
            </h3>
            <button className="btn btn-secondary" style={{ padding: '6px 12px' }} onClick={loadData}>
              <RefreshCw size={14} /> Refresh Logs
            </button>
          </div>

          {loading ? (
            <div style={{ padding: '30px', textAlign: 'center' }} className="text-muted">Loading transactions...</div>
          ) : transactions.length === 0 ? (
            <div className="text-muted" style={{ padding: '30px', textAlign: 'center' }}>No stock transaction logs generated.</div>
          ) : (
            <div className="table-container" style={{ maxHeight: '500px', overflowY: 'auto' }}>
              <table className="custom-table" style={{ fontSize: '13px' }}>
                <thead>
                  <tr>
                    <th>Timestamp</th>
                    <th>Item</th>
                    <th>Log Type</th>
                    <th className="text-right">Qty Flow</th>
                    <th>Ref ID</th>
                    <th>Performed By</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map(tx => (
                    <tr key={tx.id}>
                      <td className="text-muted">{new Date(tx.transactionDate).toLocaleString()}</td>
                      <td><strong>{tx.itemTitle || `Item ID: ${tx.itemId}`}</strong></td>
                      <td>
                        <span style={{ 
                          fontSize: '11px', 
                          padding: '2px 6px', 
                          borderRadius: '4px',
                          fontWeight: 600,
                          background: tx.transactionType === 'Stock In' ? 'rgba(40, 200, 100, 0.15)' : tx.transactionType === 'Issue' ? 'rgba(235, 140, 20, 0.15)' : 'rgba(255,255,255,0.08)',
                          color: tx.transactionType === 'Stock In' ? 'var(--color-completed)' : tx.transactionType === 'Issue' ? 'var(--color-pending-store)' : 'var(--text-secondary)'
                        }}>
                          {tx.transactionType}
                        </span>
                      </td>
                      <td className={`text-right font-semibold ${tx.quantity > 0 ? 'text-completed' : 'text-declined'}`} style={{ color: tx.quantity > 0 ? 'var(--color-completed)' : 'var(--color-declined)', fontWeight: 600 }}>
                        {tx.quantity > 0 ? `+${tx.quantity}` : tx.quantity}
                      </td>
                      <td><code>{tx.reference}</code></td>
                      <td>{tx.performedBy}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {activeTab === 'config' && (
        <>
          {/* M365 CONFIGURATION TAB */}
          <div className="dashboard-layout">
          {/* MSAL configuration inputs */}
          <div className="glass-panel">
            <h3 style={{ fontSize: '18px', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }} className="margin-bottom-md flex align-center gap-sm">
              <CloudLightning size={18} className="text-secondary" />
              M365 Integration Configuration
            </h3>

            <form onSubmit={handleConfigSave} className="flex-column gap-sm">
              <div className="form-group">
                <label>Azure AD Application (Client) ID</label>
                <input 
                  type="text" 
                  placeholder="e.g. e5a18a5e-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                  className="form-control" 
                  value={config.clientId} 
                  onChange={(e) => setConfig({ ...config, clientId: e.target.value })} 
                  required
                />
              </div>

              <div className="form-group">
                <label>Directory (Tenant) ID</label>
                <input 
                  type="text" 
                  placeholder="e.g. b8f45a8e-xxxx-xxxx-xxxx-xxxxxxxxxxxx (or 'common')"
                  className="form-control" 
                  value={config.tenantId} 
                  onChange={(e) => setConfig({ ...config, tenantId: e.target.value })} 
                  required
                />
              </div>

              <div className="form-group">
                <label>SharePoint Site Path URL (Least-Privilege Site)</label>
                <div className="flex gap-sm">
                  <input 
                    type="text" 
                    placeholder="e.g. companyname.sharepoint.com:/sites/Storekeeper"
                    className="form-control" 
                    value={config.siteUrl} 
                    onChange={(e) => setConfig({ ...config, siteUrl: e.target.value })} 
                    required
                  />
                  <button type="button" className="btn btn-secondary" onClick={handleLookupSiteId}>
                    Resolve ID
                  </button>
                </div>
                <span className="text-muted" style={{ fontSize: '11px' }}>
                  Ensure redirect URL pointing back to {window.location.origin} is registered in the Entra App.
                </span>
              </div>

              <div className="form-group">
                <label>Resolved SharePoint Site ID</label>
                <input 
                  type="text" 
                  className="form-control" 
                  style={{ opacity: 0.8 }}
                  value={config.siteId} 
                  disabled
                />
              </div>

              {configStatus.text && (
                <div className={`alert-box ${configStatus.type === 'success' ? 'alert-info' : 'alert-warning'}`}>
                  {configStatus.text}
                </div>
              )}

              <button type="submit" className="btn btn-primary margin-top-md" disabled={!config.isEnabled}>
                Save & Load M365 Mode
              </button>
            </form>
          </div>

          {/* Provisioning utilities */}
          <div className="glass-panel flex-column gap-md">
            <div>
              <h3 style={{ fontSize: '18px', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }} className="flex align-center gap-sm">
                <Database size={18} />
                SharePoint Schema Deployment
              </h3>
              <p className="text-secondary" style={{ fontSize: '13px', marginTop: '8px' }}>
                Once you save configuration and authenticate, deployment of the underlying lists is automated.
              </p>
            </div>

            <div className="flex-column gap-sm" style={{ background: 'var(--bg-secondary)', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
              <strong>Provisioning Steps:</strong>
              <ol style={{ paddingLeft: '16px', fontSize: '12px', lineHeight: '1.5' }} className="text-secondary">
                <li>Acquire consent for Microsoft Entra App registration.</li>
                <li>Verify your user account is a Site Owner or has `Sites.Selected` WRITE permission.</li>
                <li>Click "Deploy Schemas" to auto-create lists & column metadata.</li>
              </ol>

              <button 
                className="btn btn-secondary margin-top-md" 
                disabled={!config.siteId || provisioning}
                onClick={handleProvisionLists}
                style={{ background: 'rgba(255,255,255,0.05)', opacity: !config.siteId ? 0.5 : 1 }}
              >
                {provisioning ? 'Deploying List Schemas...' : 'Deploy SharePoint Lists'}
              </button>

              <button 
                className="btn btn-secondary margin-top-sm" 
                disabled={!config.siteId || seeding}
                onClick={handleSeedM365Data}
                style={{ background: 'rgba(255,255,255,0.05)', opacity: !config.siteId ? 0.5 : 1 }}
              >
                {seeding ? 'Seeding Default Data...' : 'Seed Default Catalog & Divisions'}
              </button>

              <button 
                className="btn btn-secondary margin-top-sm" 
                disabled={!config.siteId || runningDiagnostics}
                onClick={handleRunDiagnostics}
                style={{ background: 'rgba(255,255,255,0.05)', opacity: !config.siteId ? 0.5 : 1 }}
              >
                {runningDiagnostics ? 'Checking SharePoint Schema...' : 'Check SharePoint Schema (Diagnostics)'}
              </button>
            </div>

            <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
              <h4 className="margin-bottom-md" style={{ fontSize: '14px' }}>
                {config.isEnabled ? 'Wipe SharePoint Database' : 'Demo System Reset'}
              </h4>
              <p className="text-muted" style={{ fontSize: '12px', marginBottom: '12px' }}>
                {config.isEnabled 
                  ? 'Delete all requests, request items, catalog entries, and transaction logs from your live SharePoint site.'
                  : 'Clear changes made in local simulation mode and reseed with default catalog, divisions, and requests.'}
              </p>
              <button 
                className="btn btn-danger" 
                style={{ width: '100%' }}
                onClick={handleResetDB}
              >
                {config.isEnabled ? 'Wipe Live SharePoint Data' : 'Reset Local Simulation Data'}
              </button>
            </div>
          </div>
        </div>

        {/* Appoint System Admins Panel */}
        <div className="glass-panel flex-column gap-sm" style={{ marginTop: '24px' }}>
          <h3 style={{ fontSize: '18px', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }} className="flex align-center gap-sm">
            <UserPlus size={18} className="text-secondary" />
            Appoint System Administrators
          </h3>
          <p className="text-secondary" style={{ fontSize: '13px' }}>
            Appointed administrators will be able to access this control center, modify item stock catalogs, edit approval division matrices, and configure system integrations.
          </p>

          <div className="dashboard-layout" style={{ marginTop: '16px' }}>
            {/* Admins List */}
            <div className="flex-column gap-sm">
              <h4 className="text-secondary" style={{ fontSize: '14px' }}>Current System Administrators</h4>
              <div className="table-container" style={{ maxHeight: '200px', overflowY: 'auto' }}>
                <table className="custom-table" style={{ fontSize: '13px' }}>
                  <thead>
                    <tr>
                      <th>Admin Name</th>
                      <th>Email Principal Name</th>
                      <th style={{ width: '80px' }}>Revoke</th>
                    </tr>
                  </thead>
                  <tbody>
                    {admins.map(admin => (
                      <tr key={admin.id}>
                        <td><strong>{admin.name}</strong></td>
                        <td><code>{admin.email}</code></td>
                        <td>
                          <button 
                            className="btn btn-danger" 
                            style={{ padding: '4px 8px', fontSize: '12px' }}
                            onClick={() => handleDeleteAdmin(admin.id)}
                            disabled={admins.length <= 1} // Prevent lockout
                          >
                            Revoke
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Appoint Form */}
            <div className="flex-column gap-sm" style={{ background: 'rgba(0,0,0,0.15)', padding: '16px', borderRadius: '8px', border: '1px dashed var(--border-color)' }}>
              <h4 className="text-secondary" style={{ fontSize: '14px' }}>Appoint New Administrator</h4>
              <form onSubmit={handleAdminSubmit} className="flex-column gap-sm">
                <div className="form-group" style={{ position: 'relative', marginBottom: '8px' }}>
                  <label style={{ fontSize: '12px' }}>Search User Name *</label>
                  <input 
                    type="text" 
                    className="form-control" 
                    placeholder="Search and select user..."
                    value={adminForm.name} 
                    onChange={(e) => handleAdminSearchChange(e.target.value)}
                    onFocus={() => { if (adminResults.length > 0) setShowAdminDropdown(true); }}
                    onBlur={() => { setTimeout(() => setShowAdminDropdown(false), 250); }}
                    required
                    autoComplete="off"
                  />
                  {showAdminDropdown && adminResults.length > 0 && (
                    <ul className="autocomplete-dropdown" style={{
                      position: 'absolute',
                      top: '100%',
                      left: 0,
                      right: 0,
                      background: 'var(--bg-secondary)',
                      border: '1px solid var(--border-color)',
                      borderRadius: '8px',
                      listStyle: 'none',
                      margin: '4px 0 0',
                      padding: 0,
                      maxHeight: '180px',
                      overflowY: 'auto',
                      zIndex: 100,
                      boxShadow: '0 4px 12px rgba(0, 0, 0, 0.5)'
                    }}>
                      {adminResults.map((user, idx) => (
                        <li 
                          key={idx} 
                          style={{
                            padding: '8px 12px',
                            cursor: 'pointer',
                            borderBottom: '1px solid rgba(255,255,255,0.05)',
                            fontSize: '12px'
                          }}
                          onMouseDown={() => handleSelectAdminUser(user)}
                          className="autocomplete-item"
                        >
                          <div style={{ fontWeight: 600, color: '#fff' }}>{user.name}</div>
                          <div className="text-muted" style={{ fontSize: '10px', marginTop: '2px' }}>{user.email}</div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div className="form-group" style={{ marginBottom: '8px' }}>
                  <label style={{ fontSize: '12px' }}>Email Address *</label>
                  <input 
                    type="email" 
                    className="form-control" 
                    placeholder="e.g. user@aatsl.lk"
                    value={adminForm.email}
                    onChange={(e) => setAdminForm({ ...adminForm, email: e.target.value })}
                    required
                  />
                </div>

                <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '8px' }}>
                  <UserPlus size={14} /> Appoint Administrator
                </button>
              </form>
            </div>
          </div>
        </div>
      </>
    )}
    </div>
  );
};
