require 'json'

package = JSON.parse(File.read(File.join(__dir__, '..', 'package.json')))

# Why this module exists: the npm package it replaces (torch-image-playground) declared
# a minimum of iOS 18.2. The app targets an older iOS, so Expo autolinking skipped that pod
# ("was not linked") and Image Playground never shipped in the build — every phone,
# iOS 27 included, got "not available". This pod declares the app's floor and gates the
# Image Playground APIs with `#available(iOS 18.4, *)` at runtime instead (current SDK
# marks style / personalization APIs 18.4+).
Pod::Spec.new do |s|
  s.name           = 'ChoremaxxImagePlayground'
  s.version        = package['version']
  s.summary        = package['description']
  s.description    = package['description']
  s.license        = 'MIT'
  s.author         = 'Choremaxx'
  s.homepage       = 'https://choremaxx.app'
  s.platforms      = { :ios => '15.1' }
  s.swift_version  = '5.9'
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  # Weak link: the app still launches on iOS versions without the framework.
  s.weak_frameworks = ['ImagePlayground']

  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
  }

  s.source_files = "**/*.{h,m,mm,swift,hpp,cpp}"
end
