// ChoreMaxx's own Lock Screen view for the shopping run.
// Replaces expo-live-activity's generic template (plugins/with-shopping-live-activity.js copies
// this over it at prebuild). Subtitle protocol (see lib/grocery/shopping-banner-copy.ts):
//   line 0     = "3 of 8 · Deli & Prepared"
//   lines 1…n  = remaining items ("🧀 Swiss Cheese"), optionally a final "+N more"
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
    static let pageSize = 3
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

    static func items(from subtitle: String?) -> [String] {
      let all = lines(from: subtitle)
      guard !all.isEmpty else { return [] }
      let body = all.dropFirst().filter { !$0.hasPrefix("#p") }
      // Trailing "+N more" is overflow past the packed cap — keep it out of the pager rows.
      return body.filter { !$0.hasPrefix("+") }
    }

    static func overflowLabel(from subtitle: String?) -> String? {
      lines(from: subtitle).first { $0.hasPrefix("+") && !$0.hasPrefix("#p") }
    }

    static func pageCount(itemCount: Int) -> Int {
      max(1, Int(ceil(Double(max(itemCount, 1)) / Double(CMX.pageSize))))
    }

    static func shiftPage(_ subtitle: String?, by delta: Int) -> String? {
      guard let subtitle, !subtitle.isEmpty else { return nil }
      let all = lines(from: subtitle)
      let itemCount = items(from: subtitle).count
      guard itemCount > CMX.pageSize else { return nil }
      let pages = pageCount(itemCount: itemCount)
      let current = pageIndex(from: subtitle)
      let next = positiveMod(current + delta, pages)
      let withoutMarker = all.filter { !$0.hasPrefix("#p") }
      return (withoutMarker + ["#p\(next)"]).joined(separator: "\n")
    }

    static func positiveMod(_ value: Int, _ modulus: Int) -> Int {
      guard modulus > 0 else { return 0 }
      let r = value % modulus
      return r >= 0 ? r : r + modulus
    }

    /// "0 of 8 · Deli & Prepared" → left count + aisle
    static func parsedHead(_ head: String) -> (left: String, aisle: String?) {
      let parts = head.components(separatedBy: " · ")
      let counts = (parts.first ?? "").components(separatedBy: " of ")
      let done = Int(counts.first ?? "") ?? 0
      let total = counts.count > 1 ? (Int(counts[1]) ?? 0) : 0
      let left = total > 0 ? String(max(0, total - done)) : ""
      return (left, parts.count > 1 ? parts[1] : nil)
    }
  }

  // MARK: - Intents (iOS 17+): flip pages on the Lock Screen without opening the app

  @available(iOS 17.0, *)
  struct ShoppingBannerPageIntent: LiveActivityIntent {
    static var title: LocalizedStringResource = "Show more shopping items"
    static var openAppWhenRun: Bool = false
    static var isDiscoverable: Bool = false

    @Parameter(title: "Delta")
    var delta: Int

    init() {
      delta = 1
    }

    init(delta: Int) {
      self.delta = delta
    }

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

  // MARK: - View

  struct LiveActivityView: View {
    let contentState: LiveActivityAttributes.ContentState
    let attributes: LiveActivityAttributes

    private var head: String { ShoppingBannerCodec.head(from: contentState.subtitle) }
    private var allItems: [String] { ShoppingBannerCodec.items(from: contentState.subtitle) }
    private var page: Int { ShoppingBannerCodec.pageIndex(from: contentState.subtitle) }
    private var pages: Int { ShoppingBannerCodec.pageCount(itemCount: allItems.count) }
    private var pageItems: [String] {
      let start = page * CMX.pageSize
      return Array(allItems.dropFirst(start).prefix(CMX.pageSize))
    }

    private var parsed: (left: String, aisle: String?) {
      ShoppingBannerCodec.parsedHead(head)
    }

    private var finished: Bool {
      allItems.isEmpty && !head.contains(" of ")
    }

    var body: some View {
      ZStack {
        LinearGradient(
          colors: [CMX.ember.opacity(0.30), Color.clear],
          startPoint: .topLeading, endPoint: .bottomTrailing
        )
        VStack(alignment: .leading, spacing: 12) {
          header
          progress
          if finished {
            Label(head.isEmpty ? "All picked up" : head, systemImage: "checkmark.circle.fill")
              .font(.system(size: 16, weight: .semibold, design: .rounded))
              .foregroundStyle(CMX.gold)
              .padding(.top, 2)
          } else {
            checklist
            pager
          }
        }
        .padding(.horizontal, 18)
        .padding(.vertical, 16)
      }
      .animation(.snappy(duration: 0.35), value: contentState.progress)
      .animation(.snappy(duration: 0.35), value: contentState.subtitle)
    }

    private var header: some View {
      HStack(alignment: .center, spacing: 12) {
        Image("choremaxx_mark")
          .resizable()
          .scaledToFit()
          .frame(width: 34, height: 34)
          .clipShape(RoundedRectangle(cornerRadius: 9, style: .continuous))
        VStack(alignment: .leading, spacing: 2) {
          Text(contentState.title)
            .font(.system(size: 18, weight: .bold, design: .rounded))
            .foregroundStyle(CMX.ink)
            .lineLimit(1)
            .minimumScaleFactor(0.85)
          if let aisle = parsed.aisle, !finished {
            HStack(spacing: 5) {
              Image(systemName: "cart.fill").font(.system(size: 11, weight: .bold))
              Text("Next: \(aisle)").lineLimit(1)
            }
            .font(.system(size: 13, weight: .semibold, design: .rounded))
            .foregroundStyle(CMX.gold)
          }
        }
        Spacer(minLength: 8)
        if !parsed.left.isEmpty && !finished {
          VStack(alignment: .trailing, spacing: 1) {
            Text(parsed.left)
              .font(.system(size: 32, weight: .heavy, design: .rounded))
              .foregroundStyle(CMX.ember)
              .contentTransition(.numericText())
            Text("LEFT")
              .font(.system(size: 10, weight: .bold, design: .rounded))
              .tracking(1.4)
              .foregroundStyle(CMX.faint)
          }
        } else if finished {
          Image(systemName: "checkmark.circle.fill")
            .font(.system(size: 30))
            .foregroundStyle(CMX.gold)
        }
      }
      // Only the header opens the app — item rows and pager keep their own intents.
      .applyWidgetURL(from: attributes.deepLinkUrl)
    }

    private var progress: some View {
      GeometryReader { geo in
        ZStack(alignment: .leading) {
          Capsule().fill(Color.white.opacity(0.12))
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
            .animation(.snappy(duration: 0.4), value: contentState.progress)
        }
      }
      .frame(height: 7)
    }

    private var checklist: some View {
      VStack(alignment: .leading, spacing: 8) {
        ForEach(Array(pageItems.enumerated()), id: \.offset) { _, item in
          HStack(spacing: 10) {
            Text(item)
              .font(.system(size: 16, weight: .semibold, design: .rounded))
              .foregroundStyle(CMX.ink)
              .lineLimit(1)
              .minimumScaleFactor(0.8)
            Spacer(minLength: 0)
          }
          .padding(.horizontal, 14)
          .padding(.vertical, 11)
          .frame(maxWidth: .infinity, alignment: .leading)
          .background(CMX.chip, in: RoundedRectangle(cornerRadius: 14, style: .continuous))
          .transition(.asymmetric(
            insertion: .move(edge: .trailing).combined(with: .opacity),
            removal: .move(edge: .leading).combined(with: .opacity)
          ))
        }
      }
    }

    @ViewBuilder
    private var pager: some View {
      let canPage = allItems.count > CMX.pageSize
      HStack(spacing: 10) {
        if canPage {
          if #available(iOS 17.0, *) {
            Button(intent: ShoppingBannerPageIntent(delta: -1)) {
              Image(systemName: "chevron.left")
                .font(.system(size: 13, weight: .bold))
                .foregroundStyle(CMX.ink)
                .frame(width: 34, height: 34)
                .background(CMX.chip, in: Circle())
            }
            .buttonStyle(.plain)
          }
          Text("\(page + 1) / \(pages)")
            .font(.system(size: 13, weight: .bold, design: .rounded))
            .foregroundStyle(CMX.soft)
            .contentTransition(.numericText())
          if #available(iOS 17.0, *) {
            Button(intent: ShoppingBannerPageIntent(delta: 1)) {
              Image(systemName: "chevron.right")
                .font(.system(size: 13, weight: .bold))
                .foregroundStyle(CMX.ink)
                .frame(width: 34, height: 34)
                .background(CMX.chip, in: Circle())
            }
            .buttonStyle(.plain)
          }
        } else {
          Text(allItems.isEmpty ? "List is clear" : "\(allItems.count) to pick up")
            .font(.system(size: 13, weight: .semibold, design: .rounded))
            .foregroundStyle(CMX.faint)
        }
        Spacer(minLength: 4)
        Text("Open run")
          .font(.system(size: 13, weight: .bold, design: .rounded))
          .foregroundStyle(CMX.gold)
          .padding(.horizontal, 12)
          .padding(.vertical, 8)
          .background(CMX.gold.opacity(0.15), in: Capsule())
          .applyWidgetURL(from: attributes.deepLinkUrl)
      }
      .padding(.top, 2)
    }
  }

#endif
