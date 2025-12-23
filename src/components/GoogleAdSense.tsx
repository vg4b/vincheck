import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

const AD_CLIENT_ID = 'ca-pub-4198820823364352'

const GoogleAdSense = () => {
	const location = useLocation()

	useEffect(() => {
		// Don't load AdSense on Privacy Policy page
		if (location.pathname === '/ochrana-osobnich-udaju') {
			return
		}

		// Check if script is already present
		const scriptId = 'adsense-script'
		if (document.getElementById(scriptId)) {
			return
		}

		// Inject script
		const script = document.createElement('script')
		script.async = true
		script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${AD_CLIENT_ID}`
		script.crossOrigin = 'anonymous'
		script.id = scriptId

		document.head.appendChild(script)
	}, [location])

	return null
}

export default GoogleAdSense

