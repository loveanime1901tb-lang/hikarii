// Modern fetch with XHR fallback for legacy environments.
export async function apiFetch(url, options = {}) {
  if (typeof fetch === 'function') {
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timeout = options.timeoutMs || 65000;
    const timer = controller ? setTimeout(() => controller.abort(), timeout) : null;
    try {
      const res = await fetch(url, {
        method: options.method || 'GET',
        headers: options.headers || {},
        body: options.body || undefined,
        signal: controller ? controller.signal : undefined
      });
      return {
        ok: res.ok,
        status: res.status,
        json: async () => {
          if (typeof res.json === 'function') {
            return res.json();
          }
          const text = await res.text();
          return JSON.parse(text);
        }
      };
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  // Fallback for older browsers without fetch
  return new Promise((resolve, reject) => {
    const x = new XMLHttpRequest();
    x.open(options.method || 'GET', url, true);
    x.timeout = options.timeoutMs || 65000;
    Object.keys(options.headers || {}).forEach(k => x.setRequestHeader(k, options.headers[k]));
    x.onload = () => {
      const body = x.responseText;
      resolve({
        ok: x.status >= 200 && x.status < 300,
        status: x.status,
        json: async () => {
          let data;
          try {
            data = JSON.parse(body);
          } catch {
            throw new Error('HTTP ' + x.status + ': ' + (body.trim() ? 'Phản hồi không phải JSON.' : 'Máy chủ hoặc đường truyền trả về nội dung rỗng.') + ' Hãy thử lại; nếu lặp lại, kiểm tra nhật ký quản trị.');
          }
          if (!data || typeof data !== 'object') throw new Error('Phản hồi API không hợp lệ.');
          return data;
        }
      });
    };
    x.onerror = () => reject(new Error('Mất kết nối tới máy chủ.'));
    x.ontimeout = () => reject(new Error('Máy chủ phản hồi quá lâu. Hãy thử lại sau.'));
    x.send(options.body || null);
  });
}
