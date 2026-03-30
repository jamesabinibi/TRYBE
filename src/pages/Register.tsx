import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Lock, User, ArrowRight, ShieldCheck, Mail, UserPlus, Eye, EyeOff, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';
import { useAuth } from '../App';
import { cn } from '../lib/utils';
import { Input } from '../components/Input';

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
    'Agriculture', 'Auto / Parts', 'Bakery', 'Beauty (make Up)', 'Catering', 'Clothing', 
    'Computer Services', 'Construction', 'Consulting', 'Cosmetics', 'Dairy Products', 
    'Education', 'Electronics', 'Entertainment', 'Fashion', 'Financial Services', 
    'Fishing', 'Food & Beverages', 'Footwear', 'Fruits & Vegetables', 'Furniture', 
    'Gift & Toys', 'Grocery', 'Hotel', 'Information Technology', 'Jewelry', 
    'Kitchen Utensils', 'Laundry', 'Legal Services', 'Maintenance Services', 
    'Medical & Healthcare', 'Mobile & Accessories', 'Non Profit', 'Nursery', 'Online', 
    'Others', 'Personal', 'Petroleum', 'Pet Stores', 'Photo Studio', 'Poultry', 
    'Printing', 'Restaurant & Cafe', 'Security Services', 'Sports & Fitness', 
    'Stationery', 'Street Foods', 'Textiles', 'Tours & Travel', 'Transportation', 
    'Veterinary', 'Waste Collection'
  ];
  const [isSuccess, setIsSuccess] = useState(false);
  const [requiresVerification, setRequiresVerification] = useState(false);
  const [verificationCode, setVerificationCode] = useState('');

  const [legalDocs, setLegalDocs] = useState({ terms_and_conditions: '', privacy_policy: '' });

  useEffect(() => {
    const fetchLegalDocs = async () => {
      try {
        const response = await fetch(`/api/legal-docs?t=${Date.now()}`);
        if (response.ok) {
          const data = await response.json();
          setLegalDocs(data);
        }
      } catch (error) {
        console.error('Failed to fetch legal docs:', error);
      }
    };
    fetchLegalDocs();
  }, []);

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
      toast.error('You must accept the Terms & Conditions and Privacy Policy');
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
        className="sm:mx-auto sm:w-full sm:max-w-lg my-auto"
      >
        <div className="bg-white dark:bg-zinc-900 rounded-[32px] shadow-2xl shadow-zinc-200/50 dark:shadow-black/50 border border-zinc-200 dark:border-zinc-800 overflow-hidden transition-colors duration-500">
          <div className="p-6 pt-8 text-center">
            <div className="w-12 h-12 bg-brand rounded-2xl flex items-center justify-center text-white mx-auto mb-3 shadow-lg shadow-brand/20 rotate-3">
              <UserPlus className="w-6 h-6" />
            </div>
            <h1 className="h1 mb-1">Create Account</h1>
            <p className="body-text text-xs font-medium">Join Gryndee to manage your business</p>
          </div>

          {requiresVerification ? (
            <form onSubmit={handleVerify} className="p-6 sm:p-8 space-y-5">
              {isSuccess ? (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="p-8 text-center space-y-4"
                >
                  <div className="w-16 h-16 bg-brand/10 text-brand rounded-full flex items-center justify-center mx-auto mb-4">
                    <ShieldCheck className="w-8 h-8" />
                  </div>
                  <h2 className="h2">Verification Successful!</h2>
                  <p className="body-text">
                    Your account has been verified.
                  </p>
                  <div className="pt-4">
                    <p className="label-text">Redirecting to dashboard...</p>
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
                    <h2 className="h2 mb-2">Verify your email</h2>
                    <p className="body-text">
                      We've sent a 6-digit code to <span className="font-medium text-zinc-900 dark:text-white">{email}</span>
                    </p>
                  </div>

                  {error && (
                    <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-900/30 rounded-2xl text-red-600 dark:text-red-400 text-sm font-medium text-center">
                      {error}
                    </div>
                  )}

                  <div>
                    <label htmlFor="code" className="label-text block mb-2">
                      Verification Code
                    </label>
                    <div className="relative group">
                      <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                        <ShieldCheck className="h-5 w-5 text-zinc-400 group-focus-within:text-brand transition-colors" />
                      </div>
                      <Input
                        id="code"
                        name="code"
                        type="text"
                        required
                        value={verificationCode}
                        onChange={(e) => setVerificationCode(e.target.value)}
                        className="pl-11 text-center tracking-widest text-lg font-light"
                        placeholder="000000"
                        maxLength={6}
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={isLoading || verificationCode.length !== 6}
                    className="w-full flex justify-center items-center py-3 px-4 border border-transparent rounded-2xl shadow-lg shadow-brand/20 text-sm font-medium text-white bg-brand hover:bg-brand-hover focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 active:scale-[0.98]"
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
                      className="text-sm text-brand font-medium hover:underline disabled:opacity-50"
                    >
                      Didn't receive the code? Resend
                    </button>
                  </div>
                </>
              )}
            </form>
          ) : (
            <form onSubmit={handleSubmit} className="p-6 sm:p-8 space-y-5">
              {isSuccess ? (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="p-8 text-center space-y-4"
                >
                  <div className="w-16 h-16 bg-brand/10 text-brand rounded-full flex items-center justify-center mx-auto mb-4">
                    <ShieldCheck className="w-8 h-8" />
                  </div>
                  <h2 className="h2">Registration Successful!</h2>
                  <p className="body-text">
                    We've sent a confirmation email to <span className="text-zinc-900 dark:text-white font-medium">{email}</span>.
                  </p>
                  <div className="pt-4">
                    <p className="label-text">Redirecting to login...</p>
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
                      <label className="label-text ml-1">Account Type</label>
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
                          <span className="text-[10px] font-medium uppercase tracking-widest">Personal</span>
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
                          <span className="text-[10px] font-medium uppercase tracking-widest">Business</span>
                        </button>
                      </div>
                    </div>

                    {accountType === 'business' && (
                      <motion.div 
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        className="space-y-1.5"
                      >
                        <label className="label-text ml-1">Business Type</label>
                        <Input
                          as="select"
                          required
                          value={businessType}
                          onChange={(e) => setBusinessType(e.target.value)}
                          className="font-light"
                        >
                          <option value="">Select Business Type</option>
                          {businessTypes.map(type => (
                            <option key={type} value={type}>{type}</option>
                          ))}
                        </Input>
                      </motion.div>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="label-text ml-1">Full Name</label>
                        <div className="relative">
                          <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 dark:text-zinc-500" />
                          <Input 
                            type="text" 
                            required
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="Full Name"
                            className="pl-11 font-light"
                          />
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <label className="label-text ml-1">Email Address</label>
                        <div className="relative">
                          <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 dark:text-zinc-500" />
                          <Input 
                            type="email" 
                            required
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="Email"
                            className="pl-11 font-light"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="label-text ml-1">Username</label>
                        <div className="relative">
                          <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 dark:text-zinc-500" />
                          <Input 
                            type="text" 
                            required
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            placeholder="Username"
                            className="pl-11 font-light"
                          />
                        </div>
                      </div>

                      <div className="space-y-1.5">
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

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="label-text ml-1">Confirm Password</label>
                        <div className="relative">
                          <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 dark:text-zinc-500" />
                          <Input 
                            type={showPassword ? "text" : "password"} 
                            required
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            placeholder="••••••••"
                            className="pl-11 pr-11 font-light"
                          />
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <label className="label-text ml-1">Referral Code</label>
                        <div className="relative">
                          <UserPlus className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 dark:text-zinc-500" />
                          <Input 
                            type="text" 
                            value={referralCode}
                            onChange={(e) => setReferralCode(e.target.value.toUpperCase())}
                            placeholder="Optional"
                            className="pl-11 font-light"
                          />
                        </div>
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
                        <label htmlFor="terms" className="body-text">
                          I agree to the{' '}
                          <button 
                            type="button" 
                            onClick={() => { setTermsType('terms'); setShowTermsModal(true); }}
                            className="text-brand hover:underline font-medium"
                          >
                            Terms & Conditions
                          </button>
                          {' '}and{' '}
                          <button 
                            type="button" 
                            onClick={() => { setTermsType('privacy'); setShowTermsModal(true); }}
                            className="text-brand hover:underline font-medium"
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
                  className="w-full py-3 bg-brand hover:bg-brand-hover disabled:bg-zinc-200 dark:disabled:bg-zinc-800 text-white rounded-2xl font-medium flex items-center justify-center gap-2 transition-all shadow-lg shadow-brand/20 group"
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
                    Already have an account? <Link to="/login" className="text-brand font-medium hover:underline">Sign In</Link>
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
                <h3 className="label-text">
                  {termsType === 'terms' ? 'Terms & Conditions' : 'Privacy Policy'}
                </h3>
                <button onClick={() => setShowTermsModal(false)} className="p-2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-8 overflow-y-auto custom-scrollbar prose dark:prose-invert max-w-none">
                {termsType === 'terms' ? (
                  <div 
                    className="space-y-4 text-sm text-zinc-600 dark:text-zinc-400 font-light"
                    dangerouslySetInnerHTML={{ __html: legalDocs.terms_and_conditions || `
                      <h4 class="label-text">1. Acceptance of Terms</h4>
                      <p>By accessing and using Gryndee, you agree to be bound by these Terms and Conditions. If you do not agree to all of these terms, do not use the service.</p>
                      
                      <h4 class="label-text">2. Description of Service</h4>
                      <p>Gryndee provides inventory management, sales tracking, and business analytics tools for small and medium-sized businesses.</p>
                      
                      <h4 class="label-text">3. User Accounts</h4>
                      <p>You are responsible for maintaining the confidentiality of your account credentials and for all activities that occur under your account.</p>
                      
                      <h4 class="label-text">4. Subscription and Payments</h4>
                      <p>Certain features require a paid subscription. All payments are processed securely through our payment partners. Subscriptions renew automatically unless cancelled.</p>
                      
                      <h4 class="label-text">5. Data Ownership</h4>
                      <p>You retain all rights to the data you input into the system. We do not claim ownership of your business data.</p>
                    ` }}
                  />
                ) : (
                  <div 
                    className="space-y-4 text-sm text-zinc-600 dark:text-zinc-400 font-light"
                    dangerouslySetInnerHTML={{ __html: legalDocs.privacy_policy || `
                      <h4 class="label-text">1. Information We Collect</h4>
                      <p>We collect information you provide directly to us, including your name, email address, and business details when you register for an account.</p>
                      
                      <h4 class="label-text">2. How We Use Your Information</h4>
                      <p>We use your information to provide, maintain, and improve our services, process transactions, and communicate with you.</p>
                      
                      <h4 class="label-text">3. Data Security</h4>
                      <p>We implement reasonable security measures to protect your personal information from unauthorized access, disclosure, or destruction.</p>
                      
                      <h4 class="label-text">4. Third-Party Services</h4>
                      <p>We may use third-party service providers to help us operate our business and the service, such as payment processors and cloud hosting providers.</p>
                    ` }}
                  />
                )}
              </div>
              <div className="p-8 border-t border-zinc-100 dark:border-zinc-800 shrink-0">
                <button 
                  onClick={() => setShowTermsModal(false)}
                  className="w-full py-3 bg-brand text-white rounded-2xl label-text hover:bg-brand-hover transition-all shadow-lg shadow-brand/20"
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
