declare const catalyst: any;

const API_BASE = '/server/wedexpense_function/api';

async function getAuthHeaders(): Promise<Record<string, string>> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  try {
    if (typeof catalyst !== 'undefined' && catalyst.auth) {
      // Try generateAuthToken (works on client hosting) or getHeaders (works on AppSail)
      if (typeof catalyst.auth.generateAuthToken === 'function') {
        const response = await catalyst.auth.generateAuthToken();
        headers['Authorization'] = response.access_token;
      } else if (typeof catalyst.auth.getHeaders === 'function') {
        const csrfHeaders = await catalyst.auth.getHeaders();
        Object.assign(headers, csrfHeaders);
      }
    }
  } catch {}
  return headers;
}

async function request(path: string, options: RequestInit = {}): Promise<any> {
  const headers = await getAuthHeaders();
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    credentials: 'same-origin',
    headers: { ...headers, ...options.headers },
  });
  const data = await res.json();
  if (data.status === 'error') throw new Error(data.message);
  return data.data;
}

// ── Weddings ──
export const getWeddings = () => request('/weddings');
export const getWedding = (id: string) => request(`/weddings/${id}`);
export const createWedding = (body: any) =>
  request('/weddings', { method: 'POST', body: JSON.stringify(body) });
export const updateWedding = (id: string, body: any) =>
  request(`/weddings/${id}`, { method: 'PUT', body: JSON.stringify(body) });
export const deleteWedding = (id: string) =>
  request(`/weddings/${id}`, { method: 'DELETE' });

// ── Events ──
export const getEvents = (wid: string) => request(`/weddings/${wid}/events`);
export const createEvent = (wid: string, body: any) =>
  request(`/weddings/${wid}/events`, { method: 'POST', body: JSON.stringify(body) });
export const updateEvent = (id: string, body: any) =>
  request(`/events/${id}`, { method: 'PUT', body: JSON.stringify(body) });
export const deleteEvent = (id: string) =>
  request(`/events/${id}`, { method: 'DELETE' });

// ── Expenses ──
export const getExpenses = (wid: string, filters?: Record<string, string>) => {
  const params = new URLSearchParams(filters).toString();
  return request(`/weddings/${wid}/expenses${params ? '?' + params : ''}`);
};
export const createExpense = (wid: string, body: any) =>
  request(`/weddings/${wid}/expenses`, { method: 'POST', body: JSON.stringify(body) });
export const updateExpense = (id: string, body: any) =>
  request(`/expenses/${id}`, { method: 'PUT', body: JSON.stringify(body) });
export const deleteExpense = (id: string) =>
  request(`/expenses/${id}`, { method: 'DELETE' });
export const searchExpenses = (wid: string, q: string) =>
  request(`/weddings/${wid}/expenses/search?q=${encodeURIComponent(q)}`);

// ── Receipt / AI ──
export async function scanReceipt(file: File): Promise<any> {
  const headers: Record<string, string> = {};
  try {
    if (typeof catalyst !== 'undefined' && catalyst.auth) {
      if (typeof catalyst.auth.generateAuthToken === 'function') {
        const response = await catalyst.auth.generateAuthToken();
        headers['Authorization'] = response.access_token;
      } else if (typeof catalyst.auth.getHeaders === 'function') {
        Object.assign(headers, await catalyst.auth.getHeaders());
      }
    }
  } catch {}
  const formData = new FormData();
  formData.append('file', file);
  const res = await fetch(`${API_BASE}/receipts/scan`, {
    method: 'POST',
    headers,
    body: formData,
  });
  const data = await res.json();
  if (data.status === 'error') throw new Error(data.message);
  return data.data;
}

export const categorizeExpense = (description: string) =>
  request('/expenses/categorize', { method: 'POST', body: JSON.stringify({ description }) });

// ── Summary ──
export const getWeddingSummary = (wid: string) => request(`/weddings/${wid}/summary`);
export const getEventSummary = (wid: string) => request(`/weddings/${wid}/summary/events`);
export const getCategorySummary = (wid: string) => request(`/weddings/${wid}/summary/categories`);

// ── Categories ──
export const getCategories = () => request('/categories');
export const seedCategories = () => request('/categories/seed', { method: 'POST' });

// ── Users ──
export const getCurrentUser = () => request('/users/me');
export const inviteUser = (body: any) =>
  request('/users/invite', { method: 'POST', body: JSON.stringify(body) });

// ── Org Settings / Onboarding ──
export const getOrgSettings = () => request('/org/settings');
export const createOnboarding = (body: { account_type: string; org_name?: string }) =>
  request('/onboarding', { method: 'POST', body: JSON.stringify(body) });

// ── Incomes (Planner Mode) ──
export const getIncomes = (wid: string) => request(`/weddings/${wid}/incomes`);
export const createIncome = (wid: string, body: any) =>
  request(`/weddings/${wid}/incomes`, { method: 'POST', body: JSON.stringify(body) });
export const updateIncome = (id: string, body: any) =>
  request(`/incomes/${id}`, { method: 'PUT', body: JSON.stringify(body) });
export const deleteIncome = (id: string) =>
  request(`/incomes/${id}`, { method: 'DELETE' });

// ── Planner Dashboard ──
export const getPlannerSummary = () => request('/dashboard/planner-summary');

// ── AI Insights ──
export const getAIInsights = (wid: string) =>
  request(`/weddings/${wid}/ai-insights`, { method: 'POST' });

// ── AI Chat Assistant ──
export const chatWithAI = (wid: string, message: string, document_text?: string) =>
  request(`/weddings/${wid}/ai-chat`, {
    method: 'POST',
    body: JSON.stringify({ message, document_text }),
  });

export async function parseDocument(wid: string, file: File): Promise<any> {
  const headers: Record<string, string> = {};
  try {
    if (typeof catalyst !== 'undefined' && catalyst.auth) {
      if (typeof catalyst.auth.generateAuthToken === 'function') {
        const response = await catalyst.auth.generateAuthToken();
        headers['Authorization'] = response.access_token;
      } else if (typeof catalyst.auth.getHeaders === 'function') {
        Object.assign(headers, await catalyst.auth.getHeaders());
      }
    }
  } catch {}
  const formData = new FormData();
  formData.append('file', file);
  const res = await fetch(`${API_BASE}/weddings/${wid}/ai-parse-doc`, {
    method: 'POST',
    headers,
    body: formData,
  });
  const data = await res.json();
  if (data.status === 'error') throw new Error(data.message);
  return data.data;
}

// ── SmartBrowz: Parse Vendor URL ──
export const parseVendorUrl = (url: string) =>
  request(`/ai/parse-url`, {
    method: 'POST',
    body: JSON.stringify({ url }),
  });

// ── SmartBrowz: Web Search ──
export const webSearch = (query: string) =>
  request(`/ai/web-search`, {
    method: 'POST',
    body: JSON.stringify({ query }),
  });

// ── Client Share Link ──
export const generateShareLink = (wid: string) =>
  request(`/weddings/${wid}/share`, { method: 'POST' });

export async function getSharedWedding(token: string): Promise<any> {
  const res = await fetch(`${API_BASE}/shared/${token}`);
  const data = await res.json();
  if (data.status === 'error') throw new Error(data.message);
  return data.data;
}

// ── Audit Logs ──
export const getAuditLogs = (wid: string) =>
  request(`/weddings/${wid}/audit-logs`);

// ── Cron / Services ──
export const triggerDailySummary = () =>
  request('/cron/daily-summary', { method: 'POST' });
