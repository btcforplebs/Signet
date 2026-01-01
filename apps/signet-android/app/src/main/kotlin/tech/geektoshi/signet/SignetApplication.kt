package tech.geektoshi.signet

import android.app.Application
import android.app.NotificationChannel
import android.app.NotificationManager

class SignetApplication : Application() {

    override fun onCreate() {
        super.onCreate()
        createNotificationChannels()
    }

    private fun createNotificationChannels() {
        val notificationManager = getSystemService(NotificationManager::class.java)

        // Service channel (low priority, silent)
        val serviceChannel = NotificationChannel(
            SERVICE_CHANNEL_ID,
            getString(R.string.notification_channel_name),
            NotificationManager.IMPORTANCE_LOW
        ).apply {
            description = getString(R.string.notification_channel_description)
            setShowBadge(false)
        }

        // Alert channel (high priority, heads-up)
        val alertChannel = NotificationChannel(
            ALERT_CHANNEL_ID,
            getString(R.string.alert_channel_name),
            NotificationManager.IMPORTANCE_HIGH
        ).apply {
            description = getString(R.string.alert_channel_description)
            setShowBadge(true)
            enableVibration(true)
        }

        notificationManager.createNotificationChannel(serviceChannel)
        notificationManager.createNotificationChannel(alertChannel)
    }

    companion object {
        const val SERVICE_CHANNEL_ID = "signet_service"
        const val ALERT_CHANNEL_ID = "signet_alerts"
        const val SERVICE_NOTIFICATION_ID = 1
        const val ALERT_NOTIFICATION_ID = 2
    }
}
