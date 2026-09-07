/* Launch configuration: update values here without touching templates or legal-page markup. */
window.ALIVE_CONFIG=Object.freeze({
  publicUrl:'https://bcom-alive.bdotcom.workers.dev/',
  contactEmail:'bdotcombuilds@yahoo.com',
  /* Paste the 32-character token from Cloudflare Web Analytics > Manage site. Blank disables the beacon. */
  cloudflareWebAnalyticsToken:''
});

/* Load playback state guards after app.js has attached the studio controls. */
addEventListener('DOMContentLoaded',()=>{
  const script=document.createElement('script');
  script.src='playback-sync.js?v=preview-selection-1';
  document.body.append(script);
},{once:true});
