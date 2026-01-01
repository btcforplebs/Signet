package tech.geektoshi.signet.data.api

import tech.geektoshi.signet.data.model.PendingRequest
import io.ktor.client.HttpClient
import io.ktor.client.engine.okhttp.OkHttp
import io.ktor.client.plugins.defaultRequest
import io.ktor.client.request.prepareGet
import io.ktor.client.statement.bodyAsChannel
import io.ktor.utils.io.readUTF8Line
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.flow
import kotlinx.coroutines.isActive
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import kotlin.coroutines.coroutineContext
import kotlin.math.min

/**
 * Server-Sent Event types matching the daemon's event-service.ts
 */
@Serializable
sealed class ServerEvent {
    @Serializable
    data class Connected(val type: String = "connected") : ServerEvent()

    @Serializable
    data class RequestCreated(
        val type: String = "request:created",
        val request: PendingRequest
    ) : ServerEvent()

    @Serializable
    data class RequestApproved(
        val type: String = "request:approved",
        val requestId: String
    ) : ServerEvent()

    @Serializable
    data class RequestDenied(
        val type: String = "request:denied",
        val requestId: String
    ) : ServerEvent()

    @Serializable
    data class RequestExpired(
        val type: String = "request:expired",
        val requestId: String
    ) : ServerEvent()

    @Serializable
    data class RequestAutoApproved(
        val type: String = "request:auto_approved"
    ) : ServerEvent()

    @Serializable
    data class StatsUpdated(
        val type: String = "stats:updated",
        val stats: Stats
    ) : ServerEvent() {
        @Serializable
        data class Stats(
            val pendingRequests: Int = 0,
            val totalKeys: Int = 0,
            val connectedApps: Int = 0
        )
    }

    @Serializable
    data class AppConnected(val type: String = "app:connected") : ServerEvent()

    @Serializable
    data class AppRevoked(
        val type: String = "app:revoked",
        val appId: Int
    ) : ServerEvent()

    @Serializable
    data class Unknown(val type: String) : ServerEvent()
}

/**
 * SSE client for receiving real-time events from the Signet daemon.
 *
 * Usage:
 * ```
 * val sseClient = SignetSSEClient(daemonUrl)
 * sseClient.events().collect { event ->
 *     when (event) {
 *         is ServerEvent.RequestCreated -> // handle new request
 *         is ServerEvent.StatsUpdated -> // update UI
 *     }
 * }
 * ```
 */
class SignetSSEClient(
    private val baseUrl: String
) {
    private val json = Json {
        ignoreUnknownKeys = true
        isLenient = true
    }

    private val client = HttpClient(OkHttp) {
        defaultRequest {
            url(baseUrl)
        }
    }

    companion object {
        private const val INITIAL_RECONNECT_DELAY = 1000L // 1 second
        private const val MAX_RECONNECT_DELAY = 30000L // 30 seconds
    }

    /**
     * Returns a Flow of ServerEvents. The flow will automatically reconnect
     * with exponential backoff on connection errors.
     *
     * The flow runs until cancelled.
     */
    fun events(): Flow<ServerEvent> = flow {
        var reconnectDelay = INITIAL_RECONNECT_DELAY

        while (coroutineContext.isActive) {
            try {
                client.prepareGet("/events").execute { response ->
                    // Reset reconnect delay on successful connection
                    reconnectDelay = INITIAL_RECONNECT_DELAY

                    val channel = response.bodyAsChannel()

                    while (!channel.isClosedForRead && coroutineContext.isActive) {
                        val line = channel.readUTF8Line()

                        when {
                            line == null -> break
                            line.startsWith("data: ") -> {
                                val data = line.removePrefix("data: ")
                                val event = parseEvent(data)
                                if (event != null) {
                                    emit(event)
                                }
                            }
                            line.startsWith(":") -> {
                                // Keep-alive comment, ignore
                            }
                            line.isEmpty() -> {
                                // Event separator, ignore
                            }
                        }
                    }
                }
            } catch (e: CancellationException) {
                throw e // Don't catch cancellation
            } catch (e: Exception) {
                // Connection error - will retry with backoff
            }

            // Reconnect with exponential backoff
            if (coroutineContext.isActive) {
                delay(reconnectDelay)
                reconnectDelay = min(reconnectDelay * 2, MAX_RECONNECT_DELAY)
            }
        }
    }

    private fun parseEvent(data: String): ServerEvent? {
        return try {
            // First, parse to get the type
            val typeRegex = """"type"\s*:\s*"([^"]+)"""".toRegex()
            val typeMatch = typeRegex.find(data)
            val type = typeMatch?.groupValues?.get(1) ?: return null

            when (type) {
                "connected" -> ServerEvent.Connected()
                "request:created" -> json.decodeFromString<ServerEvent.RequestCreated>(data)
                "request:approved" -> json.decodeFromString<ServerEvent.RequestApproved>(data)
                "request:denied" -> json.decodeFromString<ServerEvent.RequestDenied>(data)
                "request:expired" -> json.decodeFromString<ServerEvent.RequestExpired>(data)
                "request:auto_approved" -> ServerEvent.RequestAutoApproved()
                "stats:updated" -> json.decodeFromString<ServerEvent.StatsUpdated>(data)
                "app:connected" -> ServerEvent.AppConnected()
                "app:revoked" -> json.decodeFromString<ServerEvent.AppRevoked>(data)
                else -> ServerEvent.Unknown(type)
            }
        } catch (e: Exception) {
            null
        }
    }

    /**
     * Close the client and release resources.
     */
    fun close() {
        client.close()
    }
}
