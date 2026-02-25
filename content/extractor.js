/**
 * LeadHarvest Pro — AI Extraction Engine
 * Runs in page context (content script).
 *
 * Provides:
 *  - Semantic field detection via HTML attributes & heuristics
 *  - Repeating pattern detection
 *  - NLP-style field type classification
 *  - Confidence scoring
 *  - Template-driven extraction
 */

// ─── NLP Field Classifiers ────────────────────────────────────────────────────

const CLASSIFIERS = {
    email: {
        pattern: /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/,
        keywords: ['email', 'e-mail', 'mail', 'contact'],
        score: 95,
    },
    phone: {
        pattern: /(\+?[\d\s\-().]{7,20})/,
        keywords: ['phone', 'tel', 'mobile', 'cell', 'fax', 'call'],
        score: 85,
    },
    address: {
        pattern: /\d+\s+[\w\s]+(?:street|st|avenue|ave|road|rd|boulevard|blvd|drive|dr|lane|ln|way|court|ct)/i,
        keywords: ['address', 'location', 'office', 'headquarters', 'hq', 'addr'],
        score: 80,
    },
    company: {
        pattern: /\b(inc|llc|ltd|corp|company|co\.|group|enterprises?)\b/i,
        keywords: ['company', 'organization', 'firm', 'business', 'employer', 'brand'],
        score: 75,
    },
    website: {
        pattern: /https?:\/\/[^\s"'<>]+/,
        keywords: ['website', 'url', 'site', 'web', 'homepage', 'link'],
        score: 90,
    },
    name: {
        pattern: /^[A-Z][a-z]+ [A-Z][a-z]+/,
        keywords: ['name', 'contact', 'person', 'owner', 'ceo', 'founder', 'manager'],
        score: 70,
    },
    title: {
        pattern: /\b(ceo|cto|cfo|director|manager|founder|president|vp|partner|associate)\b/i,
        keywords: ['title', 'role', 'position', 'designation', 'job'],
        score: 72,
    },
    linkedin: {
        pattern: /linkedin\.com\/in\/[^\s"'<>]+/,
        keywords: ['linkedin'],
        score: 92,
    },
};

/**
 * Classify a text string + element into a field type.
 * Returns { type, confidence }
 */
export function classifyField(text, element) {
    if (!text) return { type: 'unknown', confidence: 0 };
    const lower = (text || '').toLowerCase().trim();
    let best = { type: 'unknown', confidence: 0 };

    // Check semantic attributes for strong hints
    const itemprop = element?.getAttribute('itemprop') || '';
    const label = [
        element?.getAttribute('aria-label') || '',
        element?.getAttribute('data-field') || '',
        element?.getAttribute('name') || '',
        element?.id || '',
        element?.className || '',
        itemprop,
    ].join(' ').toLowerCase();

    for (const [type, cfg] of Object.entries(CLASSIFIERS)) {
        let conf = 0;

        // Pattern match on value
        if (cfg.pattern.test(text)) conf += cfg.score;

        // Keyword match on surrounding labels
        const kwMatch = cfg.keywords.some(kw => label.includes(kw));
        if (kwMatch) conf = Math.max(conf, 65) + 15;

        // Anchor href / mailto / tel hints
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

// ─── CSS Selector Generalization ───────────────────────────────────────────────

/**
 * Produce a stable, generalized CSS selector for an element.
 * Strips :nth-child positional selectors where possible.
 */
export function generalizeSelector(el) {
    const parts = [];
    let current = el;

    while (current && current !== document.body) {
        let selector = current.tagName.toLowerCase();

        if (current.id && /^[a-zA-Z][a-zA-Z0-9_-]*$/.test(current.id)) {
            // ID selectors are very stable
            parts.unshift(`#${current.id}`);
            break;
        }

        // Prefer semantic class names (non-generated)
        const stableClasses = Array.from(current.classList).filter(
            c => !/^[a-z]{1,2}\d+$|css-[a-z0-9]+|sc-[a-z0-9]+/.test(c)
        );
        if (stableClasses.length > 0) {
            selector += '.' + stableClasses.slice(0, 2).join('.');
        }

        // Check for data attributes
        const dataKey = Array.from(current.attributes).find(a => a.name.startsWith('data-') && !/id|index|key/.test(a.name));
        if (dataKey) selector += `[${dataKey.name}]`;

        parts.unshift(selector);
        current = current.parentElement;
    }

    return parts.join(' > ');
}

// ─── Repeating Pattern Detection ──────────────────────────────────────────────

/**
 * Find the most common leaf-list pattern in the page:
 * groups of sibling elements with the same tag/class structure.
 * Returns an array of "record root" elements.
 */
export function detectRepeatingPatterns(root = document.body) {
    const candidateMap = new Map(); // selector → [element, ...]

    const walk = (node) => {
        if (!node || node.nodeType !== 1) return;
        const children = Array.from(node.children);
        if (children.length < 2) { children.forEach(walk); return; }

        // Group children by their tag + class fingerprint
        const groups = new Map();
        for (const child of children) {
            const key = `${child.tagName}|${Array.from(child.classList).sort().join('.')}`;
            if (!groups.has(key)) groups.set(key, []);
            groups.get(key).push(child);
        }

        for (const [key, group] of groups.entries()) {
            if (group.length >= 3) {
                // Looks like a repeating list!
                const existing = candidateMap.get(key) || [];
                if (group.length > existing.length) candidateMap.set(key, group);
            }
            group.forEach(walk);
        }
    };

    walk(root);

    // Return the largest group
    let bestGroup = [];
    for (const group of candidateMap.values()) {
        if (group.length > bestGroup.length) bestGroup = group;
    }
    return bestGroup;
}

// ─── Auto-Detect Fields in a Record ───────────────────────────────────────────

/**
 * Given a record root element, extract all text nodes and classify them.
 * Returns an array of { type, value, confidence, selector }
 */
export function autoExtractFields(recordEl) {
    const results = [];
    const seen = new Set();

    const visit = (el) => {
        if (!el || el.nodeType !== 1) return;

        // Skip invisible elements
        const style = window.getComputedStyle(el);
        if (style.display === 'none' || style.visibility === 'hidden') return;

        const text = (el.innerText || el.textContent || '').trim();
        if (!text || text.length < 2 || text.length > 300) {
            Array.from(el.children).forEach(visit);
            return;
        }

        // Deduplicate by value
        if (seen.has(text)) { Array.from(el.children).forEach(visit); return; }
        seen.add(text);

        const { type, confidence } = classifyField(text, el);
        if (confidence > 40) {
            results.push({
                type,
                value: type === 'website' || type === 'linkedin' ? (el.href || text) : text,
                confidence,
                selector: generalizeSelector(el),
            });
        }

        Array.from(el.children).forEach(visit);
    };

    visit(recordEl);

    // Merge duplicates by type, keeping highest confidence
    const merged = new Map();
    for (const r of results) {
        const cur = merged.get(r.type);
        if (!cur || r.confidence > cur.confidence) merged.set(r.type, r);
    }
    return Array.from(merged.values());
}

// ─── Template-Driven Extraction ───────────────────────────────────────────────

/**
 * Run extraction using a saved template's field selectors.
 * Returns array of lead objects.
 */
export function extractByTemplate(template) {
    const leads = [];

    if (!template || !template.fields || template.fields.length === 0) return leads;

    // Try to find record containers first
    let records = [];
    if (template.recordSelector) {
        records = Array.from(document.querySelectorAll(template.recordSelector));
    }

    if (records.length === 0) {
        // Fallback: detect repeating patterns
        records = detectRepeatingPatterns();
    }

    if (records.length === 0) {
        // Single-record page
        records = [document.body];
    }

    for (const record of records) {
        const lead = { _source: window.location.href };
        let hasAnyValue = false;

        for (const field of template.fields) {
            try {
                const el = field.selector ? record.querySelector(field.selector) : null;
                let value = '';

                if (el) {
                    if (el.tagName === 'A' && el.href) {
                        if (el.href.startsWith('mailto:')) value = el.href.replace('mailto:', '');
                        else if (el.href.startsWith('tel:')) value = el.href.replace('tel:', '');
                        else value = el.href;
                    } else {
                        value = (el.innerText || el.textContent || '').trim();
                    }
                }

                // If selector didn't work, try a page-wide search by type
                if (!value && field.autoFallback !== false) {
                    value = autoFindByType(field.type, record);
                }

                if (value) {
                    lead[field.name] = value;
                    lead[`${field.name}_confidence`] = field.confidence || 80;
                    hasAnyValue = true;
                }
            } catch (e) {
                // Selector may not match — skip field
            }
        }

        if (hasAnyValue) leads.push(lead);
    }

    return leads;
}

/**
 * Heuristic page-wide fallback: find first element matching a type
 */
function autoFindByType(type, root = document.body) {
    const cfg = CLASSIFIERS[type];
    if (!cfg) return '';

    // Special cases
    if (type === 'email') {
        const mailto = root.querySelector('a[href^="mailto:"]');
        if (mailto) return mailto.href.replace('mailto:', '');
        const metaEmail = document.querySelector('meta[itemprop="email"]');
        if (metaEmail) return metaEmail.getAttribute('content') || '';
    }
    if (type === 'phone') {
        const tel = root.querySelector('a[href^="tel:"]');
        if (tel) return tel.href.replace('tel:', '');
    }
    if (type === 'website') {
        const link = root.querySelector('a[href^="http"]:not([href*="facebook"]):not([href*="twitter"])');
        if (link) return link.href;
    }
    if (type === 'linkedin') {
        const li = root.querySelector('a[href*="linkedin.com"]');
        if (li) return li.href;
    }

    // Text scan
    const allText = Array.from(root.querySelectorAll('*'))
        .filter(el => !el.children.length)
        .map(el => ({ el, text: (el.innerText || el.textContent || '').trim() }))
        .filter(({ text }) => text.length > 0 && text.length < 200);

    for (const { text } of allText) {
        if (cfg.pattern.test(text)) return text;
    }

    return '';
}
