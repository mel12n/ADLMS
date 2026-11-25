package cl.unab.adlms.deephalo

import android.annotation.SuppressLint
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.util.Log
import android.webkit.ConsoleMessage
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebView
import androidx.activity.ComponentActivity

class MainActivity : ComponentActivity() {

    private lateinit var fileChooserHelper: FileChooserHelper
    private lateinit var exportBridge: ExportBridge
    private var webView: WebView? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        fileChooserHelper = FileChooserHelper(this)
        exportBridge = ExportBridge(this)
        createAndBindWebView()
    }

    @SuppressLint("SetJavaScriptEnabled")
    private fun createAndBindWebView() {
        WebView.setWebContentsDebuggingEnabled(true)
        val view = WebView(this).apply {
            settings.javaScriptEnabled = true
            settings.domStorageEnabled = true
            settings.allowFileAccess = false
            settings.allowContentAccess = true
            webViewClient = EdgeAssetClient(this@MainActivity) { recreateWebView() }
            webChromeClient = object : WebChromeClient() {
                override fun onShowFileChooser(
                    webView: WebView?,
                    filePathCallback: ValueCallback<Array<Uri>>?,
                    fileChooserParams: FileChooserParams?,
                ): Boolean = fileChooserHelper.onShowFileChooser(filePathCallback)

                override fun onConsoleMessage(consoleMessage: ConsoleMessage?): Boolean {
                    val msg = consoleMessage?.message() ?: return false
                    if (msg.startsWith("[ADLMS_BENCH")) {
                        Log.i("ADLMS_BENCH", msg)
                    }
                    return false
                }
            }
            addJavascriptInterface(exportBridge, "AndroidExport")
            setDownloadListener(exportBridge)
        }
        webView = view
        setContentView(view)
        view.loadUrl(buildEntryUrl(intent))
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        webView?.loadUrl(buildEntryUrl(intent))
    }

    private fun buildEntryUrl(intent: Intent?): String {
        val rawQuery = intent?.getStringExtra("bench_query")
            ?: intent?.data?.takeIf {
                it.scheme == "https" && it.host == EdgeAssetClient.ASSET_DOMAIN
            }?.encodedQuery
            ?: return EdgeAssetClient.ENTRY_URL
        val clean = rawQuery.trim().trimStart('?')
        if (clean.isEmpty() || !Regex("^[a-zA-Z0-9_=&]+$").matches(clean)) {
            return EdgeAssetClient.ENTRY_URL
        }
        val valid = clean.split('&').all { pair ->
            val parts = pair.split('=', limit = 2)
            if (parts.size != 2) return@all false
            when (parts[0]) {
                "bench" -> parts[1].toIntOrNull()?.let { it in 1..50 } ?: false
                "model" -> Regex("^[a-zA-Z0-9_]+$").matches(parts[1])
                "simd" -> parts[1] == "0" || parts[1] == "1"
                else -> false
            }
        }
        return if (valid) "${EdgeAssetClient.ENTRY_URL}?$clean" else EdgeAssetClient.ENTRY_URL
    }

    private fun recreateWebView() {
        webView = null
        createAndBindWebView()
    }

    override fun onDestroy() {
        webView?.destroy()
        webView = null
        super.onDestroy()
    }
}
