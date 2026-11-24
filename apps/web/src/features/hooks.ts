import { useMutation, useQuery, useQueryClient, type QueryKey } from '@tanstack/react-query';
import { get } from '../lib/api';
import { errorToast } from '../ui/toast';

export interface Option {
  id: string;
  key: string | null;
  label: string;
  isDefault: boolean;
  data: Record<string, unknown>;
}

/** API-051 lookups, cached 5 minutes. */
export function useOptions(type: string) {
  return useQuery({
    queryKey: ['options', type],
    queryFn: () =>
      get<any>(`/masters/${type}/options`).then((r) => {
        const raw = Array.isArray(r) ? r : Array.isArray(r?.items) ? r.items : [];
        return raw.map((item: any) => ({
          ...item,
          id: item.id ?? item.key ?? String(item.value ?? ''),
          label: item.label || item.name || item.displayName || item.bankName || item.key || String(item.id ?? ''),
        })) as Option[];
      }),
    staleTime: 300_000,
  });
}

export function useUsers(enabled = true) {
  return useQuery({ queryKey: ['users'], queryFn: () => get<{ items: { id: string; fullName: string; role: string; status: string }[] }>('/admin/users').then((r) => r.items), enabled, staleTime: 300_000 });
}

/** Mutation that toasts errors and invalidates the given keys on success. */
export function useAction<TArgs, TOut>(fn: (a: TArgs) => Promise<TOut>, invalidate: QueryKey[] = [], onSuccess?: (o: TOut) => void) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: (o) => {
      for (const k of invalidate) void qc.invalidateQueries({ queryKey: k });
      onSuccess?.(o);
    },
    onError: errorToast,
  });
}

export interface Lead {
  id: string;
  name: string;
  phone: string | null;
  phoneRaw: string | null;
  phoneValid: boolean;
  email: string | null;
  company: string | null;
  city: string | null;
  pincode: string | null;
  stage: string;
  ownerId: string;
  sourceId: string;
  consentBasis: string;
  slaStatus: string;
  slaDueAt: string;
  firstContactAt: string | null;
  nextFollowUpAt: string | null;
  labels: string[];
  tags: string[];
  expectedValue: number | null;
  customerId: string | null;
  mergedIntoId: string | null;
  notes: string | null;
  createdAt: string;
  version: number;
}

export interface Activity {
  id: string;
  type: string;
  status: string;
  note: string | null;
  outcomeLabel: string | null;
  userName: string;
  occurredAt: string;
  pending?: boolean;
}
