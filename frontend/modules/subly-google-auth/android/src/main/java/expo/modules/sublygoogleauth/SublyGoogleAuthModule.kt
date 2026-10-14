package expo.modules.sublygoogleauth

import android.app.Activity
import android.content.Context
import com.google.android.gms.auth.GoogleAuthUtil
import com.google.android.gms.auth.api.identity.AuthorizationRequest
import com.google.android.gms.auth.api.identity.AuthorizationResult
import com.google.android.gms.auth.api.identity.Identity
import com.google.android.gms.common.api.ApiException
import com.google.android.gms.common.api.CommonStatusCodes
import com.google.android.gms.common.api.Scope
import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

private const val REQUEST_CODE = 7401
private const val GMAIL_READONLY = "https://www.googleapis.com/auth/gmail.readonly"

/**
 * Gmail read-only authorization via Google Identity Services AuthorizationClient.
 * No client ID or secret in the app: Google matches the Android OAuth client by
 * package name + signing certificate SHA-1. Tokens are never persisted here.
 */
class SublyGoogleAuthModule : Module() {
  private var pending: Promise? = null

  private fun request(): AuthorizationRequest =
    AuthorizationRequest.builder().setRequestedScopes(listOf(Scope(GMAIL_READONLY))).build()

  private fun toMap(r: AuthorizationResult): Map<String, Any?> =
    mapOf("accessToken" to r.accessToken, "grantedScopes" to r.grantedScopes)

  private fun reject(p: Promise, e: Exception) {
    val code = (e as? ApiException)?.statusCode
    val name = when (code) {
      CommonStatusCodes.DEVELOPER_ERROR -> "DEVELOPER_ERROR"
      CommonStatusCodes.NETWORK_ERROR -> "NETWORK_ERROR"
      CommonStatusCodes.CANCELED -> "CANCELED"
      else -> "AUTH_FAILED"
    }
    p.reject(name, "Google authorization failed${code?.let { " ($it)" } ?: ""}", e)
  }

  override fun definition() = ModuleDefinition {
    Name("SublyGoogleAuth")

    // interactive=false never shows UI (used by background sync); it fails with
    // INTERACTION_REQUIRED when the user must grant or re-grant access.
    AsyncFunction("authorize") { interactive: Boolean, promise: Promise ->
      if (pending != null) {
        promise.reject("IN_PROGRESS", "Authorization already in progress", null)
        return@AsyncFunction
      }
      val activity: Activity? = appContext.currentActivity
      val ctx: Context? = activity ?: appContext.reactContext
      if (ctx == null) {
        promise.reject("NO_CONTEXT", "No Android context available", null)
        return@AsyncFunction
      }
      Identity.getAuthorizationClient(ctx).authorize(request())
        .addOnSuccessListener { r ->
          if (!r.hasResolution()) {
            promise.resolve(toMap(r))
            return@addOnSuccessListener
          }
          val pi = r.pendingIntent
          if (!interactive || activity == null || pi == null) {
            promise.reject("INTERACTION_REQUIRED", "User interaction required", null)
            return@addOnSuccessListener
          }
          pending = promise
          try {
            activity.startIntentSenderForResult(pi.intentSender, REQUEST_CODE, null, 0, 0, 0)
          } catch (e: Exception) {
            pending = null
            promise.reject("LAUNCH_FAILED", e.message, e)
          }
        }
        .addOnFailureListener { e -> reject(promise, e) }
    }

    // Removes a cached access token so the next authorize() returns a fresh one.
    AsyncFunction("clearToken") { token: String ->
      val ctx = appContext.reactContext ?: return@AsyncFunction null
      GoogleAuthUtil.clearToken(ctx, token)
      null
    }

    OnActivityResult { _, payload ->
      if (payload.requestCode != REQUEST_CODE) return@OnActivityResult
      val p = pending ?: return@OnActivityResult
      pending = null
      val ctx = appContext.currentActivity ?: appContext.reactContext
      val data = payload.data
      if (payload.resultCode != Activity.RESULT_OK || data == null || ctx == null) {
        p.reject("CANCELED", "Authorization canceled", null)
        return@OnActivityResult
      }
      try {
        p.resolve(toMap(Identity.getAuthorizationClient(ctx).getAuthorizationResultFromIntent(data)))
      } catch (e: ApiException) {
        reject(p, e)
      }
    }
  }
}
