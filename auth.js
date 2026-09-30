/* Supabase Auth: only the public publishable key belongs in this file. */
(() => {
'use strict';
const URL = 'https://xheqlilvylkoxefepbmn.supabase.co';
const KEY = 'sb_publishable_p3e8yR4O_YxZ3m9YtJ1Bng_URr0STUY';
// Enable only after SMTP and the recovery email template are configured and tested.
const RECOVERY_EMAIL_READY = false;
const page = document.body.dataset.authPage;
const form = document.querySelector('[data-auth-form]');
const status = document.querySelector('.register-status');
const submit = form.querySelector('[type="submit"]');
let busy = false, step = 'email', recoveryEmail = '', verifiedRecovery = false, resendAt = 0;
const message = text => { status.textContent = text; };
const field = id => document.getElementById(id);
const password = field('reader-password'), confirmation = field('reader-confirm');
const duplicateNotice = field('duplicate-email');
function showDuplicateEmail() {
 message('Este e-mail já está cadastrado. Entre na sua conta.');
 if (duplicateNotice) duplicateNotice.hidden = false;
 field('reader-email').setAttribute('aria-invalid', 'true');
 field('reader-email').focus();
}
if (page === 'signup') field('reader-email').addEventListener('input', () => {
 field('reader-email').removeAttribute('aria-invalid');
 if (duplicateNotice) duplicateNotice.hidden = true;
 message('');
});
function validate() {
 if (confirmation) confirmation.setCustomValidity(confirmation.value && confirmation.value !== password.value ? 'As senhas precisam ser iguais.' : '');
}
password?.addEventListener('input', validate);
confirmation?.addEventListener('input', validate);
document.querySelectorAll('.password-toggle').forEach(button => button.addEventListener('click', () => {
 const input = field(button.getAttribute('aria-controls'));
 const reveal = input.type === 'password';
 input.type = reveal ? 'text' : 'password';
 button.textContent = reveal ? 'Ocultar' : 'Mostrar';
 button.setAttribute('aria-pressed', String(reveal));
 button.setAttribute('aria-label', (reveal ? 'Ocultar' : 'Mostrar') + ' senha');
}));
function errorText(error) {
 const codes = {
 invalid_credentials: 'Confira seu e-mail e sua senha e tente novamente.',
 email_not_confirmed: 'Confirme seu e-mail antes de entrar. Verifique também a caixa de spam.',
 over_email_send_rate_limit: 'O limite de envio de e-mails foi atingido. Aguarde antes de tentar novamente.',
 over_request_rate_limit: 'Muitas tentativas. Aguarde um pouco e tente novamente.',
 email_address_not_authorized: 'O envio de e-mails ainda está em configuração. Por enquanto, só endereços autorizados podem receber a confirmação.',
 otp_expired: 'O código é inválido ou expirou. Confira os números ou solicite outro.',
 weak_password: 'Escolha uma senha mais forte, com pelo menos 8 caracteres.',
 same_password: 'Escolha uma senha diferente da anterior.',
 session_not_found: 'Seu acesso expirou. Comece a recuperação novamente.'
 };
 return codes[error?.code] || 'Não foi possível concluir agora. Verifique sua conexão e tente novamente.';
}
let client;
form.addEventListener('submit', async event => {
 event.preventDefault();
 validate();
 if (busy || !form.reportValidity()) return;
 if (!client) return message('Não foi possível carregar o acesso. Atualize a página e tente novamente.');
 if (page === 'recovery' && !RECOVERY_EMAIL_READY) return message('O envio de códigos ainda está em configuração.');
 busy = true; submit.disabled = true; form.setAttribute('aria-busy', 'true'); message('Aguarde...');
 try {
  if (page === 'signup') {
   const {data,error} = await client.auth.signUp({
    email: field('reader-email').value.trim().toLowerCase(), password: password.value,
    options: { data: {display_name: field('reader-name').value.trim()}, emailRedirectTo: 'https://cardoso-gui.github.io/guilherme-livros/entrar.html' }
   });
   if (error) throw error;
   if (!data.session && data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
    showDuplicateEmail();
    return;
   }
   password.value = ''; confirmation.value = '';
   if (data.session) location.assign('./entrar.html');
   else message('Se o cadastro puder ser concluído, você receberá um e-mail de confirmação. Verifique sua caixa de entrada e o spam. Se já tem uma conta, use Entrar.');
  } else if (page === 'login') {
   const {data,error} = await client.auth.signInWithPassword({email: field('reader-email').value.trim().toLowerCase(), password: password.value});
   if (error) throw error;
   password.value = ''; showAccount(data.user); message('');
  } else if (step === 'email') {
   recoveryEmail = field('reader-email').value.trim().toLowerCase();
   await sendCode(); setStep('code');
   message('Se houver uma conta para este e-mail, você receberá um código. Confira também o spam.');
  } else if (step === 'code') {
   const {data,error} = await client.auth.verifyOtp({ email: recoveryEmail, token: field('recovery-code').value.trim(), type: 'recovery' });
   if (error || !data.session) throw error || new Error('Missing recovery session');
   verifiedRecovery = true; field('recovery-code').value = '';
   setStep('password'); message('Código confirmado. Escolha sua nova senha.');
  } else if (step === 'password' && verifiedRecovery) {
   const {error} = await client.auth.updateUser({password: password.value});
   if (error) throw error;
   password.value = ''; confirmation.value = ''; verifiedRecovery = false;
   await client.auth.signOut({scope:'local'});
   setStep('done'); message('Senha alterada! Você já pode voltar e entrar com sua nova senha.');
  }
 } catch (error) {
  if (page === 'signup' && ['user_already_exists', 'email_exists'].includes(error?.code)) showDuplicateEmail();
  else message(errorText(error));
 } finally {
  busy = false; submit.disabled = page === 'recovery' && (!RECOVERY_EMAIL_READY || step === 'done');
  form.removeAttribute('aria-busy');
 }
});
if (!window.supabase) { message('Não foi possível carregar o acesso. Atualize a página e tente novamente.'); return; }
client = window.supabase.createClient(URL, KEY, {
 auth: page === 'recovery'
  ? {persistSession:false, autoRefreshToken:false, detectSessionInUrl:false, storageKey:'livros-recovery'}
  : {persistSession:true, autoRefreshToken:true, detectSessionInUrl:true, storageKey:'livros-auth'}
});
if (page !== 'recovery') submit.disabled = false;
function showAccount(user) {
 if (!user) return;
 form.hidden = true;
 document.querySelector('.account-view').hidden = false;
 document.querySelector('.account-switch').hidden = true;
 field('form-title').textContent = 'Sua conta';
 document.querySelector('.register-intro').textContent = 'Bom ter você por aqui.';
 field('account-greeting').textContent = 'Olá, ' + (user.user_metadata?.display_name || 'leitor') + '!';
}
if (page === 'login') {
 client.auth.getUser().then(({data}) => { if (data.user) showAccount(data.user); }).catch(() => {});
 field('sign-out').addEventListener('click', async event => {
  event.currentTarget.disabled = true;
  try {
   const {error} = await client.auth.signOut({scope:'local'});
   if (error) throw error;
   location.replace('./entrar.html');
  } catch(error) { field('account-status').textContent = errorText(error); event.currentTarget.disabled = false; }
 });
}
function setStep(next) {
 step = next;
 for (const name of ['email','code','password']) {
  const container = field(name + '-fields'); container.hidden = name !== next;
  container.querySelectorAll('input').forEach(input => { input.disabled = name !== next; input.required = name === next; });
 }
 field('code-actions').hidden = next !== 'code';
 field('recovery-step').textContent = {email:'1. Seu e-mail',code:'2. Confirme o código',password:'3. Sua nova senha',done:'Senha atualizada'}[next];
 submit.textContent = {email:'Enviar código ↗',code:'Confirmar código ↗',password:'Salvar nova senha ↗',done:'Senha atualizada'}[next];
 submit.hidden = next === 'done';
 field({email:'reader-email',code:'recovery-code',password:'reader-password'}[next])?.focus();
}
async function sendCode() {
 const {error} = await client.auth.resetPasswordForEmail(recoveryEmail);
 if (error) throw error;
 resendAt = Date.now() + 60000;
}
if (page === 'recovery') {
 if (RECOVERY_EMAIL_READY) { field('recovery-notice').hidden = true; submit.disabled = false; }
 field('resend-code').addEventListener('click', async () => {
  if (busy || !RECOVERY_EMAIL_READY) return;
  if (Date.now() < resendAt) return message('Aguarde um minuto entre os envios.');
  busy = true; submit.disabled = true;
  try { await sendCode(); message('Se houver uma conta para este e-mail, um novo código será enviado. Use o mais recente.'); }
  catch(error) { message(errorText(error)); }
  finally { busy = false; submit.disabled = false; }
 });
 field('change-email').addEventListener('click', () => {
  if (busy) return;
  recoveryEmail = ''; field('recovery-code').value = ''; verifiedRecovery = false;
  setStep('email'); message('');
 });
}
})();
