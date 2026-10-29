import XCTest

final class GymDrobeUITests: XCTestCase {
    func testShoppingTabs() {
        continueAfterFailure = false
        let app = XCUIApplication()
        app.launch()
        XCTAssertTrue(app.links["Categories"].firstMatch.waitForExistence(timeout: 45))
        capture("iPhone-home")
        app.links["Categories"].firstMatch.tap()
        XCTAssertTrue(app.webViews.staticTexts["Shop by category"].firstMatch.waitForExistence(timeout: 15))
        capture("iPhone-categories")
        app.links["Search"].firstMatch.tap()
        XCTAssertTrue(app.webViews.searchFields.firstMatch.waitForExistence(timeout: 15))
        capture("iPhone-search")
        app.links["Wishlist"].firstMatch.tap()
        XCTAssertTrue(app.webViews.staticTexts.matching(NSPredicate(format: "label BEGINSWITH %@", "My wishlist")).firstMatch.waitForExistence(timeout: 15))
    }
    private func capture(_ name: String) {
        let screenshot = XCTAttachment(screenshot: XCUIScreen.main.screenshot())
        screenshot.name = name
        screenshot.lifetime = .keepAlways
        add(screenshot)
    }
}
