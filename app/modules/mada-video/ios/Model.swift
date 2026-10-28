import Foundation

// The timeline JSON v1 (core/timeline.ts) and one file of the export plan (core/export.ts), as the app
// sends them. Only what the render needs is decoded; unknown keys are ignored.
struct Timeline: Decodable {
  struct Plan: Decodable {
    let source: String; let debut: Double; let fin: Double
    let cadrage: String; let transition: String; let garder_son: Bool
    let vitesse: Double; let etalonnage: String; let mouvement: String
    // The level of the rush's own sound, 0 to 2 (étape 4); absent means as recorded.
    let volume: Double?
  }
  // A voice-over, a recording or a sound on its own track (étape 5): placed at `t`, the part from
  // `debut` to `fin` of its file, with fades.
  struct Audio: Decodable { let id: String; let t: Double; let debut: Double; let fin: Double; let volume: Double; let fondu_entree: Double; let fondu_sortie: Double }
  struct Musique: Decodable { let mode: String; let volume: Double; let ducking_voix: Bool; let fondu_sortie: Double }
  struct Charte: Decodable {
    struct Couleurs: Decodable { let principale: String?; let texte: String? }
    struct Logo: Decodable { let position: String }
    let couleurs: Couleurs; let logo: Logo?
  }
  let duree: Double; let plans: [Plan]; let musique: Musique; let charte: Charte; let audios: [Audio]?
}

struct Box: Decodable { let x: Double; let y: Double; let w: Double; let h: Double }

struct ExportFile: Decodable {
  struct Texte: Decodable { let texte: String; let debut: Double; let fin: Double; let style: String; let box: Box; let accent: String? }
  // The title duo of core/typo.ts, resolved: letter case of each line, accent size, overlap.
  struct Duo: Decodable {
    struct Face: Decodable { let casse: String }
    let titre: Face; let accent: Face; let echelle: Double; let chevauchement: Double
  }
  struct Effet: Decodable { let t: Double; let type: String }
  let plateforme: String; let nom: String; let w: Int; let h: Int; let fps: Int; let duree: Double
  let textes: [Texte]; let logo: Box?; let metadonnees: [String: String]
  let duo: Duo?; let effets: [Effet]?
}

// Where the files are on the phone: rushes by id, the logo, the music passage, the fonts (brand or
// title duo), the sound effects by type, and the voice-overs by clip id.
struct Sources: Decodable {
  struct Music: Decodable { let uri: String; let debut: Double; let fin: Double }
  struct Fonts: Decodable { let titre: String?; let texte: String?; let accent: String? }
  let rushes: [String: String]; let logo: String?; let music: Music?; let fonts: Fonts?; let effets: [String: String]?; let audios: [String: String]?
}

func decode<T: Decodable>(_ type: T.Type, _ value: Any) throws -> T {
  try JSONDecoder().decode(type, from: JSONSerialization.data(withJSONObject: value))
}

let TRANSITION_SECONDS = 0.3 // core/timeline.ts
