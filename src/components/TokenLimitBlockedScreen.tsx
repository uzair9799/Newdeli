import { useState } from 'react';
import { signOut } from 'firebase/auth';
import { auth } from '../lib/firebase';
import { LogOut, RefreshCw } from 'lucide-react';

interface TokenLimitBlockedScreenProps {
  userEmail?: string | null;
  onRefresh?: () => void;
}

export default function TokenLimitBlockedScreen({ userEmail, onRefresh }: TokenLimitBlockedScreenProps) {
  const [signingOut, setSigningOut] = useState(false);

  const handleSignOut = async () => {
    setSigningOut(true);
    try {
      await signOut(auth);
      window.location.href = '/';
    } catch (err) {
      console.error('Sign out error:', err);
      setSigningOut(false);
    }
  };

  return (
    <div 
      id="api-token-limit-screen"
      className="fixed inset-0 z-[99999] bg-[#000000] text-white flex flex-col items-center justify-center p-6 select-none cursor-default"
    >
      <div className="max-w-md w-full text-center space-y-4">
        {/* Exact text required by prompt */}
        <p className="text-white text-xl sm:text-2xl md:text-3xl font-medium tracking-tight leading-relaxed">
          API Token limit reached, recharge it to use more
        </p>

        {/* Minimalist secondary controls */}
        <div className="pt-8 flex flex-col items-center gap-3">
          {userEmail && (
            <p className="text-zinc-600 text-xs font-mono">
              Account: {userEmail}
            </p>
          )}

          <div className="flex items-center gap-4 mt-2">
            {onRefresh && (
              <button
                onClick={onRefresh}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 text-xs transition-colors"
                title="Check access status"
              >
                <RefreshCw size={13} />
                <span>Check Status</span>
              </button>
            )}

            <button
              onClick={handleSignOut}
              disabled={signingOut}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-red-400 text-xs transition-colors"
            >
              <LogOut size={13} />
              <span>{signingOut ? 'Signing out...' : 'Sign Out / Switch Account'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
