package com.facturacion.app.services.drive

import android.util.Log
import com.google.gson.Gson
import com.google.gson.GsonBuilder
import com.google.gson.JsonArray
import com.google.gson.JsonParser
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import java.io.File
import java.net.URLEncoder
import java.util.concurrent.TimeUnit

/**
 * Sube tickets a Google Drive y los agrega a _datos/facturas.json, en la MISMA
 * carpeta que usa la web ("Facturación - Tickets/AÑO/MES").
 * Es un port en Kotlin del driveStorage.ts del frontend.
 *
 * @param accessToken token OAuth de Google con scope drive.file (obtenido aparte).
 */
class DriveService(private val accessToken: String) {
    private val gson = Gson()
    private val prettyGson = GsonBuilder().setPrettyPrinting().create() // facturas.json legible
    private val client = OkHttpClient.Builder()
        .connectTimeout(30, TimeUnit.SECONDS)
        .readTimeout(60, TimeUnit.SECONDS)
        .writeTimeout(120, TimeUnit.SECONDS)
        .build()

    companion object {
        private const val TAG = "DriveService"
        private const val FILES = "https://www.googleapis.com/drive/v3/files"
        private const val UPLOAD = "https://www.googleapis.com/upload/drive/v3/files"
        private const val FOLDER_MIME = "application/vnd.google-apps.folder"
        private const val JSON = "application/json"
        private const val FOLDER_NAME = "Facturación - Tickets"
        private const val DATA_FOLDER = "_datos"
        private val MESES = arrayOf(
            "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
            "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
        )
    }

    private fun enc(s: String) = URLEncoder.encode(s, "UTF-8")
    private fun esc(s: String) = s.replace("\\", "\\\\").replace("'", "\\'")
    private fun bearer(builder: Request.Builder) = builder.header("Authorization", "Bearer $accessToken")

    private fun findOne(query: String): String? {
        val url = "$FILES?q=${enc(query)}&fields=files(id,name)&spaces=drive&orderBy=createdTime&pageSize=1"
        client.newCall(bearer(Request.Builder().url(url)).get().build()).execute().use { r ->
            val body = r.body?.string() ?: ""
            if (!r.isSuccessful) throw RuntimeException("Drive listar ${r.code}: ${body.take(200)}")
            val files = JsonParser.parseString(body).asJsonObject.getAsJsonArray("files")
            return if (files != null && files.size() > 0) files[0].asJsonObject.get("id").asString else null
        }
    }

    private fun createFolder(name: String, parentId: String?): String {
        val meta = HashMap<String, Any>()
        meta["name"] = name
        meta["mimeType"] = FOLDER_MIME
        if (parentId != null) meta["parents"] = listOf(parentId)
        val body = gson.toJson(meta).toRequestBody(JSON.toMediaType())
        client.newCall(bearer(Request.Builder().url("$FILES?fields=id")).post(body).build()).execute().use { r ->
            val s = r.body?.string() ?: ""
            if (!r.isSuccessful) throw RuntimeException("Drive crear carpeta ${r.code}: ${s.take(200)}")
            return JsonParser.parseString(s).asJsonObject.get("id").asString
        }
    }

    private fun ensureFolder(name: String, parentId: String?): String {
        val q = buildString {
            append("name='${esc(name)}' and mimeType='$FOLDER_MIME' and trashed=false")
            if (parentId != null) append(" and '$parentId' in parents")
        }
        return findOne(q) ?: createFolder(name, parentId)
    }

    private fun targetFolder(fecha: String, mainId: String): String = try {
        val mm = fecha.substring(5, 7)
        val mi = mm.toInt()
        if (mi in 1..12) {
            val yearId = ensureFolder(fecha.substring(0, 4), mainId)
            ensureFolder("$mm - ${MESES[mi - 1]}", yearId)
        } else mainId
    } catch (e: Exception) {
        mainId
    }

    private fun multipartUpload(metaJson: String, contentType: String, content: ByteArray): String {
        val boundary = "facturacion${System.currentTimeMillis()}"
        val pre = "--$boundary\r\nContent-Type: $JSON; charset=UTF-8\r\n\r\n$metaJson\r\n--$boundary\r\nContent-Type: $contentType\r\n\r\n"
        val post = "\r\n--$boundary--"
        val bytes = pre.toByteArray(Charsets.UTF_8) + content + post.toByteArray(Charsets.UTF_8)
        val body = bytes.toRequestBody("multipart/related; boundary=$boundary".toMediaType())
        client.newCall(bearer(Request.Builder().url("$UPLOAD?uploadType=multipart&fields=id")).post(body).build()).execute().use { r ->
            val s = r.body?.string() ?: ""
            if (!r.isSuccessful) throw RuntimeException("Drive subir ${r.code}: ${s.take(200)}")
            return JsonParser.parseString(s).asJsonObject.get("id").asString
        }
    }

    private fun readFacturasArray(fileId: String?): JsonArray {
        if (fileId == null) return JsonArray()
        return client.newCall(bearer(Request.Builder().url("$FILES/$fileId?alt=media")).get().build()).execute().use { r ->
            val s = r.body?.string() ?: "[]"
            if (r.isSuccessful) {
                val parsed = JsonParser.parseString(s)
                if (parsed.isJsonArray) parsed.asJsonArray else JsonArray()
            } else JsonArray()
        }
    }

    private fun writeFacturasArray(fileId: String?, dataFolderId: String, arr: JsonArray) {
        val content = prettyGson.toJson(arr)
        if (fileId != null) {
            val req = bearer(Request.Builder().url("$UPLOAD/$fileId?uploadType=media"))
                .patch(content.toRequestBody(JSON.toMediaType())).build()
            client.newCall(req).execute().use { r ->
                if (!r.isSuccessful) throw RuntimeException("Drive actualizar json ${r.code}")
            }
        } else {
            val meta = gson.toJson(mapOf("name" to "facturas.json", "parents" to listOf(dataFolderId), "mimeType" to JSON))
            multipartUpload(meta, JSON, content.toByteArray(Charsets.UTF_8))
        }
    }

    private fun arrayHasId(arr: JsonArray, id: String): Boolean =
        arr.any { it.isJsonObject && it.asJsonObject.get("id")?.let { e -> e.isJsonPrimitive && e.asString == id } == true }

    /**
     * Agrega la factura a facturas.json de forma segura ante escrituras concurrentes
     * (web y Android comparten el archivo): relee lo último, agrega (idempotente por id),
     * escribe y RELEE para verificar; si otra escritura lo pisó, reintenta con jitter.
     */
    private fun appendFactura(dataFolderId: String, factura: Map<String, Any?>) {
        val newId = factura["id"]?.toString()
        val query = "name='facturas.json' and '$dataFolderId' in parents and trashed=false"
        var attempt = 0
        while (true) {
            val fileId = findOne(query)
            val arr = readFacturasArray(fileId)
            if (newId == null || !arrayHasId(arr, newId)) arr.add(gson.toJsonTree(factura))
            writeFacturasArray(fileId, dataFolderId, arr)
            if (newId == null) return
            // Verificar que nuestro registro quedó (si lo pisaron, reintentar con estado fresco).
            if (arrayHasId(readFacturasArray(findOne(query)), newId)) return
            if (attempt++ >= 4) {
                Log.w(TAG, "appendFactura: no se pudo confirmar el alta tras $attempt intentos (posible escritura concurrente)")
                return
            }
            Thread.sleep(150L + (Math.random() * 250).toLong())
        }
    }

    /**
     * Sube la imagen a AÑO/MES y agrega la factura a _datos/facturas.json (con su driveFileId).
     * @return el fileId de la imagen subida.
     */
    suspend fun uploadInvoice(
        imageFile: File,
        fecha: String,
        niceName: String,
        factura: Map<String, Any?>
    ): String = withContext(Dispatchers.IO) {
        val main = ensureFolder(FOLDER_NAME, null)
        val folder = targetFolder(fecha, main)
        val fileId = uploadImage(imageFile, niceName, folder)
        try {
            val dataFolder = ensureFolder(DATA_FOLDER, main)
            appendFactura(dataFolder, factura + mapOf("driveFileId" to fileId))
        } catch (e: Exception) {
            Log.w(TAG, "No se pudo actualizar facturas.json: ${e.message}")
        }
        fileId
    }

    private fun uploadImage(file: File, niceName: String, parentId: String): String {
        val meta = gson.toJson(mapOf("name" to niceName, "parents" to listOf(parentId)))
        return multipartUpload(meta, "image/jpeg", file.readBytes())
    }
}
