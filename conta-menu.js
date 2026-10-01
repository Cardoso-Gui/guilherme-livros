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
   document.querySelectorAll('[data-account-label]').forEach(accountLabel => {
    accountLabel.textContent = loggedIn ? 'Minha conta' : 'Entrar';
    accountLabel.closest('a').setAttribute('href', loggedIn ? './minha-conta.html' : './entrar.html');
   });
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


/* Menu mobile compartilhado */
(function initMobileMenu() {
  const header = document.querySelector('.main-header');
  const nav = header?.querySelector('nav[aria-label="Navegação principal"]');
  if (!header || !nav || header.querySelector('.mobile-menu-toggle')) return;

  const toggle = document.createElement('button');
  toggle.className = 'mobile-menu-toggle';
  toggle.type = 'button';
  toggle.setAttribute('aria-label', 'Abrir menu');
  toggle.setAttribute('aria-expanded', 'false');
  toggle.innerHTML = '<span></span><span></span><span></span>';
  nav.id = nav.id || 'menu-principal';
  toggle.setAttribute('aria-controls', nav.id);
  header.insertBefore(toggle, nav);

  const accountButton = header.querySelector('.header-read');
  if (accountButton) {
    const mobileAccount = accountButton.cloneNode(true);
    mobileAccount.classList.remove('button', 'header-read');
    mobileAccount.classList.add('mobile-account-menu-link');
    const accountLabel = mobileAccount.querySelector('[data-account-label]');
    if (accountLabel) accountLabel.textContent = header.querySelector('[data-account-label]').textContent;
    const arrow = mobileAccount.querySelector('[aria-hidden="true"]');
    if (arrow) arrow.remove();
    nav.appendChild(mobileAccount);
  }

  function closeMenu() {
    header.classList.remove('menu-open');
    toggle.setAttribute('aria-expanded', 'false');
    toggle.setAttribute('aria-label', 'Abrir menu');
  }

  toggle.addEventListener('click', () => {
    const open = header.classList.toggle('menu-open');
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', open ? 'Fechar menu' : 'Abrir menu');
  });

  nav.addEventListener('click', (event) => {
    if (event.target.closest('a')) closeMenu();
  });

  document.addEventListener('click', (event) => {
    if (header.classList.contains('menu-open') && !header.contains(event.target)) closeMenu();
  });

  window.addEventListener('resize', () => {
    if (window.innerWidth > 760) closeMenu();
  });
})();
