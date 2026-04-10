import React, { useState, useEffect } from 'react';
import { 
  Crown, 
  Check, 
  ShieldCheck, 
  Zap, 
  Sparkles, 
  Users, 
  FileText, 
  Package, 
  MessageCircle,
  ArrowRight,
  Loader2,
  Gift,
  X
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth, useSettings } from '../App';
import { toast } from 'sonner';
import { cn, formatCurrency } from '../lib/utils';

export default function Subscription() {
  const { user, fetchWithAuth, refreshUser } = useAuth();
  const { settings, refreshSettings } = useSettings();
  const [isApplyingPromo, setIsApplyingPromo] = useState(false);
  const [promoCode, setPromoCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isPromoModalOpen, setIsPromoModalOpen] = useState(false);

  const currency = settings?.currency || 'NGN';
  const price = 2000;

  useEffect(() => {
    refreshUser();
  }, []);

  const features = [
    { icon: Package, label: 'Unlimited Products', pro: true, regular: '20 Products' },
    { icon: FileText, label: 'Unlimited Invoices', pro: true, regular: '5 Invoices/mo' },
    { icon: Sparkles, label: 'AI Logo Generator', pro: true, regular: false },
    { icon: Zap, label: 'Advanced AI Advisor', pro: true, regular: 'Standard AI' },
    { icon: ShieldCheck, label: 'Custom Branding', pro: true, regular: 'Gryndee Branding' },
    { icon: Users, label: 'Multi-user Support', pro: true, regular: 'Single User' },
    { icon: MessageCircle, label: 'Priority WhatsApp Support', pro: true, regular: false },
    { icon: Gift, label: 'Free Business Tax Consultation', pro: true, regular: false },
  ];

  const handleApplyPromo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!promoCode.trim()) return;

    setIsApplyingPromo(true);
    try {
      const res = await fetchWithAuth('/api/subscription/apply-promo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: promoCode.trim() })
      });

      if (res.ok) {
        toast.success('Promo code applied successfully! Your subscription has been updated.');
        setPromoCode('');
        setIsPromoModalOpen(false);
        refreshSettings();
        // Refresh user state globally
        await refreshUser();
      } else {
        const data = await res.json();
        toast.error(data.error || 'Invalid promo code');
      }
    } catch (error) {
      toast.error('Failed to apply promo code');
    } finally {
      setIsApplyingPromo(false);
    }
  };

  const handleUpgrade = () => {
    // In a real app, this would trigger Paystack/Flutterwave
    toast.info('Payment integration coming soon! Use a promo code for now.');
  };

  const isPro = user?.subscription_plan === 'pro';

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-20">
      <div className="text-center space-y-4">
        <motion.div 
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className={cn(
            "inline-flex items-center gap-2 px-4 py-2 rounded-full border transition-all",
            isPro 
              ? "bg-green-500/10 text-green-500 border-green-500/20" 
              : "bg-brand/10 text-brand rounded-full border border-brand/20"
          )}
        >
          {isPro ? <ShieldCheck className="w-4 h-4" /> : <Crown className="w-4 h-4" />}
          <span className="label-text font-bold uppercase tracking-widest text-[10px]">
            {isPro ? 'Active Pro Subscription' : 'Gryndee Pro'}
          </span>
        </motion.div>
        <h1 className="h1">
          {isPro ? (
            <>You're a <span className="text-brand">Pro</span> Member</>
          ) : (
            <>Scale Your Business with <span className="text-brand">Pro</span></>
          )}
        </h1>
        <p className="body-text max-w-xl mx-auto">
          {isPro 
            ? "You have full access to all Pro features. Manage your subscription or explore your tools below."
            : "Unlock the full power of Gryndee and take your business to the next level with our Pro tools."
          }
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-8 items-start">
        {/* Pricing Card */}
        <motion.div 
          initial={{ x: -20, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          className={cn(
            "glass-card p-8 relative overflow-hidden group",
            isPro && "ring-2 ring-brand ring-offset-4 dark:ring-offset-[#050505]"
          )}
        >
          {isPro && (
            <div className="absolute top-0 left-0 bg-brand text-white px-4 py-1 text-[10px] font-bold uppercase tracking-widest rounded-br-xl z-10">
              Current Plan
            </div>
          )}
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <Crown className="w-24 h-24 rotate-12" />
          </div>

          <div className="space-y-6">
            <div>
              <h3 className="h3 uppercase tracking-widest">Pro Plan</h3>
              <div className="mt-4 flex items-baseline gap-1">
                <span className="text-4xl font-medium text-zinc-900 dark:text-white">{formatCurrency(price, currency)}</span>
                <span className="text-zinc-500 dark:text-zinc-400 font-medium">/month</span>
              </div>
            </div>

            {isPro && (user?.last_payment_date || user?.trial_expiry) && (
              <div className="p-4 bg-zinc-50 dark:bg-zinc-800/50 rounded-xl space-y-2 border border-zinc-100 dark:border-zinc-800 relative z-10">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-zinc-500">Started:</span>
                  <span className="font-medium text-zinc-900 dark:text-white">
                    {user.last_payment_date ? new Date(user.last_payment_date).toLocaleDateString() : 'N/A'}
                  </span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-zinc-500">Expires:</span>
                  <span className="font-medium text-zinc-900 dark:text-white">
                    {user.trial_expiry ? new Date(user.trial_expiry).toLocaleDateString() : 
                     user.last_payment_date ? new Date(new Date(user.last_payment_date).setMonth(new Date(user.last_payment_date).getMonth() + 1)).toLocaleDateString() : 'N/A'}
                  </span>
                </div>
              </div>
            )}

            <div className="space-y-4 relative z-10">
              <button 
                onClick={handleUpgrade}
                disabled={isPro}
                className={cn(
                  "w-full py-4 text-base flex items-center justify-center gap-2 rounded-2xl font-bold uppercase tracking-widest transition-all",
                  isPro 
                    ? "bg-zinc-100 dark:bg-zinc-800 text-zinc-400 cursor-default" 
                    : "bg-brand text-white shadow-xl shadow-brand/20 hover:opacity-90"
                )}
              >
                {isPro ? (
                  <>
                    <Check className="w-5 h-5" />
                    Active Plan
                  </>
                ) : (
                  <>
                    Upgrade Now
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>

              {!isPro && (
                <>
                  <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-zinc-200 dark:border-zinc-800"></div>
                    </div>
                    <div className="relative flex justify-center text-xs uppercase tracking-widest">
                      <span className="bg-white dark:bg-[#0A0A0B] px-4 text-zinc-400 font-bold">Or</span>
                    </div>
                  </div>

                  <button 
                    onClick={() => setIsPromoModalOpen(true)}
                    className="w-full py-3 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl text-zinc-600 dark:text-zinc-400 font-bold text-xs uppercase tracking-widest hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-all flex items-center justify-center gap-2"
                  >
                    <Gift className="w-4 h-4" />
                    Have a promo code?
                  </button>
                </>
              )}
            </div>

            <div className="pt-6 border-t border-zinc-100 dark:border-zinc-800/50">
              <div className="flex items-center gap-3 text-zinc-600 dark:text-zinc-400">
                <ShieldCheck className="w-5 h-5 text-brand" />
                <span className="text-xs font-bold">Secure Payment via Paystack</span>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Features Comparison */}
        <motion.div 
          initial={{ x: 20, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          className="space-y-6"
        >
          <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-widest ml-1">Plan Comparison</h3>
          <div className="space-y-3">
            {features.map((feature, idx) => (
              <div 
                key={idx}
                className="flex items-center justify-between p-4 bg-zinc-50 dark:bg-zinc-900/50 rounded-2xl border border-zinc-100 dark:border-zinc-800/50"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-brand/10 flex items-center justify-center text-brand">
                    <feature.icon className="w-4 h-4" />
                  </div>
                  <span className="text-[13px] font-bold text-zinc-700 dark:text-zinc-300">{feature.label}</span>
                </div>
                <div className="flex items-center gap-4">
                  <div className={cn("text-right", isPro && "text-brand")}>
                    <div className="text-[10px] font-bold uppercase tracking-widest">Pro</div>
                    <div className={cn("text-[11px] font-bold", isPro ? "text-brand" : "text-zinc-900 dark:text-white")}>
                      {feature.pro === true ? <Check className="w-4 h-4 ml-auto" /> : feature.pro}
                    </div>
                  </div>
                  <div className="w-px h-8 bg-zinc-200 dark:bg-zinc-800" />
                  <div className="text-right min-w-[80px]">
                    <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Regular</div>
                    <div className="text-[11px] font-bold text-zinc-500">
                      {feature.regular === false ? 'No' : feature.regular}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      </div>

      {/* Promo Code Modal */}
      <AnimatePresence>
        {isPromoModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsPromoModalOpen(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-sm bg-white dark:bg-zinc-900 rounded-[2.5rem] shadow-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden"
            >
              <button 
                onClick={() => setIsPromoModalOpen(false)}
                className="absolute top-6 right-6 p-2 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors text-zinc-400 hover:text-zinc-900 dark:hover:text-white z-10"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="p-8 space-y-6">
                <div className="text-center space-y-2">
                  <div className="w-16 h-16 bg-brand/10 rounded-3xl flex items-center justify-center text-brand mx-auto mb-4">
                    <Gift className="w-8 h-8" />
                  </div>
                  <h2 className="text-2xl font-bold text-zinc-900 dark:text-white tracking-tight uppercase">Redeem Code</h2>
                  <p className="text-zinc-500 text-xs font-bold uppercase tracking-widest">Enter your promo code below</p>
                </div>

                <form onSubmit={handleApplyPromo} className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 ml-1">Promo Code</label>
                    <input 
                      type="text"
                      autoFocus
                      value={promoCode}
                      onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
                      placeholder="E.G. GRYNDEE30"
                      className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-2xl px-6 py-4 text-lg font-bold tracking-widest text-center focus:outline-none focus:ring-2 focus:ring-brand/50 transition-all uppercase"
                    />
                  </div>
                  <button 
                    type="submit"
                    disabled={isApplyingPromo || !promoCode.trim()}
                    className="w-full py-4 bg-brand text-white rounded-2xl font-bold uppercase tracking-widest text-sm shadow-xl shadow-brand/20 hover:opacity-90 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
                  >
                    {isApplyingPromo ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Apply Code'}
                  </button>
                  <button 
                    type="button"
                    onClick={() => setIsPromoModalOpen(false)}
                    className="w-full py-3 text-zinc-400 font-bold text-[10px] uppercase tracking-widest hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors"
                  >
                    Cancel
                  </button>
                </form>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Referral Info Section */}
      <motion.div 
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="bg-brand/5 border border-brand/10 rounded-3xl p-8 text-center space-y-6"
      >
        <div className="w-16 h-16 bg-brand/20 rounded-2xl flex items-center justify-center text-brand mx-auto">
          <Gift className="w-8 h-8" />
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl font-bold text-zinc-900 dark:text-white tracking-tight">Want it for Free?</h2>
          <div className="flex flex-col md:flex-row justify-center gap-4 text-sm">
            <div className="bg-white dark:bg-zinc-900/50 p-4 rounded-2xl border border-brand/10 flex-1">
              <p className="text-brand font-bold uppercase tracking-widest text-[10px] mb-1">Reward 1</p>
              <p className="text-zinc-700 dark:text-zinc-300 font-bold">1 Month Free Pro</p>
              <p className="text-zinc-500 text-xs">For every 3 successful referrals</p>
            </div>
            <div className="bg-white dark:bg-zinc-900/50 p-4 rounded-2xl border border-brand/10 flex-1">
              <p className="text-brand font-bold uppercase tracking-widest text-[10px] mb-1">Reward 2</p>
              <p className="text-zinc-700 dark:text-zinc-300 font-bold">10% Renewal Discount</p>
              <p className="text-zinc-500 text-xs">For every active referral</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 max-w-2xl mx-auto">
          <div className="p-4 bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-100 dark:border-zinc-800">
            <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1">Total Referrals</p>
            <p className="text-xl font-bold text-zinc-900 dark:text-white">{user?.referral_count || 0}</p>
          </div>
          <div className="p-4 bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-100 dark:border-zinc-800">
            <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1">Active Referrals</p>
            <p className="text-xl font-bold text-brand">{user?.active_referral_count || 0}</p>
          </div>
          <div className="p-4 bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-100 dark:border-zinc-800 col-span-2 md:col-span-1">
            <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1">Next Reward In</p>
            <p className="text-xl font-bold text-zinc-900 dark:text-white">{3 - ((user?.referral_count || 0) % 3)} <span className="text-xs font-bold text-zinc-400">Referrals</span></p>
            <p className="text-[9px] font-bold text-brand uppercase tracking-widest mt-1">For 1 Month Free Pro</p>
          </div>
        </div>

        <div className="flex flex-col items-center gap-4">
          <div className="px-6 py-3 bg-white dark:bg-zinc-900 rounded-2xl border border-brand/20 shadow-sm inline-flex items-center gap-4">
            <span className="text-xs font-bold uppercase tracking-widest text-zinc-400">Your Referral Code:</span>
            <span className="text-lg font-bold text-brand tracking-widest uppercase">{user?.referral_code}</span>
          </div>
          <button 
            onClick={() => {
              navigator.clipboard.writeText(user?.referral_code || '');
              toast.success('Referral code copied!');
            }}
            className="text-xs font-bold text-brand uppercase tracking-widest hover:underline"
          >
            Copy & Share
          </button>
        </div>
      </motion.div>
    </div>
  );
}
