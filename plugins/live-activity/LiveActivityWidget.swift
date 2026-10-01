import ActivityKit
import SwiftUI
import WidgetKit

struct LiveActivityAttributes: ActivityAttributes {
  struct ContentState: Codable, Hashable {
    var title: String
    var subtitle: String?
    var timerEndDateInMilliseconds: Double?
    var progress: Double?
    var imageName: String?
    var dynamicIslandImageName: String?
  }

  var name: String
  var backgroundColor: String?
  var titleColor: String?
  var subtitleColor: String?
  var progressViewTint: String?
  var progressViewLabelColor: String?
  var deepLinkUrl: String?
  var timerType: DynamicIslandTimerType?
  var padding: Int?
  var paddingDetails: PaddingDetails?
  var imagePosition: String?
  var imageWidth: Int?
  var imageHeight: Int?
  var imageWidthPercent: Double?
  var imageHeightPercent: Double?
  var imageAlign: String?
  var contentFit: String?

  enum DynamicIslandTimerType: String, Codable {
    case circular
    case digital
  }

  struct PaddingDetails: Codable, Hashable {
    var top: Int?
    var bottom: Int?
    var left: Int?
    var right: Int?
    var vertical: Int?
    var horizontal: Int?
  }
}

/// ChoreMaxx shopping Live Activity shell.
/// Unlike the stock expo-live-activity widget, the Lock Screen view is NOT wrapped in a
/// whole-banner `widgetURL` — that was swallowing every tap and opening the app. The header
/// and "Open run" chip deep-link; Next/Previous use Live Activity intents.
struct LiveActivityWidget: Widget {
  var body: some WidgetConfiguration {
    ActivityConfiguration(for: LiveActivityAttributes.self) { context in
      LiveActivityView(contentState: context.state, attributes: context.attributes)
        .activityBackgroundTint(
          context.attributes.backgroundColor.map { Color(hex: $0) }
        )
        .activitySystemActionForegroundColor(Color.black)
    } dynamicIsland: { context in
      let left = ShoppingBannerCodec.parsedHead(
        ShoppingBannerCodec.head(from: context.state.subtitle)
      ).left
      let aisle = ShoppingBannerCodec.parsedHead(
        ShoppingBannerCodec.head(from: context.state.subtitle)
      ).aisle

      DynamicIsland {
        DynamicIslandExpandedRegion(.leading, priority: 1) {
          VStack(alignment: .leading, spacing: 4) {
            Text(context.state.title)
              .font(.system(size: 18, weight: .bold, design: .rounded))
              .foregroundStyle(.white)
              .lineLimit(1)
            if let aisle, !aisle.isEmpty {
              Text("Next: \(aisle)")
                .font(.system(size: 14, weight: .semibold, design: .rounded))
                .foregroundStyle(Color(hex: "#F2C14E"))
                .lineLimit(1)
            }
          }
          .padding(.leading, 4)
          .applyWidgetURL(from: context.attributes.deepLinkUrl)
        }
        DynamicIslandExpandedRegion(.trailing) {
          if !left.isEmpty {
            VStack(alignment: .trailing, spacing: 1) {
              Text(left)
                .font(.system(size: 26, weight: .heavy, design: .rounded))
                .foregroundStyle(Color(hex: "#FF7A45"))
                .monospacedDigit()
              Text("left")
                .font(.system(size: 9, weight: .bold, design: .rounded))
                .textCase(.uppercase)
                .tracking(0.6)
                .foregroundStyle(.white.opacity(0.55))
            }
            .frame(minWidth: 40, alignment: .trailing)
            .padding(.trailing, 4)
            .applyWidgetURL(from: context.attributes.deepLinkUrl)
          } else if let imageName = context.state.imageName {
            resizableImage(imageName: imageName)
              .frame(width: 36, height: 36)
              .padding(.trailing, 4)
              .applyWidgetURL(from: context.attributes.deepLinkUrl)
          }
        }
        DynamicIslandExpandedRegion(.bottom) {
          ProgressView(value: min(1, max(0, context.state.progress ?? 0)))
            .tint(Color(hex: context.attributes.progressViewTint ?? "#FF7A45"))
            .padding(.horizontal, 6)
            .applyWidgetURL(from: context.attributes.deepLinkUrl)
        }
      } compactLeading: {
        if let dynamicIslandImageName = context.state.dynamicIslandImageName {
          resizableImage(imageName: dynamicIslandImageName)
            .frame(maxWidth: 23, maxHeight: 23)
            .applyWidgetURL(from: context.attributes.deepLinkUrl)
        }
      } compactTrailing: {
        if !left.isEmpty {
          Text(left)
            .font(.system(size: 16, weight: .heavy, design: .rounded))
            .foregroundStyle(Color(hex: "#FF7A45"))
            .applyWidgetURL(from: context.attributes.deepLinkUrl)
        } else if let date = context.state.timerEndDateInMilliseconds {
          compactTimer(
            endDate: date,
            timerType: context.attributes.timerType ?? .circular,
            progressViewTint: context.attributes.progressViewTint
          ).applyWidgetURL(from: context.attributes.deepLinkUrl)
        }
      } minimal: {
        if !left.isEmpty {
          Text(left)
            .font(.system(size: 14, weight: .heavy, design: .rounded))
            .foregroundStyle(Color(hex: "#FF7A45"))
            .applyWidgetURL(from: context.attributes.deepLinkUrl)
        } else if let date = context.state.timerEndDateInMilliseconds {
          compactTimer(
            endDate: date,
            timerType: context.attributes.timerType ?? .circular,
            progressViewTint: context.attributes.progressViewTint
          ).applyWidgetURL(from: context.attributes.deepLinkUrl)
        }
      }
    }
  }

  @ViewBuilder
  private func compactTimer(
    endDate: Double,
    timerType: LiveActivityAttributes.DynamicIslandTimerType,
    progressViewTint: String?
  ) -> some View {
    if timerType == .digital {
      Text(timerInterval: Date.toTimerInterval(miliseconds: endDate))
        .font(.system(size: 15))
        .minimumScaleFactor(0.8)
        .fontWeight(.semibold)
        .frame(maxWidth: 60)
        .multilineTextAlignment(.trailing)
    } else {
      ProgressView(
        timerInterval: Date.toTimerInterval(miliseconds: endDate),
        countsDown: false,
        label: { EmptyView() },
        currentValueLabel: { EmptyView() }
      )
      .progressViewStyle(.circular)
      .tint(progressViewTint.map { Color(hex: $0) })
    }
  }
}
