/**
 * LeadHarvest Pro — Lead Data Cleaner
 * Comprehensive cleaning rules for scraped lead data.
 */

// ─── Validation Helpers ────────────────────────────────────────────────────────

const EMAIL_RE = /^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/;
const PHONE_RE = /[\d]{6,}/;
const FAKE_EMAILS = ['test@', 'example@', 'noreply@', 'no-reply@', 'info@info', 'placeholder', 'user@user'];
const PLACEHOLDER_TEXT = /^(n\/a|na|none|null|undefined|unknown|your name|company name|test|sample|example|\-+|\.+)$/i;

function isValidEmail(email) {
    if (!email) return false;
    const e = email.trim().toLowerCase();
    if (!EMAIL_RE.test(e)) return false;
    if (FAKE_EMAILS.some(f => e.startsWith(f))) return false;
    return true;
}

function isValidPhone(phone) {
    if (!phone) return false;
    const digits = phone.replace(/\D/g, '');
    return digits.length >= 6 && digits.length <= 15;
}

function isPlaceholder(value) {
    return !value || PLACEHOLDER_TEXT.test(String(value).trim());
}

function countFilledFields(lead) {
    const IGNORE = ['_source', 'id', '_extractedAt'];
    return Object.entries(lead)
        .filter(([k, v]) => !IGNORE.includes(k) && !k.endsWith('_confidence') && v && !isPlaceholder(v))
        .length;
}

function normalizePhone(phone) {
    if (!phone) return phone;
    return phone.trim().replace(/[\u00AD\u2010-\u2015]/g, '-').replace(/\s+/g, ' ');
}

function normalizeEmail(email) {
    return email ? email.trim().toLowerCase() : email;
}

function normalizeText(val) {
    if (typeof val !== 'string') return val;
    return val.trim().replace(/\s{2,}/g, ' ');
}

// ─── Individual Cleaning Rules ─────────────────────────────────────────────────

/**
 * Rule: Remove exact duplicate leads.
 * Two leads are duplicates if:
 *   - Same email (normalized), OR
 *   - Same phone (digits only) AND same company name (normalized), OR
 *   - Same linkedin URL
 */
export function removeDuplicates(leads) {
    const seenEmail = new Map();
    const seenPhoneCompany = new Map();
    const seenLinkedin = new Map();
    const removed = [];
    const kept = [];

    for (const lead of leads) {
        const email = normalizeEmail(lead.email || '');
        const phoneDigits = (lead.phone || '').replace(/\D/g, '');
        const company = (lead.company || '').toLowerCase().trim();
        const linkedin = (lead.linkedin || '').toLowerCase().trim().replace(/\/$/, '');

        let isDup = false;
        let reason = '';

        if (email && isValidEmail(email) && seenEmail.has(email)) {
            isDup = true; reason = `Duplicate email: ${email}`;
        } else if (phoneDigits.length >= 6 && company && seenPhoneCompany.has(`${phoneDigits}|${company}`)) {
            isDup = true; reason = `Duplicate phone+company: ${lead.phone} / ${lead.company}`;
        } else if (linkedin && seenLinkedin.has(linkedin)) {
            isDup = true; reason = `Duplicate LinkedIn: ${linkedin}`;
        }

        if (isDup) {
            removed.push({ lead, reason });
        } else {
            kept.push(lead);
            if (email && isValidEmail(email)) seenEmail.set(email, true);
            if (phoneDigits.length >= 6 && company) seenPhoneCompany.set(`${phoneDigits}|${company}`, true);
            if (linkedin) seenLinkedin.set(linkedin, true);
        }
    }

    return { kept, removed, rule: 'removeDuplicates', count: removed.length };
}

/**
 * Rule: Remove leads that have too few useful fields.
 * A lead is considered "thin" if it has fewer than `minFields` filled values.
 * Default minimum: 2 fields (e.g. only a phone number with nothing else = worthless).
 */
export function removeThinLeads(leads, minFields = 2) {
    const removed = [];
    const kept = leads.filter(lead => {
        const filled = countFilledFields(lead);
        if (filled < minFields) {
            removed.push({ lead, reason: `Only ${filled} field(s) populated (minimum: ${minFields})` });
            return false;
        }
        return true;
    });
    return { kept, removed, rule: 'removeThinLeads', count: removed.length };
}

/**
 * Rule: Remove leads with no business identifier.
 * A lead needs at least one of: company, name, email, linkedin, website.
 * A lead that ONLY has a phone number is useless for outreach.
 */
export function removeNoIdentifier(leads) {
    const IDENTIFIER_FIELDS = ['company', 'name', 'email', 'linkedin', 'website'];
    const removed = [];
    const kept = leads.filter(lead => {
        const hasIdentifier = IDENTIFIER_FIELDS.some(f => lead[f] && !isPlaceholder(lead[f]));
        if (!hasIdentifier) {
            removed.push({ lead, reason: 'No business identifier (no company/name/email/linkedin/website)' });
            return false;
        }
        return true;
    });
    return { kept, removed, rule: 'removeNoIdentifier', count: removed.length };
}

/**
 * Rule: Remove leads with invalid email format.
 * Only removes the email field value, or the whole lead if removeRow=true.
 */
export function removeInvalidEmails(leads, removeRow = false) {
    const removed = [];
    const kept = leads.map(lead => {
        if (!lead.email) return lead;
        if (!isValidEmail(lead.email)) {
            const reason = `Invalid email format: ${lead.email}`;
            if (removeRow) { removed.push({ lead, reason }); return null; }
            const fixed = { ...lead };
            delete fixed.email; delete fixed.email_confidence;
            removed.push({ lead, reason: reason + ' (email field cleared)' });
            return fixed;
        }
        return lead;
    }).filter(Boolean);
    return { kept, removed, rule: 'removeInvalidEmails', count: removed.length };
}

/**
 * Rule: Remove leads with invalid phone numbers.
 * Clears the phone field (doesn't remove the whole row by default).
 */
export function removeInvalidPhones(leads, removeRow = false) {
    const removed = [];
    const kept = leads.map(lead => {
        if (!lead.phone) return lead;
        if (!isValidPhone(lead.phone)) {
            const reason = `Invalid phone: ${lead.phone}`;
            if (removeRow) { removed.push({ lead, reason }); return null; }
            const fixed = { ...lead };
            delete fixed.phone; delete fixed.phone_confidence;
            removed.push({ lead, reason: reason + ' (phone field cleared)' });
            return fixed;
        }
        return lead;
    }).filter(Boolean);
    return { kept, removed, rule: 'removeInvalidPhones', count: removed.length };
}

/**
 * Rule: Remove placeholder / dummy data.
 * Detects values like "N/A", "null", "Test Company", "Your Name Here", etc.
 */
export function removePlaceholders(leads) {
    const removed = [];
    const kept = leads.map(lead => {
        const fixed = { ...lead };
        let changed = false;
        for (const [k, v] of Object.entries(fixed)) {
            if (k.startsWith('_') || k.endsWith('_confidence')) continue;
            if (isPlaceholder(v)) { delete fixed[k]; changed = true; }
        }
        const stillUseful = countFilledFields(fixed) >= 1;
        if (!stillUseful) {
            removed.push({ lead, reason: 'All fields were placeholder values' });
            return null;
        }
        if (changed) removed.push({ lead: fixed, reason: 'Placeholder fields cleared' });
        return fixed;
    }).filter(Boolean);
    return { kept, removed, rule: 'removePlaceholders', count: removed.length };
}

/**
 * Rule: Normalize all string values.
 * - Trim whitespace
 * - Lowercase emails
 * - Normalize phone punctuation
 * - Collapse extra spaces
 */
export function normalizeFields(leads) {
    return {
        kept: leads.map(lead => {
            const fixed = { ...lead };
            for (const [k, v] of Object.entries(fixed)) {
                if (k.startsWith('_') || k.endsWith('_confidence')) continue;
                if (k === 'email') fixed[k] = normalizeEmail(v);
                else if (k === 'phone') fixed[k] = normalizePhone(v);
                else if (typeof v === 'string') fixed[k] = normalizeText(v);
            }
            return fixed;
        }),
        removed: [],
        rule: 'normalizeFields',
        count: 0,
    };
}

/**
 * Rule: Remove leads where the company name looks like a personal name
 * but NO personal name or email is present (scrape residue).
 * Heuristic: company field that is just two capitalized words looks like a person name.
 */
export function detectMisclassifiedFields(leads) {
    const PERSON_NAME_RE = /^[A-Z][a-z]+\s[A-Z][a-z]+$/;
    return {
        kept: leads.map(lead => {
            // If company looks like "John Smith" but name field is empty, swap them
            if (lead.company && !lead.name && PERSON_NAME_RE.test(lead.company.trim())) {
                return { ...lead, name: lead.company, company: undefined };
            }
            return lead;
        }),
        removed: [],
        rule: 'detectMisclassifiedFields',
        count: 0,
    };
}

// ─── Master Cleaner ────────────────────────────────────────────────────────────

/**
 * Run selected cleaning rules on a leads array.
 * Returns { cleaned: Lead[], report: CleanReport[] }
 */
export function cleanLeads(leads, options = {}) {
    const {
        deduplication = true,
        thinLeads = true,
        minFields = 2,
        noIdentifier = true,
        invalidEmails = true,
        invalidPhones = true,
        placeholders = true,
        normalize = true,
        misclassified = true,
    } = options;

    const report = [];
    let current = [...leads];

    if (normalize) {
        const r = normalizeFields(current);
        current = r.kept;
        report.push(r);
    }
    if (misclassified) {
        const r = detectMisclassifiedFields(current);
        current = r.kept;
        report.push(r);
    }
    if (placeholders) {
        const r = removePlaceholders(current);
        current = r.kept;
        report.push(r);
    }
    if (invalidEmails) {
        const r = removeInvalidEmails(current, false);
        current = r.kept;
        report.push(r);
    }
    if (invalidPhones) {
        const r = removeInvalidPhones(current, false);
        current = r.kept;
        report.push(r);
    }
    if (noIdentifier) {
        const r = removeNoIdentifier(current);
        current = r.kept;
        report.push(r);
    }
    if (thinLeads) {
        const r = removeThinLeads(current, minFields);
        current = r.kept;
        report.push(r);
    }
    if (deduplication) {
        const r = removeDuplicates(current);
        current = r.kept;
        report.push(r);
    }

    return { cleaned: current, report };
}

/**
 * Summarize a clean report into human-readable stats.
 */
export function summarizeReport(report, originalCount, cleanedCount) {
    const lines = [];
    for (const r of report) {
        if (r.count > 0 && r.rule !== 'normalizeFields' && r.rule !== 'detectMisclassifiedFields') {
            const label = {
                removeDuplicates: '🗂 Duplicates removed',
                removeThinLeads: '📉 Thin records removed',
                removeNoIdentifier: '🔍 No-identifier records removed',
                removeInvalidEmails: '📧 Invalid emails cleared',
                removeInvalidPhones: '📞 Invalid phones cleared',
                removePlaceholders: '🚫 Placeholder values cleared',
            }[r.rule] || r.rule;
            lines.push(`${label}: ${r.count}`);
        }
    }
    lines.unshift(`Total: ${originalCount} → ${cleanedCount} leads`);
    return lines;
}
