package cl.unab.adlms.deephalo

import android.annotation.SuppressLint
import android.net.Uri
import android.os.Bundle
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
            }
            addJavascriptInterface(exportBridge, "AndroidExport")
            setDownloadListener(exportBridge)
        }
        webView = view
        setContentView(view)
        view.loadUrl(EdgeAssetClient.ENTRY_URL)
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
