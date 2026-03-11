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
import { formatCurrency } from '../lib/utils';
import { toast } from 'sonner';

interface TaxData {
  period: string;
  turnover: number;
  gross_profit: number;
  net_profit: number;
  vat_collected: number;
  vat_exempt: boolean;
  estimated_cit: number;
  education_tax: number;
  total_tax_liability: number;
  cit_rate: number;
  edu_tax_rate: number;
  currency: string;
}

const TaxReport = () => {
  const { fetchWithAuth } = useAuth();
  const { settings } = useSettings();
  const [period, setPeriod] = useState<'month' | 'year'>('year');
  const [loading, setLoading] = useState(true);
  const [taxData, setTaxData] = useState<TaxData | null>(null);

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

  const currentYear = new Date().getFullYear();

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Nigeria Tax Report</h1>
          <p className="text-muted-foreground mt-1">
            Estimated tax assessment based on Finance Act 2023 and Nigerian tax laws.
          </p>
        </div>
        
        <div className="flex items-center gap-3 bg-card border rounded-xl p-1 shadow-sm">
          <button
            onClick={() => setPeriod('month')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              period === 'month' 
                ? 'bg-primary text-primary-foreground shadow-sm' 
                : 'hover:bg-muted'
            }`}
          >
            This Month
          </button>
          <button
            onClick={() => setPeriod('year')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              period === 'year' 
                ? 'bg-primary text-primary-foreground shadow-sm' 
                : 'hover:bg-muted'
            }`}
          >
            Year {currentYear}
          </button>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-pulse">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-32 bg-muted rounded-2xl" />
          ))}
        </div>
      ) : taxData ? (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-card border rounded-2xl p-6 shadow-sm"
            >
              <div className="flex items-center gap-3 text-muted-foreground mb-4">
                <TrendingUp className="w-5 h-5" />
                <span className="text-sm font-medium uppercase tracking-wider">Total Turnover</span>
              </div>
              <div className="text-3xl font-bold">{formatCurrency(taxData.turnover, settings?.currency)}</div>
              <div className="mt-2 text-xs text-muted-foreground">
                {taxData.vat_exempt ? (
                  <span className="text-emerald-500 font-medium flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" /> VAT Exempt (Turnover &lt; N25m)
                  </span>
                ) : (
                  <span className="text-amber-500 font-medium flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" /> VAT Registrable (Turnover &gt; N25m)
                  </span>
                )}
              </div>
            </motion.div>

            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="bg-card border rounded-2xl p-6 shadow-sm"
            >
              <div className="flex items-center gap-3 text-muted-foreground mb-4">
                <FileText className="w-5 h-5" />
                <span className="text-sm font-medium uppercase tracking-wider">Net Profit (Assessable)</span>
              </div>
              <div className="text-3xl font-bold">{formatCurrency(taxData.net_profit, settings?.currency)}</div>
              <div className="mt-2 text-xs text-muted-foreground">
                Used for CIT and Education Tax calculations.
              </div>
            </motion.div>

            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="bg-primary text-primary-foreground rounded-2xl p-6 shadow-lg"
            >
              <div className="flex items-center gap-3 opacity-80 mb-4">
                <ShieldCheck className="w-5 h-5" />
                <span className="text-sm font-medium uppercase tracking-wider">Est. Tax Liability</span>
              </div>
              <div className="text-3xl font-bold">{formatCurrency(taxData.total_tax_liability, settings?.currency)}</div>
              <div className="mt-2 text-xs opacity-80">
                CIT ({taxData.cit_rate}%) + Education Tax ({taxData.edu_tax_rate}%)
              </div>
            </motion.div>
          </div>

          {/* Detailed Breakdown */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="space-y-6">
              <h2 className="text-xl font-semibold flex items-center gap-2">
                <FileText className="w-5 h-5 text-primary" />
                Tax Breakdown
              </h2>
              
              <div className="bg-card border rounded-2xl overflow-hidden shadow-sm">
                <div className="p-6 space-y-4">
                  <div className="flex justify-between items-center pb-4 border-bottom">
                    <div className="space-y-0.5">
                      <div className="font-medium">Company Income Tax (CIT)</div>
                      <div className="text-xs text-muted-foreground">Rate: {taxData.cit_rate}% (Based on turnover)</div>
                    </div>
                    <div className="font-semibold">{formatCurrency(taxData.estimated_cit, settings?.currency)}</div>
                  </div>
                  
                  <div className="flex justify-between items-center pb-4 border-bottom">
                    <div className="space-y-0.5">
                      <div className="font-medium">Tertiary Education Tax (EDT)</div>
                      <div className="text-xs text-muted-foreground">Rate: {taxData.edu_tax_rate}% of assessable profit</div>
                    </div>
                    <div className="font-semibold">{formatCurrency(taxData.education_tax, settings?.currency)}</div>
                  </div>

                  <div className="flex justify-between items-center pb-4 border-bottom">
                    <div className="space-y-0.5">
                      <div className="font-medium">VAT Collected</div>
                      <div className="text-xs text-muted-foreground">7.5% on taxable sales</div>
                    </div>
                    <div className="font-semibold">{formatCurrency(taxData.vat_collected, settings?.currency)}</div>
                  </div>

                  <div className="pt-2 flex justify-between items-center">
                    <div className="font-bold text-lg">Total Estimated Payable</div>
                    <div className="font-bold text-lg text-primary">{formatCurrency(taxData.total_tax_liability, settings?.currency)}</div>
                  </div>
                </div>
                
                <div className="bg-muted/50 p-4 border-top flex items-start gap-3">
                  <Info className="w-5 h-5 text-primary mt-0.5 shrink-0" />
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Note: This is an automated estimate. Actual tax liability may vary based on capital allowances, 
                    exempted incomes, and other deductible expenses not captured here.
                  </p>
                </div>
              </div>

              <div className="bg-primary/5 border border-primary/20 rounded-2xl p-6">
                <h3 className="font-semibold mb-3 flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-primary" />
                  Filing Deadlines
                </h3>
                <ul className="space-y-3">
                  <li className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">CIT Returns</span>
                    <span className="font-medium">6 months after year-end</span>
                  </li>
                  <li className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">VAT Returns</span>
                    <span className="font-medium">21st of every month</span>
                  </li>
                  <li className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">WHT Returns</span>
                    <span className="font-medium">21st of every month</span>
                  </li>
                </ul>
              </div>
            </div>

            <div className="space-y-6">
              <h2 className="text-xl font-semibold flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-primary" />
                Nigeria Tax Compliance Guide
              </h2>

              <div className="grid grid-cols-1 gap-4">
                <div className="bg-card border rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center shrink-0">
                      <CheckCircle2 className="w-6 h-6 text-emerald-600" />
                    </div>
                    <div>
                      <h4 className="font-medium mb-1">Small Business Exemption</h4>
                      <p className="text-sm text-muted-foreground leading-relaxed">
                        Under the Finance Act, companies with an annual turnover of less than <strong>N25 million</strong> are 
                        exempt from Company Income Tax (CIT) and VAT registration.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="bg-card border rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center shrink-0">
                      <AlertCircle className="w-6 h-6 text-amber-600" />
                    </div>
                    <div>
                      <h4 className="font-medium mb-1">VAT Compliance (7.5%)</h4>
                      <p className="text-sm text-muted-foreground leading-relaxed">
                        If your turnover exceeds N25m, you MUST register for VAT, include 7.5% on all invoices, 
                        and remit to the FIRS by the 21st of the following month.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="bg-card border rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center shrink-0">
                      <HelpCircle className="w-6 h-6 text-blue-600" />
                    </div>
                    <div>
                      <h4 className="font-medium mb-1">Education Tax (3%)</h4>
                      <p className="text-sm text-muted-foreground leading-relaxed">
                        The Finance Act 2023 increased the Tertiary Education Tax rate from 2.5% to <strong>3%</strong> of 
                        assessable profit for all Nigerian companies.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="bg-muted rounded-2xl p-6 flex flex-col items-center text-center space-y-4">
                  <div className="w-12 h-12 rounded-full bg-card flex items-center justify-center shadow-sm">
                    <Download className="w-6 h-6 text-primary" />
                  </div>
                  <div>
                    <h4 className="font-semibold">Need a formal Tax Audit?</h4>
                    <p className="text-sm text-muted-foreground max-w-xs mx-auto mt-1">
                      Export your full transaction history and bookkeeping records for your accountant or tax consultant.
                    </p>
                  </div>
                  <button className="w-full py-2.5 bg-card border hover:bg-muted rounded-xl text-sm font-medium transition-colors flex items-center justify-center gap-2">
                    Export Bookkeeping Records
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>
      ) : (
        <div className="flex flex-col items-center justify-center py-20 bg-card border rounded-3xl text-center">
          <FileText className="w-16 h-16 text-muted mb-4" />
          <h3 className="text-xl font-semibold">No tax data available</h3>
          <p className="text-muted-foreground max-w-xs mt-2">
            We couldn't generate a tax report. Make sure you have recorded sales and expenses for this period.
          </p>
        </div>
      )}
    </div>
  );
};

export default TaxReport;
