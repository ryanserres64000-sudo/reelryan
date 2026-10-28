import AVFoundation
import CoreImage
import Vision

final class MadaInstruction: NSObject, AVVideoCompositionInstructionProtocol {
  let timeRange: CMTimeRange
  let enablePostProcessing = false
  let containsTweening = true
  let requiredSourceTrackIDs: [NSValue]?
  let passthroughTrackID = kCMPersistentTrackID_Invalid
  let shots: [Shot]; let layers: [Layer]; let plan: RenderPlan
  init(range: CMTimeRange, shots: [Shot], layers: [Layer], plan: RenderPlan) {
    timeRange = range; self.shots = shots; self.layers = layers; self.plan = plan
    requiredSourceTrackIDs = shots.filter { $0.still == nil }.map { NSNumber(value: $0.track) } + layers.filter { $0.still == nil }.map { NSNumber(value: $0.track) }
  }
}

// Draws each frame: the shot framed to 9:16, its slow motion, its colour, the transition with the next
// shot, the layers over the frame (étape 6), then the texts and the logo. The same code runs under AVPlayer and AVAssetExportSession.
final class MadaCompositor: NSObject, AVVideoCompositing {
  private let context = CIContext(options: [.cacheIntermediates: false])
  private let queue = DispatchQueue(label: "mada.compositor")
  let sourcePixelBufferAttributes: [String: Any]? = [kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_32BGRA]
  let requiredPixelBufferAttributesForRenderContext: [String: Any] = [kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_32BGRA]
  func renderContextChanged(_ newRenderContext: AVVideoCompositionRenderContext) {}

  func startRequest(_ request: AVAsynchronousVideoCompositionRequest) {
    queue.async { [self] in
      guard let instruction = request.videoCompositionInstruction as? MadaInstruction,
            let output = request.renderContext.newPixelBuffer() else { request.finish(with: RenderError.composition); return }
      let plan = instruction.plan, t = request.compositionTime.seconds
      let canvas = CGRect(origin: .zero, size: plan.size)
      var frame = CIImage(color: .black).cropped(to: canvas)
      let shots = instruction.shots.sorted { $0.start < $1.start }
      for (n, shot) in shots.enumerated() {
        guard var image = source(shot, request) else { continue }
        image = grade(motion(fill(image, shot, plan.size), shot, t, plan.size), shot.plan.etalonnage)
        // The incoming shot of a transition is drawn over the outgoing one.
        if n > 0, shots.count > 1 {
          let p = max(0, min(1, (t - shot.start) / TRANSITION_SECONDS))
          image = transition(image, shot.plan.transition, p, plan.size)
        }
        frame = image.cropped(to: canvas).composited(over: frame)
      }
      for layer in instruction.layers { if let image = draw(layer, request, t, plan.size) { frame = blend(image, over: frame, layer.calque.fusion) } }
      for o in plan.overlays {
        let a = o.alpha(at: t)
        if a > 0 { frame = fade(o.image, a).composited(over: frame) }
      }
      context.render(frame, to: output, bounds: canvas, colorSpace: CGColorSpace(name: CGColorSpace.sRGB))
      request.finish(withComposedVideoFrame: output)
    }
  }

  private func source(_ shot: Shot, _ request: AVAsynchronousVideoCompositionRequest) -> CIImage? {
    if let still = shot.still { return still }
    guard let buffer = request.sourceFrame(byTrackID: shot.track) else { return nil }
    // Frames come as recorded: turn them upright (portrait iPhone videos are stored sideways).
    let image = CIImage(cvPixelBuffer: buffer).oriented(shot.orient)
    return image.transformed(by: CGAffineTransform(translationX: -image.extent.minX, y: -image.extent.minY))
  }

  // Covers 1080 × 1920; « gauche » or « droite » keeps that side of a horizontal shot.
  private func fill(_ image: CIImage, _ shot: Shot, _ size: CGSize) -> CIImage {
    let e = image.extent, k = max(size.width / e.width, size.height / e.height)
    let w = e.width * k, h = e.height * k
    let x = shot.plan.cadrage == "gauche" ? 0 : shot.plan.cadrage == "droite" ? size.width - w : (size.width - w) / 2
    return image.transformed(by: CGAffineTransform(scaleX: k, y: k)).transformed(by: CGAffineTransform(translationX: x - e.minX * k, y: (size.height - h) / 2 - e.minY * k))
  }

  // A slow push in, pull out or slide over the whole shot: 8 % at most, never a gimmick (lot 6).
  private func motion(_ image: CIImage, _ shot: Shot, _ t: Double, _ size: CGSize) -> CIImage {
    let p = CGFloat(max(0, min(1, (t - shot.start) / max(0.1, shot.end - shot.start))))
    let cx = size.width / 2, cy = size.height / 2
    func zoom(_ s: CGFloat) -> CGAffineTransform { CGAffineTransform(translationX: -cx, y: -cy).concatenating(CGAffineTransform(scaleX: s, y: s)).concatenating(CGAffineTransform(translationX: cx, y: cy)) }
    switch shot.plan.mouvement {
    case "zoom-avant": return image.transformed(by: zoom(1 + 0.08 * p))
    case "zoom-arriere": return image.transformed(by: zoom(1.08 - 0.08 * p))
    case "glisse-gauche": return image.transformed(by: zoom(1.08).concatenating(CGAffineTransform(translationX: size.width * 0.04 * (1 - 2 * p), y: 0)))
    case "glisse-droite": return image.transformed(by: zoom(1.08).concatenating(CGAffineTransform(translationX: -size.width * 0.04 * (1 - 2 * p), y: 0)))
    default: return image
    }
  }

  // The six colours of core/timeline.ts, kept light.
  private func grade(_ image: CIImage, _ name: String) -> CIImage {
    func matrix(_ r: CGFloat, _ g: CGFloat, _ b: CGFloat) -> CIImage {
      image.applyingFilter("CIColorMatrix", parameters: ["inputRVector": CIVector(x: r, y: 0, z: 0, w: 0), "inputGVector": CIVector(x: 0, y: g, z: 0, w: 0), "inputBVector": CIVector(x: 0, y: 0, z: b, w: 0)])
    }
    switch name {
    case "chaud": return matrix(1.05, 1.0, 0.93)
    case "froid": return matrix(0.95, 1.0, 1.06)
    case "contraste": return image.applyingFilter("CIColorControls", parameters: [kCIInputContrastKey: 1.15, kCIInputSaturationKey: 1.05])
    case "desature": return image.applyingFilter("CIColorControls", parameters: [kCIInputSaturationKey: 0.6])
    case "noir-et-blanc": return image.applyingFilter("CIPhotoEffectMono")
    default: return image
    }
  }

  private func transition(_ image: CIImage, _ kind: String, _ p: Double, _ size: CGSize) -> CIImage {
    let q = CGFloat(p)
    switch kind {
    case "fondu": return fade(image, p)
    case "glisse": return image.transformed(by: CGAffineTransform(translationX: size.width * (1 - q), y: 0))
    case "zoom":
      let s = 1.12 - 0.12 * q, cx = size.width / 2, cy = size.height / 2
      return fade(image.transformed(by: CGAffineTransform(translationX: -cx, y: -cy).concatenating(CGAffineTransform(scaleX: s, y: s)).concatenating(CGAffineTransform(translationX: cx, y: cy))), p)
    default: return image
    }
  }

  // A layer at `t`: upright, filling its box, cut out if asked, rounded, turned, faded. The box is in
  // fractions of the frame from the top left (core/layers.ts); Core Image counts from the bottom left.
  private func draw(_ layer: Layer, _ request: AVAsynchronousVideoCompositionRequest, _ t: Double, _ size: CGSize) -> CIImage? {
    var image: CIImage
    if let still = layer.still { image = still }
    else {
      guard let buffer = request.sourceFrame(byTrackID: layer.track) else { return nil }
      let raw = CIImage(cvPixelBuffer: buffer).oriented(layer.orient)
      image = raw.transformed(by: CGAffineTransform(translationX: -raw.extent.minX, y: -raw.extent.minY))
    }
    let c = layer.calque, p = poseAt(c, t)
    let w = CGFloat(c.w * p.echelle) * size.width, h = CGFloat(c.h * p.echelle) * size.height
    guard w > 1, h > 1, p.opacite > 0 else { return nil }
    if c.detourage == "personne" { image = cutPerson(image) } else if c.detourage == "fond-vert" { image = chromaKey(image) }
    // Cover the box, centred, then crop to it.
    let e = image.extent, k = max(w / e.width, h / e.height)
    image = image.transformed(by: CGAffineTransform(scaleX: k, y: k))
    let box = CGRect(x: (image.extent.width - w) / 2 + image.extent.minX, y: (image.extent.height - h) / 2 + image.extent.minY, width: w, height: h)
    image = image.cropped(to: box).transformed(by: CGAffineTransform(translationX: -box.minX, y: -box.minY))
    if c.arrondi > 0, let mask = CIFilter(name: "CIRoundedRectangleGenerator", parameters: ["inputExtent": CIVector(cgRect: CGRect(x: 0, y: 0, width: w, height: h)), "inputRadius": CGFloat(c.arrondi) * min(w, h), "inputColor": CIColor.white])?.outputImage {
      image = image.applyingFilter("CIBlendWithAlphaMask", parameters: [kCIInputBackgroundImageKey: CIImage.empty(), kCIInputMaskImageKey: mask])
    }
    // Turn around its centre, then place its centre at (x, y), y counted from the top.
    let turn = CGAffineTransform(translationX: -w / 2, y: -h / 2).concatenating(CGAffineTransform(rotationAngle: -CGFloat(p.rotation) * .pi / 180))
    image = image.transformed(by: turn.concatenating(CGAffineTransform(translationX: CGFloat(p.x) * size.width, y: size.height - CGFloat(p.y) * size.height)))
    return p.opacite < 1 ? fade(image, p.opacite) : image
  }

  private func blend(_ image: CIImage, over frame: CIImage, _ fusion: String) -> CIImage {
    let name = ["ecran": "CIScreenBlendMode", "produit": "CIMultiplyBlendMode", "incrustation": "CIOverlayBlendMode"][fusion] ?? "CISourceOverCompositing"
    return image.applyingFilter(name, parameters: [kCIInputBackgroundImageKey: frame]).cropped(to: frame.extent)
  }

  // The person kept, the rest transparent (Vision, on the phone; « balanced » keeps up with video).
  private let segmentation: VNGeneratePersonSegmentationRequest = {
    let r = VNGeneratePersonSegmentationRequest(); r.qualityLevel = .balanced; r.outputPixelFormat = kCVPixelFormatType_OneComponent8; return r
  }()
  private func cutPerson(_ image: CIImage) -> CIImage {
    let handler = VNImageRequestHandler(ciImage: image)
    guard (try? handler.perform([segmentation])) != nil, let buffer = segmentation.results?.first?.pixelBuffer else { return image }
    var mask = CIImage(cvPixelBuffer: buffer)
    mask = mask.transformed(by: CGAffineTransform(scaleX: image.extent.width / mask.extent.width, y: image.extent.height / mask.extent.height))
    return image.applyingFilter("CIBlendWithMask", parameters: [kCIInputBackgroundImageKey: CIImage.empty(), kCIInputMaskImageKey: mask])
  }

  // Green made transparent: a colour cube that clears the hues around green, soft at the edges.
  private static let greenCube: Data = {
    let n = 32
    var cube = [Float](repeating: 0, count: n * n * n * 4)
    var i = 0
    for b in 0..<n { for g in 0..<n { for r in 0..<n {
      let rf = Float(r) / Float(n - 1), gf = Float(g) / Float(n - 1), bf = Float(b) / Float(n - 1)
      let mx = max(rf, gf, bf), mn = min(rf, gf, bf), d = mx - mn
      var hue: Float = 0
      if d > 0 { hue = mx == gf ? 60 * ((bf - rf) / d + 2) : mx == rf ? 60 * (((gf - bf) / d).truncatingRemainder(dividingBy: 6)) : 60 * ((rf - gf) / d + 4) }
      if hue < 0 { hue += 360 }
      let sat = mx > 0 ? d / mx : 0
      let green = hue > 80 && hue < 160 && sat > 0.3 && mx > 0.2
      let a: Float = green ? 0 : 1
      cube[i] = rf * a; cube[i + 1] = gf * a; cube[i + 2] = bf * a; cube[i + 3] = a; i += 4
    } } }
    return cube.withUnsafeBufferPointer { Data(buffer: $0) }
  }()
  private func chromaKey(_ image: CIImage) -> CIImage {
    image.applyingFilter("CIColorCube", parameters: ["inputCubeDimension": 32, "inputCubeData": MadaCompositor.greenCube])
  }

  private func fade(_ image: CIImage, _ a: Double) -> CIImage {
    image.applyingFilter("CIColorMatrix", parameters: ["inputAVector": CIVector(x: 0, y: 0, z: 0, w: CGFloat(a))])
  }
}
