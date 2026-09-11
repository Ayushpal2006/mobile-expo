/**
 * Canonical Billing Math & Totals Calculation
 * Single source of truth for POS totals calculation across Web and Mobile.
 */

export interface BillingLineItem {
  price: number; // in Rupees (e.g., 100 for ₹100)
  quantity: number;
  discountPercent?: number; // line discount percentage (0 - 100)
  gstRate?: number; // GST rate percentage (e.g., 18 for 18%)
}

export type DiscountMode = 'percent' | 'fixed';

export interface BillingTotalsResult {
  subtotal: number; // Gross subtotal before any discounts
  itemDiscountsTotal: number; // Total line item discounts
  cartDiscount: number; // Overall cart/bill discount in Rupees
  totalDiscount: number; // Total discount (line discounts + cart discount)
  discount: number; // Alias for totalDiscount
  gst: number; // Output GST tax total
  tax: number; // Alias for gst
  roundOff: number; // Round-off difference if enabled
  unroundedTotal: number; // Gross subtotal - totalDiscount + gst
  grandTotal: number; // Payable total
  total: number; // Alias for grandTotal
}

/**
 * Calculates billing totals with canonical rules:
 * - Subtotal = Sum of (price * quantity)
 * - Line Discount = (price * quantity * discountPercent) / 100
 * - Cart Discount =
 *     - If percent: (subtotal * discountValue) / 100
 *     - If fixed: discountValue
 * - GST = Sum of tax per line on taxable amounts
 * - Grand Total = max(0, subtotal - totalDiscount + gst)
 */
export function calculateBillingTotals(
  items: BillingLineItem[],
  cartDiscountValue: number = 0,
  cartDiscountMode: DiscountMode = 'percent',
  enableRoundOff: boolean = false
): BillingTotalsResult {
  let grossSubtotal = 0;
  let itemDiscountsTotal = 0;
  let gstTotal = 0;

  for (const item of items) {
    const unitPrice = Math.max(0, Number(item.price) || 0);
    const qty = Math.max(0, Number(item.quantity) || 0);
    const lineGross = unitPrice * qty;

    const lineDiscPct = Math.min(100, Math.max(0, Number(item.discountPercent) || 0));
    const lineDiscAmount = (lineGross * lineDiscPct) / 100;

    const lineTaxable = Math.max(0, lineGross - lineDiscAmount);
    const gstRate = item.gstRate !== undefined && item.gstRate !== null ? Math.max(0, Number(item.gstRate)) : 18;
    const lineGst = (lineTaxable * gstRate) / 100;

    grossSubtotal += lineGross;
    itemDiscountsTotal += lineDiscAmount;
    gstTotal += lineGst;
  }

  const rawCartDiscVal = Math.max(0, Number(cartDiscountValue) || 0);
  let cartDiscountAmount = 0;

  if (cartDiscountMode === 'percent') {
    const discPct = Math.min(100, rawCartDiscVal);
    cartDiscountAmount = (grossSubtotal * discPct) / 100;
  } else {
    cartDiscountAmount = Math.min(grossSubtotal, rawCartDiscVal);
  }

  const totalDiscount = Math.min(grossSubtotal, itemDiscountsTotal + cartDiscountAmount);
  const finalGst = Math.round(gstTotal * 100) / 100;

  const unroundedTotal = Math.max(0, grossSubtotal - totalDiscount + finalGst);
  let grandTotal = Math.round(unroundedTotal * 100) / 100;
  let roundOff = 0;

  if (enableRoundOff) {
    grandTotal = Math.round(unroundedTotal);
    roundOff = Math.round((grandTotal - unroundedTotal) * 100) / 100;
  }

  return {
    subtotal: Math.round(grossSubtotal * 100) / 100,
    itemDiscountsTotal: Math.round(itemDiscountsTotal * 100) / 100,
    cartDiscount: Math.round(cartDiscountAmount * 100) / 100,
    totalDiscount: Math.round(totalDiscount * 100) / 100,
    discount: Math.round(totalDiscount * 100) / 100,
    gst: finalGst,
    tax: finalGst,
    roundOff,
    unroundedTotal: Math.round(unroundedTotal * 100) / 100,
    grandTotal: Math.max(0, grandTotal),
    total: Math.max(0, grandTotal),
  };
}
