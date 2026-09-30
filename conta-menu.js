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
  let revision = 0;
  const render = session => {
   const loggedIn = !!session?.user;
   label.textContent = loggedIn ? 'Minha conta' : 'Entrar';
   label.closest('a').setAttribute('href', loggedIn ? './minha-conta.html' : './entrar.html');
  };
  client.auth.onAuthStateChange((_event, session) => {
   revision++;
   render(session);
  });
  // Read persisted state too; never overwrite a newer login/logout event.
  const initialRevision = revision;
  client.auth.getSession().then(({data, error}) => {
   if (!error && revision === initialRevision) render(data.session);
  }).catch(() => {});
 } catch (_) {
  label.textContent = 'Entrar';
 }
})();
