package cl.unab.adlms.deephalo

import android.Manifest
import android.app.Activity
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.provider.MediaStore
import android.webkit.ValueCallback
import androidx.activity.ComponentActivity
import androidx.activity.result.contract.ActivityResultContracts
import androidx.core.content.ContextCompat
import androidx.core.content.FileProvider
import java.io.File

class FileChooserHelper(private val activity: ComponentActivity) {

    private var pendingCallback: ValueCallback<Array<Uri>>? = null
    private var cameraFile: File? = null
    private var cameraUri: Uri? = null

    private val permissionLauncher = activity.registerForActivityResult(
        ActivityResultContracts.RequestPermission(),
    ) { granted ->
        if (granted) {
            launchChooser()
        } else {
            resolvePendingCallback(null)
        }
    }

    private val chooserLauncher = activity.registerForActivityResult(
        ActivityResultContracts.StartActivityForResult(),
    ) { result ->
        val uris = if (result.resultCode == Activity.RESULT_OK) {
            val dataUri = result.data?.data
            val captured = cameraFile
            val capturedUri = cameraUri
            when {
                dataUri != null -> arrayOf(dataUri)
                captured != null && captured.exists() && captured.length() > 0 && capturedUri != null ->
                    arrayOf(capturedUri)
                else -> null
            }
        } else {
            null
        }
        resolvePendingCallback(uris)
    }

    fun onShowFileChooser(filePathCallback: ValueCallback<Array<Uri>>?): Boolean {
        resolvePendingCallback(null)
        pendingCallback = filePathCallback

        val hasCamera = ContextCompat.checkSelfPermission(
            activity,
            Manifest.permission.CAMERA,
        ) == PackageManager.PERMISSION_GRANTED

        if (!hasCamera) {
            permissionLauncher.launch(Manifest.permission.CAMERA)
        } else {
            launchChooser()
        }
        return true
    }

    private fun launchChooser() {
        try {
            val dir = File(activity.cacheDir, "camera").apply { mkdirs() }
            val file = File(dir, "plate_${System.currentTimeMillis()}.jpg")
            val uri = FileProvider.getUriForFile(
                activity,
                "${activity.packageName}.fileprovider",
                file,
            )
            cameraFile = file
            cameraUri = uri

            val cameraIntent = Intent(MediaStore.ACTION_IMAGE_CAPTURE).apply {
                putExtra(MediaStore.EXTRA_OUTPUT, uri)
                addFlags(Intent.FLAG_GRANT_WRITE_URI_PERMISSION or Intent.FLAG_GRANT_READ_URI_PERMISSION)
            }
            val galleryIntent = Intent(Intent.ACTION_GET_CONTENT).apply {
                addCategory(Intent.CATEGORY_OPENABLE)
                type = "image/*"
            }
            val chooser = Intent.createChooser(galleryIntent, "Seleccionar imagen de placa").apply {
                putExtra(Intent.EXTRA_INITIAL_INTENTS, arrayOf(cameraIntent))
            }
            chooserLauncher.launch(chooser)
        } catch (_: Exception) {
            resolvePendingCallback(null)
        }
    }

    private fun resolvePendingCallback(result: Array<Uri>?) {
        pendingCallback?.onReceiveValue(result)
        pendingCallback = null
    }
}
