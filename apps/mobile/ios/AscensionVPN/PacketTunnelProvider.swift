import NetworkExtension
import Network
import os.log

/// NEPacketTunnelProvider that intercepts DNS queries and blocks adult domains
/// by returning 0.0.0.0 for matched domains. All other traffic passes through.
class PacketTunnelProvider: NEPacketTunnelProvider {

    private let log = OSLog(subsystem: "app.getascension.vpn", category: "tunnel")
    private let blocklist = BlocklistManager.shared

    // Deduplication: only report the same domain once per 60 s to avoid spamming the edge function
    private var lastReportedTimestamp = [String: TimeInterval]()
    private let reportDedupeInterval: TimeInterval = 60

    // Heartbeat: fires every 2 minutes so monitoring.checkPaused knows the VPN is still running,
    // even when the main app is killed.
    private var heartbeatTimer: DispatchSourceTimer?
    private let heartbeatInterval: TimeInterval = 120

    // MARK: - Tunnel Lifecycle

    override func startTunnel(options: [String: NSObject]?, completionHandler: @escaping (Error?) -> Void) {
        os_log("Starting Ascension DNS filter tunnel", log: log, type: .info)

        // Reload cloud blocklist on tunnel start so any update written while the
        // extension was not running is picked up immediately.
        blocklist.reloadCloudBlocklist()

        // Listen for the main app signaling a fresh blocklist was written to App Group.
        CFNotificationCenterAddObserver(
            CFNotificationCenterGetDarwinNotifyCenter(),
            Unmanaged.passUnretained(self).toOpaque(),
            { _, observer, _, _, _ in
                guard let observer = observer else { return }
                let provider = Unmanaged<PacketTunnelProvider>.fromOpaque(observer).takeUnretainedValue()
                provider.blocklist.reloadCloudBlocklist()
            },
            "app.getascension.blocklistUpdated" as CFString,
            nil,
            .deliverImmediately
        )

        let settings = createTunnelSettings()
        setTunnelNetworkSettings(settings) { [weak self] error in
            if let error = error {
                os_log("Failed to set tunnel settings: %{public}@", log: self?.log ?? .default, type: .error, error.localizedDescription)
                completionHandler(error)
                return
            }

            os_log("Tunnel settings applied, starting DNS interception", log: self?.log ?? .default, type: .info)
            self?.readPackets()
            self?.startHeartbeat()
            completionHandler(nil)
        }
    }

    override func stopTunnel(with reason: NEProviderStopReason, completionHandler: @escaping () -> Void) {
        CFNotificationCenterRemoveObserver(
            CFNotificationCenterGetDarwinNotifyCenter(),
            Unmanaged.passUnretained(self).toOpaque(),
            CFNotificationName("app.getascension.blocklistUpdated" as CFString),
            nil
        )
        heartbeatTimer?.cancel()
        heartbeatTimer = nil
        os_log("Stopping Ascension DNS filter tunnel (reason: %d)", log: log, type: .info, reason.rawValue)
        completionHandler()
    }

    // MARK: - Tunnel Configuration

    private func createTunnelSettings() -> NEPacketTunnelNetworkSettings {
        // Use a non-routable address as the tunnel interface address
        let settings = NEPacketTunnelNetworkSettings(tunnelRemoteAddress: "127.0.0.1")

        // Route only Cloudflare DNS server IPs through tunnel so we can
        // intercept DNS queries for reporting. All other traffic (HTTP/HTTPS)
        // flows through WiFi/cellular unaffected.
        let ipv4Settings = NEIPv4Settings(addresses: ["10.0.0.1"], subnetMasks: ["255.255.255.0"])
        // Route only our tunnel DNS IP through the tunnel so we intercept all queries.
        // We use regular Cloudflare (1.1.1.1) — NOT Family DNS — so Google SafeSearch
        // is NOT enforced. This means users can see adult sites in search results,
        // but the moment they click through, the DNS query fires and the partner is alerted.
        // Our local blocklist + NXDOMAIN detection handles the actual blocking.
        ipv4Settings.includedRoutes = [
            NEIPv4Route(destinationAddress: "1.1.1.1", subnetMask: "255.255.255.255"),
            NEIPv4Route(destinationAddress: "1.0.0.1", subnetMask: "255.255.255.255"),
        ]
        settings.ipv4Settings = ipv4Settings

        // Regular Cloudflare DNS (no SafeSearch enforcement).
        // Blocking is done by our PacketTunnelProvider via the local blocklist.
        let dnsSettings = NEDNSSettings(servers: ["1.1.1.1", "1.0.0.1"])
        dnsSettings.matchDomains = [""]
        settings.dnsSettings = dnsSettings

        return settings
    }

    // MARK: - Packet Processing

    /// Continuously read packets from the tunnel interface and process DNS queries.
    private func readPackets() {
        packetFlow.readPackets { [weak self] packets, protocols in
            guard let self = self else { return }

            for (index, packet) in packets.enumerated() {
                self.processPacket(packet, protocolFamily: protocols[index])
            }

            // Continue reading
            self.readPackets()
        }
    }

    /// Process an individual IP packet. If it contains a DNS query for a
    /// blocked domain, respond with 0.0.0.0. Otherwise, forward it.
    private func processPacket(_ packet: Data, protocolFamily: NSNumber) {
        // Drop packets destined for known DoH servers (port 443) to force
        // the OS to fall back to plain UDP DNS on port 53, which we intercept.
        if isDoHPacket(packet) {
            return
        }

        // Only Cloudflare DNS IPs (1.1.3.3, 1.0.0.3) are routed through the tunnel.
        // Any non-UDP-DNS packet reaching here is unexpected — drop it silently.
        // Writing it back to packetFlow would cause a routing loop.
        guard packet.count >= 40 else { return }
        guard isUDPDNSQuery(packet) else { return }

        // Extract the domain name from the DNS query
        guard let domain = extractDomainFromDNS(packet) else {
            // Can't parse domain — forward it so DNS still works
            forwardDNS(packet: packet, protocolFamily: protocolFamily)
            return
        }

        // Blocked domain: return NXDOMAIN ourselves and log — do NOT forward
        if blocklist.isDomainBlocked(domain) {
            let blockTimestamp = Date().timeIntervalSince1970
            let lastLog = lastReportedTimestamp[domain] ?? 0
            if blockTimestamp - lastLog >= reportDedupeInterval {
                lastReportedTimestamp[domain] = blockTimestamp
                blocklist.logBlockedAttempt(domain: domain, timestamp: blockTimestamp)
                reportBlockedDomain(domain, timestamp: blockTimestamp)
                os_log("BLOCKED (logged): %{public}@", log: log, type: .info, domain)
            } else {
                os_log("BLOCKED (deduped): %{public}@", log: log, type: .debug, domain)
            }
            if let nxResponse = craftNXDOMAINResponse(originalPacket: packet) {
                packetFlow.writePackets([nxResponse], withProtocols: [protocolFamily])
            }
            return
        }

        // Non-blocked: forward to Google DNS (8.8.8.8) — outside our tunnel routes so no loop
        forwardDNS(packet: packet, protocolFamily: protocolFamily)
    }

    // MARK: - DNS Parsing

    /// Returns false for system/internal DNS queries that should never be reported:
    /// reverse DNS (*.arpa), mDNS (*.local), service discovery (_prefix), single labels.
    private func isReportableDomain(_ domain: String) -> Bool {
        if domain.hasSuffix(".arpa") { return false }
        if domain.hasSuffix(".local") { return false }
        if domain.hasPrefix("_") { return false }
        let labels = domain.split(separator: ".")
        if labels.count < 2 { return false }
        return true
    }

    // Known DoH server IPs — drop TCP/443 traffic to these to force plain DNS
    private let dohServerIPs: Set<String> = [
        "1.1.1.1", "1.0.0.1",       // Cloudflare
        "8.8.8.8", "8.8.4.4",       // Google
        "9.9.9.9", "149.112.112.112" // Quad9
    ]

    /// Returns true if the packet is a TCP connection to a known DoH server on port 443.
    private func isDoHPacket(_ packet: Data) -> Bool {
        guard packet.count >= 20 else { return false }
        let ipHeaderLength = Int(packet[0] & 0x0F) * 4
        guard packet[9] == 6 else { return false } // TCP only
        guard packet.count >= ipHeaderLength + 4 else { return false }

        let dstPort = UInt16(packet[ipHeaderLength + 2]) << 8 | UInt16(packet[ipHeaderLength + 3])
        guard dstPort == 443 else { return false }

        let ip = "\(packet[16]).\(packet[17]).\(packet[18]).\(packet[19])"
        return dohServerIPs.contains(ip)
    }

    /// Check if the packet is a UDP packet destined for DNS (port 53).
    private func isUDPDNSQuery(_ packet: Data) -> Bool {
        guard packet.count >= 28 else { return false }

        // IP header: byte 9 is protocol (17 = UDP)
        let ipHeaderLength = Int(packet[0] & 0x0F) * 4
        guard packet[9] == 17 else { return false }
        guard packet.count >= ipHeaderLength + 8 else { return false }

        // UDP header: destination port is at offset ipHeaderLength + 2 (2 bytes, big-endian)
        let dstPort = UInt16(packet[ipHeaderLength + 2]) << 8 | UInt16(packet[ipHeaderLength + 3])
        return dstPort == 53
    }

    /// Extract the queried domain name from a DNS query packet.
    /// DNS query starts after IP header + UDP header.
    private func extractDomainFromDNS(_ packet: Data) -> String? {
        let ipHeaderLength = Int(packet[0] & 0x0F) * 4
        let dnsOffset = ipHeaderLength + 8 // IP header + UDP header

        // DNS header is 12 bytes, question section follows
        let questionOffset = dnsOffset + 12
        guard packet.count > questionOffset else { return nil }

        // Parse DNS name: sequence of length-prefixed labels
        var labels: [String] = []
        var offset = questionOffset

        while offset < packet.count {
            let labelLength = Int(packet[offset])
            if labelLength == 0 { break } // Root label, end of name
            if labelLength > 63 { return nil } // Invalid or compressed

            offset += 1
            guard offset + labelLength <= packet.count else { return nil }

            let labelData = packet[offset..<(offset + labelLength)]
            guard let label = String(data: labelData, encoding: .utf8) else { return nil }
            labels.append(label)
            offset += labelLength
        }

        guard !labels.isEmpty else { return nil }
        return labels.joined(separator: ".").lowercased()
    }

    /// Craft a NXDOMAIN response for a blocked domain.
    /// Swaps src/dst IPs and ports, sets QR=1 RCODE=3, zero answer count.
    private func craftNXDOMAINResponse(originalPacket: Data) -> Data? {
        let ipHeaderLength = Int(originalPacket[0] & 0x0F) * 4
        guard originalPacket.count >= ipHeaderLength + 8 + 12 else { return nil }

        var response = originalPacket
        let udpOffset = ipHeaderLength
        let dnsOffset = udpOffset + 8

        // Swap IP src/dst
        for i in 0..<4 {
            let tmp = response[12 + i]
            response[12 + i] = response[16 + i]
            response[16 + i] = tmp
        }
        // Swap UDP src/dst ports
        for i in 0..<2 {
            let tmp = response[udpOffset + i]
            response[udpOffset + i] = response[udpOffset + 2 + i]
            response[udpOffset + 2 + i] = tmp
        }

        // DNS flags: QR=1 (response), AA=1, RD=1 | RA=1, RCODE=3 (NXDOMAIN)
        response[dnsOffset + 2] = 0x85
        response[dnsOffset + 3] = 0x83

        // Zero answer/authority/additional counts
        response[dnsOffset + 6] = 0x00; response[dnsOffset + 7] = 0x00
        response[dnsOffset + 8] = 0x00; response[dnsOffset + 9] = 0x00
        response[dnsOffset + 10] = 0x00; response[dnsOffset + 11] = 0x00

        // Truncate to end of question section (keep original question intact)
        var qEnd = dnsOffset + 12
        while qEnd < response.count && response[qEnd] != 0 { qEnd += Int(response[qEnd]) + 1 }
        qEnd += 1 + 4 // null terminator + QTYPE + QCLASS
        response = response[0..<qEnd]

        // Update IP total length
        let totalLen = UInt16(response.count)
        response[2] = UInt8(totalLen >> 8); response[3] = UInt8(totalLen & 0xFF)

        // Update UDP length
        let udpLen = UInt16(response.count - ipHeaderLength)
        response[udpOffset + 4] = UInt8(udpLen >> 8); response[udpOffset + 5] = UInt8(udpLen & 0xFF)
        response[udpOffset + 6] = 0x00; response[udpOffset + 7] = 0x00

        // Recalculate IP checksum
        response[10] = 0x00; response[11] = 0x00
        var checksum: UInt32 = 0
        for i in stride(from: 0, to: ipHeaderLength, by: 2) {
            checksum += UInt32(response[i]) << 8 | UInt32(response[i + 1])
        }
        while checksum > 0xFFFF { checksum = (checksum & 0xFFFF) + (checksum >> 16) }
        let cs = ~UInt16(checksum)
        response[10] = UInt8(cs >> 8); response[11] = UInt8(cs & 0xFF)

        return response
    }

    /// Craft a DNS response for a blocked domain, returning 0.0.0.0 as the A record.
    /// We swap src/dst IPs and ports, set the response flag, and append an answer.
    private func craftBlockedDNSResponse(originalPacket: Data) -> Data? {
        let ipHeaderLength = Int(originalPacket[0] & 0x0F) * 4
        guard originalPacket.count >= ipHeaderLength + 8 + 12 else { return nil }

        var response = originalPacket

        // Swap source and destination IP addresses (bytes 12-15 and 16-19)
        for i in 0..<4 {
            let tmp = response[12 + i]
            response[12 + i] = response[16 + i]
            response[16 + i] = tmp
        }

        // Swap source and destination UDP ports
        let udpOffset = ipHeaderLength
        for i in 0..<2 {
            let tmp = response[udpOffset + i]
            response[udpOffset + i] = response[udpOffset + 2 + i]
            response[udpOffset + 2 + i] = tmp
        }

        let dnsOffset = ipHeaderLength + 8

        // Set DNS flags: QR=1 (response), AA=1 (authoritative), RCODE=0 (no error)
        response[dnsOffset + 2] = 0x85 // QR=1, AA=1, RD=1
        response[dnsOffset + 3] = 0x80 // RA=1, RCODE=0

        // Set answer count to 1
        response[dnsOffset + 6] = 0x00
        response[dnsOffset + 7] = 0x01

        // Build the answer section:
        // Name pointer (0xC00C points to the name in the question section at offset 12)
        // Type A (1), Class IN (1), TTL 60, RDLENGTH 4, RDATA 0.0.0.0
        let answer: [UInt8] = [
            0xC0, 0x0C,       // Name pointer to question
            0x00, 0x01,       // Type A
            0x00, 0x01,       // Class IN
            0x00, 0x00, 0x00, 0x3C, // TTL = 60 seconds
            0x00, 0x04,       // RDLENGTH = 4
            0x00, 0x00, 0x00, 0x00, // RDATA = 0.0.0.0
        ]

        // Find end of question section
        var qEnd = dnsOffset + 12
        while qEnd < response.count && response[qEnd] != 0 {
            qEnd += Int(response[qEnd]) + 1
        }
        qEnd += 1 // Skip null terminator
        qEnd += 4 // Skip QTYPE and QCLASS

        // Truncate response after question, append answer
        response = response[0..<qEnd] + Data(answer)

        // Update IP total length
        let totalLength = UInt16(response.count)
        response[2] = UInt8(totalLength >> 8)
        response[3] = UInt8(totalLength & 0xFF)

        // Update UDP length
        let udpLength = UInt16(response.count - ipHeaderLength)
        response[udpOffset + 4] = UInt8(udpLength >> 8)
        response[udpOffset + 5] = UInt8(udpLength & 0xFF)

        // Zero out UDP checksum (optional for IPv4)
        response[udpOffset + 6] = 0x00
        response[udpOffset + 7] = 0x00

        // Recalculate IP header checksum
        response[10] = 0x00
        response[11] = 0x00
        var checksum: UInt32 = 0
        for i in stride(from: 0, to: ipHeaderLength, by: 2) {
            checksum += UInt32(response[i]) << 8 | UInt32(response[i + 1])
        }
        while checksum > 0xFFFF {
            checksum = (checksum & 0xFFFF) + (checksum >> 16)
        }
        let checksumValue = ~UInt16(checksum)
        response[10] = UInt8(checksumValue >> 8)
        response[11] = UInt8(checksumValue & 0xFF)

        return response
    }

    // MARK: - DNS Forwarding

    // Retain active NWConnections so they aren't deallocated before the response arrives
    private var activeConnections = [ObjectIdentifier: NWConnection]()
    private let connectionsLock = NSLock()

    /// Forward a DNS query to Cloudflare Family DNS (1.1.3.3).
    /// NWConnection in a NEPacketTunnelProvider is guaranteed by Apple to bypass
    /// the VPN tunnel, so there is no routing loop even though 1.1.3.3 is in our routes.
    /// Cloudflare Family DNS blocks millions of adult domains automatically — we detect
    /// NXDOMAIN responses here to log Cloudflare-blocked domains the same as local-list ones.
    private func forwardDNS(packet: Data, protocolFamily: NSNumber) {
        let ipHeaderLength = Int(packet[0] & 0x0F) * 4
        let udpOffset = ipHeaderLength
        guard packet.count >= udpOffset + 8 else { return }

        let srcPort = UInt16(packet[udpOffset]) << 8 | UInt16(packet[udpOffset + 1])
        let srcIPBytes: [UInt8] = [packet[12], packet[13], packet[14], packet[15]]
        let dstIPBytes: [UInt8] = [packet[16], packet[17], packet[18], packet[19]]
        let dnsPayload = packet.subdata(in: (udpOffset + 8)..<packet.count)
        guard !dnsPayload.isEmpty else { return }

        let domain = extractDomainFromDNS(packet) ?? "<unknown>"
        os_log("forwardDNS: -> 1.1.3.3 query for %{public}@ (%d bytes)", log: log, type: .debug, domain, dnsPayload.count)

        let endpoint = NWEndpoint.hostPort(host: "1.1.1.1", port: 53)
        let conn = NWConnection(to: endpoint, using: .udp)

        connectionsLock.lock()
        activeConnections[ObjectIdentifier(conn)] = conn
        connectionsLock.unlock()

        conn.stateUpdateHandler = { [weak self] state in
            guard let self = self else { return }
            switch state {
            case .ready:
                conn.send(content: dnsPayload, completion: .contentProcessed { error in
                    if let error = error {
                        os_log("forwardDNS: send error: %{public}@", log: self.log, type: .error, error.localizedDescription)
                        self.removeConnection(conn)
                        return
                    }
                    conn.receiveMessage { data, _, _, error in
                        defer { self.removeConnection(conn) }
                        guard let responsePayload = data, responsePayload.count >= 4, error == nil else {
                            os_log("forwardDNS: receive error: %{public}@", log: self.log, type: .error, error?.localizedDescription ?? "empty")
                            return
                        }
                        // Detect NXDOMAIN (RCODE=3) — Cloudflare blocked this domain.
                        // Skip system/internal queries (reverse DNS, mDNS, service discovery)
                        // which also return NXDOMAIN but are not user-browsing activity.
                        let rcode = responsePayload[3] & 0x0F
                        if rcode == 3 && self.isReportableDomain(domain) {
                            os_log("forwardDNS: DNS NXDOMAIN for %{public}@", log: self.log, type: .info, domain)
                            let ts = Date().timeIntervalSince1970
                            let lastLog = self.lastReportedTimestamp[domain] ?? 0
                            if ts - lastLog >= self.reportDedupeInterval {
                                self.lastReportedTimestamp[domain] = ts
                                self.blocklist.logBlockedAttempt(domain: domain, timestamp: ts)
                                self.reportBlockedDomain(domain, timestamp: ts)
                            }
                        }
                        os_log("forwardDNS: <- 1.1.3.3 %d bytes rcode=%d", log: self.log, type: .debug, responsePayload.count, rcode)
                        self.buildAndDeliverDNSResponse(
                            dnsPayload: responsePayload,
                            srcIPBytes: srcIPBytes,
                            dstIPBytes: dstIPBytes,
                            originalSrcPort: srcPort,
                            protocolFamily: protocolFamily
                        )
                    }
                })
            case .failed(let error):
                os_log("forwardDNS: connection failed: %{public}@", log: self.log, type: .error, error.localizedDescription)
                self.removeConnection(conn)
            default:
                break
            }
        }
        conn.start(queue: .global(qos: .userInitiated))
    }

    private func removeConnection(_ conn: NWConnection) {
        conn.cancel()
        connectionsLock.lock()
        activeConnections.removeValue(forKey: ObjectIdentifier(conn))
        connectionsLock.unlock()
    }

    /// Wrap a raw DNS response payload in IP+UDP headers and deliver it via the tunnel's packet flow.
    private func buildAndDeliverDNSResponse(
        dnsPayload: Data,
        srcIPBytes: [UInt8],   // original query source (device IP) — becomes response destination
        dstIPBytes: [UInt8],   // original query destination (Cloudflare IP) — becomes response source
        originalSrcPort: UInt16,
        protocolFamily: NSNumber
    ) {
        // UDP header (8 bytes): srcPort=53, dstPort=originalSrcPort, length, checksum
        let udpLength = UInt16(8 + dnsPayload.count)
        var udp = Data(capacity: 8)
        udp.append(0x00); udp.append(53)               // src port = 53
        udp.append(UInt8(originalSrcPort >> 8)); udp.append(UInt8(originalSrcPort & 0xFF))
        udp.append(UInt8(udpLength >> 8)); udp.append(UInt8(udpLength & 0xFF))
        udp.append(0x00); udp.append(0x00)             // checksum = 0 (optional for IPv4 UDP)
        udp.append(dnsPayload)

        // IPv4 header (20 bytes)
        let totalLength = UInt16(20 + udp.count)
        var ip = Data(count: 20)
        ip[0] = 0x45            // Version=4, IHL=5
        ip[1] = 0x00            // DSCP/ECN
        ip[2] = UInt8(totalLength >> 8)
        ip[3] = UInt8(totalLength & 0xFF)
        ip[4] = 0x00; ip[5] = 0x00   // ID
        ip[6] = 0x40; ip[7] = 0x00   // Flags=DF, Fragment offset=0
        ip[8] = 0x40            // TTL = 64
        ip[9] = 0x11            // Protocol = UDP
        ip[10] = 0x00; ip[11] = 0x00 // checksum placeholder
        // Source = Cloudflare (dstIPBytes), Destination = device (srcIPBytes)
        ip[12] = dstIPBytes[0]; ip[13] = dstIPBytes[1]; ip[14] = dstIPBytes[2]; ip[15] = dstIPBytes[3]
        ip[16] = srcIPBytes[0]; ip[17] = srcIPBytes[1]; ip[18] = srcIPBytes[2]; ip[19] = srcIPBytes[3]

        // Compute IP header checksum
        var checksum: UInt32 = 0
        for i in stride(from: 0, to: 20, by: 2) {
            checksum += UInt32(ip[i]) << 8 | UInt32(ip[i + 1])
        }
        while checksum > 0xFFFF { checksum = (checksum & 0xFFFF) + (checksum >> 16) }
        let cs = ~UInt16(checksum)
        ip[10] = UInt8(cs >> 8); ip[11] = UInt8(cs & 0xFF)

        let responsePacket = ip + udp
        os_log("forwardDNS: delivering %d-byte response packet to device", log: log, type: .info, responsePacket.count)
        packetFlow.writePackets([responsePacket], withProtocols: [protocolFamily])
    }

    // MARK: - Heartbeat

    private func startHeartbeat() {
        heartbeatTimer?.cancel()
        let timer = DispatchSource.makeTimerSource(queue: reportQueue)
        // Fire immediately, then repeat every 2 minutes
        timer.schedule(deadline: .now(), repeating: heartbeatInterval)
        timer.setEventHandler { [weak self] in self?.sendHeartbeat() }
        timer.resume()
        heartbeatTimer = timer
        os_log("Heartbeat timer started (interval=%.0fs)", log: log, type: .info, heartbeatInterval)
    }

    private func sendHeartbeat() {
        guard let defaults = UserDefaults(suiteName: BlocklistManager.appGroupID),
              let supabaseUrl = defaults.string(forKey: "supabaseUrl"),
              let userAccessToken = defaults.string(forKey: "userAccessToken"),
              let supabaseAnonKey = defaults.string(forKey: "supabaseAnonKey"),
              let userId = defaults.string(forKey: "userId"),
              !supabaseUrl.isEmpty, !userAccessToken.isEmpty, !userId.isEmpty
        else {
            os_log("Heartbeat skipped — no credentials in App Group", log: log, type: .debug)
            return
        }

        let urlString = "\(supabaseUrl)/functions/v1/ascension-api"
        guard let url = URL(string: urlString) else { return }

        let body: [String: Any] = [
            "action": "monitoring.heartbeat",
            "payload": ["user_id": userId, "status": "online", "platform": "ios"],
        ]
        guard let bodyData = try? JSONSerialization.data(withJSONObject: body) else { return }

        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("Bearer \(userAccessToken)", forHTTPHeaderField: "Authorization")
        request.setValue(supabaseAnonKey, forHTTPHeaderField: "apikey")
        request.httpBody = bodyData
        request.timeoutInterval = 15

        URLSession.shared.dataTask(with: request) { [weak self] _, response, error in
            guard let self = self else { return }
            if let error = error {
                os_log("Heartbeat failed: %{public}@", log: self.log, type: .error, error.localizedDescription)
                return
            }
            if let http = response as? HTTPURLResponse {
                os_log("Heartbeat → HTTP %d", log: self.log, type: .info, http.statusCode)
            }
        }.resume()
    }

    // MARK: - Partner Alert Reporting

    private let reportQueue = DispatchQueue(label: "app.getascension.vpn.report", qos: .utility)

    /// Call the Supabase edge function to log the block and alert the partner.
    /// Runs off the packet-processing path so it never delays DNS responses.
    /// On success, marks the entry as reported so the main app's sync loop skips it.
    private func reportBlockedDomain(_ domain: String, timestamp: TimeInterval) {
        reportQueue.async { [weak self] in
            guard let self = self,
                  let defaults = UserDefaults(suiteName: BlocklistManager.appGroupID),
                  let supabaseUrl = defaults.string(forKey: "supabaseUrl"),
                  let userAccessToken = defaults.string(forKey: "userAccessToken"),
                  let supabaseAnonKey = defaults.string(forKey: "supabaseAnonKey"),
                  let userId = defaults.string(forKey: "userId"),
                  !supabaseUrl.isEmpty, !userAccessToken.isEmpty, !userId.isEmpty
            else {
                os_log("No credentials in App Group — skipping direct report for %{public}@", log: self?.log ?? .default, type: .debug, domain)
                return
            }

            let urlString = "\(supabaseUrl)/functions/v1/ascension-api"
            guard let url = URL(string: urlString) else { return }

            let iso = ISO8601DateFormatter()
            let blockedAtStr = iso.string(from: Date(timeIntervalSince1970: timestamp))

            let body: [String: Any] = [
                "action": "blocked_attempts.logAndAlert",
                "payload": [
                    "user_id": userId,
                    "domain": domain,
                    "blocked_at": blockedAtStr,
                ],
            ]

            guard let bodyData = try? JSONSerialization.data(withJSONObject: body) else { return }

            var request = URLRequest(url: url)
            request.httpMethod = "POST"
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
            request.setValue("Bearer \(userAccessToken)", forHTTPHeaderField: "Authorization")
            request.setValue(supabaseAnonKey, forHTTPHeaderField: "apikey")
            request.httpBody = bodyData
            request.timeoutInterval = 15

            URLSession.shared.dataTask(with: request) { [weak self] _, response, error in
                if let error = error {
                    os_log("Direct report failed: %{public}@", log: self?.log ?? .default, type: .error, error.localizedDescription)
                    return
                }
                if let http = response as? HTTPURLResponse {
                    os_log("Direct report %{public}@ → HTTP %d", log: self?.log ?? .default, type: .info, domain, http.statusCode)
                    if http.statusCode == 200 {
                        BlocklistManager.shared.markAsReported(domain: domain, timestamp: timestamp)
                    }
                }
            }.resume()
        }
    }
}
