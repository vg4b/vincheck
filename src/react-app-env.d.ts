/// <reference types="react-scripts" />

// react-scripts declares *.module.css (CSS Modules) but not plain *.css, so a
// side-effect import like `import './App.css'` has no ambient declaration and
// stricter TS 5.x checking flags it (TS2882). Declare the plain patterns here.
// `*.module.css` stays more specific, so CSS Modules keep their typed export.
declare module '*.css'
declare module '*.scss'

