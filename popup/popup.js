/**
 * LeadHarvest Pro — Popup Controller
 * Handles all tab logic, template management, lead display, export, and CRM.
 */

import { exportToCSV, exportToExcel, exportToGoogleSheets } from '../lib/export.js';
import { pushToHubSpot, pushToSalesforce } from '../lib/crm.js';
import { cleanLeads, summarizeReport } from '../lib/cleaner.js';

// ─── State ─────────────────────────────────────────────────────────────────────

let allLeads = [];
let allTemplates = [];
let settings = {};
let activeTemplateId = null;
let selectedLeadIds = new Set();
let editingTemplate = null;

// ─── Boot ──────────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', async () => {
    await loadAll();
    setupTabs();
    setupExtractTab();
    setupLeadsTab();
    setupLeadsClean();
    setupTemplatesTab();
    setupToolsTab();
    updateCurrentDomain();

    // Listen for background crawl complete
    chrome.runtime.onMessage.addListener((msg) => {
        if (msg.type === 'CRAWL_COMPLETE') {
            stopProgress();
            showToast(`✓ Crawl complete — ${msg.pages} pages scraped`);
            loadAll();
        }
    });
});

async function loadAll() {
    const [leadsRes, tplRes, settingsRes, activeIdRes] = await Promise.all([
        chrome.runtime.sendMessage({ type: 'GET_LEADS' }),
        chrome.runtime.sendMessage({ type: 'GET_TEMPLATES' }),
        chrome.runtime.sendMessage({ type: 'GET_SETTINGS' }),
        chrome.storage.local.get('activeTemplateId'),
    ]);
    allLeads = leadsRes.leads || [];
    allTemplates = tplRes.templates || [];
    settings = settingsRes.settings || {};
    activeTemplateId = activeIdRes.activeTemplateId || null;
    renderAll();
}

function renderAll() {
    renderLeadCount();
    renderTemplateSelect();
    renderLeadsTable();
    renderTemplateList();
    updateStats();
    updateWorkspaceName();
}

// ─── Tab Switching ─────────────────────────────────────────────────────────────

function setupTabs() {
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
            btn.classList.add('active');
            document.getElementById(`tab-${btn.dataset.tab}`).classList.add('active');
        });
    });
}

// ─── Extract Tab ───────────────────────────────────────────────────────────────

function setupExtractTab() {
    // Template select change
    qs('#template-select').addEventListener('change', async (e) => {
        activeTemplateId = e.target.value || null;
        await chrome.runtime.sendMessage({ type: 'SET_ACTIVE_TEMPLATE', id: activeTemplateId });
        renderTemplateList();
    });

    // Auto-detect
    qs('#btn-auto-detect').addEventListener('click', async () => {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['content/content.js'] }).catch(() => { });
        const res = await chrome.tabs.sendMessage(tab.id, { type: 'AUTO_DETECT' });
        if (res?.sampleFields?.length) {
            renderAutoDetectPreview(res.sampleFields, res.records);
        } else {
            showToast('No repeating patterns detected on this page.');
        }
    });

    // AI Auto-detect
    qs('#btn-auto-detect-ai').addEventListener('click', async () => {
        if (!settings.openaiApiKey) { showToast('OpenAI API Key missing.'); return; }
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

        showProgress('AI is analyzing page structure…');
        try {
            await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['content/content.js'] }).catch(() => { });
            const res = await chrome.tabs.sendMessage(tab.id, { type: 'AUTO_DETECT_AI' });

            if (res?.ok && res.data?.fields?.length) {
                renderAutoDetectPreview(res.data.fields, 1);
                showToast('✨ AI successfully identified fields!');
            } else {
                showToast(`❌ AI Error: ${res?.error || 'No fields identified'}`);
            }
        } catch (e) {
            showToast(`❌ Error: ${e.message}`);
        } finally {
            stopProgress();
        }
    });

    if (settings.openaiApiKey) {
        qs('#btn-auto-detect-ai').style.display = 'block';
    }

    // Training
    qs('#btn-start-training').addEventListener('click', async () => {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        await chrome.runtime.sendMessage({ type: 'START_TRAINING', tabId: tab.id });
        qs('#btn-start-training').classList.add('hidden');
        qs('#btn-stop-training').classList.remove('hidden');
        window.close(); // Close popup so trainer overlay is accessible
    });

    qs('#btn-stop-training').addEventListener('click', async () => {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        await chrome.runtime.sendMessage({ type: 'STOP_TRAINING', tabId: tab.id });
        qs('#btn-start-training').classList.remove('hidden');
        qs('#btn-stop-training').classList.add('hidden');
    });

    // Single page extract
    qs('#btn-extract').addEventListener('click', async () => {
        if (!activeTemplateId) { showToast('Please select a template first.'); return; }
        const template = allTemplates.find(t => t.id === activeTemplateId);
        if (!template) return;
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        showProgress('Extracting…');
        await chrome.runtime.sendMessage({ type: 'START_EXTRACTION', tabId: tab.id, template });
        await sleep(1800);
        stopProgress();
        await loadAll();
        showToast('✓ Extraction complete');
    });

    // Crawl toggle
    qs('#btn-crawl').addEventListener('click', () => {
        const opts = qs('#crawl-options');
        opts.style.display = opts.style.display === 'none' ? 'block' : 'none';
    });

    // Start crawl
    qs('#btn-start-crawl').addEventListener('click', async () => {
        if (!activeTemplateId) { showToast('Please select a template first.'); return; }
        const template = allTemplates.find(t => t.id === activeTemplateId);
        if (!template) return;
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        const maxPages = parseInt(qs('#max-pages').value) || 5;
        showProgress('Crawling pages…');
        await chrome.runtime.sendMessage({
            type: 'START_CRAWL',
            template,
            startUrl: tab.url,
            maxPages,
            tabId: tab.id,
        });
    });

    // Save auto-detected template
    qs('#btn-save-auto-template').addEventListener('click', async () => {
        const name = prompt('Template name:');
        if (!name) return;
        const fields = Array.from(document.querySelectorAll('#auto-detect-list .field-chip'))
            .map(chip => ({
                name: chip.dataset.type,
                type: chip.dataset.type,
                selector: chip.dataset.selector,
                confidence: parseInt(chip.dataset.conf),
                autoFallback: true,
            }));
        const tpl = { name, fields, domain: '', builtIn: false };
        await chrome.runtime.sendMessage({ type: 'SAVE_TEMPLATE', template: tpl });
        await loadAll();
        qs('#auto-detect-result').style.display = 'none';
        showToast(`Template "${name}" saved!`);
    });
}

function renderAutoDetectPreview(fields, recordCount) {
    const list = qs('#auto-detect-list');
    list.innerHTML = fields.map(f => `
    <div class="field-chip" data-type="${esc(f.type)}" data-selector="${esc(f.selector)}" data-conf="${f.confidence}">
      <span class="field-chip-type">${esc(f.type)}</span>
      <span class="field-chip-val">${esc((f.value || '').slice(0, 25))}</span>
      <span class="field-chip-conf">${f.confidence}%</span>
    </div>
  `).join('');
    qs('#auto-detect-result').style.display = 'block';
}

// ─── Leads Tab ─────────────────────────────────────────────────────────────────

// ─── Data Cleaning ─────────────────────────────────────────────────────────────

function setupLeadsClean() {
    const btn = qs('#btn-clean-leads');
    const panel = qs('#clean-panel');
    const runBtn = qs('#btn-run-clean');

    btn.addEventListener('click', () => {
        const open = panel.style.display !== 'none';
        panel.style.display = open ? 'none' : 'block';
        btn.style.background = open ? '' : 'rgba(99,102,241,0.2)';
    });

    runBtn.addEventListener('click', async () => {
        if (!allLeads.length) { showToast('No leads to clean.'); return; }
        const originalCount = allLeads.length;

        const options = {
            deduplication: qs('#clean-dedup').checked,
            thinLeads: qs('#clean-thin').checked,
            minFields: 2,
            noIdentifier: qs('#clean-noid').checked,
            invalidEmails: qs('#clean-email').checked,
            invalidPhones: qs('#clean-phone').checked,
            placeholders: qs('#clean-placeholder').checked,
            normalize: qs('#clean-normalize').checked,
            misclassified: true,
        };

        const { cleaned, report } = cleanLeads(allLeads, options);
        const removedCount = originalCount - cleaned.length;

        if (!removedCount && !report.some(r => r.count > 0)) {
            showToast('✓ Leads already clean — nothing to remove.');
            return;
        }

        // Persist cleaned leads
        await chrome.storage.local.set({ leads: cleaned });
        await loadAll();

        // Show summary report
        const lines = summarizeReport(report, originalCount, cleaned.length);
        const msg = lines.slice(0, 4).join(' · ');
        showToast(`✓ ${msg}`);

        // Close panel
        panel.style.display = 'none';
        btn.style.background = '';
    });
}

function setupLeadsTab() {
    qs('#lead-search').addEventListener('input', renderLeadsTable);

    qs('#btn-select-all').addEventListener('click', () => {
        const visible = getFilteredLeads();
        if (selectedLeadIds.size === visible.length) {
            selectedLeadIds.clear();
        } else {
            visible.forEach(l => selectedLeadIds.add(l.id));
        }
        renderLeadsTable();
    });

    qs('#btn-delete-selected').addEventListener('click', async () => {
        if (!selectedLeadIds.size) return;
        if (!confirm(`Delete ${selectedLeadIds.size} leads?`)) return;
        await chrome.storage.local.get('leads').then(async ({ leads = [] }) => {
            await chrome.storage.local.set({ leads: leads.filter(l => !selectedLeadIds.has(l.id)) });
        });
        selectedLeadIds.clear();
        await loadAll();
    });

    qs('#btn-clear-all').addEventListener('click', async () => {
        if (!confirm('Clear ALL leads? This cannot be undone.')) return;
        await chrome.storage.local.set({ leads: [] });
        await loadAll();
    });

    // Export
    qs('#btn-export-csv').addEventListener('click', () => exportToCSV(getExportLeads(), 'leads.csv'));
    qs('#btn-export-excel').addEventListener('click', () => exportToExcel(getExportLeads(), 'leads.xlsx'));
    qs('#btn-export-sheets').addEventListener('click', () => exportToGoogleSheets(getExportLeads(), settings));

    // CRM
    qs('#btn-push-hubspot').addEventListener('click', async () => {
        if (!settings.hubspotApiKey) { openOptions(); return; }
        showToast('Pushing to HubSpot…');
        const res = await pushToHubSpot(getExportLeads(), settings.hubspotApiKey);
        showToast(res.success ? `✓ ${res.created} leads pushed to HubSpot` : `HubSpot error: ${res.error}`);
    });

    qs('#btn-push-salesforce').addEventListener('click', async () => {
        if (!settings.salesforceInstanceUrl || !settings.salesforceAccessToken) { openOptions(); return; }
        showToast('Pushing to Salesforce…');
        const res = await pushToSalesforce(getExportLeads(), settings.salesforceInstanceUrl, settings.salesforceAccessToken);
        showToast(res.success ? `✓ ${res.created} leads pushed to Salesforce` : `Salesforce error: ${res.error}`);
    });

    qs('#btn-open-outreach').addEventListener('click', () => {
        chrome.tabs.create({ url: chrome.runtime.getURL('pages/outreach.html') });
    });
}

function getFilteredLeads() {
    const q = (qs('#lead-search')?.value || '').toLowerCase();
    if (!q) return allLeads;
    return allLeads.filter(l => JSON.stringify(l).toLowerCase().includes(q));
}

function getExportLeads() {
    const filtered = getFilteredLeads();
    return selectedLeadIds.size > 0 ? filtered.filter(l => selectedLeadIds.has(l.id)) : filtered;
}

function renderLeadsTable() {
    const leads = getFilteredLeads();
    const empty = qs('#leads-empty');
    const table = qs('#lead-table');

    renderLeadCount(leads.length);

    if (!leads.length) {
        empty.style.display = '';
        table.style.display = 'none';
        return;
    }
    empty.style.display = 'none';
    table.style.display = '';

    const DISPLAY_KEYS = ['name', 'company', 'email', 'phone', 'website'];
    const keys = DISPLAY_KEYS.filter(k => leads.some(l => l[k]));

    qs('#lead-table-head').innerHTML = `<tr>
    <th class="col-check">☑</th>
    ${keys.map(k => `<th>${k}</th>`).join('')}
  </tr>`;

    qs('#lead-table-body').innerHTML = leads.map(l => `
    <tr>
      <td class="col-check">
        <input type="checkbox" data-id="${esc(l.id)}" ${selectedLeadIds.has(l.id) ? 'checked' : ''}>
      </td>
      ${keys.map(k => `<td title="${esc(l[k] || '')}">${esc((l[k] || '').slice(0, 30))}</td>`).join('')}
    </tr>
  `).join('');

    qs('#lead-table-body').querySelectorAll('input[type=checkbox]').forEach(cb => {
        cb.addEventListener('change', () => {
            if (cb.checked) selectedLeadIds.add(cb.dataset.id);
            else selectedLeadIds.delete(cb.dataset.id);
        });
    });
}

function renderLeadCount(count) {
    const n = count ?? allLeads.length;
    qs('#leads-count').textContent = n;
    if (qs('#stat-leads')) qs('#stat-leads').textContent = allLeads.length;
}

// ─── Templates Tab ─────────────────────────────────────────────────────────────

function setupTemplatesTab() {
    qs('#btn-marketplace').addEventListener('click', () => {
        chrome.tabs.create({ url: chrome.runtime.getURL('pages/marketplace.html') });
    });

    qs('#btn-import-template').addEventListener('click', () => {
        const input = document.createElement('input');
        input.type = 'file'; input.accept = '.json';
        input.onchange = async (e) => {
            const file = e.target.files[0];
            if (!file) return;
            const text = await file.text();
            try {
                const tpl = JSON.parse(text);
                await chrome.runtime.sendMessage({ type: 'SAVE_TEMPLATE', template: { ...tpl, id: undefined } });
                await loadAll();
                showToast('Template imported!');
            } catch { showToast('Invalid template file.'); }
        };
        input.click();
    });

    qs('#btn-close-modal').addEventListener('click', () => {
        qs('#template-editor-overlay').style.display = 'none';
        editingTemplate = null;
    });

    qs('#btn-add-field').addEventListener('click', () => {
        editingTemplate.fields.push({ name: 'field', type: 'text', selector: '', confidence: 80, autoFallback: true });
        renderEditFieldList();
    });

    qs('#btn-save-edit').addEventListener('click', async () => {
        editingTemplate.name = qs('#edit-template-name').value.trim() || 'Untitled';
        await chrome.runtime.sendMessage({ type: 'SAVE_TEMPLATE', template: editingTemplate });
        qs('#template-editor-overlay').style.display = 'none';
        await loadAll();
        showToast('Template saved!');
    });
}

function renderTemplateList() {
    const list = qs('#template-list');
    const select = qs('#template-select');

    if (!allTemplates.length) {
        list.innerHTML = `<div class="empty-state"><div class="empty-icon">📋</div><p>No templates yet.<br>Use training mode to create one.</p></div>`;
        select.innerHTML = `<option value="">— Select a template —</option>`;
        return;
    }

    select.innerHTML = `<option value="">— Select a template —</option>` +
        allTemplates.map(t => `<option value="${t.id}" ${t.id === activeTemplateId ? 'selected' : ''}>${esc(t.name)}</option>`).join('');

    list.innerHTML = allTemplates.map(t => `
    <div class="template-card ${t.id === activeTemplateId ? 'active-tpl' : ''}" data-id="${t.id}">
      <span class="template-icon">${t.builtIn ? '⭐' : '📋'}</span>
      <div class="template-info">
        <div class="template-name">${esc(t.name)}</div>
        <div class="template-meta">${(t.fields || []).length} fields · ${t.domain || 'any site'}</div>
      </div>
      <div class="template-actions">
        <button class="tpl-btn use-btn" data-id="${t.id}" title="Use">✓</button>
        <button class="tpl-btn edit-btn" data-id="${t.id}" title="Edit">✏</button>
        <button class="tpl-btn export-btn" data-id="${t.id}" title="Export JSON">⬇</button>
        <button class="tpl-btn del" data-id="${t.id}" title="Delete">🗑</button>
      </div>
    </div>
  `).join('');

    list.querySelectorAll('.use-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            activeTemplateId = btn.dataset.id;
            await chrome.runtime.sendMessage({ type: 'SET_ACTIVE_TEMPLATE', id: activeTemplateId });
            renderAll();
            // Switch to extract tab
            document.querySelector('[data-tab="extract"]').click();
        });
    });

    list.querySelectorAll('.edit-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            editingTemplate = JSON.parse(JSON.stringify(allTemplates.find(t => t.id === btn.dataset.id)));
            qs('#modal-title').textContent = 'Edit Template';
            qs('#edit-template-name').value = editingTemplate.name;
            renderEditFieldList();
            qs('#template-editor-overlay').style.display = 'flex';
        });
    });

    list.querySelectorAll('.export-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const tpl = allTemplates.find(t => t.id === btn.dataset.id);
            const json = JSON.stringify(tpl, null, 2);
            const blob = new Blob([json], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a'); a.href = url;
            a.download = `${tpl.name.replace(/\s+/g, '-')}.json`; a.click();
            setTimeout(() => URL.revokeObjectURL(url), 1000);
        });
    });

    list.querySelectorAll('.del').forEach(btn => {
        btn.addEventListener('click', async () => {
            if (!confirm('Delete this template?')) return;
            const { templates = [] } = await chrome.storage.local.get('templates');
            await chrome.storage.local.set({ templates: templates.filter(t => t.id !== btn.dataset.id) });
            await loadAll();
        });
    });
}

function renderTemplateSelect() { renderTemplateList(); }

function renderEditFieldList() {
    const container = qs('#edit-field-list');
    const TYPES = ['text', 'email', 'phone', 'address', 'company', 'name', 'website', 'linkedin', 'title', 'industry'];
    container.innerHTML = (editingTemplate.fields || []).map((f, i) => `
    <div class="edit-field-row" data-idx="${i}">
      <input placeholder="Field name" class="ef-name" value="${esc(f.name)}">
      <select class="ef-type">
        ${TYPES.map(t => `<option value="${t}" ${f.type === t ? 'selected' : ''}>${t}</option>`).join('')}
      </select>
      <button class="tpl-btn del ef-del" data-idx="${i}">✕</button>
    </div>
  `).join('');

    container.querySelectorAll('.ef-name').forEach((inp, i) => {
        inp.addEventListener('input', () => { editingTemplate.fields[i].name = inp.value; });
    });
    container.querySelectorAll('.ef-type').forEach((sel, i) => {
        sel.addEventListener('change', () => { editingTemplate.fields[i].type = sel.value; });
    });
    container.querySelectorAll('.ef-del').forEach(btn => {
        btn.addEventListener('click', () => {
            editingTemplate.fields.splice(Number(btn.dataset.idx), 1);
            renderEditFieldList();
        });
    });
}

// ─── Tools Tab ─────────────────────────────────────────────────────────────────

function setupToolsTab() {
    qs('#tool-options').addEventListener('click', openOptions);
    qs('#btn-open-options').addEventListener('click', openOptions);
    qs('#tool-marketplace').addEventListener('click', () => chrome.tabs.create({ url: chrome.runtime.getURL('pages/marketplace.html') }));
    qs('#tool-outreach').addEventListener('click', () => chrome.tabs.create({ url: chrome.runtime.getURL('pages/outreach.html') }));
    qs('#tool-export-all').addEventListener('click', () => exportToCSV(allLeads, 'all-leads.csv'));
    qs('#btn-gdpr-purge').addEventListener('click', async () => {
        if (!confirm('This will permanently delete ALL leads and reset all settings. Are you sure?')) return;
        await chrome.storage.local.clear();
        await loadAll();
        showToast('All data purged.');
    });
}

function updateWorkspaceName() {
    const nameEl = qs('#workspace-name');
    if (nameEl) nameEl.textContent = settings.teamName || 'My Workspace';
}

function updateStats() {
    if (qs('#stat-leads')) qs('#stat-leads').textContent = allLeads.length;
    if (qs('#stat-templates')) qs('#stat-templates').textContent = allTemplates.length;
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

function openOptions() {
    chrome.runtime.openOptionsPage();
}

async function updateCurrentDomain() {
    qs('#current-domain').textContent = 'algostackbd.com';
}

let progressTimer = null;
function showProgress(label = 'Working…') {
    qs('#progress-area').style.display = 'block';
    qs('#progress-label').textContent = label;
    let w = 0;
    clearInterval(progressTimer);
    progressTimer = setInterval(() => {
        w = Math.min(w + Math.random() * 8, 90);
        qs('#progress-bar').style.width = `${w}%`;
    }, 300);
}
function stopProgress() {
    clearInterval(progressTimer);
    qs('#progress-bar').style.width = '100%';
    setTimeout(() => { qs('#progress-area').style.display = 'none'; qs('#progress-bar').style.width = '0'; }, 600);
}

let toastTimer = null;
function showToast(msg) {
    let t = document.getElementById('lhp-toast');
    if (!t) {
        t = document.createElement('div');
        t.id = 'lhp-toast';
        t.style.cssText = `position:fixed;bottom:10px;left:50%;transform:translateX(-50%);background:#1e1b4b;color:#a5b4fc;padding:8px 16px;border-radius:20px;font-size:12px;font-weight:600;border:1px solid #4338ca;box-shadow:0 4px 20px rgba(0,0,0,0.5);z-index:999;transition:opacity 0.25s;white-space:nowrap;`;
        document.body.appendChild(t);
    }
    t.textContent = msg;
    t.style.opacity = '1';
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { t.style.opacity = '0'; }, 2500);
}

function qs(sel) { return document.querySelector(sel); }
function esc(s) { return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
