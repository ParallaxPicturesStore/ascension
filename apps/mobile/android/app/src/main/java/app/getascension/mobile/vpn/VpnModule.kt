package app.getascension.mobile.vpn

import android.app.Activity
import android.content.Context
import android.content.Intent
import android.net.VpnService
import android.os.Build
import android.util.Log
import com.facebook.react.bridge.*
import org.json.JSONArray

/**
 * React Native bridge for the Android VPN-based DNS blocker.
 *
 * JS interface mirrors the iOS VPNManagerModule so the same VPNManager.ts
 * wrapper works on both platforms.
 */
class VpnModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext),
    ActivityEventListener {

    companion object {
        const val NAME = "AndroidVpnModule"
        private const val TAG = "VpnModule"
        private const val VPN_PERMISSION_REQUEST = 9002
    }

    // Held while waiting for the system VPN permission dialog to resolve
    private var pendingStartPromise: Promise? = null
    private var pendingDomains: List<String> = emptyList()

    init {
        reactContext.addActivityEventListener(this)
    }

    override fun getName() = NAME

    // ---- JS-callable methods ------------------------------------------------

    /** Start the VPN with the supplied domain blocklist. */
    @ReactMethod
    fun startVPN(promise: Promise) {
        startVPNWithDomains(WritableNativeArray(), promise)
    }

    /** Start the VPN and apply [domainsArray] as the initial blocklist. */
    @ReactMethod
    fun startVPNWithDomains(domainsArray: ReadableArray, promise: Promise) {
        val activity = currentActivity
        if (activity == null) {
            promise.reject("E_NO_ACTIVITY", "No foreground activity")
            return
        }

        val domains = (0 until domainsArray.size()).map { domainsArray.getString(it) }

        val permIntent = VpnService.prepare(activity)
        if (permIntent != null) {
            // Need user to approve VPN permission dialog
            pendingStartPromise = promise
            pendingDomains = domains
            activity.startActivityForResult(permIntent, VPN_PERMISSION_REQUEST)
        } else {
            // Permission already granted — start immediately
            launchVpnService(domains, promise)
        }
    }

    /** Stop the VPN. */
    @ReactMethod
    fun stopVPN(promise: Promise) {
        val intent = Intent(reactApplicationContext, AscensionVpnService::class.java).apply {
            action = AscensionVpnService.ACTION_STOP
        }
        reactApplicationContext.startService(intent)
        promise.resolve(null)
    }

    /** Replace the active blocklist without restarting the VPN. */
    @ReactMethod
    fun updateBlocklist(domainsArray: ReadableArray, promise: Promise) {
        val domains = ArrayList<String>()
        for (i in 0 until domainsArray.size()) domains.add(domainsArray.getString(i))

        val intent = Intent(reactApplicationContext, AscensionVpnService::class.java).apply {
            action = AscensionVpnService.ACTION_UPDATE_BLOCKLIST
            putStringArrayListExtra(AscensionVpnService.EXTRA_DOMAINS, domains)
        }
        reactApplicationContext.startService(intent)
        promise.resolve(null)
    }

    /** Returns "connected" | "disconnected". */
    @ReactMethod
    fun getVPNStatus(promise: Promise) {
        promise.resolve(if (AscensionVpnService.isRunning) "connected" else "disconnected")
    }

    /** Total number of blocked domain attempts since last reset. */
    @ReactMethod
    fun getBlockedCount(promise: Promise) {
        val prefs = reactApplicationContext.getSharedPreferences(
            AscensionVpnService.PREFS_NAME, Context.MODE_PRIVATE
        )
        promise.resolve(prefs.getInt(AscensionVpnService.PREFS_KEY_BLOCKED_COUNT, 0))
    }

    /**
     * Returns an array of { domain: string, timestamp: number } objects,
     * newest last, capped at 100 entries.
     */
    @ReactMethod
    fun getRecentBlocked(promise: Promise) {
        val prefs = reactApplicationContext.getSharedPreferences(
            AscensionVpnService.PREFS_NAME, Context.MODE_PRIVATE
        )
        val rawLog = prefs.getString(AscensionVpnService.PREFS_KEY_BLOCKED_LOG, "[]") ?: "[]"
        try {
            val log = JSONArray(rawLog)
            val result = Arguments.createArray()
            for (i in 0 until log.length()) {
                val entry = log.getJSONObject(i)
                val map = Arguments.createMap()
                map.putString("domain", entry.getString("domain"))
                map.putDouble("timestamp", entry.getDouble("timestamp"))
                result.pushMap(map)
            }
            promise.resolve(result)
        } catch (e: Exception) {
            Log.e(TAG, "getRecentBlocked parse error: ${e.message}")
            promise.resolve(Arguments.createArray())
        }
    }

    // Required by NativeEventEmitter
    @ReactMethod
    fun addListener(eventName: String?) {}

    @ReactMethod
    fun removeListeners(count: Int?) {}

    // ---- ActivityEventListener ----------------------------------------------

    override fun onActivityResult(
        activity: Activity?,
        requestCode: Int,
        resultCode: Int,
        data: Intent?
    ) {
        if (requestCode != VPN_PERMISSION_REQUEST) return

        val promise = pendingStartPromise ?: return
        pendingStartPromise = null
        val domains = pendingDomains
        pendingDomains = emptyList()

        if (resultCode == Activity.RESULT_OK) {
            launchVpnService(domains, promise)
        } else {
            Log.w(TAG, "VPN permission denied by user")
            promise.reject("E_VPN_DENIED", "User denied VPN permission")
        }
    }

    override fun onNewIntent(intent: Intent?) {}

    // ---- Internal -----------------------------------------------------------

    private fun launchVpnService(domains: List<String>, promise: Promise) {
        val intent = Intent(reactApplicationContext, AscensionVpnService::class.java).apply {
            action = AscensionVpnService.ACTION_START
            putStringArrayListExtra(AscensionVpnService.EXTRA_DOMAINS, ArrayList(domains))
        }

        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                reactApplicationContext.startForegroundService(intent)
            } else {
                reactApplicationContext.startService(intent)
            }
            promise.resolve(true)
        } catch (e: Exception) {
            Log.e(TAG, "Failed to start VPN service: ${e.message}", e)
            promise.reject("E_VPN_START", "Failed to start VPN: ${e.message}")
        }
    }
}
