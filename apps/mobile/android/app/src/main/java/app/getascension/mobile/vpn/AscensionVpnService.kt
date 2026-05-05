package app.getascension.mobile.vpn

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Intent
import android.content.SharedPreferences
import android.net.VpnService
import android.os.Build
import android.os.ParcelFileDescriptor
import android.util.Log
import androidx.core.app.NotificationCompat
import org.json.JSONArray
import org.json.JSONObject
import java.io.FileInputStream
import java.io.FileOutputStream
import java.net.DatagramPacket
import java.net.DatagramSocket
import java.net.InetAddress
import java.util.concurrent.atomic.AtomicBoolean

/**
 * Local DNS VPN service that intercepts all DNS queries and blocks
 * domains from the blocklist. All other traffic bypasses the VPN.
 *
 * Approach:
 *   - Creates a TUN interface addressed at 10.111.222.1/24
 *   - Overrides the device DNS server to point to our TUN address
 *   - Every DNS query (port 53 UDP) hits our TUN
 *   - Blocked domains → return 0.0.0.0 (A record) with TTL=60
 *   - Allowed domains → forward to Cloudflare 1.1.1.1 and relay response
 *   - Uses protect() so the upstream forwarding socket bypasses the VPN
 *
 * Play Store compliance:
 *   - Uses Android's official VpnService API (transparent to user)
 *   - User must approve the VPN permission dialog once
 *   - Persistent foreground notification while active
 *   - Does NOT route general TCP/HTTPS traffic through an external server
 *   - Category: Parental Controls / Family Safety
 */
class AscensionVpnService : VpnService() {

    companion object {
        const val ACTION_START = "app.getascension.vpn.START"
        const val ACTION_STOP = "app.getascension.vpn.STOP"
        const val ACTION_UPDATE_BLOCKLIST = "app.getascension.vpn.UPDATE_BLOCKLIST"
        const val EXTRA_DOMAINS = "domains"

        const val PREFS_NAME = "ascension_vpn"
        const val PREFS_KEY_RUNNING = "was_running"
        const val PREFS_KEY_BLOCKLIST = "blocklist"
        const val PREFS_KEY_BLOCKED_LOG = "blocked_log"
        const val PREFS_KEY_BLOCKED_COUNT = "blocked_count"

        private const val TAG = "AscensionVpnService"
        private const val TUN_ADDRESS = "10.111.222.1"
        private const val TUN_PREFIX = 24
        private const val UPSTREAM_DNS = "1.1.1.1"
        private const val DNS_PORT = 53
        private const val DNS_TIMEOUT_MS = 3000
        private const val MAX_PACKET = 4096
        private const val MAX_LOG_ENTRIES = 100
        private const val NOTIFICATION_ID = 7002
        private const val CHANNEL_ID = "ascension_vpn_protection"
        private const val CHANNEL_NAME = "Content Protection"

        // Read by VpnModule to expose status to JS without IPC overhead
        @Volatile
        var isRunning = false
    }

    private var vpnInterface: ParcelFileDescriptor? = null
    private val running = AtomicBoolean(false)
    private var readerThread: Thread? = null

    // Guarded only by the single reader thread after start, plus synchronized start/stop
    @Volatile
    private var blockedDomains: Set<String> = emptySet()

    private lateinit var prefs: SharedPreferences

    // ---- Lifecycle ----------------------------------------------------------

    override fun onCreate() {
        super.onCreate()
        prefs = getSharedPreferences(PREFS_NAME, MODE_PRIVATE)
        createNotificationChannel()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        return when (intent?.action) {
            ACTION_STOP -> {
                stopVpn()
                stopSelf()
                START_NOT_STICKY
            }
            ACTION_UPDATE_BLOCKLIST -> {
                val domains = intent.getStringArrayListExtra(EXTRA_DOMAINS) ?: emptyList<String>()
                applyBlocklist(domains.toHashSet())
                START_STICKY
            }
            else -> {
                val domains = intent?.getStringArrayListExtra(EXTRA_DOMAINS) ?: ArrayList()
                applyBlocklist(domains.toHashSet())
                startVpn()
                START_STICKY
            }
        }
    }

    override fun onRevoke() {
        // System revoked VPN (user turned it off in Settings)
        stopVpn()
        stopSelf()
    }

    override fun onDestroy() {
        stopVpn()
        super.onDestroy()
    }

    // ---- VPN start/stop -----------------------------------------------------

    private fun startVpn() {
        if (running.get()) return

        startForegroundNotification()

        val iface = try {
            Builder()
                .setSession("Ascension Protection")
                .addAddress(TUN_ADDRESS, TUN_PREFIX)
                .addDnsServer(TUN_ADDRESS)   // All DNS queries come to us
                .addRoute("10.111.222.0", TUN_PREFIX)  // Only our subnet routed through TUN
                .setMtu(1500)
                .setBlocking(true)
                .establish()
        } catch (e: Exception) {
            Log.e(TAG, "Failed to establish VPN: ${e.message}", e)
            stopSelf()
            return
        }

        if (iface == null) {
            Log.e(TAG, "VPN establish() returned null — permission not granted")
            stopSelf()
            return
        }

        vpnInterface = iface
        running.set(true)
        isRunning = true

        prefs.edit()
            .putBoolean(PREFS_KEY_RUNNING, true)
            .putStringSet(PREFS_KEY_BLOCKLIST, blockedDomains)
            .apply()

        readerThread = Thread({ runPacketLoop() }, "AscensionVpnReader").apply {
            isDaemon = true
            start()
        }

        Log.i(TAG, "VPN started — ${blockedDomains.size} blocked domains")
    }

    private fun stopVpn() {
        if (!running.compareAndSet(true, false)) return

        isRunning = false
        prefs.edit().putBoolean(PREFS_KEY_RUNNING, false).apply()

        try {
            vpnInterface?.close()
        } catch (e: Exception) {
            Log.w(TAG, "Error closing VPN interface: ${e.message}")
        }
        vpnInterface = null

        readerThread?.interrupt()
        readerThread = null

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
            stopForeground(STOP_FOREGROUND_REMOVE)
        } else {
            @Suppress("DEPRECATION")
            stopForeground(true)
        }

        Log.i(TAG, "VPN stopped")
    }

    private fun applyBlocklist(domains: Set<String>) {
        blockedDomains = domains
        prefs.edit().putStringSet(PREFS_KEY_BLOCKLIST, domains).apply()
        Log.d(TAG, "Blocklist updated: ${domains.size} domains")
    }

    // ---- Packet loop --------------------------------------------------------

    private fun runPacketLoop() {
        val fd = vpnInterface?.fileDescriptor ?: return
        val input = FileInputStream(fd)
        val output = FileOutputStream(fd)
        val buf = ByteArray(MAX_PACKET)

        Log.d(TAG, "Packet loop running")

        while (running.get()) {
            try {
                val len = input.read(buf)
                if (len <= 0) continue

                val response = processPacket(buf, len) ?: continue
                output.write(response)
            } catch (e: Exception) {
                if (running.get()) Log.w(TAG, "Packet loop error: ${e.message}")
            }
        }

        Log.d(TAG, "Packet loop exited")
    }

    // ---- Packet parsing and handling ----------------------------------------

    private fun processPacket(buf: ByteArray, len: Int): ByteArray? {
        if (len < 28) return null

        // IPv4 only
        val ipVersion = (buf[0].toInt() and 0xF0) shr 4
        if (ipVersion != 4) return null

        // UDP only (protocol 17)
        if (buf[9].toInt() and 0xFF != 17) return null

        val ihl = (buf[0].toInt() and 0x0F) * 4
        if (len < ihl + 8) return null

        // DNS destination port = 53
        val dstPort = ((buf[ihl + 2].toInt() and 0xFF) shl 8) or (buf[ihl + 3].toInt() and 0xFF)
        if (dstPort != DNS_PORT) return null

        val dnsOffset = ihl + 8
        if (len <= dnsOffset + 12) return null

        val dnsPayload = buf.copyOfRange(dnsOffset, len)
        val domain = parseDnsQueryName(dnsPayload) ?: return null

        Log.d(TAG, "DNS: $domain")

        return if (isDomainBlocked(domain)) {
            Log.i(TAG, "BLOCKED: $domain")
            logBlockedAttempt(domain)
            buildBlockResponse(buf, ihl, dnsPayload)
        } else {
            forwardUpstream(buf, ihl, dnsPayload)
        }
    }

    /** Parse the QNAME from a raw DNS payload (starts at byte 0 of the DNS header). */
    private fun parseDnsQueryName(dns: ByteArray): String? {
        if (dns.size < 12) return null
        var offset = 12  // Skip 12-byte DNS header
        val sb = StringBuilder()

        while (offset < dns.size) {
            val labelLen = dns[offset].toInt() and 0xFF
            if (labelLen == 0) break
            if (labelLen > 63) return null  // Compression pointer — can't follow without full message

            offset += 1
            if (offset + labelLen > dns.size) return null
            if (sb.isNotEmpty()) sb.append('.')
            sb.append(String(dns, offset, labelLen, Charsets.US_ASCII))
            offset += labelLen
        }

        return if (sb.isEmpty()) null else sb.toString().lowercase()
    }

    /** Exact match + parent-domain wildcard. "pornhub.com" blocks "www.pornhub.com" etc. */
    private fun isDomainBlocked(domain: String): Boolean {
        if (blockedDomains.contains(domain)) return true
        var d = domain
        while (d.contains('.')) {
            d = d.substringAfter('.')
            if (d.isNotEmpty() && blockedDomains.contains(d)) return true
        }
        return false
    }

    // ---- Block response -----------------------------------------------------

    private fun buildBlockResponse(origPacket: ByteArray, ihl: Int, dnsQuery: ByteArray): ByteArray? {
        val resp = dnsQuery.copyOf()

        // DNS flags: QR=1 (response), AA=1, RD copy, RA=1, RCODE=0
        resp[2] = 0x85.toByte()  // QR=1, AA=1, RD=1
        resp[3] = 0x80.toByte()  // RA=1, RCODE=0 (NOERROR with 0.0.0.0 answer)
        resp[6] = 0x00            // ANCOUNT high
        resp[7] = 0x01            // ANCOUNT low = 1

        // Find the end of the Question section
        var qEnd = 12
        while (qEnd < resp.size && resp[qEnd] != 0.toByte()) {
            qEnd += (resp[qEnd].toInt() and 0xFF) + 1
        }
        if (qEnd >= resp.size) return null
        qEnd += 1  // null terminator
        qEnd += 4  // QTYPE (2) + QCLASS (2)

        // A record answer pointing to 0.0.0.0
        val answer = byteArrayOf(
            0xC0.toByte(), 0x0C.toByte(),   // Name: pointer to offset 12
            0x00, 0x01,                      // Type A
            0x00, 0x01,                      // Class IN
            0x00, 0x00, 0x00, 0x3C,          // TTL = 60 s
            0x00, 0x04,                      // RDLENGTH = 4
            0x00, 0x00, 0x00, 0x00           // 0.0.0.0
        )

        val dnsResponse = resp.copyOfRange(0, qEnd) + answer
        return buildIpUdpPacket(origPacket, ihl, dnsResponse)
    }

    // ---- Upstream DNS forwarding --------------------------------------------

    private fun forwardUpstream(origPacket: ByteArray, ihl: Int, dnsQuery: ByteArray): ByteArray? {
        return try {
            val socket = DatagramSocket()
            protect(socket)  // Exempt from VPN routing so we don't loop

            socket.soTimeout = DNS_TIMEOUT_MS
            val upstream = InetAddress.getByName(UPSTREAM_DNS)
            socket.send(DatagramPacket(dnsQuery, dnsQuery.size, upstream, DNS_PORT))

            val respBuf = ByteArray(MAX_PACKET)
            val respPkt = DatagramPacket(respBuf, respBuf.size)
            socket.receive(respPkt)
            socket.close()

            val dnsResponse = respBuf.copyOf(respPkt.length)
            buildIpUdpPacket(origPacket, ihl, dnsResponse)
        } catch (e: Exception) {
            Log.w(TAG, "Upstream DNS failed: ${e.message}")
            null
        }
    }

    // ---- IP/UDP packet builder ----------------------------------------------

    /**
     * Build an IPv4/UDP response packet by:
     *  - Swapping source and destination IP addresses
     *  - Swapping source and destination UDP ports
     *  - Inserting [dnsPayload] as the new UDP body
     *  - Recalculating the IP header checksum
     */
    private fun buildIpUdpPacket(origPacket: ByteArray, ihl: Int, dnsPayload: ByteArray): ByteArray {
        val udpLen = 8 + dnsPayload.size
        val totalLen = ihl + udpLen
        val pkt = ByteArray(totalLen)

        // Copy IP header from original (we'll adjust specific fields)
        origPacket.copyInto(pkt, 0, 0, ihl)

        // Swap source and destination IP addresses
        origPacket.copyInto(pkt, 12, 16, 20)  // new src = original dst
        origPacket.copyInto(pkt, 16, 12, 16)  // new dst = original src

        // Update total length
        pkt[2] = ((totalLen shr 8) and 0xFF).toByte()
        pkt[3] = (totalLen and 0xFF).toByte()

        // Clear IP checksum (recalculated below)
        pkt[10] = 0
        pkt[11] = 0

        // UDP header: swap ports
        pkt[ihl + 0] = origPacket[ihl + 2]  // src port = original dst port (53)
        pkt[ihl + 1] = origPacket[ihl + 3]
        pkt[ihl + 2] = origPacket[ihl + 0]  // dst port = original src port (ephemeral)
        pkt[ihl + 3] = origPacket[ihl + 1]
        pkt[ihl + 4] = ((udpLen shr 8) and 0xFF).toByte()
        pkt[ihl + 5] = (udpLen and 0xFF).toByte()
        pkt[ihl + 6] = 0  // UDP checksum zeroed (valid in IPv4)
        pkt[ihl + 7] = 0

        // DNS payload
        dnsPayload.copyInto(pkt, ihl + 8)

        // Recalculate IP header checksum (one's complement sum)
        var sum = 0
        for (i in 0 until ihl step 2) {
            sum += ((pkt[i].toInt() and 0xFF) shl 8) or (pkt[i + 1].toInt() and 0xFF)
        }
        while (sum shr 16 != 0) sum = (sum and 0xFFFF) + (sum shr 16)
        val checksum = sum.inv() and 0xFFFF
        pkt[10] = ((checksum shr 8) and 0xFF).toByte()
        pkt[11] = (checksum and 0xFF).toByte()

        return pkt
    }

    // ---- Blocked attempt logging --------------------------------------------

    private fun logBlockedAttempt(domain: String) {
        try {
            val count = prefs.getInt(PREFS_KEY_BLOCKED_COUNT, 0)
            prefs.edit().putInt(PREFS_KEY_BLOCKED_COUNT, count + 1).apply()

            val rawLog = prefs.getString(PREFS_KEY_BLOCKED_LOG, "[]") ?: "[]"
            val log = JSONArray(rawLog)
            log.put(JSONObject().apply {
                put("domain", domain)
                put("timestamp", System.currentTimeMillis() / 1000.0)
            })

            // Keep only last 100 entries
            val trimmed = if (log.length() > MAX_LOG_ENTRIES) {
                JSONArray().also { arr ->
                    for (i in (log.length() - MAX_LOG_ENTRIES) until log.length()) arr.put(log[i])
                }
            } else log

            prefs.edit().putString(PREFS_KEY_BLOCKED_LOG, trimmed.toString()).apply()
        } catch (e: Exception) {
            Log.e(TAG, "Failed to log blocked attempt: ${e.message}")
        }
    }

    // ---- Notification -------------------------------------------------------

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID, CHANNEL_NAME, NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = "Shown while content filtering is active"
                setShowBadge(false)
            }
            getSystemService(NotificationManager::class.java)?.createNotificationChannel(channel)
        }
    }

    private fun startForegroundNotification() {
        val launchIntent = packageManager.getLaunchIntentForPackage(packageName)
        val pending = PendingIntent.getActivity(
            this, 0, launchIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val notification: Notification = NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("Ascension")
            .setContentText("Content filtering is active")
            .setSmallIcon(android.R.drawable.ic_lock_lock)
            .setOngoing(true)
            .setContentIntent(pending)
            .setCategory(NotificationCompat.CATEGORY_SERVICE)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .build()

        startForeground(NOTIFICATION_ID, notification)
    }
}
