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
  Gift
} from 'lucide-react';
import { motion } from 'motion/react';
import { useAuth, useSettings } from '../App';
import { toast } from 'sonner';
import { cn, formatCurrency } from '../lib/utils';

export default function Subscription() {
  const { user, fetchWithAuth, refreshUser } = useAuth();
  const { settings, refreshSettings } = useSettings();
  const [isApplyingPromo, setIsApplyingPromo] = useState(false);
  const [promoCode, setPromoCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const currency = settings?.currency || 'NGN';
  const price = 2000;

  useEffect(() => {
    refreshUser();
  }, []);

  const features = [
    { icon: Package, label: 'Unlimited Products', premium: true, free: '20 Products' },
    { icon: FileText, label: 'Unlimited Invoices', premium: true, free: '5 Invoices/mo' },
    { icon: Sparkles, label: 'AI Logo Generator', premium: true, free: false },
    { icon: Zap, label: 'Advanced AI Advisor', premium: true, free: 'Standard AI' },
    { icon: ShieldCheck, label: 'Custom Branding', premium: true, free: 'Gryndee Branding' },
    { icon: Users, label: 'Multi-user Support', premium: true, free: 'Single User' },
    { icon: MessageCircle, label: 'Priority WhatsApp Support', premium: true, free: false },
    { icon: Gift, label: 'Free Business Tax Consultation', premium: true, free: false },
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

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-20">
      <div className="text-center space-y-4">
        <motion.div 
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="inline-flex items-center gap-2 px-4 py-2 bg-brand/10 text-brand rounded-full border border-brand/20"
        >
          <Crown className="w-4 h-4" />
          <span className="text-xs font-black uppercase tracking-widest">Gryndee Professional</span>
        </motion.div>
        <h1 className="text-4xl font-black text-zinc-900 dark:text-white tracking-tight">
          Scale Your Business with <span className="text-brand">Premium</span>
        </h1>
        <p className="text-zinc-500 dark:text-zinc-400 max-w-xl mx-auto">
          Unlock the full power of Gryndee and take your business to the next level with our professional tools.
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-8 items-start">
        {/* Pricing Card */}
        <motion.div 
          initial={{ x: -20, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          className="glass-card p-8 relative overflow-hidden group"
        >
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <Crown className="w-24 h-24 rotate-12" />
          </div>

          <div className="space-y-6">
            <div>
              <h3 className="text-xl font-black text-zinc-900 dark:text-white uppercase tracking-widest">Professional Plan</h3>
              <div className="mt-4 flex items-baseline gap-1">
                <span className="text-4xl font-black text-zinc-900 dark:text-white">{formatCurrency(price, currency)}</span>
                <span className="text-zinc-500 dark:text-zinc-400 font-bold">/month</span>
              </div>
            </div>

            <div className="space-y-4">
              <button 
                onClick={handleUpgrade}
                className="w-full py-4 bg-brand text-white rounded-2xl font-black uppercase tracking-widest text-sm shadow-xl shadow-brand/20 hover:opacity-90 transition-all flex items-center justify-center gap-2"
              >
                Upgrade Now
                <ArrowRight className="w-4 h-4" />
              </button>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-zinc-200 dark:border-zinc-800"></div>
                </div>
                <div className="relative flex justify-center text-xs uppercase tracking-widest">
                  <span className="bg-white dark:bg-[#0A0A0B] px-4 text-zinc-400 font-bold">Or use a promo code</span>
                </div>
              </div>

              <form onSubmit={handleApplyPromo} className="flex gap-2">
                <input 
                  type="text"
                  value={promoCode}
                  onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
                  placeholder="ENTER CODE"
                  className="flex-1 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-3 text-sm font-bold tracking-widest focus:outline-none focus:ring-2 focus:ring-brand/50 transition-all"
                />
                <button 
                  type="submit"
                  disabled={isApplyingPromo || !promoCode.trim()}
                  className="px-6 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 rounded-xl font-bold text-xs uppercase tracking-widest hover:opacity-90 disabled:opacity-50 transition-all flex items-center justify-center"
                >
                  {isApplyingPromo ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Apply'}
                </button>
              </form>
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
          <h3 className="text-xs font-black text-zinc-400 uppercase tracking-widest ml-1">Plan Comparison</h3>
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
                  <div className="text-right">
                    <div className="text-[10px] font-black text-brand uppercase tracking-widest">Premium</div>
                    <div className="text-[11px] font-bold text-zinc-900 dark:text-white">
                      {feature.premium === true ? <Check className="w-4 h-4 ml-auto" /> : feature.premium}
                    </div>
                  </div>
                  <div className="w-px h-8 bg-zinc-200 dark:bg-zinc-800" />
                  <div className="text-right min-w-[80px]">
                    <div className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Free</div>
                    <div className="text-[11px] font-bold text-zinc-500">
                      {feature.free === false ? 'No' : feature.free}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      </div>

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
          <h2 className="text-2xl font-black text-zinc-900 dark:text-white tracking-tight">Want it for Free?</h2>
          <div className="flex flex-col md:flex-row justify-center gap-4 text-sm">
            <div className="bg-white dark:bg-zinc-900/50 p-4 rounded-2xl border border-brand/10 flex-1">
              <p className="text-brand font-black uppercase tracking-widest text-[10px] mb-1">Reward 1</p>
              <p className="text-zinc-700 dark:text-zinc-300 font-bold">1 Month Free Pro</p>
              <p className="text-zinc-500 text-xs">For every 3 successful referrals</p>
            </div>
            <div className="bg-white dark:bg-zinc-900/50 p-4 rounded-2xl border border-brand/10 flex-1">
              <p className="text-brand font-black uppercase tracking-widest text-[10px] mb-1">Reward 2</p>
              <p className="text-zinc-700 dark:text-zinc-300 font-bold">10% Renewal Discount</p>
              <p className="text-zinc-500 text-xs">For every active referral</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 max-w-2xl mx-auto">
          <div className="p-4 bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-100 dark:border-zinc-800">
            <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-1">Total Referrals</p>
            <p className="text-xl font-black text-zinc-900 dark:text-white">{user?.referral_count || 0}</p>
          </div>
          <div className="p-4 bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-100 dark:border-zinc-800">
            <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-1">Active Referrals</p>
            <p className="text-xl font-black text-brand">{user?.active_referral_count || 0}</p>
          </div>
          <div className="p-4 bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-100 dark:border-zinc-800 col-span-2 md:col-span-1">
            <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-1">Next Reward In</p>
            <p className="text-xl font-black text-zinc-900 dark:text-white">{3 - (user?.referrals_for_reward || 0)} <span className="text-xs font-bold text-zinc-400">Referrals</span></p>
          </div>
        </div>

        <div className="flex flex-col items-center gap-4">
          <div className="px-6 py-3 bg-white dark:bg-zinc-900 rounded-2xl border border-brand/20 shadow-sm inline-flex items-center gap-4">
            <span className="text-xs font-black uppercase tracking-widest text-zinc-400">Your Referral Code:</span>
            <span className="text-lg font-black text-brand tracking-widest uppercase">{user?.referral_code}</span>
          </div>
          <button 
            onClick={() => {
              navigator.clipboard.writeText(user?.referral_code || '');
              toast.success('Referral code copied!');
            }}
            className="text-xs font-black text-brand uppercase tracking-widest hover:underline"
          >
            Copy & Share
          </button>
        </div>
      </motion.div>
    </div>
  );
}
