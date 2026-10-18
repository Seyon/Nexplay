package com.anonymous.Stitchnexplay

import android.app.Application
import android.content.res.Configuration
import android.os.Build
import android.webkit.WebView

import com.facebook.react.PackageList
import com.facebook.react.ReactApplication
import com.facebook.react.ReactNativeApplicationEntryPoint.loadReactNative
import com.facebook.react.ReactPackage
import com.facebook.react.ReactHost
import com.facebook.react.common.ReleaseLevel
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint
import com.facebook.react.modules.network.OkHttpClientFactory
import com.facebook.react.modules.network.OkHttpClientProvider
import com.facebook.react.modules.network.ReactCookieJarContainer

import expo.modules.ApplicationLifecycleDispatcher
import expo.modules.ExpoReactHostFactory

import okhttp3.Dns
import okhttp3.OkHttpClient
import java.net.InetAddress
import java.net.UnknownHostException
import java.util.concurrent.TimeUnit
import org.json.JSONObject

data class DnsCacheEntry(val addresses: List<InetAddress>, val expiry: Long)

class DohFallbackDns : Dns {

  companion object {
    private val dnsCache = java.util.concurrent.ConcurrentHashMap<String, DnsCacheEntry>()
    private val executor = java.util.concurrent.Executors.newFixedThreadPool(6) { r ->
      Thread(r, "NexPlay-DoH-Worker").apply { isDaemon = true }
    }

    fun clearCache() {
      dnsCache.clear()
      seedStaticDns()
    }

    private fun seedStaticDns() {
      try {
        val tmdbIps = listOf(
          InetAddress.getByAddress("api.themoviedb.org", byteArrayOf(3.toByte(), 175.toByte(), 86.toByte(), 50.toByte())),
          InetAddress.getByAddress("api.themoviedb.org", byteArrayOf(3.toByte(), 175.toByte(), 86.toByte(), 37.toByte())),
          InetAddress.getByAddress("api.themoviedb.org", byteArrayOf(13.toByte(), 224.toByte(), 245.toByte(), 92.toByte())),
          InetAddress.getByAddress("api.themoviedb.org", byteArrayOf(13.toByte(), 224.toByte(), 245.toByte(), 44.toByte()))
        )
        val dayExpiry = System.currentTimeMillis() + 86400000L
        dnsCache["api.themoviedb.org"] = DnsCacheEntry(tmdbIps, dayExpiry)
        dnsCache["themoviedb.org"] = DnsCacheEntry(tmdbIps, dayExpiry)
        val tmdbImageIps = listOf(
          InetAddress.getByAddress("image.tmdb.org", byteArrayOf(169.toByte(), 150.toByte(), 207.toByte(), 217.toByte())),
          InetAddress.getByAddress("image.tmdb.org", byteArrayOf(151.toByte(), 101.toByte(), 1.toByte(), 124.toByte()))
        )
        dnsCache["image.tmdb.org"] = DnsCacheEntry(tmdbImageIps, dayExpiry)
      } catch (e: Exception) {}
    }

    init {
      seedStaticDns()
    }
  }

  override fun lookup(hostname: String): List<InetAddress> {
    if (hostname.isEmpty()) throw UnknownHostException("hostname is empty")

    // Fast path: localhost and direct IP addresses
    if (hostname.equals("localhost", ignoreCase = true) || 
        hostname == "127.0.0.1" || 
        hostname == "::1" || 
        hostname.matches(Regex("^\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}$"))) {
      return Dns.SYSTEM.lookup(hostname)
    }

    // 1. In-memory Cache Check (0ms immediate return)
    val now = System.currentTimeMillis()
    val cached = dnsCache[hostname]
    if (cached != null && cached.expiry > now && cached.addresses.isNotEmpty()) {
      return cached.addresses
    }

    // 2. Build candidate endpoints to race concurrently
    val candidateTasks = mutableListOf<java.util.concurrent.Callable<List<InetAddress>>>()

    // Task: System DNS with strict 800ms limit and carrier blockpage filter
    candidateTasks.add(java.util.concurrent.Callable {
      try {
        val addrs = Dns.SYSTEM.lookup(hostname)
        val valid = addrs.filter {
          val ip = it.hostAddress ?: ""
          ip != "0.0.0.0" && ip != "127.0.0.1" && !ip.startsWith("0.") &&
          !ip.startsWith("49.44.") && !ip.startsWith("182.79.") && !ip.startsWith("115.112.")
        }
        if (valid.isNotEmpty()) valid else throw Exception("Blocked or empty")
      } catch (e: Exception) {
        throw e
      }
    })

    // Tasks: Active provider endpoints
    val endpoints = getEndpointsForActiveProvider(hostname)
    for (url in endpoints) {
      candidateTasks.add(java.util.concurrent.Callable {
        val res = queryDohEndpoint(url, hostname)
        if (res.isNotEmpty()) res else throw Exception("DoH empty for $url")
      })
    }

    // Tasks: Ultra-fast fallback DoH endpoints (Cloudflare 1.0.0.1 & Google 8.8.8.8 & Alibaba 223.5.5.5)
    val emergencyUrls = listOf(
      "https://1.0.0.1/dns-query?name=$hostname&type=A",
      "https://8.8.8.8/resolve?name=$hostname&type=A",
      "https://cloudflare-dns.com/dns-query?name=$hostname&type=A",
      "https://223.5.5.5/resolve?name=$hostname&type=A"
    )
    for (eUrl in emergencyUrls) {
      if (!endpoints.contains(eUrl)) {
        candidateTasks.add(java.util.concurrent.Callable {
          val res = queryDohEndpoint(eUrl, hostname)
          if (res.isNotEmpty()) res else throw Exception("Fallback DoH empty for $eUrl")
        })
      }
    }

    // 3. Race tasks concurrently using CompletionService
    val cs = java.util.concurrent.ExecutorCompletionService<List<InetAddress>>(executor)
    val futures = mutableListOf<java.util.concurrent.Future<List<InetAddress>>>()
    for (task in candidateTasks) {
      futures.add(cs.submit(task))
    }

    var resolvedAddresses: List<InetAddress>? = null
    var completedCount = 0
    val totalCount = candidateTasks.size
    val deadline = System.currentTimeMillis() + 3500L // Max 3.5s wait total

    while (completedCount < totalCount) {
      val remainingTime = Math.max(100L, deadline - System.currentTimeMillis())
      if (remainingTime <= 0) break
      val completedFuture = cs.poll(remainingTime, TimeUnit.MILLISECONDS)
      if (completedFuture != null) {
        completedCount++
        try {
          val res = completedFuture.get()
          if (res != null && res.isNotEmpty()) {
            resolvedAddresses = res
            break
          }
        } catch (e: Exception) {
          // Task failed, wait for next
        }
      } else {
        // Poll timed out
        break
      }
    }

    // Cancel remaining futures
    for (f in futures) {
      try { f.cancel(true) } catch (e: Exception) {}
    }

    if (resolvedAddresses != null && resolvedAddresses.isNotEmpty()) {
      dnsCache[hostname] = DnsCacheEntry(resolvedAddresses, System.currentTimeMillis() + 1800000L) // 30 min TTL
      return resolvedAddresses
    }

    // 4. Stale cache fallback if resolution failed
    if (cached != null && cached.addresses.isNotEmpty()) {
      return cached.addresses
    }

    // 5. Final attempt via System DNS
    try {
      val sys = Dns.SYSTEM.lookup(hostname)
      if (sys.isNotEmpty()) {
        dnsCache[hostname] = DnsCacheEntry(sys, System.currentTimeMillis() + 300000L)
        return sys
      }
    } catch (e: Exception) {}

    throw UnknownHostException("Unable to resolve host via DoH and System DNS: $hostname")
  }

  private fun getEndpointsForActiveProvider(hostname: String): List<String> {
    val providerId = DnsPreferenceModule.activeProviderId.lowercase()
    val customUrl = DnsPreferenceModule.activeCustomUrl.trim()
    val list = mutableListOf<String>()

    when (providerId) {
      "google" -> {
        // Google DNS uses /resolve (NOT /dns-query which returns HTTP 400)
        list.add("https://8.8.8.8/resolve?name=$hostname&type=A")
        list.add("https://8.8.4.4/resolve?name=$hostname&type=A")
        list.add("https://dns.google/resolve?name=$hostname&type=A")
      }
      "cloudflare" -> {
        list.add("https://1.1.1.1/dns-query?name=$hostname&type=A")
        list.add("https://1.0.0.1/dns-query?name=$hostname&type=A")
        list.add("https://cloudflare-dns.com/dns-query?name=$hostname&type=A")
      }
      "adguard" -> {
        list.add("https://94.140.14.14/resolve?name=$hostname&type=A")
        list.add("https://94.140.15.15/resolve?name=$hostname&type=A")
        list.add("https://dns.adguard-dns.com/resolve?name=$hostname&type=A")
      }
      "quad9" -> {
        list.add("https://dns.quad9.net/dns-query")
        list.add("https://9.9.9.9/dns-query")
      }
      "custom" -> {
        if (customUrl.isNotEmpty()) {
          val separator = if (customUrl.contains("?")) "&" else "?"
          list.add("${customUrl}${separator}name=$hostname&type=A")
        }
      }
      else -> {
        // Default Google DNS
        list.add("https://8.8.8.8/resolve?name=$hostname&type=A")
        list.add("https://8.8.4.4/resolve?name=$hostname&type=A")
        list.add("https://dns.google/resolve?name=$hostname&type=A")
      }
    }

    return list
  }

  private fun queryDohEndpoint(urlStr: String, hostname: String): List<InetAddress> {
    // If endpoint is Quad9 without query parameters, query via wireformat RFC 8484
    if (urlStr.contains("quad9.net") || urlStr.contains("9.9.9.9")) {
      val wireResult = queryWireformatDoh(urlStr, hostname)
      if (wireResult.isNotEmpty()) return wireResult
    }

    val connection = java.net.URL(urlStr).openConnection() as java.net.HttpURLConnection
    connection.connectTimeout = 2000
    connection.readTimeout = 2000
    connection.setRequestProperty("Accept", "application/dns-json, application/json")
    connection.setRequestProperty("User-Agent", "StitchNexplay/2.0")
    connection.requestMethod = "GET"

    if (connection.responseCode == 200) {
      val response = connection.inputStream.bufferedReader().use { it.readText() }
      return parseDnsJson(response, hostname)
    } else if (connection.responseCode == 400 || connection.responseCode == 415) {
      // Fallback to RFC 8484 wireformat if JSON is not supported by endpoint
      val cleanBase = urlStr.split("?")[0]
      return queryWireformatDoh(cleanBase, hostname)
    }

    return emptyList()
  }

  private fun queryWireformatDoh(baseUrl: String, hostname: String): List<InetAddress> {
    try {
      val wireQuery = buildDnsWireQuery(hostname)
      val b64 = android.util.Base64.encodeToString(
        wireQuery,
        android.util.Base64.URL_SAFE or android.util.Base64.NO_PADDING or android.util.Base64.NO_WRAP
      )
      val separator = if (baseUrl.contains("?")) "&" else "?"
      val reqUrl = "${baseUrl}${separator}dns=$b64"
      val connection = java.net.URL(reqUrl).openConnection() as java.net.HttpURLConnection
      connection.connectTimeout = 3500
      connection.readTimeout = 3500
      connection.setRequestProperty("Accept", "application/dns-message")
      connection.setRequestProperty("User-Agent", "StitchNexplay/2.0")
      connection.requestMethod = "GET"

      if (connection.responseCode == 200) {
        val bytes = connection.inputStream.readBytes()
        return parseDnsWireResponse(bytes, hostname)
      }
    } catch (e: Exception) {}
    return emptyList()
  }

  private fun buildDnsWireQuery(hostname: String): ByteArray {
    val labels = hostname.split(".")
    var totalLen = 12 + 1 + 4 // 12 header, 1 null root, 4 type+class
    for (label in labels) {
      totalLen += 1 + label.toByteArray(Charsets.UTF_8).size
    }
    val buf = java.nio.ByteBuffer.allocate(totalLen)
    buf.putShort(0x1234.toShort()) // ID
    buf.putShort(0x0100.toShort()) // Flags: standard query, recursion desired
    buf.putShort(1.toShort())      // QDCOUNT: 1
    buf.putShort(0.toShort())      // ANCOUNT
    buf.putShort(0.toShort())      // NSCOUNT
    buf.putShort(0.toShort())      // ARCOUNT

    for (label in labels) {
      val labelBytes = label.toByteArray(Charsets.UTF_8)
      buf.put(labelBytes.size.toByte())
      buf.put(labelBytes)
    }
    buf.put(0.toByte())            // root null
    buf.putShort(1.toShort())      // Type A
    buf.putShort(1.toShort())      // Class IN
    return buf.array()
  }

  private fun parseDnsWireResponse(bytes: ByteArray, hostname: String): List<InetAddress> {
    val result = mutableListOf<InetAddress>()
    if (bytes.size < 12) return result
    val buf = java.nio.ByteBuffer.wrap(bytes)
    val ancount = buf.getShort(6).toInt() and 0xFFFF
    if (ancount <= 0) return result

    var offset = 12
    // Skip Question
    while (offset < bytes.size && bytes[offset].toInt() != 0) {
      val len = bytes[offset].toInt() and 0xFF
      offset += 1 + len
    }
    offset += 5 // null byte + qtype(2) + qclass(2)

    // Parse Answers
    for (i in 0 until ancount) {
      if (offset >= bytes.size) break
      // Name pointer
      val firstByte = bytes[offset].toInt() and 0xFF
      if ((firstByte and 0xC0) == 0xC0) {
        offset += 2
      } else {
        while (offset < bytes.size && bytes[offset].toInt() != 0) {
          val len = bytes[offset].toInt() and 0xFF
          offset += 1 + len
        }
        offset += 1
      }

      if (offset + 10 > bytes.size) break
      val type = buf.getShort(offset).toInt() and 0xFFFF
      offset += 2
      offset += 2 // skip class
      offset += 4 // skip ttl
      val rdlen = buf.getShort(offset).toInt() and 0xFFFF
      offset += 2

      if (type == 1 && rdlen == 4 && offset + 4 <= bytes.size) {
        val ip = "${bytes[offset].toInt() and 0xFF}.${bytes[offset + 1].toInt() and 0xFF}.${bytes[offset + 2].toInt() and 0xFF}.${bytes[offset + 3].toInt() and 0xFF}"
        try {
          result.add(InetAddress.getByAddress(hostname, InetAddress.getByName(ip).address))
        } catch (e: Exception) {
          result.add(InetAddress.getByName(ip))
        }
      }
      offset += rdlen
    }

    return result
  }

  private fun parseDnsJson(jsonStr: String, hostname: String): List<InetAddress> {
    val result = mutableListOf<InetAddress>()
    try {
      val json = JSONObject(jsonStr)
      if (json.has("Answer")) {
        val answers = json.getJSONArray("Answer")
        for (i in 0 until answers.length()) {
          val obj = answers.getJSONObject(i)
          if (obj.optInt("type") == 1 && obj.has("data")) {
            val ip = obj.getString("data").trim()
            if (ip.matches(Regex("^\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}$"))) {
              try {
                result.add(InetAddress.getByAddress(hostname, InetAddress.getByName(ip).address))
              } catch (e: Exception) {
                result.add(InetAddress.getByName(ip))
              }
            }
          }
        }
      }
    } catch (e: Exception) {}
    return result
  }
}

class CustomOkHttpClientFactory : OkHttpClientFactory {
  override fun createNewNetworkModuleClient(): OkHttpClient {
    return OkHttpClient.Builder()
      .dns(DohFallbackDns())
      .connectTimeout(15, TimeUnit.SECONDS)
      .readTimeout(20, TimeUnit.SECONDS)
      .writeTimeout(20, TimeUnit.SECONDS)
      .cookieJar(ReactCookieJarContainer())
      .build()
  }
}

class MainApplication : Application(), ReactApplication {

  override val reactHost: ReactHost by lazy {
    ExpoReactHostFactory.getDefaultReactHost(
      context = applicationContext,
      packageList =
        PackageList(this).packages.apply {
          add(DnsPreferencePackage())
        }
    )
  }

  override fun onCreate() {
    super.onCreate()

    // Initialize saved DNS preferences (Google DNS default)
    try {
      DnsPreferenceModule.initPreferences(this)
    } catch (e: Exception) {}

    // Enable custom OkHttp DNS-over-HTTPS (DoH) resolution to bypass carrier DNS blocks
    try {
      OkHttpClientProvider.setOkHttpClientFactory(CustomOkHttpClientFactory())
    } catch (e: Exception) {
      // Fallback to default OkHttpClient if factory registration fails
    }

    // Enable system-level WebView background activity and multi-process stability
    try {
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
        val processName = getProcessName()
        if (packageName != processName) {
          WebView.setDataDirectorySuffix(processName)
        }
      }
    } catch (e: Exception) {
      // Ignore if data directory is already configured
    }

    DefaultNewArchitectureEntryPoint.releaseLevel = try {
      ReleaseLevel.valueOf(BuildConfig.REACT_NATIVE_RELEASE_LEVEL.uppercase())
    } catch (e: IllegalArgumentException) {
      ReleaseLevel.STABLE
    }
    loadReactNative(this)
    ApplicationLifecycleDispatcher.onApplicationCreate(this)
  }

  override fun onConfigurationChanged(newConfig: Configuration) {
    super.onConfigurationChanged(newConfig)
    ApplicationLifecycleDispatcher.onConfigurationChanged(this, newConfig)
  }
}
