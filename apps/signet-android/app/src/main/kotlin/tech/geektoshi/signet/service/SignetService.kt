package tech.geektoshi.signet.service

import android.app.Notification
import android.app.PendingIntent
import android.app.Service
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.IBinder
import androidx.core.app.NotificationCompat
import tech.geektoshi.signet.MainActivity
import tech.geektoshi.signet.R
import tech.geektoshi.signet.SignetApplication
import tech.geektoshi.signet.data.api.ServerEvent
import tech.geektoshi.signet.data.repository.EventBusRepository
import tech.geektoshi.signet.data.repository.SettingsRepository
import tech.geektoshi.signet.util.getMethodLabel
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch

/**
 * Foreground service that maintains SSE connection to the Signet daemon.
 * Provides real-time notifications for pending signing requests.
 */
class SignetService : Service() {

    private val serviceScope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private var eventJob: Job? = null
    private var pendingCount = 0
    private var isConnected = false
    private val eventBus = EventBusRepository.getInstance()

    override fun onCreate() {
        super.onCreate()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        startForegroundWithNotification()
        startSSEConnection()
        return START_STICKY
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onDestroy() {
        eventJob?.cancel()
        serviceScope.cancel()
        super.onDestroy()
    }

    private fun startForegroundWithNotification() {
        val notification = createServiceNotification(ConnectionState.CONNECTING)

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
            startForeground(
                SignetApplication.SERVICE_NOTIFICATION_ID,
                notification,
                ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE
            )
        } else {
            startForeground(SignetApplication.SERVICE_NOTIFICATION_ID, notification)
        }
    }

    private fun startSSEConnection() {
        eventJob?.cancel()

        eventJob = serviceScope.launch {
            val settingsRepository = SettingsRepository(applicationContext)
            val daemonUrl = settingsRepository.daemonUrl.first()

            if (daemonUrl.isBlank()) {
                updateServiceNotification(ConnectionState.DISCONNECTED)
                return@launch
            }

            // Connect using shared EventBusRepository
            eventBus.connect(daemonUrl)

            // Subscribe to events for notifications
            eventBus.events.collect { event ->
                handleEvent(event)
            }
        }
    }

    private fun handleEvent(event: ServerEvent) {
        when (event) {
            is ServerEvent.Connected -> {
                isConnected = true
                updateServiceNotification(ConnectionState.CONNECTED)
            }

            is ServerEvent.RequestCreated -> {
                pendingCount++
                updateServiceNotification(ConnectionState.CONNECTED)
                showRequestNotification(event.request)
            }

            is ServerEvent.RequestApproved,
            is ServerEvent.RequestDenied,
            is ServerEvent.RequestExpired -> {
                if (pendingCount > 0) pendingCount--
                updateServiceNotification(ConnectionState.CONNECTED)
            }

            is ServerEvent.StatsUpdated -> {
                pendingCount = event.stats.pendingRequests
                updateServiceNotification(ConnectionState.CONNECTED)
            }

            else -> {
                // Other events don't affect notifications
            }
        }
    }

    private fun showRequestNotification(request: tech.geektoshi.signet.data.model.PendingRequest) {
        val intent = Intent(this, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
            putExtra("requestId", request.id)
        }
        val pendingIntent = PendingIntent.getActivity(
            this,
            request.id.hashCode(),
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val appName = request.appName ?: request.remotePubkey.take(12) + "..."
        val methodLabel = getMethodLabel(request.method, request.eventPreview?.kind)

        val text = getString(R.string.alert_new_request_text, appName, methodLabel.lowercase())

        val notification = NotificationCompat.Builder(this, SignetApplication.ALERT_CHANNEL_ID)
            .setContentTitle(getString(R.string.alert_new_request_title))
            .setContentText(text)
            .setSmallIcon(R.drawable.ic_notification)
            .setContentIntent(pendingIntent)
            .setAutoCancel(true)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setCategory(NotificationCompat.CATEGORY_MESSAGE)
            .build()

        val notificationManager = getSystemService(android.app.NotificationManager::class.java)
        // Use request ID hash to allow multiple notifications
        notificationManager.notify(
            SignetApplication.ALERT_NOTIFICATION_ID + request.id.hashCode(),
            notification
        )
    }

    private enum class ConnectionState {
        CONNECTING, CONNECTED, DISCONNECTED
    }

    private fun updateServiceNotification(state: ConnectionState) {
        val notification = createServiceNotification(state)
        val notificationManager = getSystemService(android.app.NotificationManager::class.java)
        notificationManager.notify(SignetApplication.SERVICE_NOTIFICATION_ID, notification)
    }

    private fun createServiceNotification(state: ConnectionState): Notification {
        val intent = Intent(this, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK
        }
        val pendingIntent = PendingIntent.getActivity(
            this,
            0,
            intent,
            PendingIntent.FLAG_IMMUTABLE
        )

        val text = when (state) {
            ConnectionState.CONNECTING -> getString(R.string.notification_text_connecting)
            ConnectionState.CONNECTED -> {
                if (pendingCount > 0) {
                    getString(R.string.notification_text_connected, pendingCount)
                } else {
                    getString(R.string.notification_text_no_pending)
                }
            }
            ConnectionState.DISCONNECTED -> getString(R.string.notification_text_disconnected)
        }

        return NotificationCompat.Builder(this, SignetApplication.SERVICE_CHANNEL_ID)
            .setContentTitle(getString(R.string.notification_title))
            .setContentText(text)
            .setSmallIcon(R.drawable.ic_notification)
            .setContentIntent(pendingIntent)
            .setOngoing(true)
            .setSilent(true)
            .build()
    }

    companion object {
        fun start(context: android.content.Context) {
            val intent = Intent(context, SignetService::class.java)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                context.startForegroundService(intent)
            } else {
                context.startService(intent)
            }
        }

        fun stop(context: android.content.Context) {
            val intent = Intent(context, SignetService::class.java)
            context.stopService(intent)
        }
    }
}
