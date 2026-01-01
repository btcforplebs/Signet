package tech.geektoshi.signet.ui.theme

import android.app.Activity
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.SideEffect
import androidx.compose.ui.platform.LocalView
import androidx.core.view.WindowCompat

private val SignetDarkColorScheme = darkColorScheme(
    primary = SignetPurple,
    onPrimary = TextPrimary,
    primaryContainer = SignetPurpleDark,
    onPrimaryContainer = TextPrimary,

    secondary = SignetPurpleLight,
    onSecondary = BgPrimary,
    secondaryContainer = BgTertiary,
    onSecondaryContainer = TextPrimary,

    tertiary = Info,
    onTertiary = TextPrimary,
    tertiaryContainer = BgTertiary,
    onTertiaryContainer = TextPrimary,

    error = Danger,
    onError = TextPrimary,
    errorContainer = Danger.copy(alpha = 0.2f),
    onErrorContainer = Danger,

    background = BgPrimary,
    onBackground = TextPrimary,

    surface = BgSecondary,
    onSurface = TextPrimary,
    surfaceVariant = BgTertiary,
    onSurfaceVariant = TextSecondary,

    outline = BorderDefault,
    outlineVariant = BorderHover,

    inverseSurface = TextPrimary,
    inverseOnSurface = BgPrimary,
    inversePrimary = SignetPurpleDark,

    surfaceTint = SignetPurple,
    scrim = BgPrimary.copy(alpha = 0.8f)
)

@Composable
fun SignetTheme(
    content: @Composable () -> Unit
) {
    val colorScheme = SignetDarkColorScheme
    val view = LocalView.current

    if (!view.isInEditMode) {
        SideEffect {
            val window = (view.context as Activity).window
            // Use dark status/navigation bar icons for dark theme
            WindowCompat.getInsetsController(window, view).apply {
                isAppearanceLightStatusBars = false
                isAppearanceLightNavigationBars = false
            }
        }
    }

    MaterialTheme(
        colorScheme = colorScheme,
        typography = Typography,
        content = content
    )
}
