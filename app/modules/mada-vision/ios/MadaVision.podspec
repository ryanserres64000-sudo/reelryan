Pod::Spec.new do |s|
  s.name           = 'MadaVision'
  s.version        = '1.0.0'
  s.summary        = 'Tri des plans de MaDa sur l’iPhone (Vision, SoundAnalysis)'
  s.description    = 'Mesure netteté, luminosité, visages, changements de plan et parole ; écrit les petites images clés.'
  s.author         = 'MaDa'
  s.homepage       = 'https://madastudio.app'
  s.platforms      = { :ios => '16.4' }
  s.source         = { :git => '' }
  s.static_framework = true
  s.swift_version  = '5.9'
  s.dependency 'ExpoModulesCore'
  s.frameworks     = 'Vision', 'SoundAnalysis', 'AVFoundation', 'ImageIO', 'UniformTypeIdentifiers'
  s.source_files = '**/*.{h,m,swift}'
end
