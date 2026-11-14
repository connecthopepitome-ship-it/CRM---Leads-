/** Stage change with reason prompt for Lost/Junk (FR-033, FR-034 AC2). Won → Convert. */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { post } from '../lib/api';
import { Button, Dialog, SelectField, toast } from '../ui';
import { useAction, useOptions, type Lead } from './hooks';

export function StageDialog({ lead, to, onClose }: { lead: Lead; to: string; onClose(): void }) {
  const nav = useNavigate();
  const lost = useOptions('lostReasons');
  const junk = useOptions('junkReasons');
  const needsReason = to === 'lost' || to === 'junk';
  const [reason, setReason] = useState('');
  const m = useAction(() => post(`/leads/${lead.id}/stage`, { stage: to, reasonId: reason || null }), [['leads'], ['leads-board'], ['lead', lead.id], ['timeline']], () => {
    toast('Stage updated');
    onClose();
  });
  if (to === 'won') {
    return (
      <Dialog open onClose={onClose} title="Mark as won" footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button onClick={() => nav(`/leads/${lead.id}?convert=1`)}>Convert to customer</Button></>}>
        <p className="text-sm">Leads become Won when you convert them to a customer or the customer accepts a quotation.</p>
      </Dialog>
    );
  }
  if (!needsReason) {
    return (
      <Dialog open onClose={onClose} title={`Move ${lead.name}`} footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button busy={m.isPending} onClick={() => m.mutate(undefined)}>Move</Button></>}>
        <p className="text-sm">Move this lead to <b>{to.replace(/_/g, ' ')}</b>?</p>
      </Dialog>
    );
  }
  const opts = (to === 'lost' ? lost.data : junk.data) ?? [];
  return (
    <Dialog open onClose={onClose} title={to === 'lost' ? 'Why was this lead lost?' : 'Why is this lead junk?'} footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button disabled={!reason} busy={m.isPending} onClick={() => m.mutate(undefined)}>Save</Button></>}>
      <SelectField label="Reason" required placeholder="Choose a reason" value={reason} onChange={(e) => setReason(e.target.value)} options={opts.map((o) => ({ value: o.id, label: o.label }))} />
      {to === 'junk' && <p className="mt-2 text-xs text-muted">Junk leads are deleted automatically after 3 months.</p>}
    </Dialog>
  );
}
