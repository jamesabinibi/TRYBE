import React, { useState, useEffect } from 'react';
import { Wallet, TrendingDown, Calendar, AlertTriangle, ArrowUpRight, ArrowDownRight, Loader2, DollarSign } from 'lucide-react';
import { useAuth, useSettings } from '../App';
import { motion } from 'motion/react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { format, subMonths, startOfMonth, endOfMonth, isWithinInterval } from 'date-fns';
import { cn, NUMBER_STYLE } from '../lib/utils';
import { CurrencyDisplay } from '../components/CurrencyDisplay';
import { Input } from '../components/Input';

export default function CashFlowRunway({ hideHeader = false }: { hideHeader?: boolean }) {
  const { fetchWithAuth } = useAuth();
  const { settings } = useSettings();
  const [loading, setLoading] = useState(true);
  const [sales, setSales] = useState<any[]>([]);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [cashOnHand, setCashOnHand] = useState<number>(0);
  const [isEditingCash, setIsEditingCash] = useState(false);
  const [tempCash, setTempCash] = useState<string>('0');

  const fetchData = async () => {
    setLoading(true);
    try {
      const [salesRes, expensesRes] = await Promise.all([
        fetchWithAuth('/api/sales'),
        fetchWithAuth('/api/expenses')
      ]);

      const salesData = await salesRes.json();
      const expensesData = await expensesRes.json();

      setSales(salesData);
      setExpenses(expensesData);

      // Initial cash on hand calculation (sum of all sales - sum of all expenses)
      const totalSales = salesData.reduce((acc: number, s: any) => acc + Number(s.total_amount), 0);
      const totalExpenses = expensesData.reduce((acc: number, e: any) => acc + Number(e.amount), 0);
      
      const savedCash = localStorage.getItem('gryndee_cash_on_hand');
      if (savedCash) {
        setCashOnHand(Number(savedCash));
        setTempCash(savedCash);
      } else {
        const initialCash = Math.max(0, totalSales - totalExpenses);
        setCashOnHand(initialCash);
        setTempCash(initialCash.toString());
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSaveCash = () => {
    const val = Number(tempCash);
    setCashOnHand(val);
    localStorage.setItem('gryndee_cash_on_hand', val.toString());
    setIsEditingCash(false);
  };

  // Calculate monthly burn rate (average of last 3 months)
  const calculateBurnRate = () => {
    const now = new Date();
    const last3Months = [0, 1, 2].map(i => {
      const start = startOfMonth(subMonths(now, i));
      const end = endOfMonth(subMonths(now, i));
      return expenses.filter(e => {
        const d = new Date(e.date || e.created_at);
        return isWithinInterval(d, { start, end });
      }).reduce((acc, e) => acc + Number(e.amount), 0);
    });

    const avgBurn = last3Months.reduce((acc, b) => acc + b, 0) / 3;
    return avgBurn || 0;
  };

  // Calculate monthly revenue (average of last 3 months)
  const calculateAvgRevenue = () => {
    const now = new Date();
    const last3Months = [0, 1, 2].map(i => {
      const start = startOfMonth(subMonths(now, i));
      const end = endOfMonth(subMonths(now, i));
      return sales.filter(s => {
        const d = new Date(s.created_at);
        return isWithinInterval(d, { start, end });
      }).reduce((acc, s) => acc + Number(s.total_amount), 0);
    });

    const avgRev = last3Months.reduce((acc, r) => acc + r, 0) / 3;
    return avgRev || 0;
  };

  const avgBurn = calculateBurnRate();
  const avgRev = calculateAvgRevenue();
  const netBurn = Math.max(0, avgBurn - avgRev);
  const runwayMonths = netBurn > 0 ? cashOnHand / netBurn : Infinity;

  // Chart data (last 6 months)
  const chartData = [5, 4, 3, 2, 1, 0].map(i => {
    const date = subMonths(new Date(), i);
    const start = startOfMonth(date);
    const end = endOfMonth(date);
    
    const monthlySales = sales.filter(s => isWithinInterval(new Date(s.created_at), { start, end }))
      .reduce((acc, s) => acc + Number(s.total_amount), 0);
    const monthlyExpenses = expenses.filter(e => isWithinInterval(new Date(e.date || e.created_at), { start, end }))
      .reduce((acc, e) => acc + Number(e.amount), 0);

    return {
      name: format(date, 'MMM'),
      revenue: monthlySales,
      expenses: monthlyExpenses,
      profit: monthlySales - monthlyExpenses
    };
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Loader2 className="w-8 h-8 text-brand animate-spin" />
      </div>
    );
  }

  return (
    <div className={`max-w-6xl mx-auto space-y-8 ${hideHeader ? '' : 'pb-20'}`}>
      {!hideHeader && (
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-black text-zinc-950 dark:text-white tracking-tight flex items-center gap-3">
              <Wallet className="w-8 h-8 text-brand" />
              Cash Flow Runway
            </h1>
            <p className="text-zinc-600 dark:text-zinc-400 font-medium">Monitor your business survival time and cash health.</p>
          </div>
          
          <div className="bg-white dark:bg-zinc-900 p-4 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm flex items-center gap-4">
            <div className="space-y-1">
              <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Current Cash on Hand</p>
              {isEditingCash ? (
                <div className="flex items-center gap-2">
                  <Input 
                    type="number"
                    value={tempCash}
                    onChange={(e) => setTempCash(e.target.value)}
                    autoFocus
                  />
                  <button onClick={handleSaveCash} className="text-brand font-black text-[10px] uppercase tracking-widest">Save</button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <p className="text-xl font-black text-zinc-950 dark:text-white">
                    {settings?.currency} {cashOnHand.toLocaleString()}
                  </p>
                  <button onClick={() => setIsEditingCash(true)} className="text-zinc-400 hover:text-brand transition-colors">
                    <DollarSign className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white dark:bg-zinc-900 p-8 rounded-[2.5rem] border border-zinc-200 dark:border-zinc-800 shadow-sm"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-red-50 dark:bg-red-900/10 rounded-2xl text-red-600 dark:text-red-400">
              <TrendingDown className="w-6 h-6" />
            </div>
            <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Avg. Monthly Burn</span>
          </div>
          <h3 className={cn(NUMBER_STYLE, "text-3xl text-zinc-950 dark:text-white")}>
            <CurrencyDisplay amount={avgBurn} currencyCode={settings?.currency} size="xl" />
          </h3>
          <p className="text-xs text-zinc-500 font-medium mt-2">Based on last 3 months of expenses.</p>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white dark:bg-zinc-900 p-8 rounded-[2.5rem] border border-zinc-200 dark:border-zinc-800 shadow-sm"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-emerald-50 dark:bg-emerald-900/10 rounded-2xl text-emerald-600 dark:text-emerald-400">
              <ArrowUpRight className="w-6 h-6" />
            </div>
            <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Avg. Monthly Revenue</span>
          </div>
          <h3 className={cn(NUMBER_STYLE, "text-3xl text-zinc-950 dark:text-white")}>
            <CurrencyDisplay amount={avgRev} currencyCode={settings?.currency} size="xl" />
          </h3>
          <p className="text-xs text-zinc-500 font-medium mt-2">Based on last 3 months of sales.</p>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className={cn(
            "p-8 rounded-[2.5rem] border shadow-xl relative overflow-hidden",
            runwayMonths > 6 
              ? "bg-emerald-600 border-emerald-500 text-white" 
              : runwayMonths > 3 
                ? "bg-amber-500 border-amber-400 text-white"
                : "bg-red-600 border-red-500 text-white"
          )}
        >
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-white/20 rounded-2xl backdrop-blur-sm">
              <Calendar className="w-6 h-6" />
            </div>
            <span className="text-[10px] font-black uppercase tracking-widest opacity-80">Survival Runway</span>
          </div>
          <h3 className="text-4xl font-black">
            {runwayMonths === Infinity ? '∞' : runwayMonths.toFixed(1)} <span className="text-lg">Months</span>
          </h3>
          <p className="text-xs font-medium mt-2 opacity-90">
            {runwayMonths === Infinity 
              ? "Your business is profitable! Revenue covers all expenses." 
              : `At current net burn of ${settings?.currency}${netBurn.toLocaleString()}, you have ${runwayMonths.toFixed(1)} months left.`}
          </p>
          
          {runwayMonths < 3 && (
            <div className="absolute top-4 right-4 animate-pulse">
              <AlertTriangle className="w-6 h-6 text-white" />
            </div>
          )}
        </motion.div>
      </div>

      <div className="bg-white dark:bg-zinc-900 p-8 rounded-[2.5rem] border border-zinc-200 dark:border-zinc-800 shadow-sm">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h3 className="text-lg font-black text-zinc-950 dark:text-white tracking-tight uppercase tracking-widest text-xs">Cash Flow Trends</h3>
            <p className="text-xs text-zinc-500 font-medium">Revenue vs Expenses over the last 6 months.</p>
          </div>
        </div>
        
        <div className="h-[300px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="colorExp" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
              <XAxis 
                dataKey="name" 
                axisLine={false} 
                tickLine={false} 
                tick={{ fontSize: 10, fontWeight: 700, fill: '#9ca3af' }}
                dy={10}
              />
              <YAxis 
                axisLine={false} 
                tickLine={false} 
                tick={{ fontSize: 10, fontWeight: 700, fill: '#9ca3af' }}
                tickFormatter={(val) => `${settings?.currency}${val}`}
              />
              <Tooltip 
                contentStyle={{ 
                  borderRadius: '16px', 
                  border: 'none', 
                  boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
                  fontSize: '12px',
                  fontWeight: '700'
                }}
              />
              <Area type="monotone" dataKey="revenue" stroke="#10b981" fillOpacity={1} fill="url(#colorRev)" strokeWidth={3} />
              <Area type="monotone" dataKey="expenses" stroke="#ef4444" fillOpacity={1} fill="url(#colorExp)" strokeWidth={3} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}


