import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

export const supabase = createClient(
  'https://wybpxixkjimbpvufozub.supabase.co',
  'sb_publishable_0bNGPfELmwuT32zmhXXkMQ_sJIXotwE'
);

export const $ = selector => document.querySelector(selector);
export const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, character => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[character]));
export const prettyDate = value => {
  if (!value) return 'Not active yet';
  try { return new Intl.DateTimeFormat(undefined,{dateStyle:'medium',timeStyle:'short'}).format(new Date(value)); }
  catch { return String(value); }
};
export async function requireSession() {
  const {data:{session}} = await supabase.auth.getSession();
  if (!session) { location.href='/login/'; throw new Error('Authentication required'); }
  return session;
}
export function wireSignOut() {
  $('#signOut')?.addEventListener('click', async () => { await supabase.auth.signOut(); location.href='/'; });
}
