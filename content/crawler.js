/**
 * LeadHarvest Pro — Multi-Page Crawler
 * Detects pagination and infinite scroll; notifies background when page is done.
 */

// ─── Pagination Detection ──────────────────────────────────────────────────────

/**
 * Try to find the URL for the next page.
 * Strategy: rel=next link > text heuristics > URL pattern increment
 */
export function detectNextPageUrl() {
    // 1. <link rel="next">
    const relNext = document.querySelector('link[rel="next"]');
    if (relNext?.href) return relNext.href;

    // 2. Anchor tags matching common "next" patterns
    const nextTexts = ['next', 'next page', '›', '»', '→', 'load more', 'show more'];
    const allLinks = Array.from(document.querySelectorAll('a[href]'));

    for (const link of allLinks) {
        const txt = (link.innerText || link.textContent || link.title || link.getAttribute('aria-label') || '').toLowerCase().trim();
        const isMatch = nextTexts.some(n => txt === n || txt.includes(n));
        const isNotDisabled = !link.closest('[disabled]') && !link.classList.contains('disabled');
        if (isMatch && isNotDisabled && link.href && !link.href.startsWith('javascript')) {
            return link.href;
        }
    }

    // 3. URL numeric pattern: look for current page number and increment
    const urlNext = incrementUrlPageNumber(window.location.href);
    if (urlNext) return urlNext;

    return null;
}

function incrementUrlPageNumber(url) {
    // Match common page params: ?page=2, ?p=3, &pg=4, /page/2/, -page-2
    const patterns = [
        { re: /([?&](?:page|p|pg|paged|pagenum)=)(\d+)/, type: 'param' },
        { re: /(\/page\/)(\d+)(\/?)/, type: 'path' },
        { re: /(-page-)(\d+)/, type: 'slug' },
        { re: /(_page_)(\d+)/, type: 'slug2' },
    ];

    for (const { re } of patterns) {
        const m = url.match(re);
        if (m) {
            const nextNum = parseInt(m[2]) + 1;
            return url.replace(re, (_, prefix, num, suffix = '') => `${prefix}${nextNum}${suffix}`);
        }
    }
    return null;
}

// ─── Infinite Scroll Handler ───────────────────────────────────────────────────

let infiniteScrollObserver = null;

/**
 * Attach an IntersectionObserver to wait for more content to load
 * when an infinite scroll page is scrolled to the bottom.
 * Calls `onNewContent` when new records appear.
 */
export function watchInfiniteScroll(onNewContent, options = {}) {
    const { maxScrolls = 5, scrollDelayMs = 2000 } = options;
    let scrollCount = 0;

    // Create a sentinel at the very bottom of the page
    const sentinel = document.createElement('div');
    sentinel.id = 'lhp-scroll-sentinel';
    sentinel.style.cssText = 'height:1px;width:100%;visibility:hidden;';
    document.body.appendChild(sentinel);

    let prevHeight = document.body.scrollHeight;

    infiniteScrollObserver = new IntersectionObserver(
        async (entries) => {
            if (!entries[0].isIntersecting) return;
            if (scrollCount >= maxScrolls) {
                stopInfiniteScroll();
                onNewContent(null); // signal done
                return;
            }
            scrollCount++;
            window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });

            // Wait for content to load
            await sleep(scrollDelayMs);
            const newHeight = document.body.scrollHeight;
            if (newHeight > prevHeight) {
                prevHeight = newHeight;
                onNewContent(scrollCount);
                // Re-position sentinel
                document.body.appendChild(sentinel);
            } else {
                // No new content loaded — done
                stopInfiniteScroll();
                onNewContent(null);
            }
        },
        { threshold: 0.1 }
    );

    infiniteScrollObserver.observe(sentinel);
}

export function stopInfiniteScroll() {
    if (infiniteScrollObserver) {
        infiniteScrollObserver.disconnect();
        infiniteScrollObserver = null;
    }
    document.getElementById('lhp-scroll-sentinel')?.remove();
}

// ─── Crawl State Helpers ───────────────────────────────────────────────────────

let crawlActive = false;

export function setCrawlActive(val) { crawlActive = val; }
export function isCrawlActive() { return crawlActive; }

// ─── Utilities ─────────────────────────────────────────────────────────────────

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
