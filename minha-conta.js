(() => {
'use strict';
const el = id => document.getElementById(id);
const sectionIds = ['dados-basicos','forma-de-pagamento','historico-de-compras','redefinir-senha'];
function showSection(focusHeading = false) {
 const requested = location.hash.slice(1);
 const selected = sectionIds.includes(requested) ? requested : sectionIds[0];
 sectionIds.forEach(id => { el(id).hidden = id !== selected; });
 document.querySelectorAll('.account-sections a').forEach(link => {
  if (link.getAttribute('href') === '#' + selected) link.setAttribute('aria-current','page');
  else link.removeAttribute('aria-current');
 });
 if (focusHeading) el(selected + '-title').focus({preventScroll:true});
}
showSection();
window.addEventListener('hashchange', () => showSection(true));
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
  historyRequest++;el('purchase-history').replaceChildren();user = null; el('settings-content').hidden = true; location.replace('./entrar.html');
 }
});
client.auth.getUser().then(({data,error}) => {
 if(error || !data.user) { location.replace('./entrar.html'); return; }
 user = data.user;
 el('account-name').textContent = user.user_metadata?.display_name || 'Leitor';
 el('account-email').textContent = user.email || '';
 el('account-loading').hidden = true; el('settings-content').hidden = false; button.disabled = false;
 loadHistory();
}).catch(() => { el('account-loading').textContent = 'Não foi possível carregar sua conta. Tente novamente.'; });
let historyRequest=0;
async function loadHistory(){
 const owner=user?.id;if(!owner)return;
 const ticket=++historyRequest,area=el('purchase-history'),message=el('purchase-history-status'),retry=el('purchase-history-retry');
 area.replaceChildren();message.textContent='Carregando suas compras...';retry.hidden=true;
 try{
  const result=await client.from('checkout_orders').select('book_id,book_ids,amount_cents,confirmed_at,created_at').eq('user_id',owner).order('confirmed_at',{ascending:false}).limit(100);
  if(ticket!==historyRequest||user?.id!==owner)return;
  if(result.error)throw result.error;
  if(!result.data.length){message.textContent='Você ainda não tem compras aprovadas.';return;}
  const dates=new Intl.DateTimeFormat('pt-BR',{timeZone:'America/Sao_Paulo',dateStyle:'short',timeStyle:'short'});
  const money=new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'});
  for(const purchase of result.data){
   const row=document.createElement('article');row.className='purchase-item';
   const info=document.createElement('div'),title=document.createElement('h3');title.textContent=(purchase.book_ids||[purchase.book_id]).map(id=>({'o-quinto-herdeiro':'O Quinto Herdeiro',noah:'Noah: A História Começa'}[id]||'Livro digital')).join(' + ');
   const details=document.createElement('dl'),label=document.createElement('dt'),value=document.createElement('dd'),time=document.createElement('time');
   label.textContent='Data da compra';const date=new Date(purchase.confirmed_at||purchase.created_at);
   time.dateTime=date.toISOString();time.textContent=dates.format(date);value.append(time);details.append(label,value);info.append(title,details);
   const price=document.createElement('strong');price.className='purchase-value';price.textContent=money.format(purchase.amount_cents/100);
   row.append(info,price);area.append(row);
  }
  message.textContent='Compras aprovadas · horário de Brasília';
 }catch(_){if(ticket!==historyRequest||user?.id!==owner)return;message.textContent='Não foi possível carregar suas compras. Tente novamente.';retry.hidden=false;}
}
el('purchase-history-retry').addEventListener('click',loadHistory);

el('account-signout').addEventListener('click', async event => {
 event.currentTarget.disabled = true;
 try {
  const {error} = await client.auth.signOut({scope:'local'}); if(error) throw error;
  location.replace('./entrar.html');
 } catch (_) { el('signout-status').textContent = 'Não foi possível sair. Tente novamente.'; event.currentTarget.disabled = false; }
});
})();