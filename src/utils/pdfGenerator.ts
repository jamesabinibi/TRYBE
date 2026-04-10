import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

export const generatePDF = async (data: any, settings: any) => {
  const items = data.items;
  const rec = data.recipient;
  const num = data.invoiceNumber;
  const date = data.invoiceDate;
  const disc = parseFloat(data.discount) || 0;
  const invoiceTerms = data.invoiceTerms;
  const vatEnabled = data.vatEnabled;
  const vatAmount = parseFloat(data.vatAmount) || 0;

  try {
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'letter'
    });
    const pageWidth = doc.internal.pageSize.getWidth();
    
    // Handle potential gradient brand color
    let brandColor = settings?.brand_color || '#ff4d00';
    if (brandColor.includes('gradient')) {
      const hexMatch = brandColor.match(/#[a-fA-F0-9]{3,6}/);
      brandColor = hexMatch ? hexMatch[0] : '#ff4d00';
    }
    
    // Header Background
    doc.setFillColor(brandColor);
    doc.rect(0, 0, pageWidth, 60, 'F');
    
    // Logo handling - more robust loading with background box
    let logoLoaded = false;
    let logoWidth = 0;
    if (settings?.logo_url) {
      try {
        const logoImg = await new Promise<HTMLImageElement>((resolve, reject) => {
          const img = new Image();
          img.onload = () => resolve(img);
          img.onerror = (err) => reject(err);
          if (!settings.logo_url.startsWith('data:')) {
            img.crossOrigin = "anonymous";
          }
          img.src = settings.logo_url;
          setTimeout(() => reject(new Error('Logo load timeout')), 8000);
        });
        
        const ratio = logoImg.width / logoImg.height;
        const maxWidth = 30;
        const maxHeight = 30;
        let w = maxWidth;
        let h = w / ratio;
        if (h > maxHeight) {
          h = maxHeight;
          w = h * ratio;
        }
        
        // Draw a dark background box for the logo to match the preview and ensure visibility
        doc.setFillColor(20, 20, 20);
        doc.roundedRect(18, 13, w + 4, h + 4, 1.5, 1.5, 'F');
        
        // Add image directly (avoiding canvas to prevent CORS/tainted issues)
        doc.addImage(logoImg, 'PNG', 20, 15, w, h, undefined, 'FAST');
        logoLoaded = true;
        logoWidth = w + 8;
      } catch (e) {
        console.warn('Could not add logo to PDF:', e);
      }
    }

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(26);
    doc.setFont('helvetica', 'bold');
    // Position business name based on logo
    const nameX = logoLoaded ? 20 + logoWidth : 20;
    doc.text(settings?.business_name || 'Gryndee', nameX, 35);
    
    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    doc.text('INVOICE', pageWidth - 20, 25, { align: 'right' });
    doc.setFontSize(10);
    doc.text(`#${num}`, pageWidth - 20, 32, { align: 'right' });
    doc.text(date, pageWidth - 20, 39, { align: 'right' });

    // Content area
    doc.setTextColor(40, 40, 40);
    let y = 80;

    // Info Grid
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(160, 160, 160);
    doc.text('FROM', 20, y);
    doc.text('BILL TO', 110, y);

    y += 7;
    doc.setTextColor(40, 40, 40);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text(settings?.business_name || 'Gryndee', 20, y);
    doc.text(rec.name, 110, y);

    y += 6;
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 100, 100);
    
    // Business details with solid professional icons
    let busY = y;
    const iconColor = [120, 120, 120];
    const iconX = 20;
    const textX = 27;
    
    if (settings?.email) { 
      doc.setFillColor(iconColor[0], iconColor[1], iconColor[2]);
      // Solid Envelope
      doc.rect(iconX, busY - 3, 4.5, 3.2, 'F');
      doc.setDrawColor(255, 255, 255);
      doc.setLineWidth(0.2);
      doc.line(iconX, busY - 3, iconX + 2.25, busY - 1.5);
      doc.line(iconX + 4.5, busY - 3, iconX + 2.25, busY - 1.5);
      
      doc.text(settings.email, textX, busY); 
      busY += 6; 
    }
    if (settings?.phone_number) { 
      doc.setFillColor(iconColor[0], iconColor[1], iconColor[2]);
      // Solid Phone
      doc.roundedRect(iconX + 1, busY - 3.5, 2.5, 4.5, 0.4, 0.4, 'F');
      doc.setFillColor(255, 255, 255);
      doc.circle(iconX + 2.25, busY - 0.5, 0.25, 'F');
      
      doc.setTextColor(100, 100, 100);
      doc.text(settings.phone_number, textX, busY); 
      busY += 6; 
    }
    if (settings?.address) { 
      doc.setFillColor(iconColor[0], iconColor[1], iconColor[2]);
      // Solid Location Pin
      doc.circle(iconX + 2.25, busY - 2.5, 1.8, 'F');
      doc.setFillColor(255, 255, 255);
      doc.circle(iconX + 2.25, busY - 2.5, 0.6, 'F');
      doc.setFillColor(iconColor[0], iconColor[1], iconColor[2]);
      doc.triangle(iconX + 1, busY - 1.5, iconX + 3.5, busY - 1.5, iconX + 2.25, busY, 'F');
      
      doc.setTextColor(100, 100, 100);
      const addrLines = doc.splitTextToSize(settings.address, 70);
      doc.text(addrLines, textX, busY);
      busY += (addrLines.length * 5) + 1;
    }

    // Recipient details
    let recY = y;
    if (rec.email) { doc.text(rec.email, 110, recY); recY += 5; }
    if (rec.phone) { doc.text(rec.phone, 110, recY); recY += 5; }
    if (rec.address) {
      const addrLines = doc.splitTextToSize(rec.address, 70);
      doc.text(addrLines, 110, recY);
      recY += (addrLines.length * 5);
    }

    y = Math.max(busY, recY) + 15;

    // Helper for currency formatting with clean typography
    const formatCurrency = (val: number) => {
      const formatted = new Intl.NumberFormat('en-NG', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
      }).format(val);
      return `${settings?.currency || 'NGN'} ${formatted}`;
    };

    // Table
    const tableData = items.map((item: any) => [
      item.name,
      item.quantity.toString(),
      formatCurrency(parseFloat(item.price) || 0),
      formatCurrency(parseFloat(item.total) || 0)
    ]);

    autoTable(doc, {
      startY: y,
      head: [['Description', 'Qty', 'Unit Price', 'Total']],
      body: tableData,
      theme: 'grid',
      headStyles: { 
        fillColor: [20, 20, 20], 
        textColor: 255,
        fontSize: 9,
        fontStyle: 'bold',
        halign: 'left',
        cellPadding: 5
      },
      styles: { 
        fontSize: 9, 
        cellPadding: 5,
        lineColor: [230, 230, 230],
        lineWidth: 0.1,
        font: 'helvetica'
      },
      columnStyles: {
        0: { cellWidth: 'auto' },
        1: { halign: 'center', cellWidth: 20 },
        2: { halign: 'right', cellWidth: 40 },
        3: { halign: 'right', cellWidth: 40, fontStyle: 'bold' }
      },
      alternateRowStyles: {
        fillColor: [250, 250, 250]
      }
    });

    // Totals
    const finalY = (doc as any).lastAutoTable.finalY + 15;
    const subtotal = items.reduce((sum: number, item: any) => sum + (parseFloat(item.total) || 0), 0);
    const discountAmount = (subtotal * disc) / 100;
    const total = subtotal - discountAmount + (vatEnabled ? vatAmount : 0);

    const rightColX = pageWidth - 20;
    const labelX = pageWidth - 75;

    // Bank Details
    if (settings?.bank_name || settings?.account_name || settings?.account_number) {
      doc.setFontSize(8);
      doc.setTextColor(160, 160, 160);
      doc.setFont('helvetica', 'bold');
      doc.text('PAYMENT DETAILS', 20, finalY);
      
      doc.setFontSize(9);
      doc.setTextColor(60, 60, 60);
      doc.setFont('helvetica', 'normal');
      let bankY = finalY + 6;
      
      if (settings?.bank_name) {
        doc.setFont('helvetica', 'bold');
        doc.text('Bank:', 20, bankY);
        doc.setFont('helvetica', 'normal');
        doc.text(settings.bank_name, 32, bankY);
        bankY += 5;
      }
      if (settings?.account_name) {
        doc.setFont('helvetica', 'bold');
        doc.text('Account Name:', 20, bankY);
        doc.setFont('helvetica', 'normal');
        doc.text(settings.account_name, 45, bankY);
        bankY += 5;
      }
      if (settings?.account_number) {
        doc.setFont('helvetica', 'bold');
        doc.text('Account Number:', 20, bankY);
        doc.setFont('helvetica', 'normal');
        doc.text(settings.account_number, 48, bankY);
      }
    }

    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    doc.setFont('helvetica', 'normal');
    
    doc.text('Subtotal:', labelX, finalY);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(40, 40, 40);
    doc.text(formatCurrency(subtotal), rightColX, finalY, { align: 'right' });
    
    let totalY = finalY;
    if (disc > 0) {
      totalY += 8;
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(100, 100, 100);
      doc.text(`Discount (${disc}%):`, labelX, totalY);
      doc.setTextColor(16, 185, 129); // Emerald color for discount
      doc.setFont('helvetica', 'bold');
      doc.text(`-${formatCurrency(discountAmount)}`, rightColX, totalY, { align: 'right' });
    }

    if (vatEnabled && vatAmount > 0) {
      totalY += 8;
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(100, 100, 100);
      doc.text(`VAT (7.5%):`, labelX, totalY);
      doc.setTextColor(40, 40, 40);
      doc.setFont('helvetica', 'bold');
      doc.text(formatCurrency(vatAmount), rightColX, totalY, { align: 'right' });
    }

    totalY += 12;
    doc.setDrawColor(20, 20, 20);
    doc.setLineWidth(0.5);
    doc.line(labelX, totalY - 5, rightColX, totalY - 5);
    
    doc.setTextColor(20, 20, 20);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('Total:', labelX, totalY + 2);
    doc.text(formatCurrency(total), rightColX, totalY + 2, { align: 'right' });

    // Footer
    const footerY = 260;
    doc.setDrawColor(240, 240, 240);
    doc.setLineWidth(0.1);
    doc.line(20, footerY - 10, pageWidth - 20, footerY - 10);
    
    doc.setFontSize(9);
    doc.setTextColor(150, 150, 150);
    doc.setFont('helvetica', 'normal');
    
    const termsText = invoiceTerms || settings?.invoice_terms || 'Thank you for your business!';
    const splitTerms = doc.splitTextToSize(termsText, pageWidth - 40);
    
    // Adjust footerY based on terms length
    const adjustedFooterY = footerY - (splitTerms.length - 1) * 4;
    
    doc.text(splitTerms, pageWidth / 2, adjustedFooterY, { align: 'center' });
    
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text(settings?.business_name || 'Gryndee', pageWidth / 2, adjustedFooterY + (splitTerms.length * 4) + 1, { align: 'center' });

    doc.save(`Invoice_${num}.pdf`);
  } catch (error) {
    console.error('Error generating PDF:', error);
    throw error;
  }
};
