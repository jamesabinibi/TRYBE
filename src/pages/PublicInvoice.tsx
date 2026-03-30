import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { motion } from 'motion/react';
import { Download, Building2, MapPin, Phone, Mail, FileText } from 'lucide-react';
import { generatePDF } from '../utils/pdfGenerator';
import { NUMBER_STYLE } from '../lib/utils';

export default function PublicInvoice() {
  const { id } = useParams();
  const [invoice, setInvoice] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchInvoice = async () => {
      try {
        const res = await fetch(`/api/public/invoice/${id}`);
        if (!res.ok) throw new Error('Invoice not found');
        const data = await res.json();
        setInvoice(data);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchInvoice();
  }, [id]);

  const formatCurrency = (amount: number | string, currency: string) => {
    const value = typeof amount === 'string' ? parseFloat(amount) || 0 : amount;
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: currency || 'NGN',
      minimumFractionDigits: 0,
    }).format(value);
  };

  const handleDownload = () => {
    if (!invoice || !invoice.sale_items) return;

    const mappedItems = invoice.sale_items.map((si: any) => {
      const baseName = si.product_variants?.products?.name || si.services?.name || si.product_name || si.service_name || si.product_name_from_table || si.service_name_from_table || 'Item';
      const variant = si.product_variants ? ` (${si.product_variants.size || ''}${si.product_variants.color ? ' - ' + si.product_variants.color : ''})` : 
                      (si.size ? ` (${si.size}${si.color ? ' - ' + si.color : ''})` : '');
      const fullName = baseName.includes('(') ? baseName : baseName + variant;
      
      return {
        name: fullName,
        type: si.service_id ? 'service' : 'product',
        quantity: si.quantity || 0,
        price: si.unit_price || si.price_at_sale || 0,
        total: si.total_price || (si.quantity * (si.unit_price || si.price_at_sale || 0))
      };
    });

    const mappedData = {
      items: mappedItems,
      recipient: {
        name: invoice.customer_name || invoice.customers?.name || invoice.customer_name_from_table || 'Walk-in Customer',
        email: invoice.customer_email || invoice.customers?.email || '',
        phone: invoice.customer_phone || invoice.customers?.phone || '',
        address: invoice.customer_address || invoice.customers?.address || ''
      },
      invoiceNumber: invoice.invoice_number,
      invoiceDate: new Date(invoice.created_at).toLocaleDateString(),
      discount: invoice.discount_percentage || 0,
      invoiceTerms: invoice.invoice_terms || settings?.invoice_terms || '',
      vatEnabled: invoice.vat_amount > 0,
      vatAmount: parseFloat(invoice.vat_amount) || 0
    };

    generatePDF(mappedData, settings);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (error || !invoice) {
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex flex-col items-center justify-center p-4">
        <FileText className="w-16 h-16 text-zinc-300 dark:text-zinc-700 mb-4" />
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-white mb-2">Invoice Not Found</h1>
        <p className="text-zinc-500 dark:text-zinc-400 text-center max-w-md">
          The invoice you are looking for does not exist or has been removed.
        </p>
      </div>
    );
  }

  const settings = invoice.settings || {};
  const currency = settings.currency || 'NGN';

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 py-12 px-4 sm:px-6 lg:px-8 font-sans selection:bg-zinc-900 selection:text-white dark:selection:bg-white dark:selection:text-zinc-900">
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-end mb-8">
          <button
            onClick={handleDownload}
            className="inline-flex items-center gap-2 px-8 py-4 bg-zinc-900 hover:bg-zinc-800 dark:bg-white dark:hover:bg-zinc-100 text-white dark:text-zinc-900 rounded-2xl font-bold text-sm transition-all shadow-xl hover:shadow-2xl hover:-translate-y-1 active:translate-y-0"
          >
            <Download className="w-5 h-5" />
            Download PDF Invoice
          </button>
        </div>

        <motion.div 
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white dark:bg-zinc-900 rounded-[40px] shadow-2xl overflow-hidden border border-zinc-200 dark:border-zinc-800 relative"
        >
          {/* Decorative Brand Bar */}
          <div 
            className="h-3 w-full" 
            style={{ backgroundColor: settings.brand_color?.includes('gradient') ? '#10b981' : (settings.brand_color || '#10b981') }} 
          />

          {/* Header Section */}
          <div className="p-10 sm:p-16">
            <div className="flex flex-col md:flex-row justify-between items-start gap-12">
              <div className="space-y-6">
                {settings.logo_url ? (
                  <img src={settings.logo_url} alt="Logo" className="h-20 w-auto object-contain" referrerPolicy="no-referrer" />
                ) : (
                  <div className="w-16 h-16 bg-zinc-100 dark:bg-zinc-800 rounded-2xl flex items-center justify-center">
                    <Building2 className="w-8 h-8 text-zinc-400" />
                  </div>
                )}
                <div>
                  <h1 className="text-4xl font-black tracking-tighter text-zinc-900 dark:text-white uppercase leading-none">
                    Invoice
                  </h1>
                  <p className="text-zinc-400 dark:text-zinc-500 font-sans font-bold text-sm mt-2 tracking-widest">
                    NO. {invoice.invoice_number}
                  </p>
                </div>
              </div>

              <div className="text-left md:text-right space-y-4">
                <div className="space-y-1">
                  <p className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em]">Issued By</p>
                  <h3 className="font-bold text-2xl text-zinc-950 dark:text-white tracking-tight">{settings.business_name || 'Business Name'}</h3>
                </div>
                <div className="space-y-1.5 text-zinc-500 dark:text-zinc-400 text-sm font-medium">
                  {settings.email && <p className="flex items-center md:justify-end gap-2"><Mail className="w-3.5 h-3.5 opacity-50" /> {settings.email}</p>}
                  {settings.phone_number && <p className="flex items-center md:justify-end gap-2"><Phone className="w-3.5 h-3.5 opacity-50" /> {settings.phone_number}</p>}
                  {settings.address && (
                    <p className="flex items-start md:justify-end gap-2">
                      <MapPin className="w-3.5 h-3.5 opacity-50 mt-1" />
                      <span className="max-w-[240px] leading-relaxed">{settings.address}</span>
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Meta Info Grid */}
            <div className="mt-16 grid grid-cols-1 sm:grid-cols-3 gap-10 p-8 bg-zinc-50 dark:bg-zinc-800/50 rounded-[32px] border border-zinc-100 dark:border-zinc-800">
              <div>
                <p className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] mb-2">Billed To</p>
                <h4 className="font-bold text-lg text-zinc-950 dark:text-white tracking-tight leading-tight">
                  {invoice.customer_name || invoice.customers?.name || invoice.customer_name_from_table || 'Walk-in Customer'}
                </h4>
                <div className="mt-2 space-y-1 text-zinc-500 dark:text-zinc-400 text-xs font-medium">
                  {(invoice.customer_email || invoice.customers?.email) && <p>{invoice.customer_email || invoice.customers?.email}</p>}
                  {(invoice.customer_phone || invoice.customers?.phone) && <p>{invoice.customer_phone || invoice.customers?.phone}</p>}
                </div>
              </div>
              <div>
                <p className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] mb-2">Date Issued</p>
                <p className="font-bold text-zinc-950 dark:text-white text-lg tracking-tight">
                  {new Date(invoice.created_at).toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' })}
                </p>
              </div>
              <div>
                <p className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] mb-2">Payment Status</p>
                <div className="inline-flex items-center px-3 py-1 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 text-[10px] font-black uppercase tracking-widest">
                  {invoice.payment_method || 'Paid'}
                </div>
              </div>
            </div>

            {/* Items Table */}
            <div className="mt-16">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-zinc-200 dark:border-zinc-800">
                    <th className="pb-6 text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400 w-1/2">Description</th>
                    <th className="pb-6 text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400 text-center">Qty</th>
                    <th className="pb-6 text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400 text-right">Price</th>
                    <th className="pb-6 text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400 text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/50">
                  {invoice.sale_items?.map((item: any, idx: number) => {
                    const baseName = item.product_variants?.products?.name || item.services?.name || item.product_name || item.service_name || item.product_name_from_table || item.service_name_from_table || 'Item';
                    const variant = item.product_variants ? ` (${item.product_variants.size || ''}${item.product_variants.color ? ' - ' + item.product_variants.color : ''})` : 
                                    (item.size ? ` (${item.size}${item.color ? ' - ' + item.color : ''})` : '');
                    const fullName = baseName.includes('(') ? baseName : baseName + variant;
                    
                    return (
                      <tr key={idx} className="group">
                        <td className="py-8 pr-4">
                          <p className="font-bold text-zinc-950 dark:text-white text-base tracking-tight">{fullName}</p>
                          <p className="text-xs text-zinc-400 mt-1 font-medium">{item.service_id ? 'Service' : 'Product'}</p>
                        </td>
                        <td className="py-8 px-4 text-center">
                          <span className={`${NUMBER_STYLE} text-sm text-zinc-950 dark:text-white`}>
                            {item.quantity}
                          </span>
                        </td>
                        <td className={`py-8 px-4 text-right ${NUMBER_STYLE} text-sm text-zinc-500 dark:text-zinc-400`}>
                          {formatCurrency(item.unit_price || item.price_at_sale || 0, currency)}
                        </td>
                        <td className={`py-8 pl-4 text-right ${NUMBER_STYLE} text-zinc-950 dark:text-white text-base`}>
                          {formatCurrency(item.total_price || (item.quantity * (item.unit_price || item.price_at_sale || 0)), currency)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Summary Section */}
            <div className="mt-12 flex flex-col sm:flex-row justify-between items-start gap-12 pt-12 border-t border-zinc-100 dark:border-zinc-800">
              <div className="max-w-xs space-y-6">
                <div>
                  <h5 className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400 mb-4">Terms & Conditions</h5>
                  <p className="text-sm text-zinc-500 dark:text-zinc-400 leading-relaxed font-medium italic">
                    {invoice.invoice_terms || settings.invoice_terms || `Thank you for your business. We appreciate your trust in ${settings.business_name || 'us'}.`}
                  </p>
                </div>

                {(settings?.bank_name || settings?.account_name || settings?.account_number) && (
                  <div>
                    <h5 className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400 mb-4">Payment Details</h5>
                    <div className="text-sm text-zinc-500 dark:text-zinc-400 leading-relaxed font-medium">
                      {settings?.bank_name && <p><span className="font-bold text-zinc-700 dark:text-zinc-300">Bank:</span> {settings.bank_name}</p>}
                      {settings?.account_name && <p><span className="font-bold text-zinc-700 dark:text-zinc-300">Account Name:</span> {settings.account_name}</p>}
                      {settings?.account_number && <p><span className="font-bold text-zinc-700 dark:text-zinc-300">Account Number:</span> {settings.account_number}</p>}
                    </div>
                  </div>
                )}
              </div>

              <div className="w-full sm:w-80 space-y-4">
                <div className="flex justify-between items-center text-zinc-500 dark:text-zinc-400">
                  <span className="text-[10px] font-black uppercase tracking-[0.2em]">Subtotal</span>
                  <span className={NUMBER_STYLE}>{formatCurrency((parseFloat(invoice.total_amount) || 0) + (parseFloat(invoice.discount_amount) || 0) - (parseFloat(invoice.vat_amount) || 0), currency)}</span>
                </div>
                
                {invoice.discount_amount > 0 && (
                  <div className="flex justify-between items-center text-emerald-600 dark:text-emerald-400">
                    <span className="text-[10px] font-black uppercase tracking-[0.2em]">Discount ({invoice.discount_percentage}%)</span>
                    <span className={NUMBER_STYLE}>-{formatCurrency(invoice.discount_amount, currency)}</span>
                  </div>
                )}

                {invoice.vat_amount > 0 && (
                  <div className="flex justify-between items-center text-zinc-500 dark:text-zinc-400">
                    <span className="text-[10px] font-black uppercase tracking-[0.2em]">VAT</span>
                    <span className={NUMBER_STYLE}>{formatCurrency(invoice.vat_amount, currency)}</span>
                  </div>
                )}

                <div className="pt-6 border-t-4 border-zinc-950 dark:border-white flex justify-between items-center">
                  <span className="text-sm font-black uppercase tracking-[0.3em] text-zinc-950 dark:text-white">Total</span>
                  <span className="text-4xl font-black tracking-tighter text-zinc-950 dark:text-white">
                    {formatCurrency(invoice.total_amount || 0, currency)}
                  </span>
                </div>
              </div>
            </div>

            {/* Invoice Terms */}
            {invoice.invoice_terms && (
              <div className="mt-12 p-8 bg-zinc-50 dark:bg-zinc-800/50 rounded-[32px] border border-zinc-100 dark:border-zinc-800">
                <h3 className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-[0.2em] flex items-center gap-2 mb-4">
                  <FileText className="w-3.5 h-3.5" style={{ color: settings?.brand_color || '#10b981' }} />
                  Terms & Conditions
                </h3>
                <p className="text-sm font-medium text-zinc-600 dark:text-zinc-400 whitespace-pre-wrap leading-relaxed">
                  {invoice.invoice_terms}
                </p>
              </div>
            )}
          </div>

          {/* Footer Branding */}
          <div className="bg-zinc-50 dark:bg-zinc-800/30 p-8 text-center border-t border-zinc-100 dark:border-zinc-800">
            <p className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.4em]">
              Generated by {settings.business_name || 'StockFlow'}
            </p>
          </div>
        </motion.div>

        <p className="mt-12 text-center text-zinc-400 dark:text-zinc-600 text-[10px] font-bold uppercase tracking-[0.2em]">
          &copy; {new Date().getFullYear()} {settings.business_name || 'StockFlow'}. All rights reserved.
        </p>
      </div>
    </div>
  );
}
