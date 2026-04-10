import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Brain, Sparkles, TrendingUp, AlertCircle, Lightbulb, Loader2, Target, Package, DollarSign, X } from 'lucide-react';
import { useAuth, useSettings } from '../App';
import { useNavigate } from 'react-router-dom';
import { GoogleGenAI, Type, ThinkingLevel } from "@google/genai";

import { motion, AnimatePresence } from 'motion/react';
import Markdown from 'react-markdown';
import { formatCurrency, retryWithBackoff, fetchGeminiKey } from '../lib/utils';

export default function AIAdvisor() {
  const { fetchWithAuth, user } = useAuth();
  const { settings } = useSettings();
  const navigate = useNavigate();
  const currency = settings?.currency || 'NGN';
  
  const isPro = user?.subscription_plan === 'pro' || user?.subscription_plan === 'trial' || user?.role === 'super_admin';
  const [showOverlay, setShowOverlay] = useState(true);
  
  // Pulse State
  const [loadingPulse, setLoadingPulse] = useState(false);
  const [insight, setInsight] = useState<string | null>(null);
  const [data, setData] = useState<any>(null);

  // Forecast State
  const [loadingForecast, setLoadingForecast] = useState(false);
  const [forecast, setForecast] = useState<any>(null);

  const [activeTab, setActiveTab] = useState<'pulse' | 'forecast'>('pulse');

  useEffect(() => {
    if (isPro) {
      fetchBusinessData();
    }
  }, [isPro]);

  useEffect(() => {
    if (data) {
      if (activeTab === 'pulse' && !insight) {
        generateInsight(data);
      } else if (activeTab === 'forecast' && !forecast) {
        generateForecast(data);
      }
    }
  }, [activeTab, data]);

  const fetchBusinessData = async () => {
    setLoadingPulse(true);
    try {
      const batchRes = await fetchWithAuth('/api/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          endpoints: [
            '/api/sales?limit=50',
            '/api/expenses?limit=50',
            '/api/products?limit=50'
          ]
        })
      });

      if (!batchRes.ok) {
        throw new Error(`Batch fetch failed with status ${batchRes.status}`);
      }

      const results = await batchRes.json();
      const sales = Array.isArray(results[0]) ? results[0] : [];
      const expenses = Array.isArray(results[1]) ? results[1] : [];
      const products = Array.isArray(results[2]) ? results[2] : [];

      const businessData = {
        sales: sales.map((s: any) => ({
          date: s.created_at,
          total: s.total_amount,
          items: s.sale_items?.map((i: any) => ({
            name: i.product_name || i.service_name,
            qty: i.quantity,
            price: i.unit_price
          }))
        })),
        expenses: expenses.map((e: any) => ({
          date: e.date,
          amount: e.amount,
          category: e.category,
          desc: e.description
        })),
        inventory: products.map((p: any) => ({
          name: p.name,
          quantity: p.quantity,
          selling_price: p.selling_price,
          cost_price: p.cost_price
        }))
      };

      setData(businessData);
      
      // Prioritize active tab
      if (activeTab === 'pulse') {
        generateInsight(businessData);
      } else {
        generateForecast(businessData);
      }
    } catch (error) {
      console.error('Error fetching business data:', error);
      setLoadingPulse(false);
    }
  };

  const generateInsight = async (businessData: any) => {
    try {
      const apiKey = await fetchGeminiKey();
      
      if (!apiKey) {
        setInsight("Gemini API key not configured. Please set it in Settings.");
        return;
      }

      const ai = new GoogleGenAI({ apiKey });
      
      const response = await retryWithBackoff(async () => {
        return await ai.models.generateContent({
          model: "gemini-3-flash-preview",
          contents: {
            parts: [
              { text: `Analyze this business data and provide a strategic business pulse insight.
              Sales Data (Last 50): ${JSON.stringify(businessData.sales)}
              Expenses Data (Last 50): ${JSON.stringify(businessData.expenses)}
              Inventory Data: ${JSON.stringify(businessData.inventory)}
              
              Provide actionable insights in Markdown format. Focus on:
              - Revenue trends
              - Expense management
              - Inventory health
              - Growth opportunities` }
            ]
          },
          config: {
            thinkingConfig: { thinkingLevel: ThinkingLevel.LOW }
          }
        });
      });
      
      if (response.text) {
        setInsight(response.text);
      } else {
        setInsight("No insights generated. Please try again.");
      }
    } catch (error: any) {
      console.error('Error generating AI insight:', error);
      const isHighDemand = error.message?.includes('503') || error.message?.toLowerCase().includes('high demand') || error.message?.toLowerCase().includes('unavailable');
      if (isHighDemand) {
        setInsight(`The AI Advisor is currently experiencing high demand. Please wait a moment and try again.`);
      } else {
        setInsight(`Error connecting to AI Advisor: ${error.message || 'Unknown error'}. Please ensure your API key is configured in Settings.`);
      }
    } finally {
      setLoadingPulse(false);
    }
  };

  const generateForecast = async (businessData?: any) => {
    setLoadingForecast(true);
    try {
      const apiKey = await fetchGeminiKey();
      
      if (!apiKey) {
        setForecast({ error: "Gemini API key not configured. Please set it in Settings." });
        return;
      }

      const ai = new GoogleGenAI({ apiKey });
      
      const forecastData = businessData || data;
      
      const response = await retryWithBackoff(async () => {
        return await ai.models.generateContent({
          model: "gemini-3-flash-preview",
          contents: {
            parts: [
              { text: `Analyze this business data and provide a strategic forecast.
              Sales Data: ${JSON.stringify(forecastData?.sales || [])}
              Inventory Data: ${JSON.stringify(forecastData?.inventory || [])}
              Expenses Data: ${JSON.stringify(forecastData?.expenses || [])}
              
              Return a JSON object with:
              - strategic_advice: A paragraph of actionable advice.
              - forecasted_revenue: A number representing expected revenue for next month.
              - restock_suggestions: Array of { product_name: string, suggested_quantity: number } for items running low or selling fast.
              ` }
            ]
          },
          config: {
            thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                strategic_advice: { type: Type.STRING },
                forecasted_revenue: { type: Type.NUMBER },
                restock_suggestions: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      product_name: { type: Type.STRING },
                      suggested_quantity: { type: Type.NUMBER }
                    }
                  }
                }
              }
            }
          }
        });
      });

      const result = JSON.parse(response.text || '{}');
      setForecast(result);
    } catch (error: any) {
      console.error('Error fetching forecast:', error);
      const isHighDemand = error.message?.includes('503') || error.message?.toLowerCase().includes('high demand') || error.message?.toLowerCase().includes('unavailable');
      if (isHighDemand) {
        setForecast({ error: `The AI Advisor is currently experiencing high demand. Please wait a moment and try again.` });
      } else {
        setForecast({ error: `Error connecting to AI Advisor: ${error.message || 'Unknown error'}. Please ensure your API key is configured in Settings.` });
      }
    } finally {
      setLoadingForecast(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-20 relative">
      {!isPro && showOverlay && (
        <div className="absolute inset-0 z-50 flex items-start justify-center pt-20 px-4 bg-white/60 dark:bg-zinc-950/60 backdrop-blur-md rounded-[2.5rem]">
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white dark:bg-zinc-900 p-8 rounded-[2.5rem] shadow-2xl border border-zinc-200 dark:border-zinc-800 max-w-md w-full text-center space-y-6 sticky top-20 relative"
          >
            <button 
              onClick={() => navigate('/')}
              className="absolute top-6 right-6 p-2 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors text-zinc-400 hover:text-zinc-900 dark:hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="w-20 h-20 bg-brand/10 rounded-[2rem] flex items-center justify-center mx-auto">
              <Brain className="w-10 h-10 text-brand" />
            </div>
            <div className="space-y-2">
              <h2 className="h2 uppercase">Pro Feature</h2>
              <p className="body-text">
                AI Intelligence is exclusive to our Pro plan. Upgrade now to get deep insights into your business performance.
              </p>
            </div>
            <div className="pt-4 space-y-3">
              <Link 
                to="/subscription" 
                className="btn-primary w-full py-4 text-xs uppercase tracking-widest"
              >
                Upgrade to Pro
              </Link>
              <p className="label-text">
                Or use a referral code to get 14 days free
              </p>
            </div>
          </motion.div>
        </div>
      )}

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="h1 flex items-center gap-3">
            <Brain className="w-8 h-8 text-brand" />
            AI Intelligence Hub
          </h1>
          <p className="body-text">Your proactive business partner, powered by Gemini AI.</p>
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
                className="btn-primary"
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
                      <p className="text-center text-zinc-500">No insights generated yet.</p>
                    )}
                  </div>
                </div>
                
                <div className="bg-zinc-50 dark:bg-zinc-800/50 p-6 border-t border-zinc-100 dark:border-zinc-800">
                  <div className="flex items-center gap-4 text-zinc-500 dark:text-zinc-400">
                    <Lightbulb className="w-5 h-5 text-brand shrink-0" />
                    <p className="text-xs font-medium">
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
                className="btn-primary"
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
            ) : forecast?.error ? (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-3xl p-8 flex items-start gap-4">
                <AlertCircle className="w-6 h-6 text-red-600 dark:text-red-400 shrink-0 mt-1" />
                <div>
                  <h3 className="text-red-900 dark:text-red-200 font-bold text-lg">Forecast Error</h3>
                  <p className="text-red-700 dark:text-red-300 mt-2">{forecast.error}</p>
                </div>
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
                      <h2 className="h2">Strategic Advice</h2>
                      <p className="label-text">AI Recommendation</p>
                    </div>
                  </div>
                  <p className="text-lg text-zinc-700 dark:text-zinc-300 leading-relaxed">
                    "{forecast.strategic_advice}"
                  </p>
                  
                  <div className="pt-6 border-t border-zinc-100 dark:border-zinc-800">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-2xl bg-brand/10 flex items-center justify-center text-brand">
                        <DollarSign className="w-6 h-6" />
                      </div>
                      <div>
                        <p className="text-xs font-bold uppercase tracking-widest text-zinc-500">Forecasted Revenue (Next 30 Days)</p>
                        <p className="text-3xl font-bold text-zinc-900 dark:text-white mt-1">
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
                      <h2 className="text-xl font-bold text-zinc-900 dark:text-white">Restock Suggestions</h2>
                      <p className="text-xs font-bold uppercase tracking-widest text-zinc-500">Inventory Action Plan</p>
                    </div>
                  </div>
                  
                  <div className="space-y-4">
                    {forecast.restock_suggestions?.length > 0 ? (
                      forecast.restock_suggestions.map((item: any, idx: number) => (
                        <div key={idx} className="flex items-center justify-between p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-100 dark:border-zinc-800">
                          <span className="font-bold text-zinc-900 dark:text-white">{item.product_name}</span>
                          <span className="px-3 py-1 bg-brand/10 text-brand rounded-xl text-sm font-bold">
                            +{item.suggested_quantity} units
                          </span>
                        </div>
                      ))
                    ) : (
                      <div className="text-center py-8 text-zinc-500">
                        No immediate restock suggestions. Your inventory looks healthy!
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-20 text-zinc-500">
                Click "Run Forecast" to generate predictive insights.
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="p-6 bg-brand/5 rounded-3xl border border-brand/10">
          <TrendingUp className="w-6 h-6 text-brand mb-3" />
          <h4 className="text-xs font-bold uppercase tracking-widest text-brand">Growth Focus</h4>
          <p className="text-[10px] text-brand/80 font-medium mt-1">AI identifies your fastest growing categories.</p>
        </div>
        <div className="p-6 bg-amber-50 dark:bg-amber-900/10 rounded-3xl border border-amber-100 dark:border-amber-900/20">
          <AlertCircle className="w-6 h-6 text-amber-600 dark:text-amber-400 mb-3" />
          <h4 className="text-xs font-bold uppercase tracking-widest text-amber-900 dark:text-amber-100">Risk Mitigation</h4>
          <p className="text-[10px] text-amber-600/80 dark:text-amber-400/80 font-medium mt-1">Detects unusual expense spikes or low stock.</p>
        </div>
        <div className="p-6 bg-blue-50 dark:bg-blue-900/10 rounded-3xl border border-blue-100 dark:border-blue-900/20">
          <Brain className="w-6 h-6 text-blue-600 dark:text-blue-400 mb-3" />
          <h4 className="text-xs font-bold uppercase tracking-widest text-blue-900 dark:text-blue-100">Smart Strategy</h4>
          <p className="text-[10px] text-blue-600/80 dark:text-blue-400/80 font-medium mt-1">Actionable steps to improve your bottom line.</p>
        </div>
      </div>
    </div>
  );
}
