// The words of the New Order form (UI-SPEC F1, Validation, Discard changes guard; plan 08-13): one module, no wording in JSX.
// Every error line is the server's own (OrderRules.cs), so the browser and the API say the same thing (OR-3). Strings the spec
// names are verbatim. No long dash (OR-4).
import { formatCount } from '@/utils/format';

export const ORDER_FORM_COPY = {
  /** The document title is "New Order · CSPS Admin". */
  documentTitle: 'New Order',
  title: 'New Order',
  subline: 'Customer, dates, images and items. Payments, discounts and expenses are added on the order page after saving.',
  /** The back link: the list the person came from. */
  back: 'Orders',
  /** The noun the loading words use while the business date is read: "Loading order form…". */
  things: 'order form',
  loadFailed: "Couldn't load the order form.",
  customer: {
    title: 'Customer details',
    hint: 'Who the order is for',
    customerName: 'Customer name',
    teamName: 'Team / organization',
    teamNameHint: 'Shown as the order title',
    contactNumber: 'Contact number',
    email: 'Email',
    address: 'Address (optional)',
    addressPlaceholder: 'For delivery: street, barangay, city',
  },
  details: {
    title: 'Order details',
    hint: 'Dates and current stage',
    orderDate: 'Order date',
    dueDate: 'Due date',
    /** The hint under Due date once both dates are real and in order. */
    dueHint: (days: number): string =>
      days === 0 ? 'Same day as the order date' : `${formatCount(days)} ${days === 1 ? 'day' : 'days'} from order date`,
    status: 'Status',
    statusHint: 'Completed and Cancelled are set on the order page.',
    notes: 'Notes',
  },
  items: {
    title: 'Order items',
    hint: 'Add as many lines as you need. Sizes and variants can share a line.',
    addItem: 'Add Item',
    productType: 'Product type',
    productTypePlaceholder: 'Choose a product type',
    description: 'Description',
    descriptionPlaceholder: 'e.g. Jersey top, sublimated',
    sizeVariant: 'Size / variant',
    sizeVariantPlaceholder: 'e.g. S-XL',
    quantity: 'Qty',
    unitPrice: 'Unit price',
    lineTotal: 'Line total',
    remove: (n: number): string => `Remove item ${formatCount(n)}`,
    empty: 'No items yet. Add at least one to save the order.',
    limit: 'An order can have at most 100 items.',
    /** The footer line: "{pcs} pcs across {n} line items" ("1 line item"). */
    footer: (pieces: number, lines: number): string =>
      `${formatCount(pieces)} pcs across ${formatCount(lines)} ${lines === 1 ? 'line item' : 'line items'}`,
    subtotal: 'Items subtotal',
    /** The label above the preview figure (shown in capitals by its look). */
    subtotalOverline: 'Items subtotal',
    /** The preview figures are not the saved ones. */
    previewLabel: 'Preview',
  },
  aside: {
    title: 'Summary',
    hint: 'Updates as you edit items',
    status: 'Status',
    due: 'Due',
    lineItems: 'Line items',
    pieces: 'Pieces',
    total: 'Total',
    note: 'Balance = Total − Payments. Record the downpayment after saving.',
  },
  saveBar: {
    unsaved: 'Unsaved changes',
    attention: (count: number): string =>
      `${formatCount(count)} ${count === 1 ? 'field needs' : 'fields need'} attention · unsaved changes`,
    saving: 'Saving',
    cancel: 'Cancel',
    save: 'Save Order',
  },
  /** The "Discard changes?" dialog (ORD-15, D-57). */
  discard: {
    title: 'Discard changes?',
    message: "Your changes to this order haven't been saved. If you leave now, they're lost.",
    keep: 'Keep Editing',
    discard: 'Discard Changes',
  },
  /** 409 orders.busy: the banner above the first card. */
  busy: {
    title: 'Orders are being saved right now.',
    message: 'Try again in a moment.',
  },
  toast: {
    title: 'Order saved',
    message: (number: string, who: string): string => `${number} · ${who}`,
  },
  /** The messages under the fields: the server's own words (OrderRules.cs). */
  errors: {
    customerNameRequired: "Enter the customer's name.",
    customerNameTooLong: 'Keep the customer name to 100 characters or fewer.',
    teamNameTooLong: 'Keep the team name to 100 characters or fewer.',
    contactNumberRequired: 'Enter a contact number.',
    contactNumberTooLong: 'Keep the contact number to 30 characters or fewer.',
    contactNumberInvalid: 'Use digits, spaces and + - ( ) only.',
    emailTooLong: 'Keep the email to 254 characters or fewer.',
    emailInvalid: 'Enter a valid email address.',
    addressTooLong: 'Keep the address to 300 characters or fewer.',
    orderDateRequired: 'Enter the order date.',
    dateInvalid: 'Enter a real date.',
    dueDateRequired: 'Enter the due date.',
    dueDateBeforeOrderDate: "The due date can't be before the order date.",
    statusInvalid: 'Choose a status.',
    notesTooLong: 'Keep notes to 2,000 characters or fewer.',
    itemsRequired: 'Add at least one item.',
    itemsTooMany: 'An order can have at most 100 items.',
    productTypeRequired: 'Choose a product type.',
    descriptionRequired: 'Describe the item.',
    descriptionTooLong: 'Keep the description to 200 characters or fewer.',
    sizeVariantTooLong: 'Keep the size or variant to 100 characters or fewer.',
    quantityOutOfRange: 'Enter a quantity from 1 to 10,000.',
    unitPriceRequired: 'Enter a unit price.',
    unitPriceOutOfRange: 'Enter a unit price from ₱0.00 to ₱1,000,000.00.',
    moneyDecimals: 'Use at most 2 decimal places.',
  },
} as const;
