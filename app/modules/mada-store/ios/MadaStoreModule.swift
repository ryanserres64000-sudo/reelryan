import ExpoModulesCore
import StoreKit

// StoreKit 2 for the offers of core/plans.ts (app/src/plans/storekit.ts is the JS side). Apple shows
// its own sheet and charges the price set in App Store Connect. Each transaction carries the anonymous
// device id as appAccountToken, and its signed JWS is returned so the server can check it with the App
// Store Server API instead of trusting `x-mada-pro` (lib/quota.js, à faire). Not compiled yet.
public class MadaStoreModule: Module {
  private var updates: Task<Void, Never>?

  public func definition() -> ModuleDefinition {
    Name("MadaStore")
    Events("onEntitlements")

    // Renewals, refunds and purchases made elsewhere (Ask to Buy, another device) arrive here.
    OnCreate {
      self.updates = Task.detached { [weak self] in
        for await result in Transaction.updates {
          if case .verified(let tx) = result { await tx.finish() }
          let active = await activeIds()
          self?.sendEvent("onEntitlements", ["active": active])
        }
      }
    }
    OnDestroy { self.updates?.cancel() }

    AsyncFunction("products") { (ids: [String]) async throws -> [[String: Any]] in
      try await Product.products(for: ids).map { p in
        ["id": p.id, "displayPrice": p.displayPrice, "period": p.subscription.map { period($0.subscriptionPeriod) } ?? "",
         "introOffer": p.subscription?.introductoryOffer?.displayPrice ?? ""]
      }
    }

    AsyncFunction("purchase") { (id: String, appAccountToken: String) async throws -> [String: Any] in
      guard let product = try await Product.products(for: [id]).first else { throw StoreError.unknownProduct(id) }
      var options: Set<Product.PurchaseOption> = []
      if let token = UUID(uuidString: appAccountToken) { options.insert(.appAccountToken(token)) }
      switch try await product.purchase(options: options) {
      case .success(let result):
        guard case .verified(let tx) = result else { return ["status": "cancelled"] }
        await tx.finish()
        return ["status": "success", "jws": result.jwsRepresentation]
      case .pending: return ["status": "pending"]
      case .userCancelled: return ["status": "cancelled"]
      @unknown default: return ["status": "cancelled"]
      }
    }

    // « Restaurer mes achats » (règle 3.1.1): asks the App Store to sync, then reads the rights.
    AsyncFunction("restore") { () async throws -> [String: Any] in
      try await AppStore.sync()
      return ["active": await activeIds()]
    }

    AsyncFunction("entitlements") { () async -> [String: Any] in
      ["active": await activeIds(), "jws": await activeJws()]
    }
  }
}

func activeIds() async -> [String] {
  var ids: [String] = []
  for await result in Transaction.currentEntitlements {
    if case .verified(let tx) = result, tx.revocationDate == nil { ids.append(tx.productID) }
  }
  return ids
}

func activeJws() async -> [String] {
  var out: [String] = []
  for await result in Transaction.currentEntitlements { if case .verified = result { out.append(result.jwsRepresentation) } }
  return out
}

func period(_ p: Product.SubscriptionPeriod) -> String {
  switch p.unit {
  case .day: return p.value == 7 ? "semaine" : "jour"
  case .week: return "semaine"
  case .month: return "mois"
  case .year: return "an"
  @unknown default: return ""
  }
}

enum StoreError: LocalizedError {
  case unknownProduct(String)
  var errorDescription: String? { if case .unknownProduct(let id) = self { return "Produit inconnu : \(id)." }; return nil }
}
