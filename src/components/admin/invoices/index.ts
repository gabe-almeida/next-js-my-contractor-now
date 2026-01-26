/**
 * Invoice Components Index
 *
 * WHY: Centralized exports for all invoice-related components.
 * WHEN: Import from this file when using invoice components in pages.
 * HOW: Re-exports all components with their types.
 */

// Status badge
export { InvoiceStatusBadge, type InvoiceStatus } from './InvoiceStatusBadge';

// Line items table
export {
  InvoiceLineItemTable,
  type InvoiceLineItem,
} from './InvoiceLineItemTable';

// Payment history
export {
  PaymentHistoryTimeline,
  type Payment,
  type PaymentMethod,
} from './PaymentHistoryTimeline';

// Forms
export {
  InvoiceForm,
  type InvoiceFormData,
  type InvoiceType,
  type Buyer,
  type Affiliate,
} from './InvoiceForm';

export {
  PaymentForm,
  type PaymentFormData,
  type PaymentMethod as PaymentMethodOption,
} from './PaymentForm';

// Lead selector modal
export {
  LeadSelectorModal,
  type UninvoicedLead,
} from './LeadSelectorModal';

// PDF template
export {
  InvoicePDFTemplate,
  type InvoicePDFData,
  type InvoiceLineItemData,
} from './InvoicePDFTemplate';

// Reports and analytics
export {
  AgingReportCard,
  type AgingData,
  type AgingBucket,
} from './AgingReportCard';

export {
  ScrubReconciliationForm,
  type ScrubLeadPreview,
  type ScrubReconciliationData,
} from './ScrubReconciliationForm';

export {
  BuyerScrubRateCard,
  type ScrubRateData,
} from './BuyerScrubRateCard';
