/**
 * LeadHarvest Pro — Data Enrichment Module
 * Optional third-party enrichment: Hunter.io (email), Clearbit (company), phone formatting.
 * All calls are gated by user settings.
 */

// ─── Email Verification (Hunter.io) ───────────────────────────────────────────

/**
 * Verify an email address via Hunter.io Email Verifier API.
 * Returns enriched result: { status, score, firstName, lastName, position }
 */
export async function verifyEmail(email, apiKey) {
    if (!email || !apiKey) return { status: 'skipped' };
    try {
        const url = `https://api.hunter.io/v2/email-verifier?email=${encodeURIComponent(email)}&api_key=${apiKey}`;
        const resp = await fetch(url);
        if (!resp.ok) throw new Error(`Hunter.io HTTP ${resp.status}`);
        const json = await resp.json();
        const d = json?.data || {};
        return {
            status: d.status || 'unknown',
            score: d.score ?? null,
            firstName: d.first_name || '',
            lastName: d.last_name || '',
            position: d.position || '',
            company: d.company || '',
            enriched: true,
            source: 'hunter.io',
        };
    } catch (e) {
        return { status: 'error', error: e.message, enriched: false };
    }
}

// ─── Company Enrichment (Clearbit) ────────────────────────────────────────────

/**
 * Enrich company information using the Clearbit Company API.
 * Input: domain (e.g. "stripe.com")
 */
export async function enrichCompany(domain, apiKey) {
    if (!domain || !apiKey) return { status: 'skipped' };
    try {
        const url = `https://company.clearbit.com/v2/companies/find?domain=${encodeURIComponent(domain)}`;
        const resp = await fetch(url, {
            headers: { Authorization: `Bearer ${apiKey}` },
        });
        if (resp.status === 404) return { status: 'not_found', enriched: false };
        if (!resp.ok) throw new Error(`Clearbit HTTP ${resp.status}`);
        const d = await resp.json();
        return {
            enriched: true,
            source: 'clearbit',
            companyName: d.name || '',
            description: d.description || '',
            industry: d.category?.industry || '',
            employees: d.metrics?.employees || null,
            foundedYear: d.foundedYear || null,
            phone: d.phone || '',
            twitterHandle: d.twitter?.handle || '',
            linkedinUrl: d.linkedin?.handle ? `https://linkedin.com/company/${d.linkedin.handle}` : '',
            logo: d.logo || '',
            tags: d.tags || [],
        };
    } catch (e) {
        return { status: 'error', error: e.message, enriched: false };
    }
}

// ─── Phone Formatting ─────────────────────────────────────────────────────────

/**
 * Format a raw phone string to E.164 international format.
 * Uses regex-based normalization (bundled, no external lib required).
 */
export function formatPhone(raw, defaultCountry = 'US') {
    if (!raw) return '';
    // Strip non-digit chars except leading +
    const cleaned = raw.replace(/[^\d+]/g, '');
    if (cleaned.length < 7) return raw; // too short to be valid

    // Already E.164
    if (cleaned.startsWith('+') && cleaned.length >= 11 && cleaned.length <= 15) {
        return cleaned;
    }

    // North America default
    if (defaultCountry === 'US' || defaultCountry === 'CA') {
        const digits = cleaned.replace(/^\+?1/, '');
        if (digits.length === 10) return `+1${digits}`;
    }

    return cleaned; // return cleaned fallback
}

// ─── Bulk Enrichment Runner ───────────────────────────────────────────────────

/**
 * Enrich an array of lead objects.
 * Reads settings from storage; respects enableEnrichment flag.
 */
export async function enrichLeads(leads, settings) {
    if (!settings.enableEnrichment) return leads;

    const enriched = [];
    for (const lead of leads) {
        const updated = { ...lead };

        // Email verification
        if (updated.email && settings.hunterApiKey) {
            const emailData = await verifyEmail(updated.email, settings.hunterApiKey);
            if (emailData.enriched) {
                updated.emailStatus = emailData.status;
                updated.emailScore = emailData.score;
                if (!updated.name && emailData.firstName) updated.name = `${emailData.firstName} ${emailData.lastName}`.trim();
                if (!updated.title && emailData.position) updated.title = emailData.position;
                if (!updated.company && emailData.company) updated.company = emailData.company;
            }
        }

        // Phone formatting
        if (updated.phone) {
            updated.phone = formatPhone(updated.phone);
        }

        // Company enrichment
        const domain = extractDomain(updated.website || updated._source || '');
        if (domain && settings.clearbitApiKey) {
            const companyData = await enrichCompany(domain, settings.clearbitApiKey);
            if (companyData.enriched) {
                if (!updated.company) updated.company = companyData.companyName;
                if (!updated.phone) updated.phone = companyData.phone;
                updated.industry = updated.industry || companyData.industry;
                updated.employees = updated.employees || companyData.employees;
                updated.companyLogo = companyData.logo;
                updated.linkedin = updated.linkedin || companyData.linkedinUrl;
            }
        }

        enriched.push(updated);

        // Rate-limit: wait between calls
        await sleep(300);
    }
    return enriched;
}

// ─── Utilities ─────────────────────────────────────────────────────────────────

function extractDomain(url) {
    try {
        return new URL(url.startsWith('http') ? url : `https://${url}`).hostname.replace(/^www\./, '');
    } catch { return ''; }
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
