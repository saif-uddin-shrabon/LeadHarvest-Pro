/**
 * LeadHarvest Pro — Point-and-Click Trainer
 * Injects an interactive overlay to let users train field selectors.
 */

import { generalizeSelector, classifyField } from './extractor.js';

let trainingActive = false;
let currentSession = null; // { fieldName, fields: [] }

// ─── Overlay Elements ──────────────────────────────────────────────────────────

let highlightBox = null;
let tooltip = null;
let panel = null;

function createHighlightBox() {
    highlightBox = document.createElement('div');
    highlightBox.id = 'lhp-highlight-box';
    document.body.appendChild(highlightBox);
}

function createTooltip() {
    tooltip = document.createElement('div');
    tooltip.id = 'lhp-tooltip';
    document.body.appendChild(tooltip);
}

function createTrainingPanel() {
    panel = document.createElement('div');
    panel.id = 'lhp-training-panel';
    panel.innerHTML = `
    <div class="lhp-panel-header">
      <span class="lhp-panel-icon">🎯</span>
      <strong>Training Mode</strong>
      <button id="lhp-stop-training" title="Stop training">✕</button>
    </div>
    <p class="lhp-panel-hint">Click any element on the page to capture it as a field.</p>
    <ul id="lhp-field-list"></ul>
    <div class="lhp-panel-actions">
      <input id="lhp-template-name" type="text" placeholder="Template name…" />
      <button id="lhp-save-template" class="lhp-btn-primary">Save Template</button>
    </div>
  `;
    document.body.appendChild(panel);

    document.getElementById('lhp-stop-training').addEventListener('click', stopTraining);
    document.getElementById('lhp-save-template').addEventListener('click', saveTrainedTemplate);
}

// ─── Training Lifecycle ────────────────────────────────────────────────────────

export function startTraining() {
    if (trainingActive) return;
    trainingActive = true;
    currentSession = { fields: [] };

    createHighlightBox();
    createTooltip();
    createTrainingPanel();

    document.addEventListener('mouseover', onMouseOver, true);
    document.addEventListener('mouseout', onMouseOut, true);
    document.addEventListener('click', onClick, true);

    document.body.classList.add('lhp-training-active');
}

export function stopTraining() {
    if (!trainingActive) return;
    trainingActive = false;

    document.removeEventListener('mouseover', onMouseOver, true);
    document.removeEventListener('mouseout', onMouseOut, true);
    document.removeEventListener('click', onClick, true);

    highlightBox?.remove(); highlightBox = null;
    tooltip?.remove(); tooltip = null;
    panel?.remove(); panel = null;

    document.body.classList.remove('lhp-training-active');

    // Notify background that training stopped
    chrome.runtime.sendMessage({ type: 'TRAINING_STOPPED', fields: currentSession?.fields || [] });
    currentSession = null;
}

// ─── Mouse Event Handlers ──────────────────────────────────────────────────────

function onMouseOver(e) {
    if (!trainingActive) return;
    if (isLhpElement(e.target)) return;
    e.stopPropagation();

    const rect = e.target.getBoundingClientRect();
    const scrollX = window.scrollX, scrollY = window.scrollY;

    // Position highlight box
    Object.assign(highlightBox.style, {
        top: `${rect.top + scrollY}px`,
        left: `${rect.left + scrollX}px`,
        width: `${rect.width}px`,
        height: `${rect.height}px`,
        display: 'block',
    });

    // Show tooltip
    const text = (e.target.innerText || e.target.textContent || '').trim().slice(0, 60);
    const { type, confidence } = classifyField(text, e.target);
    tooltip.textContent = `${type} (${confidence}%) — click to capture`;
    Object.assign(tooltip.style, {
        top: `${rect.bottom + scrollY + 6}px`,
        left: `${rect.left + scrollX}px`,
        display: 'block',
    });
}

function onMouseOut(e) {
    if (!trainingActive) return;
    if (isLhpElement(e.target)) return;
    highlightBox && (highlightBox.style.display = 'none');
    tooltip && (tooltip.style.display = 'none');
}

function onClick(e) {
    if (!trainingActive) return;
    if (isLhpElement(e.target)) return;
    e.preventDefault();
    e.stopPropagation();

    const el = e.target;
    const text = (el.innerText || el.textContent || '').trim().slice(0, 200);
    const value = el.tagName === 'A' && el.href ? el.href : text;
    const { type, confidence } = classifyField(text, el);
    const selector = generalizeSelector(el);

    // Ask user for field name via inline prompt
    const suggestedName = type !== 'unknown' ? type : 'field_' + (currentSession.fields.length + 1);
    const fieldName = window.prompt(`Field name (detected: ${type}, confidence: ${confidence}%):`, suggestedName);
    if (!fieldName) return;

    const field = { name: fieldName, type, selector, sampleValue: value, confidence };
    currentSession.fields.push(field);
    renderFieldList();
}

// ─── UI Helpers ────────────────────────────────────────────────────────────────

function renderFieldList() {
    const list = document.getElementById('lhp-field-list');
    if (!list) return;
    list.innerHTML = currentSession.fields.map((f, i) => `
    <li class="lhp-field-item">
      <span class="lhp-field-badge lhp-type-${f.type}">${f.type}</span>
      <span class="lhp-field-name">${f.name}</span>
      <span class="lhp-field-value">${(f.sampleValue || '').slice(0, 30)}</span>
      <span class="lhp-field-conf">${f.confidence}%</span>
      <button class="lhp-del-field" data-idx="${i}" title="Remove">✕</button>
    </li>
  `).join('');

    list.querySelectorAll('.lhp-del-field').forEach(btn => {
        btn.addEventListener('click', () => {
            currentSession.fields.splice(Number(btn.dataset.idx), 1);
            renderFieldList();
        });
    });
}

async function saveTrainedTemplate() {
    const name = document.getElementById('lhp-template-name')?.value?.trim();
    if (!name) { alert('Please enter a template name.'); return; }
    if (!currentSession.fields.length) { alert('Please capture at least one field.'); return; }

    const template = {
        name,
        fields: currentSession.fields,
        domain: window.location.hostname,
        createdAt: new Date().toISOString(),
        builtIn: false,
    };

    await chrome.runtime.sendMessage({ type: 'SAVE_TEMPLATE', template });
    alert(`Template "${name}" saved!`);
    stopTraining();
}

function isLhpElement(el) {
    return el.closest('#lhp-training-panel, #lhp-highlight-box, #lhp-tooltip');
}
