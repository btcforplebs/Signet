package tech.geektoshi.signet.ui.components

import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.widget.Toast
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ContentCopy
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableLongStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import io.github.alexzhirkevich.qrose.rememberQrCodePainter
import androidx.compose.foundation.Image
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import tech.geektoshi.signet.data.api.SignetApiClient
import tech.geektoshi.signet.ui.theme.BgPrimary
import tech.geektoshi.signet.ui.theme.Danger
import tech.geektoshi.signet.ui.theme.SignetPurple
import tech.geektoshi.signet.ui.theme.TextMuted
import tech.geektoshi.signet.ui.theme.TextPrimary
import tech.geektoshi.signet.ui.theme.TextSecondary
import tech.geektoshi.signet.ui.theme.Warning
import java.time.Instant
import java.time.temporal.ChronoUnit

/**
 * Bottom sheet that displays a QR code for a bunker URI with countdown timer.
 *
 * @param keyName The key name to generate the bunker URI for
 * @param daemonUrl The daemon URL for API calls
 * @param onDismiss Called when the sheet is dismissed
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun BunkerURISheet(
    keyName: String,
    daemonUrl: String,
    onDismiss: () -> Unit
) {
    val context = LocalContext.current
    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)
    val scope = rememberCoroutineScope()

    var isLoading by remember { mutableStateOf(true) }
    var error by remember { mutableStateOf<String?>(null) }
    var bunkerUri by remember { mutableStateOf<String?>(null) }
    var expiresAt by remember { mutableStateOf<Instant?>(null) }
    var remainingSeconds by remember { mutableLongStateOf(0L) }

    // Generate token on first display
    LaunchedEffect(Unit) {
        generateToken(daemonUrl, keyName) { uri, expires, err ->
            bunkerUri = uri
            expiresAt = expires
            error = err
            isLoading = false
        }
    }

    // Countdown timer
    LaunchedEffect(expiresAt) {
        val expiry = expiresAt ?: return@LaunchedEffect
        while (true) {
            val now = Instant.now()
            val remaining = ChronoUnit.SECONDS.between(now, expiry)
            remainingSeconds = maxOf(0, remaining)
            if (remaining <= 0) break
            delay(1000)
        }
    }

    val isExpired = remainingSeconds <= 0 && expiresAt != null

    ModalBottomSheet(
        onDismissRequest = onDismiss,
        sheetState = sheetState,
        containerColor = BgPrimary
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 24.dp)
                .padding(bottom = 32.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            // Header
            Text(
                text = "Bunker URI",
                style = MaterialTheme.typography.headlineSmall,
                color = TextPrimary
            )

            Text(
                text = keyName,
                style = MaterialTheme.typography.bodyMedium,
                color = TextSecondary
            )

            Spacer(modifier = Modifier.height(8.dp))

            when {
                isLoading -> {
                    // Loading state
                    Box(
                        modifier = Modifier
                            .size(250.dp)
                            .clip(RoundedCornerShape(16.dp))
                            .background(Color.White),
                        contentAlignment = Alignment.Center
                    ) {
                        CircularProgressIndicator(
                            color = SignetPurple,
                            modifier = Modifier.size(48.dp)
                        )
                    }
                    Text(
                        text = "Generating...",
                        style = MaterialTheme.typography.bodyMedium,
                        color = TextMuted
                    )
                }

                error != null -> {
                    // Error state
                    Box(
                        modifier = Modifier
                            .size(250.dp)
                            .clip(RoundedCornerShape(16.dp))
                            .background(Color.White.copy(alpha = 0.1f)),
                        contentAlignment = Alignment.Center
                    ) {
                        Text(
                            text = error ?: "Error",
                            style = MaterialTheme.typography.bodyMedium,
                            color = Danger
                        )
                    }

                    Button(
                        onClick = {
                            isLoading = true
                            error = null
                            scope.launch {
                                generateToken(daemonUrl, keyName) { uri, expires, err ->
                                    bunkerUri = uri
                                    expiresAt = expires
                                    error = err
                                    isLoading = false
                                }
                            }
                        },
                        colors = ButtonDefaults.buttonColors(
                            containerColor = SignetPurple,
                            contentColor = TextPrimary
                        )
                    ) {
                        Icon(
                            imageVector = Icons.Default.Refresh,
                            contentDescription = null,
                            modifier = Modifier.size(18.dp)
                        )
                        Text(
                            text = "Retry",
                            modifier = Modifier.padding(start = 8.dp)
                        )
                    }
                }

                bunkerUri != null -> {
                    // QR code display
                    val qrPainter = rememberQrCodePainter(data = bunkerUri!!)

                    Box(
                        modifier = Modifier
                            .size(250.dp)
                            .clip(RoundedCornerShape(16.dp))
                            .background(Color.White)
                            .padding(16.dp),
                        contentAlignment = Alignment.Center
                    ) {
                        if (isExpired) {
                            // Expired overlay
                            Column(
                                horizontalAlignment = Alignment.CenterHorizontally,
                                verticalArrangement = Arrangement.Center
                            ) {
                                Text(
                                    text = "Expired",
                                    style = MaterialTheme.typography.titleLarge,
                                    color = Color.Gray
                                )
                            }
                        } else {
                            Image(
                                painter = qrPainter,
                                contentDescription = "Bunker URI QR Code",
                                modifier = Modifier.size(218.dp)
                            )
                        }
                    }

                    // Countdown timer
                    if (isExpired) {
                        Text(
                            text = "Token expired",
                            style = MaterialTheme.typography.bodyMedium,
                            color = Danger
                        )
                    } else {
                        val minutes = remainingSeconds / 60
                        val seconds = remainingSeconds % 60
                        val timerColor = if (remainingSeconds <= 60) Warning else TextSecondary

                        Text(
                            text = "Expires in ${minutes}:${seconds.toString().padStart(2, '0')}",
                            style = MaterialTheme.typography.bodyMedium,
                            color = timerColor
                        )
                    }

                    Spacer(modifier = Modifier.height(8.dp))

                    // Action buttons
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(12.dp)
                    ) {
                        if (isExpired) {
                            // Regenerate button when expired
                            Button(
                                onClick = {
                                    isLoading = true
                                    error = null
                                    scope.launch {
                                        generateToken(daemonUrl, keyName) { uri, expires, err ->
                                            bunkerUri = uri
                                            expiresAt = expires
                                            error = err
                                            isLoading = false
                                        }
                                    }
                                },
                                modifier = Modifier.fillMaxWidth(),
                                colors = ButtonDefaults.buttonColors(
                                    containerColor = SignetPurple,
                                    contentColor = TextPrimary
                                )
                            ) {
                                Icon(
                                    imageVector = Icons.Default.Refresh,
                                    contentDescription = null,
                                    modifier = Modifier.size(18.dp)
                                )
                                Text(
                                    text = "Generate New",
                                    modifier = Modifier.padding(start = 8.dp)
                                )
                            }
                        } else {
                            // Copy button
                            OutlinedButton(
                                onClick = {
                                    bunkerUri?.let { uri ->
                                        val clipboard = context.getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
                                        val clip = ClipData.newPlainText("Bunker URI", uri)
                                        clipboard.setPrimaryClip(clip)
                                        Toast.makeText(context, "Copied to clipboard", Toast.LENGTH_SHORT).show()
                                    }
                                },
                                modifier = Modifier.weight(1f)
                            ) {
                                Icon(
                                    imageVector = Icons.Default.ContentCopy,
                                    contentDescription = null,
                                    modifier = Modifier.size(18.dp)
                                )
                                Text(
                                    text = "Copy",
                                    modifier = Modifier.padding(start = 8.dp)
                                )
                            }

                            // Regenerate button
                            Button(
                                onClick = {
                                    isLoading = true
                                    error = null
                                    scope.launch {
                                        generateToken(daemonUrl, keyName) { uri, expires, err ->
                                            bunkerUri = uri
                                            expiresAt = expires
                                            error = err
                                            isLoading = false
                                        }
                                    }
                                },
                                modifier = Modifier.weight(1f),
                                colors = ButtonDefaults.buttonColors(
                                    containerColor = SignetPurple,
                                    contentColor = TextPrimary
                                )
                            ) {
                                Icon(
                                    imageVector = Icons.Default.Refresh,
                                    contentDescription = null,
                                    modifier = Modifier.size(18.dp)
                                )
                                Text(
                                    text = "New",
                                    modifier = Modifier.padding(start = 8.dp)
                                )
                            }
                        }
                    }
                }
            }

            Spacer(modifier = Modifier.height(16.dp))
        }
    }
}

private suspend fun generateToken(
    daemonUrl: String,
    keyName: String,
    onResult: (bunkerUri: String?, expiresAt: Instant?, error: String?) -> Unit
) {
    try {
        val client = SignetApiClient(daemonUrl)
        val result = client.generateConnectionToken(keyName)
        client.close()

        if (result.ok && result.bunkerUri != null) {
            val expiresAt = result.expiresAt?.let {
                try {
                    Instant.parse(it)
                } catch (e: Exception) {
                    Instant.now().plusSeconds(300) // Default 5 minutes
                }
            }
            onResult(result.bunkerUri, expiresAt, null)
        } else {
            onResult(null, null, result.error ?: "Failed to generate token")
        }
    } catch (e: Exception) {
        onResult(null, null, e.message ?: "Failed to generate token")
    }
}
