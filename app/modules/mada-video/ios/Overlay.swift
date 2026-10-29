import CoreImage
import CoreText
import UIKit

// Texts and logo, drawn once per export file at their place (core/export.ts boxes, top-left origin) and
// laid over the frames by the compositor, with their angle and entrance (core/textlook.ts, the same
// numbers as the preview in app/src/video/TextOverlay.tsx). Sober on purpose (lot 6): brand colours,
// a soft shadow, no glow.
struct Overlay {
  // One picture, or one per number of words shown for « mot par mot »; already placed on the frame.
  let images: [CIImage]; let start: Double; let end: Double
  let anim: String; let center: CGPoint; let rotation: Double
  // Pixels per point of the 1080 layout: 1 for 1080p, 4/3 for 2K, 2 for 4K (core/export.ts QUALITES).
  var scale: CGFloat = 1

  // The overlay at `t`, turned, lifted, scaled and faded as animAt() says, or nil when it is not on.
  func image(at t: Double) -> CIImage? {
    guard t >= start, t < end, !images.isEmpty else { return nil }
    let lt = t - start, len = end - start
    let ease = { (u: Double) in 1 - pow(1 - min(1, max(0, u)), 3) }
    let pin = ease(lt / 0.25), pout = min(1, max(0, (len - lt) / 0.2))
    var a = min(pin, pout), dy = 0.0, k = 1.0, i = images.count - 1
    switch anim {
    case "aucune": a = 1
    case "glisse": dy = (1 - pin) * 40 * Double(scale)
    case "zoom": k = 0.9 + 0.1 * pin
    case "mots": a = pout; i = min(images.count - 1, Int(lt / 0.18))
    case "logo": a = min(1, lt / 0.2, (len - lt) / 0.2)
    default: break
    }
    guard a > 0 else { return nil }
    // Core Image counts y upwards: a clockwise angle is negative, a lift down is a lower y.
    var m = CGAffineTransform(translationX: -center.x, y: -center.y)
    if rotation != 0 { m = m.concatenating(CGAffineTransform(rotationAngle: CGFloat(-rotation * .pi / 180))) }
    if k != 1 { m = m.concatenating(CGAffineTransform(scaleX: CGFloat(k), y: CGFloat(k))) }
    m = m.concatenating(CGAffineTransform(translationX: center.x, y: center.y - CGFloat(dy)))
    let image = images[max(0, i)].transformed(by: m)
    return a < 1 ? image.applyingFilter("CIColorMatrix", parameters: ["inputAVector": CIVector(x: 0, y: 0, z: 0, w: CGFloat(a))]) : image
  }

  static func make(_ t: Timeline, file: ExportFile, sources: Sources, duration: Double) throws -> [Overlay] {
    // Boxes and font sizes are in the 1080 × 1920 layout; a 2K or 4K file draws them `k` times sharper.
    let k = CGFloat(file.w) / 1080, H = Double(file.h) / Double(k)
    let titleFont = sources.fonts?.titre.flatMap(registerFont), textFont = sources.fonts?.texte.flatMap(registerFont)
    let accentFont = sources.fonts?.accent.flatMap(registerFont)
    let ink = UIColor(hex: t.charte.couleurs.texte) ?? .white
    let plateColor = UIColor(hex: t.charte.couleurs.principale) ?? UIColor(hex: "#121212")!
    var out: [Overlay] = []
    for x in file.textes where x.debut < duration {
      let titleStyle = x.style == "accroche" || x.style == "titre"
      let look = x.rendu ?? ExportFile.Rendu(role: titleStyle ? "titre" : "texte", couleur: nil, fond: x.style == "signature" ? "arrondi" : "ombre", align: "centre", anim: "fondu")
      let base: CGFloat = x.style == "accroche" ? 92 : x.style == "titre" ? 76 : x.style == "signature" ? 58 : 50
      let size = CGFloat(x.taille ?? Double(base))
      let title = look.role == "titre"
      let name = look.role == "titre" ? titleFont : look.role == "accent" ? (accentFont ?? textFont) : textFont
      let font = UIFont(name: name ?? "", size: size) ?? .systemFont(ofSize: size, weight: title ? .heavy : .semibold)
      let color = UIColor(hex: look.couleur) ?? ink
      let plate = look.fond == "plein" || look.fond == "arrondi" ? plateColor : nil
      let free = x.libre ?? false
      let text = title ? casse(x.texte, file.duo?.titre.casse) : x.texte
      var pictures: [CGImage] = []
      if title, let accent = x.accent, !accent.isEmpty, let duo = file.duo {
        let small = UIFont(name: accentFont ?? textFont ?? "", size: size * CGFloat(duo.echelle)) ?? .systemFont(ofSize: size * CGFloat(duo.echelle))
        pictures = [drawDuo(text, casse(accent, duo.accent.casse), title: font, accent: small, overlap: duo.chevauchement, color: color, box: x.box, scale: k)]
      } else if look.anim == "mots" {
        // One picture per word shown, as the preview writes them out.
        let words = text.split(separator: " ", omittingEmptySubsequences: true)
        pictures = (1...max(1, words.count)).map { n in drawText(words.prefix(n).joined(separator: " "), font: font, color: color, look: look, plate: plate, box: x.box, free: free, scale: k) }
      } else {
        pictures = [drawText(text, font: font, color: color, look: look, plate: plate, box: x.box, free: free, scale: k)]
      }
      // A text moved by hand is centred on its box's centre; the others fill their box.
      let cx = (x.box.x + x.box.w / 2) * Double(k), cy = (H - x.box.y - x.box.h / 2) * Double(k)
      let images = pictures.map { p -> CIImage in
        let w = Double(p.width), h = Double(p.height)
        return CIImage(cgImage: p).transformed(by: CGAffineTransform(translationX: CGFloat(cx - w / 2), y: CGFloat(cy - h / 2)))
      }
      out.append(Overlay(images: images, start: x.debut, end: min(x.fin, duration), anim: look.anim, center: CGPoint(x: cx, y: cy), rotation: x.rotation ?? 0, scale: k))
    }
    if let box = file.logo, let uri = sources.logo, let url = URL(string: uri), let logo = UIImage(contentsOfFile: url.path)?.cgImage {
      let position = t.charte.logo?.position ?? "aucun"
      let (a, b) = position == "debut" ? (0, min(2, duration)) : position == "fin" ? (max(0, duration - 2.5), duration) : (0, duration)
      out.append(Overlay(images: [place(fit(logo, box: box, scale: k), box: box, H: H, scale: k)], start: a, end: b, anim: "logo", center: CGPoint(x: (box.x + box.w / 2) * Double(k), y: (H - box.y - box.h / 2) * Double(k)), rotation: 0, scale: k))
    }
    return out
  }

  // The text, wrapped in its box's width with its alignment and background. A text in a slot shrinks
  // until it fits its box; a text moved by hand keeps its size and the picture takes its height.
  static func drawText(_ text: String, font: UIFont, color: UIColor, look: ExportFile.Rendu, plate: UIColor?, box: Box, free: Bool, scale: CGFloat = 1) -> CGImage {
    let framed = plate != nil || look.fond == "contour"
    let padX: CGFloat = framed ? 32 : 0, padY: CGFloat = framed ? 16 : 0
    let style = NSMutableParagraphStyle(); style.lineBreakMode = .byWordWrapping
    style.alignment = look.align == "gauche" ? .left : look.align == "droite" ? .right : .center
    let shadow = NSShadow(); shadow.shadowColor = UIColor.black.withAlphaComponent(look.fond == "ombre" ? 0.35 : 0); shadow.shadowBlurRadius = 8; shadow.shadowOffset = CGSize(width: 0, height: 2)
    let width = CGFloat(box.w), inner = width - 2 * padX
    var f = font, attrs: [NSAttributedString.Key: Any] = [:], bounds = CGRect.zero
    repeat {
      style.minimumLineHeight = f.pointSize * 1.2; style.maximumLineHeight = f.pointSize * 1.2
      attrs = [.font: f, .foregroundColor: color, .paragraphStyle: style, .shadow: shadow]
      bounds = (text as NSString).boundingRect(with: CGSize(width: inner, height: .greatestFiniteMagnitude), options: [.usesLineFragmentOrigin], attributes: attrs, context: nil)
      if free || bounds.height <= CGFloat(box.h) - 2 * padY || f.pointSize < 28 { break }
      f = f.withSize(f.pointSize * 0.92)
    } while true
    // Room for the shadow around a free text.
    let size = CGSize(width: width, height: free ? ceil(bounds.height) + 2 * padY + 16 : CGFloat(box.h))
    let format = UIGraphicsImageRendererFormat(); format.scale = scale; format.opaque = false
    return UIGraphicsImageRenderer(size: size, format: format).image { _ in
      let textRect = CGRect(x: padX, y: (size.height - ceil(bounds.height)) / 2, width: inner, height: ceil(bounds.height))
      if framed {
        let w = min(width, ceil(bounds.width) + 2 * padX)
        let x = style.alignment == .left ? 0 : style.alignment == .right ? width - w : (width - w) / 2
        let rect = CGRect(x: x, y: textRect.minY - padY, width: w, height: textRect.height + 2 * padY)
        if let plate {
          plate.setFill()
          UIBezierPath(roundedRect: rect, cornerRadius: look.fond == "arrondi" ? 18 : 0).fill()
        } else {
          color.setStroke()
          let path = UIBezierPath(rect: rect.insetBy(dx: 1.5, dy: 1.5)); path.lineWidth = 3; path.stroke()
        }
      }
      (text as NSString).draw(with: textRect, options: [.usesLineFragmentOrigin], attributes: attrs, context: nil)
    }.cgImage!
  }

  // A title duo (core/typo.ts): the title word on one line, the accent word under it in the fine face,
  // climbing over the title by `overlap` of its height, both shrunk together until they fit the box.
  static func drawDuo(_ text: String, _ accent: String, title: UIFont, accent small: UIFont, overlap: Double, color: UIColor, box: Box, scale: CGFloat = 1) -> CGImage {
    let size = CGSize(width: box.w, height: box.h)
    let shadow = NSShadow(); shadow.shadowColor = UIColor.black.withAlphaComponent(0.35); shadow.shadowBlurRadius = 8; shadow.shadowOffset = CGSize(width: 0, height: 2)
    var k: CGFloat = 1, a: [NSAttributedString.Key: Any] = [:], b: [NSAttributedString.Key: Any] = [:], ra = CGSize.zero, rb = CGSize.zero
    repeat {
      a = [.font: title.withSize(title.pointSize * k), .foregroundColor: color, .shadow: shadow]
      b = [.font: small.withSize(small.pointSize * k), .foregroundColor: color, .shadow: shadow]
      ra = (text as NSString).size(withAttributes: a); rb = (accent as NSString).size(withAttributes: b)
      let height = ra.height + rb.height * (1 - overlap)
      if (max(ra.width, rb.width) <= size.width && height <= size.height) || title.pointSize * k < 28 { break }
      k *= 0.92
    } while true
    let total = ra.height + rb.height * (1 - overlap), top = (size.height - total) / 2
    let format = UIGraphicsImageRendererFormat(); format.scale = scale; format.opaque = false
    return UIGraphicsImageRenderer(size: size, format: format).image { _ in
      (text as NSString).draw(at: CGPoint(x: (size.width - ra.width) / 2, y: top), withAttributes: a)
      (accent as NSString).draw(at: CGPoint(x: (size.width - rb.width) / 2, y: top + ra.height - rb.height * overlap), withAttributes: b)
    }.cgImage!
  }

  static func casse(_ s: String, _ c: String?) -> String {
    let fr = Locale(identifier: "fr_FR")
    return c == "majuscules" ? s.uppercased(with: fr) : c == "minuscules" ? s.lowercased(with: fr) : s
  }

  static func fit(_ logo: CGImage, box: Box, scale: CGFloat = 1) -> CGImage {
    let k = min(box.w / Double(logo.width), box.h / Double(logo.height))
    let w = Double(logo.width) * k, h = Double(logo.height) * k
    let format = UIGraphicsImageRendererFormat(); format.scale = scale; format.opaque = false
    return UIGraphicsImageRenderer(size: CGSize(width: box.w, height: box.h), format: format).image { ctx in
      ctx.cgContext.translateBy(x: 0, y: box.h); ctx.cgContext.scaleBy(x: 1, y: -1)
      ctx.cgContext.draw(logo, in: CGRect(x: (box.w - w) / 2, y: (box.h - h) / 2, width: w, height: h))
    }.cgImage!
  }

  // Core Image counts y from the bottom; the boxes count it from the top.
  static func place(_ image: CGImage, box: Box, H: Double, scale: CGFloat = 1) -> CIImage {
    CIImage(cgImage: image).transformed(by: CGAffineTransform(translationX: box.x * Double(scale), y: (H - box.y - box.h) * Double(scale)))
  }
}

// The brand fonts come as files from the app (expo-font assets); registered once, used by name.
private var registered: [String: String] = [:]
private let fontLock = NSLock()
func registerFont(_ uri: String) -> String? {
  fontLock.lock(); defer { fontLock.unlock() }
  if let name = registered[uri] { return name }
  guard let url = URL(string: uri), let provider = CGDataProvider(url: url as CFURL), let font = CGFont(provider),
        let name = font.postScriptName as String? else { return nil }
  CTFontManagerRegisterGraphicsFont(font, nil) // already registered by expo-font: the name still works
  registered[uri] = name
  return name
}

extension UIColor {
  convenience init?(hex: String?) {
    guard let hex, hex.hasPrefix("#"), hex.count == 7, let v = UInt32(hex.dropFirst(), radix: 16) else { return nil }
    self.init(red: CGFloat((v >> 16) & 0xFF) / 255, green: CGFloat((v >> 8) & 0xFF) / 255, blue: CGFloat(v & 0xFF) / 255, alpha: 1)
  }
}
