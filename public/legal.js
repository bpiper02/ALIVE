(()=>{
  const email=window.ALIVE_CONFIG?.contactEmail;
  if(!email)return;
  document.querySelectorAll('[data-contact-email]').forEach(link=>{link.textContent=email;link.href=`mailto:${email}`});
})();
