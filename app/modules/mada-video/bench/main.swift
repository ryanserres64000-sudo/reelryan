import AVFoundation
import Foundation

// The render bench (retour de test n°1, phases 0A et 0B): the very Composer, Compositor and Overlay of
// the app, run on a Mac on real iPhone files, so a render bug shows here before it reaches a phone.
//   bench probe <dossier>            → JSON of each file: duration, photo, sound, size, fps, HDR
//   bench render <plan.json> <out>   → builds the composition, checks it, exports it, says why it fails
// plan.json = { timeline, file, sources } as the app sends them (scripts/bench/plan.mjs writes it).

func say(_ s: String) { FileHandle.standardError.write((s + "\n").data(using: .utf8)!) }
func detail(_ e: Error) -> String {
  let n = e as NSError
  var s = "\(n.domain) \(n.code) : \(n.localizedDescription)"
  if let r = n.localizedFailureReason { s += " | raison : \(r)" }
  if let u = n.userInfo[NSUnderlyingErrorKey] as? NSError { s += " | dessous : \(u.domain) \(u.code) \(u.localizedDescription)" }
  return s
}

func probe(_ dir: String) async throws {
  let url = URL(fileURLWithPath: dir)
  var out: [String: Any] = [:]
  for f in try FileManager.default.contentsOfDirectory(at: url, includingPropertiesForKeys: nil).sorted(by: { $0.lastPathComponent < $1.lastPathComponent }) {
    if f.lastPathComponent.hasPrefix(".") { continue }
    let id = f.deletingPathExtension().lastPathComponent.replacingOccurrences(of: " ", with: "_")
    if isImage(f) { out[id] = ["uri": f.absoluteString, "duration": 4, "photo": true, "sound": false]; continue }
    let asset = AVURLAsset(url: f)
    guard let v = try await asset.loadTracks(withMediaType: .video).first else { say("pas de piste vidéo : \(f.lastPathComponent)"); continue }
    let (size, transform, fps, range) = try await v.load(.naturalSize, .preferredTransform, .nominalFrameRate, .timeRange)
    let hdr = try await v.load(.mediaCharacteristics).contains(.containsHDRVideo)
    let audio = try await asset.loadTracks(withMediaType: .audio).first != nil
    let total = try await asset.load(.duration)
    out[id] = ["uri": f.absoluteString, "duration": total.seconds, "video_duration": range.duration.seconds, "photo": false, "sound": audio,
               "w": size.width, "h": size.height, "rotation": orientation(transform).rawValue, "fps": fps, "hdr": hdr]
  }
  let data = try JSONSerialization.data(withJSONObject: out, options: [.prettyPrinted, .sortedKeys])
  print(String(data: data, encoding: .utf8)!)
}

final class Checker: NSObject, AVVideoCompositionValidationHandling {
  var problems: [String] = []
  func videoComposition(_ vc: AVVideoComposition, shouldContinueValidatingAfterFindingInvalidValueForKey key: String) -> Bool { problems.append("valeur invalide : \(key)"); return true }
  func videoComposition(_ vc: AVVideoComposition, shouldContinueValidatingAfterFindingEmptyTimeRange r: CMTimeRange) -> Bool { problems.append("trou sans instruction : \(r.start.seconds)–\(r.end.seconds) s"); return true }
  func videoComposition(_ vc: AVVideoComposition, shouldContinueValidatingAfterFindingInvalidTimeRangeIn i: AVVideoCompositionInstructionProtocol) -> Bool { problems.append("instruction hors durée : \(i.timeRange.start.seconds)–\(i.timeRange.end.seconds) s"); return true }
  func videoComposition(_ vc: AVVideoComposition, shouldContinueValidatingAfterFindingInvalidTrackIDIn i: AVVideoCompositionInstructionProtocol, layerInstruction: AVVideoCompositionLayerInstruction, asset: AVAsset) -> Bool { problems.append("piste invalide"); return true }
}

func render(_ planPath: String, _ outPath: String) async throws {
  let raw = try JSONSerialization.jsonObject(with: Data(contentsOf: URL(fileURLWithPath: planPath))) as! [String: Any]
  let t = try decode(Timeline.self, raw["timeline"]!), f = try decode(ExportFile.self, raw["file"]!), s = try decode(Sources.self, raw["sources"]!)
  let started = Date()
  let built: Built
  do { built = try await Composer.build(t, file: f, sources: s) } catch { say("ÉCHEC Composer.build : \(detail(error))"); exit(2) }
  let compDuration = try await built.composition.load(.duration).seconds
  let last = built.video.instructions.last?.timeRange.end.seconds ?? 0
  say("composition \(String(format: "%.4f", compDuration)) s · instructions jusqu'à \(String(format: "%.4f", last)) s · export demandé \(String(format: "%.4f", built.duration.seconds)) s · \(built.video.instructions.count) instructions")
  let checker = Checker()
  let valid = built.video.isValid(for: built.composition, timeRange: CMTimeRange(start: .zero, duration: built.composition.duration), validationDelegate: checker)
  say(valid ? "composition valide" : "COMPOSITION INVALIDE : \(checker.problems.joined(separator: " ; "))")
  guard let export = AVAssetExportSession(asset: built.composition, presetName: AVAssetExportPresetHighestQuality) else { say("ÉCHEC : pas de session d'export"); exit(3) }
  let out = URL(fileURLWithPath: outPath)
  try? FileManager.default.removeItem(at: out)
  export.outputURL = out; export.outputFileType = .mp4
  export.videoComposition = built.video; export.audioMix = built.audio
  export.timeRange = CMTimeRange(start: .zero, duration: built.duration)
  await export.export()
  guard export.status == .completed else { say("ÉCHEC export (\(export.status.rawValue)) : \(export.error.map(detail) ?? "sans erreur")"); exit(4) }
  let made = AVURLAsset(url: out)
  let d = try await made.load(.duration).seconds
  let v = try await made.loadTracks(withMediaType: .video).count, a = try await made.loadTracks(withMediaType: .audio).count
  say("OK : \(out.lastPathComponent), \(String(format: "%.2f", d)) s, \(v) piste vidéo, \(a) piste(s) audio, en \(String(format: "%.1f", Date().timeIntervalSince(started))) s")
}

let args = CommandLine.arguments
Task {
  do {
    switch args.count > 1 ? args[1] : "" {
    case "probe" where args.count > 2: try await probe(args[2])
    case "render" where args.count > 3: try await render(args[2], args[3])
    default: say("usage : bench probe <dossier> | bench render <plan.json> <sortie.mp4>"); exit(1)
    }
    exit(0)
  } catch { say("ERREUR : \(detail(error))"); exit(9) }
}
dispatchMain()
