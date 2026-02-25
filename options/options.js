/**
 * LeadHarvest Pro — Options Page Controller
 */

const FIELD_IDS = [
    'hunterApiKey', 'clearbitApiKey', 'hubspotApiKey',
    'salesforceInstanceUrl', 'salesforceAccessToken',
    'openaiApiKey', 'enableEnrichment', 'requestDelayMs',
    'proxyPacUrl', 'teamName', 'gdprMode',
];

let settings = {};
let members = [];

document.addEventListener('DOMContentLoaded', async () => {
    await loadSettings();
    setupNav();
    setupShowBtns();
    setupSave();
    setupMemberActions();
    setupDangerBtns();
});

// ─── Load & Render ─────────────────────────────────────────────────────────────

async function loadSettings() {
    const { settings: s = {}, teamMembers: m = [] } = await chrome.storage.local.get(['settings', 'teamMembers']);
    settings = s;
    members = m;

    for (const id of FIELD_IDS) {
        const el = document.getElementById(id);
        if (!el) continue;
        if (el.type === 'checkbox') el.checked = !!settings[id];
        else el.value = settings[id] ?? '';
    }
    renderMembers();
}

function renderMembers() {
    const list = document.getElementById('member-list');
    if (!list) return;
    list.innerHTML = members.map((m, i) => `
    <div class="member-row" data-idx="${i}">
      <input class="member-email" value="${esc(m.email)}" placeholder="email@company.com">
      <select class="member-role">
        <option ${m.role === 'Owner' ? 'selected' : ''}>Owner</option>
        <option ${m.role === 'Editor' ? 'selected' : ''}>Editor</option>
        <option ${m.role === 'Viewer' ? 'selected' : ''}>Viewer</option>
      </select>
      <button class="del-member" data-idx="${i}">✕</button>
    </div>
  `).join('') || '<p style="font-size:12px;color:var(--text-muted);padding:8px 0">No team members yet.</p>';

    list.querySelectorAll('.member-email').forEach((inp, i) => {
        inp.addEventListener('input', () => { members[i].email = inp.value; });
    });
    list.querySelectorAll('.member-role').forEach((sel, i) => {
        sel.addEventListener('change', () => { members[i].role = sel.value; });
    });
    list.querySelectorAll('.del-member').forEach(btn => {
        btn.addEventListener('click', () => {
            members.splice(Number(btn.dataset.idx), 1);
            renderMembers();
        });
    });
}

// ─── Nav ───────────────────────────────────────────────────────────────────────

function setupNav() {
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
            document.querySelectorAll('.settings-section').forEach(s => s.classList.remove('active'));
            item.classList.add('active');
            document.getElementById(`section-${item.dataset.section}`)?.classList.add('active');
        });
    });
}

// ─── Show/Hide Keys ────────────────────────────────────────────────────────────

function setupShowBtns() {
    document.querySelectorAll('.show-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const inp = document.getElementById(btn.dataset.target);
            if (!inp) return;
            inp.type = inp.type === 'password' ? 'text' : 'password';
            btn.textContent = inp.type === 'password' ? '👁' : '🙈';
        });
    });
}

// ─── Save ──────────────────────────────────────────────────────────────────────

function setupSave() {
    document.getElementById('btn-save').addEventListener('click', async () => {
        const updated = {};
        for (const id of FIELD_IDS) {
            const el = document.getElementById(id);
            if (!el) continue;
            updated[id] = el.type === 'checkbox' ? el.checked : el.value.trim();
        }
        // Numeric coercion
        if (updated.requestDelayMs) updated.requestDelayMs = parseInt(updated.requestDelayMs) || 1500;

        await chrome.storage.local.set({ settings: { ...settings, ...updated }, teamMembers: members });
        settings = { ...settings, ...updated };
        showToast('Settings saved!');
    });
}

// ─── Member Actions ────────────────────────────────────────────────────────────

function setupMemberActions() {
    document.getElementById('btn-add-member')?.addEventListener('click', () => {
        members.push({ email: '', role: 'Viewer' });
        renderMembers();
    });
}

// ─── Danger Buttons ────────────────────────────────────────────────────────────

function setupDangerBtns() {
    document.getElementById('btn-purge-all')?.addEventListener('click', async () => {
        if (!confirm('This will permanently delete ALL leads, templates, and settings. This action cannot be undone.')) return;
        await chrome.storage.local.clear();
        settings = {}; members = [];
        await loadSettings();
        showToast('All data purged.');
    });
}

// ─── Toast ─────────────────────────────────────────────────────────────────────

let toastTimer;
function showToast(msg) {
    const t = document.getElementById('toast');
    t.textContent = msg;
    t.classList.remove('hidden');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.add('hidden'), 2500);
}

function esc(s) { return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
