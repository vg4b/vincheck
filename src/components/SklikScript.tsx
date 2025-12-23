import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

const SklikScript = () => {
	const location = useLocation()

	useEffect(() => {
		// Don't load Sklik on Privacy Policy page
		if (location.pathname === '/ochrana-osobnich-udaju') {
			return
		}

		// Check if script is already present
		const scriptId = 'sklik-script'
		if (document.getElementById(scriptId)) {
			return
		}

		// Inject script
		const script = document.createElement('script')
		script.src = 'https://ssp.seznam.cz/static/js/ssp.js'
		script.id = scriptId
		script.async = true
		document.head.appendChild(script)
	}, [location])

	return null
}

export default SklikScript

