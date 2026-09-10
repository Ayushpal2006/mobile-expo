package com.apkabill.autoreplyprint

import android.os.Handler
import android.os.Looper
import com.caysn.autoreplyprint.AutoReplyPrint
import com.sun.jna.Pointer
import com.sun.jna.WString
import com.sun.jna.ptr.IntByReference
import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import org.json.JSONObject
import java.util.concurrent.Executors

/**
 * AutoReplyPrint Enterprise POS Hardware Native Module
 *
 * Implements lazy, non-blocking JNA initialization.
 * Module instantiation NEVER performs eager JNA linking or hardware probing,
 * ensuring the application startup sequence remains 100% resilient across all Android devices,
 * emulators, and architectures (ARM64, ARMv7, x86, x86_64).
 */
class AutoReplyPrintModule : Module() {
    private var printerHandle: Pointer? = null
    private val executor = Executors.newSingleThreadExecutor()
    private val mainHandler = Handler(Looper.getMainLooper())

    companion object {
        private const val TAG = "AutoReplyPrintModule"

        /**
         * Safe runtime probe to check if JNA and AutoReplyPrint native binaries are loadable.
         * Catches Throwable (including UnsatisfiedLinkError, NoClassDefFoundError) so the app never crashes.
         */
        fun isSdkAvailable(): Boolean {
            return try {
                AutoReplyPrint.INSTANCE != null
            } catch (t: Throwable) {
                android.util.Log.w(TAG, "AutoReplyPrint SDK native library not available on this device: ${t.message}")
                false
            }
        }
    }

    override fun definition() = ModuleDefinition {
        Name("AutoReplyPrint")

        // 0. Synchronous SDK Availability Probe
        Function("isAvailable") {
            isSdkAvailable()
        }

        // 1. Bluetooth SPP Discovery + Paired Devices Fallback
        AsyncFunction("discoverBluetoothPrinters") { timeoutMs: Int, promise: Promise ->
            executor.execute {
                try {
                    android.util.Log.d(TAG, "Starting Bluetooth discovery")
                    val discovered = mutableListOf<Map<String, Any>>()

                    // 1a. Query paired/bonded Bluetooth devices first as instant, non-crashing fallback
                    try {
                        val btAdapter = android.bluetooth.BluetoothAdapter.getDefaultAdapter()
                        if (btAdapter != null && btAdapter.isEnabled) {
                            val bonded = btAdapter.bondedDevices
                            if (bonded != null) {
                                for (dev in bonded) {
                                    val name = dev.name ?: "Paired Bluetooth Device"
                                    val addr = dev.address
                                    if (!addr.isNullOrBlank() && !discovered.any { it["address"] == addr }) {
                                        android.util.Log.d(TAG, "Paired device found: name=$name address=$addr")
                                        discovered.add(
                                            mapOf(
                                                "id" to addr,
                                                "name" to name,
                                                "address" to addr,
                                                "type" to "BLUETOOTH",
                                                "connectionType" to "Bluetooth (Paired)"
                                            )
                                        )
                                    }
                                }
                            }
                        }
                    } catch (e: SecurityException) {
                        android.util.Log.w(TAG, "Missing BLUETOOTH_CONNECT permission for bonded devices query", e)
                    } catch (t: Throwable) {
                        android.util.Log.w(TAG, "Bonded devices query error: ${t.message}")
                    }

                    // 1b. Active SDK Port Enumeration via AutoReplyPrint CP_Port_EnumBtDevice
                    if (isSdkAvailable()) {
                        try {
                            android.util.Log.d(TAG, "SDK BT discovery started")
                            val cancel = IntByReference(0)
                            val callback = AutoReplyPrint.CP_OnBluetoothDeviceDiscovered_Callback { name, address, _ ->
                                val devName = if (name.isNullOrBlank()) "Bluetooth POS Printer" else name
                                if (address != null && !discovered.any { it["address"] == address }) {
                                    android.util.Log.d(TAG, "Device discovered: name=$devName address=$address")
                                    discovered.add(
                                        mapOf(
                                            "id" to address,
                                            "name" to devName,
                                            "address" to address,
                                            "type" to "BLUETOOTH",
                                            "connectionType" to "Bluetooth SPP"
                                        )
                                    )
                                }
                            }

                            val timeout = if (timeoutMs <= 0) 10000 else timeoutMs
                            AutoReplyPrint.INSTANCE.CP_Port_EnumBtDevice(timeout, cancel, callback, null)
                        } catch (t: Throwable) {
                            android.util.Log.w(TAG, "SDK CP_Port_EnumBtDevice failed: ${t.message}")
                        }
                    }

                    android.util.Log.d(TAG, "Discovery finished count=${discovered.size}")
                    promise.resolve(discovered)
                } catch (t: Throwable) {
                    android.util.Log.e(TAG, "Bluetooth discovery error: ${t.message}", t)
                    promise.resolve(emptyList<Map<String, Any>>())
                }
            }
        }

        // 2. Bluetooth BLE Discovery
        AsyncFunction("discoverBlePrinters") { timeoutMs: Int, promise: Promise ->
            executor.execute {
                try {
                    val discovered = mutableListOf<Map<String, Any>>()
                    if (!isSdkAvailable()) {
                        promise.resolve(discovered)
                        return@execute
                    }

                    val cancel = IntByReference(0)
                    val callback = AutoReplyPrint.CP_OnBluetoothDeviceDiscovered_Callback { name, address, _ ->
                        val devName = if (name.isNullOrBlank()) "BLE POS Printer" else name
                        if (address != null && !discovered.any { it["address"] == address }) {
                            discovered.add(
                                mapOf(
                                    "id" to address,
                                    "name" to devName,
                                    "address" to address,
                                    "type" to "BLUETOOTH",
                                    "connectionType" to "Bluetooth BLE"
                                )
                            )
                        }
                    }

                    val timeout = if (timeoutMs <= 0) 15000 else timeoutMs
                    AutoReplyPrint.INSTANCE.CP_Port_EnumBleDevice(timeout, cancel, callback, null)
                    promise.resolve(discovered)
                } catch (t: Throwable) {
                    android.util.Log.w(TAG, "BLE discovery error: ${t.message}")
                    promise.resolve(emptyList<Map<String, Any>>())
                }
            }
        }

        // 3. USB Discovery
        AsyncFunction("discoverUsbPrinters") { promise: Promise ->
            executor.execute {
                try {
                    val discovered = mutableListOf<Map<String, Any>>()
                    if (!isSdkAvailable()) {
                        promise.resolve(discovered)
                        return@execute
                    }

                    val devicePaths = AutoReplyPrint.CP_Port_EnumUsb_Helper.EnumUsb()
                    if (devicePaths != null) {
                        for (path in devicePaths) {
                            if (!path.isNullOrBlank()) {
                                discovered.add(
                                    mapOf(
                                        "id" to path,
                                        "name" to "USB POS Printer ($path)",
                                        "address" to path,
                                        "type" to "USB",
                                        "connectionType" to "USB"
                                    )
                                )
                            }
                        }
                    }
                    promise.resolve(discovered)
                } catch (t: Throwable) {
                    android.util.Log.w(TAG, "USB enumeration error: ${t.message}")
                    promise.resolve(emptyList<Map<String, Any>>())
                }
            }
        }

        // 4. Network Discovery
        AsyncFunction("discoverNetworkPrinters") { timeoutMs: Int, promise: Promise ->
            executor.execute {
                try {
                    val discovered = mutableListOf<Map<String, Any>>()
                    if (!isSdkAvailable()) {
                        promise.resolve(discovered)
                        return@execute
                    }

                    val cancel = IntByReference(0)
                    val callback = AutoReplyPrint.CP_OnNetPrinterDiscovered_Callback { localIp, discoveredMac, discoveredIp, discoveredName, _ ->
                        if (!discoveredIp.isNullOrBlank() && !discovered.any { it["address"] == discoveredIp }) {
                            val name = if (discoveredName.isNullOrBlank()) "Network POS ($discoveredIp)" else discoveredName
                            discovered.add(
                                mapOf(
                                    "id" to discoveredIp,
                                    "name" to name,
                                    "address" to discoveredIp,
                                    "mac" to (discoveredMac ?: ""),
                                    "type" to "NETWORK",
                                    "connectionType" to "Network (TCP/IP)"
                                )
                            )
                        }
                    }

                    val timeout = if (timeoutMs <= 0) 3000 else timeoutMs
                    AutoReplyPrint.INSTANCE.CP_Port_EnumNetPrinter(timeout, cancel, callback, null)
                    promise.resolve(discovered)
                } catch (t: Throwable) {
                    android.util.Log.w(TAG, "Network printer discovery error: ${t.message}")
                    promise.resolve(emptyList<Map<String, Any>>())
                }
            }
        }

        // 5. Connect Printer
        AsyncFunction("connectPrinter") { type: String, address: String, port: Int, promise: Promise ->
            executor.execute {
                try {
                    if (!isSdkAvailable()) {
                        promise.reject("SDK_UNAVAILABLE", "AutoReplyPrint SDK native library is not available on this device", null)
                        return@execute
                    }

                    val currentHandle = printerHandle
                    if (currentHandle != null && currentHandle != Pointer.NULL) {
                        try {
                            AutoReplyPrint.INSTANCE.CP_Port_Close(currentHandle)
                        } catch (t: Throwable) {}
                        printerHandle = null
                    }

                    val cleanType = type.trim().uppercase()
                    val targetPort = if (port <= 0) 9100 else port

                    val handle = when (cleanType) {
                        "BLUETOOTH", "BT_SPP", "SPP" -> {
                            AutoReplyPrint.INSTANCE.CP_Port_OpenBtSpp(address, 0)
                        }
                        "BLE", "BT_BLE" -> {
                            AutoReplyPrint.INSTANCE.CP_Port_OpenBtBle(address, 0)
                        }
                        "USB" -> {
                            AutoReplyPrint.INSTANCE.CP_Port_OpenUsb(address, 0)
                        }
                        "NETWORK", "TCP", "LAN" -> {
                            AutoReplyPrint.INSTANCE.CP_Port_OpenTcp(null, address, targetPort.toShort(), 5000, 0)
                        }
                        else -> {
                            AutoReplyPrint.INSTANCE.CP_Port_OpenBtSpp(address, 0)
                        }
                    }

                    if (handle != null && handle != Pointer.NULL) {
                        printerHandle = handle
                        promise.resolve(mapOf("success" to true, "connected" to true, "address" to address, "type" to cleanType))
                    } else {
                        promise.reject("CONNECTION_FAILED", "Failed to connect to printer at $address ($cleanType)", null)
                    }
                } catch (t: Throwable) {
                    promise.reject("CONNECTION_ERROR", t.message ?: "Printer connection exception", t)
                }
            }
        }

        // 6. Disconnect Printer
        AsyncFunction("disconnectPrinter") { promise: Promise ->
            executor.execute {
                try {
                    val currentHandle = printerHandle
                    if (currentHandle != null && currentHandle != Pointer.NULL && isSdkAvailable()) {
                        try {
                            AutoReplyPrint.INSTANCE.CP_Port_Close(currentHandle)
                        } catch (t: Throwable) {}
                    }
                    printerHandle = null
                    promise.resolve(true)
                } catch (t: Throwable) {
                    printerHandle = null
                    promise.resolve(false)
                }
            }
        }

        // 7. Status Query
        AsyncFunction("getPrinterStatus") { promise: Promise ->
            executor.execute {
                try {
                    val currentHandle = printerHandle
                    if (currentHandle == null || currentHandle == Pointer.NULL || !isSdkAvailable()) {
                        promise.resolve(
                            mapOf(
                                "status" to "NOT_CONNECTED",
                                "connected" to false,
                                "message" to "No active printer connection"
                            )
                        )
                        return@execute
                    }

                    val rtStatus = AutoReplyPrint.INSTANCE.CP_Pos_QueryRTStatus(currentHandle, 3000)
                    val isCoverUp = AutoReplyPrint.CP_RTSTATUS_Helper.CP_RTSTATUS_COVERUP(rtStatus.toLong())
                    val isNoPaper = AutoReplyPrint.CP_RTSTATUS_Helper.CP_RTSTATUS_NOPAPER(rtStatus.toLong())

                    val statusStr = when {
                        isNoPaper -> "PAPER_OUT"
                        isCoverUp -> "COVER_OPEN"
                        rtStatus != 0 -> "READY"
                        else -> "READY"
                    }

                    promise.resolve(
                        mapOf(
                            "status" to statusStr,
                            "connected" to true,
                            "rawStatus" to rtStatus,
                            "noPaper" to isNoPaper,
                            "coverUp" to isCoverUp
                        )
                    )
                } catch (t: Throwable) {
                    promise.resolve(mapOf("status" to "ERROR", "connected" to false, "error" to (t.message ?: "Status query failed")))
                }
            }
        }

        // 8. Text Print
        AsyncFunction("printText") { text: String, promise: Promise ->
            executor.execute {
                try {
                    val currentHandle = printerHandle
                    if (currentHandle == null || currentHandle == Pointer.NULL || !isSdkAvailable()) {
                        promise.reject("NOT_CONNECTED", "Printer is not connected or SDK is unavailable", null)
                        return@execute
                    }

                    AutoReplyPrint.INSTANCE.CP_Pos_SetMultiByteMode(currentHandle)
                    AutoReplyPrint.INSTANCE.CP_Pos_SetMultiByteEncoding(currentHandle, AutoReplyPrint.CP_MultiByteEncoding_UTF8)
                    val res = AutoReplyPrint.INSTANCE.CP_Pos_PrintTextInUTF8(currentHandle, WString(text))
                    promise.resolve(res)
                } catch (t: Throwable) {
                    promise.reject("PRINT_ERROR", t.message ?: "Print text error", t)
                }
            }
        }

        // 9. QR Code Print
        AsyncFunction("printQRCode") { data: String, size: Int, promise: Promise ->
            executor.execute {
                try {
                    val currentHandle = printerHandle
                    if (currentHandle == null || currentHandle == Pointer.NULL || !isSdkAvailable()) {
                        promise.reject("NOT_CONNECTED", "Printer is not connected or SDK is unavailable", null)
                        return@execute
                    }

                    val qrUnitSize = if (size <= 0) 3 else size
                    AutoReplyPrint.INSTANCE.CP_Pos_SetAlignment(currentHandle, AutoReplyPrint.CP_Pos_Alignment_HCenter)
                    val res = AutoReplyPrint.INSTANCE.CP_Pos_PrintQRCode(currentHandle, 0, AutoReplyPrint.CP_QRCodeECC_L, data)
                    AutoReplyPrint.INSTANCE.CP_Pos_FeedLine(currentHandle, 1)
                    AutoReplyPrint.INSTANCE.CP_Pos_SetAlignment(currentHandle, AutoReplyPrint.CP_Pos_Alignment_Left)
                    promise.resolve(res)
                } catch (t: Throwable) {
                    promise.reject("QR_PRINT_ERROR", t.message ?: "QR code print error", t)
                }
            }
        }

        // 10. Barcode Print
        AsyncFunction("printBarcode") { data: String, barcodeType: Int, promise: Promise ->
            executor.execute {
                try {
                    val currentHandle = printerHandle
                    if (currentHandle == null || currentHandle == Pointer.NULL || !isSdkAvailable()) {
                        promise.reject("NOT_CONNECTED", "Printer is not connected or SDK is unavailable", null)
                        return@execute
                    }

                    AutoReplyPrint.INSTANCE.CP_Pos_SetBarcodeUnitWidth(currentHandle, 2)
                    AutoReplyPrint.INSTANCE.CP_Pos_SetBarcodeHeight(currentHandle, 60)
                    AutoReplyPrint.INSTANCE.CP_Pos_SetBarcodeReadableTextPosition(currentHandle, AutoReplyPrint.CP_Pos_BarcodeTextPrintPosition_BelowBarcode)
                    val bType = if (barcodeType <= 0) AutoReplyPrint.CP_Pos_BarcodeType_CODE128 else barcodeType
                    val res = AutoReplyPrint.INSTANCE.CP_Pos_PrintBarcode(currentHandle, bType, data)
                    AutoReplyPrint.INSTANCE.CP_Pos_FeedLine(currentHandle, 1)
                    promise.resolve(res)
                } catch (t: Throwable) {
                    promise.reject("BARCODE_PRINT_ERROR", t.message ?: "Barcode print error", t)
                }
            }
        }

        // 11. Full Structured POS Receipt Print (Handles 1 item, 3 items, 10+ items)
        AsyncFunction("printReceipt") { receiptJson: String, paperWidth: String, promise: Promise ->
            executor.execute {
                try {
                    val currentHandle = printerHandle
                    if (currentHandle == null || currentHandle == Pointer.NULL || !isSdkAvailable()) {
                        promise.reject("NOT_CONNECTED", "Printer is not connected or SDK is unavailable", null)
                        return@execute
                    }

                    val json = JSONObject(receiptJson)
                    val is80mm = paperWidth.trim().lowercase().contains("80")
                    val widthChars = if (is80mm) 48 else 32
                    val nameCol = if (is80mm) 24 else 14
                    val priceCol = if (is80mm) 8 else 6
                    val qtyCol = 4
                    val totalCol = 8

                    AutoReplyPrint.INSTANCE.CP_Pos_ResetPrinter(currentHandle)
                    AutoReplyPrint.INSTANCE.CP_Pos_SetMultiByteMode(currentHandle)
                    AutoReplyPrint.INSTANCE.CP_Pos_SetMultiByteEncoding(currentHandle, AutoReplyPrint.CP_MultiByteEncoding_UTF8)

                    // Header
                    val storeName = json.optString("storeName", "APKA BILL STORE").trim()
                    val storeAddress = json.optString("storeAddress", "").trim()
                    val storePhone = json.optString("storePhone", "").trim()
                    val storeGstin = json.optString("storeGstin", "").trim()

                    AutoReplyPrint.INSTANCE.CP_Pos_SetAlignment(currentHandle, AutoReplyPrint.CP_Pos_Alignment_HCenter)
                    AutoReplyPrint.INSTANCE.CP_Pos_SetTextBold(currentHandle, 1)
                    AutoReplyPrint.INSTANCE.CP_Pos_SetTextScale(currentHandle, 1, 1)
                    AutoReplyPrint.INSTANCE.CP_Pos_PrintTextInUTF8(currentHandle, WString("$storeName\r\n"))

                    AutoReplyPrint.INSTANCE.CP_Pos_SetTextScale(currentHandle, 0, 0)
                    AutoReplyPrint.INSTANCE.CP_Pos_SetTextBold(currentHandle, 0)

                    if (storeAddress.isNotEmpty()) {
                        AutoReplyPrint.INSTANCE.CP_Pos_PrintTextInUTF8(currentHandle, WString("$storeAddress\r\n"))
                    }
                    if (storePhone.isNotEmpty()) {
                        AutoReplyPrint.INSTANCE.CP_Pos_PrintTextInUTF8(currentHandle, WString("Ph: $storePhone\r\n"))
                    }
                    if (storeGstin.isNotEmpty()) {
                        AutoReplyPrint.INSTANCE.CP_Pos_PrintTextInUTF8(currentHandle, WString("GSTIN: $storeGstin\r\n"))
                    }

                    // Metadata
                    val invoiceNumber = json.optString("invoiceNumber", "INV-001")
                    val date = json.optString("date", "")
                    val cashierName = json.optString("cashierName", "")
                    val customerName = json.optString("customerName", "")
                    val customerPhone = json.optString("customerPhone", "")

                    val divider = "-".repeat(widthChars) + "\r\n"
                    AutoReplyPrint.INSTANCE.CP_Pos_SetAlignment(currentHandle, AutoReplyPrint.CP_Pos_Alignment_Left)
                    AutoReplyPrint.INSTANCE.CP_Pos_PrintTextInUTF8(currentHandle, WString(divider))
                    AutoReplyPrint.INSTANCE.CP_Pos_PrintTextInUTF8(currentHandle, WString("Inv: $invoiceNumber\r\n"))
                    if (date.isNotEmpty()) {
                        AutoReplyPrint.INSTANCE.CP_Pos_PrintTextInUTF8(currentHandle, WString("Date: $date\r\n"))
                    }
                    if (customerName.isNotEmpty()) {
                        AutoReplyPrint.INSTANCE.CP_Pos_PrintTextInUTF8(currentHandle, WString("Customer: $customerName\r\n"))
                    }
                    if (customerPhone.isNotEmpty()) {
                        AutoReplyPrint.INSTANCE.CP_Pos_PrintTextInUTF8(currentHandle, WString("Phone: $customerPhone\r\n"))
                    }
                    if (cashierName.isNotEmpty()) {
                        AutoReplyPrint.INSTANCE.CP_Pos_PrintTextInUTF8(currentHandle, WString("Cashier: $cashierName\r\n"))
                    }
                    AutoReplyPrint.INSTANCE.CP_Pos_PrintTextInUTF8(currentHandle, WString(divider))

                    // Table Header
                    val headerRow = "Item".padEnd(nameCol) + "Qty".padStart(qtyCol) + "Price".padStart(priceCol) + "Total".padStart(totalCol) + "\r\n"
                    AutoReplyPrint.INSTANCE.CP_Pos_SetTextBold(currentHandle, 1)
                    AutoReplyPrint.INSTANCE.CP_Pos_PrintTextInUTF8(currentHandle, WString(headerRow))
                    AutoReplyPrint.INSTANCE.CP_Pos_SetTextBold(currentHandle, 0)
                    AutoReplyPrint.INSTANCE.CP_Pos_PrintTextInUTF8(currentHandle, WString(divider))

                    // Purchased Items Loop
                    val items = json.optJSONArray("items")
                    if (items != null) {
                        for (i in 0 until items.length()) {
                            val item = items.getJSONObject(i)
                            val name = item.optString("name", "Item").trim()
                            val qty = item.optDouble("quantity", 1.0)
                            val price = item.optDouble("unitPrice", 0.0)
                            val total = item.optDouble("total", qty * price)

                            val qtyStr = if (qty % 1.0 == 0.0) qty.toInt().toString() else String.format("%.2f", qty)
                            val priceStr = String.format("%.0f", price)
                            val totalStr = String.format("%.2f", total)

                            if (name.length <= nameCol) {
                                val row = name.padEnd(nameCol) + qtyStr.padStart(qtyCol) + priceStr.padStart(priceCol) + totalStr.padStart(totalCol) + "\r\n"
                                AutoReplyPrint.INSTANCE.CP_Pos_PrintTextInUTF8(currentHandle, WString(row))
                            } else {
                                val firstPart = name.substring(0, nameCol)
                                val restPart = name.substring(nameCol)
                                val row = firstPart.padEnd(nameCol) + qtyStr.padStart(qtyCol) + priceStr.padStart(priceCol) + totalStr.padStart(totalCol) + "\r\n"
                                AutoReplyPrint.INSTANCE.CP_Pos_PrintTextInUTF8(currentHandle, WString(row))
                                AutoReplyPrint.INSTANCE.CP_Pos_PrintTextInUTF8(currentHandle, WString("  $restPart\r\n"))
                            }
                        }
                    }
                    AutoReplyPrint.INSTANCE.CP_Pos_PrintTextInUTF8(currentHandle, WString(divider))

                    // Totals
                    val subtotal = json.optDouble("subtotal", 0.0)
                    val discount = json.optDouble("discount", 0.0)
                    val gst = json.optDouble("gst", 0.0)
                    val grandTotal = json.optDouble("grandTotal", 0.0)
                    val paymentMethod = json.optString("paymentMethod", "Cash").uppercase()

                    val labelWidth = widthChars - 14
                    AutoReplyPrint.INSTANCE.CP_Pos_PrintTextInUTF8(currentHandle, WString("Subtotal:".padEnd(labelWidth) + String.format("Rs.%.2f", subtotal).padStart(14) + "\r\n"))
                    if (discount > 0) {
                        AutoReplyPrint.INSTANCE.CP_Pos_PrintTextInUTF8(currentHandle, WString("Discount:".padEnd(labelWidth) + String.format("-Rs.%.2f", discount).padStart(14) + "\r\n"))
                    }
                    AutoReplyPrint.INSTANCE.CP_Pos_PrintTextInUTF8(currentHandle, WString("GST:".padEnd(labelWidth) + String.format("Rs.%.2f", gst).padStart(14) + "\r\n"))

                    val doubleDivider = "=".repeat(widthChars) + "\r\n"
                    AutoReplyPrint.INSTANCE.CP_Pos_PrintTextInUTF8(currentHandle, WString(doubleDivider))

                    AutoReplyPrint.INSTANCE.CP_Pos_SetTextBold(currentHandle, 1)
                    AutoReplyPrint.INSTANCE.CP_Pos_SetTextScale(currentHandle, 0, 1)
                    AutoReplyPrint.INSTANCE.CP_Pos_PrintTextInUTF8(currentHandle, WString("GRAND TOTAL:".padEnd(labelWidth) + String.format("Rs.%.2f", grandTotal).padStart(14) + "\r\n"))
                    AutoReplyPrint.INSTANCE.CP_Pos_SetTextScale(currentHandle, 0, 0)
                    AutoReplyPrint.INSTANCE.CP_Pos_SetTextBold(currentHandle, 0)

                    AutoReplyPrint.INSTANCE.CP_Pos_PrintTextInUTF8(currentHandle, WString(doubleDivider))
                    AutoReplyPrint.INSTANCE.CP_Pos_PrintTextInUTF8(currentHandle, WString("Payment: $paymentMethod\r\n"))
                    AutoReplyPrint.INSTANCE.CP_Pos_PrintTextInUTF8(currentHandle, WString(divider))

                    // QR Code (Dynamic UPI / Invoice URL)
                    val upiId = json.optString("upiId", "")
                    val qrData = json.optString("qrData", "")
                    val upiPayload = if (qrData.isNotEmpty()) qrData else if (upiId.isNotEmpty()) "upi://pay?pa=$upiId&pn=${java.net.URLEncoder.encode(storeName, "UTF-8")}&am=${String.format("%.2f", grandTotal)}&cu=INR" else ""

                    if (upiPayload.isNotEmpty()) {
                        val qrSize = if (is80mm) 4 else 3
                        AutoReplyPrint.INSTANCE.CP_Pos_FeedLine(currentHandle, 1)
                        AutoReplyPrint.INSTANCE.CP_Pos_SetAlignment(currentHandle, AutoReplyPrint.CP_Pos_Alignment_HCenter)
                        AutoReplyPrint.INSTANCE.CP_Pos_PrintQRCode(currentHandle, 0, AutoReplyPrint.CP_QRCodeECC_L, upiPayload)
                        AutoReplyPrint.INSTANCE.CP_Pos_FeedLine(currentHandle, 1)
                        if (upiId.isNotEmpty()) {
                            AutoReplyPrint.INSTANCE.CP_Pos_PrintTextInUTF8(currentHandle, WString("Scan & Pay with UPI\r\n"))
                        }
                        AutoReplyPrint.INSTANCE.CP_Pos_SetAlignment(currentHandle, AutoReplyPrint.CP_Pos_Alignment_Left)
                    }

                    // Footer
                    val footerText = json.optString("footerText", "Thank you for shopping with us!").trim()
                    if (footerText.isNotEmpty()) {
                        AutoReplyPrint.INSTANCE.CP_Pos_SetAlignment(currentHandle, AutoReplyPrint.CP_Pos_Alignment_HCenter)
                        AutoReplyPrint.INSTANCE.CP_Pos_PrintTextInUTF8(currentHandle, WString("$footerText\r\n"))
                    }

                    AutoReplyPrint.INSTANCE.CP_Pos_FeedLine(currentHandle, 3)
                    AutoReplyPrint.INSTANCE.CP_Pos_Beep(currentHandle, 1, 300)

                    // Real Hardware Paper Auto-Cut (Half Cut with Full Cut fallback, gracefully handled)
                    try {
                        val cutOk = AutoReplyPrint.INSTANCE.CP_Pos_HalfCutPaper(currentHandle)
                        if (!cutOk) {
                            AutoReplyPrint.INSTANCE.CP_Pos_FullCutPaper(currentHandle)
                        }
                    } catch (cutErr: Throwable) {
                        android.util.Log.d(TAG, "Hardware auto-cut gracefully skipped on non-cutter printer: ${cutErr.message}")
                    }

                    val printOk = AutoReplyPrint.INSTANCE.CP_Pos_QueryPrintResult(currentHandle, 15000)

                    promise.resolve(
                        mapOf(
                            "success" to true,
                            "status" to if (printOk) "READY" else "ERROR",
                            "printed" to printOk,
                            "invoiceNumber" to invoiceNumber
                        )
                    )
                } catch (t: Throwable) {
                    promise.reject("RECEIPT_PRINT_FAILED", t.message ?: "Receipt printing error", t)
                }
            }
        }

        // 12. Cut Paper (Dedicated API)
        AsyncFunction("cutPaper") { promise: Promise ->
            executor.execute {
                try {
                    val currentHandle = printerHandle
                    if (currentHandle == null || currentHandle == Pointer.NULL || !isSdkAvailable()) {
                        promise.reject("NOT_CONNECTED", "Printer is not connected or SDK is unavailable", null)
                        return@execute
                    }
                    val ok = AutoReplyPrint.INSTANCE.CP_Pos_HalfCutPaper(currentHandle) || AutoReplyPrint.INSTANCE.CP_Pos_FullCutPaper(currentHandle)
                    promise.resolve(ok)
                } catch (t: Throwable) {
                    promise.reject("CUT_ERROR", t.message ?: "Cut paper exception", t)
                }
            }
        }

        // 13. Feed and Cut Paper
        AsyncFunction("feedAndCutPaper") { promise: Promise ->
            executor.execute {
                try {
                    val currentHandle = printerHandle
                    if (currentHandle == null || currentHandle == Pointer.NULL || !isSdkAvailable()) {
                        promise.reject("NOT_CONNECTED", "Printer is not connected or SDK is unavailable", null)
                        return@execute
                    }
                    val ok = AutoReplyPrint.INSTANCE.CP_Pos_FeedAndHalfCutPaper(currentHandle) || (AutoReplyPrint.INSTANCE.CP_Pos_FeedLine(currentHandle, 3) && AutoReplyPrint.INSTANCE.CP_Pos_HalfCutPaper(currentHandle))
                    promise.resolve(ok)
                } catch (t: Throwable) {
                    promise.reject("FEED_CUT_ERROR", t.message ?: "Feed and cut paper exception", t)
                }
            }
        }

        // 14. Test Print Self-Test Ticket
        AsyncFunction("testPrint") { type: String, address: String, paperWidth: String, promise: Promise ->
            executor.execute {
                try {
                    if (!isSdkAvailable()) {
                        promise.reject("SDK_UNAVAILABLE", "AutoReplyPrint SDK native library is not available on this device", null)
                        return@execute
                    }

                    val cleanType = type.trim().uppercase()
                    val handle = when (cleanType) {
                        "BLUETOOTH", "BT_SPP" -> AutoReplyPrint.INSTANCE.CP_Port_OpenBtSpp(address, 0)
                        "BLE", "BT_BLE" -> AutoReplyPrint.INSTANCE.CP_Port_OpenBtBle(address, 0)
                        "USB" -> AutoReplyPrint.INSTANCE.CP_Port_OpenUsb(address, 0)
                        "NETWORK", "TCP" -> AutoReplyPrint.INSTANCE.CP_Port_OpenTcp(null, address, 9100.toShort(), 5000, 0)
                        else -> AutoReplyPrint.INSTANCE.CP_Port_OpenBtSpp(address, 0)
                    }

                    if (handle == null || handle == Pointer.NULL) {
                        promise.reject("TEST_CONNECT_FAILED", "Failed to connect to printer for test print at $address", null)
                        return@execute
                    }

                    AutoReplyPrint.INSTANCE.CP_Pos_ResetPrinter(handle)
                    AutoReplyPrint.INSTANCE.CP_Pos_SetMultiByteMode(handle)
                    AutoReplyPrint.INSTANCE.CP_Pos_SetMultiByteEncoding(handle, AutoReplyPrint.CP_MultiByteEncoding_UTF8)

                    AutoReplyPrint.INSTANCE.CP_Pos_SetAlignment(handle, AutoReplyPrint.CP_Pos_Alignment_HCenter)
                    AutoReplyPrint.INSTANCE.CP_Pos_SetTextBold(handle, 1)
                    AutoReplyPrint.INSTANCE.CP_Pos_SetTextScale(handle, 1, 1)
                    AutoReplyPrint.INSTANCE.CP_Pos_PrintTextInUTF8(handle, WString("APKA BILL POS\r\n"))

                    AutoReplyPrint.INSTANCE.CP_Pos_SetTextScale(handle, 0, 0)
                    AutoReplyPrint.INSTANCE.CP_Pos_SetTextBold(handle, 0)
                    AutoReplyPrint.INSTANCE.CP_Pos_PrintTextInUTF8(handle, WString("55mm/58mm Thermal Printer Test\r\n"))
                    AutoReplyPrint.INSTANCE.CP_Pos_PrintTextInUTF8(handle, WString("--------------------------------\r\n"))
                    AutoReplyPrint.INSTANCE.CP_Pos_PrintTextInUTF8(handle, WString("Status: HARDWARE CONNECTED OK\r\n"))
                    AutoReplyPrint.INSTANCE.CP_Pos_PrintTextInUTF8(handle, WString("Type: $cleanType\r\n"))
                    AutoReplyPrint.INSTANCE.CP_Pos_PrintTextInUTF8(handle, WString("Address: $address\r\n"))
                    AutoReplyPrint.INSTANCE.CP_Pos_PrintTextInUTF8(handle, WString("--------------------------------\r\n"))

                    AutoReplyPrint.INSTANCE.CP_Pos_PrintQRCode(handle, 0, AutoReplyPrint.CP_QRCodeECC_L, "https://apkabill.in")
                    AutoReplyPrint.INSTANCE.CP_Pos_FeedLine(handle, 1)
                    AutoReplyPrint.INSTANCE.CP_Pos_PrintTextInUTF8(handle, WString("One-Tap Printing Ready!\r\n"))
                    AutoReplyPrint.INSTANCE.CP_Pos_FeedLine(handle, 3)
                    AutoReplyPrint.INSTANCE.CP_Pos_Beep(handle, 2, 200)

                    try {
                        AutoReplyPrint.INSTANCE.CP_Pos_HalfCutPaper(handle)
                    } catch (cutErr: Throwable) {
                        android.util.Log.d(TAG, "Hardware auto-cut in testPrint gracefully skipped: ${cutErr.message}")
                    }

                    val ok = AutoReplyPrint.INSTANCE.CP_Pos_QueryPrintResult(handle, 10000)
                    try {
                        AutoReplyPrint.INSTANCE.CP_Port_Close(handle)
                    } catch (t: Throwable) {}

                    promise.resolve(mapOf("success" to true, "status" to "READY", "printed" to ok))
                } catch (t: Throwable) {
                    promise.reject("TEST_PRINT_ERROR", t.message ?: "Test print exception", t)
                }
            }
        }
    }
}
