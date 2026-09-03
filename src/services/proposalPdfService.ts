import { jsPDF } from "jspdf";
import { Proposal, Client, FreelancerProfile } from "../types";
import { formatCurrency } from "../utils";

export interface ProposalPdfResult {
  doc: jsPDF;
  filename: string;
  base64: string;
  dataUri: string;
  blob: Blob;
  download: () => void;
}

/**
 * Generates a clean, professional PDF for a proposal / quotation
 */
export function generateProposalPdf(
  proposal: Proposal,
  client: Client | undefined,
  profile: FreelancerProfile
): ProposalPdfResult {
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

  // 2. Header Section: Business info (left) and PROPOSAL Title + Number (right)
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

  // Right side: PROPOSAL tag & number
  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.setTextColor(...darkTextColor);
  doc.text("PROPOSAL", pageWidth - margin, margin + 8, { align: "right" });

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...primaryColor);
  doc.text(`#${proposal.proposalNumber}`, pageWidth - margin, margin + 15, { align: "right" });

  // Status Badge
  const statusColor: [number, number, number] =
    proposal.status === "Accepted"
      ? [16, 185, 129] // Emerald
      : proposal.status === "Sent"
      ? [14, 165, 233] // Sky
      : proposal.status === "Viewed"
      ? [139, 92, 246] // Purple
      : proposal.status === "Rejected"
      ? [239, 68, 68] // Red
      : [148, 163, 184]; // Slate

  doc.setFillColor(...statusColor);
  doc.roundedRect(pageWidth - margin - 24, margin + 18, 24, 6, 1.5, 1.5, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(255, 255, 255);
  doc.text(proposal.status.toUpperCase(), pageWidth - margin - 12, margin + 22.3, { align: "center" });

  currentY = Math.max(currentY + 12, margin + 28);

  // Divider Line
  doc.setDrawColor(...borderColor);
  doc.setLineWidth(0.5);
  doc.line(margin, currentY, pageWidth - margin, currentY);
  currentY += 8;

  // 3. Metadata Grid: Prepared For (Left) & Proposal Details (Right)
  const colLeftX = margin;
  const colRightX = margin + contentWidth * 0.55;

  // Left Column: Prepared For
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...lightTextColor);
  doc.text("PREPARED FOR:", colLeftX, currentY);

  let leftY = currentY + 5;
  const clientName = client?.companyName || client?.contactPerson || "Direct Client";
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(...darkTextColor);
  doc.text(clientName, colLeftX, leftY);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...lightTextColor);

  if (client?.contactPerson && client.contactPerson !== clientName) {
    leftY += 4.5;
    doc.text(`Attn: ${client.contactPerson}`, colLeftX, leftY);
  }
  if (client?.email) {
    leftY += 4.5;
    doc.text(client.email, colLeftX, leftY);
  }
  if (client?.phone) {
    leftY += 4.5;
    doc.text(client.phone, colLeftX, leftY);
  }

  // Right Column: Proposal Metadata
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...lightTextColor);
  doc.text("PROPOSAL DETAILS:", colRightX, currentY);

  let rightY = currentY + 5;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...darkTextColor);

  const renderDetailRow = (label: string, value: string) => {
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...lightTextColor);
    doc.text(label, colRightX, rightY);

    doc.setFont("helvetica", "normal");
    doc.setTextColor(...darkTextColor);
    doc.text(value, pageWidth - margin, rightY, { align: "right" });
    rightY += 4.8;
  };

  renderDetailRow("Issue Date:", proposal.issueDate ? new Date(proposal.issueDate).toLocaleDateString() : "-");
  renderDetailRow("Valid Until:", proposal.validUntil ? new Date(proposal.validUntil).toLocaleDateString() : "-");

  if (profile.gmailEmail) {
    renderDetailRow("Issuer Email:", profile.gmailEmail);
  }

  currentY = Math.max(leftY, rightY) + 6;

  // Title / Scope Header
  if (proposal.title) {
    doc.setFillColor(241, 245, 249); // slate-100
    doc.roundedRect(margin, currentY, contentWidth, 8, 1.5, 1.5, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(...primaryColor);
    doc.text(`Scope / Objective: ${proposal.title}`, margin + 3, currentY + 5.5);
    currentY += 12;
  }

  // 4. Line Items Table
  const tableHeadY = currentY;
  const colDescX = margin + 3;
  const colQtyX = margin + contentWidth * 0.58;
  const colRateX = margin + contentWidth * 0.74;
  const colAmountX = pageWidth - margin - 3;

  // Table Header Background
  doc.setFillColor(...primaryColor);
  doc.roundedRect(margin, tableHeadY, contentWidth, 7, 1.5, 1.5, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(255, 255, 255);
  doc.text("DELIVERABLE / SERVICE DESCRIPTION", colDescX, tableHeadY + 4.8);
  doc.text("QTY", colQtyX, tableHeadY + 4.8, { align: "center" });
  doc.text("RATE", colRateX, tableHeadY + 4.8, { align: "right" });
  doc.text("AMOUNT", colAmountX, tableHeadY + 4.8, { align: "right" });

  currentY = tableHeadY + 8.5;

  const items = proposal.items && proposal.items.length > 0
    ? proposal.items
    : [{ description: "Professional Services", quantity: 1, rate: 0 }];

  items.forEach((item, index) => {
    // Check if we need a new page
    if (currentY > pageHeight - 55) {
      doc.addPage();
      currentY = margin + 10;
    }

    const rowHeight = 7.5;
    const isAlt = index % 2 === 1;

    if (isAlt) {
      doc.setFillColor(...altRowColor);
      doc.rect(margin, currentY - 1.5, contentWidth, rowHeight, "F");
    }

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(...darkTextColor);

    // Truncate long descriptions if needed
    const descText = doc.splitTextToSize(item.description || "-", contentWidth * 0.52);
    doc.text(descText[0] || "-", colDescX, currentY + 3.2);

    doc.setTextColor(...lightTextColor);
    doc.text(String(item.quantity || 1), colQtyX, currentY + 3.2, { align: "center" });

    doc.text(formatCurrency(item.rate || 0, profile.currency), colRateX, currentY + 3.2, { align: "right" });

    const lineTotal = (item.quantity || 0) * (item.rate || 0);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...darkTextColor);
    doc.text(formatCurrency(lineTotal, profile.currency), colAmountX, currentY + 3.2, { align: "right" });

    currentY += rowHeight;
  });

  // Table bottom border
  doc.setDrawColor(...borderColor);
  doc.setLineWidth(0.5);
  doc.line(margin, currentY, pageWidth - margin, currentY);
  currentY += 6;

  // 5. Totals & Summary Block
  const subtotal = items.reduce((acc, it) => acc + (it.quantity || 0) * (it.rate || 0), 0);
  const discountRate = Number(proposal.discountRate) || 0;
  const discountAmount = (subtotal * discountRate) / 100;
  const taxableAmount = Math.max(0, subtotal - discountAmount);
  const taxRate = Number(proposal.taxRate) || 0;
  const taxAmount = (taxableAmount * taxRate) / 100;
  const grandTotal = taxableAmount + taxAmount;

  const summaryWidth = contentWidth * 0.42;
  const summaryX = pageWidth - margin - summaryWidth;

  const renderSummaryRow = (label: string, value: string, isTotal: boolean = false) => {
    if (isTotal) {
      doc.setFillColor(241, 245, 249);
      doc.roundedRect(summaryX - 3, currentY - 1, summaryWidth + 3, 8.5, 1.5, 1.5, "F");

      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.setTextColor(...primaryColor);
      doc.text(label, summaryX, currentY + 4.8);
      doc.text(value, pageWidth - margin, currentY + 4.8, { align: "right" });
      currentY += 10;
    } else {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8.5);
      doc.setTextColor(...lightTextColor);
      doc.text(label, summaryX, currentY + 3);

      doc.setFont("helvetica", "bold");
      doc.setTextColor(...darkTextColor);
      doc.text(value, pageWidth - margin, currentY + 3, { align: "right" });
      currentY += 5.5;
    }
  };

  renderSummaryRow("Subtotal:", formatCurrency(subtotal, profile.currency));

  if (discountRate > 0) {
    renderSummaryRow(`Discount (${discountRate}%):`, `-${formatCurrency(discountAmount, profile.currency)}`);
  }

  if (taxRate > 0) {
    renderSummaryRow(`Tax / VAT (${taxRate}%):`, `+${formatCurrency(taxAmount, profile.currency)}`);
  }

  renderSummaryRow("Total Estimate:", formatCurrency(grandTotal, profile.currency), true);

  currentY += 4;

  // 6. Notes & Terms
  if (proposal.notes || proposal.terms) {
    if (currentY > pageHeight - 40) {
      doc.addPage();
      currentY = margin + 10;
    }

    doc.setDrawColor(...borderColor);
    doc.setLineWidth(0.3);
    doc.line(margin, currentY, pageWidth - margin, currentY);
    currentY += 5;

    if (proposal.notes) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8.5);
      doc.setTextColor(...primaryColor);
      doc.text("Notes / Remarks:", margin, currentY);
      currentY += 4;

      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(...lightTextColor);
      const noteLines = doc.splitTextToSize(proposal.notes, contentWidth);
      doc.text(noteLines, margin, currentY);
      currentY += noteLines.length * 3.8 + 3;
    }

    if (proposal.terms) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8.5);
      doc.setTextColor(...primaryColor);
      doc.text("Terms & Conditions:", margin, currentY);
      currentY += 4;

      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(...lightTextColor);
      const termLines = doc.splitTextToSize(proposal.terms, contentWidth);
      doc.text(termLines, margin, currentY);
      currentY += termLines.length * 3.8 + 2;
    }
  }

  // 7. Footer
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(148, 163, 184);
  doc.text(
    `Generated by Freelancer CRM • Thank you for your business consideration!`,
    pageWidth / 2,
    pageHeight - 8,
    { align: "center" }
  );

  const cleanNum = proposal.proposalNumber.replace(/[^a-zA-Z0-9-_]/g, "_");
  const filename = `Proposal_${cleanNum}.pdf`;

  const pdfOutput = doc.output("arraybuffer");
  const blob = new Blob([pdfOutput], { type: "application/pdf" });
  const dataUri = doc.output("datauristring");

  // Convert arraybuffer to base64
  let binary = "";
  const bytes = new Uint8Array(pdfOutput);
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  const base64 = btoa(binary);

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
