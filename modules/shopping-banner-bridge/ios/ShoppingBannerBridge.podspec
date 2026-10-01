require 'json'

Pod::Spec.new do |s|
  s.name           = 'ShoppingBannerBridge'
  s.version        = '1.0.0'
  s.summary        = 'Drain Lock Screen shopping check-offs from the App Group store'
  s.description    = 'Shared UserDefaults bridge for ChoreMaxx shopping Live Activity'
  s.license        = 'MIT'
  s.author         = 'ChoreMaxx'
  s.homepage       = 'https://choremaxx.app'
  s.platforms      = { :ios => '15.1' }
  s.source         = { :git => '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  # Same store the Live Activity widget writes into (copied beside this module at prebuild).
  s.source_files = '**/*.{h,m,mm,swift,hpp,cpp}'
end
