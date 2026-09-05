import { useState, useEffect, FormEvent } from 'react';
import { 
  Users, 
  ShieldCheck, 
  Plus, 
  Search, 
  Trash2, 
  Eye, 
  CheckCircle2, 
  XCircle, 
  RefreshCw, 
  AlertTriangle,
  Mail,
  Clock,
  Sparkles,
  KeyRound,
  Check
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { RegisteredUser } from '../types';
import { 
  subscribeToRegisteredUsers, 
  toggleUserAccess, 
  addRegisteredUser, 
  removeRegisteredUser, 
  ensureInitialRegisteredUsers,
  purgeDemoUsers
} from '../lib/userService';
import { ADMIN_EMAIL } from '../constants';
import { cn } from '../lib/utils';
import TokenLimitBlockedScreen from '../components/TokenLimitBlockedScreen';
import { auth } from '../lib/firebase';

export default function RegisteredUsers() {
  const [users, setUsers] = useState<RegisteredUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'enabled' | 'disabled'>('all');
  const [togglingEmail, setTogglingEmail] = useState<string | null>(null);
  const [purging, setPurging] = useState(false);
  const [purgeMessage, setPurgeMessage] = useState<string | null>(null);
  
  // Modal states
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [newName, setNewName] = useState('');
  const [newNotes, setNewNotes] = useState('');
  const [addError, setAddError] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);

  // Preview state for admin to inspect black screen
  const [isPreviewingLimitScreen, setIsPreviewingLimitScreen] = useState(false);

  useEffect(() => {
    // 1. Purge any demo emails and ensure admin account exists
    ensureInitialRegisteredUsers(auth.currentUser);

    // 2. Real-time subscription to authenticated users
    const unsubscribe = subscribeToRegisteredUsers(
      (data) => {
        setUsers(data);
        setLoading(false);
      },
      (err) => {
        console.error('Error fetching registered users:', err);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  const handlePurge = async () => {
    setPurging(true);
    setPurgeMessage(null);
    try {
      const removed = await purgeDemoUsers();
      setPurgeMessage(removed > 0 
        ? `Cleaned up ${removed} demo email(s). Now only showing Firebase Authentication users.`
        : 'All demo emails already cleaned up. List contains only real Firebase Auth accounts.'
      );
      setTimeout(() => setPurgeMessage(null), 5000);
    } catch (err) {
      console.error('Failed to purge demo users:', err);
    } finally {
      setPurging(false);
    }
  };

  const handleToggle = async (user: RegisteredUser) => {
    setTogglingEmail(user.email);
    try {
      await toggleUserAccess(user.email, !user.isEnabled);
    } catch (err) {
      console.error('Failed to toggle user:', err);
    } finally {
      setTogglingEmail(null);
    }
  };

  const handleAddUser = async (e: FormEvent) => {
    e.preventDefault();
    setAddError(null);

    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!newEmail.trim() || !emailPattern.test(newEmail.trim())) {
      setAddError('Please enter a valid email address.');
      return;
    }

    setIsAdding(true);
    try {
      await addRegisteredUser(newEmail, newName, newNotes);
      setNewEmail('');
      setNewName('');
      setNewNotes('');
      setIsAddModalOpen(false);
    } catch (err: any) {
      setAddError(err.message || 'Failed to add user email.');
    } finally {
      setIsAdding(false);
    }
  };

  const handleDeleteUser = async (email: string) => {
    if (email.toLowerCase() === ADMIN_EMAIL.toLowerCase()) {
      alert('Master admin account cannot be deleted.');
      return;
    }
    if (confirm(`Are you sure you want to remove ${email} from authorized users?`)) {
      try {
        await removeRegisteredUser(email);
      } catch (err) {
        console.error('Failed to delete user:', err);
      }
    }
  };

  const filteredUsers = users.filter((u) => {
    const matchesSearch = 
      u.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (u.displayName && u.displayName.toLowerCase().includes(searchQuery.toLowerCase()));
    
    if (!matchesSearch) return false;
    if (filterStatus === 'enabled') return u.isEnabled;
    if (filterStatus === 'disabled') return !u.isEnabled;
    return true;
  });

  const totalCount = users.length;
  const enabledCount = users.filter(u => u.isEnabled).length;
  const disabledCount = users.filter(u => !u.isEnabled).length;

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Black screen preview mode for admin */}
      {isPreviewingLimitScreen && (
        <div className="relative">
          <TokenLimitBlockedScreen 
            userEmail="preview.user@gmail.com" 
            onRefresh={() => setIsPreviewingLimitScreen(false)} 
          />
          <button
            onClick={() => setIsPreviewingLimitScreen(false)}
            className="fixed top-6 right-6 z-[100000] px-4 py-2 bg-orange-500 text-orange-950 font-bold rounded-xl shadow-2xl hover:bg-orange-400 transition-all text-sm"
          >
            Exit Preview Mode
          </button>
        </div>
      )}

      {/* Header */}
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center">
              <ShieldCheck className="text-orange-500" size={24} />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-3xl font-bold text-white tracking-tight">
                  Firebase Users & Access Control
                </h2>
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-bold">
                  Firebase Auth Connected
                </span>
              </div>
              <p className="text-zinc-400 text-sm mt-0.5">
                Administered by <span className="text-orange-400 font-mono font-medium">{ADMIN_EMAIL}</span>
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <button 
            onClick={handlePurge}
            disabled={purging}
            title="Clean any legacy demo accounts from the database"
            className="px-3.5 py-2.5 bg-zinc-900 border border-zinc-800 text-zinc-300 hover:text-white rounded-xl text-xs font-semibold hover:bg-zinc-800 transition-all flex items-center gap-2"
          >
            <RefreshCw size={14} className={cn("text-zinc-400", purging && "animate-spin text-orange-400")} />
            <span>{purging ? "Purging..." : "Purge Demo Accounts"}</span>
          </button>

          <button 
            onClick={() => setIsPreviewingLimitScreen(true)}
            className="px-3.5 py-2.5 bg-zinc-900 border border-zinc-800 text-zinc-300 hover:text-white rounded-xl text-xs font-semibold hover:bg-zinc-800 transition-all flex items-center gap-2"
          >
            <Eye size={14} className="text-orange-400" />
            <span>Preview Limit Screen</span>
          </button>

          <button 
            onClick={() => setIsAddModalOpen(true)}
            className="px-4 py-2.5 bg-orange-500 hover:bg-orange-400 text-orange-950 font-bold rounded-xl text-xs flex items-center gap-2 transition-all shadow-lg shadow-orange-500/20"
          >
            <Plus size={16} />
            <span>Pre-Authorize Gmail</span>
          </button>
        </div>
      </header>

      {purgeMessage && (
        <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-medium flex items-center gap-2"
        >
          <Check size={16} />
          <span>{purgeMessage}</span>
        </motion.div>
      )}

      {/* Notice Card */}
      <div className="p-5 rounded-2xl bg-gradient-to-r from-orange-500/10 via-zinc-900/50 to-zinc-900/30 border border-orange-500/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Sparkles size={16} className="text-orange-400" />
            <span className="text-sm font-bold text-white">Direct Firebase Authentication Sync</span>
          </div>
          <p className="text-xs text-zinc-400 max-w-2xl leading-relaxed">
            All users below are synchronized with Firebase Authentication. When a switch is turned <span className="text-red-400 font-semibold">OFF</span>, 
            the user logged in with that Gmail will immediately see <span className="text-white font-medium">only a black screen</span> with:
            <br />
            <code className="text-orange-300 font-mono bg-zinc-950/80 px-2 py-0.5 rounded mt-1 inline-block">
              "API Token limit reached, recharge it to use more"
            </code>
          </p>
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        <div className="p-5 rounded-2xl bg-zinc-900/50 border border-zinc-800/60">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-zinc-500">Firebase Auth Users</span>
            <Users size={18} className="text-orange-500" />
          </div>
          <p className="text-3xl font-extrabold text-white mt-2">{totalCount}</p>
          <p className="text-[11px] text-zinc-400 mt-1">Real authenticated accounts registered</p>
        </div>

        <div className="p-5 rounded-2xl bg-zinc-900/50 border border-zinc-800/60">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-zinc-500">Active (Switch ON)</span>
            <CheckCircle2 size={18} className="text-emerald-500" />
          </div>
          <p className="text-3xl font-extrabold text-emerald-400 mt-2">{enabledCount}</p>
          <p className="text-[11px] text-zinc-400 mt-1">Full access to application & shipments</p>
        </div>

        <div className="p-5 rounded-2xl bg-zinc-900/50 border border-zinc-800/60">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-zinc-500">Restricted (Switch OFF)</span>
            <XCircle size={18} className="text-red-500" />
          </div>
          <p className="text-3xl font-extrabold text-red-400 mt-2">{disabledCount}</p>
          <p className="text-[11px] text-zinc-400 mt-1">Blocked with black "API Token limit reached" screen</p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 pt-2">
        <div className="relative flex-1 max-w-md">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by registered Gmail or name..."
            className="w-full bg-zinc-900/60 border border-zinc-800 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white placeholder:text-zinc-500 focus:outline-none focus:border-orange-500/50 transition-colors"
          />
        </div>

        <div className="flex items-center gap-1.5 p-1 bg-zinc-900 border border-zinc-800 rounded-xl">
          <button
            onClick={() => setFilterStatus('all')}
            className={cn(
              "px-3 py-1.5 rounded-lg text-xs font-bold transition-colors",
              filterStatus === 'all' 
                ? "bg-orange-500 text-orange-950 shadow" 
                : "text-zinc-400 hover:text-white"
            )}
          >
            All ({totalCount})
          </button>
          <button
            onClick={() => setFilterStatus('enabled')}
            className={cn(
              "px-3 py-1.5 rounded-lg text-xs font-bold transition-colors",
              filterStatus === 'enabled' 
                ? "bg-emerald-500 text-emerald-950 shadow" 
                : "text-zinc-400 hover:text-white"
            )}
          >
            Allowed ({enabledCount})
          </button>
          <button
            onClick={() => setFilterStatus('disabled')}
            className={cn(
              "px-3 py-1.5 rounded-lg text-xs font-bold transition-colors",
              filterStatus === 'disabled' 
                ? "bg-red-500 text-white shadow" 
                : "text-zinc-400 hover:text-white"
            )}
          >
            Restricted ({disabledCount})
          </button>
        </div>
      </div>

      {/* Users List */}
      <div className="bg-zinc-900/40 border border-zinc-800/80 rounded-2xl overflow-hidden backdrop-blur-sm">
        <div className="p-4 border-b border-zinc-800 flex items-center justify-between">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Mail size={16} className="text-orange-500" />
            <span>Firebase Registered Accounts ({filteredUsers.length})</span>
          </h3>
          <span className="text-[11px] text-zinc-500 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span>Synchronized with Firebase Auth & Firestore</span>
          </span>
        </div>

        {loading ? (
          <div className="py-16 flex flex-col items-center justify-center space-y-3">
            <RefreshCw className="w-6 h-6 text-orange-500 animate-spin" />
            <p className="text-xs text-zinc-400">Loading Firebase Authentication accounts...</p>
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="py-16 text-center space-y-3">
            <AlertTriangle className="w-8 h-8 text-zinc-600 mx-auto" />
            <p className="text-sm font-medium text-zinc-300">No accounts match your filter</p>
            <p className="text-xs text-zinc-500 max-w-sm mx-auto">
              {searchQuery ? "Try a different search keyword." : "Users will appear here automatically when they log in."}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-zinc-800/60">
            {filteredUsers.map((user) => {
              const isAdmin = user.email.toLowerCase() === ADMIN_EMAIL.toLowerCase();
              const isToggling = togglingEmail === user.email;

              return (
                <div 
                  key={user.email}
                  className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-zinc-800/20 transition-colors"
                >
                  {/* User Profile Info */}
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div className="relative shrink-0">
                      <img
                        src={user.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.email}`}
                        alt={user.displayName || user.email}
                        className="w-11 h-11 rounded-full border border-zinc-700 bg-zinc-800 object-cover"
                      />
                      {isAdmin && (
                        <span className="absolute -top-1 -right-1 w-4 h-4 bg-orange-500 text-orange-950 rounded-full flex items-center justify-center text-[10px] font-black" title="Admin">
                          ★
                        </span>
                      )}
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-bold text-white truncate">{user.email}</span>
                        {isAdmin ? (
                          <span className="px-2 py-0.5 rounded-md bg-orange-500/20 border border-orange-500/40 text-orange-400 text-[10px] font-extrabold uppercase">
                            Admin (Owner)
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-md bg-zinc-800 text-zinc-300 text-[10px] font-semibold">
                            Firebase User
                          </span>
                        )}

                        {user.isFirebaseAuth !== false ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-bold">
                            <KeyRound size={10} />
                            <span>Firebase Auth</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[10px] font-bold">
                            Pre-Authorized
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-3 mt-1 text-xs text-zinc-500 flex-wrap">
                        {user.displayName && (
                          <span className="text-zinc-400 font-medium truncate">{user.displayName}</span>
                        )}
                        {user.authUid && (
                          <span className="text-[10px] font-mono text-zinc-500 truncate" title={`Firebase UID: ${user.authUid}`}>
                            UID: {user.authUid.slice(0, 10)}...
                          </span>
                        )}
                        {user.lastLoginAt && (
                          <span className="flex items-center gap-1 text-[11px] truncate">
                            <Clock size={12} className="text-zinc-600" />
                            Active: {new Date(user.lastLoginAt).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Status & Switch Controls */}
                  <div className="flex items-center justify-between sm:justify-end gap-5 pl-14 sm:pl-0">
                    {/* Status Badge */}
                    <div className="text-right">
                      {user.isEnabled ? (
                        <div className="flex items-center gap-1.5 text-emerald-400 text-xs font-bold">
                          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                          <span>API Active</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 text-red-400 text-xs font-bold">
                          <span className="w-2 h-2 rounded-full bg-red-500" />
                          <span>Limit Reached</span>
                        </div>
                      )}
                      <p className="text-[10px] text-zinc-500 mt-0.5">
                        {user.isEnabled ? "Full Access" : "Black Screen Active"}
                      </p>
                    </div>

                    {/* The Switch Component */}
                    <div className="flex items-center gap-3">
                      <div className="flex flex-col items-center">
                        <button
                          type="button"
                          role="switch"
                          aria-checked={user.isEnabled}
                          disabled={isAdmin || isToggling}
                          onClick={() => handleToggle(user)}
                          title={isAdmin ? "Primary admin cannot be disabled" : `Turn ${user.isEnabled ? 'OFF' : 'ON'} for ${user.email}`}
                          className={cn(
                            "relative inline-flex h-8 w-16 shrink-0 cursor-pointer rounded-full border-2 transition-colors duration-200 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-500",
                            user.isEnabled
                              ? "bg-emerald-600 border-emerald-500 shadow-md shadow-emerald-500/20"
                              : "bg-zinc-800 border-zinc-700",
                            isAdmin && "opacity-75 cursor-not-allowed",
                            isToggling && "opacity-50 cursor-wait"
                          )}
                        >
                          <span className="sr-only">Toggle access</span>
                          <span
                            aria-hidden="true"
                            className={cn(
                              "pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out flex items-center justify-center text-[10px] font-black",
                              user.isEnabled ? "translate-x-8 text-emerald-800" : "translate-x-0.5 text-zinc-700"
                            )}
                          >
                            {user.isEnabled ? "ON" : "OFF"}
                          </span>
                        </button>
                        <span className="text-[9px] uppercase font-mono tracking-tighter text-zinc-500 mt-0.5">
                          {user.isEnabled ? "ON" : "OFF"}
                        </span>
                      </div>

                      {/* Delete Action (only for non-admin) */}
                      {!isAdmin && (
                        <button
                          onClick={() => handleDeleteUser(user.email)}
                          className="p-2 text-zinc-600 hover:text-red-400 hover:bg-zinc-800 rounded-lg transition-colors"
                          title="Remove user"
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Info card for auto-syncing other team members */}
      <div className="p-5 rounded-2xl bg-zinc-900/30 border border-zinc-800/60 flex items-start gap-3.5">
        <Mail className="text-orange-400 shrink-0 mt-0.5" size={18} />
        <div className="space-y-1 text-xs">
          <p className="font-bold text-zinc-200">
            How other users appear here:
          </p>
          <p className="text-zinc-400 leading-relaxed">
            When another user or employee logs into the app with their Gmail using Firebase Authentication, their email and profile will immediately appear in this list. You can then flip their switch <strong className="text-white">ON</strong> or <strong className="text-white">OFF</strong> to grant access or lock them to the black <em className="text-orange-400">"API Token limit reached, recharge it to use more"</em> screen. You can also pre-authorize an email address using the button above.
          </p>
        </div>
      </div>

      {/* Add User Modal */}
      <AnimatePresence>
        {isAddModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-zinc-900 border border-zinc-800 rounded-3xl w-full max-w-md p-6 shadow-2xl space-y-5"
            >
              <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
                <div className="flex items-center gap-2">
                  <Plus className="text-orange-500" size={20} />
                  <h3 className="text-lg font-bold text-white">Pre-Authorize Gmail Account</h3>
                </div>
                <button
                  onClick={() => setIsAddModalOpen(false)}
                  className="text-zinc-500 hover:text-white transition-colors"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleAddUser} className="space-y-4">
                {addError && (
                  <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 text-xs rounded-xl">
                    {addError}
                  </div>
                )}

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-zinc-400 mb-1.5">
                    User Gmail Address *
                  </label>
                  <input
                    type="email"
                    required
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    placeholder="e.g. teammate@gmail.com"
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-orange-500"
                  />
                  <p className="text-[10px] text-zinc-500 mt-1">
                    When this Gmail signs into the app with Firebase Auth, it will match this pre-configured switch.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-zinc-400 mb-1.5">
                    Full Name / Designation
                  </label>
                  <input
                    type="text"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="e.g. John Doe (Dispatch Officer)"
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-orange-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-zinc-400 mb-1.5">
                    Notes
                  </label>
                  <input
                    type="text"
                    value={newNotes}
                    onChange={(e) => setNewNotes(e.target.value)}
                    placeholder="e.g. Regional Fleet Coordinator"
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-orange-500"
                  />
                </div>

                <div className="flex items-center justify-end gap-3 pt-4 border-t border-zinc-800">
                  <button
                    type="button"
                    onClick={() => setIsAddModalOpen(false)}
                    className="px-4 py-2 rounded-xl text-xs font-bold text-zinc-400 hover:text-white transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isAdding}
                    className="px-5 py-2.5 bg-orange-500 hover:bg-orange-400 disabled:opacity-50 text-orange-950 font-bold rounded-xl text-xs flex items-center gap-2 transition-all"
                  >
                    {isAdding ? 'Registering...' : 'Authorize Gmail'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
