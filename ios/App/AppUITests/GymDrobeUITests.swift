import XCTest
import UIKit

final class GymDrobeUITests: XCTestCase {
    func testShoppingTabs() {
        continueAfterFailure = false
        let app = XCUIApplication()
        app.launch()
        XCTAssertEqual(app.state, .runningForeground)
        XCTAssertTrue(app.links["Categories"].firstMatch.waitForExistence(timeout: 45))
        XCTAssertTrue(app.links["Categories"].firstMatch.isHittable)
        capture("iPhone-home", app: app)
        app.links["Categories"].firstMatch.tap()
        XCTAssertTrue(app.webViews.staticTexts["Shop by category"].firstMatch.waitForExistence(timeout: 15))
        capture("iPhone-categories", app: app)
        app.links["Search"].firstMatch.tap()
        XCTAssertTrue(app.webViews.searchFields.firstMatch.waitForExistence(timeout: 15))
        capture("iPhone-search", app: app)
        app.links["Wishlist"].firstMatch.tap()
        XCTAssertTrue(app.webViews.staticTexts["Your wishlist is waiting"].firstMatch.waitForExistence(timeout: 15))
    }
    private func capture(_ name: String, app: XCUIApplication) {
        let screenshot = app.screenshot()
        let attachment = XCTAttachment(screenshot: screenshot)
        attachment.name = name
        attachment.lifetime = .keepAlways
        add(attachment)

        // Accessibility elements can exist behind an empty visible window.
        // Catch the observed all-white captures outside the system status bar.
        guard let image = screenshot.image.cgImage else {
            XCTFail("The app screenshot could not be decoded")
            return
        }
        let width = 64, height = 128
        var pixels = [UInt8](repeating: 255, count: width * height * 4)
        let rendered = pixels.withUnsafeMutableBytes { buffer -> Bool in
            guard let context = CGContext(data: buffer.baseAddress, width: width, height: height,
                bitsPerComponent: 8, bytesPerRow: width * 4, space: CGColorSpaceCreateDeviceRGB(),
                bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue) else { return false }
            context.setFillColor(UIColor.white.cgColor)
            let bounds = CGRect(x: 0, y: 0, width: CGFloat(width), height: CGFloat(height))
            context.fill(bounds)
            context.draw(image, in: bounds)
            return true
        }
        XCTAssertTrue(rendered)
        var contentPixels = 0
        for y in 15..<115 {
            for x in 0..<width {
                let offset = (y * width + x) * 4
                if pixels[offset] < 240 || pixels[offset + 1] < 240 || pixels[offset + 2] < 240 {
                    contentPixels += 1
                }
            }
        }
        XCTAssertGreaterThan(contentPixels, 64, "The visible app must contain shopping content, not an empty window")
    }
}
