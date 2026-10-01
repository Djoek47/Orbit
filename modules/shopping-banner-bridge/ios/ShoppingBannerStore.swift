// Shared store between the shopping Live Activity (widget) and the main app.
// Check-offs tapped on the Lock Screen land here; the app drains them into the grocery list.
import Foundation

enum ShoppingBannerStore {
  static let appGroupId = "group.app.choremaxx.household"
  static let pendingKey = "shopping.pendingCheckOffIds"

  private static var defaults: UserDefaults? {
    UserDefaults(suiteName: appGroupId)
  }

  /// Queue an item id checked off on the Lock Screen.
  static func enqueueCheckOff(_ itemId: String) {
    let id = itemId.trimmingCharacters(in: .whitespacesAndNewlines)
    guard !id.isEmpty else { return }
    var pending = pendingCheckOffIds()
    if pending.contains(id) { return }
    pending.append(id)
    defaults?.set(pending, forKey: pendingKey)
    defaults?.synchronize()
  }

  static func pendingCheckOffIds() -> [String] {
    (defaults?.array(forKey: pendingKey) as? [String]) ?? []
  }

  /// Take every pending id and clear the queue. Empty when App Groups aren't provisioned yet.
  static func drainPendingCheckOffIds() -> [String] {
    let pending = pendingCheckOffIds()
    defaults?.removeObject(forKey: pendingKey)
    defaults?.synchronize()
    return pending
  }
}
