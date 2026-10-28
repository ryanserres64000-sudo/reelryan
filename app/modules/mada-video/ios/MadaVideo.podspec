Pod::Spec.new do |s|
  s.name           = 'MadaVideo'
  s.version        = '1.0.0'
  s.summary        = 'Aperçu et export vidéo de MaDa (AVFoundation)'
  s.description    = 'Une seule composition AVFoundation pour l’aperçu (AVPlayer) et l’export (AVAssetExportSession), 1080 × 1920.'
  s.author         = 'MaDa'
  s.homepage       = 'https://madastudio.app'
  s.platforms      = { :ios => '16.4' }
  s.source         = { :git => '' }
  s.static_framework = true
  s.dependency 'ExpoModulesCore'
  s.frameworks     = 'AVFoundation', 'CoreImage', 'CoreText', 'Photos', 'UniformTypeIdentifiers'
  s.source_files = '**/*.{h,m,swift}'
end
