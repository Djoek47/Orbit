// Adapted from torch-image-playground 0.2.0 (MIT, github.com/AswinTorch/torch-image-playground).
// Same presentation code; renamed, plus `status()`. The podspec is what changed — see it.
// Xcode 26 / current SDK marks style + personalization APIs @available(iOS 18.4, *).
import ExpoModulesCore
import UIKit

#if canImport(ImagePlayground)
import ImagePlayground
#endif

public class ChoremaxxImagePlaygroundModule: Module {
  public func definition() -> ModuleDefinition {
    Name("ChoremaxxImagePlayground")

    // Why it is (or isn't) available, so the app can say the real reason.
    Function("status") { () -> [String: Bool] in
      var osSupported = false
      var available = false
      #if canImport(ImagePlayground)
      if #available(iOS 18.4, *) {
        osSupported = true
        available = ImagePlaygroundViewController.isAvailable
      }
      #endif
      return ["linked": true, "osSupported": osSupported, "available": available]
    }

    Function("isSupported") { () -> Bool in
      #if canImport(ImagePlayground)
      if #available(iOS 18.4, *) {
        return ImagePlaygroundViewController.isAvailable
      }
      #endif
      return false
    }

    AsyncFunction("launchAsync") { (params: LaunchParams?) async throws -> String? in
      #if canImport(ImagePlayground)
      guard #available(iOS 18.4, *) else {
        throw ImagePlaygroundError.unsupported
      }

      guard ImagePlaygroundViewController.isAvailable else {
        throw ImagePlaygroundError.unsupported
      }

      return try await self.presentImagePlayground(params: params)
      #else
      throw ImagePlaygroundError.unsupported
      #endif
    }
  }

  #if canImport(ImagePlayground)
  @available(iOS 18.4, *)
  private func presentImagePlayground(params: LaunchParams?) async throws -> String? {
    let sourceUIImage: UIImage?
    if let uri = params?.sourceUri?.trimmingCharacters(in: .whitespacesAndNewlines), !uri.isEmpty {
      sourceUIImage = try await Self.loadSourceImage(from: uri)
    } else {
      sourceUIImage = nil
    }

    return try await presentOnMainActor(params: params, sourceImage: sourceUIImage)
  }

  @MainActor
  @available(iOS 18.4, *)
  private func presentOnMainActor(params: LaunchParams?, sourceImage: UIImage?) async throws -> String? {
    guard let topController = resolveTopViewController() else {
      throw ImagePlaygroundError.noViewController
    }

    let viewController = ImagePlaygroundViewController()
    viewController.modalPresentationStyle = .pageSheet
    viewController.isModalInPresentation = false

    if let sourceImage = sourceImage {
      viewController.sourceImage = sourceImage
    }

    try applyGenerationStyles(to: viewController, params: params)

    if let policy = params?.personalizationPolicy?.trimmingCharacters(in: .whitespacesAndNewlines), !policy.isEmpty {
      viewController.personalizationPolicy = try Self.parsePersonalizationPolicy(policy)
    }

    if let concepts = params?.concepts {
      if let textConcepts = concepts.text {
        for text in textConcepts {
          viewController.concepts.append(.text(text))
        }
      } else if let content = concepts.content {
        viewController.concepts.append(.extracted(from: content, title: concepts.title))
      }
    }

    return try await withCheckedThrowingContinuation { continuation in
      let delegate = ImagePlaygroundDelegate(
        onComplete: { url in
          continuation.resume(returning: url.path)
        },
        onCancel: {
          continuation.resume(returning: nil)
        }
      )

      objc_setAssociatedObject(viewController, "delegate", delegate, .OBJC_ASSOCIATION_RETAIN)
      viewController.delegate = delegate

      topController.present(viewController, animated: true)
    }
  }

  @MainActor
  @available(iOS 18.4, *)
  private func applyGenerationStyles(to vc: ImagePlaygroundViewController, params: LaunchParams?) throws {
    let allowedStrings = params?.allowedStyles
    let selectedString = params?.selectedStyle

    let allowedParsed: [ImagePlaygroundStyle]?
    if let s = allowedStrings, !s.isEmpty {
      allowedParsed = try s.flatMap { try Self.parseStyles($0) }
    } else {
      allowedParsed = nil
    }

    let selectedParsed: ImagePlaygroundStyle?
    if let s = selectedString?.trimmingCharacters(in: .whitespacesAndNewlines), !s.isEmpty {
      let styles = try Self.parseStyles(s)
      // "all" expands to every style — pick the first as the selected one.
      selectedParsed = styles.first
    } else {
      selectedParsed = nil
    }

    switch (allowedParsed, selectedParsed) {
    case (nil, nil):
      break
    case (let allowed?, nil):
      vc.allowedGenerationStyles = allowed
    case (nil, let selected?):
      vc.allowedGenerationStyles = [selected]
      vc.selectedGenerationStyle = selected
    case (let allowed?, let selected?):
      let selectedId = selected.id
      guard allowed.contains(where: { $0.id == selectedId }) else {
        throw ImagePlaygroundError.invalidStyleSelection
      }
      vc.allowedGenerationStyles = allowed
      vc.selectedGenerationStyle = selected
    }
  }

  private nonisolated static func loadSourceImage(from uri: String) async throws -> UIImage {
    let trimmed = uri.trimmingCharacters(in: .whitespacesAndNewlines)

    if trimmed.hasPrefix("/"), !trimmed.contains("://") {
      guard let image = UIImage(contentsOfFile: trimmed) else {
        throw ImagePlaygroundError.sourceImageLoadFailed
      }
      return image
    }

    if trimmed.lowercased().hasPrefix("file://") {
      guard let url = URL(string: trimmed), let image = UIImage(contentsOfFile: url.path) else {
        throw ImagePlaygroundError.sourceImageLoadFailed
      }
      return image
    }

    guard let url = URL(string: trimmed), let scheme = url.scheme?.lowercased() else {
      throw ImagePlaygroundError.sourceImageLoadFailed
    }

    if scheme == "file" {
      guard let image = UIImage(contentsOfFile: url.path) else {
        throw ImagePlaygroundError.sourceImageLoadFailed
      }
      return image
    }

    guard scheme == "http" || scheme == "https" else {
      throw ImagePlaygroundError.sourceImageLoadFailed
    }

    let (data, _) = try await URLSession.shared.data(from: url)
    guard let image = UIImage(data: data), image.size.width > 0 else {
      throw ImagePlaygroundError.sourceImageLoadFailed
    }
    return image
  }

  /// Current SDK: `ImagePlaygroundStyle.all` is `[ImagePlaygroundStyle]`, not a single style.
  @available(iOS 18.4, *)
  private nonisolated static func parseStyles(_ raw: String) throws -> [ImagePlaygroundStyle] {
    switch raw.trimmingCharacters(in: .whitespacesAndNewlines).lowercased() {
    case "animation":
      return [.animation]
    case "illustration":
      return [.illustration]
    case "sketch":
      return [.sketch]
    case "all":
      return ImagePlaygroundStyle.all
    default:
      throw ImagePlaygroundError.invalidStyle(raw)
    }
  }

  @available(iOS 18.4, *)
  private nonisolated static func parsePersonalizationPolicy(_ raw: String) throws -> ImagePlaygroundPersonalizationPolicy {
    switch raw.trimmingCharacters(in: .whitespacesAndNewlines).lowercased() {
    case "automatic":
      return .automatic
    case "enabled":
      return .enabled
    case "disabled":
      return .disabled
    default:
      throw ImagePlaygroundError.invalidPersonalizationPolicy(raw)
    }
  }

  private func resolveTopViewController() -> UIViewController? {
    if let top = appContext?.utilities?.currentViewController() {
      return top
    }
    guard let windowScene = UIApplication.shared.connectedScenes.compactMap({ $0 as? UIWindowScene }).first(where: { $0.activationState == .foregroundActive })
        ?? UIApplication.shared.connectedScenes.compactMap({ $0 as? UIWindowScene }).first,
      var top = windowScene.windows.first(where: { $0.isKeyWindow })?.rootViewController
        ?? windowScene.windows.first?.rootViewController else {
      return nil
    }
    while let presented = top.presentedViewController, !presented.isBeingDismissed {
      top = presented
    }
    return top
  }
  #endif
}

#if canImport(ImagePlayground)
@available(iOS 18.4, *)
private class ImagePlaygroundDelegate: NSObject, ImagePlaygroundViewController.Delegate {
  private let onComplete: (URL) -> Void
  private let onCancel: () -> Void
  private var hasResumed = false

  init(onComplete: @escaping (URL) -> Void, onCancel: @escaping () -> Void) {
    self.onComplete = onComplete
    self.onCancel = onCancel
    super.init()
  }

  func imagePlaygroundViewController(
    _ imagePlaygroundViewController: ImagePlaygroundViewController,
    didCreateImageAt imageURL: URL
  ) {
    guard !hasResumed else { return }
    hasResumed = true
    imagePlaygroundViewController.dismiss(animated: true)
    onComplete(imageURL)
  }

  func imagePlaygroundViewControllerDidCancel(
    _ imagePlaygroundViewController: ImagePlaygroundViewController
  ) {
    guard !hasResumed else { return }
    hasResumed = true
    imagePlaygroundViewController.dismiss(animated: true)
    onCancel()
  }
}
#endif

struct ConceptsParams: Record {
  @Field var text: [String]?
  @Field var title: String?
  @Field var content: String?
}

struct LaunchParams: Record {
  @Field var concepts: ConceptsParams?
  @Field var sourceUri: String?
  @Field var allowedStyles: [String]?
  @Field var selectedStyle: String?
  @Field var personalizationPolicy: String?
}

enum ImagePlaygroundError: Error {
  case unsupported
  case noViewController
  case sourceImageLoadFailed
  case invalidStyle(String)
  case invalidPersonalizationPolicy(String)
  case invalidStyleSelection
}

extension ImagePlaygroundError: LocalizedError {
  var errorDescription: String? {
    switch self {
    case .unsupported:
      return "Image Playground is not available on this device. Requires iOS 18.4+ and supported hardware."
    case .noViewController:
      return "Could not find a view controller to present Image Playground."
    case .sourceImageLoadFailed:
      return "Could not load the source image from the given URI (use https URL or an absolute file path)."
    case .invalidStyle(let raw):
      return "Invalid Image Playground style \"\(raw)\". Use animation, illustration, sketch, or all."
    case .invalidPersonalizationPolicy(let raw):
      return "Invalid personalization policy \"\(raw)\". Use automatic, enabled, or disabled."
    case .invalidStyleSelection:
      return "selectedStyle must be included in allowedStyles when both are set."
    }
  }
}
