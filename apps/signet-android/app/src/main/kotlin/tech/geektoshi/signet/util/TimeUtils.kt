package tech.geektoshi.signet.util

import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.time.temporal.ChronoUnit

/**
 * Formats an ISO timestamp as a relative time string.
 * Examples: "Just now", "2m ago", "1h ago", "Yesterday", "Dec 25"
 */
fun formatRelativeTime(timestamp: String): String {
    return try {
        val instant = Instant.parse(timestamp)
        val now = Instant.now()
        val seconds = ChronoUnit.SECONDS.between(instant, now)
        val minutes = ChronoUnit.MINUTES.between(instant, now)
        val hours = ChronoUnit.HOURS.between(instant, now)
        val days = ChronoUnit.DAYS.between(instant, now)

        when {
            seconds < 60 -> "Just now"
            minutes < 60 -> "${minutes}m ago"
            hours < 24 -> "${hours}h ago"
            days == 1L -> "Yesterday"
            days < 7 -> "${days}d ago"
            else -> {
                val localDate = instant.atZone(ZoneId.systemDefault()).toLocalDate()
                val formatter = DateTimeFormatter.ofPattern("MMM d")
                localDate.format(formatter)
            }
        }
    } catch (e: Exception) {
        timestamp
    }
}

/**
 * Categorizes a timestamp into a date group for section headers.
 */
enum class DateGroup {
    TODAY,
    YESTERDAY,
    THIS_WEEK,
    OLDER
}

fun getDateGroup(timestamp: String): DateGroup {
    return try {
        val instant = Instant.parse(timestamp)
        val date = instant.atZone(ZoneId.systemDefault()).toLocalDate()
        val today = LocalDate.now()
        val yesterday = today.minusDays(1)
        val weekAgo = today.minusDays(7)

        when {
            date == today -> DateGroup.TODAY
            date == yesterday -> DateGroup.YESTERDAY
            date.isAfter(weekAgo) -> DateGroup.THIS_WEEK
            else -> DateGroup.OLDER
        }
    } catch (e: Exception) {
        DateGroup.OLDER
    }
}

fun DateGroup.toDisplayString(): String = when (this) {
    DateGroup.TODAY -> "Today"
    DateGroup.YESTERDAY -> "Yesterday"
    DateGroup.THIS_WEEK -> "This Week"
    DateGroup.OLDER -> "Older"
}
