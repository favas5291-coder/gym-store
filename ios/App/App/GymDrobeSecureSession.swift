import Capacitor
import Security

@objc(GymDrobeSecureSessionPlugin)
public class GymDrobeSecureSessionPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "GymDrobeSecureSessionPlugin"
    public let jsName = "GymDrobeSecureSession"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "read", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "write", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "clear", returnType: CAPPluginReturnPromise)
    ]
    private var query: [String: Any] {
        [kSecClass as String: kSecClassGenericPassword,
         kSecAttrService as String: "com.gymdrobe.app.session",
         kSecAttrAccount as String: "customer-jwt"]
    }
    @objc func read(_ call: CAPPluginCall) {
        var request = query
        request[kSecReturnData as String] = true
        request[kSecMatchLimit as String] = kSecMatchLimitOne
        var value: CFTypeRef?
        let status = SecItemCopyMatching(request as CFDictionary, &value)
        if status == errSecItemNotFound { call.resolve([:]); return }
        guard status == errSecSuccess, let data = value as? Data,
              let token = String(data: data, encoding: .utf8) else {
            call.reject("Your secure session is unavailable. Unlock your iPhone and retry.", "KEYCHAIN_UNAVAILABLE"); return
        }
        call.resolve(["token": token])
    }
    @objc func write(_ call: CAPPluginCall) {
        guard let token = call.getString("token"), !token.isEmpty, token.utf8.count <= 16000 else {
            call.reject("Invalid session.", "SESSION_INVALID"); return
        }
        let attributes: [String: Any] = [
            kSecValueData as String: Data(token.utf8),
            kSecAttrAccessible as String: kSecAttrAccessibleWhenUnlockedThisDeviceOnly
        ]
        var status = SecItemUpdate(query as CFDictionary, attributes as CFDictionary)
        if status == errSecItemNotFound {
            status = SecItemAdd(query.merging(attributes) { _, new in new } as CFDictionary, nil)
        }
        guard status == errSecSuccess else { call.reject("Unable to save your secure session.", "KEYCHAIN_UNAVAILABLE"); return }
        call.resolve()
    }
    @objc func clear(_ call: CAPPluginCall) {
        let status = SecItemDelete(query as CFDictionary)
        guard status == errSecSuccess || status == errSecItemNotFound else {
            call.reject("Unable to remove your secure session. Unlock your iPhone and retry.", "KEYCHAIN_UNAVAILABLE"); return
        }
        call.resolve()
    }
}
