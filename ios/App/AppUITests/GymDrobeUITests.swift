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

        let cart = { (count: Int) in app.links["Cart, \(count) items"].firstMatch }
        XCTAssertTrue(cart(0).waitForExistence(timeout: 15))
        app.links["Categories"].firstMatch.tap()
        let workout = app.links["Workout clothing"].firstMatch
        XCTAssertTrue(workout.waitForExistence(timeout: 20))
        workout.tap()

        // Add one guest item from the product detail, where all variant
        // controls are available without depending on Quick Add's sheet.
        let product = app.links["View Compression Half Sleeves T-shirt"].firstMatch
        XCTAssertTrue(product.waitForExistence(timeout: 45), app.debugDescription)
        product.tap()
        let skip = app.buttons.matching(NSPredicate(format: "label ==[c] %@", "Skip for now")).firstMatch
        if skip.exists && skip.isHittable {
            skip.tap()
        }

        // WebKit exposes aria-pressed variant choices as switches.
        let black = app.webViews.switches["Colour BLACK"].firstMatch
        XCTAssertTrue(black.waitForExistence(timeout: 30), app.debugDescription)
        scrollTo(black, in: app)
        black.tap()
        let size = app.webViews.switches["Size M"].firstMatch
        XCTAssertTrue(size.waitForExistence(timeout: 10), app.debugDescription)
        scrollTo(size, in: app)
        size.tap()
        let add = app.webViews.buttons["Add to Cart"].firstMatch
        XCTAssertTrue(add.waitForExistence(timeout: 15), app.debugDescription)
        scrollTo(add, in: app)
        add.tap()
        XCTAssertTrue(cart(1).waitForExistence(timeout: 30))
        tapTab(cart(1))
        let bag = app.webViews.staticTexts["1 item in your bag"].firstMatch
        XCTAssertTrue(bag.waitForExistence(timeout: 20))
        XCTAssertTrue(app.webViews.staticTexts["Compression Half Sleeves T-shirt"].firstMatch.exists)

        tapTab(app.links["Account"].firstMatch)
        XCTAssertTrue(app.webViews.staticTexts["Your favourites. All together."].firstMatch.waitForExistence(timeout: 20))
        XCTAssertTrue(cart(1).exists, "The guest badge must survive entering Account")
        XCTAssertFalse(bag.exists)

        let leftEdge = app.coordinate(withNormalizedOffset: CGVector(dx: 0.005, dy: 0.48))
        let right = app.coordinate(withNormalizedOffset: CGVector(dx: 0.8, dy: 0.48))
        leftEdge.press(forDuration: 0.05, thenDragTo: right)
        XCTAssertTrue(bag.waitForExistence(timeout: 20), "The iPhone back gesture should return to Cart")
        XCTAssertTrue(cart(1).exists)

        let remove = app.webViews.buttons["Remove"].firstMatch
        XCTAssertTrue(remove.waitForExistence(timeout: 15), app.debugDescription)
        scrollTo(remove, in: app)
        remove.tap()
        XCTAssertTrue(cart(0).waitForExistence(timeout: 20))
        XCTAssertTrue(app.webViews.staticTexts["Your bag is empty"].firstMatch.waitForExistence(timeout: 15))
    }
    private func tapTab(_ tab: XCUIElement) {
        // The visible WebKit link can lack an XCTest activation point after
        // scrolling. Tap its rendered centre and assert the destination.
        XCTAssertTrue(tab.waitForExistence(timeout: 15))
        tab.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.5)).tap()
    }

    private func scrollTo(_ element: XCUIElement, in app: XCUIApplication) {
        let lower = app.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.75))
        let upper = app.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.32))
        for _ in 0..<6 {
            if element.isHittable { return }
            lower.press(forDuration: 0.05, thenDragTo: upper)
        }
        XCTAssertTrue(element.isHittable, app.debugDescription)
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
