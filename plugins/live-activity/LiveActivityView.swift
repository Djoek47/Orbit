// ChoreMaxx's own Lock Screen view for the shopping run.
// Replaces expo-live-activity's generic template (plugins/with-shopping-live-activity.js copies
// this over it at prebuild). The data contract is unchanged:
//   title    = the run ("Wednesday run")
//   subtitle = line 1 "0 of 8 · Deli & Prepared", then one line per item still to get
//              ("🧀 Swiss Cheese"), and optionally a last "+3 more"
//   progress = 0...1
import SwiftUI
import WidgetKit

#if canImport(ActivityKit)

  struct ConditionalForegroundViewModifier: ViewModifier {
    let color: String?

    func body(content: Content) -> some View {
      if let color = color {
        content.foregroundStyle(Color(hex: color))
      } else {
        content
      }
    }
  }

  struct DebugLog: View {
    #if DEBUG
      private let message: String
      init(_ message: String) {
        self.message = message
        print(message)
      }

      var body: some View {
        Text(message).font(.caption2).foregroundStyle(.red)
      }
    #else
      init(_: String) {}
      var body: some View { EmptyView() }
    #endif
  }

  private enum CMX {
    static let ember = Color(hex: "#FF7A45")
    static let gold = Color(hex: "#F2C14E")
    static let ink = Color(hex: "#F7F2EC")
    static let soft = Color(hex: "#C9B8AA")
    static let faint = Color(hex: "#8E7F74")
    static let chip = Color.white.opacity(0.08)
  }

  struct LiveActivityView: View {
    let contentState: LiveActivityAttributes.ContentState
    let attributes: LiveActivityAttributes

    private var lines: [String] {
      (contentState.subtitle ?? "")
        .split(separator: "\n", omittingEmptySubsequences: true)
        .map { String($0) }
    }

    private var head: String { lines.first ?? "" }

    /// "0 of 8 · Deli & Prepared" → ("0", "8", "Deli & Prepared")
    private var parsed: (done: String, total: String, aisle: String?) {
      let parts = head.components(separatedBy: " · ")
      let counts = (parts.first ?? "").components(separatedBy: " of ")
      let done = counts.first ?? ""
      let total = counts.count > 1 ? counts[1] : ""
      return (done, total, parts.count > 1 ? parts[1] : nil)
    }

    private var items: [String] {
      Array(lines.dropFirst()).filter { !$0.hasPrefix("+") }
    }

    private var more: String? {
      lines.dropFirst().first { $0.hasPrefix("+") }
    }

    private var left: String {
      guard let d = Int(parsed.done), let t = Int(parsed.total) else { return "" }
      return String(max(0, t - d))
    }

    private var finished: Bool { items.isEmpty && more == nil && !head.contains(" of ") }

    var body: some View {
      ZStack {
        // A warm glow from the corner, in the app's colours.
        LinearGradient(
          colors: [CMX.ember.opacity(0.28), Color.clear],
          startPoint: .topLeading, endPoint: .center
        )
        VStack(alignment: .leading, spacing: 8) {
          header
          progress
          if finished {
            Text(head.isEmpty ? "All picked up" : head)
              .font(.system(size: 15, weight: .semibold, design: .rounded))
              .foregroundStyle(CMX.soft)
          } else {
            checklist
          }
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 14)
      }
    }

    private var header: some View {
      HStack(alignment: .center, spacing: 10) {
        Image("choremaxx_mark")
          .resizable()
          .scaledToFit()
          .frame(width: 30, height: 30)
          .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
        VStack(alignment: .leading, spacing: 1) {
          Text(contentState.title)
            .font(.system(size: 17, weight: .bold, design: .rounded))
            .foregroundStyle(CMX.ink)
            .lineLimit(1)
          if let aisle = parsed.aisle, !finished {
            HStack(spacing: 4) {
              Image(systemName: "cart.fill").font(.system(size: 10, weight: .bold))
              Text("Next: \(aisle)").lineLimit(1)
            }
            .font(.system(size: 12, weight: .semibold, design: .rounded))
            .foregroundStyle(CMX.gold)
          }
        }
        Spacer(minLength: 6)
        if !left.isEmpty && !finished {
          VStack(alignment: .trailing, spacing: 0) {
            Text(left)
              .font(.system(size: 28, weight: .heavy, design: .rounded))
              .foregroundStyle(CMX.ember)
              .contentTransition(.numericText())
            Text("LEFT")
              .font(.system(size: 9, weight: .bold, design: .rounded))
              .tracking(1.2)
              .foregroundStyle(CMX.faint)
          }
        } else if finished {
          Image(systemName: "checkmark.circle.fill")
            .font(.system(size: 28))
            .foregroundStyle(CMX.gold)
        }
      }
    }

    private var progress: some View {
      GeometryReader { geo in
        ZStack(alignment: .leading) {
          Capsule().fill(Color.white.opacity(0.10))
          Capsule()
            .fill(LinearGradient(colors: [CMX.ember, CMX.gold], startPoint: .leading, endPoint: .trailing))
            .frame(width: max(6, geo.size.width * CGFloat(min(1, max(0, contentState.progress ?? 0)))))
        }
      }
      .frame(height: 6)
    }

    private var checklist: some View {
      let columns = [GridItem(.flexible(), spacing: 6), GridItem(.flexible(), spacing: 6)]
      return LazyVGrid(columns: columns, alignment: .leading, spacing: 5) {
        ForEach(Array(items.enumerated()), id: \.offset) { _, item in
          HStack(spacing: 6) {
            Circle()
              .strokeBorder(CMX.soft.opacity(0.7), lineWidth: 1.4)
              .frame(width: 12, height: 12)
            Text(item)
              .font(.system(size: 13.5, weight: .semibold, design: .rounded))
              .foregroundStyle(CMX.ink)
              .lineLimit(1)
          }
          .padding(.horizontal, 8)
          .padding(.vertical, 5)
          .frame(maxWidth: .infinity, alignment: .leading)
          .background(CMX.chip, in: RoundedRectangle(cornerRadius: 9, style: .continuous))
        }
        if let more = more {
          Text("\(more) · tap to open")
            .font(.system(size: 12.5, weight: .semibold, design: .rounded))
            .foregroundStyle(CMX.faint)
            .padding(.horizontal, 8)
            .padding(.vertical, 5)
        }
      }
    }
  }

#endif
