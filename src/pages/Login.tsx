import React, { useState } from 'react';
import { useAuth } from '../App';
import { Lock, User, ArrowRight, ShieldCheck } from 'lucide-react';
import { motion } from 'motion/react';

export default function Login() {
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    
    try {
      const response = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      
      if (response.ok) {
        const user = await response.json();
        login(user);
      } else {
        setError('Invalid username or password');
      }
    } catch (err) {
      setError('Something went wrong. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-50 flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        <div className="bg-white rounded-[32px] shadow-2xl shadow-zinc-200/50 border border-zinc-200 overflow-hidden">
          <div className="p-8 pt-12 text-center">
            <div className="w-16 h-16 bg-emerald-500 rounded-2xl flex items-center justify-center text-white mx-auto mb-6 shadow-lg shadow-emerald-200 rotate-3">
              <ShieldCheck className="w-8 h-8" />
            </div>
            <h1 className="text-3xl font-black text-zinc-900 tracking-tight mb-2">StockFlow Pro</h1>
            <p className="text-zinc-500 font-medium">Sign in to manage your inventory</p>
          </div>

          <form onSubmit={handleSubmit} className="p-8 space-y-6">
            {error && (
              <div className="p-4 bg-red-50 border border-red-100 rounded-2xl text-red-600 text-sm font-medium text-center">
                {error}
              </div>
            )}
            
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-zinc-400 uppercase tracking-widest ml-1">Username</label>
                <div className="relative">
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-400" />
                  <input 
                    type="text" 
                    required
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Enter your username"
                    className="w-full pl-12 pr-4 py-3.5 bg-zinc-50 border border-zinc-200 rounded-2xl text-sm focus:bg-white focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 outline-none transition-all"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-zinc-400 uppercase tracking-widest ml-1">Password</label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-400" />
                  <input 
                    type="password" 
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-12 pr-4 py-3.5 bg-zinc-50 border border-zinc-200 rounded-2xl text-sm focus:bg-white focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 outline-none transition-all"
                  />
                </div>
              </div>
            </div>

            <button 
              type="submit"
              disabled={isLoading}
              className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 disabled:bg-zinc-200 text-white rounded-2xl font-bold flex items-center justify-center gap-2 transition-all shadow-lg shadow-emerald-200 group"
            >
              {isLoading ? "Signing in..." : (
                <>
                  Sign In
                  <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </>
              )}
            </button>

            <div className="text-center">
              <p className="text-xs text-zinc-400 font-medium">
                Forgot your password? <a href="#" className="text-emerald-600 hover:underline">Contact Admin</a>
              </p>
            </div>
          </form>

          <div className="p-6 bg-zinc-50 border-t border-zinc-100 text-center">
            <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">
              Demo Credentials: admin / admin123
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
