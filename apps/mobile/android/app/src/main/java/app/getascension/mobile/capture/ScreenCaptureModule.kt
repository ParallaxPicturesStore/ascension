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
import android.util.Log
import android.view.WindowManager
import com.facebook.react.bridge.*
import com.facebook.react.modules.core.DeviceEventManagerModule
import java.io.ByteArrayOutputStream

class ScreenCaptureModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext),
    ActivityEventListener {

    companion object {
        const val NAME = "ScreenCaptureModule"
        private const val TAG = "ScreenCaptureModule"
        private const val REQUEST_MEDIA_PROJECTION = 9001
        private const val DEFAULT_INTERVAL_MS = 60_000L
        private const val NOTIFICATION_CHANNEL_ID = "ascension_capture"
        private const val VIRTUAL_DISPLAY_NAME = "AscensionCapture"
    }

    private var mediaProjection: MediaProjection? = null
    private var virtualDisplay: VirtualDisplay? = null
    private var imageReader: ImageReader? = null
    private var captureIntervalMs: Long = DEFAULT_INTERVAL_MS
    private var isCapturing = false
    private var permissionDenied = false

    /** Timestamp of the last screenshot we actually encoded and emitted. */
    private var lastCaptureTimeMs = 0L

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
            Log.e(TAG, "startCapture: no current activity")
            promise.reject("E_NO_ACTIVITY", "No current activity")
            return
        }

        if (isCapturing) {
            Log.d(TAG, "startCapture: already capturing — resolving immediately")
            promise.resolve(true)
            return
        }

        cacheDisplayMetrics(activity)

        val projectionManager =
            activity.getSystemService(Context.MEDIA_PROJECTION_SERVICE) as MediaProjectionManager
        pendingPermissionPromise = promise
        Log.d(TAG, "startCapture: launching MediaProjection permission dialog")
        activity.startActivityForResult(
            projectionManager.createScreenCaptureIntent(),
            REQUEST_MEDIA_PROJECTION
        )
    }

    @ReactMethod
    fun stopCapture(promise: Promise) {
        Log.d(TAG, "stopCapture called")
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
        Log.d(TAG, "setInterval: ${captureIntervalMs}ms → ${intervalMs}ms")
        captureIntervalMs = intervalMs.toLong()
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
            Log.w(TAG, "MediaProjection permission denied by user")
            promise.reject("E_PERMISSION_DENIED", "User denied screen capture permission")
            return
        }

        permissionDenied = false
        Log.d(TAG, "MediaProjection permission granted — starting foreground service")

        startForegroundService(resultCode, data)

        val projectionManager =
            reactApplicationContext.getSystemService(Context.MEDIA_PROJECTION_SERVICE) as MediaProjectionManager
        mediaProjection = projectionManager.getMediaProjection(resultCode, data)

        mediaProjection?.registerCallback(object : MediaProjection.Callback() {
            override fun onStop() {
                Log.w(TAG, "MediaProjection stopped externally — tearing down")
                teardownCapture()
            }
        }, backgroundHandler)

        setupVirtualDisplay()

        isCapturing = true
        Log.d(TAG, "Capture active — interval=${captureIntervalMs}ms")
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
        Log.d(TAG, "Display: ${screenWidth}x${screenHeight} dpi=$screenDensity")
    }

    private fun setupVirtualDisplay() {
        // Half resolution is sufficient for content detection
        val captureWidth = screenWidth / 2
        val captureHeight = screenHeight / 2

        Log.d(TAG, "Creating ImageReader ${captureWidth}x${captureHeight}")

        // maxImages=3 gives headroom so the surface never stalls waiting for
        // slots to free up between captures.
        imageReader = ImageReader.newInstance(
            captureWidth, captureHeight, PixelFormat.RGBA_8888, 3
        )

        // Use a frame-available listener rather than a polling timer.
        // This fires for every frame the VirtualDisplay renders. We throttle
        // by elapsed time so we only encode+emit once per captureIntervalMs.
        // Every other frame is closed immediately to keep the buffer drained.
        imageReader!!.setOnImageAvailableListener({ reader ->
            val image = reader.acquireLatestImage()
            if (image == null) {
                Log.v(TAG, "acquireLatestImage returned null — skipping frame")
                return@setOnImageAvailableListener
            }

            val now = System.currentTimeMillis()
            val elapsed = now - lastCaptureTimeMs

            if (!isCapturing || elapsed < captureIntervalMs) {
                // Not time for a capture yet — drain the frame and move on
                image.close()
                return@setOnImageAvailableListener
            }

            lastCaptureTimeMs = now
            Log.d(TAG, "Interval elapsed (${elapsed}ms) — encoding screenshot")
            encodeAndEmit(image)
        }, backgroundHandler)

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

        if (virtualDisplay != null) {
            Log.d(TAG, "VirtualDisplay created successfully")
        } else {
            Log.e(TAG, "VirtualDisplay creation returned null — mediaProjection may have stopped")
        }
    }

    /**
     * Encode an already-acquired [Image] to JPEG base64 and emit it to JS.
     * Always closes the image in the finally block.
     */
    private fun encodeAndEmit(image: Image) {
        try {
            val plane = image.planes[0]
            val buffer = plane.buffer
            val pixelStride = plane.pixelStride
            val rowStride = plane.rowStride
            val rowPadding = rowStride - pixelStride * image.width

            val bitmap = Bitmap.createBitmap(
                image.width + rowPadding / pixelStride,
                image.height,
                Bitmap.Config.ARGB_8888
            )
            bitmap.copyPixelsFromBuffer(buffer)

            // Crop out the row padding
            val cropped = Bitmap.createBitmap(bitmap, 0, 0, image.width, image.height)
            if (cropped !== bitmap) bitmap.recycle()

            val stream = ByteArrayOutputStream()
            cropped.compress(Bitmap.CompressFormat.JPEG, 70, stream)
            cropped.recycle()

            val base64String = Base64.encodeToString(stream.toByteArray(), Base64.NO_WRAP)
            Log.d(TAG, "Encoded ${stream.size()} bytes — emitting onScreenshotCaptured to JS")

            val params = Arguments.createMap().apply {
                putString("base64", base64String)
                putDouble("timestamp", System.currentTimeMillis().toDouble())
            }

            reactApplicationContext
                .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                .emit("onScreenshotCaptured", params)
        } catch (e: Exception) {
            Log.e(TAG, "encodeAndEmit failed: ${e.message}", e)
        } finally {
            image.close()
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

        virtualDisplay?.release()
        virtualDisplay = null

        imageReader?.close()
        imageReader = null

        mediaProjection?.stop()
        mediaProjection = null

        stopForegroundService()
        Log.d(TAG, "Teardown complete")
    }

    override fun onCatalystInstanceDestroy() {
        teardownCapture()
        handlerThread.quitSafely()
        super.onCatalystInstanceDestroy()
    }
}
