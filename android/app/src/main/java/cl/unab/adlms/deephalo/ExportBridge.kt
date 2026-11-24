package cl.unab.adlms.deephalo

import android.content.ContentValues
import android.os.Environment
import android.provider.MediaStore
import android.util.Base64
import android.webkit.DownloadListener
import android.webkit.JavascriptInterface
import android.webkit.URLUtil
import android.widget.Toast
import androidx.activity.ComponentActivity
import java.net.URLDecoder

class ExportBridge(private val activity: ComponentActivity) : DownloadListener {

    @JavascriptInterface
    fun saveFile(filename: String, mimeType: String, content: String): Boolean {
        val safeName = sanitizeFilename(filename)
        val resolvedMime = mimeType.ifBlank { "application/octet-stream" }
        val values = ContentValues().apply {
            put(MediaStore.Downloads.DISPLAY_NAME, safeName)
            put(MediaStore.Downloads.MIME_TYPE, resolvedMime)
            put(MediaStore.Downloads.RELATIVE_PATH, "${Environment.DIRECTORY_DOWNLOADS}/DeepHalo")
        }

        return try {
            val resolver = activity.contentResolver
            val uri = resolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values)
                ?: return false
            resolver.openOutputStream(uri)?.use { out ->
                out.write(content.toByteArray(Charsets.UTF_8))
                out.flush()
            } ?: return false
            activity.runOnUiThread {
                Toast.makeText(
                    activity,
                    "Saved to Download/DeepHalo/$safeName",
                    Toast.LENGTH_LONG,
                ).show()
            }
            true
        } catch (_: Exception) {
            false
        }
    }

    override fun onDownloadStart(
        url: String?,
        userAgent: String?,
        contentDisposition: String?,
        mimetype: String?,
        contentLength: Long,
    ) {
        if (url == null || !url.startsWith("data:")) return
        val commaIdx = url.indexOf(',')
        if (commaIdx < 0) return

        val meta = url.substring(5, commaIdx)
        val payload = url.substring(commaIdx + 1)
        val decoded = try {
            if (meta.endsWith(";base64", ignoreCase = true)) {
                String(Base64.decode(payload, Base64.DEFAULT), Charsets.UTF_8)
            } else {
                URLDecoder.decode(payload, "UTF-8")
            }
        } catch (_: Exception) {
            return
        }

        val name = URLUtil.guessFileName(url, contentDisposition, mimetype)
        saveFile(name, mimetype ?: "application/octet-stream", decoded)
    }

    private fun sanitizeFilename(raw: String): String {
        val stripped = raw
            .replace("..", "")
            .replace("/", "_")
            .replace("\\", "_")
            .filter { ch -> ch.code in 0x20..0x7E }
            .trim()
        return stripped.ifBlank { "deephalo_export.txt" }
    }
}
