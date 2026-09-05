/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, Suspense, lazy, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import { motion, AnimatePresence } from 'motion/react';
import { Search, Bell, HelpCircle, ShieldCheck } from 'lucide-react';
import { auth } from './lib/firebase';
import { onAuthStateChanged, getRedirectResult } from 'firebase/auth';
import { ADMIN_EMAIL } from './constants';
import { syncUserOnLogin, subscribeToUserStatus, ensureInitialRegisteredUsers } from './lib/userService';
import TokenLimitBlockedScreen from './components/TokenLimitBlockedScreen';
import { cn } from './lib/utils';

const Dashboard = lazy(() => import('./pages/Dashboard'));
const Shipments = lazy(() => import('./pages/Shipments'));
const Tracking = lazy(() => import('./pages/Tracking'));
const Settings = lazy(() => import('./pages/Settings'));
const AdminAddShipment = lazy(() => import('./pages/AdminAddShipment'));
const PublicTracking = lazy(() => import('./pages/PublicTracking'));
const Login = lazy(() => import('./pages/Login'));
const RegisteredUsers = lazy(() => import('./pages/RegisteredUsers'));

export default function App() {
  const [activeTab, setActiveTab] = useState(() => {
    const path = window.location.pathname.replace(/^\//, '').toLowerCase();
    const hash = window.location.hash.replace(/^#/, '').toLowerCase();
    const route = path || hash;
    if (route === 'login') return 'login';
    if (route === 'dashboard') return 'dashboard';
    if (route === 'users-access' || route === 'users') return 'users-access';
    if (route === 'shipments') return 'shipments';
    if (route === 'tracking') return 'tracking';
    if (route === 'add-shipment') return 'add-shipment';
    if (route === 'settings') return 'settings';
    return 'public-search';
  });
  const [user, setUser] = useState<any>(null);
  const [isTokenLimitReached, setIsTokenLimitReached] = useState(false);

  useEffect(() => {
    const handleLocation = () => {
      const path = window.location.pathname.replace(/^\//, '').toLowerCase();
      const hash = window.location.hash.replace(/^#/, '').toLowerCase();
      const route = path || hash;
      
      if (route === 'login') setActiveTab('login');
      else if (route === 'dashboard') setActiveTab('dashboard');
      else if (route === 'users-access' || route === 'users') setActiveTab('users-access');
      else if (route === 'shipments') setActiveTab('shipments');
      else if (route === 'tracking') setActiveTab('tracking');
      else if (route === 'add-shipment') setActiveTab('add-shipment');
      else if (route === 'settings') setActiveTab('settings');
      else if (route === 'public-search' || route === '') setActiveTab('public-search');
    };

    window.addEventListener('popstate', handleLocation);
    window.addEventListener('hashchange', handleLocation);
    
    // Handle redirect result
    getRedirectResult(auth).catch((error) => {
      console.error("Redirect auth error:", error);
    });

    return () => {
      window.removeEventListener('popstate', handleLocation);
      window.removeEventListener('hashchange', handleLocation);
    };
  }, []);

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    const targetPath = tab === 'public-search' ? '/' : `/${tab}`;
    if (window.location.pathname !== targetPath) {
      window.history.pushState(null, '', targetPath);
    }
  };

  useEffect(() => {
    let unsubscribeStatus: (() => void) | null = null;

    const unsubscribeAuth = onAuthStateChanged(auth, async (u) => {
      setUser(u);

      if (unsubscribeStatus) {
        unsubscribeStatus();
        unsubscribeStatus = null;
      }

      if (!u) {
        setIsTokenLimitReached(false);
        // Automatically redirect away from admin tabs if logged out
        if (['dashboard', 'shipments', 'add-shipment', 'settings', 'users-access'].includes(activeTab)) {
          handleTabChange('public-search');
        }
      } else {
        const isAdmin = u.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase();

        // Sync or register user in Firestore
        try {
          await syncUserOnLogin(u);
          if (isAdmin) {
            await ensureInitialRegisteredUsers(u);
          }
        } catch (err) {
          console.error('Failed to sync user registration:', err);
        }

        // If admin logs in, navigate directly to User Access & Tokens view to see registered emails
        if (isAdmin && (activeTab === 'login' || activeTab === 'public-search')) {
          handleTabChange('users-access');
        } else if (activeTab === 'login') {
          handleTabChange('dashboard');
        }

        // Subscribe to real-time status of this user's API switch
        unsubscribeStatus = subscribeToUserStatus(u.email || '', (userDoc) => {
          // If non-admin user has switch turned OFF, trigger black screen
          if (!isAdmin && userDoc && userDoc.isEnabled === false) {
            setIsTokenLimitReached(true);
          } else {
            setIsTokenLimitReached(false);
          }
        });
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeStatus) unsubscribeStatus();
    };
  }, [activeTab]);

  // When API Token switch is turned off for this user, show ONLY a black screen with the required text
  if (user && isTokenLimitReached) {
    return <TokenLimitBlockedScreen userEmail={user.email} />;
  }

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard': return <Dashboard />;
      case 'users-access': return <RegisteredUsers />;
      case 'shipments': return <Shipments />;
      case 'tracking': return <Tracking />;
      case 'add-shipment': return <AdminAddShipment />;
      case 'public-search': return <PublicTracking />;
      case 'settings': return <Settings onNavigateTab={handleTabChange} />;
      case 'login': return <Login onLoginSuccess={() => {
        if (auth.currentUser?.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase()) {
          handleTabChange('users-access');
        } else {
          handleTabChange('dashboard');
        }
      }} />;
      default: return <PublicTracking />;
    }
  };

  const isAdmin = user?.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase();

  return (
    <div className="min-h-screen bg-[#09090b] selection:bg-orange-500/30 selection:text-orange-500">
      <Sidebar activeTab={activeTab} setActiveTab={handleTabChange} />
      
      <main className="lg:pl-64 min-h-screen flex flex-col">
        {activeTab !== 'login' && (
          <header className="sticky top-0 z-30 h-16 bg-[#09090b]/80 backdrop-blur-md border-b border-zinc-800/50 px-6 lg:px-10 flex items-center justify-between">
             <div className="flex-1 max-w-xl hidden md:block">
                <div className="relative group">
                  <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 group-focus-within:text-orange-500 transition-colors" />
                  <input 
                    type="text" 
                    placeholder="Universal search..." 
                    className="w-full bg-zinc-900/50 border border-zinc-800/50 rounded-xl pl-10 pr-4 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-orange-500/50 transition-all"
                  />
                </div>
             </div>

             <div className="flex items-center gap-4 ml-auto">
                <button className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-900 rounded-lg transition-colors relative group">
                  <Bell size={20} />
                  <span className="absolute top-2 right-2 w-2 h-2 bg-orange-500 rounded-full border-2 border-[#09090b]" />
                  <div className="absolute top-full mt-2 right-0 w-64 bg-zinc-900 border border-zinc-800 rounded-xl p-4 shadow-2xl opacity-0 group-hover:opacity-100 pointer-events-none transition-all scale-95 group-hover:scale-100 origin-top-right">
                     <p className="text-xs font-bold text-white mb-2">Unread Notifications</p>
                     <div className="space-y-3">
                        <div className="text-[10px] text-zinc-400 leading-relaxed">
                           Shipment SP-100234 has cleared customs at London Heathrow.
                        </div>
                     </div>
                  </div>
                </button>
                <button className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-900 rounded-lg transition-colors">
                  <HelpCircle size={20} />
                </button>
                <div className="h-8 w-[1px] bg-zinc-800 mx-2" />
                
                {user && (
                  <div className="flex items-center gap-3 pl-2">
                    <div className="flex flex-col items-end hidden sm:flex text-right">
                      <span className="text-xs font-bold text-white line-clamp-1">{user.displayName || user.email}</span>
                      <span className={cn(
                        "text-[10px] font-bold",
                        isAdmin ? "text-orange-400" : "text-zinc-500"
                      )}>
                        {isAdmin ? 'Master Admin' : 'Registered User'}
                      </span>
                    </div>
                    <div className="w-8 h-8 rounded-full bg-orange-500/20 border border-orange-500/30 flex items-center justify-center overflow-hidden">
                       <img src={user.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.email}`} alt="User" />
                    </div>
                  </div>
                )}
             </div>
          </header>
        )}

        {/* Dynamic Content */}
        <div className="flex-1 p-6 lg:p-10">
          <Suspense fallback={
            <div className="flex items-center justify-center h-full">
              <motion.div 
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full"
              />
            </div>
          }>
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                className="max-w-[1400px] mx-auto w-full"
              >
                {renderContent()}
              </motion.div>
            </AnimatePresence>
          </Suspense>
        </div>

        {/* Footer info */}
        <footer className="mt-auto px-10 py-6 border-t border-zinc-800/50 flex flex-col sm:flex-row items-center justify-between gap-4">
           <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">© 2024 Indian Delivery Ltd</p>
           <div className="flex items-center gap-6">
              <a href="#" className="text-[10px] text-zinc-500 hover:text-white transition-colors uppercase font-bold tracking-widest">Privacy Policy</a>
              <a href="#" className="text-[10px] text-zinc-500 hover:text-white transition-colors uppercase font-bold tracking-widest">Terms of Service</a>
              <div className="flex items-center gap-2">
                 <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                 <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">Fleet Online</span>
              </div>
           </div>
        </footer>
      </main>
    </div>
  );
}
