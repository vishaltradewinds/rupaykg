(() => {
  const openSignIn = () => {
    const drawer = document.querySelector('.auth-drawer');
    drawer?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    const email = drawer?.querySelector('input[type="email"]');
    window.setTimeout(() => email?.focus(), 180);
  };
  document.addEventListener('click', event => {
    const target = event.target instanceof Element ? event.target.closest('.landing-actions button') : null;
    if (!target || target.textContent?.trim() !== 'Sign in') return;
    openSignIn();
  }, true);
})();
