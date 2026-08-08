export function getTokenPayload(token) {
  try {
    const base64 = token.split('.')[1];
    return JSON.parse(atob(base64.replace(/-/g, '+').replace(/_/g, '/')));
  } catch {
    return null;
  }
}

export function isTokenExpired(token) {
  const payload = getTokenPayload(token);
  if (!payload?.exp) return true;
  return Date.now() >= payload.exp * 1000;
}

export function cerrarSesion() {
  localStorage.removeItem('pibot_token');
  localStorage.removeItem('pibot_user');
  window.dispatchEvent(new Event('pibot-auth-changed'));
}