import { LayoutDashboard, Package, Truck, Settings, Bell, Search, Menu, X, ArrowUpRight, LogIn, LogOut, Users, ShieldAlert } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useState, useEffect } from 'react';
import { cn } from '../lib/utils';
import { auth } from '../lib/firebase';
import { signInWithPopup, GoogleAuthProvider, onAuthStateChanged, User, signOut } from 'firebase/auth';
import { ADMIN_EMAIL } from '../constants';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export default function Sidebar({ activeTab, setActiveTab }: SidebarProps) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    return onAuthStateChanged(auth, (u) => setUser(u));
  }, []);

  const handleLogin = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error("Login failed:", error);
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
    setActiveTab('public-search');
  };

  const isAdmin = user?.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase();

  const menuItems = [
    { id: 'public-search', label: 'Public Tracking', icon: Search, public: true },
    { id: 'dashboard', label: 'Admin Dashboard', icon: LayoutDashboard, public: false },
    ...(isAdmin ? [{ 
      id: 'users-access', 
      label: 'User Access & Tokens', 
      icon: Users, 
      public: false,
      badge: 'ADMIN'
    }] : []),
    { id: 'shipments', label: 'All Shipments', icon: Package, public: false },
    { id: 'add-shipment', label: 'Create Shipment', icon: Truck, public: false },
    { id: 'settings', label: 'Settings', icon: Settings, public: false },
  ];

  return (
    <>
      {/* Mobile Menu Toggle */}
      <div className="lg:hidden fixed top-4 right-4 z-50">
        <button
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className="p-2 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-100"
        >
          {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {/* Sidebar Desktop */}
      <aside className={cn(
        "fixed inset-y-0 left-0 z-40 w-64 bg-[#09090b] border-r border-zinc-800 transition-transform duration-300 lg:translate-x-0 bg-opacity-95 backdrop-blur-sm",
        isMobileMenuOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
      )}>
        <div className="h-full flex flex-col p-6">
          <div className="flex items-center gap-3 mb-10 px-2 cursor-pointer" onClick={() => setActiveTab('public-search')}>
            <div className="w-10 h-10 rounded-xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center">
              <Truck className="text-orange-500" size={24} />
            </div>
            <h1 className="text-lg font-bold tracking-tight text-white leading-tight">Indian Delivery<br/><span className="text-orange-500 italic">Ltd</span></h1>
          </div>

          <nav className="flex-1 space-y-2">
            {menuItems.map((item) => {
              if (!item.public && !user) return null;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    setActiveTab(item.id);
                    setIsMobileMenuOpen(false);
                  }}
                  className={cn(
                    "w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group relative",
                    activeTab === item.id 
                      ? "text-orange-950 font-bold" 
                      : "text-zinc-400 hover:text-white hover:bg-zinc-900"
                  )}
                >
                  <item.icon size={20} className="relative z-10" />
                  <span className="relative z-10 flex-1 text-left truncate">{item.label}</span>
                  {(item as any).badge && (
                    <span className={cn(
                      "relative z-10 text-[9px] font-black uppercase px-1.5 py-0.5 rounded",
                      activeTab === item.id ? "bg-orange-950 text-orange-400" : "bg-orange-500/20 text-orange-400"
                    )}>
                      {(item as any).badge}
                    </span>
                  )}
                  {activeTab === item.id && (
                    <motion.div 
                      layoutId="sidebar-active"
                      className="absolute inset-0 bg-orange-500 rounded-xl z-0 shadow-lg shadow-orange-500/20"
                    />
                  )}
                </button>
              );
            })}
          </nav>

          <div className="mt-auto pt-6 border-t border-zinc-800 space-y-4">
            {user ? (
              <>
                <div className="px-4 py-3 bg-zinc-900/50 rounded-2xl border border-zinc-800/50 group cursor-pointer" onClick={handleLogout}>
                  <p className="text-[10px] uppercase tracking-wider text-zinc-500 font-bold mb-1">Session</p>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-white group-hover:text-orange-500">Log Out</span>
                    <LogOut size={14} className="text-zinc-500 group-hover:text-orange-500 transition-colors" />
                  </div>
                </div>
                <div className="flex items-center gap-3 px-4 py-2">
                  <img 
                    src={user.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.email}`} 
                    className="w-8 h-8 rounded-full border border-orange-500/50" 
                    alt="User profile"
                  />
                  <div className="flex-1 overflow-hidden text-left">
                    <p className="text-sm font-bold text-white truncate">{user.displayName || 'Admin'}</p>
                    <p className="text-[10px] text-zinc-500 truncate">{user.email}</p>
                  </div>
                </div>
              </>
            ) : (
              <div className="px-4 py-3 bg-orange-500/5 rounded-2xl border border-orange-500/10">
                <p className="text-[10px] text-orange-500/60 font-bold uppercase tracking-widest leading-relaxed">Secure gateway for Indian Delivery Ltd employees.</p>
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* Overlay for mobile menu */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsMobileMenuOpen(false)}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-30 lg:hidden"
          />
        )}
      </AnimatePresence>
    </>
  );
}
