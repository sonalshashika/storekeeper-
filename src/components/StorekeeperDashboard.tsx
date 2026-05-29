import React, { useState, useEffect } from 'react';
import type { StoreDB } from '../services/dbInterface';
import type { 
  StoreRequest, 
  StoreRequestItem, 
  UserProfile, 
  ItemMaster,
  ItemStatus
} from '../types';
import { 
  Package, 
  Eye, 
  Truck, 
  Check, 
  X, 
  AlertTriangle, 
  Clipboard, 
  Info,
  Calendar
} from 'lucide-react';

interface StorekeeperDashboardProps {
  db: StoreDB;
  profile: UserProfile;
}

interface FulfillmentLine {
  item: StoreRequestItem;
  catalogItem: ItemMaster | null;
  tempIssuedQty: number;
  tempStatus: ItemStatus;
}

export const StorekeeperDashboard: React.FC<StorekeeperDashboardProps> = ({ db, profile }) => {
  const [requests, setRequests] = useState<StoreRequest[]>([]);
  const [loading, setLoading] = useState(true);

  // Review & Fulfill states
  const [selectedRequest, setSelectedRequest] = useState<StoreRequest | null>(null);
  const [fulfillmentLines, setFulfillmentLines] = useState<FulfillmentLine[]>([]);
  const [comments, setComments] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [validationError, setValidationError] = useState('');

  useEffect(() => {
    loadData();
  }, [db, profile.email]);

  const loadData = async () => {
    setLoading(true);
    try {
      const allReqs = await db.getRequests();
      // Filter requests pending Storekeeper, plus recent completed ones
      const pendingSK = allReqs.filter(r => r.status === 'Pending_Storekeeper');
      const completedSK = allReqs.filter(r => 
        r.status === 'Completed' && 
        r.auditTrail.some(a => a.role === 'Storekeeper')
      );
      setRequests([...pendingSK, ...completedSK]);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenFulfillment = async (req: StoreRequest) => {
    setLoading(true);
    setValidationError('');
    setComments('');
    try {
      const reqItems = await db.getRequestItems(req.id);
      const itemsCatalog = await db.getItems(); // Refresh latest stock levels

      const lines: FulfillmentLine[] = reqItems.map(item => {
        const catItem = itemsCatalog.find(c => c.id === item.itemId) || null;
        return {
          item,
          catalogItem: catItem,
          // Set initial issued quantity to requested quantity, clamped to available stock
          tempIssuedQty: req.status === 'Completed' ? item.issuedQuantity : Math.min(item.requestedQuantity, catItem?.stockOnHand || 0),
          tempStatus: req.status === 'Completed' ? item.itemStatus : 'Approved'
        };
      });

      setFulfillmentLines(lines);
      setSelectedRequest(req);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleQtyChange = (idx: number, qty: number) => {
    const newLines = [...fulfillmentLines];
    const line = newLines[idx];
    
    // Clamp quantity
    const maxQty = line.item.requestedQuantity;
    const stock = line.catalogItem?.stockOnHand || 0;
    
    let targetQty = Math.max(0, qty);
    if (targetQty > maxQty) targetQty = maxQty;
    if (targetQty > stock) targetQty = stock;

    line.tempIssuedQty = targetQty;
    if (targetQty === 0) {
      line.tempStatus = 'Declined';
    } else {
      line.tempStatus = 'Approved';
    }

    setFulfillmentLines(newLines);
  };

  const handleStatusToggle = (idx: number, approve: boolean) => {
    const newLines = [...fulfillmentLines];
    const line = newLines[idx];

    if (!approve) {
      line.tempStatus = 'Declined';
      line.tempIssuedQty = 0;
    } else {
      line.tempStatus = 'Approved';
      // Default back to requested quantity or stock limit
      const stock = line.catalogItem?.stockOnHand || 0;
      line.tempIssuedQty = Math.min(line.item.requestedQuantity, stock);
    }

    setFulfillmentLines(newLines);
  };

  const handleFulfillRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRequest) return;

    // Validation
    setValidationError('');
    for (const line of fulfillmentLines) {
      const stock = line.catalogItem?.stockOnHand || 0;
      if (line.tempIssuedQty > line.item.requestedQuantity) {
        setValidationError(`Issued quantity for ${line.item.title} cannot exceed requested quantity.`);
        return;
      }
      if (line.tempStatus === 'Approved' && line.tempIssuedQty > stock) {
        setValidationError(`Insufficient stock for ${line.item.title}. Maximum available is ${stock}.`);
        return;
      }
      if (line.tempIssuedQty < 0) {
        setValidationError(`Quantity cannot be negative.`);
        return;
      }
    }

    setSubmitting(true);
    try {
      // 1. Process each line item
      for (const line of fulfillmentLines) {
        // Update request line item
        await db.updateRequestItemFulfillment(line.item.id, line.tempIssuedQty, line.tempStatus);

        // If items are actually issued (issued qty > 0)
        if (line.tempStatus === 'Approved' && line.tempIssuedQty > 0 && line.catalogItem) {
          // Adjust physical stock
          const newStock = line.catalogItem.stockOnHand - line.tempIssuedQty;
          await db.updateItemStock(line.catalogItem.id, newStock);

          // Create stock transaction record
          await db.createTransaction({
            itemId: line.catalogItem.id,
            itemTitle: line.catalogItem.title,
            transactionType: 'Issue',
            quantity: -line.tempIssuedQty,
            reference: selectedRequest.title,
            performedBy: profile.name
          });
        }
      }

      // 2. Transition request status to Completed
      await db.updateRequestStatus(
        selectedRequest.id,
        'Completed',
        profile.name,
        profile.role,
        comments,
        'Fulfilled Request'
      );

      // Send email to Requester
      try {
        const reqSubject = `Store Request ${selectedRequest.title}: Dispatched and Completed`;
        const reqBody = `
          <div style="font-family: sans-serif; max-width: 600px; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
            <h2 style="color: #10b981; margin-bottom: 16px;">Store Request Dispatched</h2>
            <p>Hi ${selectedRequest.requesterName},</p>
            <p>We are pleased to inform you that your store request <strong>${selectedRequest.title}</strong> has been processed, issued, and is now **completed**!</p>
            
            <table style="width: 100%; border-collapse: collapse; margin: 16px 0; font-size: 14px;">
              <thead>
                <tr style="border-bottom: 2px solid #e2e8f0; text-align: left;">
                  <th style="padding: 8px 0;">Item Name</th>
                  <th style="padding: 8px 0; text-align: right;">Requested Qty</th>
                  <th style="padding: 8px 0; text-align: right;">Issued Qty</th>
                  <th style="padding: 8px 0; text-align: right;">Status</th>
                </tr>
              </thead>
              <tbody>
                ${fulfillmentLines.map(line => `
                  <tr style="border-bottom: 1px solid #edf2f7;">
                    <td style="padding: 8px 0;">${line.item.title}</td>
                    <td style="padding: 8px 0; text-align: right;">${line.item.requestedQuantity}</td>
                    <td style="padding: 8px 0; text-align: right; font-weight: bold; color: ${line.tempIssuedQty > 0 ? '#10b981' : '#ef4444'};">${line.tempIssuedQty}</td>
                    <td style="padding: 8px 0; text-align: right;">${line.tempStatus}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>

            <p><strong>Storekeeper Dispatch Notes:</strong> "${comments || 'No comments'}"</p>
            <p>Please collect your items from the store desk at your earliest convenience.</p>
            <hr style="border: 0; border-top: 1px solid #e2e8f0; margin-top: 24px;" />
            <p style="font-size: 11px; color: #718096; text-align: center;">Store Request Portal Automated Notification</p>
          </div>
        `;
        db.sendWorkflowEmail(selectedRequest.requesterEmail, reqSubject, reqBody).catch(err => console.error("Storekeeper dispatch email failed", err));
      } catch (emailErr) {
        console.error("Storekeeper emails trigger error", emailErr);
      }

      // Close modal and reload
      setSelectedRequest(null);
      await loadData();
    } catch (err) {
      console.error(err);
      setValidationError('Failed to complete fulfillment process.');
    } finally {
      setSubmitting(false);
    }
  };

  const pendingFulfill = requests.filter(r => r.status === 'Pending_Storekeeper');
  const completedFulfill = requests.filter(r => r.status === 'Completed');

  return (
    <div className="flex-column gap-md">
      {/* Upper Panel */}
      <div>
        <h2 className="gradient-text shadow-text-glow flex align-center gap-sm" style={{ fontSize: '26px' }}>
          <Package size={28} />
          Storekeeper Inventory Panel
        </h2>
        <p className="text-secondary" style={{ fontSize: '14px' }}>
          Dispatch approved requests, perform inventory checks, and update stock counts.
        </p>
      </div>

      <div className="dashboard-layout">
        {/* Left Side: Requests to dispatch */}
        <div className="glass-panel flex-column gap-sm">
          <h3 style={{ fontSize: '18px', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }} className="flex align-center gap-sm">
            <Truck size={18} className="pulse text-secondary" />
            Approved Requests to Issue ({pendingFulfill.length})
          </h3>

          {loading && !selectedRequest ? (
            <div style={{ padding: '30px', textAlign: 'center' }} className="text-muted">Loading dispatch list...</div>
          ) : pendingFulfill.length === 0 ? (
            <div style={{ padding: '40px', textAlign: 'center' }} className="text-muted">
              All store requests have been dispatched! No pending actions.
            </div>
          ) : (
            <div className="table-container">
              <table className="custom-table" style={{ fontSize: '13px' }}>
                <thead>
                  <tr>
                    <th>Ref</th>
                    <th>Requester</th>
                    <th>Approved On</th>
                    <th className="text-right">Lines</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {pendingFulfill.map(req => {
                    const financeAudit = req.auditTrail.find(a => a.action.includes('Finance'));
                    return (
                      <tr key={req.id}>
                        <td><strong style={{ color: 'var(--primary)' }}>{req.title}</strong></td>
                        <td>{req.requesterName}</td>
                        <td>
                          <div className="flex align-center gap-sm text-secondary">
                            <Calendar size={13} />
                            {financeAudit ? new Date(financeAudit.timestamp).toLocaleDateString() : 'N/A'}
                          </div>
                        </td>
                        <td className="text-right font-semibold">{req.auditTrail[0]?.comments ? 'Multi' : 'Active'}</td>
                        <td>
                          <button 
                            className="btn btn-primary" 
                            style={{ padding: '4px 10px', fontSize: '12px' }}
                            onClick={() => handleOpenFulfillment(req)}
                          >
                            Dispatch
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Right Side: Recently dispatched */}
        <div className="glass-panel flex-column gap-sm">
          <h3 style={{ fontSize: '18px', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }} className="flex align-center gap-sm">
            <Clipboard size={18} />
            Recent Dispatch History
          </h3>

          {loading && !selectedRequest ? (
            <div style={{ padding: '30px', textAlign: 'center' }} className="text-muted">Loading history...</div>
          ) : completedFulfill.length === 0 ? (
            <div style={{ padding: '40px', textAlign: 'center' }} className="text-muted">
              No recent dispatches logged.
            </div>
          ) : (
            <div className="table-container" style={{ maxHeight: '400px', overflowY: 'auto' }}>
              <table className="custom-table" style={{ fontSize: '13px' }}>
                <thead>
                  <tr>
                    <th>Ref</th>
                    <th>Requester</th>
                    <th>Dispatched Date</th>
                    <th>Details</th>
                  </tr>
                </thead>
                <tbody>
                  {completedFulfill.map(req => (
                    <tr key={req.id}>
                      <td><strong>{req.title}</strong></td>
                      <td>{req.requesterName}</td>
                      <td>{req.storekeeperIssuedDate ? new Date(req.storekeeperIssuedDate).toLocaleDateString() : 'N/A'}</td>
                      <td>
                        <button 
                          className="btn btn-secondary" 
                          style={{ padding: '4px 8px', fontSize: '11px' }}
                          onClick={() => handleOpenFulfillment(req)}
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

      {/* Fulfillment Modal Screen */}
      {selectedRequest && (
        <div className="modal-overlay" onClick={() => setSelectedRequest(null)}>
          <div className="modal-content" style={{ maxWidth: '900px' }} onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between align-center" style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
              <div>
                <h3 className="gradient-text">
                  {selectedRequest.status === 'Completed' ? 'View Dispatched Request' : 'Dispatch Request Items'} - {selectedRequest.title}
                </h3>
                <span className="text-muted" style={{ fontSize: '12px' }}>
                  Requester: {selectedRequest.requesterName} ({selectedRequest.requesterEmail}) | Division: {selectedRequest.division}
                </span>
              </div>
              <span className={`status-badge status-${selectedRequest.status}`}>
                {selectedRequest.status}
              </span>
            </div>

            <form onSubmit={handleFulfillRequest} className="flex-column gap-md">
              <div className="dashboard-layout" style={{ margin: '8px 0' }}>
                {/* Left Panel: Line Items dispatch editor */}
                <div className="flex-column gap-sm">
                  <h4 className="text-secondary" style={{ fontSize: '14px', borderBottom: '1px solid var(--border-color)', paddingBottom: '6px' }}>Item Specifications</h4>
                  <div className="flex-column gap-sm" style={{ maxHeight: '300px', overflowY: 'auto', paddingRight: '6px' }}>
                    {fulfillmentLines.map((line, idx) => {
                      const stock = line.catalogItem?.stockOnHand || 0;
                      const isLowStock = stock < line.item.requestedQuantity;
                      const isDispatched = selectedRequest.status === 'Completed';

                      return (
                        <div key={line.item.id} className="flex-column gap-sm" style={{ background: 'var(--bg-secondary)', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                          <div className="flex justify-between align-center">
                            <div>
                              <strong style={{ fontSize: '14px' }}>{line.item.title}</strong>
                              <span className="text-muted" style={{ fontSize: '11px', display: 'block' }}>SKU: {line.catalogItem?.sku}</span>
                            </div>
                            
                            {/* Stock Badge indicator */}
                            {!isDispatched && (
                              <span style={{ 
                                fontSize: '11px', 
                                padding: '2px 8px', 
                                borderRadius: '4px',
                                background: isLowStock ? 'rgba(235, 140, 20, 0.15)' : 'rgba(40, 200, 100, 0.15)',
                                color: isLowStock ? 'var(--color-pending-store)' : 'var(--color-completed)',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px',
                                fontWeight: 600
                              }}>
                                {isLowStock && <AlertTriangle size={12} />}
                                In Stock: {stock}
                              </span>
                            )}
                          </div>

                          <div className="flex justify-between align-center" style={{ borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '8px' }}>
                            <div className="text-secondary" style={{ fontSize: '13px' }}>
                              Original Requested: <strong style={{ color: 'var(--text-primary)' }}>{line.item.requestedQuantity}</strong>
                            </div>

                            {isDispatched ? (
                              <div className="text-right">
                                <span className="text-muted" style={{ fontSize: '12px' }}>Quantity Issued:</span>
                                <strong style={{ display: 'block', color: line.item.issuedQuantity > 0 ? 'var(--color-completed)' : 'var(--color-declined)' }}>
                                  {line.item.issuedQuantity} ({line.item.itemStatus})
                                </strong>
                              </div>
                            ) : (
                              /* Active Dispatch controls */
                              <div className="flex align-center gap-md">
                                <span style={{ fontSize: '13px' }}>Issue Quantity:</span>
                                <div className="flex align-center gap-sm">
                                  <input 
                                    type="number"
                                    className="form-control"
                                    style={{ width: '70px', padding: '6px', textAlign: 'center' }}
                                    value={line.tempIssuedQty}
                                    min={0}
                                    max={line.item.requestedQuantity}
                                    disabled={line.tempStatus === 'Declined'}
                                    onChange={(e) => handleQtyChange(idx, Number(e.target.value))}
                                  />
                                  <div className="flex gap-xs">
                                    <button
                                      type="button"
                                      className={`btn ${line.tempStatus === 'Approved' ? 'btn-primary' : 'btn-secondary'}`}
                                      style={{ padding: '6px 8px', borderRadius: '4px' }}
                                      onClick={() => handleStatusToggle(idx, true)}
                                      title="Approve and Issue"
                                    >
                                      <Check size={14} />
                                    </button>
                                    <button
                                      type="button"
                                      className={`btn ${line.tempStatus === 'Declined' ? 'btn-danger' : 'btn-secondary'}`}
                                      style={{ padding: '6px 8px', borderRadius: '4px' }}
                                      onClick={() => handleStatusToggle(idx, false)}
                                      title="Decline / Reject Item"
                                    >
                                      <X size={14} />
                                    </button>
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Right Panel: Pre-approval steps and form logs */}
                <div className="flex-column gap-sm">
                  <h4 className="text-secondary" style={{ fontSize: '14px', borderBottom: '1px solid var(--border-color)', paddingBottom: '6px' }}>Approval Validation Logs</h4>
                  
                  {/* Displays comments from HOD and Finance */}
                  <div className="flex-column gap-sm" style={{ background: 'var(--bg-secondary)', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-color)', fontSize: '13px' }}>
                    <div className="flex align-center gap-sm text-secondary">
                      <Info size={14} />
                      <span>Pre-approval rationales:</span>
                    </div>
                    {selectedRequest.hodComments && (
                      <div style={{ borderLeft: '2px solid var(--color-pending-hod)', paddingLeft: '8px' }}>
                        <strong>HOD:</strong> <span className="text-muted">"{selectedRequest.hodComments}"</span>
                      </div>
                    )}
                    {selectedRequest.financeComments && (
                      <div style={{ borderLeft: '2px solid var(--color-pending-finance)', paddingLeft: '8px' }}>
                        <strong>Finance:</strong> <span className="text-muted">"{selectedRequest.financeComments}"</span>
                      </div>
                    )}
                    {selectedRequest.status === 'Completed' && selectedRequest.storekeeperComments && (
                      <div style={{ borderLeft: '2px solid var(--color-completed)', paddingLeft: '8px' }}>
                        <strong>Storekeeper Notes:</strong> <span className="text-muted">"{selectedRequest.storekeeperComments}"</span>
                      </div>
                    )}
                  </div>

                  {/* Fulfill Action Section */}
                  {selectedRequest.status === 'Pending_Storekeeper' && (
                    <div className="flex-column gap-sm" style={{ border: '1px dashed var(--border-color)', padding: '12px', borderRadius: '8px', marginTop: '4px' }}>
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label style={{ fontSize: '11px' }}>Fulfillment Remarks</label>
                        <textarea 
                          className="form-control"
                          placeholder="Provide reasons for reducing quantities or declining items..."
                          rows={3}
                          value={comments}
                          onChange={(e) => setComments(e.target.value)}
                        />
                      </div>

                      {validationError && (
                        <div className="alert-box alert-warning" style={{ fontSize: '12px', padding: '8px', margin: 0 }}>
                          {validationError}
                        </div>
                      )}

                      <button 
                        type="submit" 
                        className="btn btn-accent" 
                        style={{ width: '100%', padding: '10px' }}
                        disabled={submitting}
                      >
                        {submitting ? 'Updating Inventory...' : <><Truck size={16} /> Complete Issue & Dispatch</>}
                      </button>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex justify-end" style={{ borderTop: '1px solid var(--border-color)', paddingTop: '12px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setSelectedRequest(null)}>Close</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
