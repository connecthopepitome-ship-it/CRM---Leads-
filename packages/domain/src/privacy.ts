import { addMonths, type IsoDate } from './dates.js';

export interface PersonRecords {
  leadIds: string[];
  contactRefs: { customerId: string; contactId: string }[];
  quoteIds: string[];
  orderIds: string[];
  /** issued invoices, credit notes, payments, receipts linked to the person's customers */
  financialDocCount: number;
}

export interface ErasurePlan {
  mode: 'delete' | 'anonymise';
  deleteLeads: string[];
  deleteQuotes: string[];
  deleteOrders: string[];
  anonymiseContacts: PersonRecords['contactRefs'];
  anonymiseQuotes: string[];
  anonymiseOrders: string[];
  keep: string[];
}

/** RULE-054 */
export function erasurePlan(p: PersonRecords): ErasurePlan {
  if (p.financialDocCount === 0) {
    return { mode: 'delete', deleteLeads: p.leadIds, deleteQuotes: p.quoteIds, deleteOrders: p.orderIds, anonymiseContacts: p.contactRefs, anonymiseQuotes: [], anonymiseOrders: [], keep: [] };
  }
  return {
    mode: 'anonymise',
    deleteLeads: p.leadIds,
    deleteQuotes: [],
    deleteOrders: [],
    anonymiseContacts: p.contactRefs,
    anonymiseQuotes: p.quoteIds,
    anonymiseOrders: p.orderIds,
    keep: ['invoice billed name', 'invoice address', 'GSTIN'],
  };
}

/** RULE-052: Junk for more than N calendar months. */
export function isJunkPurgeDue(junkAt: IsoDate, today: IsoDate, months = 3): boolean {
  return today > addMonths(junkAt, months);
}
