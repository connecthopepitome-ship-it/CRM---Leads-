/** GST place of supply and split (RULE-034). State codes are 2-digit GST codes ("29" Karnataka, "27" Maharashtra). */

export type SupplyKind = 'goods' | 'services';

export interface PlaceOfSupplyInput {
  kind: SupplyKind;
  companyState: string;
  billingState?: string | null;
  shippingState?: string | null;
}

export function placeOfSupply(i: PlaceOfSupplyInput): string {
  if (i.kind === 'goods') return i.shippingState || i.billingState || i.companyState;
  return i.billingState || i.companyState;
}

export function isIntraState(companyState: string, pos: string): boolean {
  return companyState === pos;
}

export const GST_STATES: Record<string, string> = {
  '01': 'Jammu and Kashmir', '02': 'Himachal Pradesh', '03': 'Punjab', '04': 'Chandigarh', '05': 'Uttarakhand', '06': 'Haryana',
  '07': 'Delhi', '08': 'Rajasthan', '09': 'Uttar Pradesh', '10': 'Bihar', '11': 'Sikkim', '12': 'Arunachal Pradesh', '13': 'Nagaland',
  '14': 'Manipur', '15': 'Mizoram', '16': 'Tripura', '17': 'Meghalaya', '18': 'Assam', '19': 'West Bengal', '20': 'Jharkhand',
  '21': 'Odisha', '22': 'Chhattisgarh', '23': 'Madhya Pradesh', '24': 'Gujarat', '26': 'Dadra and Nagar Haveli and Daman and Diu',
  '27': 'Maharashtra', '29': 'Karnataka', '30': 'Goa', '31': 'Lakshadweep', '32': 'Kerala', '33': 'Tamil Nadu', '34': 'Puducherry',
  '35': 'Andaman and Nicobar Islands', '36': 'Telangana', '37': 'Andhra Pradesh', '38': 'Ladakh', '97': 'Other Territory',
};
