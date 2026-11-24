package cl.unab.adlms.deephalo

import android.content.Context
import android.view.ViewGroup
import android.webkit.RenderProcessGoneDetail
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Toast
import androidx.webkit.WebViewAssetLoader
import java.util.Locale

class EdgeAssetClient(
    private val context: Context,
    private val onRendererCrashed: () -> Unit,
) : WebViewClient() {

    private val assetsHandler = WebViewAssetLoader.AssetsPathHandler(context)

    private val assetLoader: WebViewAssetLoader = WebViewAssetLoader.Builder()
        .setDomain(ASSET_DOMAIN)
        .addPathHandler(ASSET_PATH_PREFIX) { path ->
            assetsHandler.handle("mvp_web/${path.trimStart('/')}")
        }
        .build()

    override fun shouldInterceptRequest(
        view: WebView,
        request: WebResourceRequest,
    ): WebResourceResponse? {
        val response = assetLoader.shouldInterceptRequest(request.url) ?: return null
        resolveMimeType(request.url.path)?.let { response.mimeType = it }
        return response
    }

    override fun onRenderProcessGone(
        view: WebView?,
        detail: RenderProcessGoneDetail?,
    ): Boolean {
        (view?.parent as? ViewGroup)?.removeView(view)
        view?.destroy()
        Toast.makeText(context, "WebView renderer restarted", Toast.LENGTH_SHORT).show()
        onRendererCrashed()
        return true
    }

    private fun resolveMimeType(path: String?): String? {
        val lower = path?.lowercase(Locale.US) ?: return null
        return when {
            lower.endsWith(".wasm") -> "application/wasm"
            lower.endsWith(".js") || lower.endsWith(".mjs") -> "application/javascript"
            lower.endsWith(".onnx") -> "application/octet-stream"
            lower.endsWith(".json") -> "application/json"
            lower.endsWith(".css") -> "text/css"
            lower.endsWith(".html") -> "text/html"
            else -> null
        }
    }

    companion object {
        const val ASSET_DOMAIN = "appassets.androidplatform.net"
        const val ASSET_PATH_PREFIX = "/assets/"
        const val ENTRY_URL = "https://$ASSET_DOMAIN${ASSET_PATH_PREFIX}index.html"
    }
}
