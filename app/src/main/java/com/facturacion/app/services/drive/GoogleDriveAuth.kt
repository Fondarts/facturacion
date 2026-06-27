package com.facturacion.app.services.drive

import android.content.Context
import com.google.android.gms.auth.GoogleAuthUtil
import com.google.android.gms.auth.api.signin.GoogleSignIn
import com.google.android.gms.auth.api.signin.GoogleSignInClient
import com.google.android.gms.auth.api.signin.GoogleSignInOptions
import com.google.android.gms.common.api.Scope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

/**
 * Login con Google + obtención de un access token con scope drive.file,
 * para subir los tickets al mismo Drive que usa la web.
 */
object GoogleDriveAuth {
    const val DRIVE_FILE_SCOPE = "https://www.googleapis.com/auth/drive.file"

    private fun options(): GoogleSignInOptions =
        GoogleSignInOptions.Builder(GoogleSignInOptions.DEFAULT_SIGN_IN)
            .requestEmail()
            .requestScopes(Scope(DRIVE_FILE_SCOPE))
            .build()

    fun client(context: Context): GoogleSignInClient = GoogleSignIn.getClient(context, options())

    /** ¿Ya hay una cuenta con permiso de Drive concedido? */
    fun hasAccess(context: Context): Boolean {
        val account = GoogleSignIn.getLastSignedInAccount(context) ?: return false
        return GoogleSignIn.hasPermissions(account, Scope(DRIVE_FILE_SCOPE))
    }

    /** Access token OAuth para Drive (operación bloqueante → en IO). */
    suspend fun getAccessToken(context: Context): String = withContext(Dispatchers.IO) {
        val account = GoogleSignIn.getLastSignedInAccount(context)?.account
            ?: throw IllegalStateException("No hay cuenta de Google conectada")
        GoogleAuthUtil.getToken(context, account, "oauth2:$DRIVE_FILE_SCOPE")
    }
}
