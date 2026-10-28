import AVFoundation
import ExpoModulesCore
import ImageIO
import SoundAnalysis
import UniformTypeIdentifiers
import Vision

// Shot triage on the iPhone (CLAUDE.md : Vision sur l'appareil ; étude, ch. 5 §2). This module only
// measures; core/triage.ts decides what is blurry, dark, worth sending (same rules as the prototype).
// Nothing leaves the phone here: the small JPEGs are written to the cache, and only the 15 to 30 that
// core/triage.ts keeps are sent, after the person's consent. Not compiled yet: it needs Xcode.
public class MadaVisionModule: Module {
  public func definition() -> ModuleDefinition {
    Name("MadaVision")

    // Duration, size, photo or video, sound track.
    AsyncFunction("probe") { (uri: URL) async throws -> [String: Any] in
      if isImage(uri) {
        guard let src = CGImageSourceCreateWithURL(uri as CFURL, nil),
              let props = CGImageSourceCopyPropertiesAtIndex(src, 0, nil) as? [CFString: Any] else { throw Unreadable() }
        var w = props[kCGImagePropertyPixelWidth] as? Int ?? 1080, h = props[kCGImagePropertyPixelHeight] as? Int ?? 1920
        if let o = props[kCGImagePropertyOrientation] as? Int, (5...8).contains(o) { swap(&w, &h) }
        return ["photo": true, "duration": 4.0, "width": w, "height": h, "hasAudio": false]
      }
      let asset = AVURLAsset(url: uri)
      let duration = try await asset.load(.duration).seconds
      guard duration.isFinite, duration > 0 else { throw Unreadable() }
      var size = CGSize(width: 1080, height: 1920)
      if let track = try await asset.loadTracks(withMediaType: .video).first {
        let (natural, transform) = try await track.load(.naturalSize, .preferredTransform)
        let r = CGRect(origin: .zero, size: natural).applying(transform)
        size = CGSize(width: abs(r.width), height: abs(r.height))
      }
      let audio = !(try await asset.loadTracks(withMediaType: .audio)).isEmpty
      return ["photo": false, "duration": duration, "width": Int(size.width), "height": Int(size.height), "hasAudio": audio]
    }

    // Shot changes: distance between Vision feature prints of frames `step` s apart. The threshold
    // comes from JS so it can be tuned on real rushes [À CALIBRER].
    AsyncFunction("scenes") { (uri: URL, step: Double, threshold: Double) async throws -> [Double] in
      let asset = AVURLAsset(url: uri)
      let duration = try await asset.load(.duration).seconds
      let gen = generator(asset, maxSide: 256)
      var out: [Double] = [], previous: VNFeaturePrintObservation?
      var t = 0.0
      while t < duration {
        let (image, _) = try await gen.image(at: CMTime(seconds: t, preferredTimescale: 600))
        let request = VNGenerateImageFeaturePrintRequest()
        try VNImageRequestHandler(cgImage: image).perform([request])
        if let fp = request.results?.first {
          if let previous {
            var distance: Float = 0
            try fp.computeDistance(&distance, to: previous)
            if Double(distance) > threshold { out.append((t * 10).rounded() / 10) }
          }
          previous = fp
        }
        t += step
      }
      return out
    }

    // At each time: sharpness (variance of the Laplacian at 720 px), mean luma 0-255, number of faces,
    // and a JPEG that fits 288 × 512 for the AI, written to the cache.
    AsyncFunction("measure") { (uri: URL, times: [Double], photo: Bool) async throws -> [[String: Any]] in
      var out: [[String: Any]] = []
      if photo {
        let image = try thumbnail(uri, maxSide: 720)
        out.append(try measureImage(image, t: 0, name: uri.deletingPathExtension().lastPathComponent))
        return out
      }
      let gen = generator(AVURLAsset(url: uri), maxSide: 720)
      for t in times {
        let (image, _) = try await gen.image(at: CMTime(seconds: t, preferredTimescale: 600))
        out.append(try measureImage(image, t: t, name: "\(uri.deletingPathExtension().lastPathComponent)_\(Int(t * 10))"))
      }
      return out
    }

    // Spans where someone speaks (SoundAnalysis, built-in classifier), merged when less than 0.6 s apart.
    AsyncFunction("voice") { (uri: URL) async throws -> [[Double]] in
      let audio = try await extractAudio(uri)
      defer { try? FileManager.default.removeItem(at: audio) }
      let analyzer = try SNAudioFileAnalyzer(url: audio)
      let request = try SNClassifySoundRequest(classifierIdentifier: .version1)
      request.windowDuration = CMTime(seconds: 1, preferredTimescale: 600)
      request.overlapFactor = 0.5
      let observer = SpeechObserver()
      try analyzer.add(request, withObserver: observer)
      _ = await analyzer.analyze()
      var merged: [[Double]] = []
      for s in observer.spans {
        if let last = merged.last, s[0] - last[1] < 0.6 { merged[merged.count - 1][1] = s[1] } else { merged.append(s) }
      }
      return merged.filter { $0[1] - $0[0] >= 0.5 }.map { $0.map { ($0 * 10).rounded() / 10 } }
    }
  }
}

struct Unreadable: Error {}

func isImage(_ url: URL) -> Bool {
  guard let type = UTType(filenameExtension: url.pathExtension) else { return false }
  return type.conforms(to: .image)
}

func generator(_ asset: AVAsset, maxSide: CGFloat) -> AVAssetImageGenerator {
  let gen = AVAssetImageGenerator(asset: asset)
  gen.appliesPreferredTrackTransform = true
  gen.maximumSize = CGSize(width: maxSide, height: maxSide)
  let tolerance = CMTime(seconds: 0.1, preferredTimescale: 600)
  gen.requestedTimeToleranceBefore = tolerance
  gen.requestedTimeToleranceAfter = tolerance
  return gen
}

func thumbnail(_ url: URL, maxSide: Int) throws -> CGImage {
  guard let src = CGImageSourceCreateWithURL(url as CFURL, nil),
        let image = CGImageSourceCreateThumbnailAtIndex(src, 0, [
          kCGImageSourceCreateThumbnailFromImageAlways: true, kCGImageSourceCreateThumbnailWithTransform: true,
          kCGImageSourceThumbnailMaxPixelSize: maxSide,
        ] as CFDictionary) else { throw Unreadable() }
  return image
}

func measureImage(_ image: CGImage, t: Double, name: String) throws -> [String: Any] {
  let (sharp, luma) = sharpnessAndLuma(image)
  let faces = VNDetectFaceRectanglesRequest()
  try VNImageRequestHandler(cgImage: image).perform([faces])
  return ["t": t, "sharp": sharp, "luma": luma, "faces": faces.results?.count ?? 0, "jpeg": try writeJpeg(image, name: name).absoluteString]
}

// Grey 8-bit copy, then the 4-neighbour Laplacian; its variance is the usual blur measure.
func sharpnessAndLuma(_ image: CGImage) -> (Double, Double) {
  let w = image.width, h = image.height
  var px = [UInt8](repeating: 0, count: w * h)
  let ok = px.withUnsafeMutableBytes { buf -> Bool in
    guard let ctx = CGContext(data: buf.baseAddress, width: w, height: h, bitsPerComponent: 8, bytesPerRow: w,
                              space: CGColorSpaceCreateDeviceGray(), bitmapInfo: CGImageAlphaInfo.none.rawValue) else { return false }
    ctx.draw(image, in: CGRect(x: 0, y: 0, width: w, height: h))
    return true
  }
  guard ok, w > 2, h > 2 else { return (0, 0) }
  var sum = 0.0, sumSq = 0.0, lumaSum = 0.0
  for y in 1..<(h - 1) {
    for x in 1..<(w - 1) {
      let i = y * w + x
      let lap = Double(px[i - 1]) + Double(px[i + 1]) + Double(px[i - w]) + Double(px[i + w]) - 4 * Double(px[i])
      sum += lap; sumSq += lap * lap; lumaSum += Double(px[i])
    }
  }
  let n = Double((w - 2) * (h - 2))
  return (sumSq / n - (sum / n) * (sum / n), lumaSum / n)
}

// Fits 288 × 512 (portrait) or 512 × 288, JPEG quality 0.6: about 20 to 40 KB each.
func writeJpeg(_ image: CGImage, name: String) throws -> URL {
  let k = min(1, min(288.0 / Double(min(image.width, image.height)), 512.0 / Double(max(image.width, image.height))))
  let w = max(1, Int(Double(image.width) * k)), h = max(1, Int(Double(image.height) * k))
  guard let ctx = CGContext(data: nil, width: w, height: h, bitsPerComponent: 8, bytesPerRow: 0, space: CGColorSpaceCreateDeviceRGB(),
                            bitmapInfo: CGImageAlphaInfo.noneSkipLast.rawValue) else { throw Unreadable() }
  ctx.interpolationQuality = .high
  ctx.draw(image, in: CGRect(x: 0, y: 0, width: w, height: h))
  guard let small = ctx.makeImage() else { throw Unreadable() }
  let dir = FileManager.default.temporaryDirectory.appendingPathComponent("mada-images", isDirectory: true)
  try FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
  let url = dir.appendingPathComponent("\(name).jpg")
  guard let dest = CGImageDestinationCreateWithURL(url as CFURL, UTType.jpeg.identifier as CFString, 1, nil) else { throw Unreadable() }
  CGImageDestinationAddImage(dest, small, [kCGImageDestinationLossyCompressionQuality: 0.6] as CFDictionary)
  guard CGImageDestinationFinalize(dest) else { throw Unreadable() }
  return url
}

// SNAudioFileAnalyzer reads audio files, not every movie container: the sound is copied to M4A first.
func extractAudio(_ uri: URL) async throws -> URL {
  let asset = AVURLAsset(url: uri)
  guard let export = AVAssetExportSession(asset: asset, presetName: AVAssetExportPresetAppleM4A) else { throw Unreadable() }
  let out = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString + ".m4a")
  export.outputURL = out
  export.outputFileType = .m4a
  await export.export()
  guard export.status == .completed else { throw export.error ?? Unreadable() }
  return out
}

final class SpeechObserver: NSObject, SNResultsObserving {
  var spans: [[Double]] = []
  func request(_ request: SNRequest, didProduce result: SNResult) {
    guard let r = result as? SNClassificationResult, let speech = r.classification(forIdentifier: "speech"), speech.confidence > 0.5 else { return }
    let start = r.timeRange.start.seconds, end = start + r.timeRange.duration.seconds
    if let last = spans.last, start <= last[1] { spans[spans.count - 1][1] = end } else { spans.append([start, end]) }
  }
}
