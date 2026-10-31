import React, { useState, useEffect, useCallback } from 'react';
import { 
  Users, 
  UserPlus, 
  Store, 
  Shield, 
  CheckCircle2, 
  XCircle, 
  Trash2, 
  RefreshCw, 
  Loader2, 
  AlertCircle,
  Edit2,
  X,
  Mail,
  User
} from 'lucide-react';
import { 
  getEmployees, 
  createEmployee, 
  reassignEmployeeShop, 
  toggleEmployeeStatus, 
  revokeEmployeeAccess,
  getShops,
  type Shop
} from '../services/db.js';
import type { EmployeeRecord, CreateEmployeeInput } from '@crimpston/shared';

export const EmployeeManagementSection: React.FC = () => {
  const [employees, setEmployees] = useState<EmployeeRecord[]>([]);
  const [shops, setShops] = useState<Shop[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Add Employee Modal State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newUsername, setNewUsername] = useState('');
  const [newShopId, setNewShopId] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  // Reassign Shop Modal State
  const [reassigningEmp, setReassigningEmp] = useState<EmployeeRecord | null>(null);
  const [selectedTargetShopId, setSelectedTargetShopId] = useState('');

  // Delete Confirm Modal State
  const [empToDelete, setEmpToDelete] = useState<EmployeeRecord | null>(null);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [empList, shopList] = await Promise.all([
        getEmployees(),
        getShops()
      ]);
      setEmployees(empList);
      setShops(shopList.filter(s => s.isActive !== false));
    } catch (err: any) {
      console.error('Failed to load employee data:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleCreateEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!newName.trim()) {
      setFormError('Employee name is required.');
      return;
    }
    if (!newEmail.trim() || !newEmail.includes('@')) {
      setFormError('A valid email address is required.');
      return;
    }
    if (!newShopId) {
      setFormError('Please select an assigned retail shop.');
      return;
    }

    setActionLoading('creating');
    try {
      const input: CreateEmployeeInput = {
        name: newName.trim(),
        email: newEmail.trim().toLowerCase(),
        username: newUsername.trim() || undefined,
        shopId: newShopId
      };

      const result = await createEmployee(input);
      setFeedback({ type: 'success', message: result.message || 'Employee account created successfully.' });
      setIsAddModalOpen(false);
      setNewName('');
      setNewEmail('');
      setNewUsername('');
      setNewShopId('');
      await loadData();
    } catch (err: any) {
      setFormError(err?.message || 'Failed to create employee.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleReassignShop = async () => {
    if (!reassigningEmp || !selectedTargetShopId) return;
    setActionLoading(`reassign-${reassigningEmp.id}`);
    try {
      const res = await reassignEmployeeShop(reassigningEmp.id, selectedTargetShopId);
      setFeedback({ type: 'success', message: res.message || 'Employee shop reassigned successfully.' });
      setReassigningEmp(null);
      await loadData();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err?.message || 'Failed to reassign shop.' });
    } finally {
      setActionLoading(null);
    }
  };

  const handleToggleStatus = async (emp: EmployeeRecord) => {
    const nextStatus = !emp.isActive;
    setActionLoading(`status-${emp.id}`);
    try {
      const res = await toggleEmployeeStatus(emp.id, nextStatus);
      setFeedback({ type: 'success', message: res.message });
      await loadData();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err?.message || 'Failed to update employee status.' });
    } finally {
      setActionLoading(null);
    }
  };

  const handleRevokeAccess = async () => {
    if (!empToDelete) return;
    setActionLoading(`revoke-${empToDelete.id}`);
    try {
      const res = await revokeEmployeeAccess(empToDelete.id);
      setFeedback({ type: 'success', message: res.message || 'Employee access revoked.' });
      setEmpToDelete(null);
      await loadData();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err?.message || 'Failed to revoke employee access.' });
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs space-y-5">
      {/* Section Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-900">Employee Management &amp; Shop Access</h2>
            <p className="text-xs text-slate-400">Assign shop employees with strict read-only access to their designated stores</p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => {
            setFormError(null);
            setIsAddModalOpen(true);
          }}
          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold bg-[#168BFF] hover:bg-blue-600 text-white transition-colors cursor-pointer shadow-xs self-start sm:self-auto"
        >
          <UserPlus className="w-3.5 h-3.5" />
          <span>Add Shop Employee</span>
        </button>
      </div>

      {feedback && (
        <div className={`p-3 rounded-xl text-xs font-medium flex items-center justify-between gap-2 ${
          feedback.type === 'success' 
            ? 'bg-emerald-50 border border-emerald-200 text-emerald-800' 
            : 'bg-rose-50 border border-rose-200 text-rose-800'
        }`}>
          <span>{feedback.message}</span>
          <button 
            type="button" 
            onClick={() => setFeedback(null)} 
            className="text-slate-400 hover:text-slate-600"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Employee List */}
      {isLoading ? (
        <div className="py-8 flex items-center justify-center gap-2 text-xs text-slate-500">
          <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
          <span>Loading employee directory...</span>
        </div>
      ) : employees.length === 0 ? (
        <div className="py-8 px-4 text-center rounded-xl bg-slate-50 border border-slate-100 space-y-2">
          <Users className="w-8 h-8 text-slate-300 mx-auto" />
          <p className="text-xs font-semibold text-slate-700">No shop employees provisioned yet</p>
          <p className="text-[11px] text-slate-400 max-w-sm mx-auto">
            Click &quot;Add Shop Employee&quot; above to create employee logins with strictly isolated, read-only store access.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 text-slate-500 text-[11px] uppercase font-bold tracking-wider border-b border-slate-100">
                <th className="py-2.5 px-3">Employee</th>
                <th className="py-2.5 px-3">Assigned Shop</th>
                <th className="py-2.5 px-3">Role</th>
                <th className="py-2.5 px-3">Status</th>
                <th className="py-2.5 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {employees.map(emp => (
                <tr key={emp.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="py-3 px-3">
                    <p className="font-semibold text-slate-900">{emp.name}</p>
                    <p className="text-slate-400 text-[11px]">{emp.email}</p>
                  </td>
                  <td className="py-3 px-3">
                    <div className="flex items-center gap-1.5">
                      <Store className="w-3.5 h-3.5 text-[#168BFF]" />
                      <span className="font-medium text-slate-800">{emp.assignedShopName || 'Unassigned'}</span>
                      <span className="text-[10px] text-slate-400 font-mono">({emp.assignedShopCode || '—'})</span>
                    </div>
                  </td>
                  <td className="py-3 px-3">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-50 text-[#168BFF] text-[10px] font-bold uppercase tracking-wider">
                      <Shield className="w-3 h-3" />
                      Shop Employee
                    </span>
                  </td>
                  <td className="py-3 px-3">
                    {emp.isActive ? (
                      <span className="inline-flex items-center gap-1 text-emerald-700 font-semibold text-[11px]">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        Active
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-slate-400 font-medium text-[11px]">
                        <XCircle className="w-3.5 h-3.5 text-slate-400" />
                        Deactivated
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-3 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      {/* Reassign Shop Button */}
                      <button
                        type="button"
                        onClick={() => {
                          setReassigningEmp(emp);
                          setSelectedTargetShopId(emp.assignedShopId || (shops[0]?.id || ''));
                        }}
                        disabled={actionLoading !== null}
                        className="px-2.5 py-1 text-[11px] font-medium text-slate-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer inline-flex items-center gap-1"
                        title="Reassign Shop"
                      >
                        <Edit2 className="w-3 h-3" />
                        <span>Reassign</span>
                      </button>

                      {/* Deactivate / Reactivate Button */}
                      <button
                        type="button"
                        onClick={() => handleToggleStatus(emp)}
                        disabled={actionLoading !== null}
                        className={`px-2.5 py-1 text-[11px] font-medium rounded-lg transition-colors cursor-pointer ${
                          emp.isActive 
                            ? 'text-amber-700 hover:bg-amber-50' 
                            : 'text-emerald-700 hover:bg-emerald-50'
                        }`}
                      >
                        {actionLoading === `status-${emp.id}` ? (
                          <RefreshCw className="w-3 h-3 animate-spin" />
                        ) : emp.isActive ? (
                          'Deactivate'
                        ) : (
                          'Reactivate'
                        )}
                      </button>

                      {/* Revoke Access Button */}
                      <button
                        type="button"
                        onClick={() => setEmpToDelete(emp)}
                        disabled={actionLoading !== null}
                        className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                        title="Revoke Access"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ========================================================
          ADD EMPLOYEE MODAL
         ======================================================== */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-md w-full p-5 sm:p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-blue-50 text-[#168BFF]">
                  <UserPlus className="w-4 h-4" />
                </div>
                <h3 className="text-sm font-bold text-slate-900">Provision Shop Employee</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {formError && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleCreateEmployee} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Full Name <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={newName}
                    onChange={e => setNewName(e.target.value)}
                    placeholder="e.g. Ramesh Kumar"
                    required
                    className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Email Address <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    value={newEmail}
                    onChange={e => setNewEmail(e.target.value)}
                    placeholder="e.g. ramesh@rtrmobiles.com"
                    required
                    className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Username (Optional)
                </label>
                <input
                  type="text"
                  value={newUsername}
                  onChange={e => setNewUsername(e.target.value)}
                  placeholder="e.g. ramesh"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Assigned Retail Shop <span className="text-rose-500">*</span>
                </label>
                <select
                  value={newShopId}
                  onChange={e => setNewShopId(e.target.value)}
                  required
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-800"
                >
                  <option value="">Select a retail store...</option>
                  {shops.map(shop => (
                    <option key={shop.id} value={shop.id}>
                      {shop.name} ({shop.code})
                    </option>
                  ))}
                </select>
                <p className="text-[10px] text-slate-400 mt-1">
                  Strictly grants read-only records access to this shop only.
                </p>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-3.5 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading === 'creating'}
                  className="px-4 py-2 text-xs font-bold text-white bg-[#168BFF] hover:bg-blue-600 rounded-xl transition-colors cursor-pointer shadow-xs inline-flex items-center gap-1.5"
                >
                  {actionLoading === 'creating' ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Provisioning...</span>
                    </>
                  ) : (
                    <span>Create &amp; Assign Employee</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================
          REASSIGN SHOP MODAL
         ======================================================== */}
      {reassigningEmp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-sm w-full p-5 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-900">Reassign Employee Shop</h3>
              <button
                type="button"
                onClick={() => setReassigningEmp(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="text-xs text-slate-600 space-y-1">
              <p>Employee: <span className="font-semibold text-slate-800">{reassigningEmp.name}</span></p>
              <p>Current Store: <span className="font-medium text-slate-800">{reassigningEmp.assignedShopName}</span></p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                New Assigned Shop:
              </label>
              <select
                value={selectedTargetShopId}
                onChange={e => setSelectedTargetShopId(e.target.value)}
                className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {shops.map(shop => (
                  <option key={shop.id} value={shop.id}>
                    {shop.name} ({shop.code})
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setReassigningEmp(null)}
                className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleReassignShop}
                disabled={actionLoading !== null}
                className="px-3.5 py-1.5 text-xs font-bold text-white bg-[#168BFF] hover:bg-blue-600 rounded-xl transition-colors cursor-pointer shadow-xs"
              >
                Confirm Reassignment
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================
          REVOKE ACCESS CONFIRMATION MODAL
         ======================================================== */}
      {empToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-sm w-full p-5 space-y-4">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-xl bg-rose-50 text-rose-600 flex-shrink-0">
                <Trash2 className="w-4 h-4" />
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-slate-900">Revoke Employee Access?</h3>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Are you sure you want to revoke access for <span className="font-semibold text-slate-800">{empToDelete.name}</span>? They will immediately lose access to their assigned shop ({empToDelete.assignedShopName}).
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setEmpToDelete(null)}
                className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleRevokeAccess}
                disabled={actionLoading !== null}
                className="px-3.5 py-1.5 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl transition-colors cursor-pointer shadow-xs"
              >
                Revoke Access
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EmployeeManagementSection;
