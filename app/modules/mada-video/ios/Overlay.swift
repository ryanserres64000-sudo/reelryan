import CoreImage
import CoreText
import UIKit

// Texts and logo, drawn once per export file at their place in the platform's safe zone
// (core/export.ts boxes, top-left origin) and laid over the frames by the compositor. Sober on
// purpose (étude, ch. 12 ; rendu naturel du lot 6): brand colours, a soft shadow, no glow.
struct Overlay {
  let image: CIImage; let start: Double; let end: Double
  static let fade = 0.2

  // Fully opaque inside its span, with short fades at both ends.
  func alpha(at t: Double) -> Double {
    guard t >= start, t < end else { return 0 }
    return min(1, (t - start) / Overlay.fade, (end - t) / Overlay.fade)
  }

  static func make(_ t: Timeline, file: ExportFile, sources: Sources, duration: Double) throws -> [Overlay] {
    let H = Double(file.h)
    let titleFont = sources.fonts?.titre.flatMap(registerFont), textFont = sources.fonts?.texte.flatMap(registerFont)
    let accentFont = sources.fonts?.accent.flatMap(registerFont)
    let ink = UIColor(hex: t.charte.couleurs.texte) ?? .white, brand = UIColor(hex: t.charte.couleurs.principale)
    var out: [Overlay] = []
    for x in file.textes where x.debut < duration {
      let title = x.style == "accroche" || x.style == "titre"
      let size: CGFloat = x.style == "accroche" ? 92 : x.style == "titre" ? 76 : x.style == "signature" ? 58 : 50
      let font = UIFont(name: (title ? titleFont : textFont) ?? "", size: size) ?? .systemFont(ofSize: size, weight: title ? .heavy : .semibold)
      let cartouche = x.style == "signature" ? brand : nil
      let text = title ? casse(x.texte, file.duo?.titre.casse) : x.texte
      let picture: CGImage
      if title, let accent = x.accent, !accent.isEmpty {
        let duo = file.duo
        let small = UIFont(name: accentFont ?? textFont ?? "", size: size * CGFloat(duo?.echelle ?? 0.6)) ?? .systemFont(ofSize: size * 0.6)
        picture = drawDuo(text, casse(accent, duo?.accent.casse), title: font, accent: small, overlap: duo?.chevauchement ?? 0.2, color: ink, box: x.box)
      } else {
        picture = drawText(text, font: font, color: ink, plate: cartouche, box: x.box)
      }
      out.append(Overlay(image: place(picture, box: x.box, H: H), start: x.debut, end: min(x.fin, duration)))
    }
    if let box = file.logo, let uri = sources.logo, let url = URL(string: uri), let logo = UIImage(contentsOfFile: url.path)?.cgImage {
      let position = t.charte.logo?.position ?? "aucun"
      let (a, b) = position == "debut" ? (0, min(2, duration)) : position == "fin" ? (max(0, duration - 2.5), duration) : (0, duration)
      out.append(Overlay(image: place(fit(logo, box: box), box: box, H: H), start: a, end: b))
    }
    return out
  }

  // The text, wrapped and centred in its box, shrunk until it fits.
  static func drawText(_ text: String, font: UIFont, color: UIColor, plate: UIColor?, box: Box) -> CGImage {
    let size = CGSize(width: box.w, height: box.h)
    let style = NSMutableParagraphStyle(); style.alignment = .center; style.lineBreakMode = .byWordWrapping
    var f = font, attrs: [NSAttributedString.Key: Any] = [:], bounds = CGRect.zero
    let shadow = NSShadow(); shadow.shadowColor = UIColor.black.withAlphaComponent(plate == nil ? 0.35 : 0); shadow.shadowBlurRadius = 8; shadow.shadowOffset = CGSize(width: 0, height: 2)
    let inner = size.width - (plate == nil ? 0 : 64)
    repeat {
      attrs = [.font: f, .foregroundColor: color, .paragraphStyle: style, .shadow: shadow]
      bounds = (text as NSString).boundingRect(with: CGSize(width: inner, height: .greatestFiniteMagnitude), options: [.usesLineFragmentOrigin], attributes: attrs, context: nil)
      if bounds.height <= size.height - (plate == nil ? 0 : 32) || f.pointSize < 28 { break }
      f = f.withSize(f.pointSize * 0.92)
    } while true
    let format = UIGraphicsImageRendererFormat(); format.scale = 1; format.opaque = false
    return UIGraphicsImageRenderer(size: size, format: format).image { _ in
      let textRect = CGRect(x: (size.width - inner) / 2, y: (size.height - bounds.height) / 2, width: inner, height: ceil(bounds.height))
      if let plate {
        plate.setFill()
        let w = min(size.width, ceil(bounds.width) + 64)
        UIBezierPath(roundedRect: CGRect(x: (size.width - w) / 2, y: textRect.minY - 16, width: w, height: textRect.height + 32), cornerRadius: 18).fill()
      }
      (text as NSString).draw(with: textRect, options: [.usesLineFragmentOrigin], attributes: attrs, context: nil)
    }.cgImage!
  }

  // A title duo (core/typo.ts): the title word on one line, the accent word under it in the fine face,
  // climbing over the title by `overlap` of its height, both shrunk together until they fit the box.
  static func drawDuo(_ text: String, _ accent: String, title: UIFont, accent small: UIFont, overlap: Double, color: UIColor, box: Box) -> CGImage {
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
    let format = UIGraphicsImageRendererFormat(); format.scale = 1; format.opaque = false
    return UIGraphicsImageRenderer(size: size, format: format).image { _ in
      (text as NSString).draw(at: CGPoint(x: (size.width - ra.width) / 2, y: top), withAttributes: a)
      (accent as NSString).draw(at: CGPoint(x: (size.width - rb.width) / 2, y: top + ra.height - rb.height * overlap), withAttributes: b)
    }.cgImage!
  }

  static func casse(_ s: String, _ c: String?) -> String {
    let fr = Locale(identifier: "fr_FR")
    return c == "majuscules" ? s.uppercased(with: fr) : c == "minuscules" ? s.lowercased(with: fr) : s
  }

  static func fit(_ logo: CGImage, box: Box) -> CGImage {
    let k = min(box.w / Double(logo.width), box.h / Double(logo.height))
    let w = Double(logo.width) * k, h = Double(logo.height) * k
    let format = UIGraphicsImageRendererFormat(); format.scale = 1; format.opaque = false
    return UIGraphicsImageRenderer(size: CGSize(width: box.w, height: box.h), format: format).image { ctx in
      ctx.cgContext.translateBy(x: 0, y: box.h); ctx.cgContext.scaleBy(x: 1, y: -1)
      ctx.cgContext.draw(logo, in: CGRect(x: (box.w - w) / 2, y: (box.h - h) / 2, width: w, height: h))
    }.cgImage!
  }

  // Core Image counts y from the bottom; the boxes count it from the top.
  static func place(_ image: CGImage, box: Box, H: Double) -> CIImage {
    CIImage(cgImage: image).transformed(by: CGAffineTransform(translationX: box.x, y: H - box.y - box.h))
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
