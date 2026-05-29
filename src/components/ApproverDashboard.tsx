import React, { useState, useEffect } from 'react';
import type { StoreDB } from '../services/dbInterface';
import type {
  StoreRequest,
  StoreRequestItem,
  UserProfile,
  RequestStatus
} from '../types';
import {
  ShieldCheck,
  Eye,
  ThumbsUp,
  ThumbsDown,
  CheckCircle,
  Hourglass,
  Trash2,
  RefreshCw
} from 'lucide-react';

interface ApproverDashboardProps {
  db: StoreDB;
  profile: UserProfile;
}

// Editable item state tracked during HOD review
interface EditableItem extends StoreRequestItem {
  approvedQty: number;
  removed: boolean;
}

export const ApproverDashboard: React.FC<ApproverDashboardProps> = ({ db, profile }) => {
  const [requests, setRequests] = useState<StoreRequest[]>([]);
  const [loading, setLoading] = useState(true);

  // Detail & Approval States
  const [selectedRequest, setSelectedRequest] = useState<StoreRequest | null>(null);
  const [editableItems, setEditableItems] = useState<EditableItem[]>([]);
  const [comments, setComments] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    loadData();
  }, [db, profile.email]);

  const loadData = async () => {
    setLoading(true);
    try {
      const allReqs = await db.getRequests();
      const allDivs = await db.getDivisions();

      if (profile.role === 'HOD') {
        const hodDivisions = allDivs
          .filter(d => d.hodEmail.toLowerCase() === profile.email.toLowerCase())
          .map(d => d.title.toLowerCase());

        const pendingHOD = allReqs.filter(r =>
          r.status === 'Pending_HOD' &&
          hodDivisions.includes(r.division.toLowerCase())
        );
        const historyHOD = allReqs.filter(r =>
          r.status !== 'Pending_HOD' &&
          hodDivisions.includes(r.division.toLowerCase()) &&
          r.auditTrail.some(a => a.user.toLowerCase() === profile.name.toLowerCase() || a.role === 'HOD')
        );

        setRequests([...pendingHOD, ...historyHOD]);
      } else if (profile.role === 'Finance') {
        const pendingFinance = allReqs.filter(r => r.status === 'Pending_Finance');
        const historyFinance = allReqs.filter(r =>
          r.status !== 'Pending_Finance' &&
          r.auditTrail.some(a => a.role === 'Finance')
        );

        setRequests([...pendingFinance, ...historyFinance]);
      }
    } catch (e) {
      console.error('Error loading approver data', e);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDetails = async (req: StoreRequest) => {
    try {
      const items = await db.getRequestItems(req.id);
      // Initialise editable items — approved qty defaults to requested qty
      const editable: EditableItem[] = items.map(item => ({
        ...item,
        approvedQty: item.requestedQuantity,
        removed: false
      }));
      setEditableItems(editable);
      setSelectedRequest(req);
      setComments('');
      setErrorMsg('');
    } catch (e) {
      console.error(e);
    }
  };

  // HOD edits — update qty for a specific item
  const handleQtyChange = (itemId: string, newQty: number) => {
    setEditableItems(prev =>
      prev.map(item =>
        item.id === itemId
          ? { ...item, approvedQty: Math.max(0, newQty) }
          : item
      )
    );
  };

  // HOD toggles remove for a specific item
  const handleToggleRemove = (itemId: string) => {
    setEditableItems(prev =>
      prev.map(item =>
        item.id === itemId ? { ...item, removed: !item.removed } : item
      )
    );
  };

  // Live-calculated approved total (HOD only)
  const approvedTotal = editableItems.reduce((sum, item) => {
    if (item.removed) return sum;
    return sum + item.approvedQty * item.unitPrice;
  }, 0);

  const handleDecision = async (approve: boolean) => {
    if (!selectedRequest) return;
    setActionLoading(true);
    setErrorMsg('');

    try {
      // ─── HOD: save item-level adjustments before updating request status ───
      if (profile.role === 'HOD' && approve) {
        for (const item of editableItems) {
          if (item.removed) {
            // Mark removed items as Declined with qty 0
            await db.updateRequestItem(item.id, {
              requestedQuantity: 0,
              totalPrice: 0,
              itemStatus: 'Declined'
            });
          } else if (item.approvedQty !== item.requestedQuantity) {
            // Update adjusted quantities
            await db.updateRequestItem(item.id, {
              requestedQuantity: item.approvedQty,
              totalPrice: item.approvedQty * item.unitPrice
            });
          }
        }
      }

      let nextStatus: RequestStatus;
      let actionName: string;

      if (profile.role === 'HOD') {
        nextStatus = approve ? 'Pending_Finance' : 'Declined';
        actionName = approve ? 'Approved HOD' : 'Declined HOD';
      } else {
        nextStatus = approve ? 'Pending_Storekeeper' : 'Declined';
        actionName = approve ? 'Approved Finance' : 'Declined Finance';
      }

      // Build full comments string including HOD adjustment summary
      let fullComments = comments;
      if (profile.role === 'HOD' && approve) {
        const removedItems = editableItems.filter(i => i.removed).map(i => i.title);
        const adjustedItems = editableItems.filter(
          i => !i.removed && i.approvedQty !== i.requestedQuantity
        );
        const adjustmentNotes: string[] = [];
        if (removedItems.length)
          adjustmentNotes.push(`Removed items: ${removedItems.join(', ')}.`);
        if (adjustedItems.length)
          adjustmentNotes.push(
            adjustedItems
              .map(i => `${i.title}: ${i.requestedQuantity} → ${i.approvedQty}`)
              .join('; ')
          );
        if (adjustmentNotes.length)
          fullComments = [comments, ...adjustmentNotes].filter(Boolean).join(' | ');
      }

      await db.updateRequestStatus(
        selectedRequest.id,
        nextStatus,
        profile.name,
        profile.role,
        fullComments,
        actionName
      );

      // ─── Workflow Emails ───
      try {
        const divisionsList = await db.getDivisions();
        const divMatrix = divisionsList.find(
          d => d.title.toLowerCase() === selectedRequest.division.toLowerCase()
        );

        if (profile.role === 'HOD') {
          if (approve) {
            const financeEmail = divMatrix ? divMatrix.financeEmail : '';
            if (financeEmail) {
              const financeSubject = `Store Request ${selectedRequest.title}: Pending Finance Approval`;
              const financeBody = `
                <div style="font-family: sans-serif; max-width: 600px; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
                  <h2 style="color: #4f46e5; margin-bottom: 16px;">Store Request Pending Finance Approval</h2>
                  <p>Hi ${divMatrix?.financeName || 'Finance Head'},</p>
                  <p>Store request <strong>${selectedRequest.title}</strong> submitted by <strong>${selectedRequest.requesterName}</strong> has been <strong>approved</strong> by Division Head <strong>${profile.name}</strong> and is now awaiting your finance approval.</p>
                  <p><strong>Division:</strong> ${selectedRequest.division}</p>
                  <p><strong>HOD-Approved Total:</strong> LKR ${approvedTotal.toLocaleString()}</p>
                  <p><strong>HOD Remarks:</strong> "${fullComments || 'No comments'}"</p>
                  <p>Please sign in to the Storekeeper Portal to review and complete your approval decision.</p>
                  <hr style="border: 0; border-top: 1px solid #e2e8f0; margin-top: 24px;" />
                  <p style="font-size: 11px; color: #718096; text-align: center;">Store Request Portal Automated Notification</p>
                </div>
              `;
              db.sendWorkflowEmail(financeEmail, financeSubject, financeBody).catch(
                err => console.error('HOD to Finance email failed', err)
              );
            }
            const reqSubject = `Store Request ${selectedRequest.title}: HOD Approved`;
            const reqBody = `
              <div style="font-family: sans-serif; max-width: 600px; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
                <h2 style="color: #10b981; margin-bottom: 16px;">HOD Approval Granted</h2>
                <p>Hi ${selectedRequest.requesterName},</p>
                <p>Your store request <strong>${selectedRequest.title}</strong> has been <strong>approved</strong> by HOD <strong>${profile.name}</strong>.</p>
                <p><strong>HOD-Approved Total:</strong> LKR ${approvedTotal.toLocaleString()}</p>
                <p><strong>Remarks:</strong> "${fullComments || 'No comments'}"</p>
                <p>The request is now routing to the Finance Head (<strong>${divMatrix?.financeName || 'Finance Head'}</strong>) for budget authorization.</p>
                <hr style="border: 0; border-top: 1px solid #e2e8f0; margin-top: 24px;" />
                <p style="font-size: 11px; color: #718096; text-align: center;">Store Request Portal Automated Notification</p>
              </div>
            `;
            db.sendWorkflowEmail(selectedRequest.requesterEmail, reqSubject, reqBody).catch(
              err => console.error('HOD to Requester email failed', err)
            );
          } else {
            const reqSubject = `Store Request ${selectedRequest.title}: Declined by HOD`;
            const reqBody = `
              <div style="font-family: sans-serif; max-width: 600px; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
                <h2 style="color: #ef4444; margin-bottom: 16px;">Request Declined</h2>
                <p>Hi ${selectedRequest.requesterName},</p>
                <p>We regret to inform you that your store request <strong>${selectedRequest.title}</strong> has been <strong>declined</strong> by Division Head <strong>${profile.name}</strong>.</p>
                <p><strong>Reason / Remarks:</strong> "${fullComments || 'No comments'}"</p>
                <p>If you have any questions, please contact your department HOD directly.</p>
                <hr style="border: 0; border-top: 1px solid #e2e8f0; margin-top: 24px;" />
                <p style="font-size: 11px; color: #718096; text-align: center;">Store Request Portal Automated Notification</p>
              </div>
            `;
            db.sendWorkflowEmail(selectedRequest.requesterEmail, reqSubject, reqBody).catch(
              err => console.error('HOD decline email failed', err)
            );
          }
        } else {
          if (approve) {
            const storekeeperEmail = 'sam.keeper@company.com';
            const storekeeperSubject = `Store Request ${selectedRequest.title}: Ready for Dispatch`;
            const storekeeperBody = `
              <div style="font-family: sans-serif; max-width: 600px; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
                <h2 style="color: #4f46e5; margin-bottom: 16px;">Store Request Ready for Dispatch</h2>
                <p>Hi Storekeeper,</p>
                <p>Store request <strong>${selectedRequest.title}</strong> submitted by <strong>${selectedRequest.requesterName}</strong> has been fully approved by Finance and is now routed to the warehouse for inventory dispatch.</p>
                <p><strong>Division:</strong> ${selectedRequest.division}</p>
                <p><strong>Total Value:</strong> LKR ${selectedRequest.totalAmount.toLocaleString()}</p>
                <p>Please log in to the Storekeeper Inventory Panel to issue these items.</p>
                <hr style="border: 0; border-top: 1px solid #e2e8f0; margin-top: 24px;" />
                <p style="font-size: 11px; color: #718096; text-align: center;">Store Request Portal Automated Notification</p>
              </div>
            `;
            db.sendWorkflowEmail(storekeeperEmail, storekeeperSubject, storekeeperBody).catch(
              err => console.error('Finance to Storekeeper email failed', err)
            );
            const reqSubject = `Store Request ${selectedRequest.title}: Finance Approved (Ready for Issue)`;
            const reqBody = `
              <div style="font-family: sans-serif; max-width: 600px; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
                <h2 style="color: #10b981; margin-bottom: 16px;">Finance Approval Granted</h2>
                <p>Hi ${selectedRequest.requesterName},</p>
                <p>Your store request <strong>${selectedRequest.title}</strong> has been <strong>approved</strong> by Finance Head <strong>${profile.name}</strong>.</p>
                <p><strong>Remarks:</strong> "${comments || 'No comments'}"</p>
                <p>Your request is now at the warehouse and is pending final dispatch by the Storekeeper.</p>
                <hr style="border: 0; border-top: 1px solid #e2e8f0; margin-top: 24px;" />
                <p style="font-size: 11px; color: #718096; text-align: center;">Store Request Portal Automated Notification</p>
              </div>
            `;
            db.sendWorkflowEmail(selectedRequest.requesterEmail, reqSubject, reqBody).catch(
              err => console.error('Finance to Requester email failed', err)
            );
          } else {
            const reqSubject = `Store Request ${selectedRequest.title}: Declined by Finance`;
            const reqBody = `
              <div style="font-family: sans-serif; max-width: 600px; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
                <h2 style="color: #ef4444; margin-bottom: 16px;">Request Declined</h2>
                <p>Hi ${selectedRequest.requesterName},</p>
                <p>We regret to inform you that your store request <strong>${selectedRequest.title}</strong> has been <strong>declined</strong> by Finance Head <strong>${profile.name}</strong>.</p>
                <p><strong>Reason / Remarks:</strong> "${comments || 'No comments'}"</p>
                <hr style="border: 0; border-top: 1px solid #e2e8f0; margin-top: 24px;" />
                <p style="font-size: 11px; color: #718096; text-align: center;">Store Request Portal Automated Notification</p>
              </div>
            `;
            db.sendWorkflowEmail(selectedRequest.requesterEmail, reqSubject, reqBody).catch(
              err => console.error('Finance decline email failed', err)
            );
          }
        }
      } catch (emailErr) {
        console.error('Workflow emails trigger error', emailErr);
      }

      setSelectedRequest(null);
      await loadData();
    } catch (e) {
      console.error(e);
      setErrorMsg('Failed to process approval. Please try again.');
    } finally {
      setActionLoading(false);
    }
  };

  const pendingRequests = requests.filter(r =>
    profile.role === 'HOD' ? r.status === 'Pending_HOD' : r.status === 'Pending_Finance'
  );
  const historyRequests = requests.filter(r =>
    profile.role === 'HOD' ? r.status !== 'Pending_HOD' : r.status !== 'Pending_Finance'
  );

  const isHODPending =
    profile.role === 'HOD' && selectedRequest?.status === 'Pending_HOD';
  const isFinancePending =
    profile.role === 'Finance' && selectedRequest?.status === 'Pending_Finance';
  const canDecide = isHODPending || isFinancePending;

  return (
    <div className="flex-column gap-md">
      {/* Title */}
      <div>
        <h2
          className="gradient-text shadow-text-glow flex align-center gap-sm"
          style={{ fontSize: '26px' }}
        >
          <ShieldCheck size={28} />
          {profile.role === 'HOD' ? 'Division Head Approval Panel' : 'Finance Head Approval Panel'}
        </h2>
        <p className="text-secondary" style={{ fontSize: '14px' }}>
          Review store requests, adjust item quantities, and approve or decline submissions.
        </p>
      </div>

      <div className="dashboard-layout">
        {/* Left: Pending inbox */}
        <div className="glass-panel flex-column gap-sm">
          <h3
            style={{ fontSize: '18px', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}
            className="flex align-center gap-sm"
          >
            <Hourglass size={18} className="pulse" />
            Pending Review ({pendingRequests.length})
          </h3>

          {loading ? (
            <div style={{ padding: '30px', textAlign: 'center' }} className="text-muted">
              Loading pending inbox...
            </div>
          ) : pendingRequests.length === 0 ? (
            <div style={{ padding: '40px', textAlign: 'center' }} className="text-muted">
              Great job! Your approval inbox is completely clear.
            </div>
          ) : (
            <div className="table-container">
              <table className="custom-table" style={{ fontSize: '13px' }}>
                <thead>
                  <tr>
                    <th>Ref</th>
                    <th>Requester</th>
                    <th>Division</th>
                    <th className="text-right">Total Cost</th>
                    <th style={{ width: '80px' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {pendingRequests.map(req => (
                    <tr key={req.id}>
                      <td>
                        <strong style={{ color: 'var(--primary)' }}>{req.title}</strong>
                      </td>
                      <td>
                        <div className="flex-column">
                          <span style={{ fontWeight: 500 }}>{req.requesterName}</span>
                          <span className="text-muted" style={{ fontSize: '11px' }}>
                            {req.requesterEmail}
                          </span>
                        </div>
                      </td>
                      <td>{req.division}</td>
                      <td className="text-right font-semibold">
                        LKR {req.totalAmount.toLocaleString()}
                      </td>
                      <td>
                        <button
                          className="btn btn-secondary"
                          style={{ padding: '4px 8px', fontSize: '12px' }}
                          onClick={() => handleOpenDetails(req)}
                        >
                          Review
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Right: History */}
        <div className="glass-panel flex-column gap-sm">
          <h3
            style={{ fontSize: '18px', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}
            className="flex align-center gap-sm"
          >
            <CheckCircle size={18} />
            My Decisions History
          </h3>

          {loading ? (
            <div style={{ padding: '30px', textAlign: 'center' }} className="text-muted">
              Loading history...
            </div>
          ) : historyRequests.length === 0 ? (
            <div style={{ padding: '40px', textAlign: 'center' }} className="text-muted">
              No historical decisions recorded for this account.
            </div>
          ) : (
            <div className="table-container" style={{ maxHeight: '400px', overflowY: 'auto' }}>
              <table className="custom-table" style={{ fontSize: '13px' }}>
                <thead>
                  <tr>
                    <th>Ref</th>
                    <th>Requester</th>
                    <th>Status</th>
                    <th className="text-right">Total</th>
                    <th>Details</th>
                  </tr>
                </thead>
                <tbody>
                  {historyRequests.map(req => (
                    <tr key={req.id}>
                      <td>
                        <strong>{req.title}</strong>
                      </td>
                      <td>{req.requesterName}</td>
                      <td>
                        <span
                          className={`status-badge status-${req.status}`}
                          style={{ fontSize: '10px' }}
                        >
                          {req.status}
                        </span>
                      </td>
                      <td className="text-right">LKR {req.totalAmount.toLocaleString()}</td>
                      <td>
                        <button
                          className="btn btn-secondary"
                          style={{ padding: '4px 8px', fontSize: '11px' }}
                          onClick={() => handleOpenDetails(req)}
                        >
                          <Eye size={12} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* ── Review / Decision Modal ── */}
      {selectedRequest && (
        <div className="modal-overlay" onClick={() => setSelectedRequest(null)}>
          <div
            className="modal-content"
            style={{ maxWidth: '900px', width: '95vw' }}
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div
              className="flex justify-between align-center"
              style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}
            >
              <div>
                <h3 className="gradient-text">Review Request {selectedRequest.title}</h3>
                <span className="text-muted" style={{ fontSize: '12px' }}>
                  Submitted by {selectedRequest.requesterName} ({selectedRequest.requesterEmail}) | Division:{' '}
                  {selectedRequest.division}
                </span>
              </div>
              <span className={`status-badge status-${selectedRequest.status}`}>
                {selectedRequest.status.replace('_', ' ')}
              </span>
            </div>

            <div className="dashboard-layout" style={{ margin: '12px 0' }}>
              {/* Items panel */}
              <div className="flex-column gap-sm">
                <h4
                  className="text-secondary"
                  style={{
                    fontSize: '14px',
                    borderBottom: '1px solid var(--border-color)',
                    paddingBottom: '6px'
                  }}
                >
                  Request Line Items
                  {isHODPending && (
                    <span
                      style={{
                        marginLeft: '8px',
                        fontSize: '11px',
                        color: 'var(--primary)',
                        fontWeight: 400
                      }}
                    >
                      (HOD: adjust quantities or remove items below)
                    </span>
                  )}
                </h4>

                <div
                  className="flex-column gap-sm"
                  style={{ maxHeight: '280px', overflowY: 'auto', paddingRight: '4px' }}
                >
                  {editableItems.map(item => (
                    <div
                      key={item.id}
                      style={{
                        background: item.removed
                          ? 'rgba(239,68,68,0.08)'
                          : 'var(--bg-secondary)',
                        padding: '10px',
                        borderRadius: '6px',
                        border: `1px solid ${item.removed ? '#ef4444' : 'var(--border-color)'}`,
                        opacity: item.removed ? 0.6 : 1,
                        transition: 'all 0.2s'
                      }}
                    >
                      <div className="flex justify-between align-center" style={{ gap: '8px' }}>
                        {/* Item name + unit price */}
                        <div style={{ flex: 1 }}>
                          <strong style={{ fontSize: '13px' }}>{item.title}</strong>
                          <span
                            className="text-muted"
                            style={{ fontSize: '11px', display: 'block' }}
                          >
                            Unit Price: LKR {item.unitPrice.toLocaleString()}
                          </span>
                          {item.removed && (
                            <span style={{ fontSize: '10px', color: '#ef4444', fontWeight: 600 }}>
                              ✕ REMOVED BY HOD
                            </span>
                          )}
                        </div>

                        {/* Qty controls — editable for HOD when pending */}
                        <div className="flex align-center gap-sm" style={{ flexShrink: 0 }}>
                          {isHODPending && !item.removed ? (
                            <>
                              <div className="flex-column" style={{ alignItems: 'flex-end' }}>
                                <label
                                  style={{ fontSize: '10px', color: 'var(--text-secondary)' }}
                                >
                                  Approved Qty
                                </label>
                                <input
                                  type="number"
                                  min={0}
                                  max={item.requestedQuantity}
                                  value={item.approvedQty}
                                  onChange={e =>
                                    handleQtyChange(item.id, Number(e.target.value))
                                  }
                                  style={{
                                    width: '70px',
                                    padding: '4px 6px',
                                    borderRadius: '4px',
                                    border: '1px solid var(--border-color)',
                                    background: 'var(--bg-primary)',
                                    color: 'var(--text-primary)',
                                    fontSize: '13px',
                                    textAlign: 'right'
                                  }}
                                />
                                <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                                  of {item.requestedQuantity} requested
                                </span>
                              </div>
                              <div className="flex-column" style={{ alignItems: 'flex-end' }}>
                                <label
                                  style={{ fontSize: '10px', color: 'var(--text-secondary)' }}
                                >
                                  Subtotal
                                </label>
                                <span style={{ fontWeight: 600, color: 'var(--primary)', fontSize: '14px' }}>
                                  LKR {(item.approvedQty * item.unitPrice).toLocaleString()}
                                </span>
                              </div>
                              <button
                                className="btn btn-danger"
                                title="Remove this item from approval"
                                onClick={() => handleToggleRemove(item.id)}
                                style={{ padding: '6px 8px', fontSize: '11px', alignSelf: 'flex-end' }}
                              >
                                <Trash2 size={13} />
                              </button>
                            </>
                          ) : isHODPending && item.removed ? (
                            <>
                              <span
                                style={{ fontSize: '12px', color: '#ef4444', fontWeight: 600 }}
                              >
                                Removed
                              </span>
                              <button
                                className="btn btn-secondary"
                                title="Restore this item"
                                onClick={() => handleToggleRemove(item.id)}
                                style={{ padding: '6px 8px', fontSize: '11px' }}
                              >
                                <RefreshCw size={13} /> Restore
                              </button>
                            </>
                          ) : (
                            // Read-only view for Finance / history
                            <div className="text-right">
                              <span style={{ fontSize: '13px', fontWeight: 600 }}>
                                Qty: {item.requestedQuantity}
                              </span>
                              <span
                                style={{
                                  fontSize: '14px',
                                  fontWeight: 600,
                                  display: 'block',
                                  color: 'var(--primary)'
                                }}
                              >
                                LKR {item.totalPrice.toLocaleString()}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Total row */}
                <div
                  className="flex justify-between align-center"
                  style={{
                    padding: '10px 12px',
                    background: 'var(--bg-secondary)',
                    borderRadius: '6px',
                    marginTop: '4px'
                  }}
                >
                  <span style={{ fontWeight: 600 }}>
                    {isHODPending ? 'HOD-Approved Total:' : 'Total Request Value:'}
                  </span>
                  <span className="gradient-text" style={{ fontWeight: 700, fontSize: '18px' }}>
                    LKR {isHODPending ? approvedTotal.toLocaleString() : selectedRequest.totalAmount.toLocaleString()}
                  </span>
                </div>
              </div>

              {/* History trail + decision form */}
              <div className="flex-column gap-md">
                <div>
                  <h4
                    className="text-secondary"
                    style={{ fontSize: '14px', borderBottom: '1px solid var(--border-color)', paddingBottom: '6px' }}
                  >
                    History Trail
                  </h4>
                  <div style={{ maxHeight: '140px', overflowY: 'auto' }}>
                    <div className="timeline" style={{ fontSize: '12px' }}>
                      {selectedRequest.auditTrail.map((audit, index) => (
                        <div className="timeline-item" key={index}>
                          <div className="timeline-marker" />
                          <div className="timeline-content">
                            <span style={{ fontWeight: 600 }}>{audit.action}</span> – {audit.user} ({audit.role})
                            {audit.comments && (
                              <p className="timeline-comment" style={{ fontSize: '11px' }}>
                                "{audit.comments}"
                              </p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Decision form */}
                {canDecide ? (
                  <div
                    className="flex-column gap-sm"
                    style={{
                      background: 'rgba(0,0,0,0.15)',
                      padding: '12px',
                      borderRadius: '8px',
                      border: '1px dashed var(--border-color)'
                    }}
                  >
                    <h4 className="text-secondary" style={{ fontSize: '13px' }}>
                      Submit Decision
                    </h4>

                    {isHODPending && (
                      <div
                        style={{
                          fontSize: '11px',
                          color: 'var(--text-muted)',
                          background: 'rgba(79,70,229,0.08)',
                          padding: '6px 10px',
                          borderRadius: '4px',
                          border: '1px solid rgba(79,70,229,0.2)'
                        }}
                      >
                        💡 <strong>HOD Note:</strong> You can adjust quantities or remove items above before approving.
                        Removed items and quantity changes will be recorded in the audit trail.
                      </div>
                    )}

                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label style={{ fontSize: '11px' }}>Approval Comments</label>
                      <textarea
                        className="form-control"
                        placeholder="Add rationales, constraints, or approval notes here..."
                        rows={3}
                        value={comments}
                        onChange={e => setComments(e.target.value)}
                      />
                    </div>

                    {errorMsg && (
                      <div
                        className="alert-box alert-warning"
                        style={{ padding: '6px 10px', fontSize: '12px', margin: 0 }}
                      >
                        {errorMsg}
                      </div>
                    )}

                    <div className="flex gap-sm justify-end">
                      <button
                        className="btn btn-danger"
                        onClick={() => handleDecision(false)}
                        disabled={actionLoading}
                        style={{ padding: '8px 12px', fontSize: '12px' }}
                      >
                        <ThumbsDown size={14} /> Decline
                      </button>
                      <button
                        className="btn btn-primary"
                        onClick={() => handleDecision(true)}
                        disabled={actionLoading}
                        style={{ padding: '8px 16px', fontSize: '12px' }}
                      >
                        <ThumbsUp size={14} />{' '}
                        {actionLoading ? 'Processing…' : 'Approve'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="alert-box alert-info" style={{ padding: '8px 12px', margin: 0 }}>
                    This request is in the <strong>{selectedRequest.status}</strong> state.
                    You have already processed it or it is routed elsewhere.
                  </div>
                )}
              </div>
            </div>

            <div
              className="flex justify-end"
              style={{ borderTop: '1px solid var(--border-color)', paddingTop: '12px' }}
            >
              <button className="btn btn-secondary" onClick={() => setSelectedRequest(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
