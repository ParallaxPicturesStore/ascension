package app.getascension.mobile

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Build
import android.util.Log
import app.getascension.mobile.vpn.AscensionVpnService

/**
 * Restarts the VPN content filter after the device reboots.
 *
 * The service saves its running state + blocklist to SharedPreferences before
 * each start (and clears the flag on an intentional stop). On boot, if the
 * flag is set we restore the blocklist and restart the service silently —
 * no user interaction needed because VPN permission was already granted.
 */
class BootReceiver : BroadcastReceiver() {

    companion object {
        private const val TAG = "BootReceiver"
    }

    override fun onReceive(context: Context, intent: Intent) {
        val action = intent.action ?: return
        if (action != Intent.ACTION_BOOT_COMPLETED &&
            action != "android.intent.action.QUICKBOOT_POWERON" &&
            action != "com.htc.intent.action.QUICKBOOT_POWERON"
        ) return

        val prefs = context.getSharedPreferences(
            AscensionVpnService.PREFS_NAME, Context.MODE_PRIVATE
        )

        if (!prefs.getBoolean(AscensionVpnService.PREFS_KEY_RUNNING, false)) {
            Log.d(TAG, "VPN was not running before reboot — skipping auto-start")
            return
        }

        Log.i(TAG, "Device booted — restarting Ascension VPN")

        val savedDomains = ArrayList(
            prefs.getStringSet(AscensionVpnService.PREFS_KEY_BLOCKLIST, emptySet()) ?: emptySet()
        )

        val vpnIntent = Intent(context, AscensionVpnService::class.java).apply {
            action = AscensionVpnService.ACTION_START
            putStringArrayListExtra(AscensionVpnService.EXTRA_DOMAINS, savedDomains)
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            context.startForegroundService(vpnIntent)
        } else {
            context.startService(vpnIntent)
        }
    }
}
