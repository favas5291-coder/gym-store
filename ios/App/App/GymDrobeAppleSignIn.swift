import AuthenticationServices
import Capacitor

@objc(GymDrobeAppleSignInPlugin)
public class GymDrobeAppleSignInPlugin: CAPPlugin, CAPBridgedPlugin, ASAuthorizationControllerDelegate, ASAuthorizationControllerPresentationContextProviding {
    public let identifier = "GymDrobeAppleSignInPlugin"
    public let jsName = "GymDrobeAppleSignIn"
    public let pluginMethods: [CAPPluginMethod] = [CAPPluginMethod(name: "signIn", returnType: CAPPluginReturnPromise)]
    private var anchor = ASPresentationAnchor()
    private var pending: CAPPluginCall?
    private var controller: ASAuthorizationController?
    @objc func signIn(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            guard self.pending == nil else { call.reject("Sign-in is already open.", "APPLE_BUSY"); return }
            guard let nonce = call.getString("nonce"), nonce.count == 64, nonce.allSatisfy({ $0.isHexDigit }), self.bridge?.viewController?.view.window != nil else {
                call.reject("Start a new Apple sign-in attempt.", "SIGNIN_RESTART_REQUIRED"); return
            }
            self.anchor = self.bridge!.viewController!.view.window!
            self.pending = call
            let request = ASAuthorizationAppleIDProvider().createRequest()
            request.requestedScopes = [.fullName, .email]
            request.nonce = nonce
            self.controller = ASAuthorizationController(authorizationRequests: [request])
            self.controller?.delegate = self
            self.controller?.presentationContextProvider = self
            self.controller?.performRequests()
        }
    }
    public func presentationAnchor(for controller: ASAuthorizationController) -> ASPresentationAnchor {
        anchor
    }
    public func authorizationController(controller: ASAuthorizationController, didCompleteWithAuthorization authorization: ASAuthorization) {
        defer { pending = nil; self.controller = nil }
        guard let result = authorization.credential as? ASAuthorizationAppleIDCredential,
              let data = result.authorizationCode, let code = String(data: data, encoding: .utf8) else {
            pending?.reject("Apple did not return authorization.", "APPLE_VERIFICATION_FAILED"); return
        }
        var name = ""
        if let components = result.fullName { name = PersonNameComponentsFormatter().string(from: components) }
        // Identity, email and nonce are verified by the backend using this single-use code.
        pending?.resolve(["code": code, "name": name])
    }
    public func authorizationController(controller: ASAuthorizationController, didCompleteWithError error: Error) {
        let cancelled = (error as? ASAuthorizationError)?.code == .canceled
        pending?.reject(cancelled ? "Apple sign-in cancelled." : "Apple sign-in did not complete. Please retry.", cancelled ? "APPLE_CANCELLED" : "APPLE_VERIFICATION_FAILED")
        pending = nil; self.controller = nil
    }
}
