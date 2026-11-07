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
        XCTAssertTrue(app.webViews.staticTexts["Workout clothing"].firstMatch.waitForExistence(timeout: 60), "Capture a loaded collection, not the catalogue loading state")
        capture("iPhone-categories", app: app)
        XCTAssertFalse(app.buttons["Search by photo"].firstMatch.exists, "Free release must hide deferred photo search")
        app.links["Wishlist"].firstMatch.tap()
        XCTAssertTrue(app.webViews.staticTexts["Your wishlist is waiting"].firstMatch.waitForExistence(timeout: 15))

    }

    func testCartAccountAndBack() {
        continueAfterFailure = false
        let app = XCUIApplication()
        app.launch()
        XCTAssertEqual(app.state, .runningForeground)

        let cart = app.links["Cart, 0 items"].firstMatch
        tapTab(cart)
        let emptyBag = app.webViews.staticTexts["Your bag is empty"].firstMatch
        XCTAssertTrue(emptyBag.waitForExistence(timeout: 20), app.debugDescription)

        tapTab(app.links["Account"].firstMatch)
        XCTAssertTrue(app.webViews.staticTexts["Your favourites. All together."].firstMatch.waitForExistence(timeout: 20), app.debugDescription)
        XCTAssertTrue(cart.exists)
        XCTAssertFalse(emptyBag.exists)

        let leftEdge = app.coordinate(withNormalizedOffset: CGVector(dx: 0.005, dy: 0.48))
        let right = app.coordinate(withNormalizedOffset: CGVector(dx: 0.8, dy: 0.48))
        leftEdge.press(forDuration: 0.05, thenDragTo: right)
        XCTAssertTrue(emptyBag.waitForExistence(timeout: 20), app.debugDescription)
        XCTAssertTrue(cart.exists)
    }

    private func tapTab(_ tab: XCUIElement) {
        // WebKit's link frame can cover only the label. The centre of the
        // visible tab icon sits just above it inside the same touch target.
        XCTAssertTrue(tab.waitForExistence(timeout: 45), app.debugDescription)
        tab.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.5))
            .withOffset(CGVector(dx: 0, dy: -20)).tap()
    }

    private func capture(_ name: String, app: XCUIApplication) {
        // A WebKit accessibility tree can arrive before its first composited
        // frame. Wait for visible pixels too, with the same nonblank threshold.
        // A persistently white app must still fail and retain its evidence.
        let visible = NSPredicate { _, _ in
            (self.contentPixelCount(app.screenshot()) ?? 0) > 64
        }
        let rendered = XCTWaiter.wait(for: [XCTNSPredicateExpectation(predicate: visible, object: nil)], timeout: 15)
        let screenshot = app.screenshot()
        let attachment = XCTAttachment(screenshot: screenshot)
        attachment.name = name
        attachment.lifetime = .keepAlways
        add(attachment)
        if rendered != .completed {
            let display = XCTAttachment(screenshot: XCUIScreen.main.screenshot())
            display.name = name + "-full-display-failure"
            display.lifetime = .keepAlways
            add(display)
            let hierarchy = XCTAttachment(string: app.debugDescription)
            hierarchy.name = name + "-accessibility-failure"
            hierarchy.lifetime = .keepAlways
            add(hierarchy)
        }
        XCTAssertEqual(rendered, .completed, "Shopping content must become visible within 15 seconds after its controls exist")
        XCTAssertGreaterThan(contentPixelCount(screenshot) ?? 0, 64, "The visible app must contain shopping content, not an empty window")
    }

    private func contentPixelCount(_ screenshot: XCUIScreenshot) -> Int? {
        // Accessibility elements can exist behind an empty visible window.
        // Catch the observed all-white captures outside the system status bar.
        guard let image = screenshot.image.cgImage else {
            return nil
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
        guard rendered else { return nil }
        var contentPixels = 0
        for y in 15..<115 {
            for x in 0..<width {
                let offset = (y * width + x) * 4
                if pixels[offset] < 240 || pixels[offset + 1] < 240 || pixels[offset + 2] < 240 {
                    contentPixels += 1
                }
            }
        }
        return contentPixels
    }
}
