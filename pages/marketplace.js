/**
 * LeadHarvest Pro — Template Marketplace
 * Local-first marketplace with 12 built-in templates.
 * Community sharing via JSON import/export.
 */

const BUILT_IN_TEMPLATES = [
    {
        id: 'bi_linkedin', name: 'LinkedIn Profiles', icon: '💼', domain: 'linkedin.com', category: 'social',
        description: 'Extract professional profiles: name, title, company, location, and about section from LinkedIn search results.',
        fields: [
            { name: 'name', type: 'name', selector: '.entity-result__title-text', confidence: 90, autoFallback: true },
            { name: 'title', type: 'title', selector: '.entity-result__primary-subtitle', confidence: 85, autoFallback: true },
            { name: 'company', type: 'company', selector: '.entity-result__secondary-subtitle', confidence: 82, autoFallback: true },
            { name: 'linkedin', type: 'linkedin', selector: 'a.app-aware-link', confidence: 95, autoFallback: true },
        ],
        author: 'LeadHarvest Team', rating: 4.9, installs: 12400, builtIn: true,
    },
    {
        id: 'bi_yelp', name: 'Yelp Business Listings', icon: '🌟', domain: 'yelp.com', category: 'directory',
        description: 'Scrape business name, phone, address, rating, and category from Yelp search results.',
        fields: [
            { name: 'company', type: 'company', selector: 'h3 a.css-19v1rkv', confidence: 92, autoFallback: true },
            { name: 'phone', type: 'phone', selector: 'p.css-1p9ibgf', confidence: 88, autoFallback: true },
            { name: 'address', type: 'address', selector: '.css-qyp8bo', confidence: 82, autoFallback: true },
        ],
        author: 'LeadHarvest Team', rating: 4.7, installs: 8900, builtIn: true,
    },
    {
        id: 'bi_yellowpages', name: 'Yellow Pages', icon: '📒', domain: 'yellowpages.com', category: 'directory',
        description: 'Extract business listings including name, phone, address, website, and category from Yellow Pages.',
        fields: [
            { name: 'company', type: 'company', selector: '.business-name a', confidence: 95, autoFallback: true },
            { name: 'phone', type: 'phone', selector: '.phones.phone.primary', confidence: 92, autoFallback: true },
            { name: 'address', type: 'address', selector: '.street-address,.locality', confidence: 88, autoFallback: true },
            { name: 'website', type: 'website', selector: 'a.track-visit-website', confidence: 90, autoFallback: true },
        ],
        author: 'LeadHarvest Team', rating: 4.8, installs: 11200, builtIn: true,
    },
    {
        id: 'bi_crunchbase', name: 'Crunchbase Companies', icon: '🚀', domain: 'crunchbase.com', category: 'directory',
        description: 'Collect startup data: company name, industry, funding, location, and founding year.',
        fields: [
            { name: 'company', type: 'company', selector: '.identifier-label', confidence: 90, autoFallback: true },
            { name: 'industry', type: 'text', selector: '.chip-container', confidence: 75, autoFallback: true },
            { name: 'website', type: 'website', selector: 'a[href*="http"]:not([href*="crunchbase"])', confidence: 85, autoFallback: true },
        ],
        author: 'LeadHarvest Team', rating: 4.6, installs: 7300, builtIn: true,
    },
    {
        id: 'bi_googlemaps', name: 'Google Maps Places', icon: '📍', domain: 'google.com/maps', category: 'directory',
        description: 'Extract local business names, addresses, phone numbers, and ratings from Google Maps.',
        fields: [
            { name: 'company', type: 'company', selector: '.qBF1Pd', confidence: 90, autoFallback: true },
            { name: 'address', type: 'address', selector: '.W4Efsd', confidence: 82, autoFallback: true },
            { name: 'phone', type: 'phone', selector: '[data-item-id^="phone"]', confidence: 88, autoFallback: true },
        ],
        author: 'LeadHarvest Team', rating: 4.7, installs: 9800, builtIn: true,
    },
    {
        id: 'bi_producthunt', name: 'Product Hunt Products', icon: '🐱', domain: 'producthunt.com', category: 'social',
        description: 'Scrape product name, tagline, maker, and upvotes from Product Hunt listings.',
        fields: [
            { name: 'company', type: 'company', selector: '[data-test="product-item-name"]', confidence: 88, autoFallback: true },
            { name: 'website', type: 'website', selector: 'a[data-test="product-link"]', confidence: 90, autoFallback: true },
        ],
        author: 'Community', rating: 4.4, installs: 3200, builtIn: true,
    },
    {
        id: 'bi_g2', name: 'G2 Software Reviews', icon: '⭐', domain: 'g2.com', category: 'directory',
        description: 'Extract software company names, categories, ratings, and review counts from G2.',
        fields: [
            { name: 'company', type: 'company', selector: '.product-card__product-name', confidence: 90, autoFallback: true },
            { name: 'website', type: 'website', selector: 'a.product-card__visite-website', confidence: 86, autoFallback: true },
        ],
        author: 'Community', rating: 4.3, installs: 2800, builtIn: true,
    },
    {
        id: 'bi_shopify', name: 'Shopify Store Directory', icon: '🛍', domain: 'myshopify.com', category: 'ecommerce',
        description: 'Collect Shopify store names, owner emails, and product categories from store contact pages.',
        fields: [
            { name: 'company', type: 'company', selector: 'h1.shop-name, .logo', confidence: 80, autoFallback: true },
            { name: 'email', type: 'email', selector: 'a[href^="mailto:"]', confidence: 96, autoFallback: true },
            { name: 'website', type: 'website', selector: 'link[rel="canonical"]', confidence: 88, autoFallback: true },
        ],
        author: 'Community', rating: 4.2, installs: 5600, builtIn: true,
    },
    {
        id: 'bi_upwork', name: 'Upwork Freelancers', icon: '👨‍💻', domain: 'upwork.com', category: 'social',
        description: 'Extract freelancer names, skills, hourly rates, and titles from Upwork search.',
        fields: [
            { name: 'name', type: 'name', selector: '.freelancer-tile-name', confidence: 90, autoFallback: true },
            { name: 'title', type: 'title', selector: '.freelancer-tile-title', confidence: 85, autoFallback: true },
            { name: 'linkedin', type: 'linkedin', selector: 'a[href*="upwork.com/freelancers"]', confidence: 88, autoFallback: true },
        ],
        author: 'Community', rating: 4.5, installs: 4100, builtIn: true,
    },
    {
        id: 'bi_bbb', name: 'BBB Business Profiles', icon: '🏛', domain: 'bbb.org', category: 'directory',
        description: 'Scrape business name, email, phone, address, and accreditation status from Better Business Bureau.',
        fields: [
            { name: 'company', type: 'company', selector: 'h1.business-info__name', confidence: 93, autoFallback: true },
            { name: 'phone', type: 'phone', selector: 'a[href^="tel:"]', confidence: 95, autoFallback: true },
            { name: 'address', type: 'address', selector: '.business-info__address', confidence: 88, autoFallback: true },
            { name: 'email', type: 'email', selector: 'a[href^="mailto:"]', confidence: 96, autoFallback: true },
        ],
        author: 'LeadHarvest Team', rating: 4.6, installs: 6700, builtIn: true,
    },
    {
        id: 'bi_apollo', name: 'Apollo.io Contacts', icon: '🪐', domain: 'app.apollo.io', category: 'directory',
        description: "Extract contact cards from Apollo's exported lists for re-enrichment or deduplication.",
        fields: [
            { name: 'name', type: 'name', selector: '[class*="name"]', confidence: 80, autoFallback: true },
            { name: 'email', type: 'email', selector: 'a[href^="mailto:"]', confidence: 95, autoFallback: true },
            { name: 'company', type: 'company', selector: '[class*="company"]', confidence: 80, autoFallback: true },
            { name: 'title', type: 'title', selector: '[class*="title"]', confidence: 78, autoFallback: true },
        ],
        author: 'Community', rating: 4.0, installs: 2100, builtIn: true,
    },
    {
        id: 'bi_clutch', name: 'Clutch Agency Profiles', icon: '💡', domain: 'clutch.co', category: 'directory',
        description: 'Collect agency names, services, location, review count, and average rating from Clutch.co.',
        fields: [
            { name: 'company', type: 'company', selector: '.company_info--name', confidence: 90, autoFallback: true },
            { name: 'website', type: 'website', selector: 'a.website-link__item', confidence: 88, autoFallback: true },
            { name: 'phone', type: 'phone', selector: 'a[href^="tel:"]', confidence: 92, autoFallback: true },
        ],
        author: 'Community', rating: 4.4, installs: 3900, builtIn: true,
    },
];

// ─── State ─────────────────────────────────────────────────────────────────────
let installedIds = new Set();
let activeFilter = 'all';
let searchQuery = '';

document.addEventListener('DOMContentLoaded', async () => {
    const { templates = [] } = await chrome.storage.local.get('templates');
    installedIds = new Set(templates.map(t => t.id));

    renderGrid();
    setupSearch();
    setupFilters();
    setupPublish();
});

function getFiltered() {
    return BUILT_IN_TEMPLATES.filter(t => {
        const matchesFilter = activeFilter === 'all' || t.category === activeFilter;
        const q = searchQuery.toLowerCase();
        const matchesSearch = !q || t.name.toLowerCase().includes(q) || t.description.toLowerCase().includes(q) || t.domain.includes(q);
        return matchesFilter && matchesSearch;
    });
}

function renderGrid() {
    const grid = document.getElementById('mp-grid');
    const filtered = getFiltered();

    if (!filtered.length) {
        grid.innerHTML = `<div class="mp-empty" style="grid-column:1/-1"><div class="empty-icon">🔍</div><p>No templates match your search.</p></div>`;
        return;
    }

    grid.innerHTML = filtered.map(t => `
    <div class="mp-card">
      <div class="mp-card-header">
        <span class="mp-card-icon">${t.icon}</span>
        <div>
          <div class="mp-card-title">${esc(t.name)}</div>
          <div class="mp-card-domain">${esc(t.domain)}</div>
        </div>
      </div>
      <div class="mp-card-desc">${esc(t.description)}</div>
      <div class="field-tags">
        ${(t.fields || []).map(f => `<span class="field-tag">${esc(f.name)}</span>`).join('')}
      </div>
      <div class="mp-card-footer">
        <div class="mp-card-stats">
          <div class="stat-item">
            <span class="stars">${'★'.repeat(Math.round(t.rating))}${'☆'.repeat(5 - Math.round(t.rating))}</span>
            <span class="rating-val">${t.rating}</span>
          </div>
          <span class="stat-sep">·</span>
          <div class="stat-item">📥 ${(t.installs || 0).toLocaleString()}</div>
          <span class="stat-sep">·</span>
          <div class="mp-card-author">
            <div class="author-avatar">${esc((t.author || 'L')[0])}</div>
            <span class="author-name">${esc(t.author)}</span>
          </div>
        </div>
        <button class="install-btn ${installedIds.has(t.id) ? 'installed' : ''}" data-id="${t.id}">
          ${installedIds.has(t.id) ? '✓ Installed' : 'Install'}
        </button>
      </div>
    </div>
  `).join('');


    grid.querySelectorAll('.install-btn').forEach(btn => {
        btn.addEventListener('click', () => installTemplate(btn.dataset.id, btn));
    });
}

async function installTemplate(id, btn) {
    if (installedIds.has(id)) { showToast('Already installed!'); return; }
    const tpl = BUILT_IN_TEMPLATES.find(t => t.id === id);
    if (!tpl) return;

    const { templates = [] } = await chrome.storage.local.get('templates');
    templates.push({ ...tpl, installedAt: new Date().toISOString() });
    await chrome.storage.local.set({ templates });
    installedIds.add(id);

    btn.className = 'install-btn installed';
    btn.textContent = '✓ Installed';
    showToast(`"${tpl.name}" installed!`);
}

function setupSearch() {
    document.getElementById('mp-search').addEventListener('input', e => {
        searchQuery = e.target.value;
        renderGrid();
    });
}

function setupFilters() {
    document.querySelectorAll('.filter-btn[data-filter]').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.filter-btn[data-filter]').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            activeFilter = btn.dataset.filter;
            renderGrid();
        });
    });
}

function setupPublish() {
    document.getElementById('btn-publish').addEventListener('click', async () => {
        const { templates = [] } = await chrome.storage.local.get('templates');
        const userTemplates = templates.filter(t => !t.builtIn);
        if (!userTemplates.length) { showToast('No custom templates to publish.'); return; }

        // Let user pick which template to export
        const names = userTemplates.map((t, i) => `${i + 1}. ${t.name}`).join('\n');
        const choice = prompt(`Select template to export (enter number):\n${names}`);
        const idx = parseInt(choice) - 1;
        if (isNaN(idx) || !userTemplates[idx]) return;

        const tpl = userTemplates[idx];
        const json = JSON.stringify(tpl, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = `${tpl.name.replace(/\s+/g, '-')}.lhp-template.json`;
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        showToast('Template exported as JSON! Share it with your community.');
    });
}

let toastTimer;
function showToast(msg) {
    const t = document.getElementById('toast');
    t.textContent = msg; t.classList.remove('hidden');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.add('hidden'), 2500);
}

function esc(s) { return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
