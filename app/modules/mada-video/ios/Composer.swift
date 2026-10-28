import AVFoundation
import CoreImage
import ImageIO
import UniformTypeIdentifiers

// One AVComposition for the preview and the export (CLAUDE.md : « on exporte exactement ce qu'on voit
// à l'écran »). Shots alternate between two video tracks so that a transition can overlap two shots;
// MadaCompositor draws every frame (framing, motion, colour, transition, texts, logo) with Core Image.
final class Shot {
  let index: Int; let start: Double; let end: Double; let plan: Timeline.Plan
  let track: CMPersistentTrackID; let still: CIImage?; let orient: CGImagePropertyOrientation; let size: CGSize
  init(index: Int, start: Double, end: Double, plan: Timeline.Plan, track: CMPersistentTrackID, still: CIImage?, orient: CGImagePropertyOrientation, size: CGSize) {
    self.index = index; self.start = start; self.end = end; self.plan = plan; self.track = track; self.still = still; self.orient = orient; self.size = size
  }
}

// A layer over the frame (étape 6): its own video track (or a photo), drawn by the compositor.
final class Layer {
  let calque: Timeline.Calque; let start: Double; let end: Double
  let track: CMPersistentTrackID; let still: CIImage?; let orient: CGImagePropertyOrientation
  init(calque: Timeline.Calque, start: Double, end: Double, track: CMPersistentTrackID, still: CIImage?, orient: CGImagePropertyOrientation) {
    self.calque = calque; self.start = start; self.end = end; self.track = track; self.still = still; self.orient = orient
  }
}

final class RenderPlan {
  let size: CGSize; var shots: [Shot] = []; var layers: [Layer] = []; var overlays: [Overlay] = []
  init(size: CGSize) { self.size = size }
}

struct Built { let composition: AVMutableComposition; let video: AVMutableVideoComposition; let audio: AVMutableAudioMix; let duration: CMTime }

enum Composer {
  static let A: CMPersistentTrackID = 1, B: CMPersistentTrackID = 2

  static func build(_ t: Timeline, file: ExportFile, sources: Sources) async throws -> Built {
    let size = CGSize(width: file.w, height: file.h)
    let comp = AVMutableComposition()
    guard let va = comp.addMutableTrack(withMediaType: .video, preferredTrackID: A),
          let vb = comp.addMutableTrack(withMediaType: .video, preferredTrackID: B) else { throw RenderError.composition }
    let aa = comp.addMutableTrack(withMediaType: .audio, preferredTrackID: kCMPersistentTrackID_Invalid)
    let ab = comp.addMutableTrack(withMediaType: .audio, preferredTrackID: kCMPersistentTrackID_Invalid)
    let plan = RenderPlan(size: size)
    let filler = try await Filler.clip()
    var at = 0.0, voice: [(Double, Double)] = []
    // The level of each shot's own sound, on the audio track it went to.
    var levels: [CMPersistentTrackID: [(Double, Float)]] = [:]

    for (i, p) in t.plans.enumerated() {
      guard let uriString = sources.rushes[p.source], let uri = URL(string: uriString) else { throw RenderError.missingRush(p.source) }
      let speed = p.vitesse > 0 ? p.vitesse : 1
      let length = (p.fin - p.debut) / speed
      if i > 0 && p.transition != "coupe" { at -= TRANSITION_SECONDS }
      let start = at, track = i % 2 == 0 ? va : vb, audioTrack = i % 2 == 0 ? aa : ab
      let target = CMTimeRange(start: time(start), duration: time(length))

      if isImage(uri) {
        // A photo: the filler clip keeps time on the track, the compositor draws the photo instead.
        guard let image = CIImage(contentsOf: uri, options: [.applyOrientationProperty: true]) else { throw RenderError.unreadable(p.source) }
        try insertFiller(filler.track, length: filler.duration, into: track, range: target)
        plan.shots.append(Shot(index: i, start: start, end: start + length, plan: p, track: track.trackID, still: image, orient: .up, size: image.extent.size))
      } else {
        let asset = AVURLAsset(url: uri)
        guard let src = try await asset.loadTracks(withMediaType: .video).first else { throw RenderError.unreadable(p.source) }
        let (natural, transform) = try await src.load(.naturalSize, .preferredTransform)
        let range = CMTimeRange(start: time(p.debut), end: time(p.fin))
        try track.insertTimeRange(range, of: src, at: target.start)
        if speed != 1 { track.scaleTimeRange(CMTimeRange(start: target.start, duration: range.duration), toDuration: target.duration) }
        if p.garder_son, let audioTrack, let srcAudio = try await asset.loadTracks(withMediaType: .audio).first {
          try audioTrack.insertTimeRange(range, of: srcAudio, at: target.start)
          if speed != 1 { audioTrack.scaleTimeRange(CMTimeRange(start: target.start, duration: range.duration), toDuration: target.duration) }
          voice.append((start, start + length))
          levels[audioTrack.trackID, default: []].append((start, Float(min(2, max(0, p.volume ?? 1)))))
        }
        let shown = CGRect(origin: .zero, size: natural).applying(transform)
        plan.shots.append(Shot(index: i, start: start, end: start + length, plan: p, track: track.trackID, still: nil, orient: orientation(transform), size: CGSize(width: abs(shown.width), height: abs(shown.height))))
      }
      at = start + length
    }

    let duration = min(at, file.duree)
    plan.overlays = try Overlay.make(t, file: file, sources: sources, duration: duration)

    // Layers over the frame (étape 6): each on its own track, its sound only when asked (volume > 0).
    var layerSound: [AVMutableAudioMixInputParameters] = []
    for c in t.calques ?? [] where c.t < duration {
      guard let uriString = sources.rushes[c.source], let uri = URL(string: uriString),
            let track = comp.addMutableTrack(withMediaType: .video, preferredTrackID: kCMPersistentTrackID_Invalid) else { continue }
      let length = min(c.fin - c.debut, duration - c.t)
      guard length > 0.05 else { continue }
      let target = CMTimeRange(start: time(c.t), duration: time(length))
      if isImage(uri) {
        guard let image = CIImage(contentsOf: uri, options: [.applyOrientationProperty: true]) else { continue }
        try insertFiller(filler.track, length: filler.duration, into: track, range: target)
        plan.layers.append(Layer(calque: c, start: c.t, end: c.t + length, track: track.trackID, still: image, orient: .up))
      } else {
        let asset = AVURLAsset(url: uri)
        guard let src = try await asset.loadTracks(withMediaType: .video).first else { continue }
        let transform = try await src.load(.preferredTransform)
        try track.insertTimeRange(CMTimeRange(start: time(c.debut), duration: time(length)), of: src, at: target.start)
        plan.layers.append(Layer(calque: c, start: c.t, end: c.t + length, track: track.trackID, still: nil, orient: orientation(transform)))
        if c.volume > 0, let srcAudio = try await asset.loadTracks(withMediaType: .audio).first,
           let audio = comp.addMutableTrack(withMediaType: .audio, preferredTrackID: kCMPersistentTrackID_Invalid) {
          try audio.insertTimeRange(CMTimeRange(start: time(c.debut), duration: time(length)), of: srcAudio, at: target.start)
          let p = AVMutableAudioMixInputParameters(track: audio); p.setVolume(Float(min(2, c.volume)), at: .zero)
          layerSound.append(p)
        }
      }
    }

    // Voice-overs and recordings (étape 5), each on its own track so they may overlap, faded in and
    // out; the music goes down under them like under the voices of the rushes.
    var params: [AVMutableAudioMixInputParameters] = layerSound
    for a in t.audios ?? [] where a.t < duration && a.fin > a.debut {
      guard let uri = sources.audios?[a.id], let url = URL(string: uri),
            let src = try await AVURLAsset(url: url).loadTracks(withMediaType: .audio).first,
            let track = comp.addMutableTrack(withMediaType: .audio, preferredTrackID: kCMPersistentTrackID_Invalid) else { continue }
      let full = try await src.load(.timeRange).duration.seconds
      let length = min(a.fin, full) - a.debut
      let kept = min(length, duration - a.t)
      guard kept > 0.05 else { continue }
      try track.insertTimeRange(CMTimeRange(start: time(a.debut), duration: time(kept)), of: src, at: time(a.t))
      let p = AVMutableAudioMixInputParameters(track: track), v = Float(min(2, max(0, a.volume)))
      p.setVolume(v, at: .zero)
      if a.fondu_entree > 0 { p.setVolumeRamp(fromStartVolume: 0, toEndVolume: v, timeRange: CMTimeRange(start: time(a.t), duration: time(min(a.fondu_entree, kept)))) }
      if a.fondu_sortie > 0 { let f = min(a.fondu_sortie, kept); p.setVolumeRamp(fromStartVolume: v, toEndVolume: 0, timeRange: CMTimeRange(start: time(a.t + kept - f), duration: time(f))) }
      params.append(p)
      voice.append((a.t, a.t + kept))
    }

    // Music (mode « fichier »): the chosen passage from 0, lowered under voices, faded out at the end.
    // In « son tendance » mode there is no music: the person adds the sound in Instagram (ch. 9).
    // Overlapping or close voices make one span, so the music ramps never overlap.
    voice = voice.sorted { $0.0 < $1.0 }.reduce(into: []) { out, r in
      if let last = out.last, r.0 <= last.1 + 0.5 { out[out.count - 1].1 = max(last.1, r.1) } else { out.append(r) }
    }
    if t.musique.mode == "fichier", let m = sources.music, let url = URL(string: m.uri),
       let srcMusic = try await AVURLAsset(url: url).loadTracks(withMediaType: .audio).first,
       let music = comp.addMutableTrack(withMediaType: .audio, preferredTrackID: kCMPersistentTrackID_Invalid) {
      let length = min(m.fin - m.debut, duration)
      try music.insertTimeRange(CMTimeRange(start: time(m.debut), duration: time(length)), of: srcMusic, at: .zero)
      let p = AVMutableAudioMixInputParameters(track: music), v = Float(t.musique.volume)
      p.setVolume(v, at: .zero)
      if t.musique.ducking_voix {
        for (a, b) in voice where b > a + 0.4 {
          p.setVolumeRamp(fromStartVolume: v, toEndVolume: v * 0.3, timeRange: CMTimeRange(start: time(max(0, a - 0.2)), duration: time(0.2)))
          p.setVolumeRamp(fromStartVolume: v * 0.3, toEndVolume: v, timeRange: CMTimeRange(start: time(b), duration: time(0.3)))
        }
      }
      let fade = min(t.musique.fondu_sortie, length)
      if fade > 0 { p.setVolumeRamp(fromStartVolume: v, toEndVolume: 0, timeRange: CMTimeRange(start: time(length - fade), duration: time(fade))) }
      params.append(p)
    }
    // Sound effects on their key moments (core/timeline.ts EFFETS), one shared track, below the voice.
    if let effets = file.effets, !effets.isEmpty, let files = sources.effets,
       let sfx = comp.addMutableTrack(withMediaType: .audio, preferredTrackID: kCMPersistentTrackID_Invalid) {
      var free = 0.0
      for e in effets.sorted(by: { $0.t < $1.t }) where e.t >= free && e.t < duration {
        guard let uri = files[e.type], let url = URL(string: uri),
              let src = try await AVURLAsset(url: url).loadTracks(withMediaType: .audio).first else { continue }
        let full = try await src.load(.timeRange).duration.seconds
        let length = min(full, duration - e.t)
        try sfx.insertTimeRange(CMTimeRange(start: .zero, duration: time(length)), of: src, at: time(e.t))
        free = e.t + length
      }
      let p = AVMutableAudioMixInputParameters(track: sfx); p.setVolume(0.7, at: .zero)
      params.append(p)
    }
    // The voices kept from the rushes play at each shot's level.
    for track in [aa, ab].compactMap({ $0 }) where !track.segments.isEmpty {
      let p = AVMutableAudioMixInputParameters(track: track)
      for (start, level) in levels[track.trackID] ?? [] { p.setVolume(level, at: time(start)) }
      params.append(p)
    }
    let mix = AVMutableAudioMix(); mix.inputParameters = params

    let video = AVMutableVideoComposition()
    video.customVideoCompositorClass = MadaCompositor.self
    video.renderSize = size
    video.frameDuration = CMTime(value: 1, timescale: CMTimeScale(file.fps))
    // The instructions cover the whole composition (AVFoundation refuses gaps); the file is cut later.
    video.instructions = instructions(plan, duration: at)
    return Built(composition: comp, video: video, audio: mix, duration: time(duration))
  }

  // One instruction per span where the same shots and layers are on screen: one shot, or two during
  // a transition, and the layers playing then.
  static func instructions(_ plan: RenderPlan, duration: Double) -> [MadaInstruction] {
    var cuts = Set<Double>([0, duration])
    for s in plan.shots { cuts.insert(min(s.start, duration)); cuts.insert(min(s.end, duration)) }
    for l in plan.layers { cuts.insert(min(l.start, duration)); cuts.insert(min(l.end, duration)) }
    let times = cuts.sorted()
    var out: [MadaInstruction] = []
    for (a, b) in zip(times, times.dropFirst()) where b - a > 0.0005 {
      let mid = (a + b) / 2
      let on = plan.shots.filter { $0.start <= mid && mid < $0.end }
      let layers = plan.layers.filter { $0.start <= mid && mid < $0.end }
      out.append(MadaInstruction(range: CMTimeRange(start: time(a), end: time(b)), shots: on, layers: layers, plan: plan))
    }
    return out
  }

  static func insertFiller(_ filler: AVAssetTrack, length: CMTime, into track: AVMutableCompositionTrack, range: CMTimeRange) throws {
    var cursor = range.start
    while cursor < range.end {
      let piece = min(length, range.end - cursor)
      try track.insertTimeRange(CMTimeRange(start: .zero, duration: piece), of: filler, at: cursor)
      cursor = cursor + piece
    }
  }
}

// The four rotations an iPhone writes in preferredTransform.
func orientation(_ t: CGAffineTransform) -> CGImagePropertyOrientation {
  if t.a == 0 && t.b == 1 && t.c == -1 && t.d == 0 { return .right }
  if t.a == 0 && t.b == -1 && t.c == 1 && t.d == 0 { return .left }
  if t.a == -1 && t.d == -1 { return .down }
  return .up
}

func time(_ s: Double) -> CMTime { CMTime(seconds: max(0, s), preferredTimescale: 600) }

func isImage(_ url: URL) -> Bool {
  guard let type = UTType(filenameExtension: url.pathExtension) else { return false }
  return type.conforms(to: .image)
}

enum RenderError: LocalizedError {
  case composition, missingRush(String), unreadable(String), export(String)
  var errorDescription: String? {
    switch self {
    case .composition: return "Composition impossible."
    case .missingRush(let id): return "Rush introuvable : \(id)."
    case .unreadable(let id): return "Rush illisible : \(id)."
    case .export(let why): return "Export impossible : \(why)."
    }
  }
}

// A 2 s black 1080 × 1920 clip, written once to the cache: photos need a track segment to exist.
enum Filler {
  static func clip() async throws -> (track: AVAssetTrack, duration: CMTime) {
    let url = FileManager.default.temporaryDirectory.appendingPathComponent("mada-filler-v1.mp4")
    if !FileManager.default.fileExists(atPath: url.path) { try await write(url) }
    guard let track = try await AVURLAsset(url: url).loadTracks(withMediaType: .video).first else { throw RenderError.composition }
    return (track, try await track.load(.timeRange).duration)
  }

  static func write(_ url: URL) async throws {
    let tmp = url.deletingLastPathComponent().appendingPathComponent(UUID().uuidString + ".mp4")
    let writer = try AVAssetWriter(outputURL: tmp, fileType: .mp4)
    let input = AVAssetWriterInput(mediaType: .video, outputSettings: [AVVideoCodecKey: AVVideoCodecType.h264, AVVideoWidthKey: 1080, AVVideoHeightKey: 1920])
    let adaptor = AVAssetWriterInputPixelBufferAdaptor(assetWriterInput: input, sourcePixelBufferAttributes: [
      kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_32BGRA, kCVPixelBufferWidthKey as String: 1080, kCVPixelBufferHeightKey as String: 1920,
    ])
    writer.add(input)
    guard writer.startWriting() else { throw writer.error ?? RenderError.composition }
    writer.startSession(atSourceTime: .zero)
    var buffer: CVPixelBuffer?
    CVPixelBufferCreate(nil, 1080, 1920, kCVPixelFormatType_32BGRA, nil, &buffer)
    guard let buffer else { throw RenderError.composition }
    CVPixelBufferLockBaseAddress(buffer, [])
    memset(CVPixelBufferGetBaseAddress(buffer), 0, CVPixelBufferGetDataSize(buffer))
    CVPixelBufferUnlockBaseAddress(buffer, [])
    for frame in 0..<60 {
      while !input.isReadyForMoreMediaData { try await Task.sleep(nanoseconds: 2_000_000) }
      adaptor.append(buffer, withPresentationTime: CMTime(value: CMTimeValue(frame), timescale: 30))
    }
    input.markAsFinished()
    await writer.finishWriting()
    guard writer.status == .completed else { throw writer.error ?? RenderError.composition }
    try? FileManager.default.removeItem(at: url)
    try FileManager.default.moveItem(at: tmp, to: url)
  }
}
