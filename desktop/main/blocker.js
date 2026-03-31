/**
 * Ascension URL Blocker
 *
 * Three-layer domain blocking:
 *
 * 1. CURATED LIST — ~280 manually-reviewed adult domains. Always blocked.
 * 2. REMOTE LIST  — oisd.nl NSFW blocklist (updated daily by maintainer,
 *    ~25k porn-specific domains). Cached locally, refreshed every 3 days.
 * 3. VERIFICATION FILTER — every remote domain must pass ALL checks before
 *    it reaches the hosts file:
 *      a) Not on the safety whitelist (Google, Stripe, Claude AI, etc.)
 *      b) Not a subdomain of a whitelisted root
 *      c) Not a safe TLD (.gov, .edu, .mil, .bank, .int)
 *      d) Not a known CDN/infrastructure domain pattern
 *      e) Not in the Tranco top-10k most popular websites
 *
 * The whitelist and Tranco check together guarantee that legitimate business
 * and productivity sites are never blocked, even if a community list includes
 * them by mistake.
 */

const fs = require("fs");
const path = require("path");
const os = require("os");
const https = require("https");
const http = require("http");
const { spawn } = require("child_process");

const MARKER_START = "# ASCENSION_BLOCKED_START";
const MARKER_END = "# ASCENSION_BLOCKED_END";

// ─── Cache config ────────────────────────────────────────────────────────────
const CACHE_DIR = path.join(os.homedir(), ".ascension");
const BLOCKLIST_CACHE = path.join(CACHE_DIR, "remote_blocklist.txt");
const BLOCKLIST_META = path.join(CACHE_DIR, "remote_blocklist_meta.json");
const TRANCO_CACHE = path.join(CACHE_DIR, "tranco_top10k.txt");
const TRANCO_META = path.join(CACHE_DIR, "tranco_meta.json");
const BLOCKLIST_MAX_AGE = 3 * 24 * 60 * 60 * 1000; // 3 days
const TRANCO_MAX_AGE = 14 * 24 * 60 * 60 * 1000;   // 14 days

// oisd NSFW-only list — curated, ~25k domains, updated daily
const REMOTE_LIST_URL =
  "https://nsfw.oisd.nl/domainswild";

// Tranco top 10k — popularity ranking of legitimate sites
const TRANCO_URL =
  "https://tranco-list.eu/download/J6G5V/10000";

// ─── Safety whitelist — NEVER block these ────────────────────────────────────
const WHITELIST = new Set([
  // Search engines
  "google.com", "www.google.com", "google.co.uk", "www.google.co.uk",
  "bing.com", "www.bing.com", "duckduckgo.com", "www.duckduckgo.com",
  "yahoo.com", "www.yahoo.com",
  // Google services
  "ads.google.com", "analytics.google.com", "mail.google.com",
  "drive.google.com", "docs.google.com", "sheets.google.com",
  "calendar.google.com", "meet.google.com", "cloud.google.com",
  "console.cloud.google.com", "accounts.google.com", "play.google.com",
  "googletagmanager.com", "www.googletagmanager.com",
  "googlesyndication.com", "www.googlesyndication.com",
  "googleanalytics.com", "www.googleanalytics.com",
  "google-analytics.com", "www.google-analytics.com",
  "googleadservices.com", "www.googleadservices.com",
  "googleapis.com", "fonts.googleapis.com",
  "gstatic.com", "www.gstatic.com",
  "doubleclick.net", "www.doubleclick.net",
  // AI tools
  "claude.ai", "www.claude.ai", "anthropic.com", "www.anthropic.com",
  "api.anthropic.com",
  "openai.com", "www.openai.com", "chat.openai.com", "api.openai.com",
  "copilot.microsoft.com", "gemini.google.com",
  "perplexity.ai", "www.perplexity.ai",
  // Social media (main domains)
  "youtube.com", "www.youtube.com", "m.youtube.com", "youtu.be",
  "twitter.com", "www.twitter.com", "x.com", "www.x.com",
  "facebook.com", "www.facebook.com", "m.facebook.com",
  "instagram.com", "www.instagram.com",
  "reddit.com", "www.reddit.com", "old.reddit.com",
  "tiktok.com", "www.tiktok.com",
  "linkedin.com", "www.linkedin.com",
  "pinterest.com", "www.pinterest.com",
  "snapchat.com", "www.snapchat.com",
  "discord.com", "www.discord.com", "discord.gg",
  "twitch.tv", "www.twitch.tv",
  "whatsapp.com", "www.whatsapp.com", "web.whatsapp.com",
  "telegram.org", "www.telegram.org",
  // Business/productivity
  "github.com", "www.github.com", "gitlab.com", "www.gitlab.com",
  "bitbucket.org", "www.bitbucket.org",
  "stackoverflow.com", "www.stackoverflow.com",
  "slack.com", "www.slack.com",
  "notion.so", "www.notion.so",
  "trello.com", "www.trello.com",
  "asana.com", "www.asana.com",
  "monday.com", "www.monday.com",
  "clickup.com", "www.clickup.com",
  "linear.app", "www.linear.app",
  "jira.com", "www.jira.com",
  "atlassian.com", "www.atlassian.com",
  "stripe.com", "www.stripe.com", "dashboard.stripe.com", "js.stripe.com",
  "supabase.com", "www.supabase.com", "app.supabase.com",
  "supabase.co", "flrllorqzmbztvtccvab.supabase.co",
  "vercel.com", "www.vercel.com",
  "netlify.com", "www.netlify.com",
  "heroku.com", "www.heroku.com",
  "figma.com", "www.figma.com",
  "canva.com", "www.canva.com",
  "dropbox.com", "www.dropbox.com",
  "zoom.us", "www.zoom.us",
  "microsoft.com", "www.microsoft.com",
  "office.com", "www.office.com", "office365.com",
  "outlook.com", "www.outlook.com",
  "live.com", "www.live.com",
  "apple.com", "www.apple.com",
  "amazon.com", "www.amazon.com", "aws.amazon.com",
  "mailchimp.com", "www.mailchimp.com",
  "hubspot.com", "www.hubspot.com",
  "pipedrive.com", "www.pipedrive.com",
  "salesforce.com", "www.salesforce.com",
  "fiverr.com", "www.fiverr.com",
  "upwork.com", "www.upwork.com",
  "shopify.com", "www.shopify.com",
  "squarespace.com", "www.squarespace.com",
  "wordpress.com", "www.wordpress.com",
  "wix.com", "www.wix.com",
  "godaddy.com", "www.godaddy.com",
  "namecheap.com", "www.namecheap.com",
  "resend.com", "www.resend.com",
  "sendgrid.com", "www.sendgrid.com",
  // CDN / infrastructure
  "cloudfront.net", "amazonaws.com", "akamai.com", "akamaized.net",
  "fastly.net", "cdn77.org", "cloudflare.com", "www.cloudflare.com",
  "cdnjs.cloudflare.com", "unpkg.com", "jsdelivr.net",
  "fbcdn.net", "twimg.com", "ytimg.com",
  // Email
  "gmail.com", "www.gmail.com",
  "proton.me", "www.proton.me", "mail.proton.me",
  // Payments / banking
  "paypal.com", "www.paypal.com",
  "wise.com", "www.wise.com",
  // News / reference
  "wikipedia.org", "en.wikipedia.org",
  "bbc.co.uk", "www.bbc.co.uk", "bbc.com", "www.bbc.com",
  "cnn.com", "www.cnn.com",
  "nytimes.com", "www.nytimes.com",
  // n8n
  "n8n.io", "www.n8n.io", "n8n.cloud", "app.n8n.cloud",
  "n8n.cortexautomations.online",
  // Misc tech
  "npmjs.com", "www.npmjs.com",
  "pypi.org", "www.pypi.org",
  "docker.com", "www.docker.com", "hub.docker.com",
  "medium.com", "www.medium.com",
  "dev.to",
]);

// Whitelisted root domains — any subdomain of these is also safe
const WHITELIST_ROOTS = [
  "google.com", "google.co.uk", "googleapis.com", "gstatic.com",
  "googleusercontent.com", "googlevideo.com", "doubleclick.net",
  "microsoft.com", "windows.com", "office.com", "live.com",
  "amazon.com", "amazonaws.com", "cloudfront.net",
  "apple.com", "icloud.com",
  "facebook.com", "fbcdn.net", "instagram.com",
  "twitter.com", "twimg.com", "x.com",
  "youtube.com", "ytimg.com", "youtu.be",
  "linkedin.com",
  "cloudflare.com", "cloudflare-dns.com",
  "akamai.com", "akamaized.net", "akamaihd.net",
  "fastly.net", "fastlylb.net",
  "github.com", "github.io", "githubusercontent.com",
  "stripe.com", "stripe.network",
  "supabase.com", "supabase.co",
  "slack.com", "slack-edge.com",
  "zoom.us", "zoomcdn.com",
  "discord.com", "discord.gg", "discordapp.com",
  "whatsapp.com", "whatsapp.net",
  "anthropic.com", "claude.ai",
  "openai.com",
  "n8n.io", "n8n.cloud",
  "wikipedia.org", "wikimedia.org",
];

// TLDs that are never porn
const SAFE_TLDS = new Set([
  ".gov", ".gov.uk", ".gov.au", ".gov.ca",
  ".edu", ".edu.au", ".ac.uk",
  ".mil",
  ".bank",
  ".int",
  ".museum",
  ".aero",
  ".coop",
  ".post",
]);

// Infrastructure domain patterns — regex fragments
const INFRA_PATTERNS = [
  /^cdn[\d.-]/, /\.cdn\./, /^ns\d+\./, /^dns/,
  /\.akamai\./, /\.cloudfront\./, /\.amazonaws\./,
  /\.fastly\./, /\.cloudflare\./,
  /^mail\./, /^smtp\./, /^mx\d*\./,
  /^api\./, /^static\./,
];

// ─── Curated adult domain list (always blocked) ──────────────────────────────
const CURATED_DOMAINS = [
  // Major porn tubes
  "pornhub.com", "www.pornhub.com",
  "xvideos.com", "www.xvideos.com",
  "xnxx.com", "www.xnxx.com",
  "xhamster.com", "www.xhamster.com",
  "redtube.com", "www.redtube.com",
  "youporn.com", "www.youporn.com",
  "tube8.com", "www.tube8.com",
  "spankbang.com", "www.spankbang.com",
  "eporner.com", "www.eporner.com",
  "beeg.com", "www.beeg.com",
  "tnaflix.com", "www.tnaflix.com",
  "txxx.com", "www.txxx.com",
  "hclips.com", "www.hclips.com",
  "drtuber.com", "www.drtuber.com",
  "nuvid.com", "www.nuvid.com",
  "empflix.com", "www.empflix.com",
  "cliphunter.com", "www.cliphunter.com",
  "fuq.com", "www.fuq.com",
  "slutload.com", "www.slutload.com",
  "porntrex.com", "www.porntrex.com",
  "thumbzilla.com", "www.thumbzilla.com",
  "porn.com", "www.porn.com",
  "pornone.com", "www.pornone.com",
  "4tube.com", "www.4tube.com",
  "alohatube.com", "www.alohatube.com",
  "bellesa.co", "www.bellesa.co",
  "daftsex.com", "www.daftsex.com",
  "hqporner.com", "www.hqporner.com",
  "motherless.com", "www.motherless.com",
  "porndude.com", "www.porndude.com",
  "sxyprn.com", "www.sxyprn.com",
  "vjav.com", "www.vjav.com",
  "youjizz.com", "www.youjizz.com",
  "pornpics.com", "www.pornpics.com",
  "porndish.com", "www.porndish.com",
  "silverdaddies.com", "www.silverdaddies.com",
  "xtube.com", "www.xtube.com",
  "playvids.com", "www.playvids.com",

  // Live cam sites
  "chaturbate.com", "www.chaturbate.com",
  "cam4.com", "www.cam4.com",
  "myfreecams.com", "www.myfreecams.com",
  "livejasmin.com", "www.livejasmin.com",
  "stripchat.com", "www.stripchat.com",
  "bongacams.com", "www.bongacams.com",
  "camsoda.com", "www.camsoda.com",
  "flirt4free.com", "www.flirt4free.com",
  "streamate.com", "www.streamate.com",
  "imlive.com", "www.imlive.com",
  "jerkmate.com", "www.jerkmate.com",
  "xcams.com", "www.xcams.com",
  "camster.com", "www.camster.com",
  "rabbits.cam", "www.rabbits.cam",
  "camonster.com", "www.camonster.com",
  "camversity.com", "www.camversity.com",

  // Fan/creator platforms (adult)
  "onlyfans.com", "www.onlyfans.com",
  "fansly.com", "www.fansly.com",
  "manyvids.com", "www.manyvids.com",
  "clips4sale.com", "www.clips4sale.com",
  "freeones.com", "www.freeones.com",
  "iwantclips.com", "www.iwantclips.com",
  "loyalfans.com", "www.loyalfans.com",
  "justfor.fans", "www.justfor.fans",
  "fancentro.com", "www.fancentro.com",
  "admireme.vip", "www.admireme.vip",

  // Premium / studio sites
  "brazzers.com", "www.brazzers.com",
  "bangbros.com", "www.bangbros.com",
  "realitykings.com", "www.realitykings.com",
  "naughtyamerica.com", "www.naughtyamerica.com",
  "mofos.com", "www.mofos.com",
  "penthouse.com", "www.penthouse.com",
  "hustler.com", "www.hustler.com",
  "kink.com", "www.kink.com",
  "digitalplayground.com", "www.digitalplayground.com",
  "wicked.com", "www.wicked.com",
  "vixen.com", "www.vixen.com",
  "blacked.com", "www.blacked.com",
  "tushy.com", "www.tushy.com",
  "deeper.com", "www.deeper.com",
  "babes.com", "www.babes.com",
  "twistys.com", "www.twistys.com",
  "teamskeet.com", "www.teamskeet.com",
  "fakehub.com", "www.fakehub.com",
  "bangbus.com", "www.bangbus.com",
  "metart.com", "www.metart.com",
  "sexart.com", "www.sexart.com",
  "adulttime.com", "www.adulttime.com",
  "pornpros.com", "www.pornpros.com",
  "puremature.com", "www.puremature.com",
  "passion-hd.com", "www.passion-hd.com",

  // Hentai / animated
  "hanime.tv", "www.hanime.tv",
  "hentaihaven.xxx", "www.hentaihaven.xxx",
  "nhentai.net", "www.nhentai.net",
  "e-hentai.org", "www.e-hentai.org",
  "rule34.xxx", "www.rule34.xxx",
  "rule34.paheal.net",
  "gelbooru.com", "www.gelbooru.com",
  "danbooru.donmai.us",
  "sankakucomplex.com", "www.sankakucomplex.com",
  "fakku.net", "www.fakku.net",
  "tsumino.com", "www.tsumino.com",
  "hitomi.la", "www.hitomi.la",

  // Escort / dating (adult)
  "ashleymadison.com", "www.ashleymadison.com",
  "adultfriendfinder.com", "www.adultfriendfinder.com",
  "seeking.com", "www.seeking.com",
  "fetlife.com", "www.fetlife.com",
  "alt.com", "www.alt.com",
  "eros.com", "www.eros.com",
  "tryst.link", "www.tryst.link",
  "skipthegames.com", "www.skipthegames.com",
  "listcrawler.com", "www.listcrawler.com",

  // Image boards / forums (adult)
  "imagefap.com", "www.imagefap.com",
  "4chan.org", "www.4chan.org", "boards.4chan.org",
  "8kun.top", "www.8kun.top",
  "literotica.com", "www.literotica.com",
  "eroshare.com", "www.eroshare.com",

  // Adult aggregators / search
  "sex.com", "www.sex.com",
  "pornmd.com", "www.pornmd.com",
  "nudevista.com", "www.nudevista.com",
  "findtubes.com", "www.findtubes.com",
  "tubegalore.com", "www.tubegalore.com",
  "pornhd.com", "www.pornhd.com",
  "hdporn.net", "www.hdporn.net",

  // NSFW Reddit alternatives
  "scrolller.com", "www.scrolller.com",
  "erome.com", "www.erome.com",
  "coomer.su", "www.coomer.su",
  "kemono.su", "www.kemono.su",

  // Misc adult
  "xgroovy.com", "www.xgroovy.com",
  "pornzog.com", "www.pornzog.com",
  "porndig.com", "www.porndig.com",
  "zbporn.com", "www.zbporn.com",
  "anyporn.com", "www.anyporn.com",
  "sunporno.com", "www.sunporno.com",
  "gotporn.com", "www.gotporn.com",
  "fapster.xxx", "www.fapster.xxx",
  "xxxbunker.com", "www.xxxbunker.com",
  "boyfriendtv.com", "www.boyfriendtv.com",
  "ashemaletube.com", "www.ashemaletube.com",
  "trannytube.tv", "www.trannytube.tv",
  "porngo.com", "www.porngo.com",
  "xmoviesforyou.com", "www.xmoviesforyou.com",
  "porn300.com", "www.porn300.com",
  "porntube.com", "www.porntube.com",
  "3movs.com", "www.3movs.com",
  "voyeurhit.com", "www.voyeurhit.com",
  "perfectgirls.net", "www.perfectgirls.net",
  "iafd.com", "www.iafd.com",
  "indexxx.com", "www.indexxx.com",
];

// ─── Cache helpers ───────────────────────────────────────────────────────────

function ensureCacheDir() {
  if (!fs.existsSync(CACHE_DIR)) fs.mkdirSync(CACHE_DIR, { recursive: true });
}

function isCacheStale(metaPath, maxAge) {
  try {
    const meta = JSON.parse(fs.readFileSync(metaPath, "utf8"));
    return Date.now() - meta.fetchedAt > maxAge;
  } catch (_) {
    return true;
  }
}

function readCacheFile(filePath) {
  try { return fs.readFileSync(filePath, "utf8"); } catch (_) { return null; }
}

function writeCacheFile(filePath, metaPath, content) {
  ensureCacheDir();
  fs.writeFileSync(filePath, content, "utf8");
  fs.writeFileSync(metaPath, JSON.stringify({ fetchedAt: Date.now() }), "utf8");
}

// ─── Network helpers ─────────────────────────────────────────────────────────

function fetchUrl(url, timeout = 15000) {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith("https") ? https : http;
    const req = mod.get(url, { timeout }, (res) => {
      // Follow one redirect
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        fetchUrl(res.headers.location, timeout).then(resolve).catch(reject);
        return;
      }
      if (res.statusCode !== 200) { reject(new Error(`HTTP ${res.statusCode}`)); return; }
      const chunks = [];
      res.on("data", (c) => chunks.push(c));
      res.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
      res.on("error", reject);
    });
    req.on("error", reject);
    req.on("timeout", () => { req.destroy(); reject(new Error("timeout")); });
  });
}

// ─── Remote list fetching ────────────────────────────────────────────────────

/**
 * Parse oisd domainswild format — one domain per line, lines starting with
 * wildcard like "*.domain.com" or just "domain.com"
 */
function parseOisdDomains(raw) {
  const domains = new Set();
  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || trimmed.startsWith("!")) continue;
    // Remove wildcard prefix if present
    const domain = trimmed.replace(/^\*\./, "").toLowerCase();
    if (domain && domain.includes(".") && !domain.startsWith(".")) {
      domains.add(domain);
    }
  }
  return domains;
}

/**
 * Parse Tranco CSV format — "rank,domain" per line
 */
function parseTranco(raw) {
  const domains = new Set();
  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const parts = trimmed.split(",");
    if (parts.length >= 2) {
      domains.add(parts[1].toLowerCase());
    }
  }
  return domains;
}

async function getRemoteDomains() {
  // Check cache first
  if (!isCacheStale(BLOCKLIST_META, BLOCKLIST_MAX_AGE)) {
    const cached = readCacheFile(BLOCKLIST_CACHE);
    if (cached) {
      console.log("[Blocker] Using cached remote blocklist");
      return parseOisdDomains(cached);
    }
  }

  try {
    console.log("[Blocker] Fetching oisd NSFW blocklist...");
    const raw = await fetchUrl(REMOTE_LIST_URL);
    writeCacheFile(BLOCKLIST_CACHE, BLOCKLIST_META, raw);
    const domains = parseOisdDomains(raw);
    console.log(`[Blocker] Fetched ${domains.size} remote domains`);
    return domains;
  } catch (err) {
    console.warn("[Blocker] Remote fetch failed:", err.message);
    // Fall back to stale cache
    const cached = readCacheFile(BLOCKLIST_CACHE);
    if (cached) {
      console.log("[Blocker] Using stale cached blocklist");
      return parseOisdDomains(cached);
    }
    return new Set();
  }
}

async function getTrancoTop10k() {
  // Check cache first
  if (!isCacheStale(TRANCO_META, TRANCO_MAX_AGE)) {
    const cached = readCacheFile(TRANCO_CACHE);
    if (cached) return parseTranco(cached);
  }

  try {
    console.log("[Blocker] Fetching Tranco top-10k...");
    const raw = await fetchUrl(TRANCO_URL);
    writeCacheFile(TRANCO_CACHE, TRANCO_META, raw);
    const domains = parseTranco(raw);
    console.log(`[Blocker] Fetched ${domains.size} Tranco domains`);
    return domains;
  } catch (err) {
    console.warn("[Blocker] Tranco fetch failed:", err.message);
    const cached = readCacheFile(TRANCO_CACHE);
    if (cached) return parseTranco(cached);
    return new Set();
  }
}

// ─── Verification filter ─────────────────────────────────────────────────────

/**
 * Returns the root domain from a full domain string.
 * e.g. "ads.google.com" → "google.com", "foo.bar.co.uk" → "bar.co.uk"
 */
function getRootDomain(domain) {
  const parts = domain.split(".");
  // Handle two-part TLDs like .co.uk, .com.au, .co.nz
  const twoPartTlds = ["co.uk", "com.au", "co.nz", "co.za", "com.br", "co.jp", "co.kr", "co.in", "org.uk", "net.au", "gov.uk", "gov.au"];
  const lastTwo = parts.slice(-2).join(".");
  if (twoPartTlds.includes(lastTwo) && parts.length >= 3) {
    return parts.slice(-3).join(".");
  }
  return parts.slice(-2).join(".");
}

function isWhitelisted(domain) {
  // Direct whitelist match
  if (WHITELIST.has(domain)) return true;

  // Subdomain of whitelisted root
  const root = getRootDomain(domain);
  for (const wr of WHITELIST_ROOTS) {
    if (domain === wr || domain.endsWith("." + wr)) return true;
  }

  return false;
}

function hasSafeTld(domain) {
  for (const tld of SAFE_TLDS) {
    if (domain.endsWith(tld)) return true;
  }
  return false;
}

function isInfrastructureDomain(domain) {
  for (const pattern of INFRA_PATTERNS) {
    if (pattern.test(domain)) return true;
  }
  return false;
}

/**
 * Run a domain through all verification checks.
 * Returns true if the domain should be BLOCKED (i.e. it passed verification
 * as a legitimate adult site), false if it should be SKIPPED (false positive).
 */
function verifyDomain(domain, trancoSet) {
  // Layer 1: Whitelist (exact + subdomain)
  if (isWhitelisted(domain)) return false;

  // Layer 2: Safe TLDs
  if (hasSafeTld(domain)) return false;

  // Layer 3: Infrastructure patterns
  if (isInfrastructureDomain(domain)) return false;

  // Layer 4: Tranco popularity — if it's a top-10k site, skip it
  const root = getRootDomain(domain);
  if (trancoSet.has(domain) || trancoSet.has(root)) return false;

  // Passed all checks — it's not a known legitimate site, allow blocking
  return true;
}

// ─── Hosts file management ───────────────────────────────────────────────────

function getHostsPath() {
  return process.platform === "win32"
    ? "C:\\Windows\\System32\\drivers\\etc\\hosts"
    : "/etc/hosts";
}

function buildBlockSection(domains) {
  const lines = [MARKER_START];
  for (const domain of domains) {
    lines.push(`0.0.0.0 ${domain}`);
  }
  lines.push(MARKER_END);
  return lines.join("\n");
}

function injectBlock(current, domains) {
  const section = buildBlockSection(domains);
  if (current.includes(MARKER_START)) {
    const before = current.substring(0, current.indexOf(MARKER_START)).trimEnd();
    const after = current
      .substring(current.indexOf(MARKER_END) + MARKER_END.length)
      .trimStart();
    return `${before}\n\n${section}\n\n${after}`;
  }
  return `${current.trimEnd()}\n\n${section}\n`;
}

function removeBlock(current) {
  if (!current.includes(MARKER_START)) return current;
  const before = current.substring(0, current.indexOf(MARKER_START)).trimEnd();
  const after = current
    .substring(current.indexOf(MARKER_END) + MARKER_END.length)
    .trimStart();
  return before + (after ? "\n" + after : "");
}

function elevatedWrite(content) {
  return new Promise((resolve) => {
    const hostsPath = getHostsPath();
    const tempFile = path.join(os.tmpdir(), "asc_hosts_tmp.txt");

    try {
      fs.writeFileSync(tempFile, content, "utf8");
    } catch (e) {
      resolve(false);
      return;
    }

    if (process.platform === "win32") {
      const cmd = `powershell -Command "Start-Process powershell -Verb RunAs -WindowStyle Hidden -ArgumentList '-Command Copy-Item \\'${tempFile}\\' \\'${hostsPath}\\' -Force' -Wait"`;
      const proc = spawn("cmd", ["/c", cmd], { windowsHide: true });
      proc.on("close", (code) => resolve(code === 0));
      proc.on("error", () => resolve(false));
    } else {
      const script = `do shell script "cp '${tempFile}' '${hostsPath}'" with administrator privileges`;
      const proc = spawn("osascript", ["-e", script]);
      proc.on("close", (code) => resolve(code === 0));
      proc.on("error", () => resolve(false));
    }
  });
}

async function writeHostsFile(content) {
  const hostsPath = getHostsPath();

  try {
    fs.writeFileSync(hostsPath, content, "utf8");
    console.log("[Blocker] Hosts file updated (direct write)");
    return true;
  } catch (_) {}

  const ok = await elevatedWrite(content);
  if (ok) {
    console.log("[Blocker] Hosts file updated (elevated write)");
  } else {
    console.warn("[Blocker] Could not write hosts file — elevation denied or unavailable");
  }
  return ok;
}

// ─── Public API ──────────────────────────────────────────────────────────────

async function setupBlocking() {
  const hostsPath = getHostsPath();
  let current = "";
  try {
    current = fs.readFileSync(hostsPath, "utf8");
  } catch (_) {}

  // Start with curated domains (always trusted)
  const finalDomains = new Set(CURATED_DOMAINS);

  // Fetch remote list + Tranco in parallel
  const [remoteDomains, trancoSet] = await Promise.all([
    getRemoteDomains(),
    getTrancoTop10k(),
  ]);

  // Verify each remote domain through all filter layers
  let accepted = 0;
  let rejected = 0;
  for (const domain of remoteDomains) {
    if (verifyDomain(domain, trancoSet)) {
      finalDomains.add(domain);
      finalDomains.add("www." + domain);
      accepted++;
    } else {
      rejected++;
    }
  }

  console.log(`[Blocker] Remote domains: ${accepted} accepted, ${rejected} rejected as false positives`);
  console.log(`[Blocker] Total domains to block: ${finalDomains.size}`);

  const updated = injectBlock(current, [...finalDomains]);
  await writeHostsFile(updated);

  // Flush DNS so blocks take effect immediately
  if (process.platform === "win32") {
    spawn("ipconfig", ["/flushdns"], { windowsHide: true });
  } else {
    spawn("dscacheutil", ["-flushcache"]).on("error", () => {});
    spawn("killall", ["-HUP", "mDNSResponder"]).on("error", () => {});
  }
}

async function teardownBlocking() {
  const hostsPath = getHostsPath();
  let current = "";
  try {
    current = fs.readFileSync(hostsPath, "utf8");
  } catch (_) {
    return;
  }
  await writeHostsFile(removeBlock(current));
}

module.exports = { setupBlocking, teardownBlocking };
