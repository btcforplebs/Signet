package tech.geektoshi.signet.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.ui.draw.clip
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Text
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import tech.geektoshi.signet.data.api.SignetApiClient
import tech.geektoshi.signet.data.model.ConnectedApp
import tech.geektoshi.signet.ui.theme.BgTertiary
import tech.geektoshi.signet.ui.theme.BorderDefault
import tech.geektoshi.signet.ui.theme.Danger
import tech.geektoshi.signet.ui.theme.SignetPurple
import tech.geektoshi.signet.ui.theme.Success
import tech.geektoshi.signet.ui.theme.TextMuted
import tech.geektoshi.signet.ui.theme.TextPrimary
import tech.geektoshi.signet.ui.theme.Warning
import tech.geektoshi.signet.util.formatRelativeTime
import kotlinx.coroutines.launch

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AppDetailSheet(
    app: ConnectedApp,
    daemonUrl: String,
    onDismiss: () -> Unit,
    onActionComplete: () -> Unit
) {
    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)
    val scope = rememberCoroutineScope()
    var isLoading by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }
    var appName by remember { mutableStateOf(app.description ?: "") }
    var selectedTrustLevel by remember { mutableStateOf(app.trustLevel) }
    var showRevokeConfirm by remember { mutableStateOf(false) }

    val hasChanges = appName != (app.description ?: "") || selectedTrustLevel != app.trustLevel

    ModalBottomSheet(
        onDismissRequest = onDismiss,
        sheetState = sheetState,
        containerColor = BgTertiary
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 24.dp)
                .padding(bottom = 32.dp)
                .verticalScroll(rememberScrollState()),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            // Header: App name + Trust level
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = app.description ?: "Unknown App",
                    style = MaterialTheme.typography.headlineSmall,
                    color = TextPrimary
                )
                TrustLevelBadge(trustLevel = app.trustLevel)
            }

            // Summary: key • requests • last used
            val lastUsed = app.lastUsedAt?.let { formatRelativeTime(it) }
            Text(
                text = listOfNotNull(
                    app.keyName,
                    "${app.requestCount} requests",
                    lastUsed
                ).joinToString(" • "),
                style = MaterialTheme.typography.bodyMedium,
                color = TextMuted
            )

            HorizontalDivider(color = TextMuted.copy(alpha = 0.2f))

            // Edit App Name
            Text(
                text = "App Name",
                style = MaterialTheme.typography.titleMedium,
                color = TextPrimary
            )

            OutlinedTextField(
                value = appName,
                onValueChange = { appName = it },
                placeholder = { Text("Enter a name for this app") },
                singleLine = true,
                modifier = Modifier.fillMaxWidth(),
                colors = OutlinedTextFieldDefaults.colors(
                    focusedBorderColor = SignetPurple,
                    unfocusedBorderColor = BorderDefault,
                    cursorColor = SignetPurple,
                    focusedTextColor = TextPrimary,
                    unfocusedTextColor = TextPrimary,
                    focusedPlaceholderColor = TextMuted,
                    unfocusedPlaceholderColor = TextMuted,
                    focusedContainerColor = BgTertiary,
                    unfocusedContainerColor = BgTertiary
                )
            )

            // Trust Level
            Text(
                text = "Trust Level",
                style = MaterialTheme.typography.titleMedium,
                color = TextPrimary
            )

            Column(
                verticalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                TrustLevelOption(
                    label = "Paranoid",
                    description = "Require approval for every request",
                    selected = selectedTrustLevel == "paranoid",
                    onClick = { selectedTrustLevel = "paranoid" }
                )
                TrustLevelOption(
                    label = "Reasonable",
                    description = "Auto-approve read operations",
                    selected = selectedTrustLevel == "reasonable",
                    onClick = { selectedTrustLevel = "reasonable" }
                )
                TrustLevelOption(
                    label = "Full",
                    description = "Auto-approve all requests",
                    selected = selectedTrustLevel == "full",
                    onClick = { selectedTrustLevel = "full" }
                )
            }

            // Error message
            error?.let {
                Text(
                    text = it,
                    style = MaterialTheme.typography.bodySmall,
                    color = Danger
                )
            }

            HorizontalDivider(color = TextMuted.copy(alpha = 0.2f))

            // Action buttons
            if (showRevokeConfirm) {
                Text(
                    text = "Are you sure you want to revoke this app's access?",
                    style = MaterialTheme.typography.bodyMedium,
                    color = TextPrimary
                )

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    OutlinedButton(
                        onClick = { showRevokeConfirm = false },
                        enabled = !isLoading,
                        modifier = Modifier.weight(1f)
                    ) {
                        Text("Cancel")
                    }

                    Button(
                        onClick = {
                            scope.launch {
                                isLoading = true
                                error = null
                                try {
                                    val client = SignetApiClient(daemonUrl)
                                    val result = client.revokeApp(app.id)
                                    client.close()
                                    if (result.ok) {
                                        onActionComplete()
                                        onDismiss()
                                    } else {
                                        error = result.error ?: "Failed to revoke"
                                    }
                                } catch (e: Exception) {
                                    error = e.message ?: "Failed to revoke"
                                } finally {
                                    isLoading = false
                                }
                            }
                        },
                        enabled = !isLoading,
                        modifier = Modifier.weight(1f),
                        colors = ButtonDefaults.buttonColors(
                            containerColor = Danger,
                            contentColor = TextPrimary
                        )
                    ) {
                        Text("Revoke")
                    }
                }
            } else {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    OutlinedButton(
                        onClick = { showRevokeConfirm = true },
                        enabled = !isLoading,
                        modifier = Modifier.weight(1f),
                        colors = ButtonDefaults.outlinedButtonColors(
                            contentColor = Danger
                        )
                    ) {
                        Text("Revoke")
                    }

                    Button(
                        onClick = {
                            scope.launch {
                                isLoading = true
                                error = null
                                try {
                                    val client = SignetApiClient(daemonUrl)
                                    val result = client.updateApp(
                                        id = app.id,
                                        description = if (appName != (app.description ?: "")) appName.ifBlank { null } else null,
                                        trustLevel = if (selectedTrustLevel != app.trustLevel) selectedTrustLevel else null
                                    )
                                    client.close()
                                    if (result.ok) {
                                        onActionComplete()
                                        onDismiss()
                                    } else {
                                        error = result.error ?: "Failed to update"
                                    }
                                } catch (e: Exception) {
                                    error = e.message ?: "Failed to update"
                                } finally {
                                    isLoading = false
                                }
                            }
                        },
                        enabled = !isLoading && hasChanges,
                        modifier = Modifier.weight(1f),
                        colors = ButtonDefaults.buttonColors(
                            containerColor = SignetPurple,
                            contentColor = TextPrimary
                        )
                    ) {
                        Text("Save")
                    }
                }
            }

            Spacer(modifier = Modifier.height(16.dp))
        }
    }
}

@Composable
private fun TrustLevelBadge(trustLevel: String) {
    val color = when (trustLevel.lowercase()) {
        "full" -> Success
        "reasonable" -> SignetPurple
        "paranoid" -> Warning
        else -> TextMuted
    }

    val label = when (trustLevel.lowercase()) {
        "full" -> "Full"
        "reasonable" -> "Reasonable"
        "paranoid" -> "Paranoid"
        else -> trustLevel
    }

    Text(
        text = label,
        style = MaterialTheme.typography.labelMedium,
        color = color
    )
}

@Composable
private fun TrustLevelOption(
    label: String,
    description: String,
    selected: Boolean,
    onClick: () -> Unit
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(8.dp))
            .border(
                width = 1.dp,
                color = if (selected) SignetPurple else BorderDefault,
                shape = RoundedCornerShape(8.dp)
            )
            .background(if (selected) SignetPurple.copy(alpha = 0.1f) else BgTertiary)
            .clickable(onClick = onClick)
            .padding(12.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        // Radio indicator
        Box(
            modifier = Modifier
                .size(20.dp)
                .border(
                    width = 2.dp,
                    color = if (selected) SignetPurple else TextMuted,
                    shape = CircleShape
                ),
            contentAlignment = Alignment.Center
        ) {
            if (selected) {
                Box(
                    modifier = Modifier
                        .size(10.dp)
                        .background(SignetPurple, CircleShape)
                )
            }
        }

        // Label and description
        Column {
            Text(
                text = label,
                style = MaterialTheme.typography.bodyMedium,
                color = TextPrimary
            )
            Text(
                text = description,
                style = MaterialTheme.typography.bodySmall,
                color = TextMuted
            )
        }
    }
}

