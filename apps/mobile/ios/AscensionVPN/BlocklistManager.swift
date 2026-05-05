import Foundation

/// Manages the curated adult domain blocklist for DNS filtering.
/// Provides O(1) lookup with wildcard subdomain matching.
final class BlocklistManager {

    static let shared = BlocklistManager()

    /// App Group identifier shared between the main app and extensions.
    static let appGroupID = "group.app.getascension"

    /// Key used to store the blocked-attempts log in shared UserDefaults.
    static let blockedLogKey = "blockedAttempts"

    /// Key used to store the total blocked count.
    static let blockedCountKey = "blockedCount"

    /// The set of blocked root domains (no "www." prefix).
    private let blockedDomains: Set<String> = [
        "3movs.com",
        "4chan.org",
        "4tube.com",
        "8kun.top",
        "admireme.vip",
        "adultfriendfinder.com",
        "adulttime.com",
        "alohatube.com",
        "alt.com",
        "anyporn.com",
        "ashemaletube.com",
        "ashleymadison.com",
        "babes.com",
        "bangbros.com",
        "bangbus.com",
        "beeg.com",
        "bellesa.co",
        "blacked.com",
        "bongacams.com",
        "boyfriendtv.com",
        "brazzers.com",
        "cam4.com",
        "camonster.com",
        "camsoda.com",
        "camster.com",
        "camversity.com",
        "chaturbate.com",
        "cliphunter.com",
        "clips4sale.com",
        "coomer.su",
        "daftsex.com",
        "danbooru.donmai.us",
        "deeper.com",
        "digitalplayground.com",
        "drtuber.com",
        "e-hentai.org",
        "empflix.com",
        "eporner.com",
        "erome.com",
        "eros.com",
        "eroshare.com",
        "fakehub.com",
        "fakku.net",
        "fancentro.com",
        "fansly.com",
        "fapster.xxx",
        "fetlife.com",
        "findtubes.com",
        "flirt4free.com",
        "freeones.com",
        "fuq.com",
        "gelbooru.com",
        "gotporn.com",
        "hanime.tv",
        "hclips.com",
        "hdporn.net",
        "hentaihaven.xxx",
        "hitomi.la",
        "hqporner.com",
        "hustler.com",
        "iafd.com",
        "imagefap.com",
        "imlive.com",
        "indexxx.com",
        "iwantclips.com",
        "jerkmate.com",
        "justfor.fans",
        "kemono.su",
        "kink.com",
        "listcrawler.com",
        "literotica.com",
        "livejasmin.com",
        "loyalfans.com",
        "manyvids.com",
        "metart.com",
        "mofos.com",
        "motherless.com",
        "myfreecams.com",
        "naughtyamerica.com",
        "nhentai.net",
        "nudevista.com",
        "nuvid.com",
        "onlyfans.com",
        "passion-hd.com",
        "penthouse.com",
        "perfectgirls.net",
        "playvids.com",
        "porn.com",
        "porn300.com",
        "porndig.com",
        "porndish.com",
        "porndude.com",
        "porngo.com",
        "pornhd.com",
        "pornhub.com",
        "pornmd.com",
        "pornone.com",
        "pornpics.com",
        "pornpros.com",
        "porntrex.com",
        "porntube.com",
        "pornzog.com",
        "puremature.com",
        "rabbits.cam",
        "realitykings.com",
        "redtube.com",
        "rule34.paheal.net",
        "rule34.xxx",
        "sankakucomplex.com",
        "scrolller.com",
        "seeking.com",
        "sex.com",
        "sexart.com",
        "silverdaddies.com",
        "skipthegames.com",
        "slutload.com",
        "spankbang.com",
        "streamate.com",
        "stripchat.com",
        "sunporno.com",
        "sxyprn.com",
        "teamskeet.com",
        "thumbzilla.com",
        "tnaflix.com",
        "trannytube.tv",
        "tryst.link",
        "tsumino.com",
        "tube8.com",
        "tubegalore.com",
        "tushy.com",
        "twistys.com",
        "txxx.com",
        "vixen.com",
        "vjav.com",
        "voyeurhit.com",
        "wicked.com",
        "xcams.com",
        "xgroovy.com",
        "xhamster.com",
        "xmoviesforyou.com",
        "xnxx.com",
        "xtube.com",
        "xvideos.com",
        "xxxbunker.com",
        "youjizz.com",
        "youporn.com",
        "zbporn.com",
    ]

    private init() {}

    // MARK: - Domain Matching

    /// Check if a domain should be blocked.
    /// Handles exact match and wildcard subdomain matching.
    /// For example, if "pornhub.com" is in the set, then
    /// "www.pornhub.com", "m.pornhub.com", and "pornhub.com" all match.
    func isDomainBlocked(_ domain: String) -> Bool {
        let lowered = domain.lowercased()

        // Exact match
        if blockedDomains.contains(lowered) {
            return true
        }

        // Walk up the domain hierarchy to check parent domains.
        // e.g. "cdn.www.pornhub.com" -> "www.pornhub.com" -> "pornhub.com"
        var parts = lowered.split(separator: ".")
        while parts.count > 2 {
            parts.removeFirst()
            let parent = parts.joined(separator: ".")
            if blockedDomains.contains(parent) {
                return true
            }
        }

        return false
    }

    // MARK: - Shared Logging (App Group)

    /// Log a blocked domain attempt to the shared App Group container.
    /// Both the VPN extension and the main app can read this data.
    func logBlockedAttempt(domain: String, timestamp: TimeInterval = Date().timeIntervalSince1970) {
        guard let defaults = UserDefaults(suiteName: BlocklistManager.appGroupID) else { return }

        // Increment total count
        let currentCount = defaults.integer(forKey: BlocklistManager.blockedCountKey)
        defaults.set(currentCount + 1, forKey: BlocklistManager.blockedCountKey)

        // Append to recent log (keep last 100 entries)
        var log = defaults.array(forKey: BlocklistManager.blockedLogKey) as? [[String: Any]] ?? []
        let entry: [String: Any] = [
            "domain": domain,
            "timestamp": timestamp,
            "reportedToServer": false,
        ]
        log.append(entry)

        // Trim to last 100
        if log.count > 100 {
            log = Array(log.suffix(100))
        }

        defaults.set(log, forKey: BlocklistManager.blockedLogKey)
    }

    /// Get the total count of blocked attempts.
    func getBlockedCount() -> Int {
        guard let defaults = UserDefaults(suiteName: BlocklistManager.appGroupID) else { return 0 }
        return defaults.integer(forKey: BlocklistManager.blockedCountKey)
    }

    /// Get recent blocked attempts that have NOT yet been reported to the server.
    /// The extension marks each entry as reported after a successful API call,
    /// so the main app's sync loop only picks up any that slipped through.
    func getRecentBlocked() -> [[String: Any]] {
        guard let defaults = UserDefaults(suiteName: BlocklistManager.appGroupID) else { return [] }
        let all = defaults.array(forKey: BlocklistManager.blockedLogKey) as? [[String: Any]] ?? []
        return all.filter { ($0["reportedToServer"] as? Bool) != true }
    }

    /// Mark a blocked attempt as successfully reported so it is not re-reported
    /// by the main app's sync loop.
    func markAsReported(domain: String, timestamp: TimeInterval) {
        guard let defaults = UserDefaults(suiteName: BlocklistManager.appGroupID) else { return }
        var log = defaults.array(forKey: BlocklistManager.blockedLogKey) as? [[String: Any]] ?? []
        for i in 0..<log.count {
            if let ts = log[i]["timestamp"] as? TimeInterval,
               let d = log[i]["domain"] as? String,
               abs(ts - timestamp) < 0.1, d == domain {
                log[i]["reportedToServer"] = true
                break
            }
        }
        defaults.set(log, forKey: BlocklistManager.blockedLogKey)
    }
}
