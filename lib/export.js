/**
 * LeadHarvest Pro — Export Module
 * Supports CSV, Excel (SheetJS), and Google Sheets (API v4).
 */

// ─── CSV Export ────────────────────────────────────────────────────────────────

/**
 * Convert leads array to RFC 4180 CSV string and trigger browser download.
 */
export function exportToCSV(leads, filename = 'leads.csv') {
    if (!leads.length) { alert('No leads to export.'); return; }

    const allKeys = getLeadKeys(leads);
    const header = allKeys.join(',');
    const rows = leads.map(lead =>
        allKeys.map(k => csvCell(lead[k] ?? '')).join(',')
    );
    const csv = [header, ...rows].join('\r\n');

    downloadFile(csv, filename, 'text/csv;charset=utf-8;');
}

function csvCell(value) {
    const str = String(value ?? '').replace(/\r\n/g, ' ').replace(/\n/g, ' ');
    return str.includes(',') || str.includes('"') || str.includes('\n')
        ? `"${str.replace(/"/g, '""')}"`
        : str;
}

// ─── Excel Export (SheetJS) ───────────────────────────────────────────────────

/**
 * Export leads to .xlsx using SheetJS (must be loaded in page context).
 * SheetJS is loaded via <script> tag in popup.html.
 */
export async function exportToExcel(leads, filename = 'leads.xlsx') {
    if (!leads.length) { alert('No leads to export.'); return; }

    if (typeof XLSX === 'undefined') {
        alert('Excel export library not loaded. Please try again.');
        return;
    }

    const allKeys = getLeadKeys(leads);
    const data = [
        allKeys, // header row
        ...leads.map(lead => allKeys.map(k => lead[k] ?? '')),
    ];

    const ws = XLSX.utils.aoa_to_sheet(data);

    // Style header row
    allKeys.forEach((_, i) => {
        const cellRef = XLSX.utils.encode_cell({ r: 0, c: i });
        if (!ws[cellRef]) return;
        ws[cellRef].s = {
            font: { bold: true, color: { rgb: 'FFFFFF' } },
            fill: { patternType: 'solid', fgColor: { rgb: '4F46E5' } },
        };
    });

    // Auto-width columns
    ws['!cols'] = allKeys.map(k => ({ wch: Math.max(k.length, 12) }));

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Leads');
    XLSX.writeFile(wb, filename);
}

// ─── Google Sheets Export ─────────────────────────────────────────────────────

/**
 * Append leads to a Google Spreadsheet using Sheets API v4.
 * Requires a valid OAuth2 access token from chrome.identity.
 */
export async function exportToGoogleSheets(leads, settings) {
    if (!leads.length) { alert('No leads to export.'); return; }

    // 1. Get OAuth token
    const token = await getGoogleToken();
    if (!token) return;

    // 2. Create a new spreadsheet or use saved ID
    const { googleSpreadsheetId } = settings || {};
    let spreadsheetId = googleSpreadsheetId;

    if (!spreadsheetId) {
        spreadsheetId = await createSpreadsheet(token, 'LeadHarvest Pro Leads');
        // Save for future exports
        await chrome.storage.local.set({ googleSpreadsheetId: spreadsheetId });
    }

    // 3. Append data
    const allKeys = getLeadKeys(leads);
    const values = [
        allKeys,
        ...leads.map(lead => allKeys.map(k => String(lead[k] ?? ''))),
    ];

    const resp = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Sheet1!A1:append?valueInputOption=USER_ENTERED`,
        {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ values }),
        }
    );

    if (!resp.ok) {
        const err = await resp.text();
        alert(`Google Sheets error: ${err}`);
        return;
    }

    alert(`✓ ${leads.length} leads exported to Google Sheets!`);
    // Open the sheet
    chrome.tabs.create({ url: `https://docs.google.com/spreadsheets/d/${spreadsheetId}` });
}

async function getGoogleToken() {
    return new Promise((resolve) => {
        chrome.identity.getAuthToken(
            {
                interactive: true,
                scopes: ['https://www.googleapis.com/auth/spreadsheets'],
            },
            (token) => {
                if (chrome.runtime.lastError) {
                    alert(`Google auth error: ${chrome.runtime.lastError.message}`);
                    resolve(null);
                } else {
                    resolve(token);
                }
            }
        );
    });
}

async function createSpreadsheet(token, title) {
    const resp = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ properties: { title } }),
    });
    const json = await resp.json();
    return json.spreadsheetId;
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

function getLeadKeys(leads) {
    const PRIORITY = ['name', 'company', 'email', 'phone', 'address', 'website', 'linkedin', 'title', 'industry'];
    const allKeys = new Set();
    leads.forEach(l => Object.keys(l).forEach(k => !k.startsWith('_') && !k.endsWith('_confidence') && allKeys.add(k)));
    // Sort: priority keys first, then alphabetical
    return [
        ...PRIORITY.filter(k => allKeys.has(k)),
        ...[...allKeys].filter(k => !PRIORITY.includes(k)).sort(),
    ];
}

function downloadFile(content, filename, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}
