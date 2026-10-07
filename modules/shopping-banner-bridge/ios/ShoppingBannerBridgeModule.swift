import ExpoModulesCore
import Foundation

public class ShoppingBannerBridgeModule: Module {
  public func definition() -> ModuleDefinition {
    Name("ShoppingBannerBridge")

    Function("drainPendingCheckOffIds") { () -> [String] in
      ShoppingBannerStore.drainPendingCheckOffIds()
    }

    Function("pendingCheckOffIds") { () -> [String] in
      ShoppingBannerStore.pendingCheckOffIds()
    }
  }
}
