/**
 * LeadHarvest Pro — Background Service Worker
 * Manages messaging, crawl queue, and context menus.
 */

import {
    getLeads, appendLeads, getTemplates, saveTemplate,
    getCrawlState, saveCrawlState, clearCrawlState,
    getSettings, setActiveTemplateId, getActiveTemplateId
} from './lib/storage.js';
import { callGPT } from './lib/ai.js';

// ─── Context Menu ──────────────────────────────────────────────────────────────

chrome.runtime.onInstalled.addListener(() => {
    chrome.contextMenus.create({
        id: 'lhp-train-field',
        title: 'LeadHarvest: Train this field',
        contexts: ['all'],
    });
    chrome.contextMenus.create({
        id: 'lhp-extract-page',
        title: 'LeadHarvest: Extract leads from page',
        contexts: ['page'],
    });
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
    if (info.menuItemId === 'lhp-train-field') {
        await ensureContentScript(tab.id);
        chrome.tabs.sendMessage(tab.id, { type: 'START_TRAINING' });
    } else if (info.menuItemId === 'lhp-extract-page') {
        await ensureContentScript(tab.id);
        const activeId = await getActiveTemplateId();
        if (!activeId) return;
        const templates = await getTemplates();
        const tpl = templates.find(t => t.id === activeId);
        if (tpl) {
            chrome.tabs.sendMessage(tab.id, { type: 'EXTRACT', template: tpl });
        }
    }
});

// ─── Message Router ────────────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    handleMessage(msg, sender).then(sendResponse).catch(err => {
        sendResponse({ ok: false, error: err.message });
    });
    return true; // keep channel open for async response
});

async function handleMessage(msg, sender) {
    switch (msg.type) {

        case 'GET_LEADS': {
            const leads = await getLeads();
            return { ok: true, leads };
        }

        case 'APPEND_LEADS': {
            const saved = await appendLeads(msg.leads);
            return { ok: true, leads: saved };
        }

        case 'GET_TEMPLATES': {
            const templates = await getTemplates();
            return { ok: true, templates };
        }

        case 'SAVE_TEMPLATE': {
            const tpl = await saveTemplate(msg.template);
            return { ok: true, template: tpl };
        }

        case 'SET_ACTIVE_TEMPLATE': {
            await setActiveTemplateId(msg.id);
            return { ok: true };
        }

        case 'GET_SETTINGS': {
            const settings = await getSettings();
            return { ok: true, settings };
        }

        case 'START_EXTRACTION': {
            const tabId = msg.tabId || (sender.tab && sender.tab.id);
            if (!tabId) return { ok: false, error: 'No tab ID' };
            await ensureContentScript(tabId);
            await chrome.tabs.sendMessage(tabId, {
                type: 'EXTRACT',
                template: msg.template,
            });
            return { ok: true };
        }

        case 'START_TRAINING': {
            const tabId = msg.tabId;
            if (!tabId) return { ok: false, error: 'No tab ID' };
            await ensureContentScript(tabId);
            await chrome.tabs.sendMessage(tabId, { type: 'START_TRAINING' });
            return { ok: true };
        }

        case 'STOP_TRAINING': {
            const tabId = msg.tabId;
            if (!tabId) return { ok: false, error: 'No tab ID' };
            await chrome.tabs.sendMessage(tabId, { type: 'STOP_TRAINING' });
            return { ok: true };
        }

        case 'START_CRAWL': {
            await startCrawl(msg);
            return { ok: true };
        }

        case 'STOP_CRAWL': {
            await clearCrawlState();
            return { ok: true };
        }

        case 'CRAWL_PAGE_DONE': {
            // Content script finished extracting a page; advance crawl queue
            await advanceCrawl(sender.tab, msg.nextUrl);
            return { ok: true };
        }

        case 'AUTO_DETECT_AI': {
            const settings = await getSettings();
            if (!settings.openaiApiKey) return { ok: false, error: 'API Key missing' };

            const systemPrompt = `You are an AI data extractor. 
Analyze the provided HTML snippet from a lead source page (like LinkedIn, Yelp, etc.).
Identify the repeating pattern of lead records.
For each field you find, return its CSS selector and type (name, company, email, phone, etc.).
Return only a JSON object: { "fields": [ { "name": "", "type": "", "selector": "", "confidence": 0 } ] }`;

            try {
                const response = await callGPT(systemPrompt, msg.htmlSnippet, settings.openaiApiKey);
                const jsonStr = response.replace(/```json\n?|\n?```/g, '').trim();
                return { ok: true, data: JSON.parse(jsonStr) };
            } catch (err) {
                return { ok: false, error: err.message };
            }
        }

        default:
            return { ok: false, error: `Unknown message type: ${msg.type}` };
    }
}

// ─── Content Script Injection Helper ──────────────────────────────────────────

async function ensureContentScript(tabId) {
    try {
        // Ping to see if script is already there
        await chrome.tabs.sendMessage(tabId, { type: 'PING' });
    } catch {
        await chrome.scripting.executeScript({
            target: { tabId },
            files: ['content/content.js'],
        });
        await chrome.scripting.insertCSS({
            target: { tabId },
            files: ['content/content.css'],
        });
    }
}

// ─── Crawl Queue Manager ───────────────────────────────────────────────────────

async function startCrawl(msg) {
    const { template, startUrl, maxPages = 5, tabId } = msg;
    const state = {
        template,
        startUrl,
        maxPages,
        currentPage: 1,
        tabId,
        active: true,
    };
    await saveCrawlState(state);
    // Navigate the tab to the start URL (it may already be there)
    await chrome.tabs.update(tabId, { url: startUrl });
}

async function advanceCrawl(tab, nextUrl) {
    const state = await getCrawlState();
    if (!state || !state.active) return;

    state.currentPage++;
    if (!nextUrl || state.currentPage > state.maxPages) {
        await clearCrawlState();
        // Notify popup crawl is done
        chrome.runtime.sendMessage({ type: 'CRAWL_COMPLETE', pages: state.currentPage - 1 }).catch(() => { });
        return;
    }

    await saveCrawlState(state);
    await chrome.tabs.update(tab.id, { url: nextUrl });
}

// ─── Tab Updated Listener (Crawl Coordination) ────────────────────────────────

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
    if (changeInfo.status !== 'complete') return;
    const state = await getCrawlState();
    if (!state || !state.active || state.tabId !== tabId) return;

    // Page fully loaded — inject script and trigger extraction
    await ensureContentScript(tabId);
    chrome.tabs.sendMessage(tabId, {
        type: 'EXTRACT',
        template: state.template,
        crawlMode: true,
    });
});
