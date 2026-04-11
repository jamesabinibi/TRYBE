import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth, useSettings } from '../App';
import { Lock, User, ArrowRight, ShieldCheck, Eye, EyeOff } from 'lucide-react';
import { motion } from 'motion/react';
import { Input } from '../components/Input';
import { apiFetch } from '../lib/utils';

export default function Login() {
  const { login } = useAuth();
  const { businessLogo, businessName } = useSettings();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    
    console.log('[DEBUG] Login attempt:', { username: username.trim() });

    try {
      const response = await apiFetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim(), password })
      });
      
      console.log('[DEBUG] Login response status:', response.status);

      if (response.ok) {
        const user = await response.json();
        console.log('[DEBUG] Login success:', user.username);
        login(user);
      } else {
        const contentType = response.headers.get("content-type");
        if (contentType && contentType.indexOf("application/json") !== -1) {
          const data = await response.json();
          console.error('[DEBUG] Login failed (JSON):', data);
          setError(data.error || 'Invalid username or password');
        } else {
          const text = await response.text();
          console.error('[DEBUG] Login failed (Text):', text);
          setError(text || `Server error (${response.status}). Please try again later.`);
        }
      }
    } catch (err: any) {
      console.error('[DEBUG] Login network error:', err);
      setError(`Network error: ${err.message || 'Failed to fetch'}. Please check if the server is running.`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-[#050505] flex flex-col py-12 px-4 sm:px-6 lg:px-8 transition-colors duration-500">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="sm:mx-auto sm:w-full sm:max-w-md my-auto"
      >
        <div className="bg-white dark:bg-zinc-900 rounded-[32px] shadow-2xl shadow-zinc-200/50 dark:shadow-black/50 border border-zinc-200 dark:border-zinc-800 overflow-hidden transition-colors duration-500">
          <div className="p-6 pt-8 text-center">
            {businessLogo ? (
              <img src={businessLogo} alt={businessName} className="h-12 w-auto object-contain mx-auto mb-3" referrerPolicy="no-referrer" />
            ) : (
              <>
                <div className="w-12 h-12 bg-brand rounded-2xl flex items-center justify-center text-white mx-auto mb-3 shadow-lg shadow-brand/30 rotate-3">
                  <ShieldCheck className="w-6 h-6" />
                </div>
                <h1 className="h1 mb-1">{businessName}</h1>
              </>
            )}
            <p className="body-text text-xs font-medium">Sign in to manage your business</p>
          </div>

          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            {error && (
              <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-900/30 rounded-xl text-red-600 dark:text-red-400 text-xs font-medium text-center">
                {error}
              </div>
            )}
            
            <div className="space-y-3">
              <div className="space-y-1">
                <label className="label-text ml-1">Username or Email</label>
                <div className="relative">
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 dark:text-zinc-500" />
                  <Input 
                    type="text" 
                    required
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Username or Email"
                    className="pl-11 font-light"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="label-text ml-1">Password</label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 dark:text-zinc-500" />
                  <Input 
                    type={showPassword ? "text" : "password"} 
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="pl-11 pr-11 font-light"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </div>

            <button 
              type="submit"
              disabled={isLoading}
              className="w-full py-2.5 bg-brand hover:bg-brand-hover disabled:bg-zinc-200 dark:disabled:bg-zinc-800 text-white rounded-xl font-medium flex items-center justify-center gap-2 transition-all shadow-lg shadow-brand/30 group text-sm"
            >
              {isLoading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  Sign In
                  <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </>
              )}
            </button>

            <div className="text-center">
              <Link 
                to="/forgot-password"
                className="text-xs text-zinc-400 dark:text-zinc-500 font-medium hover:text-brand hover:underline"
              >
                Forgot your password?
              </Link>
            </div>
          </form>

          <div className="p-6 bg-zinc-50 dark:bg-zinc-800/50 border-t border-zinc-100 dark:border-zinc-800 text-center space-y-4">
            <p className="text-sm text-zinc-500 dark:text-zinc-400 font-medium">
              Don't have an account? <Link to="/register" className="text-brand font-medium hover:underline">Sign Up</Link>
            </p>
            <div className="pt-4 border-t border-zinc-200 dark:border-zinc-700">
              <p className="text-[10px] font-medium text-zinc-400 dark:text-zinc-500 uppercase tracking-widest">
                Protected by Gryndee Security
              </p>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
