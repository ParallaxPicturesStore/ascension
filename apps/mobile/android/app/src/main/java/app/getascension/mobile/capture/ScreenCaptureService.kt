package app.getascension.mobile.capture

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.IBinder
import android.os.PowerManager
import android.util.Log
import androidx.core.app.NotificationCompat

/**
 * Foreground service that keeps the MediaProjection session alive when the
 * app is backgrounded. Required on Android 10+ for background screen capture.
 *
 * Screen-lock handling:
 *   - Acquires a PARTIAL_WAKE_LOCK so the CPU stays alive when the screen is off.
 *     Without it, the background HandlerThread in ScreenCaptureModule can be
 *     suspended by Doze Mode, causing missed frames on some OEMs.
 *   - Listens for ACTION_SCREEN_OFF / ACTION_SCREEN_ON and sends a broadcast so
 *     the React layer can pause/resume analysis (no point analyzing a locked screen).
 */
class ScreenCaptureService : Service() {

    companion object {
        private const val TAG = "ScreenCaptureService"
        private const val NOTIFICATION_ID = 7001
        private const val CHANNEL_ID = "ascension_monitoring"
        private const val CHANNEL_NAME = "Screen Monitoring"

        /** Broadcast actions emitted to the app when screen state changes. */
        const val ACTION_SCREEN_STATE = "app.getascension.SCREEN_STATE"
        const val EXTRA_SCREEN_ON = "screen_on"
    }

    private var wakeLock: PowerManager.WakeLock? = null

    private val screenStateReceiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context, intent: Intent) {
            val screenOn = intent.action == Intent.ACTION_SCREEN_ON
            Log.d(TAG, "Screen ${if (screenOn) "ON" else "OFF"}")

            // Notify the React layer so MonitoringService can pause/resume capture analysis
            val broadcast = Intent(ACTION_SCREEN_STATE).apply {
                putExtra(EXTRA_SCREEN_ON, screenOn)
                setPackage(packageName)
            }
            sendBroadcast(broadcast)
        }
    }

    override fun onCreate() {
        super.onCreate()
        createNotificationChannel()
        registerScreenStateReceiver()
        acquireWakeLock()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        val notification = buildNotification()

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            startForeground(
                NOTIFICATION_ID,
                notification,
                ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PROJECTION
            )
        } else {
            startForeground(NOTIFICATION_ID, notification)
        }

        return START_STICKY
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onDestroy() {
        unregisterScreenStateReceiver()
        releaseWakeLock()
        stopForeground(STOP_FOREGROUND_REMOVE)
        super.onDestroy()
    }

    // ---- Wake lock ----------------------------------------------------------

    private fun acquireWakeLock() {
        try {
            val pm = getSystemService(Context.POWER_SERVICE) as PowerManager
            wakeLock = pm.newWakeLock(
                PowerManager.PARTIAL_WAKE_LOCK,
                "Ascension:ScreenCaptureWakeLock"
            ).also {
                it.setReferenceCounted(false)
                it.acquire(/* 12 hours */ 12 * 60 * 60 * 1000L)
            }
            Log.d(TAG, "Wake lock acquired")
        } catch (e: Exception) {
            Log.w(TAG, "Failed to acquire wake lock: ${e.message}")
        }
    }

    private fun releaseWakeLock() {
        try {
            if (wakeLock?.isHeld == true) {
                wakeLock?.release()
                Log.d(TAG, "Wake lock released")
            }
        } catch (e: Exception) {
            Log.w(TAG, "Error releasing wake lock: ${e.message}")
        }
        wakeLock = null
    }

    // ---- Screen state receiver ----------------------------------------------

    private fun registerScreenStateReceiver() {
        val filter = IntentFilter().apply {
            addAction(Intent.ACTION_SCREEN_ON)
            addAction(Intent.ACTION_SCREEN_OFF)
        }
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                registerReceiver(screenStateReceiver, filter, RECEIVER_NOT_EXPORTED)
            } else {
                registerReceiver(screenStateReceiver, filter)
            }
        } catch (e: Exception) {
            Log.w(TAG, "Could not register screen state receiver: ${e.message}")
        }
    }

    private fun unregisterScreenStateReceiver() {
        try {
            unregisterReceiver(screenStateReceiver)
        } catch (_: Exception) {}
    }

    // ---- Notification -------------------------------------------------------

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                CHANNEL_NAME,
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = "Persistent notification while screen monitoring is active"
                setShowBadge(false)
            }
            getSystemService(NotificationManager::class.java)?.createNotificationChannel(channel)
        }
    }

    private fun buildNotification(): Notification {
        val launchIntent = packageManager.getLaunchIntentForPackage(packageName)
        val pendingIntent = PendingIntent.getActivity(
            this,
            0,
            launchIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("Ascension")
            .setContentText("Ascension is monitoring your screen")
            .setSmallIcon(android.R.drawable.ic_menu_view)
            .setOngoing(true)
            .setContentIntent(pendingIntent)
            .setCategory(NotificationCompat.CATEGORY_SERVICE)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .build()
    }
}
