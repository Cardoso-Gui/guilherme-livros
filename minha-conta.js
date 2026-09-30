(() => {
'use strict';
const el = id => document.getElementById(id);
const client = window.livrosAuthClient;
const form = el('change-password'), button = form.querySelector('button');
let user = null, busy = false;
const validate = () => el('confirm-password').setCustomValidity(el('new-password').value !== el('confirm-password').value ? 'As senhas precisam ser iguais.' : '');
el('new-password').addEventListener('input', validate);
el('confirm-password').addEventListener('input', validate);
form.addEventListener('submit', async event => {
 event.preventDefault(); validate();
 if (busy || !user || !client || !form.reportValidity()) return;
 if (el('new-password').value === el('current-password').value) { el('password-status').textContent = 'Escolha uma senha diferente da atual.'; return; }
 busy = true; button.disabled = true; el('password-status').textContent = 'Salvando...';
 let verifier;
 try {
  verifier = window.supabase.createClient('https://xheqlilvylkoxefepbmn.supabase.co','sb_publishable_p3e8yR4O_YxZ3m9YtJ1Bng_URr0STUY',{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false,storageKey:'livros-password-check'}});
  const check = await verifier.auth.signInWithPassword({email:user.email,password:el('current-password').value});
  if (check.error || check.data.user?.id !== user.id) {
   el('password-status').textContent = 'Não foi possível confirmar sua senha atual. Confira e tente novamente.'; return;
  }
  const {error} = await verifier.auth.updateUser({password:el('new-password').value});
  if (error) {
   const messages = {weak_password:'Escolha uma senha mais forte.',same_password:'Escolha uma senha diferente da atual.',over_request_rate_limit:'Aguarde um pouco antes de tentar novamente.',reauthentication_needed:'Entre novamente na sua conta antes de alterar a senha.'};
   el('password-status').textContent = messages[error.code] || 'Não foi possível alterar a senha. Tente novamente.'; return;
  }
  form.reset(); el('password-status').textContent = 'Senha alterada com sucesso!';
 } catch (_) { el('password-status').textContent = 'Não foi possível conectar. Tente novamente.'; }
 finally {
  if (verifier) { try { await verifier.auth.signOut({scope:'local'}); } catch (_) {} }
  busy = false; button.disabled = !user;
 }
});
if (!client) { el('account-loading').textContent = 'Não foi possível carregar sua conta. Atualize a página.'; return; }
client.auth.onAuthStateChange((event, session) => {
 if (event === 'SIGNED_OUT') {
  user = null; el('settings-content').hidden = true; location.replace('./entrar.html');
 }
});
client.auth.getUser().then(({data,error}) => {
 if(error || !data.user) { location.replace('./entrar.html'); return; }
 user = data.user;
 el('account-name').textContent = user.user_metadata?.display_name || 'Leitor';
 el('account-email').textContent = user.email || '';
 el('account-loading').hidden = true; el('settings-content').hidden = false; button.disabled = false;
}).catch(() => { el('account-loading').textContent = 'Não foi possível carregar sua conta. Tente novamente.'; });
el('account-signout').addEventListener('click', async event => {
 event.currentTarget.disabled = true;
 try {
  const {error} = await client.auth.signOut({scope:'local'}); if(error) throw error;
  location.replace('./entrar.html');
 } catch (_) { el('signout-status').textContent = 'Não foi possível sair. Tente novamente.'; event.currentTarget.disabled = false; }
});
})();