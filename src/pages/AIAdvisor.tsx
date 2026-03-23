import React, { useState, useEffect } from 'react';
import { Brain, Sparkles, TrendingUp, AlertCircle, Lightbulb, Loader2, Target, Package, DollarSign } from 'lucide-react';
import { useAuth, useSettings } from '../App';
import { GoogleGenAI } from "@google/genai";
import { motion, AnimatePresence } from 'motion/react';
import Markdown from 'react-markdown';
import { formatCurrency } from '../lib/utils';

export default function AIAdvisor() {
  const { fetchWithAuth } = useAuth();
  const { settings } = useSettings();
  const currency = settings?.currency || 'NGN';
  
  const [activeTab, setActiveTab] = useState<'pulse' | 'forecast'>('pulse');
  
  // Pulse State
  const [loadingPulse, setLoadingPulse] = useState(false);
  const [insight, setInsight] = useState<string | null>(null);
  const [data, setData] = useState<any>(null);

  // Forecast State
  const [loadingForecast, setLoadingForecast] = useState(false);
  const [forecast, setForecast] = useState<any>(null);

  const fetchBusinessData = async () => {
    setLoadingPulse(true);
    try {
      const [salesRes, expensesRes, productsRes] = await Promise.all([
        fetchWithAuth('/api/sales'),
        fetchWithAuth('/api/expenses'),
        fetchWithAuth('/api/products')
      ]);

      const sales = await salesRes.json();
      const expenses = await expensesRes.json();
      const products = await productsRes.json();

      const businessData = {
        sales: sales.slice(0, 50), // Last 50 sales
        expenses: expenses.slice(0, 50), // Last 50 expenses
        inventory: products.map((p: any) => ({
          name: p.name,
          quantity: p.quantity,
          selling_price: p.selling_price,
          cost_price: p.cost_price
        }))
      };

      setData(businessData);
      generateInsight(businessData);
    } catch (error) {
      console.error('Error fetching business data:', error);
      setLoadingPulse(false);
    }
  };

  const generateInsight = async (businessData: any) => {
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY as string });
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `You are Gryndee AI, a proactive business partner for an entrepreneur. 
        Look at the user's products/services in their inventory to understand their specific niche.
        
        Provide 3-4 SHORT, punchy, and highly personalized business tips based specifically on what they sell.
        Vary your advice every time. Focus on areas like:
        - Optimal price points and profit margins for their specific products.
        - Marketing strategies (e.g., Facebook/Instagram ads, TikTok, local SEO) tailored to their niche.
        - Upselling or bundling opportunities based on their catalog.

        If the data arrays are empty, give them 3 quick, high-impact tips on how to choose their first product and start marketing. Do NOT say the data was "left blank".

        Business Data:
        Sales: ${JSON.stringify(businessData.sales)}
        Expenses: ${JSON.stringify(businessData.expenses)}
        Inventory: ${JSON.stringify(businessData.inventory)}
        
        Random Seed to ensure fresh advice: ${Math.random()}

        Format your response in Markdown with clear headings (use ## or ###), bullet points, and bold text for emphasis. 
        Keep the tone encouraging, direct, and professional. No fluff.`
      });

      setInsight(response.text || "I couldn't generate insights at this moment. Please try again later.");
    } catch (error) {
      console.error('Error generating AI insight:', error);
      setInsight("Error connecting to AI Advisor. Please ensure your API key is configured.");
    } finally {
      setLoadingPulse(false);
    }
  };

  const generateForecast = async () => {
    setLoadingForecast(true);
    try {
      const response = await fetchWithAuth('/api/ai/forecast', { method: 'POST' });
      const data = await response.json();
      if (response.ok) {
        setForecast(data);
      } else {
        console.error('Forecast error:', data.error);
      }
    } catch (error) {
      console.error('Error fetching forecast:', error);
    } finally {
      setLoadingForecast(false);
    }
  };

  useEffect(() => {
    fetchBusinessData();
    generateForecast();
  }, []);

  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-zinc-950 dark:text-white tracking-tight flex items-center gap-3">
            <Brain className="w-8 h-8 text-brand" />
            AI Intelligence Hub
          </h1>
          <p className="text-zinc-600 dark:text-zinc-400 font-medium">Your proactive business partner, powered by Gemini AI.</p>
        </div>
        
        <div className="flex overflow-x-auto custom-scrollbar gap-2 p-1 bg-zinc-100 dark:bg-zinc-800/50 rounded-2xl border border-zinc-200 dark:border-zinc-800 w-full md:w-fit">
          <button
            onClick={() => setActiveTab('pulse')}
            className={`flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold transition-all whitespace-nowrap ${
              activeTab === 'pulse'
                ? 'bg-white dark:bg-zinc-900 text-brand shadow-sm border border-zinc-200 dark:border-zinc-700'
                : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-200/50 dark:hover:bg-zinc-800'
            }`}
          >
            <Sparkles className="w-4 h-4" />
            Business Pulse
          </button>
          <button
            onClick={() => setActiveTab('forecast')}
            className={`flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold transition-all whitespace-nowrap ${
              activeTab === 'forecast'
                ? 'bg-white dark:bg-zinc-900 text-brand shadow-sm border border-zinc-200 dark:border-zinc-700'
                : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-200/50 dark:hover:bg-zinc-800'
            }`}
          >
            <Target className="w-4 h-4" />
            Strategic Forecast
          </button>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {activeTab === 'pulse' && (
          <motion.div
            key="pulse"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="space-y-8"
          >
            <div className="flex justify-end">
              <button 
                onClick={fetchBusinessData}
                disabled={loadingPulse}
                className="px-6 py-3 bg-brand text-white rounded-2xl text-sm font-black uppercase tracking-widest hover:bg-brand-hover transition-all shadow-lg shadow-brand/20 active:scale-95 disabled:opacity-50 flex items-center gap-2"
              >
                {loadingPulse ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                Refresh Pulse
              </button>
            </div>

            {loadingPulse && !insight ? (
              <div className="flex flex-col items-center justify-center py-20 space-y-4">
                <div className="relative">
                  <div className="w-16 h-16 border-4 border-brand/20 border-t-brand rounded-full animate-spin" />
                  <Brain className="w-8 h-8 text-brand absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 animate-pulse" />
                </div>
                <p className="text-zinc-500 font-bold uppercase tracking-widest text-xs">Analyzing your business pulse...</p>
              </div>
            ) : (
              <div className="bg-white dark:bg-zinc-900 rounded-[2.5rem] border border-zinc-200 dark:border-zinc-800 shadow-xl overflow-hidden">
                <div className="p-8 sm:p-12">
                  <div className="prose prose-sm sm:prose-base prose-zinc dark:prose-invert max-w-none">
                    {insight ? (
                      <div className="markdown-body">
                        <Markdown>{insight}</Markdown>
                      </div>
                    ) : (
                      <p className="text-center text-zinc-500 italic">No insights generated yet.</p>
                    )}
                  </div>
                </div>
                
                <div className="bg-zinc-50 dark:bg-zinc-800/50 p-6 border-t border-zinc-100 dark:border-zinc-800">
                  <div className="flex items-center gap-4 text-zinc-500 dark:text-zinc-400">
                    <Lightbulb className="w-5 h-5 text-brand shrink-0" />
                    <p className="text-xs font-medium italic">
                      Tip: These insights are based on your most recent 50 transactions and current inventory levels.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </motion.div>
        )}

        {activeTab === 'forecast' && (
          <motion.div
            key="forecast"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="space-y-8"
          >
            <div className="flex justify-end">
              <button 
                onClick={generateForecast}
                disabled={loadingForecast}
                className="px-6 py-3 bg-brand text-white rounded-2xl text-sm font-black uppercase tracking-widest hover:bg-brand-hover transition-all shadow-lg shadow-brand/20 active:scale-95 disabled:opacity-50 flex items-center gap-2"
              >
                {loadingForecast ? <Loader2 className="w-4 h-4 animate-spin" /> : <Target className="w-4 h-4" />}
                Run Forecast
              </button>
            </div>

            {loadingForecast && !forecast ? (
              <div className="flex flex-col items-center justify-center py-20 space-y-4">
                <div className="relative">
                  <div className="w-16 h-16 border-4 border-brand/20 border-t-brand rounded-full animate-spin" />
                  <Target className="w-8 h-8 text-brand absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 animate-pulse" />
                </div>
                <p className="text-zinc-500 font-bold uppercase tracking-widest text-xs">Generating strategic forecast...</p>
              </div>
            ) : forecast ? (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Strategic Advice */}
                <div className="bg-white dark:bg-zinc-900 rounded-[2.5rem] border border-zinc-200 dark:border-zinc-800 shadow-xl p-8 sm:p-10 space-y-8">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-brand/10 flex items-center justify-center text-brand">
                      <Brain className="w-6 h-6" />
                    </div>
                    <div>
                      <h2 className="text-xl font-black text-zinc-900 dark:text-white">Strategic Advice</h2>
                      <p className="text-xs font-bold uppercase tracking-widest text-zinc-500">AI Recommendation</p>
                    </div>
                  </div>
                  <p className="text-lg text-zinc-700 dark:text-zinc-300 italic leading-relaxed">
                    "{forecast.strategic_advice}"
                  </p>
                  
                  <div className="pt-6 border-t border-zinc-100 dark:border-zinc-800">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                        <DollarSign className="w-6 h-6" />
                      </div>
                      <div>
                        <p className="text-xs font-black uppercase tracking-widest text-zinc-500">Forecasted Revenue (Next 30 Days)</p>
                        <p className="text-3xl font-black text-zinc-900 dark:text-white mt-1">
                          {formatCurrency(forecast.forecasted_revenue, currency)}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Inventory Recommendations */}
                <div className="bg-white dark:bg-zinc-900 rounded-[2.5rem] border border-zinc-200 dark:border-zinc-800 shadow-xl p-8 sm:p-10 space-y-8">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-blue-500/10 flex items-center justify-center text-blue-600 dark:text-blue-400">
                      <Package className="w-6 h-6" />
                    </div>
                    <div>
                      <h2 className="text-xl font-black text-zinc-900 dark:text-white">Restock Suggestions</h2>
                      <p className="text-xs font-bold uppercase tracking-widest text-zinc-500">Inventory Action Plan</p>
                    </div>
                  </div>
                  
                  <div className="space-y-4">
                    {forecast.restock_suggestions?.length > 0 ? (
                      forecast.restock_suggestions.map((item: any, idx: number) => (
                        <div key={idx} className="flex items-center justify-between p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-100 dark:border-zinc-800">
                          <span className="font-bold text-zinc-900 dark:text-white">{item.product_name}</span>
                          <span className="px-3 py-1 bg-brand/10 text-brand rounded-xl text-sm font-black">
                            +{item.suggested_quantity} units
                          </span>
                        </div>
                      ))
                    ) : (
                      <div className="text-center py-8 text-zinc-500 italic">
                        No immediate restock suggestions. Your inventory looks healthy!
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-20 text-zinc-500 italic">
                Click "Run Forecast" to generate predictive insights.
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="p-6 bg-emerald-50 dark:bg-emerald-900/10 rounded-3xl border border-emerald-100 dark:border-emerald-900/20">
          <TrendingUp className="w-6 h-6 text-emerald-600 dark:text-emerald-400 mb-3" />
          <h4 className="text-xs font-black uppercase tracking-widest text-emerald-900 dark:text-emerald-100">Growth Focus</h4>
          <p className="text-[10px] text-emerald-600/80 dark:text-emerald-400/80 font-medium mt-1">AI identifies your fastest growing categories.</p>
        </div>
        <div className="p-6 bg-amber-50 dark:bg-amber-900/10 rounded-3xl border border-amber-100 dark:border-amber-900/20">
          <AlertCircle className="w-6 h-6 text-amber-600 dark:text-amber-400 mb-3" />
          <h4 className="text-xs font-black uppercase tracking-widest text-amber-900 dark:text-amber-100">Risk Mitigation</h4>
          <p className="text-[10px] text-amber-600/80 dark:text-amber-400/80 font-medium mt-1">Detects unusual expense spikes or low stock.</p>
        </div>
        <div className="p-6 bg-blue-50 dark:bg-blue-900/10 rounded-3xl border border-blue-100 dark:border-blue-900/20">
          <Brain className="w-6 h-6 text-blue-600 dark:text-blue-400 mb-3" />
          <h4 className="text-xs font-black uppercase tracking-widest text-blue-900 dark:text-blue-100">Smart Strategy</h4>
          <p className="text-[10px] text-blue-600/80 dark:text-blue-400/80 font-medium mt-1">Actionable steps to improve your bottom line.</p>
        </div>
      </div>
    </div>
  );
}
