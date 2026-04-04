import React, { useState, useEffect } from 'react';
import { 
  FileText, 
  TrendingUp, 
  AlertCircle, 
  Download, 
  Calendar,
  Info,
  CheckCircle2,
  HelpCircle,
  ArrowRight,
  ShieldCheck
} from 'lucide-react';
import { motion } from 'motion/react';
import { useAuth, useSettings } from '../App';
import { formatCurrency, cn, NUMBER_STYLE } from '../lib/utils';
import { CurrencyDisplay } from '../components/CurrencyDisplay';
import { TotalDisplay } from '../components/TotalDisplay';
import { Select } from '../components/Select';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

interface TaxData {
  period: string;
  turnover: number;
  gross_profit: number;
  net_profit: number;
  total_expenses: number;
  total_inflows: number;
  net_cash_flow: number;
  vat_collected: number;
  vat_exempt: boolean;
  estimated_cit: number;
  education_tax: number;
  total_tax_liability: number;
  cit_rate: number;
  edu_tax_rate: number;
  currency: string;
  filing_deadlines: {
    cit: string;
    vat: string;
    annual_returns: string;
  };
  compliance_status: {
    is_small_company: boolean;
    requires_vat_registration: boolean;
    must_file_even_if_zero: boolean;
    tcc_info?: string;
  };
  legal_structure: string;
  tax_category: string;
  tax_authority: string;
  tax_breakdown?: string;
  deductions_info?: string;
  deductions_amount?: number;
}

const TaxReport = () => {
  const { fetchWithAuth } = useAuth();
  const { settings, refreshSettings } = useSettings();
  const [period, setPeriod] = useState<'month' | 'year'>('year');
  const [loading, setLoading] = useState(true);
  const [taxData, setTaxData] = useState<TaxData | null>(null);
  const [isUpdatingLegalStructure, setIsUpdatingLegalStructure] = useState(false);

  const legalStructures = [
    'Sole Proprietorship / Business Name',
    'Partnership',
    'Limited Liability Company (LTD)',
    'Public Limited Company (PLC)',
    'Incorporated Trustees (NGO/Church/Association)'
  ];

  useEffect(() => {
    fetchTaxData();
  }, [period]);

  const fetchTaxData = async () => {
    setLoading(true);
    try {
      const response = await fetchWithAuth(`/api/tax-report?period=${period}`);
      if (!response.ok) throw new Error('Failed to fetch tax data');
      const data = await response.json();
      setTaxData(data);
    } catch (error) {
      console.error('Error:', error);
      toast.error('Failed to load tax report');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateLegalStructure = async (newStructure: string) => {
    if (!settings) {
      toast.error('Please wait for settings to load');
      return;
    }
    setIsUpdatingLegalStructure(true);
    try {
      const response = await fetchWithAuth('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          ...settings,
          legal_structure: newStructure 
        })
      });
      
      if (!response.ok) throw new Error('Failed to update legal structure');
      
      await refreshSettings();
      await fetchTaxData();
      toast.success('Legal structure updated successfully');
    } catch (error) {
      console.error('Error:', error);
      toast.error('Failed to update legal structure');
    } finally {
      setIsUpdatingLegalStructure(false);
    }
  };

  const currentYear = new Date().getFullYear();

  const exportToCSV = () => {
    if (!taxData) return;
    const headers = ['Metric', 'Value'];
    const rows = [
      ['Period', taxData.period.toUpperCase()],
      ['Total Turnover', taxData.turnover],
      ['Gross Profit', taxData.gross_profit],
      ['Total Expenses', taxData.total_expenses],
      ['Net Profit/Loss', taxData.net_profit],
      ['Total Other Inflows', taxData.total_inflows],
      ['Net Cash Flow', taxData.net_cash_flow],
      ['VAT Collected', taxData.vat_collected],
      ['Estimated CIT', taxData.estimated_cit],
      ['Education Tax', taxData.education_tax],
      ['Total Tax Liability', taxData.total_tax_liability]
    ];
    
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `tax_report_${taxData.period}_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-zinc-900 dark:text-white tracking-tight">Nigeria Tax Report</h1>
          <p className="text-zinc-600 dark:text-zinc-400 mt-1 font-medium">
            Estimated tax assessment based on Finance Act 2023 and Nigerian tax laws.
          </p>
        </div>
        
        <div className="flex flex-wrap items-center gap-4">
          <button 
            onClick={exportToCSV}
            disabled={!taxData}
            className="flex items-center justify-center gap-2 px-6 py-3 bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-white rounded-2xl text-sm font-bold uppercase tracking-widest hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-all active:scale-95 disabled:opacity-50"
          >
            <Download className="w-4 h-4" />
            Export CSV
          </button>
          <div className="flex items-center gap-3 bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 rounded-2xl p-1 shadow-sm">
            <button
              onClick={() => setPeriod('month')}
              className={cn(
                "px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-widest transition-all",
                period === 'month' 
                  ? "bg-brand text-white shadow-lg" 
                  : "text-zinc-500 hover:text-zinc-900 dark:hover:text-white"
              )}
            >
              Month
            </button>
            <button
              onClick={() => setPeriod('year')}
              className={cn(
                "px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-widest transition-all",
                period === 'year' 
                  ? "bg-brand text-white shadow-lg" 
                  : "text-zinc-500 hover:text-zinc-900 dark:hover:text-white"
              )}
            >
              Year {currentYear}
            </button>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-pulse">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-40 bg-zinc-100 dark:bg-zinc-800 rounded-[2.5rem]" />
          ))}
        </div>
      ) : taxData ? (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 rounded-[2.5rem] p-8 shadow-sm"
            >
              <TotalDisplay 
                label="Total Turnover" 
                value={formatCurrency(taxData.turnover, settings?.currency)} 
                icon={<TrendingUp className="w-6 h-6" />}
              />
              <div className="mt-4">
                {taxData.vat_exempt ? (
                  <div className="inline-flex items-center gap-2 px-3 py-1 bg-brand/10 text-brand rounded-full text-[10px] font-bold uppercase tracking-widest">
                    <CheckCircle2 className="w-3 h-3" /> Zero Tax Bracket
                  </div>
                ) : (
                  <div className="inline-flex items-center gap-2 px-3 py-1 bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 rounded-full text-[10px] font-bold uppercase tracking-widest">
                    <AlertCircle className="w-3 h-3" /> VAT Registrable
                  </div>
                )}
              </div>
            </motion.div>

            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 rounded-[2.5rem] p-8 shadow-sm"
            >
              <TotalDisplay 
                label="Net Profit / Loss" 
                value={formatCurrency(taxData.net_profit, settings?.currency)} 
                icon={<FileText className="w-6 h-6" />}
                valueClassName={taxData.net_profit >= 0 ? "text-zinc-950 dark:text-white" : "text-red-600 dark:text-red-400"}
              />
              <div className="mt-4">
                {taxData.net_profit >= 0 ? (
                  <div className="inline-flex items-center gap-2 px-3 py-1 bg-brand/10 text-brand rounded-full text-[10px] font-bold uppercase tracking-widest">
                    Making Money
                  </div>
                ) : (
                  <div className="inline-flex items-center gap-2 px-3 py-1 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-full text-[10px] font-bold uppercase tracking-widest">
                    Operating at Deficit
                  </div>
                )}
              </div>
            </motion.div>

            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="bg-brand text-white shadow-xl shadow-brand/20 rounded-[2.5rem] p-8 transition-all"
            >
              <TotalDisplay 
                label="Est. Tax Liability" 
                value={taxData.total_tax_liability > 0 ? formatCurrency(taxData.total_tax_liability, settings?.currency) : "EXEMPT"} 
                icon={<ShieldCheck className="w-6 h-6" />}
                iconClassName="bg-white/20 text-white"
                labelClassName="text-white opacity-80"
                valueClassName="text-white"
              />
              <p className="mt-4 text-[10px] font-bold uppercase tracking-widest opacity-70">
                {taxData.total_tax_liability > 0 
                  ? `CIT (${taxData.cit_rate}%) + EDU TAX (${taxData.edu_tax_rate}%)`
                  : "Small Business Exemption Applied"
                }
              </p>
            </motion.div>
          </div>

          {/* Filing Deadlines & Compliance Status */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 rounded-[2.5rem] p-8 shadow-sm">
              <h3 className="text-lg font-bold text-zinc-900 dark:text-white mb-6 flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-brand" />
                Tax Category
              </h3>
              <div className="space-y-4">
                <div className="p-4 bg-zinc-50 dark:bg-zinc-800/50 rounded-2xl relative group">
                  <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1">Legal Structure</div>
                  <div className="flex items-center justify-between gap-2">
                    {isUpdatingLegalStructure ? (
                      <div className="flex items-center gap-2 text-sm font-bold text-brand">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Updating...
                      </div>
                    ) : (
                      <Select
                        value={taxData.legal_structure}
                        onChange={handleUpdateLegalStructure}
                        options={legalStructures}
                        className="mt-1"
                        buttonClassName="border-none font-bold p-0 text-zinc-900 dark:text-white"
                      />
                    )}
                  </div>
                </div>
                <div className="p-4 bg-brand/5 rounded-2xl border border-brand/10">
                  <div className="text-[10px] font-bold text-brand uppercase tracking-widest mb-1">Tax Type</div>
                  <div className="text-sm font-bold text-zinc-900 dark:text-white">{taxData.tax_category}</div>
                </div>
                <div className="p-4 bg-zinc-50 dark:bg-zinc-800/50 rounded-2xl">
                  <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1">Tax Authority</div>
                  <div className="text-sm font-bold text-zinc-900 dark:text-white">{taxData.tax_authority}</div>
                </div>
                {taxData.tax_breakdown && (
                  <div className="p-4 bg-emerald-50 dark:bg-emerald-900/20 rounded-2xl border border-emerald-100 dark:border-emerald-800/30">
                    <div className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-widest mb-1">Tax Breakdown</div>
                    <div className="text-xs font-medium text-emerald-700 dark:text-emerald-300 leading-relaxed">{taxData.tax_breakdown}</div>
                  </div>
                )}
                {taxData.deductions_info && (
                  <div className="p-4 bg-zinc-50 dark:bg-zinc-800/50 rounded-2xl border border-zinc-100 dark:border-zinc-800/30">
                    <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1">Deductions & Reliefs</div>
                    <div className="text-xs font-medium text-zinc-600 dark:text-zinc-400 leading-relaxed">{taxData.deductions_info}</div>
                  </div>
                )}
              </div>
            </div>

            <div className="bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 rounded-[2.5rem] p-8 shadow-sm">
              <h3 className="text-lg font-bold text-zinc-900 dark:text-white mb-6 flex items-center gap-2">
                <Calendar className="w-5 h-5 text-brand" />
                Filing Deadlines
              </h3>
              <div className="space-y-4">
                <div className="flex justify-between items-center py-3 border-b border-zinc-50 dark:border-zinc-800/50">
                  <span className="text-xs font-bold text-zinc-500 uppercase tracking-wider">CIT Returns</span>
                  <span className="text-sm font-bold text-zinc-900 dark:text-white">{taxData.filing_deadlines.cit}</span>
                </div>
                <div className="flex justify-between items-center py-3 border-b border-zinc-50 dark:border-zinc-800/50">
                  <span className="text-xs font-bold text-zinc-500 uppercase tracking-wider">VAT Remittance</span>
                  <span className="text-sm font-bold text-zinc-900 dark:text-white">{taxData.filing_deadlines.vat}</span>
                </div>
                <div className="flex justify-between items-center py-3">
                  <span className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Annual Returns</span>
                  <span className="text-sm font-bold text-zinc-900 dark:text-white">{taxData.filing_deadlines.annual_returns}</span>
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 rounded-[2.5rem] p-8 shadow-sm">
              <h3 className="text-lg font-bold text-zinc-900 dark:text-white mb-6 flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                Compliance Checklist
              </h3>
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className={cn(
                    "w-5 h-5 rounded-full flex items-center justify-center",
                    taxData.compliance_status.is_small_company ? "bg-brand/10 text-brand" : "bg-zinc-100 text-zinc-400"
                  )}>
                    <CheckCircle2 className="w-3 h-3" />
                  </div>
                  <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Small Business Exemption active</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className={cn(
                    "w-5 h-5 rounded-full flex items-center justify-center",
                    !taxData.compliance_status.requires_vat_registration ? "bg-brand/10 text-brand" : "bg-amber-100 text-amber-600"
                  )}>
                    {taxData.compliance_status.requires_vat_registration ? <AlertCircle className="w-3 h-3" /> : <CheckCircle2 className="w-3 h-3" />}
                  </div>
                  <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                    {taxData.compliance_status.requires_vat_registration ? "VAT Registration Required" : "VAT Registration Optional"}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-5 h-5 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center">
                    <AlertCircle className="w-3 h-3" />
                  </div>
                  <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Annual Filing Mandatory for TCC</span>
                </div>
                {taxData.compliance_status.tcc_info && (
                  <div className="mt-4 p-4 bg-zinc-50 dark:bg-zinc-800/50 rounded-2xl text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed italic">
                    {taxData.compliance_status.tcc_info}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Detailed Breakdown */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="space-y-6">
              <h2 className="text-xl font-bold text-zinc-950 dark:text-white flex items-center gap-3">
                <FileText className="w-6 h-6 text-brand" />
                Financial Performance
              </h2>
              
              <div className="bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 rounded-[2.5rem] overflow-hidden shadow-sm">
                <div className="p-8 space-y-6">
                  <div className="flex justify-between items-center">
                    <div className="space-y-1">
                      <div className="text-sm font-bold text-zinc-950 dark:text-white">Total Turnover</div>
                      <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">All Sales Revenue</div>
                    </div>
                    <div className={cn(NUMBER_STYLE, "text-lg text-zinc-950 dark:text-white")}>
                      <CurrencyDisplay amount={taxData.turnover} currencyCode={settings?.currency} />
                    </div>
                  </div>
                  
                  <div className="flex justify-between items-center">
                    <div className="space-y-1">
                      <div className="text-sm font-bold text-zinc-950 dark:text-white">Total Expenses</div>
                      <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Operational Costs</div>
                    </div>
                    <div className={cn(NUMBER_STYLE, "text-lg text-red-600 dark:text-red-400")}>
                      -<CurrencyDisplay amount={taxData.total_expenses} currencyCode={settings?.currency} />
                    </div>
                  </div>

                  <div className="flex justify-between items-center">
                    <div className="space-y-1">
                      <div className="text-sm font-bold text-zinc-950 dark:text-white">Other Inflows</div>
                      <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Loans, Investments, etc.</div>
                    </div>
                    <div className={cn(NUMBER_STYLE, "text-lg text-brand ")}>
                      +<CurrencyDisplay amount={taxData.total_inflows} currencyCode={settings?.currency} />
                    </div>
                  </div>

                  <div className="flex justify-between items-center">
                    <div className="space-y-1">
                      <div className="text-sm font-bold text-zinc-950 dark:text-white">Tax-Exempt Profit</div>
                      <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Deductible/Exempt Amount</div>
                    </div>
                    <div className={cn(NUMBER_STYLE, "text-lg text-emerald-600 dark:text-emerald-400")}>
                      <CurrencyDisplay amount={taxData.deductions_amount || 0} currencyCode={settings?.currency} />
                    </div>
                  </div>

                  <div className="pt-6 border-t border-zinc-100 dark:border-zinc-800 flex justify-between items-center">
                    <div className="space-y-1">
                      <div className="text-lg font-bold text-zinc-950 dark:text-white">Net Cash Flow</div>
                      <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Real Money in Bank</div>
                    </div>
                    <div className={cn(
                      NUMBER_STYLE,
                      "text-2xl",
                      taxData.net_cash_flow >= 0 ? "text-brand " : "text-red-600 dark:text-red-400"
                    )}>
                      <CurrencyDisplay amount={taxData.net_cash_flow} currencyCode={settings?.currency} />
                    </div>
                  </div>
                </div>
                
                <div className="bg-zinc-50 dark:bg-zinc-800/50 p-6 border-t border-zinc-100 dark:border-zinc-800 flex items-start gap-4">
                  <Info className="w-6 h-6 text-brand mt-0.5 shrink-0" />
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed font-medium">
                    This report indicates that your brand is <strong>{taxData.net_profit >= 0 ? 'profitable' : 'operating at a loss'}</strong> for this period. 
                    {taxData.vat_exempt && ' As your turnover is below N25 million, you are currently in the zero-tax bracket for CIT and VAT.'}
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-6">
              <h2 className="text-xl font-bold text-zinc-950 dark:text-white flex items-center gap-3">
                <ShieldCheck className="w-6 h-6 text-brand" />
                Tax Compliance Guide
              </h2>

              <div className="grid grid-cols-1 gap-4">
                <div className="bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 rounded-3xl p-6 shadow-sm">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center shrink-0">
                      <ShieldCheck className="w-6 h-6 text-emerald-600" />
                    </div>
                    <div>
                      <h4 className="font-bold text-zinc-900 dark:text-white uppercase tracking-widest text-xs mb-1">Tax Clearance Certificate (TCC)</h4>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed font-medium">
                        Even if you owe 0 tax, you MUST file annual returns to obtain your TCC. This is required for government contracts and bank loans.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 rounded-3xl p-6 shadow-sm">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-brand/10 flex items-center justify-center shrink-0">
                      <CheckCircle2 className="w-6 h-6 text-brand" />
                    </div>
                    <div>
                      <h4 className="font-bold text-zinc-900 dark:text-white uppercase tracking-widest text-xs mb-1">Small Business Exemption</h4>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed font-medium">
                        Companies with turnover &lt; N25m are exempt from CIT and VAT. However, you are still required to file annual returns.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 rounded-3xl p-6 shadow-sm">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center shrink-0">
                      <AlertCircle className="w-6 h-6 text-amber-600" />
                    </div>
                    <div>
                      <h4 className="font-bold text-zinc-900 dark:text-white uppercase tracking-widest text-xs mb-1">VAT Compliance (7.5%)</h4>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed font-medium">
                        Once turnover hits N25m, you must register for VAT and remit collections by the 21st of every month.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="bg-zinc-100 dark:bg-brand rounded-[2rem] p-8 text-center space-y-4">
                  <div className="w-16 h-16 rounded-full bg-zinc-900/10 dark:bg-white/10 flex items-center justify-center mx-auto">
                    <HelpCircle className="w-8 h-8 text-zinc-900 dark:text-white" />
                  </div>
                  <div>
                    <h4 className="font-bold text-zinc-900 dark:text-white uppercase tracking-widest text-sm">Need Help?</h4>
                    <p className="text-xs text-zinc-500 dark:text-white/70 mt-2 leading-relaxed font-medium">
                      Consult with a certified Nigerian tax professional for a formal audit and filing.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </>
      ) : (
        <div className="flex flex-col items-center justify-center py-32 bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 rounded-[3rem] text-center">
          <FileText className="w-20 h-20 text-zinc-200 dark:text-zinc-800 mb-6" />
          <h3 className="text-2xl font-bold text-zinc-900 dark:text-white tracking-tight">No tax data available</h3>
          <p className="text-zinc-500 dark:text-zinc-400 max-w-xs mt-2 font-medium">
            Record some sales and expenses to see your tax assessment.
          </p>
        </div>
      )}
    </div>
  );
};

export default TaxReport;
