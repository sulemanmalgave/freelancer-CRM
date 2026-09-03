import { jsPDF } from "jspdf";
import { Invoice, Client, FreelancerProfile } from "../types";
import { formatCurrency } from "../utils";

export interface InvoicePdfResult {
  doc: jsPDF;
  filename: string;
  base64: string;
  dataUri: string;
  blob: Blob;
  download: () => void;
}

/**
 * Generates a clean, professional PDF for an invoice
 */
export function generateInvoicePdf(
  invoice: Invoice,
  client: Client | undefined,
  profile: FreelancerProfile
): InvoicePdfResult {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 18;
  const contentWidth = pageWidth - margin * 2;

  // Primary palette
  const primaryColor: [number, number, number] = [79, 70, 229]; // Indigo-600
  const darkTextColor: [number, number, number] = [30, 41, 59]; // Slate-800
  const lightTextColor: [number, number, number] = [100, 116, 139]; // Slate-500
  const borderColor: [number, number, number] = [226, 232, 240]; // Slate-200
  const altRowColor: [number, number, number] = [248, 250, 252]; // Slate-50

  let currentY = margin;

  // 1. Top Decorative Bar
  doc.setFillColor(...primaryColor);
  doc.rect(0, 0, pageWidth, 5, "F");

  currentY += 8;

  // 2. Header Section: Business info (left) and INVOICE Title + Number (right)
  const businessName = profile.businessName || profile.name || "Freelancer Workspace";
  const professionalName = profile.name || "";

  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.setTextColor(...primaryColor);
  doc.text(businessName, margin, currentY);

  if (professionalName && professionalName !== businessName) {
    currentY += 6;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(...lightTextColor);
    doc.text(professionalName, margin, currentY);
  }

  // Right side: INVOICE tag & number
  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.setTextColor(...darkTextColor);
  doc.text("INVOICE", pageWidth - margin, margin + 8, { align: "right" });

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...primaryColor);
  doc.text(`#${invoice.invoiceNumber}`, pageWidth - margin, margin + 15, { align: "right" });

  // Status Badge
  const statusColor: [number, number, number] =
    invoice.status === "Paid"
      ? [16, 185, 129] // Emerald
      : invoice.status === "Sent"
      ? [14, 165, 233] // Sky
      : [148, 163, 184]; // Slate

  doc.setFillColor(...statusColor);
  doc.roundedRect(pageWidth - margin - 22, margin + 18, 22, 6, 1.5, 1.5, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(255, 255, 255);
  doc.text(invoice.status.toUpperCase(), pageWidth - margin - 11, margin + 22.3, { align: "center" });

  currentY = Math.max(currentY + 12, margin + 28);

  // Divider Line
  doc.setDrawColor(...borderColor);
  doc.setLineWidth(0.5);
  doc.line(margin, currentY, pageWidth - margin, currentY);
  currentY += 8;

  // 3. Metadata Grid: Bill To (Left) & Invoice Details (Right)
  const colLeftX = margin;
  const colRightX = margin + contentWidth * 0.55;

  // Left: Bill To
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...lightTextColor);
  doc.text("BILLED TO:", colLeftX, currentY);

  let leftY = currentY + 5;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...darkTextColor);
  const clientCompany = client?.companyName || "Client Account";
  doc.text(clientCompany, colLeftX, leftY);

  if (client?.contactPerson) {
    leftY += 5;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
    doc.setTextColor(...darkTextColor);
    doc.text(`Attn: ${client.contactPerson}`, colLeftX, leftY);
  }

  if (client?.email) {
    leftY += 4.5;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...lightTextColor);
    doc.text(client.email, colLeftX, leftY);
  }

  if (client?.phone) {
    leftY += 4.5;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...lightTextColor);
    doc.text(client.phone, colLeftX, leftY);
  }

  // Right: Invoice Meta
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...lightTextColor);
  doc.text("INVOICE DETAILS:", colRightX, currentY);

  let rightY = currentY + 5;
  const metaItems = [
    { label: "Issue Date:", val: new Date(invoice.issueDate).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" }) },
    { label: "Due Date:", val: new Date(invoice.dueDate).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" }) },
  ];

  metaItems.forEach((item) => {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...lightTextColor);
    doc.text(item.label, colRightX, rightY);

    doc.setFont("helvetica", "bold");
    doc.setTextColor(...darkTextColor);
    doc.text(item.val, pageWidth - margin, rightY, { align: "right" });
    rightY += 5;
  });

  currentY = Math.max(leftY, rightY) + 8;

  // 4. Services / Line Items Table Header
  const tableTop = currentY;
  const colItemWidth = contentWidth * 0.52;
  const colQtyWidth = contentWidth * 0.12;
  const colRateWidth = contentWidth * 0.18;
  const colAmountWidth = contentWidth * 0.18;

  const colQtyX = margin + colItemWidth;
  const colRateX = colQtyX + colQtyWidth;
  const colAmountX = colRateX + colRateWidth;

  // Table header background
  doc.setFillColor(...primaryColor);
  doc.roundedRect(margin, currentY, contentWidth, 8, 1, 1, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(255, 255, 255);
  doc.text("DESCRIPTION / SERVICE", margin + 4, currentY + 5.5);
  doc.text("QTY", colQtyX + colQtyWidth / 2, currentY + 5.5, { align: "center" });
  doc.text("RATE", colRateX + colRateWidth - 4, currentY + 5.5, { align: "right" });
  doc.text("AMOUNT", pageWidth - margin - 4, currentY + 5.5, { align: "right" });

  currentY += 8;

  // Table Rows
  const items = invoice.services || [];
  let subtotal = 0;

  items.forEach((item, index) => {
    const itemTotal = item.quantity * item.rate;
    subtotal += itemTotal;

    const rowHeight = 8.5;

    if (index % 2 === 1) {
      doc.setFillColor(...altRowColor);
      doc.rect(margin, currentY, contentWidth, rowHeight, "F");
    }

    doc.setDrawColor(...borderColor);
    doc.setLineWidth(0.2);
    doc.line(margin, currentY + rowHeight, pageWidth - margin, currentY + rowHeight);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...darkTextColor);

    const desc = item.description || "Service Rendered";
    const truncatedDesc = desc.length > 50 ? desc.substring(0, 48) + "..." : desc;
    doc.text(truncatedDesc, margin + 4, currentY + 5.5);

    doc.text(String(item.quantity), colQtyX + colQtyWidth / 2, currentY + 5.5, { align: "center" });
    doc.text(formatCurrency(item.rate, profile.currency), colRateX + colRateWidth - 4, currentY + 5.5, { align: "right" });
    
    doc.setFont("helvetica", "bold");
    doc.text(formatCurrency(itemTotal, profile.currency), pageWidth - margin - 4, currentY + 5.5, { align: "right" });

    currentY += rowHeight;
  });

  currentY += 6;

  // 5. Summary & Totals Block (Right aligned)
  const taxAmount = subtotal * ((invoice.taxRate || 0) / 100);
  const grandTotal = subtotal + taxAmount;

  const summaryWidth = contentWidth * 0.45;
  const summaryLeft = pageWidth - margin - summaryWidth;

  // Subtotal
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...lightTextColor);
  doc.text("Subtotal:", summaryLeft, currentY + 4);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...darkTextColor);
  doc.text(formatCurrency(subtotal, profile.currency), pageWidth - margin - 2, currentY + 4, { align: "right" });
  currentY += 6;

  // Tax if any
  if (invoice.taxRate > 0) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...lightTextColor);
    doc.text(`Tax (${invoice.taxRate}%):`, summaryLeft, currentY + 4);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...darkTextColor);
    doc.text(formatCurrency(taxAmount, profile.currency), pageWidth - margin - 2, currentY + 4, { align: "right" });
    currentY += 6;
  }

  // Total Due Highlight Box
  doc.setFillColor(243, 244, 246);
  doc.roundedRect(summaryLeft - 4, currentY + 1, summaryWidth + 4, 10, 1.5, 1.5, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10.5);
  doc.setTextColor(...primaryColor);
  doc.text("TOTAL DUE:", summaryLeft, currentY + 7.5);

  doc.setFontSize(12);
  doc.text(formatCurrency(grandTotal, profile.currency), pageWidth - margin - 2, currentY + 7.5, { align: "right" });

  currentY += 16;

  // 6. Notes & Terms
  if (invoice.notes && invoice.notes.trim()) {
    doc.setDrawColor(...borderColor);
    doc.setLineWidth(0.4);
    doc.line(margin, currentY, pageWidth - margin, currentY);
    currentY += 6;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(...lightTextColor);
    doc.text("PAYMENT INSTRUCTIONS & TERMS:", margin, currentY);

    currentY += 4.5;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(...darkTextColor);

    const splitNotes = doc.splitTextToSize(invoice.notes.trim(), contentWidth);
    doc.text(splitNotes, margin, currentY);
    currentY += splitNotes.length * 4.5;
  }

  // 7. Footer
  const footerY = pageHeight - 12;
  doc.setDrawColor(...borderColor);
  doc.setLineWidth(0.3);
  doc.line(margin, footerY - 4, pageWidth - margin, footerY - 4);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...lightTextColor);
  doc.text("Thank you for your business!", margin, footerY);
  doc.text(`Generated by ${businessName}`, pageWidth - margin, footerY, { align: "right" });

  const filename = `Invoice_${invoice.invoiceNumber}.pdf`;
  const base64 = doc.output("datauristring").split(",")[1] || "";
  const dataUri = doc.output("datauristring");
  const blob = doc.output("blob");

  return {
    doc,
    filename,
    base64,
    dataUri,
    blob,
    download: () => {
      doc.save(filename);
    },
  };
}
