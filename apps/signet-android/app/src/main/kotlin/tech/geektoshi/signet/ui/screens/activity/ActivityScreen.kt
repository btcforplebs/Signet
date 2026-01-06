package tech.geektoshi.signet.ui.screens.activity

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.Inbox
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.FilterChipDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import tech.geektoshi.signet.data.api.ServerEvent
import tech.geektoshi.signet.data.api.SignetApiClient
import tech.geektoshi.signet.data.model.PendingRequest
import tech.geektoshi.signet.data.repository.EventBusRepository
import tech.geektoshi.signet.data.repository.SettingsRepository
import tech.geektoshi.signet.ui.components.BadgeStatus
import tech.geektoshi.signet.ui.components.EmptyState
import tech.geektoshi.signet.ui.components.RequestDetailSheet
import tech.geektoshi.signet.ui.components.SkeletonRequestCard
import tech.geektoshi.signet.ui.components.StatusBadge
import tech.geektoshi.signet.ui.components.pressScale
import tech.geektoshi.signet.ui.theme.BgSecondary
import tech.geektoshi.signet.ui.theme.BgTertiary
import tech.geektoshi.signet.ui.theme.Danger
import tech.geektoshi.signet.ui.theme.SignetPurple
import tech.geektoshi.signet.ui.theme.TextMuted
import tech.geektoshi.signet.ui.theme.TextPrimary
import tech.geektoshi.signet.ui.theme.TextSecondary
import tech.geektoshi.signet.util.DateGroup
import tech.geektoshi.signet.util.formatRelativeTime
import tech.geektoshi.signet.util.getDateGroup
import tech.geektoshi.signet.util.getMethodIcon
import tech.geektoshi.signet.util.getMethodLabelPastTense
import tech.geektoshi.signet.util.toDisplayString
import kotlinx.coroutines.launch

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ActivityScreen() {
    val context = LocalContext.current
    val settingsRepository = remember { SettingsRepository(context) }
    val daemonUrl by settingsRepository.daemonUrl.collectAsState(initial = "")

    var isLoading by remember { mutableStateOf(true) }
    var isRefreshing by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }
    var requests by remember { mutableStateOf<List<PendingRequest>>(emptyList()) }
    var selectedFilter by remember { mutableStateOf("all") }
    var selectedRequest by remember { mutableStateOf<PendingRequest?>(null) }
    var refreshCounter by remember { mutableIntStateOf(0) }
    val defaultTrustLevel by settingsRepository.defaultTrustLevel.collectAsState(initial = "reasonable")

    val filters = listOf("all", "approved", "denied", "expired")
    val listState = rememberLazyListState()
    val coroutineScope = rememberCoroutineScope()
    val eventBus = remember { EventBusRepository.getInstance() }

    // Connect to SSE when daemon URL is available
    LaunchedEffect(daemonUrl) {
        if (daemonUrl.isNotEmpty()) {
            eventBus.connect(daemonUrl)
        }
    }

    // Subscribe to SSE events for real-time updates
    LaunchedEffect(selectedFilter) {
        eventBus.events.collect { event ->
            when (event) {
                is ServerEvent.RequestApproved -> {
                    // If viewing 'all' or 'approved', refresh to show updated request
                    if (selectedFilter == "all" || selectedFilter == "approved") {
                        refreshCounter++
                    }
                }
                is ServerEvent.RequestDenied -> {
                    if (selectedFilter == "all" || selectedFilter == "denied") {
                        refreshCounter++
                    }
                }
                is ServerEvent.RequestExpired -> {
                    if (selectedFilter == "all" || selectedFilter == "expired") {
                        refreshCounter++
                    }
                }
                is ServerEvent.RequestAutoApproved -> {
                    if (selectedFilter == "all" || selectedFilter == "approved") {
                        refreshCounter++
                    }
                }
                else -> {}
            }
        }
    }

    // Show bottom sheet when a request is selected
    selectedRequest?.let { request ->
        RequestDetailSheet(
            request = request,
            daemonUrl = daemonUrl,
            defaultTrustLevel = defaultTrustLevel,
            onDismiss = { selectedRequest = null },
            onActionComplete = { refreshCounter++ }
        )
    }

    LaunchedEffect(daemonUrl, selectedFilter, refreshCounter) {
        if (daemonUrl.isNotEmpty()) {
            if (!isRefreshing) isLoading = true
            error = null
            try {
                val client = SignetApiClient(daemonUrl)
                requests = client.getRequests(status = selectedFilter, limit = 100).requests
                client.close()
            } catch (e: Exception) {
                error = e.message ?: "Failed to connect"
            } finally {
                isLoading = false
                isRefreshing = false
            }
        }
    }

    PullToRefreshBox(
        isRefreshing = isRefreshing,
        onRefresh = {
            isRefreshing = true
            refreshCounter++
        }
    ) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(16.dp)
        ) {
        Text(
            text = "Activity",
            style = MaterialTheme.typography.headlineMedium,
            color = MaterialTheme.colorScheme.onBackground,
            modifier = Modifier.clickable {
                coroutineScope.launch {
                    listState.animateScrollToItem(0)
                }
            }
        )

        Spacer(modifier = Modifier.height(16.dp))

        // Filter chips
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            filters.forEach { filter ->
                FilterChip(
                    selected = selectedFilter == filter,
                    onClick = { selectedFilter = filter },
                    label = {
                        Text(
                            text = filter.replaceFirstChar { it.uppercase() },
                            style = MaterialTheme.typography.labelMedium
                        )
                    },
                    colors = FilterChipDefaults.filterChipColors(
                        selectedContainerColor = SignetPurple.copy(alpha = 0.2f),
                        selectedLabelColor = SignetPurple,
                        containerColor = BgTertiary,
                        labelColor = TextSecondary
                    )
                )
            }
        }

        Spacer(modifier = Modifier.height(16.dp))

        if (isLoading) {
            Column(
                modifier = Modifier.fillMaxSize(),
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                SkeletonRequestCard()
                SkeletonRequestCard()
                SkeletonRequestCard()
                SkeletonRequestCard()
                SkeletonRequestCard()
            }
        } else if (error != null) {
            Box(
                modifier = Modifier.fillMaxSize(),
                contentAlignment = Alignment.Center
            ) {
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Text(
                        text = "Connection Error",
                        style = MaterialTheme.typography.titleLarge,
                        color = Danger
                    )
                    Spacer(modifier = Modifier.height(8.dp))
                    Text(
                        text = error!!,
                        style = MaterialTheme.typography.bodyMedium,
                        color = TextSecondary
                    )
                }
            }
        } else if (requests.isEmpty()) {
            EmptyState(
                icon = Icons.Outlined.Inbox,
                message = "No $selectedFilter requests"
            )
        } else {
            // Group requests by date
            val groupedRequests = requests.groupBy { getDateGroup(it.createdAt) }
            val orderedGroups = listOf(DateGroup.TODAY, DateGroup.YESTERDAY, DateGroup.THIS_WEEK, DateGroup.OLDER)

            LazyColumn(
                state = listState,
                verticalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                orderedGroups.forEach { group ->
                    val groupRequests = groupedRequests[group] ?: emptyList()
                    if (groupRequests.isNotEmpty()) {
                        item {
                            Text(
                                text = group.toDisplayString(),
                                style = MaterialTheme.typography.labelMedium,
                                color = TextMuted,
                                modifier = Modifier.padding(top = 8.dp, bottom = 4.dp)
                            )
                        }
                        items(groupRequests) { request ->
                            RequestCard(
                                request = request,
                                onClick = { selectedRequest = request }
                            )
                        }
                    }
                }
            }
        }
        }
    }
}

@Composable
private fun RequestCard(
    request: PendingRequest,
    onClick: () -> Unit
) {
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .pressScale(onClick = onClick),
        colors = CardDefaults.cardColors(containerColor = BgSecondary)
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(12.dp),
            verticalArrangement = Arrangement.spacedBy(4.dp)
        ) {
            // Header: App name + Status badge
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = request.appName ?: request.remotePubkey.take(12) + "...",
                    style = MaterialTheme.typography.titleSmall,
                    color = TextPrimary
                )
                StatusBadge(
                    status = when {
                        request.processedAt == null -> BadgeStatus.PENDING
                        request.allowed == false -> BadgeStatus.DENIED
                        request.allowed == true && request.approvalType == "manual" -> BadgeStatus.APPROVED
                        request.allowed == true && request.approvalType == "auto_trust" -> BadgeStatus.AUTO_TRUST
                        request.allowed == true && request.approvalType == "auto_permission" -> BadgeStatus.AUTO_PERMISSION
                        request.allowed == true && request.autoApproved -> BadgeStatus.AUTO_APPROVED  // Backwards compat
                        request.allowed == true -> BadgeStatus.APPROVED
                        else -> BadgeStatus.EXPIRED
                    }
                )
            }

            // Method icon + label
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(6.dp)
            ) {
                Icon(
                    imageVector = getMethodIcon(request.method),
                    contentDescription = null,
                    modifier = Modifier.size(14.dp),
                    tint = SignetPurple
                )
                Text(
                    text = getMethodLabelPastTense(request.method, request.eventPreview?.kind),
                    style = MaterialTheme.typography.bodySmall,
                    color = SignetPurple
                )
            }

            // Timestamp + Key name
            Text(
                text = "${formatRelativeTime(request.createdAt)} • ${request.keyName ?: "Unknown key"}",
                style = MaterialTheme.typography.labelSmall,
                color = TextMuted
            )
        }
    }
}

