import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { motion } from 'motion/react';
import { Download, Building2, MapPin, Phone, Mail, FileText } from 'lucide-react';
import { generatePDF } from '../utils/pdfGenerator';

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

  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: currency || 'NGN',
      minimumFractionDigits: 0,
    }).format(amount);
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
      discount: invoice.discount_percentage || 0
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
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 py-12 px-4 sm:px-6 lg:px-8 font-sans">
      <div className="max-w-3xl mx-auto">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white dark:bg-zinc-900 rounded-3xl shadow-xl overflow-hidden border border-zinc-200 dark:border-zinc-800"
        >
          {/* Header */}
          <div className="p-8 sm:p-12 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6">
              <div>
                <h1 className="text-4xl font-black tracking-tight text-zinc-900 dark:text-white uppercase">Invoice</h1>
                <p className="text-zinc-500 dark:text-zinc-400 font-bold font-mono text-sm mt-1 opacity-50">#{invoice.invoice_number}</p>
              </div>
              <button
                onClick={handleDownload}
                className="inline-flex items-center gap-2 px-6 py-3 bg-zinc-900 hover:bg-zinc-800 dark:bg-white dark:hover:bg-zinc-100 text-white dark:text-zinc-900 rounded-full font-bold text-sm transition-all shadow-lg hover:shadow-xl hover:-translate-y-0.5"
              >
                <Download className="w-4 h-4" />
                Download PDF
              </button>
            </div>

            <div className="mt-12 grid grid-cols-1 sm:grid-cols-2 gap-12">
              <div>
                <p className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest mb-3">From</p>
                <h3 className="font-bold text-xl text-zinc-950 dark:text-white tracking-tight">{settings.business_name || 'Business Name'}</h3>
                <div className="mt-4 space-y-2">
                  {settings.email && (
                    <div className="flex items-center gap-2 text-zinc-500 dark:text-zinc-400 text-sm font-medium">
                      <Mail className="w-4 h-4 opacity-50" />
                      {settings.email}
                    </div>
                  )}
                  {settings.phone_number && (
                    <div className="flex items-center gap-2 text-zinc-500 dark:text-zinc-400 text-sm font-medium">
                      <Phone className="w-4 h-4 opacity-50" />
                      {settings.phone_number}
                    </div>
                  )}
                  {settings.address && (
                    <div className="flex items-start gap-2 text-zinc-500 dark:text-zinc-400 text-sm font-medium">
                      <MapPin className="w-4 h-4 opacity-50 mt-0.5" />
                      <span className="max-w-[200px] leading-relaxed">{settings.address}</span>
                    </div>
                  )}
                </div>
              </div>

              <div>
                <p className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest mb-3">Billed To</p>
                <h4 className="font-bold text-xl text-zinc-950 dark:text-white tracking-tight">{invoice.customer_name || invoice.customers?.name || invoice.customer_name_from_table || 'Walk-in Customer'}</h4>
                <div className="mt-4 space-y-2">
                  {(invoice.customer_email || invoice.customers?.email) && (
                    <p className="text-zinc-500 dark:text-zinc-400 text-sm font-medium">{invoice.customer_email || invoice.customers?.email}</p>
                  )}
                  {(invoice.customer_phone || invoice.customers?.phone) && (
                    <p className="text-zinc-500 dark:text-zinc-400 text-sm font-medium">{invoice.customer_phone || invoice.customers?.phone}</p>
                  )}
                  {(invoice.customer_address || invoice.customers?.address) && (
                    <p className="text-zinc-500 dark:text-zinc-400 text-sm font-medium max-w-[250px] leading-relaxed">{invoice.customer_address || invoice.customers?.address}</p>
                  )}
                </div>
              </div>
            </div>

            <div className="mt-12 grid grid-cols-2 gap-8 pt-8 border-t border-zinc-200 dark:border-zinc-800">
              <div>
                <p className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest mb-1">Date</p>
                <p className="font-bold text-zinc-950 dark:text-white text-lg">{new Date(invoice.created_at).toLocaleDateString()}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest mb-1">Payment Method</p>
                <p className="font-bold text-zinc-950 dark:text-white text-sm uppercase tracking-widest">{invoice.payment_method || 'Invoice'}</p>
              </div>
            </div>
          </div>

          {/* Items */}
          <div className="p-8 sm:p-12">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b-2 border-zinc-950 dark:border-white">
                    <th className="py-4 text-[10px] font-black uppercase tracking-widest text-zinc-950 dark:text-white w-1/2">Description</th>
                    <th className="py-4 text-[10px] font-black uppercase tracking-widest text-zinc-950 dark:text-white text-right">Qty</th>
                    <th className="py-4 text-[10px] font-black uppercase tracking-widest text-zinc-950 dark:text-white text-right">Price</th>
                    <th className="py-4 text-[10px] font-black uppercase tracking-widest text-zinc-950 dark:text-white text-right">Total</th>
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
                        <td className="py-6 pr-4">
                          <p className="font-bold text-zinc-950 dark:text-white text-sm">{fullName}</p>
                        </td>
                        <td className="py-6 px-4 text-right">
                          <span className="font-mono text-sm font-medium text-zinc-500 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800 px-2 py-1 rounded-md">
                            x{item.quantity}
                          </span>
                        </td>
                        <td className="py-6 px-4 text-right font-mono text-sm text-zinc-500 dark:text-zinc-400">
                          {formatCurrency(item.unit_price || item.price_at_sale || 0, currency)}
                        </td>
                        <td className="py-6 pl-4 text-right font-mono font-bold text-zinc-950 dark:text-white">
                          {formatCurrency(item.total_price || (item.quantity * (item.unit_price || item.price_at_sale || 0)), currency)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Totals */}
            <div className="mt-12 flex justify-end">
              <div className="w-full sm:w-1/2 lg:w-1/3 space-y-4">
                <div className="flex justify-between items-center text-zinc-500 dark:text-zinc-400">
                  <span className="text-[10px] font-bold uppercase tracking-widest">Subtotal</span>
                  <span className="font-mono text-sm">{formatCurrency((invoice.total_amount || 0) + (invoice.discount_amount || 0) - (invoice.vat_amount || 0), currency)}</span>
                </div>
                
                {invoice.discount_amount > 0 && (
                  <div className="flex justify-between items-center text-emerald-600 dark:text-emerald-400">
                    <span className="text-[10px] font-bold uppercase tracking-widest">Discount ({invoice.discount_percentage}%)</span>
                    <span className="font-mono font-bold">-{formatCurrency(invoice.discount_amount, currency)}</span>
                  </div>
                )}

                {invoice.vat_amount > 0 && (
                  <div className="flex justify-between items-center text-zinc-500 dark:text-zinc-400">
                    <span className="text-[10px] font-bold uppercase tracking-widest">VAT</span>
                    <span className="font-mono text-sm">{formatCurrency(invoice.vat_amount, currency)}</span>
                  </div>
                )}

                <div className="pt-4 border-t-2 border-zinc-950 dark:border-white flex justify-between items-center">
                  <span className="text-xs font-black uppercase tracking-widest text-zinc-950 dark:text-white">Total</span>
                  <span className="text-2xl font-black tracking-tight text-zinc-950 dark:text-white">
                    {formatCurrency(invoice.total_amount || 0, currency)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
