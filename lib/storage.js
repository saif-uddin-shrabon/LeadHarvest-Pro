/**
 * LeadHarvest Pro — Unified Storage Helper
 * Wraps chrome.storage.local with typed helpers.
 */

// ─── Leads ────────────────────────────────────────────────────────────────────

export async function getLeads() {
  const { leads = [] } = await chrome.storage.local.get('leads');
  return leads;
}

export async function saveLeads(leads) {
  await chrome.storage.local.set({ leads });
}

export async function appendLead(lead) {
  const leads = await getLeads();
  lead.id = lead.id || `lead_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  lead.createdAt = lead.createdAt || new Date().toISOString();
  leads.push(lead);
  await saveLeads(leads);
  return lead;
}

export async function appendLeads(newLeads) {
  const existing = await getLeads();
  const stamped = newLeads.map((l) => ({
    ...l,
    id: l.id || `lead_${Date.now()}_${Math.random().toString(36).slice(2)}`,
    createdAt: l.createdAt || new Date().toISOString(),
  }));
  await saveLeads([...existing, ...stamped]);
  return stamped;
}

export async function deleteLead(id) {
  const leads = await getLeads();
  await saveLeads(leads.filter((l) => l.id !== id));
}

export async function deleteLeads(ids) {
  const set = new Set(ids);
  const leads = await getLeads();
  await saveLeads(leads.filter((l) => !set.has(l.id)));
}

export async function clearLeads() {
  await chrome.storage.local.set({ leads: [] });
}

// ─── Templates ────────────────────────────────────────────────────────────────

export async function getTemplates() {
  const { templates = [] } = await chrome.storage.local.get('templates');
  return templates;
}

export async function saveTemplate(template) {
  const templates = await getTemplates();
  template.id = template.id || `tpl_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  template.updatedAt = new Date().toISOString();
  const idx = templates.findIndex((t) => t.id === template.id);
  if (idx >= 0) templates[idx] = template;
  else templates.push(template);
  await chrome.storage.local.set({ templates });
  return template;
}

export async function deleteTemplate(id) {
  const templates = await getTemplates();
  await chrome.storage.local.set({ templates: templates.filter((t) => t.id !== id) });
}

// ─── Settings ─────────────────────────────────────────────────────────────────

export const DEFAULT_SETTINGS = {
  hunterApiKey: '',
  clearbitApiKey: '',
  hubspotApiKey: '',
  salesforceInstanceUrl: '',
  salesforceAccessToken: '',
  googleSheetsEnabled: false,
  enableEnrichment: false,
  requestDelayMs: 1500,
  proxyPacUrl: '',
  teamName: 'My Workspace',
  teamMembers: [],
  gdprMode: true,
  openaiApiKey: '',
};

export async function getSettings() {
  const { settings = {} } = await chrome.storage.local.get('settings');
  return { ...DEFAULT_SETTINGS, ...settings };
}

export async function saveSettings(partial) {
  const current = await getSettings();
  const merged = { ...current, ...partial };
  await chrome.storage.local.set({ settings: merged });
  return merged;
}

// ─── Crawl State ──────────────────────────────────────────────────────────────

export async function getCrawlState() {
  const { crawlState = null } = await chrome.storage.local.get('crawlState');
  return crawlState;
}

export async function saveCrawlState(state) {
  await chrome.storage.local.set({ crawlState: state });
}

export async function clearCrawlState() {
  await chrome.storage.local.remove('crawlState');
}

// ─── Active Template ──────────────────────────────────────────────────────────

export async function getActiveTemplateId() {
  const { activeTemplateId = null } = await chrome.storage.local.get('activeTemplateId');
  return activeTemplateId;
}

export async function setActiveTemplateId(id) {
  await chrome.storage.local.set({ activeTemplateId: id });
}
