import React, { useState, useEffect, useCallback } from 'react';
import { useInView } from 'react-intersection-observer';
import { 
  Plus, 
  Trash2, 
  Download, 
  FileText, 
  Search, 
  User, 
  Mail, 
  Phone, 
  MapPin,
  Calendar,
  Hash,
  Package,
  Wrench,
  ChevronDown,
  Printer,
  Save,
  Loader2,
  Edit2,
  History,
  X,
  MessageCircle,
  Link as LinkIcon,
  Building2,
  Briefcase
} from 'lucide-react';
import { Input } from '../components/Input';
import { Textarea } from '../components/Textarea';
import { useAuth, useSettings } from '../App';
import { cn, formatCurrency, NUMBER_STYLE, getOptimizedImageUrl } from '../lib/utils';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'motion/react';
import { generatePDF as generatePDFUtil } from '../utils/pdfGenerator';

interface InvoiceItem {
  id: string;
  name: string;
  type: 'product' | 'service';
  quantity: number;
  price: number;
  total: number;
}

interface Recipient {
  name: string;
  email: string;
  phone: string;
  address: string;
}

const Invoices: React.FC = () => {
  const { user, fetchWithAuth } = useAuth();
  const { settings, businessLogo, businessName } = useSettings();

  const canManageInvoices = user?.role !== 'staff' || (user?.role === 'staff' && user?.permissions?.can_manage_sales);

  const [products, setProducts] = useState<any[]>([]);
  const [services, setServices] = useState<any[]>([]);
  const [invoiceItems, setInvoiceItems] = useState<InvoiceItem[]>([]);
  const [recipient, setRecipient] = useState<Recipient>({
    name: '',
    email: '',
    phone: '',
    address: ''
  });
  const generateInvoiceNumber = () => `INV-${Math.floor(100000 + Math.random() * 900000)}`;
  const [invoiceNumber, setInvoiceNumber] = useState(generateInvoiceNumber());
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().split('T')[0]);
  const [discount, setDiscount] = useState(0);
  const [invoiceTerms, setInvoiceTerms] = useState(settings?.invoice_terms || '');
  const [isGenerating, setIsGenerating] = useState(false);
  const [pastInvoices, setPastInvoices] = useState<any[]>([]);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [isLoadingInvoices, setIsLoadingInvoices] = useState(false);
  const { ref: loadMoreRef, inView } = useInView();
  const LIMIT = 20;

  const fetchInvoicesData = useCallback(async (pageIndex: number, isRefresh = false) => {
    if (!user) return;
    setIsLoadingInvoices(true);
    try {
      const res = await fetchWithAuth(`/api/invoices?limit=${LIMIT}&offset=${pageIndex * LIMIT}`);
      if (res.ok) {
        const invoices = await res.json();
        if (isRefresh) {
          setPastInvoices(invoices);
        } else {
          setPastInvoices(prev => [...prev, ...invoices]);
        }
        setHasMore(invoices.length === LIMIT);
      }
    } catch (error) {
      console.error('Error fetching invoices:', error);
    } finally {
      setIsLoadingInvoices(false);
    }
  }, [user, fetchWithAuth]);

  useEffect(() => {
    if (user) {
      fetchInvoicesData(0, true);
    }
  }, [user, fetchInvoicesData]);

  useEffect(() => {
    if (inView && hasMore && !isLoadingInvoices) {
      const nextPage = page + 1;
      setPage(nextPage);
      fetchInvoicesData(nextPage);
    }
  }, [inView, hasMore, isLoadingInvoices, page, fetchInvoicesData]);

  const fetchPastInvoices = () => fetchInvoicesData(0, true);

  const [isSaving, setIsSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'create' | 'history'>('create');
  const [searchTerm, setSearchTerm] = useState('');
  const [showItemDropdown, setShowItemDropdown] = useState(false);
  const [previewInvoice, setPreviewInvoice] = useState<any>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const batchRes = await fetchWithAuth('/api/batch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            endpoints: ['/api/products', '/api/services']
          })
        });

        if (!batchRes.ok) {
          throw new Error(`Batch fetch failed with status ${batchRes.status}`);
        }

        const [productsData, servicesData] = await batchRes.json();
        setProducts(Array.isArray(productsData) ? productsData : []);
        setServices(Array.isArray(servicesData) ? servicesData : []);
      } catch (err) {
        console.error('Failed to fetch initial data:', err);
      }
    };
    fetchData();
  }, []);

  const handleShareWhatsApp = (invoice: any) => {
    const currency = settings?.currency || 'NGN';
    
    // Handle both JSON string (from local state) and array of objects (from DB)
    let items = [];
    if (typeof invoice.items === 'string') {
      try {
        items = JSON.parse(invoice.items);
      } catch (e) {
        items = [];
      }
    } else if (Array.isArray(invoice.sale_items)) {
      items = invoice.sale_items.map((si: any) => {
        const baseName = si.product?.name || si.service?.name || si.product_variants?.products?.name || si.services?.name || si.product_name || si.service_name || si.product_name_from_table || si.service_name_from_table || 'Item';
        const variant = si.product_variants ? ` (${si.product_variants.size || ''}${si.product_variants.color ? ' - ' + si.product_variants.color : ''})` : 
                        (si.size ? ` (${si.size}${si.color ? ' - ' + si.color : ''})` : '');
        return {
          name: baseName.includes('(') ? baseName : baseName + variant,
          quantity: si.quantity || 0,
          total: si.total_price || (si.quantity * (si.unit_price || si.price_at_sale || 0))
        };
      });
    } else if (Array.isArray(invoice.items)) {
      items = invoice.items;
    }

    const maxItems = 10;
    const displayItems = items.slice(0, maxItems);
    let itemsText = displayItems.map((item: any) => `${item.name} (x${item.quantity}) - ${currency}${Number(item.total).toLocaleString()}`).join('\n');
    
    if (items.length > maxItems) {
      itemsText += `\n...and ${items.length - maxItems} more item(s)`;
    }
    
    const invoiceUrl = `${window.location.origin}/invoice/${invoice.id}`;
    
    const text = `*INVOICE: ${invoice.invoice_number}*\n\n` +
                 `*View Invoice Online:*\n${invoiceUrl}\n\n` +
                 `*Business:* ${settings?.business_name || 'Gryndee User'}\n` +
                 `*Date:* ${new Date(invoice.created_at).toLocaleDateString()}\n` +
                 `*Customer:* ${invoice.customer_name || invoice.customers?.name || invoice.customer_name_from_table || 'Walk-in Customer'}\n\n` +
                 `*Items:*\n${itemsText}\n\n` +
                 `*Total:* ${currency}${Number(invoice.total_amount).toLocaleString()}\n\n` +
                 `Thank you for your business!`;
    
    // Use a simpler encoding or check if the URL is properly formatted
    const encodedText = encodeURIComponent(text);
    const customerPhone = invoice.customer_phone || invoice.customers?.phone || '';
    // Use api.whatsapp.com for better compatibility sometimes
    const whatsappUrl = `https://api.whatsapp.com/send?phone=${customerPhone.replace(/\D/g, '')}&text=${encodedText}`;
    window.open(whatsappUrl, '_blank');
  };

  const handleCopyLink = (invoice: any) => {
    const invoiceLink = `${window.location.origin}/invoice/${invoice.id}`;
    navigator.clipboard.writeText(invoiceLink).then(() => {
      toast.success('Invoice link copied to clipboard');
    }).catch((err) => {
      console.error('Failed to copy link: ', err);
      toast.error('Failed to copy link');
    });
  };

  const resetForm = () => {
    setInvoiceNumber(generateInvoiceNumber());
    setInvoiceDate(new Date().toISOString().split('T')[0]);
    setInvoiceItems([]);
    setRecipient({
      name: '',
      email: '',
      phone: '',
      address: ''
    });
    setDiscount(0);
    setSearchTerm('');
  };

  const loadInvoice = (invoice: any) => {
    try {
      setInvoiceNumber(invoice.invoice_number || `INV-${Date.now().toString().slice(-6)}`);
      setInvoiceDate(invoice.created_at ? new Date(invoice.created_at).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]);
      setDiscount(invoice.discount_percentage || 0);
      setInvoiceTerms(invoice.invoice_terms || settings?.invoice_terms || '');
      setRecipient({
        name: invoice.customer_name || (invoice.customers?.name) || '',
        email: invoice.customer_email || (invoice.customers?.email) || '', 
        phone: invoice.customer_phone || (invoice.customers?.phone) || '',
        address: invoice.customer_address || (invoice.customers?.address) || ''
      });
      
      if (invoice.sale_items && Array.isArray(invoice.sale_items)) {
        const items: InvoiceItem[] = invoice.sale_items.map((si: any) => {
          // Try to get name from various possible sources
          const name = 
            si.product_variants?.products?.name || 
            si.services?.name || 
            si.product_name || 
            si.service_name || 
            'Item';
            
          const variantInfo = si.product_variants ? 
            ` (${si.product_variants.size || ''}${si.product_variants.size && si.product_variants.color ? ' - ' : ''}${si.product_variants.color || ''})` : 
            '';

          return {
            id: si.variant_id || si.service_id || Math.random().toString(),
            name: name.includes('(') ? name : name + variantInfo,
            type: si.service_id ? 'service' : 'product',
            quantity: si.quantity || 0,
            price: si.unit_price || si.price_at_sale || 0,
            total: si.total_price || (si.quantity * (si.unit_price || si.price_at_sale || 0))
          };
        });
        setInvoiceItems(items);
      } else {
        setInvoiceItems([]);
      }

      setActiveTab('create');
      toast.success('Invoice loaded successfully');
    } catch (error) {
      console.error('Error loading invoice:', error);
      toast.error('Failed to load invoice details');
    }
  };

  const handleDownload = (inv: any) => {
    if (!inv || !inv.sale_items) {
      toast.error('Invalid invoice data');
      return;
    }

    const mappedItems = inv.sale_items.map((si: any) => {
      const baseName = si.product_variants?.products?.name || si.services?.name || si.product_name || si.service_name || 'Item';
      const variant = si.product_variants ? ` (${si.product_variants.size || ''}${si.product_variants.color ? ' - ' + si.product_variants.color : ''})` : '';
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
        name: inv.customer_name || inv.customers?.name || 'Walk-in Customer',
        email: inv.customer_email || inv.customers?.email || '',
        phone: inv.customer_phone || inv.customers?.phone || '',
        address: inv.customer_address || inv.customers?.address || ''
      },
      invoiceNumber: inv.invoice_number,
      invoiceDate: new Date(inv.created_at).toLocaleDateString(),
      discount: inv.discount_percentage || 0,
      invoiceTerms: inv.invoice_terms || settings?.invoice_terms || '',
      vat_amount: inv.vat_amount || 0
    };

    generatePDF(mappedData);
  };

  const handlePreview = (inv: any) => {
    setPreviewInvoice(inv);
  };

  const saveInvoice = async () => {
    if (invoiceItems.length === 0) {
      toast.error('Please add at least one item');
      return;
    }

    setIsSaving(true);
    try {
      const subtotal = calculateSubtotal();
      const discountAmount = calculateDiscountAmount();
      const vatAmount = calculateVAT();
      const total = subtotal - discountAmount + vatAmount;

      const payload = {
        items: invoiceItems.map(item => ({
          variant_id: item.type === 'product' ? item.id : undefined,
          service_id: item.type === 'service' ? item.id : undefined,
          quantity: item.quantity,
          price_override: item.price
        })),
        customer_name: recipient.name,
        customer_phone: recipient.phone,
        customer_email: recipient.email,
        customer_address: recipient.address,
        invoice_number: invoiceNumber,
        discount_percentage: discount,
        discount_amount: discountAmount,
        vat_amount: vatAmount,
        total_amount: total,
        payment_method: 'Invoice',
        status: 'Pending',
        invoice_terms: invoiceTerms
      };

      const res = await fetchWithAuth('/api/sales', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        toast.success('Invoice saved successfully');
        resetForm();
        fetchPastInvoices();
        setActiveTab('history');
      } else {
        const err = await res.json();
        toast.error(err.error || 'Failed to save invoice');
      }
    } catch (error) {
      toast.error('An error occurred while saving');
    } finally {
      setIsSaving(false);
    }
  };

  const fetchInventory = async () => {
    try {
      const batchRes = await fetchWithAuth('/api/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          endpoints: ['/api/products', '/api/services']
        })
      });

      if (!batchRes.ok) {
        throw new Error(`Batch fetch failed with status ${batchRes.status}`);
      }

      const [productsData, servicesData] = await batchRes.json();
      setProducts(Array.isArray(productsData) ? productsData : []);
      setServices(Array.isArray(servicesData) ? servicesData : []);
    } catch (error) {
      console.error('Error fetching inventory:', error);
      toast.error('Failed to load inventory items');
    }
  };

  const addItem = (item: any, type: 'product' | 'service') => {
    let itemId = item.id;
    let itemPrice = type === 'product' ? (item.selling_price || 0) : (item.price || 0);
    let itemName = item.name;

    // If it's a product, we MUST use a variant ID for the backend to work correctly
    if (type === 'product') {
      if (item.product_variants && item.product_variants.length > 0) {
        const variant = item.product_variants[0];
        itemId = variant.id;
        itemPrice = variant.selling_price || item.selling_price || 0;
        if (variant.size || variant.color) {
          itemName += ` (${variant.size || ''}${variant.size && variant.color ? ' - ' : ''}${variant.color || ''})`;
        }
      } else {
        toast.error('This product has no variants/price defined');
        return;
      }
    }

    const newItem: InvoiceItem = {
      id: itemId,
      name: itemName,
      type,
      quantity: 1,
      price: itemPrice,
      total: itemPrice
    };
    setInvoiceItems([...invoiceItems, newItem]);
    setShowItemDropdown(false);
    setSearchTerm('');
  };

  const removeItem = (index: number) => {
    setInvoiceItems(invoiceItems.filter((_, i) => i !== index));
  };

  const updateQuantity = (index: number, qty: number) => {
    const updated = [...invoiceItems];
    updated[index].quantity = Math.max(1, qty);
    updated[index].total = updated[index].quantity * updated[index].price;
    setInvoiceItems(updated);
  };

  const updatePrice = (index: number, price: number) => {
    const updated = [...invoiceItems];
    updated[index].price = Math.max(0, price);
    updated[index].total = updated[index].quantity * updated[index].price;
    setInvoiceItems(updated);
  };

  const updateInvoiceTerms = async () => {
    setIsSaving(true);
    try {
      const res = await fetchWithAuth('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invoice_terms: invoiceTerms })
      });
      if (res.ok) {
        toast.success('Invoice terms updated');
      } else {
        toast.error('Failed to update invoice terms');
      }
    } catch (error) {
      toast.error('An error occurred');
    } finally {
      setIsSaving(false);
    }
  };

  const calculateSubtotal = () => {
    return invoiceItems.reduce((sum, item) => sum + item.total, 0);
  };

  const calculateDiscountAmount = () => {
    return (calculateSubtotal() * discount) / 100;
  };

  const calculateVAT = () => {
    if (!settings?.vat_enabled) return 0;
    const afterDiscount = calculateSubtotal() - calculateDiscountAmount();
    return afterDiscount * 0.075; // 7.5% VAT
  };

  const calculateTotal = () => {
    return calculateSubtotal() - calculateDiscountAmount() + calculateVAT();
  };

  const generatePDF = async (data?: any) => {
    // Check if data is an event (e.g. from onClick) or actual data
    const isExternal = data && typeof data === 'object' && 'items' in data;
    
    const items = isExternal ? data.items : invoiceItems;
    const rec = isExternal ? data.recipient : recipient;
    const num = isExternal ? data.invoiceNumber : invoiceNumber;
    const date = isExternal ? data.invoiceDate : invoiceDate;
    const disc = isExternal ? data.discount : discount;
    const terms = isExternal ? data.invoiceTerms : invoiceTerms;
    const vatEnabled = isExternal ? data.vat_amount > 0 : settings?.vat_enabled;
    const vatAmount = isExternal ? data.vat_amount : calculateVAT();

    if (!items || items.length === 0) {
      toast.error('Please add at least one item to the invoice');
      return;
    }
    if (!rec || !rec.name) {
      toast.error('Please add recipient name');
      return;
    }

    setIsGenerating(true);
    try {
      await generatePDFUtil({
        items,
        recipient: rec,
        invoiceNumber: num,
        invoiceDate: date,
        discount: disc,
        invoiceTerms: terms,
        vatEnabled,
        vatAmount
      }, { ...settings, logo_url: businessLogo || settings?.logo_url, business_name: businessName || settings?.business_name });
      toast.success('Invoice generated successfully');
    } catch (error) {
      console.error('Error generating PDF:', error);
      toast.error('Failed to generate PDF');
    } finally {
      setIsGenerating(false);
    }
  };

  const filteredItems = [...products, ...services].filter(item => 
    String(item.name || '').toLowerCase().includes(String(searchTerm || '').toLowerCase())
  );

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-10">
        <div>
          <h1 className="h1">
            Invoicing System
          </h1>
          <p className="body-text mt-1">
            {activeTab === 'create' ? 'Generate professional invoices for your clients' : 'View and manage your past invoices'}
          </p>
        </div>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 w-full md:w-auto">
          <div className="flex bg-zinc-100 dark:bg-zinc-800 p-1 rounded-2xl w-full sm:w-auto">
            <button
              onClick={() => setActiveTab('create')}
              className={cn(
                "flex-1 sm:flex-none px-6 py-2.5 rounded-xl text-[10px] font-bold transition-all uppercase tracking-[0.2em]",
                activeTab === 'create' ? "bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white shadow-sm" : "text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
              )}
            >
              Create
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={cn(
                "flex-1 sm:flex-none px-6 py-2.5 rounded-xl text-[10px] font-bold transition-all uppercase tracking-[0.2em]",
                activeTab === 'history' ? "bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white shadow-sm" : "text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
              )}
            >
              History
            </button>
          </div>

          {activeTab === 'create' && canManageInvoices && (
            <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
              <button
                onClick={resetForm}
                className="btn-secondary p-3"
                title="Reset Form"
              >
                <Plus className="w-5 h-5" />
              </button>
              <button
                onClick={saveInvoice}
                disabled={isSaving || invoiceItems.length === 0}
                className="btn-primary flex-1 sm:flex-none"
              >
                {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                Save
              </button>
              <button
                onClick={generatePDF}
                disabled={isGenerating}
                className="btn-primary flex-1 sm:flex-none"
              >
                {isGenerating ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <Download className="w-5 h-5" />
                )}
                {isGenerating ? 'Generating...' : 'Download'}
              </button>
            </div>
          )}
        </div>
      </div>

      {activeTab === 'history' ? (
        <div className="glass-card overflow-hidden">
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50/30 dark:bg-zinc-900/30">
                  <th className="px-8 py-6 label-text">Invoice #</th>
                  <th className="px-8 py-6 label-text">Date</th>
                  <th className="px-8 py-6 label-text">Client</th>
                  <th className="px-8 py-6 label-text">Amount</th>
                  <th className="px-8 py-6 label-text text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {pastInvoices.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-8 py-20 text-center">
                      <div className="flex flex-col items-center gap-4 text-zinc-400">
                        <div className="w-20 h-20 rounded-[2.5rem] bg-zinc-50 dark:bg-zinc-800 flex items-center justify-center">
                          <History className="w-10 h-10 opacity-20" />
                        </div>
                        <p className="font-medium">No saved invoices found</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  pastInvoices.map((inv) => (
                    <tr key={inv.id} className="hover:bg-zinc-900 hover:text-white dark:hover:bg-white dark:hover:text-zinc-900 transition-all group cursor-pointer">
                      <td className="px-8 py-6">
                        <span className={cn(NUMBER_STYLE, "tracking-tighter")}>#{inv.invoice_number}</span>
                      </td>
                      <td className="px-8 py-6">
                        <div className="flex items-center gap-2 text-sm font-bold opacity-70">
                          <Calendar className="w-3.5 h-3.5 opacity-50" />
                          {new Date(inv.created_at).toLocaleDateString()}
                        </div>
                      </td>
                      <td className="px-8 py-6">
                        <div className="flex flex-col">
                          <span className="font-bold tracking-tight">{inv.customer_name || 'Walk-in Customer'}</span>
                          <span className="text-[10px] font-bold opacity-50 uppercase tracking-widest">{inv.customer_phone}</span>
                        </div>
                      </td>
                      <td className="px-8 py-6">
                        <span className={cn(NUMBER_STYLE, "text-sm")}>
                          <span className="opacity-50 mr-1 text-xs">{settings?.currency || '₦'}</span>
                          {inv.total_amount?.toLocaleString()}
                        </span>
                      </td>
                      <td className="px-8 py-6 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => handlePreview(inv)}
                            className="p-2.5 text-zinc-400 dark:text-zinc-500 group-hover:text-white dark:group-hover:text-zinc-900 hover:bg-white/10 dark:hover:bg-black/10 rounded-xl transition-all"
                            title="Preview"
                          >
                            <FileText className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleShareWhatsApp(inv)}
                            className="p-2.5 text-zinc-400 dark:text-zinc-500 group-hover:text-white dark:group-hover:text-zinc-900 hover:bg-white/10 dark:hover:bg-black/10 rounded-xl transition-all"
                            title="Share on WhatsApp"
                          >
                            <MessageCircle className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleCopyLink(inv)}
                            className="p-2.5 text-zinc-400 dark:text-zinc-500 group-hover:text-white dark:group-hover:text-zinc-900 hover:bg-white/10 dark:hover:bg-black/10 rounded-xl transition-all"
                            title="Copy Link"
                          >
                            <LinkIcon className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDownload(inv)}
                            className="p-2.5 text-zinc-400 dark:text-zinc-500 group-hover:text-white dark:group-hover:text-zinc-900 hover:bg-white/10 dark:hover:bg-black/10 rounded-xl transition-all"
                            title="Download PDF"
                          >
                            <Download className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => loadInvoice(inv)}
                            className="p-2.5 text-zinc-400 dark:text-zinc-500 group-hover:text-white dark:group-hover:text-zinc-900 hover:bg-white/10 dark:hover:bg-black/10 rounded-xl transition-all"
                            title="Edit / Load"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile View */}
          <div className="md:hidden divide-y divide-zinc-100 dark:divide-zinc-800">
            {pastInvoices.length === 0 ? (
              <div className="p-12 text-center">
                <div className="flex flex-col items-center gap-4 text-zinc-400">
                  <div className="w-16 h-16 rounded-3xl bg-zinc-50 dark:bg-zinc-800 flex items-center justify-center">
                    <History className="w-8 h-8 opacity-20" />
                  </div>
                  <p className="text-sm">No invoices found</p>
                </div>
              </div>
            ) : (
              <>
                {pastInvoices.map((inv) => (
                <div key={inv.id} className="p-6 space-y-4 hover:bg-zinc-50/50 dark:hover:bg-zinc-800/50 transition-colors">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className={cn(NUMBER_STYLE, "tracking-tighter text-zinc-900 dark:text-white")}>#{inv.invoice_number}</p>
                      <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mt-0.5">
                        {new Date(inv.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handlePreview(inv)}
                        className="p-2.5 bg-brand/10 text-brand rounded-xl active:scale-95 transition-all"
                      >
                        <FileText className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleShareWhatsApp(inv)}
                        className="p-2.5 bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 rounded-xl active:scale-95 transition-all"
                      >
                        <MessageCircle className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleCopyLink(inv)}
                        className="p-2.5 bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 rounded-xl active:scale-95 transition-all"
                      >
                        <LinkIcon className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDownload(inv)}
                        className="p-2.5 bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 rounded-xl active:scale-95 transition-all"
                      >
                        <Download className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2">
                    <div>
                      <p className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest mb-1">Client</p>
                      <p className="text-xs font-bold text-zinc-900 dark:text-white">{inv.customer_name || 'Walk-in'}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest mb-1">Total</p>
                      <p className={cn(NUMBER_STYLE, "text-brand")}>
                        {formatCurrency(inv.total_amount, settings?.currency || '₦')}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
              {hasMore && (
                <div ref={loadMoreRef} className="py-8 flex justify-center">
                  <div className="w-6 h-6 border-2 border-brand border-t-transparent rounded-full animate-spin" />
                </div>
              )}
            </>
          )}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Invoice Details & Items */}
        <div className="lg:col-span-2 space-y-8">
          {/* Invoice Header Info */}
          <div className="glass-card p-8 grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-2">
              <label className="label-text">Invoice Number</label>
              <div className="relative">
                <Hash className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                <Input
                  type="text"
                  value={invoiceNumber}
                  onChange={(e) => setInvoiceNumber(e.target.value)}
                  className="pl-12"
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="label-text">Invoice Date</label>
              <div className="relative">
                <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                <Input
                  type="date"
                  value={invoiceDate}
                  onChange={(e) => setInvoiceDate(e.target.value)}
                  className="pl-12"
                />
              </div>
            </div>
          </div>

          {/* Item Selection */}
          <div className="glass-card p-8">
            <div className="flex items-center justify-between mb-8">
              <h2 className="h2">Invoice Items</h2>
              <div className="relative">
                <button
                  onClick={() => setShowItemDropdown(!showItemDropdown)}
                  className="btn-primary"
                >
                  <Plus className="w-4 h-4" />
                  Add Item
                  <ChevronDown className={`w-4 h-4 transition-transform ${showItemDropdown ? 'rotate-180' : ''}`} />
                </button>

                <AnimatePresence>
                  {showItemDropdown && (
                    <motion.div
                      initial={{ opacity: 0, y: 10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 10, scale: 0.95 }}
                      className="absolute right-0 mt-4 w-96 bg-white dark:bg-zinc-900 rounded-[2rem] shadow-[0_20px_50px_rgba(0,0,0,0.2)] border border-zinc-100 dark:border-zinc-800 z-50 overflow-hidden"
                    >
                      <div className="p-4 border-b border-zinc-100 dark:border-zinc-800 flex items-center gap-2">
                        <div className="relative flex-1">
                          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                          <Input
                            type="text"
                            placeholder="Search inventory..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-12"
                            autoFocus
                          />
                        </div>
                        <button 
                          onClick={() => setShowItemDropdown(false)}
                          className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl transition-colors"
                        >
                          <X className="w-4 h-4 text-zinc-400" />
                        </button>
                      </div>
                      <div className="max-h-80">
                        {filteredItems.length > 0 ? (
                          filteredItems.map((item) => (
                            <button
                              key={`${item.id}-${item.price ? 'service' : 'product'}`}
                              onClick={() => addItem(item, item.price ? 'service' : 'product')}
                              className="w-full flex items-center justify-between p-4 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors text-left group"
                            >
                              <div className="flex items-center gap-4">
                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${item.price ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600' : 'bg-orange-50 dark:bg-orange-900/20 text-orange-600'}`}>
                                  {item.price ? <Wrench className="w-4 h-4" /> : <Package className="w-4 h-4" />}
                                </div>
                                <div>
                                  <p className="text-sm font-bold text-zinc-900 dark:text-white">{item.name}</p>
                                  <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">{item.price ? 'Service' : 'Product'}</p>
                                </div>
                              </div>
                              <p className={`text-sm ${NUMBER_STYLE} text-zinc-900 dark:text-white`}>
                                <span className="opacity-50 mr-1 text-xs">{settings?.currency || '₦'}</span>
                                {(item.price || item.selling_price || 0).toLocaleString()}
                              </p>
                            </button>
                          ))
                        ) : (
                          <div className="p-12 text-center text-zinc-400">
                            <Search className="w-12 h-12 mx-auto mb-4 opacity-10" />
                            <p className="text-sm">No items found</p>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>

            <div className="overflow-x-auto sm:overflow-visible">
              <table className="w-full">
                <thead className="hidden sm:table-header-group">
                  <tr className="text-left border-b border-zinc-100 dark:border-zinc-800">
                    <th className="pb-6 label-text">Description</th>
                    <th className="pb-6 label-text w-24">Qty</th>
                    <th className="pb-6 label-text w-40">Price</th>
                    <th className="pb-6 label-text w-40">Total</th>
                    <th className="pb-6 w-10"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                  {invoiceItems.length > 0 ? (
                    invoiceItems.map((item, index) => (
                      <tr key={index} className="group flex flex-col sm:table-row py-4 sm:py-0">
                        <td className="py-2 sm:py-6 flex justify-between items-center sm:table-cell">
                          <span className="sm:hidden text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Description</span>
                          <div className="flex items-center gap-4">
                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${item.type === 'service' ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600' : 'bg-orange-50 dark:bg-orange-900/20 text-orange-600'}`}>
                              {item.type === 'service' ? <Wrench className="w-4 h-4" /> : <Package className="w-4 h-4" />}
                            </div>
                            <span className="text-sm font-bold tracking-tight">{item.name}</span>
                          </div>
                        </td>
                        <td className="py-2 sm:py-6 flex justify-between items-center sm:table-cell">
                          <span className="sm:hidden text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Qty</span>
                          <Input
                            type="number"
                            value={item.quantity}
                            onChange={(e) => updateQuantity(index, parseInt(e.target.value))}
                            className={cn("w-20 text-center", NUMBER_STYLE)}
                          />
                        </td>
                        <td className="py-2 sm:py-6 flex justify-between items-center sm:table-cell">
                          <span className="sm:hidden text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Price</span>
                          <div className="relative">
                            <span className={`absolute left-0 top-1/2 -translate-y-1/2 text-zinc-400 text-xs ${NUMBER_STYLE}`}>{settings?.currency || '₦'}</span>
                            <Input
                              type="number"
                              value={item.price}
                              onChange={(e) => updatePrice(index, parseFloat(e.target.value))}
                              className={cn("w-32 pl-6", NUMBER_STYLE)}
                            />
                          </div>
                        </td>
                        <td className="py-2 sm:py-6 flex justify-between items-center sm:table-cell">
                          <span className="sm:hidden text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Total</span>
                          <span className={`text-sm ${NUMBER_STYLE} text-zinc-950 dark:text-white`}>
                            <span className="opacity-50 mr-1 text-xs">{settings?.currency || '₦'}</span>
                            {item.total.toLocaleString()}
                          </span>
                        </td>
                        <td className="py-2 sm:py-6 flex justify-end sm:table-cell">
                          <button
                            onClick={() => removeItem(index)}
                            className="p-3 text-zinc-300 hover:text-red-500 hover:bg-red-500/10 rounded-2xl transition-all"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5} className="py-12 text-center">
                        <div className="flex flex-col items-center gap-4 text-zinc-400">
                          <div className="w-16 h-16 rounded-[2rem] bg-zinc-50 dark:bg-zinc-800 flex items-center justify-center">
                            <Package className="w-8 h-8 opacity-20" />
                          </div>
                          <p className="text-sm">No items added to invoice yet</p>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Invoice Summary */}
          <div className="glass-card p-8 space-y-6">
            <h2 className="h2">Invoice Summary</h2>
            <div className="space-y-4">
              <div className="flex items-center justify-between text-zinc-600 dark:text-zinc-400">
                <span className="label-text">Subtotal</span>
                <span className="font-bold text-zinc-950 dark:text-white">{settings?.currency || '₦'}{calculateSubtotal().toLocaleString()}</span>
              </div>
              
              <div className="flex items-center justify-between text-zinc-600 dark:text-zinc-400">
                <span className="label-text">Discount (%)</span>
                <Input
                  type="number"
                  value={discount}
                  onChange={(e) => setDiscount(Math.min(100, Math.max(0, parseFloat(e.target.value) || 0)))}
                  className="w-20 text-right"
                />
              </div>

              {settings?.vat_enabled && (
                <div className="flex items-center justify-between text-zinc-600 dark:text-zinc-400">
                  <span className="label-text">VAT (7.5%)</span>
                  <span className="font-bold text-zinc-950 dark:text-white">
                    <span className="opacity-50 mr-1 text-xs">{settings?.currency || '₦'}</span>
                    {calculateVAT().toLocaleString()}
                  </span>
                </div>
              )}
              
              <div className="pt-6 border-t border-zinc-100 dark:border-zinc-800 flex justify-between items-end">
                <div>
                  <p className="label-text mb-1">Total Amount</p>
                  <p className={cn(NUMBER_STYLE, "h1")}>
                    <span className="opacity-30 mr-2 text-xl">{settings?.currency || '₦'}</span>
                    {calculateTotal().toLocaleString()}
                  </p>
                </div>
              </div>

              {/* Invoice Terms */}
              <div className="pt-6 border-t border-zinc-100 dark:border-zinc-800">
                <span className="label-text mb-2 block">Invoice Terms</span>
                <Textarea
                  value={invoiceTerms}
                  onChange={(e) => setInvoiceTerms(e.target.value)}
                  placeholder="e.g. Payment is due within 30 days."
                  rows={3}
                />
                <button
                  onClick={updateInvoiceTerms}
                  disabled={isSaving}
                  className="btn-primary mt-3"
                >
                  {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  Update Terms
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Recipient & Payment Details */}
        <div className="space-y-8">
          {/* Recipient Info */}
          <div className="glass-card p-8">
            <h2 className="h2 mb-8 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center">
                <User className="w-5 h-5 text-zinc-500" />
              </div>
              Recipient Details
            </h2>
            <div className="space-y-6">
              <div className="space-y-2">
                <label className="label-text">Client Name</label>
                <div className="relative">
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                  <Input
                    type="text"
                    placeholder="John Doe"
                    value={recipient.name}
                    onChange={(e) => setRecipient({ ...recipient, name: e.target.value })}
                    className="pl-12"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="label-text">Email Address</label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                  <Input
                    type="email"
                    placeholder="john@example.com"
                    value={recipient.email}
                    onChange={(e) => setRecipient({ ...recipient, email: e.target.value })}
                    className="pl-12"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="label-text">Phone Number</label>
                <div className="relative">
                  <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                  <Input
                    type="tel"
                    placeholder="+234..."
                    value={recipient.phone}
                    onChange={(e) => setRecipient({ ...recipient, phone: e.target.value })}
                    className="pl-12"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-[0.2em]">Address</label>
                <div className="relative">
                  <MapPin className="absolute left-4 top-4 w-4 h-4 text-zinc-400" />
                  <Textarea
                    placeholder="123 Street, City, Country"
                    value={recipient.address}
                    onChange={(e) => setRecipient({ ...recipient, address: e.target.value })}
                    rows={3}
                    className="pl-12"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Payment Details moved to its own section */}
          {(settings?.bank_name || settings?.account_name || settings?.account_number) && (
            <div className="glass-card p-8">
              <h5 className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-400 mb-4">Payment Details</h5>
              <div className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed font-medium">
                {settings?.bank_name && <p><span className="font-bold text-zinc-900 dark:text-zinc-300">Bank:</span> {settings.bank_name}</p>}
                {settings?.account_name && <p><span className="font-bold text-zinc-900 dark:text-zinc-300">Account Name:</span> {settings.account_name}</p>}
                {settings?.account_number && <p><span className="font-bold text-zinc-900 dark:text-zinc-300">Account Number:</span> {settings.account_number}</p>}
              </div>
            </div>
          )}
        </div>
      </div>
    )}
    {previewInvoice && (
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-zinc-950/40 backdrop-blur-md">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          className="bg-white dark:bg-zinc-900 rounded-[3rem] shadow-[0_40px_100px_rgba(0,0,0,0.3)] w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col border border-zinc-200 dark:border-zinc-800"
        >
          <div className="p-10 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between bg-zinc-50/50 dark:bg-zinc-800/30">
            <div>
              <h2 className="text-3xl font-bold text-zinc-950 dark:text-white tracking-tight font-display">Invoice Preview</h2>
              <p className="text-zinc-400 dark:text-zinc-500 font-sans font-bold text-sm mt-1 tracking-widest uppercase">NO. {previewInvoice.invoice_number}</p>
            </div>
            <div className="flex items-center gap-4">
              <button
                onClick={() => handleCopyLink(previewInvoice)}
                className="p-4 bg-blue-500 hover:bg-blue-600 text-white rounded-2xl transition-all active:scale-95 shadow-lg shadow-blue-500/20"
                title="Copy Invoice Link"
              >
                <LinkIcon className="w-6 h-6" />
              </button>
              <button
                onClick={() => handleShareWhatsApp(previewInvoice)}
                className="p-4 bg-brand hover:bg-brand-hover text-white rounded-2xl transition-all active:scale-95 shadow-lg shadow-brand/20"
                title="Share on WhatsApp"
              >
                <MessageCircle className="w-6 h-6" />
              </button>
              <button
                onClick={() => handleDownload(previewInvoice)}
                className="flex items-center gap-3 px-8 py-4 bg-zinc-900 hover:bg-zinc-800 dark:bg-white dark:hover:bg-zinc-100 text-white dark:text-zinc-900 rounded-2xl font-bold text-sm transition-all shadow-xl hover:shadow-2xl hover:-translate-y-0.5"
              >
                <Download className="w-5 h-5" />
                Download PDF
              </button>
              <button
                onClick={() => setPreviewInvoice(null)}
                className="p-4 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-500 dark:text-zinc-400 rounded-2xl transition-all active:scale-95"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
          </div>
          
          <div className="flex-1 p-12 overflow-y-auto space-y-12">
            {/* Header Section */}
            <div className="flex flex-col md:flex-row justify-between items-start gap-12">
              <div className="space-y-6">
                {settings?.logo_url ? (
                  <img src={settings.logo_url} alt="Logo" className="h-20 w-auto object-contain" referrerPolicy="no-referrer" />
                ) : (
                  <div className="w-16 h-16 bg-zinc-100 dark:bg-zinc-800 rounded-2xl flex items-center justify-center">
                    <Building2 className="w-8 h-8 text-zinc-400" />
                  </div>
                )}
                <div>
                  <h3 className="font-bold text-2xl text-zinc-950 dark:text-white tracking-tight">{settings?.business_name || 'Business Name'}</h3>
                  <div className="mt-4 space-y-1.5 text-zinc-500 dark:text-zinc-400 text-xs font-medium">
                    {settings?.email && <p className="flex items-center gap-2"><Mail className="w-3.5 h-3.5 opacity-50" /> {settings.email}</p>}
                    {settings?.phone_number && <p className="flex items-center gap-2"><Phone className="w-3.5 h-3.5 opacity-50" /> {settings.phone_number}</p>}
                    {settings?.address && (
                      <p className="flex items-start gap-2">
                        <MapPin className="w-3.5 h-3.5 opacity-50 mt-1" />
                        <span className="max-w-[240px] leading-relaxed">{settings.address}</span>
                      </p>
                    )}
                  </div>
                </div>
              </div>

              <div className="text-left md:text-right space-y-6">
                <div>
                  <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-[0.2em] mb-2">Date Issued</p>
                  <p className="font-bold text-zinc-950 dark:text-white text-lg tracking-tight">
                    {new Date(previewInvoice.created_at).toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' })}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-[0.2em] mb-2">Payment Status</p>
                  <div className="inline-flex items-center px-3 py-1 rounded-full bg-brand/10 text-brand text-[10px] font-bold uppercase tracking-widest">
                    {previewInvoice.payment_method || 'Paid'}
                  </div>
                </div>
              </div>
            </div>

            {/* Billed To Section */}
            <div className="p-8 bg-zinc-50 dark:bg-zinc-800/50 rounded-[32px] border border-zinc-100 dark:border-zinc-800">
              <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-[0.2em] mb-2">Billed To</p>
              <h4 className="font-bold text-xl text-zinc-950 dark:text-white tracking-tight leading-tight">
                {previewInvoice.customer_name || 'Walk-in Customer'}
              </h4>
              <div className="mt-2 space-y-1 text-zinc-500 dark:text-zinc-400 text-sm font-medium">
                {previewInvoice.customer_email && <p>{previewInvoice.customer_email}</p>}
                {previewInvoice.customer_phone && <p>{previewInvoice.customer_phone}</p>}
                {previewInvoice.customer_address && <p className="max-w-[300px]">{previewInvoice.customer_address}</p>}
              </div>
            </div>

            {/* Items Table */}
            <div className="mt-16">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-zinc-200 dark:border-zinc-800">
                    <th className="pb-6 text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-400 w-1/2">Description</th>
                    <th className="pb-6 text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-400 text-center">Qty</th>
                    <th className="pb-6 text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-400 text-right">Price</th>
                    <th className="pb-6 text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-400 text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/50">
                  {previewInvoice.sale_items?.map((item: any, idx: number) => {
                    const name = item.product?.name || item.service?.name || item.product_variants?.products?.name || item.services?.name || item.product_name || item.service_name || 'Item';
                    const variant = item.product_variants ? ` (${item.product_variants.size || ''}${item.product_variants.color ? ' - ' + item.product_variants.color : ''})` : '';
                    return (
                      <tr key={idx} className="group">
                        <td className="py-8 pr-4">
                          <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center overflow-hidden border border-zinc-200 dark:border-zinc-700">
                              {item.image || item.product?.image || item.service?.image_url || item.product_variants?.products?.image || item.services?.image_url ? (
                                <img 
                                  src={getOptimizedImageUrl(item.image || item.product?.image || item.service?.image_url || item.product_variants?.products?.image || item.services?.image_url)} 
                                  alt={name} 
                                  className="w-full h-full object-cover" 
                                  referrerPolicy="no-referrer" 
                                />
                              ) : (
                                item.service_id ? <Briefcase className="w-5 h-5 text-zinc-400" /> : <Package className="w-5 h-5 text-zinc-400" />
                              )}
                            </div>
                            <div>
                              <p className="font-bold text-zinc-950 dark:text-white text-base tracking-tight">{name}{variant}</p>
                              <p className="text-xs text-zinc-400 mt-1 font-medium">{item.service_id ? 'Service' : 'Product'}</p>
                            </div>
                          </div>
                        </td>
                        <td className="py-8 px-4 text-center">
                          <span className={`${NUMBER_STYLE} text-sm text-zinc-950 dark:text-white`}>
                            {item.quantity}
                          </span>
                        </td>
                        <td className={`py-8 px-4 text-right ${NUMBER_STYLE} text-sm text-zinc-500 dark:text-zinc-400`}>
                          {formatCurrency(item.unit_price || 0, settings?.currency || 'NGN')}
                        </td>
                        <td className={`py-8 pl-4 text-right ${NUMBER_STYLE} text-zinc-950 dark:text-white text-base`}>
                          {formatCurrency(item.total_price || 0, settings?.currency || 'NGN')}
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
                  <h5 className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-400 mb-4">Terms & Conditions</h5>
                  <p className="text-sm text-zinc-500 dark:text-zinc-400 leading-relaxed font-medium">
                    {previewInvoice.invoice_terms || settings?.invoice_terms || `Thank you for your business. We appreciate your trust in ${settings?.business_name || 'us'}.`}
                  </p>
                </div>
                
                {(settings?.bank_name || settings?.account_name || settings?.account_number) && (
                  <div>
                    <h5 className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-400 mb-4">Payment Details</h5>
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
                  <span className="text-[10px] font-bold uppercase tracking-[0.2em]">Subtotal</span>
                  <span className={NUMBER_STYLE}>{formatCurrency((parseFloat(previewInvoice.total_amount) || 0) + (parseFloat(previewInvoice.discount_amount) || 0) - (parseFloat(previewInvoice.vat_amount) || 0), settings?.currency || 'NGN')}</span>
                </div>
                
                {previewInvoice.discount_amount > 0 && (
                  <div className="flex justify-between items-center text-brand ">
                    <span className="text-[10px] font-bold uppercase tracking-[0.2em]">Discount ({previewInvoice.discount_percentage}%)</span>
                    <span className={NUMBER_STYLE}>-{formatCurrency(previewInvoice.discount_amount, settings?.currency || 'NGN')}</span>
                  </div>
                )}

                {previewInvoice.vat_amount > 0 && (
                  <div className="flex justify-between items-center text-zinc-500 dark:text-zinc-400">
                    <span className="text-[10px] font-bold uppercase tracking-[0.2em]">VAT (7.5%)</span>
                    <span className={NUMBER_STYLE}>{formatCurrency(previewInvoice.vat_amount, settings?.currency || 'NGN')}</span>
                  </div>
                )}

                <div className="pt-6 border-t-4 border-zinc-950 dark:border-white flex justify-between items-center">
                  <span className="text-sm font-bold uppercase tracking-[0.3em] text-zinc-950 dark:text-white">Total</span>
                  <span className="text-4xl font-bold tracking-tighter text-zinc-950 dark:text-white">
                    {formatCurrency(previewInvoice.total_amount || 0, settings?.currency || 'NGN')}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    )}
    </div>
  );
};

export default Invoices;
