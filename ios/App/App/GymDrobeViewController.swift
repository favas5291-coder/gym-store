import Capacitor

class GymDrobeViewController: CAPBridgeViewController {
    override func capacitorDidLoad() {
        bridge?.registerPluginInstance(GymDrobeSecureSessionPlugin())
        bridge?.registerPluginInstance(GymDrobeCheckoutPlugin())
        bridge?.registerPluginInstance(GymDrobeAppleSignInPlugin())
        webView?.allowsBackForwardNavigationGestures = true
    }
}
