import React, { useState, useEffect } from 'react';
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
  X
} from 'lucide-react';
import { useAuth, useSettings } from '../App';
import { cn, formatCurrency } from '../lib/utils';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'motion/react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

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
  const { fetchWithAuth } = useAuth();
  const { settings } = useSettings();
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
  const [isGenerating, setIsGenerating] = useState(false);
  const [pastInvoices, setPastInvoices] = useState<any[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'create' | 'history'>('create');
  const [searchTerm, setSearchTerm] = useState('');
  const [showItemDropdown, setShowItemDropdown] = useState(false);
  const [previewInvoice, setPreviewInvoice] = useState<any>(null);

  const brandColor = settings?.brand_color || '#10b981';

  useEffect(() => {
    fetchInventory();
    fetchPastInvoices();
  }, []);

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

  const fetchPastInvoices = async () => {
    try {
      const res = await fetchWithAuth('/api/sales');
      if (res.ok) {
        const data = await res.json();
        // Filter only those with invoice numbers
        setPastInvoices(data.filter((s: any) => s.invoice_number));
      }
    } catch (error) {
      console.error('Error fetching past invoices:', error);
    }
  };

  const loadInvoice = (invoice: any) => {
    try {
      setInvoiceNumber(invoice.invoice_number || `INV-${Date.now().toString().slice(-6)}`);
      setInvoiceDate(invoice.created_at ? new Date(invoice.created_at).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]);
      setDiscount(invoice.discount_percentage || 0);
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
      discount: inv.discount_percentage || 0
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
        status: 'Pending'
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
      const [productsRes, servicesRes] = await Promise.all([
        fetchWithAuth('/api/products'),
        fetchWithAuth('/api/services')
      ]);

      if (productsRes.ok) setProducts(await productsRes.json());
      if (servicesRes.ok) setServices(await servicesRes.json());
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

    if (!items || items.length === 0) {
      toast.error('Please add at least one item to the invoice');
      return;
    }
    if (!rec || !rec.name) {
      toast.error('Please add recipient name');
      return;
    }

    setIsGenerating(true);
    console.log('Starting PDF generation...', { num, date, itemsCount: items.length });
    try {
      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'letter'
      });
      const pageWidth = doc.internal.pageSize.getWidth();
      
      // Handle potential gradient brand color
      let brandColor = settings?.brand_color || '#10b981';
      if (brandColor.includes('gradient')) {
        // Extract first hex color from gradient or fallback to default
        const hexMatch = brandColor.match(/#[a-fA-F0-9]{3,6}/);
        brandColor = hexMatch ? hexMatch[0] : '#10b981';
      }
      
      // Header
      doc.setFillColor(brandColor);
      doc.rect(0, 0, pageWidth, 40, 'F');
      
      // Logo handling
      if (settings?.logo_url) {
        try {
          const img = new Image();
          img.src = settings.logo_url;
          img.crossOrigin = "anonymous";
          await new Promise((resolve, reject) => {
            img.onload = resolve;
            img.onerror = reject;
            // Timeout after 3 seconds
            setTimeout(() => reject(new Error('Logo load timeout')), 3000);
          });
          doc.addImage(img, 'PNG', 15, 8, 24, 24);
        } catch (e) {
          console.warn('Could not add logo to PDF:', e);
        }
      }

      doc.setTextColor(255, 255, 255);
      doc.setFontSize(24);
      doc.setFont('helvetica', 'bold');
      doc.text(settings?.business_name || 'StockFlow', 45, 25);
      
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text('INVOICE', pageWidth - 15, 25, { align: 'right' });
      doc.text(`#${num || '---'}`, pageWidth - 15, 32, { align: 'right' });

      // Business Info & Recipient Info
      doc.setTextColor(0, 0, 0);
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text('From:', 15, 55);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      let fromY = 62;
      doc.text(settings?.business_name || 'StockFlow', 15, fromY);
      fromY += 5;
      if (settings?.email) {
        doc.text(`Email: ${settings.email}`, 15, fromY);
        fromY += 5;
      }
      if (settings?.phone_number) {
        doc.text(`Phone: ${settings.phone_number}`, 15, fromY);
        fromY += 5;
      }
      if (settings?.address) {
        const splitFromAddress = doc.splitTextToSize(settings.address, 75);
        doc.text(splitFromAddress, 15, fromY);
        fromY += (splitFromAddress.length * 5);
      }
      
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      doc.text('Bill To:', 120, 55);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      let toY = 62;
      doc.text(rec.name || '---', 120, toY);
      toY += 5;
      if (rec.email) {
        doc.text(rec.email, 120, toY);
        toY += 5;
      }
      if (rec.phone) {
        doc.text(rec.phone, 120, toY);
        toY += 5;
      }
      if (rec.address) {
        const splitAddress = doc.splitTextToSize(rec.address, 75);
        doc.text(splitAddress, 120, toY);
        toY += (splitAddress.length * 5);
      }

      // Invoice Details
      doc.setFont('helvetica', 'bold');
      doc.text('Date:', 15, 85);
      doc.setFont('helvetica', 'normal');
      doc.text(date || new Date().toISOString().split('T')[0], 35, 85);

      // Table
      const tableData = items.map((item: any) => [
        item.name || 'Item',
        item.type?.toUpperCase() || 'PRODUCT',
        (item.quantity || 0).toString(),
        `${settings?.currency || '₦'}${Number(item.price || 0).toLocaleString()}`,
        `${settings?.currency || '₦'}${Number(item.total || 0).toLocaleString()}`
      ]);

      const subtotal = items.reduce((sum: number, item: any) => sum + (Number(item.total) || 0), 0);
      const discountAmount = (subtotal * (Number(disc) || 0)) / 100;
      const vatAmount = settings?.vat_enabled ? (subtotal - discountAmount) * 0.075 : 0;
      const total = subtotal - discountAmount + vatAmount;

      autoTable(doc, {
        startY: 100,
        head: [['Description', 'Type', 'Qty', 'Unit Price', 'Amount']],
        body: tableData,
        headStyles: { fillColor: brandColor, textColor: 255 },
        foot: [
          ['', '', '', 'Subtotal', `${settings?.currency || '₦'}${subtotal.toLocaleString()}`],
          ['', '', '', `Discount (${disc || 0}%)`, `-${settings?.currency || '₦'}${discountAmount.toLocaleString()}`],
          ['', '', '', 'VAT (7.5%)', `${settings?.currency || '₦'}${vatAmount.toLocaleString()}`],
          ['', '', '', 'Total', `${settings?.currency || '₦'}${total.toLocaleString()}`]
        ],
        footStyles: { fillColor: [245, 245, 245], textColor: 0, fontStyle: 'bold' }
      });

      // Footer
      const finalY = (doc as any).lastAutoTable.finalY + 20;
      doc.setFontSize(10);
      doc.setTextColor(150, 150, 150);
      doc.text('Thank you for your business!', pageWidth / 2, finalY, { align: 'center' });

      const safeNum = (num || 'INV-000000').toString().replace(/[^a-z0-9]/gi, '-');
      const fileName = `invoice-${safeNum}.pdf`;
      doc.save(fileName);
      toast.success('Invoice generated successfully');
    } catch (error) {
      console.error('PDF generation error:', error);
      toast.error('Failed to generate PDF. Check console for details.');
    } finally {
      setIsGenerating(false);
    }
  };

  const filteredItems = [...products, ...services].filter(item => 
    item.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-10">
        <div>
          <h1 className="text-4xl font-bold text-zinc-950 dark:text-white tracking-tight font-display mb-2">
            Invoicing System
          </h1>
          <p className="text-zinc-600 dark:text-zinc-400 font-medium">
            {activeTab === 'create' ? 'Generate professional invoices for your clients' : 'View and manage your past invoices'}
          </p>
        </div>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 w-full">
          <div className="flex bg-zinc-100 dark:bg-zinc-800 p-1 rounded-2xl w-full sm:w-auto">
            <button
              onClick={() => setActiveTab('create')}
              className={cn(
                "flex-1 sm:flex-none px-6 py-2.5 rounded-xl text-[10px] font-black transition-all uppercase tracking-[0.2em]",
                activeTab === 'create' ? "bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white shadow-sm" : "text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
              )}
            >
              Create
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={cn(
                "flex-1 sm:flex-none px-6 py-2.5 rounded-xl text-[10px] font-black transition-all uppercase tracking-[0.2em]",
                activeTab === 'history' ? "bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white shadow-sm" : "text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
              )}
            >
              History
            </button>
          </div>

          {activeTab === 'create' && (
            <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
              <button
                onClick={resetForm}
                className="p-3 rounded-2xl bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 font-bold hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-all active:scale-95"
                title="Reset Form"
              >
                <Plus className="w-5 h-5" />
              </button>
              <button
                onClick={saveInvoice}
                disabled={isSaving || invoiceItems.length === 0}
                className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 py-3 rounded-2xl bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 font-black uppercase tracking-[0.2em] hover:bg-zinc-800 dark:hover:bg-zinc-100 transition-all disabled:opacity-50 active:scale-95"
              >
                {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                <span className="text-[10px]">Save</span>
              </button>
              <button
                onClick={generatePDF}
                disabled={isGenerating}
                className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 py-3 rounded-2xl text-white font-black uppercase tracking-[0.2em] shadow-xl transition-all hover:scale-105 active:scale-95 disabled:opacity-50 disabled:scale-100"
                style={{ backgroundColor: brandColor, boxShadow: `0 20px 40px ${brandColor}33` }}
              >
                {isGenerating ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <Download className="w-5 h-5" />
                )}
                <span className="text-[10px]">{isGenerating ? 'Generating...' : 'Download'}</span>
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
                  <th className="px-8 py-6 text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-[0.2em]">Invoice #</th>
                  <th className="px-8 py-6 text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-[0.2em]">Date</th>
                  <th className="px-8 py-6 text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-[0.2em]">Client</th>
                  <th className="px-8 py-6 text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-[0.2em]">Amount</th>
                  <th className="px-8 py-6 text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-[0.2em] text-right">Actions</th>
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
                        <p className="font-medium italic">No saved invoices found</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  pastInvoices.map((inv) => (
                    <tr key={inv.id} className="hover:bg-zinc-900 hover:text-white dark:hover:bg-white dark:hover:text-zinc-900 transition-all group cursor-pointer">
                      <td className="px-8 py-6">
                        <span className="font-bold font-mono tracking-tighter">#{inv.invoice_number}</span>
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
                        <span className="text-sm font-bold font-mono tracking-tighter">
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
                  <p className="text-sm italic">No invoices found</p>
                </div>
              </div>
            ) : (
              pastInvoices.map((inv) => (
                <div key={inv.id} className="p-6 space-y-4 hover:bg-zinc-50/50 dark:hover:bg-zinc-800/50 transition-colors">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm font-bold font-mono tracking-tighter text-zinc-900 dark:text-white">#{inv.invoice_number}</p>
                      <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mt-0.5">
                        {new Date(inv.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handlePreview(inv)}
                        className="p-2.5 bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 rounded-xl active:scale-95 transition-all"
                      >
                        <FileText className="w-4 h-4" />
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
                      <p className="text-sm font-bold font-mono text-brand">
                        {formatCurrency(inv.total_amount, settings?.currency || '₦')}
                      </p>
                    </div>
                  </div>
                </div>
              ))
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
              <label className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-[0.2em]">Invoice Number</label>
              <div className="relative">
                <Hash className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                <input
                  type="text"
                  value={invoiceNumber}
                  onChange={(e) => setInvoiceNumber(e.target.value)}
                  className="w-full pl-12 pr-4 py-4 bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 rounded-2xl text-sm font-bold text-zinc-900 dark:text-white outline-none focus:ring-4 focus:ring-brand/10 focus:border-brand transition-all font-mono"
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-[0.2em]">Invoice Date</label>
              <div className="relative">
                <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                <input
                  type="date"
                  value={invoiceDate}
                  onChange={(e) => setInvoiceDate(e.target.value)}
                  className="w-full pl-12 pr-4 py-4 bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 rounded-2xl text-sm font-bold text-zinc-900 dark:text-white outline-none focus:ring-4 focus:ring-brand/10 focus:border-brand transition-all"
                />
              </div>
            </div>
          </div>

          {/* Item Selection */}
          <div className="glass-card p-8">
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-xl font-bold text-zinc-900 dark:text-white tracking-tight font-display">Invoice Items</h2>
              <div className="relative">
                <button
                  onClick={() => setShowItemDropdown(!showItemDropdown)}
                  className="flex items-center gap-2 px-6 py-3 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-100 rounded-2xl text-xs font-bold uppercase tracking-widest transition-all active:scale-95"
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
                      <div className="p-4 border-b border-zinc-100 dark:border-zinc-800">
                        <div className="relative">
                          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                          <input
                            type="text"
                            placeholder="Search inventory..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-12 pr-4 py-3 bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 rounded-2xl text-sm font-bold focus:ring-4 focus:ring-brand/10 text-zinc-900 dark:text-white outline-none"
                            autoFocus
                          />
                        </div>
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
                              <p className="text-sm font-bold font-mono tracking-tighter text-zinc-900 dark:text-white">
                                <span className="opacity-50 mr-1 text-xs">{settings?.currency || '₦'}</span>
                                {(item.price || item.selling_price || 0).toLocaleString()}
                              </p>
                            </button>
                          ))
                        ) : (
                          <div className="p-12 text-center text-zinc-400">
                            <Search className="w-12 h-12 mx-auto mb-4 opacity-10" />
                            <p className="text-sm italic">No items found</p>
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
                    <th className="pb-6 text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-[0.2em]">Description</th>
                    <th className="pb-6 text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-[0.2em] w-24">Qty</th>
                    <th className="pb-6 text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-[0.2em] w-40">Price</th>
                    <th className="pb-6 text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-[0.2em] w-40">Total</th>
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
                          <input
                            type="number"
                            value={item.quantity}
                            onChange={(e) => updateQuantity(index, parseInt(e.target.value))}
                            className="w-20 px-4 py-3 bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 rounded-2xl text-sm font-bold text-zinc-950 dark:text-white outline-none focus:ring-4 focus:ring-brand/10 focus:border-brand transition-all font-mono"
                          />
                        </td>
                        <td className="py-2 sm:py-6 flex justify-between items-center sm:table-cell">
                          <span className="sm:hidden text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Price</span>
                          <div className="relative">
                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400 text-xs font-bold font-mono">{settings?.currency || '₦'}</span>
                            <input
                              type="number"
                              value={item.price}
                              onChange={(e) => updatePrice(index, parseFloat(e.target.value))}
                              className="w-32 pl-10 pr-4 py-3 bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 rounded-2xl text-sm font-bold text-zinc-950 dark:text-white outline-none focus:ring-4 focus:ring-brand/10 focus:border-brand transition-all font-mono"
                            />
                          </div>
                        </td>
                        <td className="py-2 sm:py-6 flex justify-between items-center sm:table-cell">
                          <span className="sm:hidden text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Total</span>
                          <span className="text-sm font-bold font-mono tracking-tighter text-zinc-950 dark:text-white">
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
                          <p className="text-sm italic">No items added to invoice yet</p>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Right Column: Recipient & Totals */}
        <div className="space-y-8">
          {/* Recipient Info */}
          <div className="glass-card p-8">
            <h2 className="text-xl font-bold text-zinc-950 dark:text-white tracking-tight font-display mb-8 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center">
                <User className="w-5 h-5 text-zinc-500" />
              </div>
              Recipient Details
            </h2>
            <div className="space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-[0.2em]">Client Name</label>
                <div className="relative">
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                  <input
                    type="text"
                    placeholder="John Doe"
                    value={recipient.name}
                    onChange={(e) => setRecipient({ ...recipient, name: e.target.value })}
                    className="w-full pl-12 pr-4 py-4 bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 rounded-2xl text-sm font-bold text-zinc-950 dark:text-white outline-none focus:ring-4 focus:ring-brand/10 focus:border-brand transition-all"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-[0.2em]">Email Address</label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                  <input
                    type="email"
                    placeholder="john@example.com"
                    value={recipient.email}
                    onChange={(e) => setRecipient({ ...recipient, email: e.target.value })}
                    className="w-full pl-12 pr-4 py-4 bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 rounded-2xl text-sm font-bold text-zinc-950 dark:text-white outline-none focus:ring-4 focus:ring-brand/10 focus:border-brand transition-all"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-[0.2em]">Phone Number</label>
                <div className="relative">
                  <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                  <input
                    type="tel"
                    placeholder="+234..."
                    value={recipient.phone}
                    onChange={(e) => setRecipient({ ...recipient, phone: e.target.value })}
                    className="w-full pl-12 pr-4 py-4 bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 rounded-2xl text-sm font-bold text-zinc-950 dark:text-white outline-none focus:ring-4 focus:ring-brand/10 focus:border-brand transition-all"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-[0.2em]">Address</label>
                <div className="relative">
                  <MapPin className="absolute left-4 top-4 w-4 h-4 text-zinc-400" />
                  <textarea
                    placeholder="123 Street, City, Country"
                    value={recipient.address}
                    onChange={(e) => setRecipient({ ...recipient, address: e.target.value })}
                    rows={3}
                    className="w-full pl-12 pr-4 py-4 bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 rounded-2xl text-sm font-bold text-zinc-950 dark:text-white outline-none focus:ring-4 focus:ring-brand/10 focus:border-brand transition-all font-medium resize-none"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Totals */}
          <div className="bg-zinc-900 dark:bg-black rounded-[2.5rem] p-8 space-y-6 shadow-2xl border border-white/5 relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-32 h-32 bg-brand/10 blur-[80px] rounded-full -mr-16 -mt-16 group-hover:bg-brand/20 transition-all duration-700" />
            
            <div className="space-y-4 relative z-10">
              <h2 className="text-xl font-bold mb-4 font-display tracking-tight text-white">Invoice Summary</h2>
              <div className="flex items-center justify-between text-zinc-400">
                <span className="text-[10px] font-bold uppercase tracking-widest">Subtotal</span>
                <span className="font-bold text-white">{settings?.currency || '₦'}{calculateSubtotal().toLocaleString()}</span>
              </div>
              
              <div className="flex items-center justify-between text-zinc-400">
                <span className="text-[10px] font-bold uppercase tracking-widest">Discount (%)</span>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={discount}
                    onChange={(e) => setDiscount(Math.min(100, Math.max(0, parseFloat(e.target.value) || 0)))}
                    className="w-20 px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-sm font-bold text-white text-right focus:ring-4 focus:ring-brand/20 outline-none font-mono transition-all"
                  />
                </div>
              </div>

              {settings?.vat_enabled && (
                <div className="flex items-center justify-between text-zinc-400">
                  <span className="text-[10px] font-bold uppercase tracking-widest">VAT (7.5%)</span>
                  <span className="font-bold text-white">
                    <span className="opacity-50 mr-1 text-xs">{settings?.currency || '₦'}</span>
                    {calculateVAT().toLocaleString()}
                  </span>
                </div>
              )}
              
              <div className="pt-8 border-t border-white/5 flex justify-between items-end">
                <div>
                  <p className="text-[10px] text-zinc-500 uppercase tracking-[0.2em] font-bold mb-1">Total Amount</p>
                  <p className="text-5xl font-black tracking-tighter text-white">
                    <span className="opacity-30 mr-2 text-xl">{settings?.currency || '₦'}</span>
                    {calculateTotal().toLocaleString()}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    )}
    {previewInvoice && (
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-zinc-950/60 backdrop-blur-xl">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          className="bg-white dark:bg-zinc-900 rounded-[3rem] shadow-[0_40px_100px_rgba(0,0,0,0.4)] w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col border border-white/10"
        >
          <div className="p-10 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between bg-zinc-50/50 dark:bg-zinc-800/50">
            <div>
              <h2 className="text-3xl font-bold text-zinc-950 dark:text-white tracking-tight font-display">Invoice Preview</h2>
              <p className="text-zinc-500 dark:text-zinc-400 font-bold font-mono text-sm mt-1 opacity-50">#{previewInvoice.invoice_number}</p>
            </div>
            <div className="flex items-center gap-4">
              <button
                onClick={() => handleDownload(previewInvoice)}
                className="flex-1 sm:flex-none flex items-center justify-center gap-3 px-6 sm:px-8 py-4 rounded-2xl text-white font-bold shadow-2xl transition-all hover:scale-105 active:scale-95"
                style={{ backgroundColor: brandColor, boxShadow: `0 20px 40px ${brandColor}33` }}
              >
                <Download className="w-5 h-5" />
                <span className="text-[10px] sm:text-xs uppercase tracking-widest whitespace-nowrap">Download PDF</span>
              </button>
              <button
                onClick={() => setPreviewInvoice(null)}
                className="p-4 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-500 dark:text-zinc-400 rounded-2xl transition-all active:scale-95"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
          </div>
          
          <div className="flex-1 p-12 space-y-12">
            {/* Invoice Content Preview */}
            <div className="flex justify-between items-start">
              <div className="space-y-6">
                {settings?.logo_url ? (
                  <img src={settings.logo_url} alt="Logo" className="h-20 object-contain" referrerPolicy="no-referrer" />
                ) : (
                  <div className="w-20 h-20 rounded-[2rem] flex items-center justify-center text-white font-black text-3xl shadow-xl" style={{ backgroundColor: brandColor }}>
                    {settings?.business_name?.charAt(0) || 'S'}
                  </div>
                )}
                <div>
                  <h3 className="font-bold text-2xl text-zinc-950 dark:text-white tracking-tight">{settings?.business_name || 'StockFlow'}</h3>
                  {settings?.slogan && <p className="text-zinc-400 text-xs font-bold italic mt-1">{settings.slogan}</p>}
                  <div className="mt-4 space-y-1">
                    {settings?.email && <p className="text-zinc-500 dark:text-zinc-400 text-[10px] font-bold uppercase tracking-widest">Email: {settings.email}</p>}
                    {settings?.phone_number && <p className="text-zinc-500 dark:text-zinc-400 text-[10px] font-bold uppercase tracking-widest">Phone: {settings.phone_number}</p>}
                    {settings?.website && <p className="text-zinc-500 dark:text-zinc-400 text-[10px] font-bold uppercase tracking-widest">Web: {settings.website}</p>}
                    {settings?.address && <p className="text-zinc-500 dark:text-zinc-400 text-[10px] font-bold uppercase tracking-widest max-w-[250px] leading-relaxed">{settings.address}</p>}
                  </div>
                </div>
              </div>
              <div className="text-right space-y-2">
                <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-[0.2em]">Invoice Date</p>
                <p className="font-bold text-zinc-950 dark:text-white text-lg">{new Date(previewInvoice.created_at).toLocaleDateString()}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-12 pt-12 border-t border-zinc-100 dark:border-zinc-800">
              <div className="space-y-3">
                <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-[0.2em]">Bill To</p>
                <h4 className="font-bold text-xl text-zinc-950 dark:text-white tracking-tight">{previewInvoice.customer_name || 'Walk-in Customer'}</h4>
                <div className="space-y-1">
                  {previewInvoice.customer_email && (
                    <p className="text-zinc-500 dark:text-zinc-400 text-sm font-medium">{previewInvoice.customer_email}</p>
                  )}
                  {previewInvoice.customer_phone && (
                    <p className="text-zinc-500 dark:text-zinc-400 text-sm font-medium">{previewInvoice.customer_phone}</p>
                  )}
                  {previewInvoice.customer_address && (
                    <p className="text-zinc-500 dark:text-zinc-400 text-sm font-medium max-w-[250px] leading-relaxed">{previewInvoice.customer_address}</p>
                  )}
                </div>
              </div>
              <div className="space-y-3 text-right">
                <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-[0.2em]">Payment Method</p>
                <div className="inline-flex items-center gap-2 px-4 py-2 bg-zinc-100 dark:bg-zinc-800 rounded-xl">
                  <div className="w-2 h-2 rounded-full bg-brand animate-pulse" />
                  <p className="font-bold text-zinc-950 dark:text-white text-sm uppercase tracking-widest">{previewInvoice.payment_method || 'Invoice'}</p>
                </div>
              </div>
            </div>

            <div className="rounded-[2rem] border border-zinc-100 dark:border-zinc-800 overflow-hidden">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-zinc-50 dark:bg-zinc-800/50 border-b border-zinc-100 dark:border-zinc-800">
                    <th className="px-8 py-5 text-[10px] font-bold text-zinc-400 uppercase tracking-[0.2em]">Description</th>
                    <th className="px-8 py-5 text-[10px] font-bold text-zinc-400 uppercase tracking-[0.2em] text-center">Qty</th>
                    <th className="px-8 py-5 text-[10px] font-bold text-zinc-400 uppercase tracking-[0.2em] text-right">Price</th>
                    <th className="px-8 py-5 text-[10px] font-bold text-zinc-400 uppercase tracking-[0.2em] text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                  {previewInvoice.sale_items?.map((item: any, idx: number) => {
                    const name = item.product_variants?.products?.name || item.services?.name || item.product_name || item.service_name || 'Item';
                    const variant = item.product_variants ? ` (${item.product_variants.size || ''}${item.product_variants.color ? ' - ' + item.product_variants.color : ''})` : '';
                    return (
                      <tr key={idx}>
                        <td className="px-8 py-5">
                          <p className="font-bold text-zinc-950 dark:text-white">{name}{variant}</p>
                          <p className="text-[10px] text-zinc-400 uppercase font-bold tracking-widest opacity-50">{item.service_id ? 'Service' : 'Product'}</p>
                        </td>
                        <td className="px-8 py-5 text-center">
                          <span className="font-bold font-mono text-zinc-500">{item.quantity}</span>
                        </td>
                        <td className="px-8 py-5 text-right">
                          <span className="font-bold font-mono text-zinc-500">
                            {formatCurrency(item.unit_price || 0, settings?.currency || 'NGN')}
                          </span>
                        </td>
                        <td className="px-8 py-5 text-right">
                          <span className="font-bold font-mono text-zinc-950 dark:text-white">
                            {formatCurrency(item.total_price || 0, settings?.currency || 'NGN')}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="flex justify-end pt-8">
              <div className="w-80 space-y-4">
                <div className="flex justify-between items-center text-zinc-500">
                  <span className="text-[10px] font-bold uppercase tracking-widest">Subtotal</span>
                  <span className="font-bold">
                    {formatCurrency((previewInvoice.total_amount || 0) + (previewInvoice.discount_amount || 0) - (previewInvoice.vat_amount || 0), settings?.currency || 'NGN')}
                  </span>
                </div>
                {previewInvoice.discount_amount > 0 && (
                  <div className="flex justify-between items-center text-red-500">
                    <span className="text-[10px] font-bold uppercase tracking-widest">Discount ({previewInvoice.discount_percentage}%)</span>
                    <span className="font-bold">-{formatCurrency(previewInvoice.discount_amount, settings?.currency || 'NGN')}</span>
                  </div>
                )}
                {previewInvoice.vat_amount > 0 && (
                  <div className="flex justify-between items-center text-zinc-500">
                    <span className="text-[10px] font-bold uppercase tracking-widest">VAT (7.5%)</span>
                    <span className="font-bold">{formatCurrency(previewInvoice.vat_amount, settings?.currency || 'NGN')}</span>
                  </div>
                )}
                <div className="pt-6 border-t border-zinc-100 dark:border-zinc-800 flex justify-between items-center">
                  <span className="text-xs font-bold text-zinc-950 dark:text-white uppercase tracking-[0.2em]">Total Cost</span>
                  <span className="text-3xl font-black tracking-tighter text-zinc-950 dark:text-white">
                    {formatCurrency(previewInvoice.total_amount || 0, settings?.currency || 'NGN')}
                  </span>
                </div>
              </div>
            </div>

            {settings?.invoice_footer && (
              <div className="pt-12 border-t border-zinc-100 dark:border-zinc-800 text-center">
                <p className="text-zinc-400 text-xs italic font-medium leading-relaxed max-w-lg mx-auto">
                  {settings.invoice_footer}
                </p>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    )}
    </div>
  );
};

export default Invoices;
