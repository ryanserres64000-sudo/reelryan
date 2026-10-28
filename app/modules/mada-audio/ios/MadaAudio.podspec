Pod::Spec.new do |s|
  s.name           = 'MadaAudio'
  s.version        = '1.0.0'
  s.summary        = 'Décodage audio de MaDa (AVAudioFile)'
  s.description    = 'Décode un son en mono Float32 pour la détection du tempo.'
  s.author         = 'MaDa'
  s.homepage       = 'https://madastudio.app'
  s.platforms      = { :ios => '16.4' }
  s.source         = { :git => '' }
  s.static_framework = true
  s.dependency 'ExpoModulesCore'
  s.source_files = '**/*.{h,m,swift}'
end
