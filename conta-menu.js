/* Shared session client. Header state is presentation, not access control. */
(() => {
 'use strict';
 const label = document.querySelector('[data-account-label]');
 if (!window.supabase || !label) return;
 try {
  const client = window.livrosAuthClient || window.supabase.createClient(
   'https://xheqlilvylkoxefepbmn.supabase.co',
   'sb_publishable_p3e8yR4O_YxZ3m9YtJ1Bng_URr0STUY',
   {auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true,storageKey:'livros-auth'}}
  );
  window.livrosAuthClient = client;
  client.auth.onAuthStateChange((_event, session) => {
   label.textContent = session?.user ? 'Minha conta' : 'Entrar';
  });
 } catch (_) {
  label.textContent = 'Entrar';
 }
})();
