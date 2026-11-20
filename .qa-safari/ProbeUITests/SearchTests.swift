import XCTest
final class SearchTests: XCTestCase {
 let safari=XCUIApplication(bundleIdentifier:"com.apple.mobilesafari")
 func shot(_ name:String){let a=XCTAttachment(screenshot:XCUIScreen.main.screenshot());a.name=name;a.lifetime = .keepAlways;add(a)}
 func dismissTips(){
  for name in ["Continue","Not Now","Maybe Later","Start Browsing","Done","xmark.circle.fill"]{let el=safari.buttons[name];if el.exists && el.isHittable{el.tap()}}
  let tip=safari.otherElements["TipView"];if tip.exists{let c=tip.buttons["Close"];if c.exists && c.isHittable{c.tap()}}
 }
 func testSearch() throws {
  continueAfterFailure=false;safari.launch();dismissTips()
  XCUIDevice.shared.system.open(URL(string:"http://localhost:4193/")!)
  sleep(6);dismissTips()
  let w=safari.webViews.firstMatch;let women=w.links.matching(NSPredicate(format:"label CONTAINS[c] %@", "Women")).firstMatch
  XCTAssertTrue(women.waitForExistence(timeout:28),safari.debugDescription.prefix(6000).description)
  shot("01-home")
  let field=w.descendants(matching:.any).matching(NSPredicate(format:"(elementType == %d OR elementType == %d OR elementType == %d OR elementType == %d) AND (label CONTAINS[c] %@ OR value CONTAINS[c] %@)",XCUIElement.ElementType.textField.rawValue,XCUIElement.ElementType.searchField.rawValue,XCUIElement.ElementType.comboBox.rawValue,XCUIElement.ElementType.other.rawValue,"Search products","Search T-shirts")).firstMatch
  let open=w.buttons.matching(NSPredicate(format:"label ==[c] %@", "Open search")).firstMatch
  if (!field.exists || !field.isHittable) && open.exists && open.isHittable{open.tap()}
  XCTAssertTrue(field.waitForExistence(timeout:8),safari.debugDescription.prefix(6500).description);field.tap()
  let keys=safari.keyboards.firstMatch
  XCTAssertTrue(keys.waitForExistence(timeout:10),safari.debugDescription.prefix(6500).description)
  let category=w.descendants(matching:.any).matching(NSPredicate(format:"label ==[c] %@", "Shop by category")).firstMatch
  XCTAssertTrue(category.waitForExistence(timeout:10),safari.debugDescription.prefix(6500).description)
  XCTAssertLessThan(category.frame.maxY,keys.frame.minY)
  sleep(1);shot("02-focused-keyboard")
  safari.typeText("black gym tee");sleep(2);shot("03-product-suggestions-keyboard")
  let row=w.descendants(matching:.any).matching(NSPredicate(format:"label BEGINSWITH[c] %@", "Compression")).firstMatch
  print("KEYBOARD_FRAME",keys.frame,"FIELD_FRAME",field.frame)
  XCTAssertTrue(row.waitForExistence(timeout:10) && row.isHittable,safari.debugDescription.prefix(8500).description)
  XCTAssertLessThanOrEqual(row.frame.maxY,keys.frame.minY+1);row.tap();sleep(2);shot("04-product-detail");print("PRODUCT_TAPPED")
 }
}
