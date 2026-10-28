Pod::Spec.new do |s|
  s.name           = 'MadaStore'
  s.version        = '1.0.0'
  s.summary        = 'Abonnement MaDa Pro (StoreKit 2)'
  s.description    = 'Produits, achat, restauration et droits actifs pour les offres de core/plans.ts.'
  s.author         = 'MaDa'
  s.homepage       = 'https://madastudio.app'
  s.platforms      = { :ios => '16.4' }
  s.source         = { :git => '' }
  s.static_framework = true
  s.dependency 'ExpoModulesCore'
  s.frameworks     = 'StoreKit'
  s.source_files = '**/*.{h,m,swift}'
end
