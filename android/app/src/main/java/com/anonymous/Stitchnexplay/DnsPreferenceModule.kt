package com.anonymous.Stitchnexplay

import android.content.Context
import android.content.SharedPreferences
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.WritableMap

class DnsPreferenceModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {

  companion object {
    const val MODULE_NAME = "DnsPreferenceModule"
    private const val PREFS_NAME = "dns_preferences"
    private const val KEY_PROVIDER_ID = "provider_id"
    private const val KEY_CUSTOM_URL = "custom_url"
    private const val KEY_ENABLED = "enabled"

    // Default to Google DNS on initial install
    var activeProviderId: String = "google"
      private set
    var activeCustomUrl: String = "https://dns.google/resolve"
      private set
    var activeEnabled: Boolean = true
      private set

    fun initPreferences(context: Context) {
      try {
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        activeProviderId = prefs.getString(KEY_PROVIDER_ID, "google") ?: "google"
        activeCustomUrl = prefs.getString(KEY_CUSTOM_URL, "https://dns.google/resolve") ?: "https://dns.google/resolve"
        activeEnabled = prefs.getBoolean(KEY_ENABLED, true)
      } catch (e: Exception) {
        // Fallback to default Google DNS
        activeProviderId = "google"
        activeCustomUrl = "https://dns.google/resolve"
        activeEnabled = true
      }
    }

    fun savePreferences(context: Context, providerId: String, customUrl: String, enabled: Boolean) {
      activeProviderId = providerId.lowercase()
      activeCustomUrl = customUrl
      activeEnabled = enabled
      try {
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        prefs.edit()
          .putString(KEY_PROVIDER_ID, activeProviderId)
          .putString(KEY_CUSTOM_URL, customUrl)
          .putBoolean(KEY_ENABLED, enabled)
          .apply()
        DohFallbackDns.clearCache()
      } catch (e: Exception) {
        // Ignore SharedPreferences write error
      }
    }
  }

  init {
    initPreferences(reactContext)
  }

  override fun getName(): String = MODULE_NAME

  @ReactMethod
  fun getDnsConfig(promise: Promise) {
    try {
      val map: WritableMap = Arguments.createMap().apply {
        putString("providerId", activeProviderId)
        putString("customUrl", activeCustomUrl)
        putBoolean("enabled", activeEnabled)
      }
      promise.resolve(map)
    } catch (e: Exception) {
      promise.reject("GET_DNS_CONFIG_ERR", e.message, e)
    }
  }

  @ReactMethod
  fun setDnsConfig(providerId: String, customUrl: String, enabled: Boolean, promise: Promise) {
    try {
      savePreferences(reactApplicationContext, providerId, customUrl, enabled)
      val map: WritableMap = Arguments.createMap().apply {
        putString("providerId", activeProviderId)
        putString("customUrl", activeCustomUrl)
        putBoolean("enabled", activeEnabled)
      }
      promise.resolve(map)
    } catch (e: Exception) {
      promise.reject("SET_DNS_CONFIG_ERR", e.message, e)
    }
  }
}
