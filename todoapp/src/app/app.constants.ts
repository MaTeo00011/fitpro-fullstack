const appConfig = (window as any)['__APP_CONFIG__'] as { apiBaseUrl?: string } | undefined;
const isLocalDev = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
const defaultApiBase = isLocalDev ? 'http://localhost:3000' : window.location.origin;
export const API_BASE_URL = appConfig?.apiBaseUrl || defaultApiBase;
