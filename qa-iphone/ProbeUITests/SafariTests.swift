import XCTest

final class SafariTests: XCTestCase {
    let safari = XCUIApplication(bundleIdentifier: "com.apple.mobilesafari")

    func shot(_ name: String) {
        let attachment = XCTAttachment(screenshot: XCUIScreen.main.screenshot())
        attachment.name = name
        attachment.lifetime = .keepAlways
        add(attachment)
    }

    func named(_ app: XCUIApplication, _ name: String) -> XCUIElement {
        app.descendants(matching: .any).matching(NSPredicate(format: "label ==[c] %@", name)).firstMatch
    }

    func testHomeLaunch() throws {
        continueAfterFailure = false
        safari.launch()
        for name in ["Continue", "Not Now", "Maybe Later", "Start Browsing", "Done"] {
            let button = safari.buttons[name]
            if button.exists && button.isHittable { button.tap() }
        }
        XCUIDevice.shared.system.open(URL(string: "http://localhost:4193/")!)
        sleep(1)
        shot("Safari first visit")
        sleep(7)
        if !safari.webViews.firstMatch.exists { print("SAFARI_BEFORE_DISMISS", safari.debugDescription.prefix(4800)) }
        for name in ["Continue", "Not Now", "Maybe Later", "Start Browsing", "Done"] {
            let button = safari.buttons[name]
            if button.exists && button.isHittable { button.tap() }
        }
        shot("Safari homepage")
        let women = safari.links.matching(NSPredicate(format: "label CONTAINS[c] %@", "Women")).firstMatch
        XCTAssertTrue(women.waitForExistence(timeout: 14), "Women's link inaccessible in Mobile Safari: \(safari.debugDescription.prefix(6500))")
        print("SAFARI_HOME_OK", women.label)
        var share = named(safari, "Share")
        if !share.exists || !share.isHittable {
            let menu = safari.buttons.matching(NSPredicate(format: "label CONTAINS[c] %@ OR label CONTAINS[c] %@", "More", "Page Menu")).firstMatch
            if menu.exists && menu.isHittable { menu.tap() }
            share = named(safari, "Share")
        }
        XCTAssertTrue(share.waitForExistence(timeout: 4) && share.isHittable, "Share menu unavailable: \(safari.debugDescription.prefix(6500))")
        share.tap()
        let spring = XCUIApplication(bundleIdentifier: "com.apple.springboard")
        var action = named(safari, "Add to Home Screen")
        for _ in 0..<4 {
            if action.exists && action.isHittable { break }
            let springAction = named(spring, "Add to Home Screen")
            if springAction.exists && springAction.isHittable { action = springAction; break }
            let more = named(safari, "View More")
            if more.exists && more.isHittable { more.tap() } else { safari.swipeUp() }
            action = named(safari, "Add to Home Screen")
        }
        shot("Share sheet")
        XCTAssertTrue(action.exists && action.isHittable, "Home Screen action unavailable: \(safari.debugDescription.prefix(7000))")
        action.tap()
        var addButton = safari.buttons["Add"]
        if !addButton.waitForExistence(timeout: 3) { addButton = spring.buttons["Add"] }
        XCTAssertTrue(addButton.waitForExistence(timeout: 4))
        addButton.tap()
        sleep(1)
        XCUIDevice.shared.press(.home)
        let icon = spring.icons.matching(NSPredicate(format: "label BEGINSWITH[c] %@", "GymDrobe")).firstMatch
        if !icon.waitForExistence(timeout: 3) { spring.swipeLeft() }
        XCTAssertTrue(icon.waitForExistence(timeout: 4), "Installed icon not found: \(spring.debugDescription.prefix(5000))")
        shot("Installed shortcut")
        icon.tap()
        sleep(1)
        shot("Shortcut launch")
        sleep(7)
        shot("Shortcut storefront")
        print("HOME_SCREEN_ICON_LAUNCHED")
    }
}
