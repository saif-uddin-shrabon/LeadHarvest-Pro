<div align="center">

<img src="icons/icon128.png" alt="LeadHarvest Pro Logo" width="100" />

# LeadHarvest Pro

**An AI-powered Chrome Extension for smart B2B lead collection, enrichment, and outreach automation.**

[![Manifest V3](https://img.shields.io/badge/Manifest-V3-blueviolet?style=flat-square)](https://developer.chrome.com/docs/extensions/mv3/)
[![Vanilla JS](https://img.shields.io/badge/Built%20With-Vanilla%20JS-yellow?style=flat-square&logo=javascript)](https://developer.mozilla.org/en-US/docs/Web/JavaScript)
[![License: MIT](https://img.shields.io/badge/License-MIT-green?style=flat-square)](LICENSE)
[![Made by AlgoStackBD](https://img.shields.io/badge/Made%20by-AlgoStackBD-6366f1?style=flat-square)](https://algostackbd.com)

</div>

---

## 📖 Overview

**LeadHarvest Pro** is a professional-grade Chrome Extension designed for sales teams, growth hackers, and B2B marketers. It enables you to collect structured lead data directly from any webpage, enrich it with third-party APIs, clean it automatically, and generate personalized AI-powered outreach sequences — all without leaving your browser.

Built on **Manifest V3** and **Vanilla JavaScript** with no bundlers or frameworks, it is fully self-contained and privacy-conscious by design.

---

## ✨ Core Features

| Feature | Description |
|---|---|
| 🔍 **Smart Auto-Extraction** | Rule-based NLP classifier detects names, emails, phones, companies, and more from any webpage |
| ✨ **AI Auto-Extraction** | Uses OpenAI to intelligently map complex page structures for higher precision |
| 🎯 **Point-and-Click Trainer** | Visually train the extension on any site — no code required |
| 📋 **Template Marketplace** | Install and share community-built extraction templates |
| 🧹 **Lead Data Cleaner** | 8 cleaning rules including deduplication, invalid data removal, and normalization |
| ✉️ **AI Outreach Assistant** | Generate personalized, multi-step email sequences powered by GPT |
| 📊 **CRM Integration** | Push leads directly to HubSpot and Salesforce |
| 📁 **Flexible Export** | Export to CSV, Excel, or Google Sheets |
| 🔄 **Multi-Page Crawler** | Automatically paginate through listings and collect leads at scale |
| 🔐 **Privacy First** | All data is stored locally; no data sent to external servers without explicit permission |

---

## 🖥️ Screenshots

> *(Add screenshots of the popup, outreach assistant, and marketplace here)*

---

## 🚀 Getting Started

### Prerequisites
- **Google Chrome** (v116 or later) or any Chromium-based browser
- An **OpenAI API Key** (optional, for AI features) — [Get one here](https://platform.openai.com/api-keys)

### Installation (Developer Mode)

This extension is not yet published to the Chrome Web Store. To use it, load it as an unpacked extension:

1. **Clone the repository:**
   ```bash
   git clone https://github.com/YOUR_USERNAME/leadharvest-pro.git
   ```

2. **Open Chrome Extensions:**
   Navigate to `chrome://extensions` in your browser.

3. **Enable Developer Mode:**
   Toggle the **"Developer mode"** switch in the top-right corner.

4. **Load the Extension:**
   Click **"Load unpacked"** and select the cloned project folder.

5. **Pin it to your toolbar:**
   Click the puzzle piece icon 🧩 in the Chrome toolbar and pin **LeadHarvest Pro**.

> **Note:** There is no build step. This project runs directly from source files.

---

## ⚙️ Configuration

Access the **Settings** page by clicking the ⚙️ icon in the extension popup.

### API Keys (Optional)

| Service | Purpose | Get Key |
|---|---|---|
| **OpenAI** | AI-powered extraction & outreach generation | [platform.openai.com](https://platform.openai.com/api-keys) |
| **Hunter.io** | Email verification & enrichment | [hunter.io](https://hunter.io) |
| **Clearbit** | Company data enrichment | [clearbit.com](https://clearbit.com) |
| **HubSpot** | CRM push integration | [app.hubspot.com](https://app.hubspot.com) |
| **Salesforce** | CRM push integration | [salesforce.com](https://salesforce.com) |

All API keys are stored locally in `chrome.storage.local` and are never transmitted to any external server controlled by this extension.

---

## 🧠 How It Works

```
┌────────────────────┐      ┌──────────────────────────────┐
│  Chrome Tab (Page) │─────▶│ Content Script (content.js)  │
└────────────────────┘      │  • NLP Field Classifier       │
                             │  • Pattern Detector           │
                             │  • Point-and-Click Trainer    │
                             └──────────────┬───────────────┘
                                            │ chrome.runtime.sendMessage
                                            ▼
                             ┌──────────────────────────────┐
                             │ Background Worker (bg.js)     │
                             │  • Lead Storage               │
                             │  • OpenAI Router (AI mode)    │
                             │  • Crawl Orchestrator         │
                             └──────────────┬───────────────┘
                                            │
                    ┌───────────────────────┼──────────────────────┐
                    ▼                       ▼                       ▼
         ┌──────────────────┐   ┌──────────────────┐   ┌──────────────────┐
         │   Popup UI       │   │  Outreach Page   │   │  Options Page    │
         │  (popup.js)      │   │  (outreach.js)   │   │  (options.js)    │
         └──────────────────┘   └──────────────────┘   └──────────────────┘
```

---

## 📁 Project Structure

```
leadharvest-pro/
├── manifest.json              # Chrome Extension Manifest V3
├── background.js              # Service Worker (message router, storage, crawl)
│
├── popup/
│   ├── popup.html             # Extension popup UI
│   ├── popup.js               # Popup controller (tabs, leads, templates)
│   └── popup.css              # Popup styling (dark indigo theme)
│
├── content/
│   ├── content.js             # Bundled content script (extractor + trainer)
│   └── content.css            # Trainer overlay styles
│
├── lib/
│   ├── ai.js                  # OpenAI API helper (callGPT, generateAIOutreach)
│   ├── cleaner.js             # Lead data cleaning module (8 rules)
│   ├── crm.js                 # HubSpot & Salesforce CRM integration
│   ├── enrichment.js          # Hunter.io & Clearbit enrichment
│   ├── export.js              # CSV, Excel, Google Sheets export
│   ├── storage.js             # chrome.storage abstraction layer
│   └── xlsx.min.js            # SheetJS library (Excel export)
│
├── pages/
│   ├── marketplace.html/js    # Template Marketplace
│   └── outreach.html/js       # AI Outreach Assistant
│
├── options/
│   ├── options.html/js/css    # Settings page
│
├── _locales/en/messages.json  # Internationalization
└── icons/                     # Extension icons (16, 32, 48, 128px)
```

---

## 🧹 Data Cleaning Rules

The built-in cleaner (`lib/cleaner.js`) applies the following rules when you click **✨ Clean Leads**:

| Rule | Description |
|---|---|
| **Deduplication** | Removes duplicate leads by email, phone+company, or LinkedIn URL |
| **Thin Records** | Removes leads with fewer than 2 populated fields |
| **No Identifier** | Removes leads missing all of name, email, company, LinkedIn, website |
| **Invalid Emails** | Clears emails failing RFC-5321 format validation |
| **Invalid Phones** | Clears phone numbers with fewer than 6 digits |
| **Placeholders** | Removes dummy values like `N/A`, `test@example.com`, `Your Name` |
| **Normalize** | Trims whitespace, lowercases emails, normalizes phone formatting |
| **Misclassified Fields** | Auto-swaps company↔name when a personal name appears in the company field |

---

## 🤝 Contributing

Contributions are welcome! To contribute:

1. Fork this repository
2. Create a feature branch: `git checkout -b feature/your-feature-name`
3. Commit your changes: `git commit -m 'feat: add your feature'`
4. Push to the branch: `git push origin feature/your-feature-name`
5. Open a Pull Request

Please follow the existing code style (Vanilla JS, no bundlers).

---

## 🔒 Privacy Policy

- **No data collection:** This extension does not collect, store, or transmit your lead data to any server.
- **Local storage only:** All leads and settings are stored in `chrome.storage.local` on your device.
- **API calls are user-initiated:** Any calls to OpenAI, Hunter.io, Clearbit, HubSpot, or Salesforce are made only when you explicitly trigger them and use your own API keys.
- **GDPR-friendly:** Includes a data purge option in Settings to delete all stored data instantly.

---

## 📄 License

This project is licensed under the **MIT License** — see the [LICENSE](LICENSE) file for details.

---

## 👤 Author

**AlgoStack BD**
- 🌐 Website: [algostackbd.com](https://algostackbd.com)
- 📧 Email: shrabon06065@gmail.com
- 🐙 GitHub: [@saif-uddin-shrabon](https://github.com/saif-uddin-shrabon)

---

<div align="center">

Made with ❤️ by **AlgoStack BD**

*If you find this project useful, please consider giving it a ⭐ on GitHub!*

</div>
