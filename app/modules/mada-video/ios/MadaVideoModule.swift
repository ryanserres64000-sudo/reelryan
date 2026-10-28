import AVFoundation
import ExpoModulesCore
import Photos

// Preview and export from the same composition (CLAUDE.md, stack vidéo). Not compiled yet: it needs
// Xcode on Ryan's Mac, then a test on an iPhone with real rushes (portrait, landscape, photos).
public class MadaVideoModule: Module {
  public func definition() -> ModuleDefinition {
    Name("MadaVideo")

    // Renders one file of the export plan (core/export.ts), adds the AI-Act metadata, saves it to
    // Photos (add-only permission) and returns the file for the share sheet.
    AsyncFunction("exportVideo") { (timeline: [String: Any], file: [String: Any], sources: [String: Any]) async throws -> [String: Any] in
      let t = try decode(Timeline.self, timeline), f = try decode(ExportFile.self, file), s = try decode(Sources.self, sources)
      let built = try await Composer.build(t, file: f, sources: s)
      guard let export = AVAssetExportSession(asset: built.composition, presetName: AVAssetExportPresetHighestQuality) else { throw RenderError.export("session") }
      let out = FileManager.default.temporaryDirectory.appendingPathComponent(f.nom)
      try? FileManager.default.removeItem(at: out)
      export.outputURL = out
      export.outputFileType = .mp4
      export.videoComposition = built.video
      export.audioMix = built.audio
      export.audioTimePitchAlgorithm = .spectral
      export.timeRange = CMTimeRange(start: .zero, duration: built.duration)
      export.shouldOptimizeForNetworkUse = true
      export.metadata = metadata(f.metadonnees)
      await export.export()
      guard export.status == .completed else { throw export.error ?? RenderError.export("\(export.status.rawValue)") }
      try await saveToPhotos(out)
      return ["uri": out.absoluteString]
    }

    View(MadaVideoView.self) {
      Events("onTime", "onError")
      Prop("source") { (view: MadaVideoView, source: [String: Any]) in view.load(source) }
      AsyncFunction("play") { (view: MadaVideoView) in view.player.play() }
      AsyncFunction("pause") { (view: MadaVideoView) in view.player.pause() }
      AsyncFunction("seek") { (view: MadaVideoView, seconds: Double) in
        _ = await view.player.seek(to: time(seconds), toleranceBefore: .zero, toleranceAfter: .zero)
      }
    }
  }
}

// Common identifiers, so the keys land where each file type keeps them (core/export.ts, provenance).
func metadata(_ m: [String: String]) -> [AVMetadataItem] {
  m.compactMap { key, value in
    let item = AVMutableMetadataItem()
    switch key {
    case "com.apple.quicktime.software": item.identifier = .commonIdentifierSoftware
    case "com.apple.quicktime.description": item.identifier = .commonIdentifierDescription
    default: return nil
    }
    item.value = value as NSString
    item.extendedLanguageTag = "fr-FR"
    return item
  }
}

func saveToPhotos(_ url: URL) async throws {
  let status = await PHPhotoLibrary.requestAuthorization(for: .addOnly)
  guard status == .authorized || status == .limited else { throw RenderError.export("Photos") }
  try await PHPhotoLibrary.shared().performChanges { PHAssetCreationRequest.forAsset().addResource(with: .video, fileURL: url, options: nil) }
}

// The preview: an AVPlayer on the very composition the export uses.
public final class MadaVideoView: ExpoView {
  let player = AVPlayer()
  private let layerView = AVPlayerLayer()
  private var observer: Any?
  private var job: Task<Void, Never>?
  let onTime = EventDispatcher(), onError = EventDispatcher()

  public required init(appContext: AppContext? = nil) {
    super.init(appContext: appContext)
    clipsToBounds = true
    layerView.player = player
    layerView.videoGravity = .resizeAspect
    layer.addSublayer(layerView)
    observer = player.addPeriodicTimeObserver(forInterval: CMTime(value: 1, timescale: 10), queue: .main) { [weak self] t in
      self?.onTime(["time": t.seconds])
    }
  }

  public override func layoutSubviews() { super.layoutSubviews(); layerView.frame = bounds }

  // The source is { timeline, file, sources }; a new one replaces the item, keeping the position.
  func load(_ source: [String: Any]) {
    job?.cancel()
    job = Task { @MainActor [weak self] in
      guard let self else { return }
      do {
        guard let tl = source["timeline"], let fl = source["file"], let sr = source["sources"] else { return }
        let built = try await Composer.build(try decode(Timeline.self, tl), file: try decode(ExportFile.self, fl), sources: try decode(Sources.self, sr))
        if Task.isCancelled { return }
        let at = player.currentTime(), playing = player.rate > 0
        let item = AVPlayerItem(asset: built.composition)
        item.videoComposition = built.video
        item.audioMix = built.audio
        item.audioTimePitchAlgorithm = .spectral
        item.forwardPlaybackEndTime = built.duration
        player.replaceCurrentItem(with: item)
        _ = await player.seek(to: min(at, built.duration), toleranceBefore: .zero, toleranceAfter: .zero)
        if playing { player.play() }
      } catch {
        onError(["message": error.localizedDescription])
      }
    }
  }

  deinit { if let observer { player.removeTimeObserver(observer) } }
}
