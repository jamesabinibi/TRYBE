import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Lock, User, ArrowRight, ShieldCheck, Mail, UserPlus, Eye, EyeOff, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../App';
import { cn } from '../lib/utils';

export default function Register() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [name, setName] = useState('');
  const [accountType, setAccountType] = useState<'personal' | 'business'>('personal');
  const [businessType, setBusinessType] = useState('');
  const [referralCode, setReferralCode] = useState('');
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [termsType, setTermsType] = useState<'terms' | 'privacy'>('terms');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const businessTypes = [
    'Retail / Boutique',
    'Food & Beverage / Restaurant',
    'Services (Salon, Spa, etc.)',
    'Wholesale / Distribution',
    'Manufacturing',
    'Technology / Software',
    'Healthcare',
    'Education',
    'Real Estate',
    'Other'
  ];
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
    
    if (!acceptTerms) {
      setError('You must accept the Terms & Conditions and Privacy Policy');
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
          name: name.trim(),
          accountType,
          businessType: accountType === 'business' ? businessType : null,
          referralCode: referralCode.trim()
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
                      <label className="text-xs font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest ml-1">Account Type</label>
                      <div className="grid grid-cols-2 gap-3">
                        <button
                          type="button"
                          onClick={() => setAccountType('personal')}
                          className={cn(
                            "flex flex-col items-center gap-2 p-4 rounded-2xl border-2 transition-all",
                            accountType === 'personal' 
                              ? "border-brand bg-brand/5 text-brand" 
                              : "border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50 text-zinc-500"
                          )}
                        >
                          <User className="w-6 h-6" />
                          <span className="text-xs font-black uppercase tracking-widest">Personal</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setAccountType('business')}
                          className={cn(
                            "flex flex-col items-center gap-2 p-4 rounded-2xl border-2 transition-all",
                            accountType === 'business' 
                              ? "border-brand bg-brand/5 text-brand" 
                              : "border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50 text-zinc-500"
                          )}
                        >
                          <ShieldCheck className="w-6 h-6" />
                          <span className="text-xs font-black uppercase tracking-widest">Business</span>
                        </button>
                      </div>
                    </div>

                    {accountType === 'business' && (
                      <motion.div 
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        className="space-y-1.5"
                      >
                        <label className="text-xs font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest ml-1">Business Type</label>
                        <select
                          required
                          value={businessType}
                          onChange={(e) => setBusinessType(e.target.value)}
                          className="w-full px-4 py-3.5 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-2xl text-sm text-zinc-900 dark:text-white focus:bg-white dark:focus:bg-zinc-800 focus:ring-4 focus:ring-brand/10 focus:border-brand outline-none transition-all appearance-none"
                        >
                          <option value="">Select Business Type</option>
                          {businessTypes.map(type => (
                            <option key={type} value={type}>{type}</option>
                          ))}
                        </select>
                      </motion.div>
                    )}

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
                      <label className="text-xs font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest ml-1">Referral Code (Optional)</label>
                      <div className="relative">
                        <UserPlus className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-400 dark:text-zinc-500" />
                        <input 
                          type="text" 
                          value={referralCode}
                          onChange={(e) => setReferralCode(e.target.value.toUpperCase())}
                          placeholder="Enter referral code"
                          className="w-full pl-12 pr-4 py-3.5 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-2xl text-sm text-zinc-900 dark:text-white focus:bg-white dark:focus:bg-zinc-800 focus:ring-4 focus:ring-brand/10 focus:border-brand outline-none transition-all"
                        />
                      </div>
                    </div>

                    <div className="flex items-start gap-3 px-1">
                      <div className="flex items-center h-5">
                        <input
                          id="terms"
                          name="terms"
                          type="checkbox"
                          checked={acceptTerms}
                          onChange={(e) => setAcceptTerms(e.target.checked)}
                          className="h-4 w-4 text-brand focus:ring-brand border-zinc-300 rounded transition-all"
                        />
                      </div>
                      <div className="text-xs">
                        <label htmlFor="terms" className="font-medium text-zinc-500 dark:text-zinc-400">
                          I agree to the{' '}
                          <button 
                            type="button" 
                            onClick={() => { setTermsType('terms'); setShowTermsModal(true); }}
                            className="text-brand hover:underline font-bold"
                          >
                            Terms & Conditions
                          </button>
                          {' '}and{' '}
                          <button 
                            type="button" 
                            onClick={() => { setTermsType('privacy'); setShowTermsModal(true); }}
                            className="text-brand hover:underline font-bold"
                          >
                            Privacy Policy
                          </button>
                        </label>
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

      {/* Terms Modal */}
      <AnimatePresence>
        {showTermsModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowTermsModal(false)}
              className="absolute inset-0 bg-zinc-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-2xl bg-white dark:bg-zinc-900 rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col max-h-[80vh]"
            >
              <div className="p-8 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between shrink-0">
                <h3 className="font-black text-zinc-900 dark:text-white uppercase tracking-widest text-xs">
                  {termsType === 'terms' ? 'Terms & Conditions' : 'Privacy Policy'}
                </h3>
                <button onClick={() => setShowTermsModal(false)} className="p-2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300">
                  <User className="w-5 h-5" />
                </button>
              </div>
              <div className="p-8 overflow-y-auto custom-scrollbar prose dark:prose-invert max-w-none">
                {termsType === 'terms' ? (
                  <div className="space-y-4 text-sm text-zinc-600 dark:text-zinc-400 font-medium">
                    <h4 className="text-zinc-900 dark:text-white font-black uppercase tracking-widest text-[10px]">1. Acceptance of Terms</h4>
                    <p>By accessing and using Gryndee, you agree to be bound by these Terms and Conditions. If you do not agree to all of these terms, do not use the service.</p>
                    
                    <h4 className="text-zinc-900 dark:text-white font-black uppercase tracking-widest text-[10px]">2. Description of Service</h4>
                    <p>Gryndee provides inventory management, sales tracking, and business analytics tools for small and medium-sized businesses.</p>
                    
                    <h4 className="text-zinc-900 dark:text-white font-black uppercase tracking-widest text-[10px]">3. User Accounts</h4>
                    <p>You are responsible for maintaining the confidentiality of your account credentials and for all activities that occur under your account.</p>
                    
                    <h4 className="text-zinc-900 dark:text-white font-black uppercase tracking-widest text-[10px]">4. Subscription and Payments</h4>
                    <p>Certain features require a paid subscription. All payments are processed securely through our payment partners. Subscriptions renew automatically unless cancelled.</p>
                    
                    <h4 className="text-zinc-900 dark:text-white font-black uppercase tracking-widest text-[10px]">5. Data Ownership</h4>
                    <p>You retain all rights to the data you input into the system. We do not claim ownership of your business data.</p>
                  </div>
                ) : (
                  <div className="space-y-4 text-sm text-zinc-600 dark:text-zinc-400 font-medium">
                    <h4 className="text-zinc-900 dark:text-white font-black uppercase tracking-widest text-[10px]">1. Information We Collect</h4>
                    <p>We collect information you provide directly to us, including your name, email address, and business details when you register for an account.</p>
                    
                    <h4 className="text-zinc-900 dark:text-white font-black uppercase tracking-widest text-[10px]">2. How We Use Your Information</h4>
                    <p>We use your information to provide, maintain, and improve our services, process transactions, and communicate with you.</p>
                    
                    <h4 className="text-zinc-900 dark:text-white font-black uppercase tracking-widest text-[10px]">3. Data Security</h4>
                    <p>We implement reasonable security measures to protect your personal information from unauthorized access, disclosure, or destruction.</p>
                    
                    <h4 className="text-zinc-900 dark:text-white font-black uppercase tracking-widest text-[10px]">4. Third-Party Services</h4>
                    <p>We may use third-party service providers to help us operate our business and the service, such as payment processors and cloud hosting providers.</p>
                  </div>
                )}
              </div>
              <div className="p-8 border-t border-zinc-100 dark:border-zinc-800 shrink-0">
                <button 
                  onClick={() => setShowTermsModal(false)}
                  className="w-full py-4 bg-brand text-white rounded-2xl font-black uppercase tracking-widest text-[10px] hover:bg-brand-hover transition-all shadow-lg shadow-brand/20"
                >
                  Close & Continue
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
