import React, { useState, useEffect } from 'react';
import { PublicClientApplication } from '@azure/msal-browser';
import type { AccountInfo } from '@azure/msal-browser';
import { MsalProvider, useMsal } from '@azure/msal-react';
import { loginRequest } from './authConfig';
import { 
  getDB, 
  isM365Mode, 
  getM365Config, 
  registerTokenProvider, 
  initializeDB 
} from './services/storeService';
import type { UserProfile, StoreRequest, ItemMaster } from './types';
import { RoleSwitcher } from './components/RoleSwitcher';
import { RequesterDashboard } from './components/RequesterDashboard';
import { ApproverDashboard } from './components/ApproverDashboard';
import { StorekeeperDashboard } from './components/StorekeeperDashboard';
import { AdminDashboard } from './components/AdminDashboard';
import { 
  ShoppingBag, 
  Sun, 
  Moon, 
  TrendingUp, 
  AlertCircle, 
  CheckCircle2, 
  Clock,
  Grid
} from 'lucide-react';

// MSAL Instance is passed as a prop from main.tsx

// Inner App with MSAL Context
const StoreAppContent: React.FC = () => {
  const [activeProfile, setActiveProfile] = useState<UserProfile>({ name: '', email: '', role: 'Requester' });
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [db, setDb] = useState<any>(null); // DB will be set after M365 auth
  const [m365User, setM365User] = useState<string | null>(null);
  const [m365UserRoles, setM365UserRoles] = useState<string[]>(['Requester']);

  // Statistics
  const [stats, setStats] = useState({
    pendingCount: 0,
    lowStockCount: 0,
    completedCount: 0,
    totalValue: 0
  });

  const { instance, accounts } = useMsal();
  const isM365 = isM365Mode();

  useEffect(() => {
    document.body.setAttribute('data-theme', theme);
  }, [theme]);

  useEffect(() => {
    // Register the MSAL token acquisition if M365 is enabled
    if (isM365 && accounts.length > 0) {
      const activeAccount = accounts[0];
      setM365User(activeAccount.username);
      
      const tokenAcquisition = async () => {
        try {
          const response = await instance.acquireTokenSilent({
            ...loginRequest,
            account: activeAccount
          });
          return response.accessToken || "";
        } catch (e) {
          // If silent fails, fall back to redirect
          await instance.acquireTokenRedirect(loginRequest);
          return "";
        }
      };

      registerTokenProvider(tokenAcquisition);
      setDb(getDB());
      
      // Load user profile and resolve role dynamically
      resolveM365UserRole(activeAccount);
    }
  }, [isM365, accounts, instance]);

  useEffect(() => {
    if (db) loadStats();
  }, [db, activeProfile]);

  const loadStats = async () => {
    try {
      const allReqs: StoreRequest[] = await db.getRequests();
      const allItems: ItemMaster[] = await db.getItems();
      
      // Calculate statistics
      const pending = allReqs.filter((r: StoreRequest) => r.status.startsWith('Pending_')).length;
      const lowStock = allItems.filter((i: ItemMaster) => i.stockOnHand <= i.reorderLevel).length;
      const completed = allReqs.filter((r: StoreRequest) => r.status === 'Completed').length;
      
      // Get total amount issued/processed for requester or global based on admin
      let totalAmount = 0;
      if (activeProfile.role === 'Admin' || activeProfile.role === 'Storekeeper' || activeProfile.role === 'Finance') {
        totalAmount = allReqs
          .filter((r: StoreRequest) => r.status === 'Completed')
          .reduce((sum: number, r: StoreRequest) => sum + (r.totalAmount || 0), 0);
      } else {
        totalAmount = allReqs
          .filter((r: StoreRequest) => r.requesterEmail.toLowerCase() === activeProfile.email.toLowerCase() && r.status === 'Completed')
          .reduce((sum: number, r: StoreRequest) => sum + (r.totalAmount || 0), 0);
      }

      setStats({
        pendingCount: pending,
        lowStockCount: lowStock,
        completedCount: completed,
        totalValue: totalAmount
      });
    } catch (e) {
      console.error("Error loading statistics", e);
    }
  };

  const resolveM365UserRole = async (account: AccountInfo) => {
    const activeDb = getDB();
    const email = account.username.toLowerCase();
    const roles: ('Requester' | 'HOD' | 'Finance' | 'Storekeeper' | 'Admin')[] = ['Requester'];

    let divisions: any[] = [];
    try {
      divisions = await activeDb.getDivisions();
    } catch (e) {
      console.warn("Failed to fetch divisions for role resolution, lists may not be provisioned yet.", e);
    }

    // 1. Check if HOD
    const isHOD = divisions.some(d => d.hodEmail?.toLowerCase() === email);
    if (isHOD) roles.push('HOD');

    // 2. Check if Finance Head
    const isFinance = divisions.some(d => d.financeEmail?.toLowerCase() === email);
    if (isFinance) roles.push('Finance');

    // 3. Check if Storekeeper
    if (email.includes('storekeeper') || email.includes('keeper') || email === 'sam.keeper@company.com') {
      roles.push('Storekeeper');
    }

    // 4. Check if Admin
    let adminsList: any[] = [];
    try {
      adminsList = await activeDb.getAdmins();
    } catch (e) {
      console.warn("Failed to fetch admins for role resolution, lists may not be provisioned yet.", e);
    }

    const isAdmin = adminsList.some(a => a.email?.toLowerCase() === email);
    if (isAdmin || email.includes('admin') || email === 'admin@company.com' || email === 'darshana@aatsl.lk') {
      roles.push('Admin');
    }

    setM365UserRoles(roles);

    // Determine active starting role (highest priority) or preserve currently selected role if valid
    let activeRole = activeProfile.role;
    if (!roles.includes(activeRole as any) || activeProfile.email.toLowerCase() !== email) {
      activeRole = 'Requester';
      if (roles.includes('Admin')) activeRole = 'Admin';
      else if (roles.includes('Storekeeper')) activeRole = 'Storekeeper';
      else if (roles.includes('Finance')) activeRole = 'Finance';
      else if (roles.includes('HOD')) activeRole = 'HOD';
    }

    setActiveProfile({
      name: account.name || account.username,
      email: account.username,
      role: activeRole as any
    });
  };

  const handleProfileChange = (profile: UserProfile) => {
    setActiveProfile(profile);
    setActiveTabOverride('auto'); // Reset tab override to match active role view
  };

  const handleM365Login = async () => {
    const config = getM365Config();
    if (!config.isEnabled || !config.clientId || config.clientId === '00000000-0000-0000-0000-000000000000' || config.clientId === 'placeholder') {
      alert("Microsoft 365 integration is not configured. Please go to the 'Admin' -> 'M365 Setup' tab, check 'Enable M365 SharePoint Graph Backend Connection', enter your Client ID, Tenant ID, and Site URL, then save the configuration.");
      return;
    }
    try {
      await instance.loginRedirect(loginRequest);
    } catch (e) {
      console.error("Login redirect failed", e);
    }
  };

  const handleM365Logout = async () => {
    try {
      await instance.logoutRedirect();
      setM365User(null);
      // Reset local profile
      setActiveProfile({ name: '', email: '', role: 'Requester' });
    } catch (e) {
      console.error("Logout redirect failed", e);
    }
  };

  const handleConfigChange = () => {
    // Config was updated, refresh database client selection
    initializeDB();
    setDb(getDB());
    // reload the page to apply MSAL configurations correctly
    window.location.reload();
  };

  const toggleTheme = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  };

  // Determine active view component to render
  const renderDashboard = () => {
    switch (activeProfile.role) {
      case 'Requester':
        return <RequesterDashboard db={db} profile={activeProfile} />;
      case 'HOD':
      case 'Finance':
        return <ApproverDashboard db={db} profile={activeProfile} />;
      case 'Storekeeper':
        return <StorekeeperDashboard db={db} profile={activeProfile} />;
      case 'Admin':
        return <AdminDashboard db={db} onConfigChange={handleConfigChange} />;
      default:
        return <RequesterDashboard db={db} profile={activeProfile} />;
    }
  };

  // Quick navigation tab controls when acting as admin or multiple roles
  const hasApproverPrivilege = activeProfile.role === 'HOD' || activeProfile.role === 'Finance' || activeProfile.role === 'Admin';
  const hasStorekeeperPrivilege = activeProfile.role === 'Storekeeper' || activeProfile.role === 'Admin';
  const hasAdminPrivilege = activeProfile.role === 'Admin';

  const [activeTabOverride, setActiveTabOverride] = useState<string>('auto');

  const getEffectiveView = () => {
    if (activeTabOverride === 'auto') {
      return renderDashboard();
    }
    switch (activeTabOverride) {
      case 'requester': return <RequesterDashboard db={db} profile={activeProfile} />;
      case 'approver': return <ApproverDashboard db={db} profile={activeProfile} />;
      case 'storekeeper': return <StorekeeperDashboard db={db} profile={activeProfile} />;
      case 'admin': return <AdminDashboard db={db} onConfigChange={handleConfigChange} />;
      default: return renderDashboard();
    }
  };

  return (
    <div className="app-container">
      {/* Dynamic top role-switcher for offline review */}
      <RoleSwitcher 
        currentProfile={activeProfile} 
        onProfileChange={handleProfileChange}
        isM365={isM365}
        onLoginClick={handleM365Login}
        onLogoutClick={handleM365Logout}
        m365User={m365User}
        m365UserRoles={m365UserRoles}
      />

      {/* Main Header */}
      <header className="app-header">
        <div className="logo-section">
          <ShoppingBag size={28} />
          <div>
            <h1 className="logo-text gradient-text">Storekeeper</h1>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 500, display: 'block', marginTop: '-3px' }}>
              M365 Store Request Portal
            </span>
          </div>
        </div>

        <div className="header-actions">
          {/* Dashboard tabs switcher if the role has permission */}
          {(hasApproverPrivilege || hasStorekeeperPrivilege) && (
            <div className="tabs-navigation" style={{ background: 'rgba(0,0,0,0.1)' }}>
              <button 
                className={`tab-btn ${activeTabOverride === 'auto' ? 'active' : ''}`}
                onClick={() => setActiveTabOverride('auto')}
                style={{ fontSize: '12px', padding: '6px 12px' }}
              >
                Auto ({activeProfile.role})
              </button>
              <button 
                className={`tab-btn ${activeTabOverride === 'requester' ? 'active' : ''}`}
                onClick={() => setActiveTabOverride('requester')}
                style={{ fontSize: '12px', padding: '6px 12px' }}
              >
                Request
              </button>
              {hasApproverPrivilege && (
                <button 
                  className={`tab-btn ${activeTabOverride === 'approver' ? 'active' : ''}`}
                  onClick={() => setActiveTabOverride('approver')}
                  style={{ fontSize: '12px', padding: '6px 12px' }}
                >
                  Approve
                </button>
              )}
              {hasStorekeeperPrivilege && (
                <button 
                  className={`tab-btn ${activeTabOverride === 'storekeeper' ? 'active' : ''}`}
                  onClick={() => setActiveTabOverride('storekeeper')}
                  style={{ fontSize: '12px', padding: '6px 12px' }}
                >
                  Storekeeper
                </button>
              )}
              {hasAdminPrivilege && (
                <button 
                  className={`tab-btn ${activeTabOverride === 'admin' ? 'active' : ''}`}
                  onClick={() => setActiveTabOverride('admin')}
                  style={{ fontSize: '12px', padding: '6px 12px' }}
                >
                  Admin
                </button>
              )}
            </div>
          )}

          {/* Theme Toggle */}
          <button className="btn btn-secondary" style={{ padding: '8px' }} onClick={toggleTheme} title="Toggle Theme">
            {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="main-content">
        
        {/* Connection Notice for M365 */}
        {isM365 && accounts.length === 0 && (
          <div className="glass-panel text-center" style={{ padding: '60px 40px', maxWidth: '600px', margin: '40px auto' }}>
            <Grid size={48} className="text-secondary pulse" style={{ margin: '0 auto 20px' }} />
            <h2 className="margin-bottom-md gradient-text">Microsoft M365 Authorization Required</h2>
            <p className="text-secondary margin-bottom-md" style={{ lineHeight: 1.6 }}>
              The application is configured to connect to your corporate SharePoint Lists. Please sign in with your Microsoft 365 Work or School account to authorize operations.
            </p>
            <div className="flex gap-sm justify-center margin-top-md" style={{ flexWrap: 'wrap' }}>
              <button className="btn btn-primary btn-accent" onClick={handleM365Login} style={{ padding: '10px 24px' }}>
                Sign In with Microsoft 365
              </button>
            </div>
          </div>
        )}

        {(!isM365 || accounts.length > 0) && (
          <>
            {/* Quick Metrics Grid */}
            <div className="stats-grid">
              <div className="glass-panel stat-card">
                <div className="stat-header">
                  <span>Pending Tasks</span>
                  <Clock size={16} className="text-secondary" />
                </div>
                <div className="stat-value">{stats.pendingCount}</div>
                <div className="stat-desc">Requests awaiting decision</div>
              </div>

              <div className="glass-panel stat-card">
                <div className="stat-header">
                  <span>Low Stock Items</span>
                  <AlertCircle size={16} className="text-declined" style={{ color: 'var(--color-declined)' }} />
                </div>
                <div className="stat-value" style={{ color: stats.lowStockCount > 0 ? 'var(--color-declined)' : 'inherit' }}>
                  {stats.lowStockCount}
                </div>
                <div className="stat-desc">Catalog items near threshold</div>
              </div>

              <div className="glass-panel stat-card">
                <div className="stat-header">
                  <span>Completed Requests</span>
                  <CheckCircle2 size={16} className="text-completed" style={{ color: 'var(--color-completed)' }} />
                </div>
                <div className="stat-value">{stats.completedCount}</div>
                <div className="stat-desc">Fulfilled requests history</div>
              </div>

              <div className="glass-panel stat-card">
                <div className="stat-header">
                  <span>{hasAdminPrivilege ? 'Total Dispatched Value' : 'My Issued Value'}</span>
                  <TrendingUp size={16} className="text-completed" />
                </div>
                <div className="stat-value gradient-text">LKR {stats.totalValue.toLocaleString()}</div>
                <div className="stat-desc">Aggregate value of completed issues</div>
              </div>
            </div>

            {/* Active view component */}
            <div className="main-dashboard-view">
              {getEffectiveView()}
            </div>
          </>
        )}
      </main>
    </div>
  );
};

interface AppProps {
  msalInstance: PublicClientApplication;
}

// Top Root App with MSAL Provider Wrapper
export const App: React.FC<AppProps> = ({ msalInstance }) => {
  return (
    <MsalProvider instance={msalInstance}>
      <StoreAppContent />
    </MsalProvider>
  );
};

export default App;
