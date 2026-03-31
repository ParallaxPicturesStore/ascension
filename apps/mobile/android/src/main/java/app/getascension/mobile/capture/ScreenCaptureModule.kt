package app.getascension.mobile.capture

import android.app.Activity
import android.content.Context
import android.content.Intent
import android.graphics.Bitmap
import android.graphics.PixelFormat
import android.hardware.display.DisplayManager
import android.hardware.display.VirtualDisplay
import android.media.Image
import android.media.ImageReader
import android.media.projection.MediaProjection
import android.media.projection.MediaProjectionManager
import android.os.Build
import android.os.Handler
import android.os.HandlerThread
import android.util.Base64
import android.util.DisplayMetrics
import android.view.WindowManager
import com.facebook.react.bridge.*
import com.facebook.react.modules.core.DeviceEventManagerModule
import java.io.ByteArrayOutputStream
import java.util.Timer
import java.util.TimerTask

class ScreenCaptureModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext),
    ActivityEventListener {

    companion object {
        const val NAME = "ScreenCaptureModule"
        private const val REQUEST_MEDIA_PROJECTION = 9001
        private const val DEFAULT_INTERVAL_MS = 60_000L
        private const val NOTIFICATION_CHANNEL_ID = "ascension_capture"
        private const val VIRTUAL_DISPLAY_NAME = "AscensionCapture"
    }

    private var mediaProjection: MediaProjection? = null
    private var virtualDisplay: VirtualDisplay? = null
    private var imageReader: ImageReader? = null
    private var captureTimer: Timer? = null
    private var captureIntervalMs: Long = DEFAULT_INTERVAL_MS
    private var isCapturing = false
    private var permissionDenied = false

    // Promise kept while waiting for the user to grant MediaProjection permission
    private var pendingPermissionPromise: Promise? = null

    // Background thread for image processing
    private val handlerThread = HandlerThread("ScreenCaptureThread").apply { start() }
    private val backgroundHandler = Handler(handlerThread.looper)

    // Display metrics cached on first use
    private var screenWidth = 0
    private var screenHeight = 0
    private var screenDensity = 0

    init {
        reactContext.addActivityEventListener(this)
    }

    override fun getName(): String = NAME

    // ---------------------------------------------------------------------------
    // React Native bridge methods
    // ---------------------------------------------------------------------------

    @ReactMethod
    fun startCapture(promise: Promise) {
        val activity = currentActivity
        if (activity == null) {
            promise.reject("E_NO_ACTIVITY", "No current activity")
            return
        }

        if (isCapturing) {
            promise.resolve(true)
            return
        }

        // Cache display metrics
        cacheDisplayMetrics(activity)

        // Request MediaProjection permission - shows system dialog
        val projectionManager =
            activity.getSystemService(Context.MEDIA_PROJECTION_SERVICE) as MediaProjectionManager
        pendingPermissionPromise = promise
        activity.startActivityForResult(
            projectionManager.createScreenCaptureIntent(),
            REQUEST_MEDIA_PROJECTION
        )
    }

    @ReactMethod
    fun stopCapture(promise: Promise) {
        teardownCapture()
        promise.resolve(null)
    }

    @ReactMethod
    fun getCaptureStatus(promise: Promise) {
        val status = when {
            permissionDenied -> "permission_denied"
            isCapturing -> "active"
            else -> "inactive"
        }
        promise.resolve(status)
    }

    @ReactMethod
    fun setInterval(intervalMs: Int) {
        captureIntervalMs = intervalMs.toLong()
        // If already capturing, restart the timer with the new interval
        if (isCapturing) {
            captureTimer?.cancel()
            scheduleCaptureTimer()
        }
    }

    // Required for RN NativeEventEmitter compatibility
    @ReactMethod
    fun addListener(eventName: String?) { /* no-op */ }

    @ReactMethod
    fun removeListeners(count: Int?) { /* no-op */ }

    // ---------------------------------------------------------------------------
    // Activity result handling (MediaProjection consent dialog)
    // ---------------------------------------------------------------------------

    override fun onActivityResult(
        activity: Activity?,
        requestCode: Int,
        resultCode: Int,
        data: Intent?
    ) {
        if (requestCode != REQUEST_MEDIA_PROJECTION) return

        val promise = pendingPermissionPromise ?: return
        pendingPermissionPromise = null

        if (resultCode != Activity.RESULT_OK || data == null) {
            permissionDenied = true
            promise.reject("E_PERMISSION_DENIED", "User denied screen capture permission")
            return
        }

        permissionDenied = false

        // Start the foreground service first (required on Android 10+)
        startForegroundService(resultCode, data)

        // Obtain MediaProjection
        val projectionManager =
            reactApplicationContext.getSystemService(Context.MEDIA_PROJECTION_SERVICE) as MediaProjectionManager
        mediaProjection = projectionManager.getMediaProjection(resultCode, data)

        mediaProjection?.registerCallback(object : MediaProjection.Callback() {
            override fun onStop() {
                teardownCapture()
            }
        }, backgroundHandler)

        // Set up the virtual display + image reader
        setupVirtualDisplay()

        // Schedule periodic captures
        scheduleCaptureTimer()

        isCapturing = true
        promise.resolve(true)
    }

    override fun onNewIntent(intent: Intent?) { /* no-op */ }

    // ---------------------------------------------------------------------------
    // Capture internals
    // ---------------------------------------------------------------------------

    private fun cacheDisplayMetrics(activity: Activity) {
        val wm = activity.getSystemService(Context.WINDOW_SERVICE) as WindowManager
        val metrics = DisplayMetrics()

        @Suppress("DEPRECATION")
        wm.defaultDisplay.getRealMetrics(metrics)

        screenWidth = metrics.widthPixels
        screenHeight = metrics.heightPixels
        screenDensity = metrics.densityDpi
    }

    private fun setupVirtualDisplay() {
        // Down-scale to save memory/CPU. Half resolution is plenty for NSFW detection.
        val captureWidth = screenWidth / 2
        val captureHeight = screenHeight / 2

        imageReader = ImageReader.newInstance(
            captureWidth,
            captureHeight,
            PixelFormat.RGBA_8888,
            2 // maxImages buffer
        )

        virtualDisplay = mediaProjection?.createVirtualDisplay(
            VIRTUAL_DISPLAY_NAME,
            captureWidth,
            captureHeight,
            screenDensity,
            DisplayManager.VIRTUAL_DISPLAY_FLAG_AUTO_MIRROR,
            imageReader!!.surface,
            null,
            backgroundHandler
        )
    }

    private fun scheduleCaptureTimer() {
        captureTimer = Timer("AscensionCaptureTimer", true)
        captureTimer?.scheduleAtFixedRate(object : TimerTask() {
            override fun run() {
                captureScreenshot()
            }
        }, captureIntervalMs, captureIntervalMs)
    }

    private fun captureScreenshot() {
        val reader = imageReader ?: return
        var image: Image? = null

        try {
            image = reader.acquireLatestImage() ?: return

            val plane = image.planes[0]
            val buffer = plane.buffer
            val pixelStride = plane.pixelStride
            val rowStride = plane.rowStride
            val rowPadding = rowStride - pixelStride * image.width

            // Create bitmap from the image buffer
            val bitmap = Bitmap.createBitmap(
                image.width + rowPadding / pixelStride,
                image.height,
                Bitmap.Config.ARGB_8888
            )
            bitmap.copyPixelsFromBuffer(buffer)

            // Crop to actual screen dimensions (remove row padding)
            val croppedBitmap = Bitmap.createBitmap(bitmap, 0, 0, image.width, image.height)
            if (croppedBitmap !== bitmap) {
                bitmap.recycle()
            }

            // Compress to JPEG and convert to base64
            val stream = ByteArrayOutputStream()
            croppedBitmap.compress(Bitmap.CompressFormat.JPEG, 70, stream)
            croppedBitmap.recycle()

            val base64String = Base64.encodeToString(stream.toByteArray(), Base64.NO_WRAP)

            // Emit event to JS layer
            val params = Arguments.createMap().apply {
                putString("base64", base64String)
                putDouble("timestamp", System.currentTimeMillis().toDouble())
            }

            reactApplicationContext
                .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                .emit("onScreenshotCaptured", params)
        } catch (e: Exception) {
            // Silently skip this frame - the next timer tick will retry
        } finally {
            image?.close()
        }
    }

    // ---------------------------------------------------------------------------
    // Foreground service management
    // ---------------------------------------------------------------------------

    private fun startForegroundService(resultCode: Int, data: Intent) {
        val serviceIntent = Intent(reactApplicationContext, ScreenCaptureService::class.java).apply {
            putExtra("resultCode", resultCode)
            putExtra("data", data)
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            reactApplicationContext.startForegroundService(serviceIntent)
        } else {
            reactApplicationContext.startService(serviceIntent)
        }
    }

    private fun stopForegroundService() {
        val serviceIntent = Intent(reactApplicationContext, ScreenCaptureService::class.java)
        reactApplicationContext.stopService(serviceIntent)
    }

    // ---------------------------------------------------------------------------
    // Teardown
    // ---------------------------------------------------------------------------

    private fun teardownCapture() {
        isCapturing = false

        captureTimer?.cancel()
        captureTimer = null

        virtualDisplay?.release()
        virtualDisplay = null

        imageReader?.close()
        imageReader = null

        mediaProjection?.stop()
        mediaProjection = null

        stopForegroundService()
    }

    override fun onCatalystInstanceDestroy() {
        teardownCapture()
        handlerThread.quitSafely()
        super.onCatalystInstanceDestroy()
    }
}
