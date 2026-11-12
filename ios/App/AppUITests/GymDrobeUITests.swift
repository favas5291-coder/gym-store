import XCTest
import UIKit

final class GymDrobeUITests: XCTestCase {
    func testShoppingTabs() {
        continueAfterFailure = false
        let app = XCUIApplication()
        app.launch()
        XCTAssertEqual(app.state, .runningForeground)
        let categories = app.links["Categories"].firstMatch
        XCTAssertTrue(categories.waitForExistence(timeout: 45))
        XCTAssertTrue(categories.isHittable)
        capture("iPhone-home", app: app)
        tapShoppingTab(categories, app: app)
        XCTAssertTrue(app.webViews.links["Explore all products"].firstMatch.waitForExistence(timeout: 15),
                      "Tapping Categories must open the Categories screen")
        XCTAssertTrue(app.webViews.staticTexts["Shop by category"].firstMatch.waitForExistence(timeout: 15))
        XCTAssertTrue(app.webViews.staticTexts["Workout clothing"].firstMatch.waitForExistence(timeout: 60), "Capture a loaded collection, not the catalogue loading state")
        capture("iPhone-categories", app: app)
        XCTAssertFalse(app.buttons["Search by photo"].firstMatch.exists, "Free release must hide deferred photo search")
        tapShoppingTab(app.links["Wishlist"].firstMatch, app: app)
        XCTAssertTrue(app.webViews.staticTexts["Your wishlist is waiting"].firstMatch.waitForExistence(timeout: 15))
    }

    private func tapShoppingTab(_ tab: XCUIElement, app: XCUIApplication) {
        XCTAssertTrue(tab.isHittable)
        let navigation = app.webViews.otherElements.matching(
            NSPredicate(format: "label BEGINSWITH %@", "Shopping navigation")
        ).firstMatch
        XCTAssertTrue(navigation.exists)
        // WebKit can report just the text label as the link's frame. Tap the
        // visible icon within the same tab, above the label and system edge.
        let point = CGPoint(x: tab.frame.midX, y: navigation.frame.minY + 21)
        XCTAssertTrue(navigation.frame.contains(point))
        let window = app.windows.firstMatch
        window.coordinate(withNormalizedOffset: .zero)
            .withOffset(CGVector(dx: point.x - window.frame.minX, dy: point.y - window.frame.minY))
            .tap()
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
