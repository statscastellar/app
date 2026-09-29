/* PROVES: no comparteix la cache PWA de producció. Elimina qualsevol SW que controli /app/proves/. */
if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  window.addEventListener('load', async () => {
    try {
      const regs = await navigator.serviceWorker.getRegistrations();
      for (const reg of regs) {
        if (reg.scope && reg.scope.includes('/app/')) await reg.unregister();
      }
      if ('caches' in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map(k => caches.delete(k)));
      }
    } catch (err) { console.warn('Neteja cache PROVA:', err); }
  });
}
