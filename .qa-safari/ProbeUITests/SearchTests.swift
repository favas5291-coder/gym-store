import XCTest
import Vision
final class SearchTests: XCTestCase {
 let safari=XCUIApplication(bundleIdentifier:"com.apple.mobilesafari")
 func shot(_ name:String){let a=XCTAttachment(screenshot:XCUIScreen.main.screenshot());a.name=name;a.lifetime = .keepAlways;add(a)}
 func dismissTips(){
  for name in ["Continue","Not Now","Maybe Later","Start Browsing","Done","xmark.circle.fill"]{let el=safari.buttons[name];if el.exists && el.isHittable{el.tap()}}
  let tip=safari.otherElements["TipView"];if tip.exists{let c=tip.buttons["Close"];if c.exists && c.isHittable{c.tap()}}
 }
 // On a newly installed iOS 26 Safari, opening the first OS keyboard can raise
 // Apple's toolbar training tip over the list. Find its native text, then close
 // its top-right X. Website DOM hit tests cannot see this OS overlay.
 func dismissKeyboardTip() throws {
  guard let image=XCUIScreen.main.screenshot().image.cgImage else {return}
  let request=VNRecognizeTextRequest()
  request.recognitionLevel = .fast
  try VNImageRequestHandler(cgImage:image,options:[:]).perform([request])
  guard let heading=request.results?.first(where: { ($0.topCandidates(1).first?.string ?? "").localizedCaseInsensitiveContains("View Bookmarks") }) else {return}
  print("Dismissed first-run Safari keyboard tip",heading.boundingBox)
  let p=safari.coordinate(withNormalizedOffset:CGVector(dx:0.905,dy:1.0-heading.boundingBox.midY)); p.tap()
  sleep(1)
 }
 func pageState() -> [String:Any] {
  guard let d=try? Data(contentsOf:URL(string:"http://localhost:4193/qa-state?nocache="+UUID().uuidString)!),
        let result=(try? JSONSerialization.jsonObject(with:d)) as? [String:Any] else {return [:]}
  return result
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
  sleep(1);try dismissKeyboardTip();shot("02-focused-keyboard")
  safari.typeText("black gym tee");sleep(2);try dismissKeyboardTip();shot("03-product-suggestions-keyboard")
  let pre=pageState()
  let product=(pre["options"] as? [[String:Any]])?.first(where:{($0["href"] as? String ?? "").hasPrefix("/product/") && ($0["text"] as? String ?? "").contains("₹")})
  let expected=try XCTUnwrap(product?["href"] as? String)
  print("Confirmed first priced product above OS keyboard",expected,product?["text"] ?? "")
  let row=w.descendants(matching:.any).matching(NSPredicate(format:"label BEGINSWITH[c] %@", "Compression")).firstMatch
  print("KEYBOARD_FRAME",keys.frame,"FIELD_FRAME",field.frame)
  XCTAssertTrue(row.waitForExistence(timeout:10) && row.isHittable,safari.debugDescription.prefix(8500).description)
  XCTAssertLessThanOrEqual(row.frame.maxY,keys.frame.minY+1)
  // Tap the visible thumbnail/leading edge of this option at the same vertical
  // center as its native accessibility element.
  let rowTap=safari.coordinate(withNormalizedOffset:CGVector(dx:0,dy:0)).withOffset(CGVector(dx:32,dy:row.frame.midY));rowTap.tap()
  for _ in 0..<25 {if pageState()["url"] as? String == expected {break};Thread.sleep(forTimeInterval:0.25)}
  XCTAssertEqual(pageState()["url"] as? String,expected,safari.debugDescription.prefix(4500).description)
  XCTAssertFalse(keys.exists)
  sleep(2);shot("04-product-detail");print("PRODUCT_TAPPED",expected)
 }
}
