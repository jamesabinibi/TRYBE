import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Lock, User, ArrowRight, ShieldCheck, Mail, UserPlus, Eye, EyeOff } from 'lucide-react';
import { motion } from 'motion/react';
import { useAuth } from '../App';

export default function Register() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [requiresVerification, setRequiresVerification] = useState(false);
  const [verificationCode, setVerificationCode] = useState('');

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      const response = await fetch('/api/auth/verify-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), code: verificationCode.trim() })
      });

      const data = await response.json();

      if (response.ok) {
        login(data);
        setIsSuccess(true);
        setTimeout(() => {
          navigate('/');
        }, 2000);
      } else {
        setError(data.error || 'Verification failed');
      }
    } catch (err) {
      console.error('Verification error:', err);
      setError('Network error. Please check your connection.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendCode = async () => {
    setIsLoading(true);
    setError('');
    try {
      const response = await fetch('/api/auth/resend-verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() })
      });
      
      const data = await response.json();
      
      if (response.ok) {
        alert('Verification code resent! Please check your email.');
      } else {
        setError(data.error || 'Failed to resend code');
      }
    } catch (err) {
      console.error('Resend error:', err);
      setError('Network error. Please check your connection.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      setIsLoading(false);
      return;
    }
    
    try {
      const response = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          username: username.trim(), 
          email: email.trim(), 
          password, 
          name: name.trim() 
        })
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.requiresVerification) {
          setRequiresVerification(true);
        } else {
          setIsSuccess(true);
          setTimeout(() => {
            navigate('/login');
          }, 3000);
        }
      } else {
        const contentType = response.headers.get("content-type");
        if (contentType && contentType.indexOf("application/json") !== -1) {
          const data = await response.json();
          setError(data.error || 'Registration failed');
        } else {
          const text = await response.text();
          setError(text || `Server error (${response.status}). Please try again later.`);
        }
      }
    } catch (err) {
      console.error('Registration error:', err);
      setError('Network error. Please check your connection.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black flex flex-col py-12 px-4 sm:px-6 lg:px-8 transition-colors duration-500">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="sm:mx-auto sm:w-full sm:max-w-md my-auto"
      >
        <div className="bg-white dark:bg-zinc-900 rounded-[32px] shadow-2xl shadow-zinc-200/50 dark:shadow-black/50 border border-zinc-200 dark:border-zinc-800 overflow-hidden transition-colors duration-500">
          <div className="p-8 pt-12 text-center">
            <div className="w-16 h-16 bg-brand rounded-2xl flex items-center justify-center text-white mx-auto mb-6 shadow-lg shadow-brand/20 rotate-3">
              <UserPlus className="w-8 h-8" />
            </div>
            <h1 className="text-3xl font-black text-zinc-900 dark:text-white tracking-tight mb-2">Create Account</h1>
            <p className="text-zinc-600 dark:text-zinc-400 font-medium">Join Gryndee to manage your inventory</p>
          </div>

          {requiresVerification ? (
            <form onSubmit={handleVerify} className="p-8 space-y-6">
              {isSuccess ? (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="p-8 text-center space-y-4"
                >
                  <div className="w-16 h-16 bg-brand/10 text-brand rounded-full flex items-center justify-center mx-auto mb-4">
                    <ShieldCheck className="w-8 h-8" />
                  </div>
                  <h2 className="text-xl font-black text-zinc-900 dark:text-white">Verification Successful!</h2>
                  <p className="text-zinc-500 dark:text-zinc-400 font-medium">
                    Your account has been verified.
                  </p>
                  <div className="pt-4">
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 font-bold uppercase tracking-widest">Redirecting to dashboard...</p>
                    <div className="w-full h-1 bg-zinc-100 dark:bg-zinc-800 rounded-full mt-2 overflow-hidden">
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: '100%' }}
                        transition={{ duration: 2 }}
                        className="h-full bg-brand"
                      />
                    </div>
                  </div>
                </motion.div>
              ) : (
                <>
                  <div className="text-center mb-6">
                    <h2 className="text-xl font-bold text-zinc-900 dark:text-white mb-2">Verify your email</h2>
                    <p className="text-sm text-zinc-500 dark:text-zinc-400">
                      We've sent a 6-digit code to <span className="font-bold text-zinc-900 dark:text-white">{email}</span>
                    </p>
                  </div>

                  {error && (
                    <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-900/30 rounded-2xl text-red-600 dark:text-red-400 text-sm font-medium text-center">
                      {error}
                    </div>
                  )}

                  <div>
                    <label htmlFor="code" className="block text-sm font-bold text-zinc-700 dark:text-zinc-300 mb-2">
                      Verification Code
                    </label>
                    <div className="relative group">
                      <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                        <ShieldCheck className="h-5 w-5 text-zinc-400 group-focus-within:text-brand transition-colors" />
                      </div>
                      <input
                        id="code"
                        name="code"
                        type="text"
                        required
                        value={verificationCode}
                        onChange={(e) => setVerificationCode(e.target.value)}
                        className="block w-full pl-11 pr-4 py-3 border-2 border-zinc-200 dark:border-zinc-800 rounded-2xl bg-zinc-50 dark:bg-zinc-900/50 text-zinc-900 dark:text-white placeholder-zinc-400 focus:ring-0 focus:border-brand transition-all duration-300 font-medium text-center tracking-widest text-lg"
                        placeholder="000000"
                        maxLength={6}
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={isLoading || verificationCode.length !== 6}
                    className="w-full flex justify-center items-center py-3.5 px-4 border border-transparent rounded-2xl shadow-lg shadow-brand/20 text-sm font-bold text-white bg-brand hover:bg-brand-hover focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 active:scale-[0.98]"
                  >
                    {isLoading ? (
                      <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <>
                        Verify Account
                        <ArrowRight className="ml-2 h-5 w-5" />
                      </>
                    )}
                  </button>

                  <div className="text-center mt-4">
                    <button
                      type="button"
                      onClick={handleResendCode}
                      disabled={isLoading}
                      className="text-sm text-brand font-bold hover:underline disabled:opacity-50"
                    >
                      Didn't receive the code? Resend
                    </button>
                  </div>
                </>
              )}
            </form>
          ) : (
            <form onSubmit={handleSubmit} className="p-8 space-y-6">
              {isSuccess ? (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="p-8 text-center space-y-4"
                >
                  <div className="w-16 h-16 bg-brand/10 text-brand rounded-full flex items-center justify-center mx-auto mb-4">
                    <ShieldCheck className="w-8 h-8" />
                  </div>
                  <h2 className="text-xl font-black text-zinc-900 dark:text-white">Registration Successful!</h2>
                  <p className="text-zinc-500 dark:text-zinc-400 font-medium">
                    We've sent a confirmation email to <span className="text-zinc-900 dark:text-white font-bold">{email}</span>.
                  </p>
                  <div className="pt-4">
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 font-bold uppercase tracking-widest">Redirecting to login...</p>
                    <div className="w-full h-1 bg-zinc-100 dark:bg-zinc-800 rounded-full mt-2 overflow-hidden">
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: '100%' }}
                        transition={{ duration: 3 }}
                        className="h-full bg-brand"
                      />
                    </div>
                  </div>
                </motion.div>
              ) : (
                <>
                  {error && (
                    <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-900/30 rounded-2xl text-red-600 dark:text-red-400 text-sm font-medium text-center">
                      {error}
                    </div>
                  )}
                
                  <div className="space-y-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest ml-1">Full Name</label>
                      <div className="relative">
                        <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-400 dark:text-zinc-500" />
                        <input 
                          type="text" 
                          required
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          placeholder="Enter your full name"
                          className="w-full pl-12 pr-4 py-3.5 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-2xl text-sm text-zinc-900 dark:text-white focus:bg-white dark:focus:bg-zinc-800 focus:ring-4 focus:ring-brand/10 focus:border-brand outline-none transition-all"
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest ml-1">Email Address</label>
                      <div className="relative">
                        <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-400 dark:text-zinc-500" />
                        <input 
                          type="email" 
                          required
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder="Enter your email"
                          className="w-full pl-12 pr-4 py-3.5 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-2xl text-sm text-zinc-900 dark:text-white focus:bg-white dark:focus:bg-zinc-800 focus:ring-4 focus:ring-brand/10 focus:border-brand outline-none transition-all"
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest ml-1">Username</label>
                      <div className="relative">
                        <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-400 dark:text-zinc-500" />
                        <input 
                          type="text" 
                          required
                          value={username}
                          onChange={(e) => setUsername(e.target.value)}
                          placeholder="Choose a username"
                          className="w-full pl-12 pr-4 py-3.5 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-2xl text-sm text-zinc-900 dark:text-white focus:bg-white dark:focus:bg-zinc-800 focus:ring-4 focus:ring-brand/10 focus:border-brand outline-none transition-all"
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest ml-1">Password</label>
                      <div className="relative">
                        <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-400 dark:text-zinc-500" />
                        <input 
                          type={showPassword ? "text" : "password"} 
                          required
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder="••••••••"
                          className="w-full pl-12 pr-12 py-3.5 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-2xl text-sm text-zinc-900 dark:text-white focus:bg-white dark:focus:bg-zinc-800 focus:ring-4 focus:ring-brand/10 focus:border-brand outline-none transition-all"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors"
                        >
                          {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                        </button>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest ml-1">Confirm Password</label>
                      <div className="relative">
                        <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-400 dark:text-zinc-500" />
                        <input 
                          type={showPassword ? "text" : "password"} 
                          required
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          placeholder="••••••••"
                          className="w-full pl-12 pr-12 py-3.5 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-2xl text-sm text-zinc-900 dark:text-white focus:bg-white dark:focus:bg-zinc-800 focus:ring-4 focus:ring-brand/10 focus:border-brand outline-none transition-all"
                        />
                      </div>
                    </div>
                  </div>

                <button 
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-4 bg-brand hover:bg-brand-hover disabled:bg-zinc-200 dark:disabled:bg-zinc-800 text-white rounded-2xl font-bold flex items-center justify-center gap-2 transition-all shadow-lg shadow-brand/20 group"
                >
                  {isLoading ? "Creating Account..." : (
                    <>
                      Register
                      <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                    </>
                  )}
                </button>

                <div className="text-center">
                  <p className="text-sm text-zinc-500 dark:text-zinc-400 font-medium">
                    Already have an account? <Link to="/login" className="text-brand font-bold hover:underline">Sign In</Link>
                  </p>
                </div>
              </>
            )}
          </form>
          )}
        </div>
      </motion.div>
    </div>
  );
}
