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
    @Volatile private var isCapturing = false
    @Volatile private var isTearingDown = false
    private var permissionDenied = false

    /** Timestamp of the last screenshot we actually encoded and emitted. */
    @Volatile private var lastCaptureTimeMs = 0L

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

        // Android 14+ requires a foreground service of type FOREGROUND_SERVICE_TYPE_MEDIA_PROJECTION
        // to be *already running* before getMediaProjection() is called. Start it now so the
        // service has time to call startForeground() before the user dismisses the consent dialog.
        startForegroundService()

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
            stopForegroundService() // service was started in startCapture; clean it up
            Log.w(TAG, "MediaProjection permission denied by user")
            promise.reject("E_PERMISSION_DENIED", "User denied screen capture permission")
            return
        }

        try {
            permissionDenied = false
            Log.d(TAG, "MediaProjection permission granted — foreground service already running")

            val projectionManager =
                reactApplicationContext.getSystemService(Context.MEDIA_PROJECTION_SERVICE) as? MediaProjectionManager
            if (projectionManager == null) {
                promise.reject("E_NO_PROJECTION_MANAGER", "MediaProjectionManager unavailable")
                return
            }

            val projection = projectionManager.getMediaProjection(resultCode, data)
            if (projection == null) {
                Log.e(TAG, "getMediaProjection returned null — token may have expired")
                stopForegroundService()
                promise.reject("E_PROJECTION_NULL", "Failed to obtain MediaProjection token")
                return
            }

            mediaProjection = projection

            projection.registerCallback(object : MediaProjection.Callback() {
                override fun onStop() {
                    Log.w(TAG, "MediaProjection stopped externally — tearing down")
                    teardownCapture()
                }
            }, backgroundHandler)

            setupVirtualDisplay()

            if (virtualDisplay == null) {
                Log.e(TAG, "VirtualDisplay is null after setup — aborting capture")
                teardownCapture()
                promise.reject("E_VIRTUAL_DISPLAY", "Failed to create virtual display")
                return
            }

            isCapturing = true
            Log.d(TAG, "Capture active — interval=${captureIntervalMs}ms")
            promise.resolve(true)
        } catch (e: Exception) {
            Log.e(TAG, "Failed to start screen capture after permission grant: ${e.message}", e)
            teardownCapture()
            promise.reject("E_START_FAILED", "Screen capture start failed: ${e.message}")
        }
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
        if (screenWidth <= 0 || screenHeight <= 0) {
            Log.e(TAG, "setupVirtualDisplay: invalid display dimensions ${screenWidth}x${screenHeight}")
            return
        }

        val captureWidth = (screenWidth / 2).coerceAtLeast(1)
        val captureHeight = (screenHeight / 2).coerceAtLeast(1)

        Log.d(TAG, "Creating ImageReader ${captureWidth}x${captureHeight}")

        val reader = ImageReader.newInstance(captureWidth, captureHeight, PixelFormat.RGBA_8888, 3)
        imageReader = reader

        reader.setOnImageAvailableListener({ frameReader ->
            if (isTearingDown) return@setOnImageAvailableListener

            val image = frameReader.acquireLatestImage()
            if (image == null) {
                Log.v(TAG, "acquireLatestImage returned null — skipping frame")
                return@setOnImageAvailableListener
            }

            val now = System.currentTimeMillis()
            val elapsed = now - lastCaptureTimeMs

            if (!isCapturing || elapsed < captureIntervalMs) {
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
            reader.surface,
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

    private fun startForegroundService() {
        val serviceIntent = Intent(reactApplicationContext, ScreenCaptureService::class.java)
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
        if (isTearingDown) return
        isTearingDown = true
        isCapturing = false

        // Remove the listener first so no new frame callbacks are queued after this point.
        // Any callback already running will see isTearingDown=true and return early,
        // and acquired Images remain valid until their own close() is called.
        try { imageReader?.setOnImageAvailableListener(null, null) } catch (_: Exception) {}

        // Post resource release to the background handler so it runs after any
        // in-flight frame callback on that thread has finished.
        backgroundHandler.post {
            try {
                virtualDisplay?.release()
                virtualDisplay = null

                imageReader?.close()
                imageReader = null

                mediaProjection?.stop()
                mediaProjection = null
            } catch (e: Exception) {
                Log.e(TAG, "Error during teardown: ${e.message}", e)
            } finally {
                isTearingDown = false
                stopForegroundService()
                Log.d(TAG, "Teardown complete")
            }
        }
    }

    override fun onCatalystInstanceDestroy() {
        // Synchronous teardown required here because the context is about to be destroyed.
        isTearingDown = true
        isCapturing = false
        try { imageReader?.setOnImageAvailableListener(null, null) } catch (_: Exception) {}
        try { virtualDisplay?.release() } catch (_: Exception) {}
        try { imageReader?.close() } catch (_: Exception) {}
        try { mediaProjection?.stop() } catch (_: Exception) {}
        virtualDisplay = null
        imageReader = null
        mediaProjection = null
        stopForegroundService()
        handlerThread.quitSafely()
        super.onCatalystInstanceDestroy()
    }
}
