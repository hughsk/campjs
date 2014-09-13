//
// "Prelude"
//
var fitter = document.querySelector('[data-fit]')

refit()
window.addEventListener('resize', refit, false)
function refit() {
  if (!fitter) return
  fitter.style.width  = window.innerWidth + 'px'
  fitter.style.height = window.innerHeight + 'px'
}

var preloader = document.getElementById('preloader')

setTimeout(function() {
  preloader.style.opacity = 0
  setTimeout(function() {
    preloader.style.display = 'none'
  }, 600)
}, 500)

if (window.chrome) {
  require('./scene')
}
