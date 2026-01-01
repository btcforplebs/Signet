package tech.geektoshi.signet.service

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import tech.geektoshi.signet.data.repository.SettingsRepository
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch

/**
 * Receives boot completed broadcast to auto-start the Signet service.
 */
class BootReceiver : BroadcastReceiver() {

    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action == Intent.ACTION_BOOT_COMPLETED) {
            // Check if user has configured a daemon URL before starting
            CoroutineScope(Dispatchers.IO).launch {
                val settingsRepository = SettingsRepository(context)
                val daemonUrl = settingsRepository.daemonUrl.first()

                if (daemonUrl.isNotBlank()) {
                    SignetService.start(context)
                }
            }
        }
    }
}
