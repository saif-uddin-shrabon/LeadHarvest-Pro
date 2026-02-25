/**
 * LeadHarvest Pro — Bundled Content Script
 * Self-contained single file — no ES module imports needed.
 * Injected via chrome.scripting.executeScript OR declared in manifest.
 *
 * Includes: Extractor + Trainer + Crawler + Message Handler
 */

(function () {
    'use strict';

    // Guard: prevent double injection
    if (window.__lhpInjected) return;
    window.__lhpInjected = true;

    // ═══════════════════════════════════════════════════════════════
    // SECTION 1 — NLP Field Classifiers & Extractor
    // ═══════════════════════════════════════════════════════════════

    const CLASSIFIERS = {
        email: { pattern: /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/, keywords: ['email', 'e-mail', 'mail', 'contact'], score: 95 },
        phone: { pattern: /(\+?[\d\s\-().]{7,20})/, keywords: ['phone', 'tel', 'mobile', 'cell', 'fax', 'call'], score: 85 },
        address: { pattern: /\d+\s+[\w\s]+(?:street|st|avenue|ave|road|rd|boulevard|blvd|drive|dr|lane|ln|way|court|ct)/i, keywords: ['address', 'location', 'office', 'headquarters', 'hq', 'addr'], score: 80 },
        company: { pattern: /\b(inc|llc|ltd|corp|company|co\.|group|enterprises?)\b/i, keywords: ['company', 'organization', 'firm', 'business', 'employer', 'brand'], score: 75 },
        website: { pattern: /https?:\/\/[^\s"'<>]+/, keywords: ['website', 'url', 'site', 'web', 'homepage', 'link'], score: 90 },
        name: { pattern: /^[A-Z][a-z]+ [A-Z][a-z]+/, keywords: ['name', 'contact', 'person', 'owner', 'ceo', 'founder', 'manager'], score: 70 },
        title: { pattern: /\b(ceo|cto|cfo|director|manager|founder|president|vp|partner|associate)\b/i, keywords: ['title', 'role', 'position', 'designation', 'job'], score: 72 },
        linkedin: { pattern: /linkedin\.com\/in\/[^\s"'<>]+/, keywords: ['linkedin'], score: 92 },
    };

    function classifyField(text, element) {
        if (!text) return { type: 'unknown', confidence: 0 };
        const label = [
            element?.getAttribute('aria-label') || '',
            element?.getAttribute('data-field') || '',
            element?.getAttribute('name') || '',
            element?.getAttribute('itemprop') || '',
            element?.id || '',
            element?.className || '',
        ].join(' ').toLowerCase();

        let best = { type: 'unknown', confidence: 0 };
        for (const [type, cfg] of Object.entries(CLASSIFIERS)) {
            let conf = 0;
            if (cfg.pattern.test(text)) conf += cfg.score;
            if (cfg.keywords.some(kw => label.includes(kw))) conf = Math.max(conf, 65) + 15;
            if (element?.tagName === 'A') {
                const href = element.href || '';
                if (type === 'email' && href.startsWith('mailto:')) conf = 98;
                if (type === 'phone' && href.startsWith('tel:')) conf = 97;
                if (type === 'website' && href.startsWith('http')) conf = Math.max(conf, 85);
                if (type === 'linkedin' && href.includes('linkedin.com')) conf = 99;
            }
            if (conf > best.confidence) best = { type, confidence: Math.min(conf, 99) };
        }
        return best;
    }

    function generalizeSelector(el) {
        const parts = [];
        let current = el;
        while (current && current !== document.body) {
            let selector = current.tagName.toLowerCase();
            if (current.id && /^[a-zA-Z][a-zA-Z0-9_-]*$/.test(current.id)) {
                parts.unshift('#' + current.id);
                break;
            }
            const stableClasses = Array.from(current.classList).filter(
                c => !/^[a-z]{1,2}\d+$|css-[a-z0-9]+|sc-[a-z0-9]+/.test(c)
            );
            if (stableClasses.length > 0) selector += '.' + stableClasses.slice(0, 2).join('.');
            const dataKey = Array.from(current.attributes).find(a => a.name.startsWith('data-') && !/id|index|key/.test(a.name));
            if (dataKey) selector += '[' + dataKey.name + ']';
            parts.unshift(selector);
            current = current.parentElement;
        }
        return parts.join(' > ');
    }

    function detectRepeatingPatterns(root) {
        root = root || document.body;
        const candidateMap = new Map();
        function walk(node) {
            if (!node || node.nodeType !== 1) return;
            const children = Array.from(node.children);
            if (children.length < 2) { children.forEach(walk); return; }
            const groups = new Map();
            for (const child of children) {
                const key = child.tagName + '|' + Array.from(child.classList).sort().join('.');
                if (!groups.has(key)) groups.set(key, []);
                groups.get(key).push(child);
            }
            for (const [key, group] of groups.entries()) {
                if (group.length >= 3) {
                    const existing = candidateMap.get(key) || [];
                    if (group.length > existing.length) candidateMap.set(key, group);
                }
                group.forEach(walk);
            }
        }
        walk(root);
        let bestGroup = [];
        for (const group of candidateMap.values()) {
            if (group.length > bestGroup.length) bestGroup = group;
        }
        return bestGroup;
    }

    function autoExtractFields(recordEl) {
        const results = [];
        const seen = new Set();
        function visit(el) {
            if (!el || el.nodeType !== 1) return;
            const style = window.getComputedStyle(el);
            if (style.display === 'none' || style.visibility === 'hidden') return;
            const text = (el.innerText || el.textContent || '').trim();
            if (!text || text.length < 2 || text.length > 300) { Array.from(el.children).forEach(visit); return; }
            if (seen.has(text)) { Array.from(el.children).forEach(visit); return; }
            seen.add(text);
            const { type, confidence } = classifyField(text, el);
            if (confidence > 40) {
                results.push({ type, value: (type === 'website' || type === 'linkedin') ? (el.href || text) : text, confidence, selector: generalizeSelector(el) });
            }
            Array.from(el.children).forEach(visit);
        }
        visit(recordEl);
        const merged = new Map();
        for (const r of results) {
            const cur = merged.get(r.type);
            if (!cur || r.confidence > cur.confidence) merged.set(r.type, r);
        }
        return Array.from(merged.values());
    }

    function autoFindByType(type, root) {
        root = root || document.body;
        const cfg = CLASSIFIERS[type];
        if (!cfg) return '';
        if (type === 'email') {
            const m = root.querySelector('a[href^="mailto:"]');
            if (m) return m.href.replace('mailto:', '');
            const meta = document.querySelector('meta[itemprop="email"]');
            if (meta) return meta.getAttribute('content') || '';
        }
        if (type === 'phone') { const t = root.querySelector('a[href^="tel:"]'); if (t) return t.href.replace('tel:', ''); }
        if (type === 'website') { const l = root.querySelector('a[href^="http"]:not([href*="facebook"]):not([href*="twitter"])'); if (l) return l.href; }
        if (type === 'linkedin') { const li = root.querySelector('a[href*="linkedin.com"]'); if (li) return li.href; }
        const allText = Array.from(root.querySelectorAll('*'))
            .filter(el => !el.children.length)
            .map(el => ({ el, text: (el.innerText || el.textContent || '').trim() }))
            .filter(({ text }) => text.length > 0 && text.length < 200);
        for (const { text } of allText) { if (cfg.pattern.test(text)) return text; }
        return '';
    }

    function extractByTemplate(template) {
        if (!template || !template.fields || !template.fields.length) return [];
        const leads = [];
        let records = template.recordSelector ? Array.from(document.querySelectorAll(template.recordSelector)) : [];
        if (!records.length) records = detectRepeatingPatterns();
        if (!records.length) records = [document.body];

        for (const record of records) {
            const lead = { _source: window.location.href };
            let hasAny = false;
            for (const field of template.fields) {
                try {
                    const el = field.selector ? record.querySelector(field.selector) : null;
                    let value = '';
                    if (el) {
                        if (el.tagName === 'A' && el.href) {
                            value = el.href.startsWith('mailto:') ? el.href.replace('mailto:', '') :
                                el.href.startsWith('tel:') ? el.href.replace('tel:', '') : el.href;
                        } else {
                            value = (el.innerText || el.textContent || '').trim();
                        }
                    }
                    if (!value && field.autoFallback !== false) value = autoFindByType(field.type, record);
                    if (value) { lead[field.name] = value; lead[field.name + '_confidence'] = field.confidence || 80; hasAny = true; }
                } catch (e) { /* selector mismatch — skip */ }
            }
            if (hasAny) leads.push(lead);
        }
        return leads;
    }

    // ═══════════════════════════════════════════════════════════════
    // SECTION 2 — Point-and-Click Trainer
    // ═══════════════════════════════════════════════════════════════

    let trainingActive = false;
    let trainSession = null;
    let highlightBox = null, tooltip = null, panel = null;

    function createTrainerOverlay() {
        highlightBox = document.createElement('div');
        highlightBox.id = 'lhp-highlight-box';
        document.body.appendChild(highlightBox);

        tooltip = document.createElement('div');
        tooltip.id = 'lhp-tooltip';
        document.body.appendChild(tooltip);

        panel = document.createElement('div');
        panel.id = 'lhp-training-panel';
        panel.innerHTML = `
      <div class="lhp-panel-header">
        <span class="lhp-panel-icon">🎯</span>
        <strong>Training Mode</strong>
        <button id="lhp-stop-training" title="Stop">✕</button>
      </div>
      <p class="lhp-panel-hint">Click any element to capture it as a field.</p>
      <ul id="lhp-field-list"></ul>
      <div class="lhp-panel-actions">
        <input id="lhp-template-name" type="text" placeholder="Template name…" />
        <button id="lhp-save-template" class="lhp-btn-primary">Save Template</button>
      </div>`;
        document.body.appendChild(panel);

        document.getElementById('lhp-stop-training').addEventListener('click', stopTraining);
        document.getElementById('lhp-save-template').addEventListener('click', saveTrainedTemplate);
    }

    function startTraining() {
        if (trainingActive) return;
        trainingActive = true;
        trainSession = { fields: [] };
        createTrainerOverlay();
        document.addEventListener('mouseover', onHover, true);
        document.addEventListener('mouseout', onHoverOut, true);
        document.addEventListener('click', onTrainClick, true);
        document.body.classList.add('lhp-training-active');
    }

    function stopTraining() {
        if (!trainingActive) return;
        trainingActive = false;
        document.removeEventListener('mouseover', onHover, true);
        document.removeEventListener('mouseout', onHoverOut, true);
        document.removeEventListener('click', onTrainClick, true);
        highlightBox?.remove(); tooltip?.remove(); panel?.remove();
        highlightBox = tooltip = panel = null;
        document.body.classList.remove('lhp-training-active');
        chrome.runtime.sendMessage({ type: 'TRAINING_STOPPED', fields: trainSession?.fields || [] });
        trainSession = null;
    }

    function isLhpEl(el) { return !!(el && el.closest && el.closest('#lhp-training-panel,#lhp-highlight-box,#lhp-tooltip')); }

    function onHover(e) {
        if (!trainingActive || isLhpEl(e.target)) return;
        e.stopPropagation();
        const rect = e.target.getBoundingClientRect();
        const sx = window.scrollX, sy = window.scrollY;
        Object.assign(highlightBox.style, { top: rect.top + sy + 'px', left: rect.left + sx + 'px', width: rect.width + 'px', height: rect.height + 'px', display: 'block' });
        const text = (e.target.innerText || e.target.textContent || '').trim().slice(0, 60);
        const { type, confidence } = classifyField(text, e.target);
        tooltip.textContent = type + ' (' + confidence + '%) — click to capture';
        Object.assign(tooltip.style, { top: rect.bottom + sy + 6 + 'px', left: rect.left + sx + 'px', display: 'block' });
    }

    function onHoverOut(e) {
        if (!trainingActive || isLhpEl(e.target)) return;
        if (highlightBox) highlightBox.style.display = 'none';
        if (tooltip) tooltip.style.display = 'none';
    }

    function onTrainClick(e) {
        if (!trainingActive || isLhpEl(e.target)) return;
        e.preventDefault(); e.stopPropagation();
        const el = e.target;
        const text = (el.innerText || el.textContent || '').trim().slice(0, 200);
        const value = (el.tagName === 'A' && el.href) ? el.href : text;
        const { type, confidence } = classifyField(text, el);
        const selector = generalizeSelector(el);
        const suggested = type !== 'unknown' ? type : 'field_' + (trainSession.fields.length + 1);
        const fieldName = window.prompt('Field name (detected: ' + type + ', confidence: ' + confidence + '%):', suggested);
        if (!fieldName) return;
        trainSession.fields.push({ name: fieldName, type, selector, sampleValue: value, confidence });
        renderTrainFieldList();
    }

    function renderTrainFieldList() {
        const list = document.getElementById('lhp-field-list');
        if (!list) return;
        list.innerHTML = trainSession.fields.map((f, i) => `
      <li class="lhp-field-item">
        <span class="lhp-field-badge lhp-type-${f.type}">${f.type}</span>
        <span class="lhp-field-name">${f.name}</span>
        <span class="lhp-field-conf">${f.confidence}%</span>
        <button class="lhp-del-field" data-idx="${i}">✕</button>
      </li>`).join('');
        list.querySelectorAll('.lhp-del-field').forEach(btn => {
            btn.addEventListener('click', () => { trainSession.fields.splice(+btn.dataset.idx, 1); renderTrainFieldList(); });
        });
    }

    async function saveTrainedTemplate() {
        const name = document.getElementById('lhp-template-name')?.value?.trim();
        if (!name) { alert('Please enter a template name.'); return; }
        if (!trainSession.fields.length) { alert('Please capture at least one field.'); return; }
        const template = { name, fields: trainSession.fields, domain: window.location.hostname, createdAt: new Date().toISOString(), builtIn: false };
        await chrome.runtime.sendMessage({ type: 'SAVE_TEMPLATE', template });
        alert('Template "' + name + '" saved!');
        stopTraining();
    }

    // ═══════════════════════════════════════════════════════════════
    // SECTION 3 — Pagination / Infinite Scroll
    // ═══════════════════════════════════════════════════════════════

    function detectNextPageUrl() {
        const relNext = document.querySelector('link[rel="next"]');
        if (relNext?.href) return relNext.href;
        const nextTexts = ['next', 'next page', '›', '»', '→', 'load more', 'show more'];
        for (const link of Array.from(document.querySelectorAll('a[href]'))) {
            const txt = (link.innerText || link.textContent || link.title || link.getAttribute('aria-label') || '').toLowerCase().trim();
            if (nextTexts.some(n => txt === n || txt.includes(n)) && !link.closest('[disabled]') && !link.classList.contains('disabled') && link.href && !link.href.startsWith('javascript')) {
                return link.href;
            }
        }
        return incrementUrlPageNumber(window.location.href);
    }

    function incrementUrlPageNumber(url) {
        const patterns = [
            /([?&](?:page|p|pg|paged|pagenum)=)(\d+)/,
            /(\/page\/)(\d+)(\/?)/, /(-page-)(\d+)/, /(_page_)(\d+)/,
        ];
        for (const re of patterns) {
            const m = url.match(re);
            if (m) return url.replace(re, (_, prefix, num, suffix = '') => prefix + (parseInt(num) + 1) + suffix);
        }
        return null;
    }

    // ═══════════════════════════════════════════════════════════════
    // SECTION 4 — Progress Badge
    // ═══════════════════════════════════════════════════════════════

    let badge = null, badgeTimer = null;

    function showProgressBadge(text, autoDismissMs) {
        if (!badge) {
            badge = document.createElement('div');
            badge.id = 'lhp-progress-badge';
            document.body.appendChild(badge);
        }
        badge.textContent = text;
        badge.classList.add('lhp-badge-visible');
        if (badgeTimer) clearTimeout(badgeTimer);
        if (autoDismissMs > 0) badgeTimer = setTimeout(() => badge?.classList.remove('lhp-badge-visible'), autoDismissMs);
    }

    // ═══════════════════════════════════════════════════════════════
    // SECTION 5 — Message Router
    // ═══════════════════════════════════════════════════════════════

    chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
        handleMsg(msg).then(sendResponse).catch(err => sendResponse({ ok: false, error: err.message }));
        return true;
    });

    async function handleMsg(msg) {
        switch (msg.type) {
            case 'PING': return { ok: true };
            case 'START_TRAINING': startTraining(); return { ok: true };
            case 'STOP_TRAINING': stopTraining(); return { ok: true };
            case 'EXTRACT': return { ok: true, leads: await runExtraction(msg.template, msg.crawlMode) };
            case 'AUTO_DETECT': {
                const recs = detectRepeatingPatterns();
                return { ok: true, records: recs.length, sampleFields: recs.length ? autoExtractFields(recs[0]) : [] };
            }
            case 'AUTO_DETECT_AI': {
                const recs = detectRepeatingPatterns();
                const snippet = recs.length ? recs[0].outerHTML : document.body.innerHTML.slice(0, 5000);
                const resp = await chrome.runtime.sendMessage({ type: 'AUTO_DETECT_AI', htmlSnippet: snippet });
                return resp;
            }
            case 'GET_NEXT_PAGE': return { ok: true, url: detectNextPageUrl() };
            default: return { ok: false, error: 'Unknown: ' + msg.type };
        }
    }

    async function runExtraction(template, crawlMode) {
        showProgressBadge('Extracting…');
        let leads = [];
        try {
            leads = extractByTemplate(template);
            if (leads.length > 0) await chrome.runtime.sendMessage({ type: 'APPEND_LEADS', leads });
            showProgressBadge('✓ ' + leads.length + ' leads found', 2500);
        } catch (e) {
            showProgressBadge('⚠ Error: ' + e.message, 3000);
        }
        if (crawlMode) {
            const nextUrl = detectNextPageUrl();
            setTimeout(() => chrome.runtime.sendMessage({ type: 'CRAWL_PAGE_DONE', nextUrl, leadsFound: leads.length }), 800);
        }
        return leads;
    }

})(); // end IIFE
