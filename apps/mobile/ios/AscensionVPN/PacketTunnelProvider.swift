import NetworkExtension
import os.log

/// NEPacketTunnelProvider that intercepts DNS queries and blocks adult domains
/// by returning 0.0.0.0 for matched domains. All other traffic passes through.
class PacketTunnelProvider: NEPacketTunnelProvider {

    private let log = OSLog(subsystem: "app.getascension.vpn", category: "tunnel")
    private let blocklist = BlocklistManager.shared

    // MARK: - Tunnel Lifecycle

    override func startTunnel(options: [String: NSObject]?, completionHandler: @escaping (Error?) -> Void) {
        os_log("Starting Ascension DNS filter tunnel", log: log, type: .info)

        let settings = createTunnelSettings()
        setTunnelNetworkSettings(settings) { [weak self] error in
            if let error = error {
                os_log("Failed to set tunnel settings: %{public}@", log: self?.log ?? .default, type: .error, error.localizedDescription)
                completionHandler(error)
                return
            }

            os_log("Tunnel settings applied, starting DNS interception", log: self?.log ?? .default, type: .info)
            self?.readPackets()
            completionHandler(nil)
        }
    }

    override func stopTunnel(with reason: NEProviderStopReason, completionHandler: @escaping () -> Void) {
        os_log("Stopping Ascension DNS filter tunnel (reason: %d)", log: log, type: .info, reason.rawValue)
        completionHandler()
    }

    // MARK: - Tunnel Configuration

    private func createTunnelSettings() -> NEPacketTunnelNetworkSettings {
        // Use a non-routable address as the tunnel interface address
        let settings = NEPacketTunnelNetworkSettings(tunnelRemoteAddress: "127.0.0.1")

        // Configure the tunnel to only intercept DNS traffic
        // Route only DNS queries through the tunnel
        let ipv4Settings = NEIPv4Settings(addresses: ["10.0.0.1"], subnetMasks: ["255.255.255.0"])

        // Do NOT route all traffic - only DNS
        // We use includedRoutes with just the DNS server to minimize impact
        ipv4Settings.includedRoutes = [NEIPv4Route.default()]
        ipv4Settings.excludedRoutes = []
        settings.ipv4Settings = ipv4Settings

        // Cloudflare Family DNS — blocks adult content at the resolver level
        let dnsSettings = NEDNSSettings(servers: ["1.1.3.3", "1.0.0.3"])
        dnsSettings.matchDomains = [""] // Match all domains
        settings.dnsSettings = dnsSettings

        // MTU
        settings.mtu = 1400

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

        // We need at least an IP header (20 bytes) + UDP header (8 bytes) + DNS header (12 bytes)
        guard packet.count >= 40 else {
            // Too small to be a DNS packet, pass through
            packetFlow.writePackets([packet], withProtocols: [protocolFamily])
            return
        }

        // Check if this is a UDP packet (protocol 17) destined for port 53
        guard isUDPDNSQuery(packet) else {
            // Not a DNS query, pass through
            packetFlow.writePackets([packet], withProtocols: [protocolFamily])
            return
        }

        // Extract the domain name from the DNS query
        guard let domain = extractDomainFromDNS(packet) else {
            // Could not parse domain, pass through
            packetFlow.writePackets([packet], withProtocols: [protocolFamily])
            return
        }

        // Check against blocklist
        if blocklist.isDomainBlocked(domain) {
            os_log("BLOCKED: %{public}@", log: log, type: .info, domain)
            let blockTimestamp = Date().timeIntervalSince1970
            blocklist.logBlockedAttempt(domain: domain, timestamp: blockTimestamp)

            // Fire partner alert via Supabase — works even when the main app is closed
            reportBlockedDomain(domain, timestamp: blockTimestamp)

            // Craft a DNS response pointing to 0.0.0.0
            if let response = craftBlockedDNSResponse(originalPacket: packet) {
                packetFlow.writePackets([response], withProtocols: [protocolFamily])
            }
            return
        }

        // Domain is allowed, pass the packet through
        packetFlow.writePackets([packet], withProtocols: [protocolFamily])
    }

    // MARK: - DNS Parsing

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
