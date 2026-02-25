/**
 * LeadHarvest Pro — CRM Integration Module
 * Supports HubSpot (Contacts API v3) and Salesforce (REST API bulk create).
 */

// ─── Field Mapping Defaults ────────────────────────────────────────────────────

const HUBSPOT_FIELD_MAP = {
    name: (v) => {
        const parts = v.trim().split(/\s+/);
        return {
            firstname: parts[0] || '',
            lastname: parts.slice(1).join(' ') || '',
        };
    },
    company: 'company',
    email: 'email',
    phone: 'phone',
    website: 'website',
    address: 'address',
    title: 'jobtitle',
    industry: 'industry',
    linkedin: 'linkedin',
};

const SALESFORCE_FIELD_MAP = {
    name: (v) => {
        const parts = v.trim().split(/\s+/);
        return {
            FirstName: parts[0] || '',
            LastName: parts.slice(1).join(' ') || 'Unknown',
        };
    },
    company: 'Company',
    email: 'Email',
    phone: 'Phone',
    website: 'Website',
    address: 'MailingStreet',
    title: 'Title',
    industry: 'Industry',
    linkedin: 'LinkedInProfile__c',
};

// ─── HubSpot ───────────────────────────────────────────────────────────────────

/**
 * Push an array of leads to HubSpot via Contacts API v3 batch upsert.
 * Returns { success, created, failed, errors }
 */
export async function pushToHubSpot(leads, apiKey) {
    if (!leads.length || !apiKey) {
        return { success: false, error: 'Missing leads or API key' };
    }

    const inputs = leads.map(lead => ({
        properties: mapLeadToHubSpot(lead),
    }));

    try {
        const resp = await fetch('https://api.hubapi.com/crm/v3/objects/contacts/batch/create', {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ inputs }),
        });

        const json = await resp.json();

        if (!resp.ok) {
            // HubSpot batch — parse partial errors
            if (resp.status === 207) {
                const errors = json.errors || [];
                return {
                    success: true,
                    created: (json.results || []).length,
                    failed: errors.length,
                    errors: errors.map(e => e.message),
                };
            }
            throw new Error(json.message || `HTTP ${resp.status}`);
        }

        return { success: true, created: (json.results || []).length, failed: 0, errors: [] };
    } catch (e) {
        return { success: false, error: e.message };
    }
}

function mapLeadToHubSpot(lead) {
    const props = {};
    for (const [srcKey, dest] of Object.entries(HUBSPOT_FIELD_MAP)) {
        const val = lead[srcKey];
        if (!val) continue;
        if (typeof dest === 'function') {
            Object.assign(props, dest(val));
        } else {
            props[dest] = String(val);
        }
    }
    return props;
}

// ─── Salesforce ────────────────────────────────────────────────────────────────

/**
 * Push leads to Salesforce as Leads using REST API composite endpoint.
 * Returns { success, created, failed, errors }
 */
export async function pushToSalesforce(leads, instanceUrl, accessToken) {
    if (!leads.length || !instanceUrl || !accessToken) {
        return { success: false, error: 'Missing leads, instance URL, or access token' };
    }

    const records = leads.map(lead => ({
        attributes: { type: 'Lead', referenceId: `ref_${Math.random().toString(36).slice(2)}` },
        ...mapLeadToSalesforce(lead),
    }));

    try {
        const resp = await fetch(`${instanceUrl}/services/data/v57.0/composite/tree/Lead`, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ records }),
        });

        const json = await resp.json();

        if (!resp.ok || json.hasErrors) {
            const errors = (json.results || []).filter(r => r.errors?.length).map(r => r.errors[0]?.message);
            const created = (json.results || []).filter(r => !r.errors?.length).length;
            return { success: true, created, failed: errors.length, errors };
        }

        return { success: true, created: records.length, failed: 0, errors: [] };
    } catch (e) {
        return { success: false, error: e.message };
    }
}

function mapLeadToSalesforce(lead) {
    const record = {};
    for (const [srcKey, dest] of Object.entries(SALESFORCE_FIELD_MAP)) {
        const val = lead[srcKey];
        if (!val) continue;
        if (typeof dest === 'function') {
            Object.assign(record, dest(val));
        } else {
            record[dest] = String(val);
        }
    }
    // LastName is required in Salesforce
    if (!record.LastName) record.LastName = lead.name || lead.company || 'Unknown';
    if (!record.Company) record.Company = lead.company || 'Unknown';
    return record;
}
