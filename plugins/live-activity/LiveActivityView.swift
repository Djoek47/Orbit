// ChoreMaxx's own Lock Screen view for the shopping run.
// Replaces expo-live-activity's generic template (plugins/with-shopping-live-activity.js copies
// this over it at prebuild). Subtitle protocol (see lib/grocery/shopping-banner-copy.ts):
//   line 0     = "3 of 8 · Deli & Prepared"
//   lines 1…n  = "#id:<uuid>|🧀 Swiss Cheese" (id optional for legacy lines)
//   last #pK   = page index shown on the Lock Screen (Next/Previous intents flip it)
import ActivityKit
import AppIntents
import SwiftUI
import WidgetKit

#if canImport(ActivityKit)

  private enum CMX {
    static let ember = Color(hex: "#FF7A45")
    static let gold = Color(hex: "#F2C14E")
    static let ink = Color(hex: "#F7F2EC")
    static let soft = Color(hex: "#C9B8AA")
    static let faint = Color(hex: "#8E7F74")
    static let chip = Color.white.opacity(0.10)
    static let chipStrong = Color.white.opacity(0.14)
    /// Lock Screen height is tiny — 2 rows + brand fits; 3 clipped the logo.
    static let pageSize = 2
    static let rowHeight: CGFloat = 34
  }

  struct BannerItem: Identifiable, Equatable {
    /// Grocery row id — empty on legacy lines that can't check off.
    let groceryId: String
    let label: String
    /// ForEach identity (grocery id when present, else the packed line).
    let id: String
  }

  /// Parse / rewrite the subtitle page marker without opening the app.
  enum ShoppingBannerCodec {
    static func lines(from subtitle: String?) -> [String] {
      (subtitle ?? "")
        .split(separator: "\n", omittingEmptySubsequences: true)
        .map(String.init)
    }

    static func pageIndex(from subtitle: String?) -> Int {
      let all = lines(from: subtitle)
      guard let marker = all.last, marker.hasPrefix("#p"),
            let value = Int(marker.dropFirst(2))
      else { return 0 }
      return max(0, value)
    }

    static func head(from subtitle: String?) -> String {
      lines(from: subtitle).first ?? ""
    }

    static func parseItem(_ line: String) -> BannerItem {
      if line.hasPrefix("#id:") {
        let body = String(line.dropFirst(4))
        if let bar = body.firstIndex(of: "|") {
          let groceryId = String(body[..<bar])
          let label = String(body[body.index(after: bar)...])
          let key = groceryId.isEmpty ? line : groceryId
          return BannerItem(groceryId: groceryId, label: label, id: key)
        }
      }
      return BannerItem(groceryId: "", label: line, id: line)
    }

    static func items(from subtitle: String?) -> [BannerItem] {
      let all = lines(from: subtitle)
      guard !all.isEmpty else { return [] }
      let body = all.dropFirst().filter { !$0.hasPrefix("#p") }
      // Trailing "+N more" is overflow past the packed cap — keep it out of the pager rows.
      return body.filter { !$0.hasPrefix("+") }.map(parseItem)
    }

    static func overflowLabel(from subtitle: String?) -> String? {
      lines(from: subtitle).first { $0.hasPrefix("+") && !$0.hasPrefix("#p") }
    }

    static func pageCount(itemCount: Int) -> Int {
      max(1, Int(ceil(Double(max(itemCount, 1)) / Double(CMX.pageSize))))
    }

    static func positiveMod(_ value: Int, _ modulus: Int) -> Int {
      guard modulus > 0 else { return 0 }
      let r = value % modulus
      return r >= 0 ? r : r + modulus
    }

    static func withPage(_ subtitle: String?, page: Int) -> String {
      let withoutMarker = lines(from: subtitle).filter { !$0.hasPrefix("#p") }
      return (withoutMarker + ["#p\(max(0, page))"]).joined(separator: "\n")
    }

    static func shiftPage(_ subtitle: String?, by delta: Int) -> String? {
      guard let subtitle, !subtitle.isEmpty else { return nil }
      let itemCount = items(from: subtitle).count
      guard itemCount > CMX.pageSize else { return nil }
      let pages = pageCount(itemCount: itemCount)
      let current = pageIndex(from: subtitle)
      let next = positiveMod(current + delta, pages)
      return withPage(subtitle, page: next)
    }

    /// "3 of 8 · Deli & Prepared" → done, total, aisle, left count string
    static func parsedHead(_ head: String) -> (done: Int, total: Int, left: String, aisle: String?) {
      let parts = head.components(separatedBy: " · ")
      let counts = (parts.first ?? "").components(separatedBy: " of ")
      let done = Int(counts.first ?? "") ?? 0
      let total = counts.count > 1 ? (Int(counts[1]) ?? 0) : 0
      let left = total > 0 ? String(max(0, total - done)) : ""
      return (done, total, left, parts.count > 1 ? parts[1] : nil)
    }

    /// Remove one checked item, bump the head count, clamp the page.
    static func checkOff(_ subtitle: String?, itemId: String) -> (subtitle: String, progress: Double)? {
      guard let subtitle, !subtitle.isEmpty, !itemId.isEmpty else { return nil }
      let all = lines(from: subtitle)
      guard let headLine = all.first else { return nil }

      var kept: [String] = []
      var removed = false
      for line in all.dropFirst() {
        if line.hasPrefix("#p") { continue }
        if line.hasPrefix("+") {
          kept.append(line)
          continue
        }
        let item = parseItem(line)
        if !removed && item.groceryId == itemId {
          removed = true
          continue
        }
        kept.append(line)
      }
      guard removed else { return nil }

      let parsed = parsedHead(headLine)
      let done = min(parsed.total, parsed.done + 1)
      let total = parsed.total
      let aisle = parsed.aisle ?? "Keep going"
      let progress = total > 0 ? Double(done) / Double(total) : 1

      if done >= total || kept.filter({ !$0.hasPrefix("+") }).isEmpty {
        return ("All picked up — nice one", 1)
      }

      let newHead = "\(done) of \(total) · \(aisle)"
      let itemLines = kept.filter { !$0.hasPrefix("+") }
      let overflow = kept.first { $0.hasPrefix("+") }
      var page = pageIndex(from: subtitle)
      let pages = pageCount(itemCount: itemLines.count)
      if page >= pages { page = max(0, pages - 1) }

      var next = [newHead] + itemLines
      if let overflow { next.append(overflow) }
      next.append("#p\(page)")
      return (next.joined(separator: "\n"), progress)
    }
  }

  // MARK: - Intents (iOS 17+): page + check-off without opening the app

  @available(iOS 17.0, *)
  struct ShoppingBannerPageIntent: LiveActivityIntent {
    static var title: LocalizedStringResource = "Show more shopping items"
    static var openAppWhenRun: Bool = false
    static var isDiscoverable: Bool = false

    @Parameter(title: "Delta")
    var delta: Int

    init() { delta = 1 }
    init(delta: Int) { self.delta = delta }

    func perform() async throws -> some IntentResult {
      for activity in Activity<LiveActivityAttributes>.activities {
        guard
          let nextSubtitle = ShoppingBannerCodec.shiftPage(activity.content.state.subtitle, by: delta)
        else { continue }
        let state = activity.content.state
        let updated = LiveActivityAttributes.ContentState(
          title: state.title,
          subtitle: nextSubtitle,
          timerEndDateInMilliseconds: state.timerEndDateInMilliseconds,
          progress: state.progress,
          imageName: state.imageName,
          dynamicIslandImageName: state.dynamicIslandImageName
        )
        await activity.update(ActivityContent(state: updated, staleDate: nil))
      }
      return .result()
    }
  }

  @available(iOS 17.0, *)
  struct ShoppingBannerCheckOffIntent: LiveActivityIntent {
    static var title: LocalizedStringResource = "Check off shopping item"
    static var openAppWhenRun: Bool = false
    static var isDiscoverable: Bool = false

    @Parameter(title: "Item ID")
    var itemId: String

    init() { itemId = "" }
    init(itemId: String) { self.itemId = itemId }

    func perform() async throws -> some IntentResult {
      let id = itemId.trimmingCharacters(in: .whitespacesAndNewlines)
      guard !id.isEmpty else { return .result() }
      ShoppingBannerStore.enqueueCheckOff(id)

      for activity in Activity<LiveActivityAttributes>.activities {
        guard let next = ShoppingBannerCodec.checkOff(activity.content.state.subtitle, itemId: id)
        else { continue }
        let state = activity.content.state
        let updated = LiveActivityAttributes.ContentState(
          title: state.title,
          subtitle: next.subtitle,
          timerEndDateInMilliseconds: state.timerEndDateInMilliseconds,
          progress: next.progress,
          imageName: state.imageName,
          dynamicIslandImageName: state.dynamicIslandImageName
        )
        await activity.update(ActivityContent(state: updated, staleDate: nil))
      }
      return .result()
    }
  }

  // MARK: - View

  struct LiveActivityView: View {
    let contentState: LiveActivityAttributes.ContentState
    let attributes: LiveActivityAttributes

    private var head: String { ShoppingBannerCodec.head(from: contentState.subtitle) }
    private var allItems: [BannerItem] { ShoppingBannerCodec.items(from: contentState.subtitle) }
    private var page: Int { ShoppingBannerCodec.pageIndex(from: contentState.subtitle) }
    private var pages: Int { ShoppingBannerCodec.pageCount(itemCount: allItems.count) }
    private var pageItems: [BannerItem] {
      let start = page * CMX.pageSize
      return Array(allItems.dropFirst(start).prefix(CMX.pageSize))
    }

    private var parsed: (done: Int, total: Int, left: String, aisle: String?) {
      ShoppingBannerCodec.parsedHead(head)
    }

    private var finished: Bool {
      allItems.isEmpty && (head.hasPrefix("All picked") || !head.contains(" of "))
    }

    var body: some View {
      // Compact on purpose: Lock Screen clips tall Live Activities and hid our brand.
      // No scroll (Apple forbids it) — page chevrons flip 2-item pages instead.
      ZStack(alignment: .topLeading) {
        LinearGradient(
          colors: [CMX.ember.opacity(0.28), Color.clear],
          startPoint: .topLeading, endPoint: .bottomTrailing
        )
        // Ember hairline so the banner reads as ChoreMaxx even when clipped oddly.
        Capsule()
          .fill(CMX.ember)
          .frame(width: 36, height: 3)
          .padding(.leading, 14)
          .padding(.top, 6)

        VStack(alignment: .leading, spacing: 8) {
          header
          progress
          if finished {
            finishedBlock
          } else {
            checklist
            pager
          }
        }
        .padding(.horizontal, 12)
        .padding(.top, 12)
        .padding(.bottom, 10)
      }
      .animation(.snappy(duration: 0.28), value: contentState.progress)
      .animation(.snappy(duration: 0.28), value: contentState.subtitle)
    }

    private var header: some View {
      HStack(alignment: .center, spacing: 8) {
        Image("choremaxx_mark")
          .resizable()
          .scaledToFit()
          .frame(width: 26, height: 26)
          .clipShape(RoundedRectangle(cornerRadius: 7, style: .continuous))

        VStack(alignment: .leading, spacing: 1) {
          Text("ChoreMaxx")
            .font(.system(size: 10, weight: .heavy, design: .rounded))
            .tracking(0.6)
            .textCase(.uppercase)
            .foregroundStyle(CMX.ember)
            .lineLimit(1)
          Text(contentState.title)
            .font(.system(size: 15, weight: .bold, design: .rounded))
            .foregroundStyle(CMX.ink)
            .lineLimit(1)
            .minimumScaleFactor(0.8)
          if let aisle = parsed.aisle, !finished {
            Text(aisle)
              .font(.system(size: 11, weight: .semibold, design: .rounded))
              .foregroundStyle(CMX.gold)
              .lineLimit(1)
          }
        }

        Spacer(minLength: 6)

        if !parsed.left.isEmpty && !finished {
          VStack(alignment: .trailing, spacing: 0) {
            Text(parsed.left)
              .font(.system(size: 22, weight: .heavy, design: .rounded))
              .foregroundStyle(CMX.ember)
              .monospacedDigit()
              .contentTransition(.numericText())
            Text("left")
              .font(.system(size: 9, weight: .bold, design: .rounded))
              .tracking(0.7)
              .textCase(.uppercase)
              .foregroundStyle(CMX.faint)
          }
          .frame(minWidth: 36, alignment: .trailing)
        } else if finished {
          Image(systemName: "checkmark.circle.fill")
            .font(.system(size: 22))
            .foregroundStyle(CMX.gold)
        }
      }
      // Only the header opens the app — rows and pager keep their own intents.
      .applyWidgetURL(from: attributes.deepLinkUrl)
    }

    private var progress: some View {
      GeometryReader { geo in
        ZStack(alignment: .leading) {
          Capsule().fill(Color.white.opacity(0.10))
          Capsule()
            .fill(
              LinearGradient(
                colors: [CMX.ember, CMX.gold],
                startPoint: .leading, endPoint: .trailing
              )
            )
            .frame(
              width: max(
                8,
                geo.size.width * CGFloat(min(1, max(0, contentState.progress ?? 0)))
              )
            )
        }
      }
      .frame(height: 4)
    }

    private var finishedBlock: some View {
      HStack(spacing: 8) {
        Image(systemName: "checkmark.circle.fill")
          .font(.system(size: 16, weight: .semibold))
          .foregroundStyle(CMX.gold)
        Text(head.isEmpty ? "All picked up" : head)
          .font(.system(size: 13, weight: .semibold, design: .rounded))
          .foregroundStyle(CMX.ink)
          .lineLimit(2)
        Spacer(minLength: 0)
      }
      .padding(.horizontal, 10)
      .padding(.vertical, 10)
      .frame(maxWidth: .infinity, alignment: .leading)
      .background(CMX.chip, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
    }

    private var checklist: some View {
      VStack(alignment: .leading, spacing: 5) {
        ForEach(pageItems) { item in
          row(for: item)
        }
      }
    }

    @ViewBuilder
    private func row(for item: BannerItem) -> some View {
      let label = Text(item.label)
        .font(.system(size: 13, weight: .semibold, design: .rounded))
        .foregroundStyle(CMX.ink)
        .lineLimit(1)
        .minimumScaleFactor(0.8)

      let body = HStack(spacing: 10) {
        Circle()
          .strokeBorder(CMX.soft.opacity(0.55), lineWidth: 1.5)
          .frame(width: 18, height: 18)
        label
        Spacer(minLength: 0)
      }
      .padding(.horizontal, 10)
      .frame(maxWidth: .infinity, minHeight: CMX.rowHeight, alignment: .leading)
      .background(CMX.chip, in: RoundedRectangle(cornerRadius: 11, style: .continuous))

      if #available(iOS 17.0, *), !item.groceryId.isEmpty {
        Button(intent: ShoppingBannerCheckOffIntent(itemId: item.groceryId)) {
          body
        }
        .buttonStyle(.plain)
      } else {
        body
      }
    }

    @ViewBuilder
    private var pager: some View {
      let canPage = allItems.count > CMX.pageSize
      HStack(spacing: 6) {
        if canPage {
          if #available(iOS 17.0, *) {
            Button(intent: ShoppingBannerPageIntent(delta: -1)) {
              Image(systemName: "chevron.left")
                .font(.system(size: 11, weight: .bold))
                .foregroundStyle(CMX.ink)
                .frame(width: 28, height: 28)
                .background(CMX.chipStrong, in: Circle())
            }
            .buttonStyle(.plain)
          }
          // Dot strip — the "scroll illusion" without a real scroll view.
          HStack(spacing: 4) {
            ForEach(0..<pages, id: \.self) { index in
              Capsule()
                .fill(index == page ? CMX.ember : CMX.faint.opacity(0.55))
                .frame(width: index == page ? 12 : 5, height: 5)
            }
          }
          .animation(.snappy(duration: 0.22), value: page)
          if #available(iOS 17.0, *) {
            Button(intent: ShoppingBannerPageIntent(delta: 1)) {
              Image(systemName: "chevron.right")
                .font(.system(size: 11, weight: .bold))
                .foregroundStyle(CMX.ink)
                .frame(width: 28, height: 28)
                .background(CMX.chipStrong, in: Circle())
            }
            .buttonStyle(.plain)
          }
        } else {
          Text(allItems.isEmpty ? "List clear" : "\(allItems.count) to pick up")
            .font(.system(size: 11, weight: .semibold, design: .rounded))
            .foregroundStyle(CMX.faint)
        }

        Spacer(minLength: 6)

        Text("Open")
          .font(.system(size: 11, weight: .bold, design: .rounded))
          .foregroundStyle(CMX.gold)
          .padding(.horizontal, 10)
          .padding(.vertical, 6)
          .background(CMX.gold.opacity(0.16), in: Capsule())
          .applyWidgetURL(from: attributes.deepLinkUrl)
      }
    }
  }

  /// App Group queue for Lock Screen check-offs.
  /// Lives in this file (not a separate .swift) so expo-live-activity's target
  /// compiles it — copying a new file into ios/LiveActivity/ does not add it to
  /// the Xcode Compile Sources list.
  enum ShoppingBannerStore {
    static let appGroupId = "group.app.choremaxx.household"
    static let pendingKey = "shopping.pendingCheckOffIds"

    private static var defaults: UserDefaults? {
      UserDefaults(suiteName: appGroupId)
    }

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

    static func drainPendingCheckOffIds() -> [String] {
      let pending = pendingCheckOffIds()
      defaults?.removeObject(forKey: pendingKey)
      defaults?.synchronize()
      return pending
    }
  }

#endif
