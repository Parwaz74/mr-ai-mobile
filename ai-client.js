/* Optional remote model adapter. It never stores or receives provider secrets. */
(() => {
  const config = window.MRAI_CONFIG || {};
  async function chat(message, context = {}) {
    if (config.apiEnabled !== true) throw new Error('Remote AI is not enabled.');
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 45000);
    try {
      const response = await fetch(config.apiEndpoint || '/api/chat', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, language: context.language || 'en', history: Array.isArray(context.history) ? context.history.slice(-8).filter(item => item && ['user','ai','assistant'].includes(item.role) && typeof item.text === 'string').map(item => ({ role: item.role, text: item.text.slice(0, 1800) })) : [] }),
        signal: controller.signal
      });
      if (!response.ok) { const detail = await response.json().catch(() => ({})); throw new Error(detail.error || `AI service returned ${response.status}`); }
      const data = await response.json();
      if (typeof data.reply !== 'string' || !data.reply.trim()) throw new Error('AI service response was invalid.');
      return data.reply.trim();
    } finally { clearTimeout(timer); }
  }
  window.MRAI = Object.freeze({ chat });
})();
