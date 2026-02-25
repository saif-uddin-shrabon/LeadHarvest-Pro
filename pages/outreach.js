/**
 * LeadHarvest Pro — AI Outreach Assistant
 * Generates personalized multi-step email sequences from lead data.
 */

import { generateAIOutreach } from '../lib/ai.js';

// ─── Email Sequence Templates ──────────────────────────────────────────────────

const SEQUENCES = {
    cold: {
        name: 'Cold Intro',
        steps: [
            {
                name: 'Initial Outreach', day: 'Day 1',
                subject: 'Quick question for {{firstName}} at {{company}}',
                body: `Hi {{firstName}},

I came across {{company}} while researching {{industry}} companies in your space, and I was genuinely impressed by what you're building.

I work at [Your Company], where we help businesses like yours {{benefit}}. I thought there might be a natural fit here.

Would you be open to a quick 15-minute call this week to explore this?

Best,
[Your Name]`,
            },
            {
                name: 'Follow-Up', day: 'Day 4',
                subject: "Re: Quick question for {{firstName}}",
                body: `Hi {{firstName}},

Just following up on my previous email in case it got buried.

I noticed {{company}} is {{contextClue}}, and I think our solution could be particularly relevant for your team right now.

Would love to share a few ideas — even if it's just 10 minutes.

Still interested?

Best,
[Your Name]`,
            },
            {
                name: 'Final Nudge', day: 'Day 9',
                subject: "Last note — {{firstName}}",
                body: `Hi {{firstName}},

I'll keep this short — this is my last email unless I hear from you.

I genuinely believe [Your Solution] could help {{company}} {{benefit}}, and I'd hate to leave that value on the table.

If the timing isn't right, no worries at all. But if you'd like to connect, just reply and we'll find 15 minutes.

Either way, wishing {{company}} continued success!

[Your Name]`,
            },
        ],
    },

    followup: {
        name: 'Follow-Up',
        steps: [
            {
                name: 'Gentle Nudge', day: 'Day 1',
                subject: "Following up — {{firstName}} / {{company}}",
                body: `Hi {{firstName}},

I wanted to follow up on my previous message. I know inboxes are busy!

I'm still excited about the possibility of working with {{company}} and would love to find a time that works for you.

Does any slot this week work?

Thanks,
[Your Name]`,
            },
            {
                name: 'Value Add', day: 'Day 5',
                subject: "Something that might help {{company}}",
                body: `Hi {{firstName}},

While thinking about {{company}}, I put together a quick resource I thought might be useful: [Link to resource].

No strings attached — I just thought it addressed something relevant to what teams in {{industry}} are dealing with right now.

Happy to walk through it if you'd like.

[Your Name]`,
            },
        ],
    },

    partnership: {
        name: 'Partnership Pitch',
        steps: [
            {
                name: 'Partnership Intro', day: 'Day 1',
                subject: "Partnership opportunity — {{company}} × [Your Company]",
                body: `Hi {{firstName}},

I've been following {{company}}'s work in {{industry}} and think there's a compelling reason for our teams to collaborate.

At [Your Company], we serve a similar audience and believe a partnership could be mutually beneficial — whether that's a referral arrangement, co-marketing, or a joint integration.

Would you be open to a brief call to explore what collaboration might look like?

Looking forward to hearing from you,
[Your Name]`,
            },
            {
                name: 'Partnership Follow-Up', day: 'Day 6',
                subject: "Re: Partnership — still interested?",
                body: `Hi {{firstName}},

Just checking if you had a chance to consider my partnership note.

I've prepared a one-pager on how partnership typically works for companies like {{company}} — happy to share it if helpful.

[Your Name]`,
            },
        ],
    },

    event: {
        name: 'Event Invite',
        steps: [
            {
                name: 'Event Invitation', day: 'Day 1',
                subject: "You're invited — [Event Name] on [Date]",
                body: `Hi {{firstName}},

I'd love to invite you to [Event Name], a [webinar/roundtable/meetup] we're hosting on [Date] at [Time].

We'll be covering [Topic], which I think would be particularly relevant given {{company}}'s work in {{industry}}.

🎟 Reserve your free spot: [Link]

Hope to see you there!

[Your Name]`,
            },
        ],
    },

    casestudy: {
        name: 'Case Study',
        steps: [
            {
                name: 'Share Case Study', day: 'Day 1',
                subject: "How [Similar Company] achieved [Result] — relevant for {{company}}?",
                body: `Hi {{firstName}},

I recently worked with [Similar Company], a {{industry}} business similar to {{company}}, and helped them achieve [specific result, e.g. 3x their lead conversion rate in 60 days].

I thought the approach might resonate with what your team at {{company}} is working on.

Here's the full case study: [Link]

Would it be worth 20 minutes to discuss how something similar might apply to {{company}}?

[Your Name]`,
            },
            {
                name: 'Result Follow-Up', day: 'Day 5',
                subject: "A thought on {{company}}'s growth",
                body: `Hi {{firstName}},

Did you get a chance to look at the case study I sent? The results were pretty remarkable — [Key metric].

I'd love to show you how we might replicate this for {{company}}. Would a quick call work?

[Your Name]`,
            },
        ],
    },

    demo: {
        name: 'Demo Request',
        steps: [
            {
                name: 'Demo Invite', day: 'Day 1',
                subject: "Demo for {{company}} — 15 min?",
                body: `Hi {{firstName}},

I'd love to show you what [Product] can do for {{company}}.

In just 15 minutes, I can walk you through how teams like yours in {{industry}} are using it to [benefit].

[Book a time here: Link]

No pressure — just a quick look to see if it's relevant.

[Your Name]`,
            },
        ],
    },
};

// ─── State ─────────────────────────────────────────────────────────────────────

let allLeads = [];
let selectedLead = null;
let activeSequenceKey = 'cold';
let generatedSteps = [];
let settings = {};

// ─── Init ──────────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', async () => {
    const { leads = [], settings: savedSettings = {} } = await chrome.storage.local.get(['leads', 'settings']);
    allLeads = leads;
    settings = savedSettings;

    renderLeadList();
    setupSequenceSelector();
    setupVarChips();
    setupGenerate();
    setupGenerateAI();
    setupActions();

    // Show AI button if key is present
    if (settings.openaiApiKey) {
        document.getElementById('btn-generate-ai').style.display = 'block';
    }
});

// ─── Lead List ─────────────────────────────────────────────────────────────────

function renderLeadList() {
    const container = document.getElementById('lead-list');
    if (!allLeads.length) {
        container.innerHTML = `<div style="padding:16px;text-align:center;color:var(--text-muted);font-size:12px">No leads found. Extract some leads first.</div>`;
        return;
    }
    container.innerHTML = allLeads.map((l, i) => `
    <label class="lead-select-item">
      <input type="radio" name="lead" value="${i}">
      <span class="lead-select-label">
        <strong>${esc(l.name || l.company || 'Lead ' + (i + 1))}</strong>
        ${l.company ? ` · ${esc(l.company)}` : ''}
        ${l.email ? `<br><span style="font-size:11px;color:var(--text-muted)">${esc(l.email)}</span>` : ''}
      </span>
    </label>
  `).join('');

    container.querySelectorAll('input[type=radio]').forEach(radio => {
        radio.addEventListener('change', () => {
            selectedLead = allLeads[parseInt(radio.value)];
        });
    });
}

// ─── Sequence Selector ─────────────────────────────────────────────────────────

function setupSequenceSelector() {
    document.querySelectorAll('.seq-card').forEach(card => {
        card.addEventListener('click', () => {
            document.querySelectorAll('.seq-card').forEach(c => c.classList.remove('active'));
            card.classList.add('active');
            activeSequenceKey = card.dataset.seq;
        });
    });
}

// ─── Variable Chips ────────────────────────────────────────────────────────────

function setupVarChips() {
    document.querySelectorAll('.var-chip').forEach(chip => {
        chip.addEventListener('click', () => {
            const ta = document.getElementById('custom-note');
            const pos = ta.selectionStart;
            const val = ta.value;
            ta.value = val.slice(0, pos) + chip.dataset.var + val.slice(pos);
            ta.focus();
            ta.setSelectionRange(pos + chip.dataset.var.length, pos + chip.dataset.var.length);
        });
    });
}

// ─── Generate ──────────────────────────────────────────────────────────────────

function setupGenerate() {
    document.getElementById('btn-generate').addEventListener('click', () => {
        if (!selectedLead) { showToast('Please select a lead first.'); return; }
        const sequence = SEQUENCES[activeSequenceKey];
        if (!sequence) return;

        const customNote = document.getElementById('custom-note').value.trim();

        generatedSteps = sequence.steps.map(step => ({
            ...step,
            subject: mergeVars(step.subject, selectedLead),
            body: mergeVars(step.body + (customNote ? `\n\n---\n📝 Note: ${customNote}` : ''), selectedLead),
        }));

        renderPreview(generatedSteps, sequence.name);
    });
}

function setupGenerateAI() {
    const btn = document.getElementById('btn-generate-ai');
    const loading = document.getElementById('ai-loading');

    btn.addEventListener('click', async () => {
        if (!selectedLead) { showToast('Please select a lead first.'); return; }
        if (!settings.openaiApiKey) { showToast('OpenAI API Key missing.'); return; }

        loading.style.display = 'block';
        btn.disabled = true;

        const customNote = document.getElementById('custom-note').value.trim();

        try {
            generatedSteps = await generateAIOutreach(selectedLead, customNote, settings.openaiApiKey);
            renderPreview(generatedSteps, 'AI Powered');
            showToast('✨ AI successfully generated a custom sequence!');
        } catch (error) {
            showToast(`❌ AI Error: ${error.message}`);
        } finally {
            loading.style.display = 'none';
            btn.disabled = false;
        }
    });
}

function mergeVars(text, lead) {
    const parts = lead.name ? lead.name.trim().split(/\s+/) : [];
    const vars = {
        firstName: parts[0] || lead.name || 'there',
        lastName: parts.slice(1).join(' ') || '',
        company: lead.company || 'your company',
        title: lead.title || 'your role',
        website: lead.website || '',
        industry: lead.industry || 'your industry',
        benefit: 'achieve better results',
        contextClue: 'growing rapidly',
    };
    return text.replace(/\{\{(\w+)\}\}/g, (_, k) => vars[k] || `{{${k}}}`);
}

function renderPreview(steps, seqName) {
    const container = document.getElementById('email-sequence');
    container.innerHTML = `
    <div style="font-size:13px;color:var(--text-muted);margin-bottom:4px">
      Showing <strong style="color:var(--accent-light)">${seqName}</strong> sequence for 
      <strong style="color:var(--text-primary)">${esc(selectedLead.name || selectedLead.company || 'Selected Lead')}</strong>
    </div>
    ${steps.map((s, i) => `
      <div class="email-step">
        <div class="email-step-header">
          <div class="step-num">${i + 1}</div>
          <div class="step-info">
            <div class="step-name">${esc(s.name)}</div>
            <div class="step-day">📅 Send on ${esc(s.day)}</div>
          </div>
        </div>
        <div class="email-body">
          <div class="email-subject"><span>Subject:</span> ${esc(s.subject)}</div>
          <div class="email-content">${highlightVars(esc(s.body))}</div>
        </div>
      </div>
    `).join('')}
  `;
}

function highlightVars(html) {
    return html.replace(/\{\{([^}]+)\}\}/g, '<span class="var">{{$1}}</span>');
}

// ─── Action Buttons ────────────────────────────────────────────────────────────

function setupActions() {
    document.getElementById('btn-copy-all').addEventListener('click', () => {
        const text = generatedSteps.map((s, i) =>
            `--- Email ${i + 1}: ${s.name} (${s.day}) ---\nSubject: ${s.subject}\n\n${s.body}`
        ).join('\n\n' + '='.repeat(50) + '\n\n');
        navigator.clipboard.writeText(text).then(() => showToast('All emails copied!'));
    });

    document.getElementById('btn-copy-first').addEventListener('click', () => {
        if (!generatedSteps.length) { showToast('Generate a sequence first.'); return; }
        const s = generatedSteps[0];
        const text = `Subject: ${s.subject}\n\n${s.body}`;
        navigator.clipboard.writeText(text).then(() => showToast('Email 1 copied!'));
    });

    document.getElementById('btn-export-eml').addEventListener('click', () => {
        if (!generatedSteps.length) { showToast('Generate a sequence first.'); return; }
        const s = generatedSteps[0];
        const eml = `MIME-Version: 1.0\nContent-Type: text/plain; charset=utf-8\nSubject: ${s.subject}\nTo: ${selectedLead?.email || ''}\n\n${s.body}`;
        const blob = new Blob([eml], { type: 'message/rfc822' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url; a.download = 'email1.eml'; a.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    });
}

// ─── Utilities ─────────────────────────────────────────────────────────────────
let toastTimer;
function showToast(msg) {
    const t = document.getElementById('toast');
    t.textContent = msg; t.classList.remove('hidden');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.add('hidden'), 2500);
}
function esc(s) { return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
