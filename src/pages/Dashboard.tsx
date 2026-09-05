import { ArrowUpRight, ArrowDownRight, Package, Truck, Clock, AlertTriangle, Loader2, ShieldCheck, Users, ExternalLink } from 'lucide-react';
import { motion } from 'motion/react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useState, useEffect } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType, auth } from '../lib/firebase';
import { cn } from '../lib/utils';
import { onAuthStateChanged, User } from 'firebase/auth';
import { ADMIN_EMAIL } from '../constants';
import { subscribeToRegisteredUsers, toggleUserAccess } from '../lib/userService';
import { RegisteredUser } from '../types';

const data = [
  { name: 'Mon', volume: 4000 },
  { name: 'Tue', volume: 3000 },
  { name: 'Wed', volume: 5000 },
  { name: 'Thu', volume: 4500 },
  { name: 'Fri', volume: 6000 },
  { name: 'Sat', volume: 3500 },
  { name: 'Sun', volume: 2000 },
];

export default function Dashboard() {
  const [counts, setCounts] = useState({ total: 0, pending: 0, inTransit: 0, delivered: 0 });
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [registeredUsers, setRegisteredUsers] = useState<RegisteredUser[]>([]);
  const [togglingEmail, setTogglingEmail] = useState<string | null>(null);

  useEffect(() => {
    let unsubscribeUsers: (() => void) | null = null;

    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      if (user) {
        fetchStats();
        if (user.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase()) {
          unsubscribeUsers = subscribeToRegisteredUsers((users) => {
            setRegisteredUsers(users);
          });
        }
      } else {
        setLoading(false);
      }
    });

    async function fetchStats() {
      try {
        const querySnapshot = await getDocs(collection(db, 'shipments'));
        const docs = querySnapshot.docs.map(d => d.data());
        setCounts({
          total: docs.length,
          pending: docs.filter(d => d.status === 'Pending').length,
          inTransit: docs.filter(d => d.status === 'In Transit').length,
          delivered: docs.filter(d => d.status === 'Delivered').length,
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.LIST, 'shipments (dashboard stats)');
      } finally {
        setLoading(false);
      }
    }

    return () => {
      unsubscribeAuth();
      if (unsubscribeUsers) unsubscribeUsers();
    };
  }, []);

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

  const isAdmin = currentUser?.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase();

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-orange-500 animate-spin" />
      </div>
    );
  }

  const stats = [
    { title: 'Total Shipments', value: counts.total.toLocaleString(), change: '+12.5%', trend: 'up', icon: Package, color: 'text-blue-500', bg: 'bg-blue-500/10' },
    { title: 'In Transit', value: counts.inTransit.toLocaleString(), change: '+5.2%', trend: 'up', icon: Truck, color: 'text-orange-500', bg: 'bg-orange-500/10' },
    { title: 'Delivered', value: counts.delivered.toLocaleString(), change: '+2.1%', trend: 'up', icon: Clock, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
    { title: 'Attention Required', value: (counts.total - counts.delivered - counts.inTransit - counts.pending).toString(), change: '0', trend: 'neutral', icon: AlertTriangle, color: 'text-rose-500', bg: 'bg-rose-500/10' },
  ];

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold text-white tracking-tight">Indian Delivery <span className="text-orange-500 italic">Ltd</span></h2>
          <p className="text-zinc-400 mt-1">Global logistics operations overview for <span className="text-white font-medium">May 2024</span></p>
        </div>
        <div className="flex items-center gap-3">
          <button className="px-4 py-2 bg-zinc-900 border border-zinc-800 rounded-xl text-sm font-medium hover:bg-zinc-800 transition-colors">Export Report</button>
          <button className="px-4 py-2 bg-orange-500 text-orange-950 font-bold rounded-xl text-sm hover:bg-orange-400 transition-colors">Add New Unit</button>
        </div>
      </header>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, idx) => (
          <motion.div
            key={stat.title}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.1 }}
            className="p-6 bg-zinc-900/50 border border-zinc-800/50 rounded-2xl hover:border-zinc-700/50 transition-all duration-300 group cursor-default"
          >
            <div className="flex items-center justify-between mb-4">
              <div className={cn("p-2 rounded-lg transition-colors", stat.bg)}>
                <stat.icon className={stat.color} size={20} />
              </div>
              <div className={cn(
                "flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full",
                stat.trend === 'up' ? "bg-emerald-500/10 text-emerald-500" : "bg-rose-500/10 text-rose-500"
              )}>
                {stat.change}
                {stat.trend === 'up' ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
              </div>
            </div>
            <p className="text-zinc-500 text-sm font-medium">{stat.title}</p>
            <p className="text-2xl font-bold text-white mt-1 group-hover:text-orange-500 transition-colors">{stat.value}</p>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Chart Section */}
        <div className="lg:col-span-2 p-6 bg-zinc-900/50 border border-zinc-800/50 rounded-2xl">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h3 className="text-lg font-bold text-white">Shipment Volume</h3>
              <p className="text-zinc-500 text-sm">Weekly transactional trend analysis</p>
            </div>
            <select className="bg-zinc-800 border-zinc-700 text-zinc-400 text-xs rounded-lg px-2 py-1 outline-none">
              <option>Last 7 Days</option>
              <option>Last 30 Days</option>
            </select>
          </div>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data}>
                <defs>
                  <linearGradient id="colorVolume" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#f59e0b" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#27272a" />
                <XAxis dataKey="name" stroke="#52525b" fontSize={12} axisLine={false} tickLine={false} />
                <YAxis stroke="#52525b" fontSize={12} axisLine={false} tickLine={false} tickFormatter={(value) => `${value/1000}k`} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#18181b', border: '1px solid #27272a', borderRadius: '12px' }}
                  itemStyle={{ color: '#f59e0b' }}
                />
                <Area type="monotone" dataKey="volume" stroke="#f97316" strokeWidth={3} fillOpacity={1} fill="url(#colorVolume)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Priority Shipments */}
        <div className="p-6 bg-zinc-900/50 border border-zinc-800/50 rounded-2xl flex flex-col">
          <h3 className="text-lg font-bold text-white mb-6">Recent Activity</h3>
          <div className="space-y-6 flex-1">
            {[
              { id: '1', msg: 'New shipment created', time: '2 mins ago', icon: Package, color: 'text-orange-500' },
              { id: '2', msg: 'Delivery delayed in Berlin', time: '12 mins ago', icon: AlertTriangle, color: 'text-rose-500' },
              { id: '3', msg: 'Customs cleared for SP-100234', time: '1 hour ago', icon: Truck, color: 'text-blue-500' },
              { id: '4', msg: 'Payment confirmed for order #942', time: '3 hours ago', icon: Clock, color: 'text-emerald-500' },
              { id: '5', msg: 'Carrier assigned to SP-100237', time: '5 hours ago', icon: Truck, color: 'text-zinc-500' },
            ].map((item) => (
              <div key={item.id} className="flex gap-4 group cursor-pointer">
                <div className="mt-1">
                  <item.icon size={16} className={cn(item.color, "group-hover:scale-110 transition-transform")} />
                </div>
                <div>
                  <p className="text-sm font-medium text-white group-hover:text-orange-500 transition-colors">{item.msg}</p>
                  <p className="text-xs text-zinc-500 mt-1">{item.time}</p>
                </div>
              </div>
            ))}
          </div>
          <button className="mt-6 w-full py-2 bg-zinc-800 text-zinc-300 text-xs font-semibold rounded-xl hover:bg-zinc-700 transition-colors">
            View All Notifications
          </button>
        </div>
      </div>
      {/* Admin Registered Users Quick Control Section */}
      {isAdmin && (
        <div className="p-6 bg-zinc-900/50 border border-orange-500/30 rounded-3xl space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800/80 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center text-orange-400">
                <Users size={20} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-bold text-white">Registered Users & Access Switches</h3>
                  <span className="px-2 py-0.5 rounded-md bg-orange-500/20 text-orange-400 text-[10px] font-black uppercase">
                    Admin Exclusive
                  </span>
                </div>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Turning the switch OFF blocks that Gmail and renders the black "API Token limit reached" screen.
                </p>
              </div>
            </div>

            <a
              href="/users-access"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-xs font-bold text-zinc-200 transition-colors shrink-0"
            >
              <span>Manage All Users</span>
              <ExternalLink size={14} />
            </a>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {registeredUsers.map((user) => {
              const isMasterAdmin = user.email.toLowerCase() === ADMIN_EMAIL.toLowerCase();
              const isToggling = togglingEmail === user.email;

              return (
                <div
                  key={user.email}
                  className={cn(
                    "p-4 rounded-2xl border transition-all flex items-center justify-between gap-3",
                    user.isEnabled
                      ? "bg-zinc-950/60 border-zinc-800"
                      : "bg-red-950/10 border-red-900/30"
                  )}
                >
                  <div className="min-w-0 flex items-center gap-3">
                    <img
                      src={user.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.email}`}
                      alt={user.email}
                      className="w-9 h-9 rounded-full bg-zinc-800 border border-zinc-700 shrink-0"
                    />
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-white truncate">{user.email}</p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className={cn(
                          "w-1.5 h-1.5 rounded-full",
                          user.isEnabled ? "bg-emerald-400 animate-pulse" : "bg-red-500"
                        )} />
                        <span className="text-[10px] text-zinc-400 font-mono">
                          {user.isEnabled ? "Access Allowed" : "Token Blocked"}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Switch button */}
                  <button
                    type="button"
                    role="switch"
                    aria-checked={user.isEnabled}
                    disabled={isMasterAdmin || isToggling}
                    onClick={() => handleToggle(user)}
                    title={isMasterAdmin ? "Primary admin cannot be toggled" : `Turn ${user.isEnabled ? 'OFF' : 'ON'}`}
                    className={cn(
                      "relative inline-flex h-7 w-14 shrink-0 cursor-pointer rounded-full border-2 transition-colors duration-200 ease-in-out focus:outline-none",
                      user.isEnabled
                        ? "bg-emerald-600 border-emerald-500"
                        : "bg-zinc-800 border-zinc-700",
                      isMasterAdmin && "opacity-60 cursor-not-allowed",
                      isToggling && "opacity-50 cursor-wait"
                    )}
                  >
                    <span
                      className={cn(
                        "pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out flex items-center justify-center text-[9px] font-black",
                        user.isEnabled ? "translate-x-7 text-emerald-800" : "translate-x-0.5 text-zinc-800"
                      )}
                    >
                      {user.isEnabled ? "ON" : "OFF"}
                    </span>
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
