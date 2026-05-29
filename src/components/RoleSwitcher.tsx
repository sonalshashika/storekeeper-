import type { UserProfile } from '../types';
import { Sparkles, User, LogOut } from 'lucide-react';

interface RoleSwitcherProps {
  currentProfile: UserProfile;
  onProfileChange: (profile: UserProfile) => void;
  isM365: boolean;
  onLoginClick: () => void;
  onLogoutClick: () => void;
  m365User: string | null;
  m365UserRoles?: string[];
}

export const MOCK_PROFILES: UserProfile[] = [
  { name: 'Alex Smith (Engineer)', email: 'alex.req@company.com', role: 'Requester' },
  { name: 'Emily Davis (Marketer)', email: 'emily.req@company.com', role: 'Requester' },
  { name: 'Dave Head (HOD Eng)', email: 'dave.head@company.com', role: 'HOD' },
  { name: 'Harry Head (HOD HR)', email: 'harry.head@company.com', role: 'HOD' },
  { name: 'Fiona Fin (Finance Head)', email: 'fiona.fin@company.com', role: 'Finance' },
  { name: 'Sam Keeper (Storekeeper)', email: 'sam.keeper@company.com', role: 'Storekeeper' },
  { name: 'System Admin', email: 'admin@company.com', role: 'Admin' }
];

export const RoleSwitcher: React.FC<RoleSwitcherProps> = ({
  currentProfile,
  onProfileChange,
  isM365,
  onLoginClick,
  onLogoutClick,
  m365User,
  m365UserRoles
}) => {
  // Construct dynamic profiles list
  const profilesList = [...MOCK_PROFILES];
  if (isM365 && m365User) {
    const alreadyExists = MOCK_PROFILES.some(p => p.email.toLowerCase() === m365User.toLowerCase());
    if (!alreadyExists) {
      // Add the real user profile at the top
      profilesList.unshift({
        name: `My M365 Account (${m365User.split('@')[0]})`,
        email: m365User,
        role: currentProfile.role
      });
    }
  }

  const handleSelectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const idx = Number(e.target.value);
    onProfileChange(profilesList[idx]);
  };

  const activeMockIdx = profilesList.findIndex(
    p => p.email.toLowerCase() === currentProfile.email.toLowerCase()
  );

  return (
    <div className="role-switcher-banner">
      <div className="flex align-center gap-sm">
        <Sparkles size={16} className="pulse" />
        {isM365 ? (
          <span>
            Connected to <strong>Microsoft 365 (Entra ID)</strong> (Live SharePoint backend)
          </span>
        ) : (
          <span>
            Running in <strong>Offline Demo Mode</strong>. Switch roles to test the multi-stage approval flow.
          </span>
        )}
      </div>

      <div className="role-switcher-actions">
        {isM365 ? (
          m365User ? (
            <div className="flex align-center gap-md">
              <span className="flex align-center gap-sm">
                <User size={14} />
                Signed in: <strong>{m365User}</strong>
              </span>

              {m365UserRoles && m365UserRoles.length > 1 ? (
                <div className="flex align-center gap-sm">
                  <span style={{ opacity: 0.85, fontWeight: 500 }}>Active Role:</span>
                  <select 
                    className="role-selector" 
                    value={currentProfile.role} 
                    onChange={(e) => {
                      onProfileChange({
                        name: currentProfile.name,
                        email: currentProfile.email,
                        role: e.target.value as any
                      });
                    }}
                  >
                    {m365UserRoles.map(role => (
                      <option key={role} value={role}>{role}</option>
                    ))}
                  </select>
                </div>
              ) : (
                <span className="flex align-center gap-sm">
                  <span style={{ opacity: 0.85, fontWeight: 500 }}>Role:</span>
                  <span style={{ 
                    background: 'rgba(255,255,255,0.15)', 
                    padding: '2px 8px', 
                    borderRadius: '4px', 
                    fontSize: '11px', 
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em'
                  }}>
                    {currentProfile.role}
                  </span>
                </span>
              )}

              <button className="btn btn-secondary" style={{ padding: '4px 10px', fontSize: '12px', background: 'rgba(255,255,255,0.1)', color: '#fff', border: 'none' }} onClick={onLogoutClick}>
                <LogOut size={12} /> Sign Out
              </button>
            </div>
          ) : (
            <div className="flex align-center gap-sm">
              <button 
                className="btn btn-primary" 
                style={{ padding: '4px 10px', fontSize: '12px', background: 'var(--secondary)', border: 'none', color: '#000', fontWeight: 600 }}
                onClick={onLoginClick}
              >
                Connect M365
              </button>
            </div>
          )
        ) : (
          <div className="flex align-center gap-sm">
            <span style={{ opacity: 0.85, fontWeight: 500 }}>Act as Profile:</span>
            <select 
              className="role-selector" 
              value={activeMockIdx !== -1 ? activeMockIdx : 0} 
              onChange={handleSelectChange}
            >
              {profilesList.map((profile, index) => (
                <option key={profile.email} value={index}>
                  [{profile.role.toUpperCase()}] {profile.name}
                </option>
              ))}
            </select>

            <button 
              className="btn btn-primary" 
              style={{ padding: '4px 10px', fontSize: '12px', background: 'var(--secondary)', border: 'none', color: '#000', fontWeight: 600 }}
              onClick={onLoginClick}
            >
              Connect M365
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
